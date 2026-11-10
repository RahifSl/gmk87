import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Sparkles,
  Sliders,
  Zap,
  Music,
  Cpu,
  Gauge,
  Clock,
  Bookmark,
  Plus,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  ArrowLeftRight,
  Palette,
  Keyboard,
  Tv,
  Binary,
  Mic,
  Play,
  Square,
} from 'lucide-react';
import {
  Gmk87ConfigState,
  LCD_WIDTH,
  LCD_HEIGHT,
  serializeConfigBuffer,
} from '../services/gmk87Hid';
import { GMK87_PHYSICAL_KEYS } from '../data/gmk87KeymapData';
import {
  GMK87_ALL_19_RGB_MODES,
  CURATED_RGB_PRESETS,
  FN_LIGHTING_SHORTCUTS,
  GMK87_LOGO_MODES,
  GMK87_LOGO_COLORS,
  RgbEffectCategory,
  RgbColorwayPreset,
  FnLightingShortcutItem,
  KeyRippleEvent,
  computePerKeyShader,
  computeChassisUnderglowVisuals,
  computeLogoBarVisual,
  hslToRgb,
  rgbToHsv,
  hsvToRgb,
} from '../data/rgbStudioData';
import {
  ProceduralAnimId,
  LcdCustomizationOptions,
  drawProceduralAnimationFrame,
  TelemetryHudMetrics,
} from '../utils/lcdGenerators';

export interface SavedUserRgbScene {
  id: string;
  name: string;
  effect: number;
  brightness: number;
  speed: number;
  effectDirection: number;
  rainbowMode: number;
  r: number;
  g: number;
  b: number;
  linkedLcdAnim: ProceduralAnimId;
  createdAt: string;
}

type ReactiveEngineMode = 'off' | 'audio' | 'thermal' | 'wpm' | 'cycle' | 'schedule';

interface RgbUnderglowStudioProps {
  configState: Gmk87ConfigState;
  rawHardwareConfig: Uint8Array;
  onUpdateRgbConfig: (partial: Partial<Gmk87ConfigState>, previewOnly?: boolean) => Promise<void> | void;
  pressedKeyIds: Set<string>;
  liveWpm: number;
  telemetry: TelemetryHudMetrics;
  activePreviewAnim: ProceduralAnimId;
  lcdCustom: LcdCustomizationOptions;
  onSyncLcdTheme: (
    animId: ProceduralAnimId,
    tintHex: string,
    flashImmediately: boolean
  ) => Promise<void> | void;
  targetSlot: 0 | 1;
  onStatusLog: (msg: string) => void;
}

const STORAGE_KEY_SCENES = 'gmk87_saved_rgb_scenes_v1';

const DEFAULT_SAVED_SCENES: SavedUserRgbScene[] = [
  {
    id: 'user_night_city',
    name: 'My Night City Setup',
    effect: 1,
    brightness: 4,
    speed: 3,
    effectDirection: 0,
    rainbowMode: 0,
    r: 6,
    g: 182,
    b: 212,
    linkedLcdAnim: 'sandevistan-cyber',
    createdAt: 'Preset',
  },
  {
    id: 'user_stealth_code',
    name: 'Late Night Coding',
    effect: 6,
    brightness: 3,
    speed: 2,
    effectDirection: 0,
    rainbowMode: 0,
    r: 139,
    g: 92,
    b: 246,
    linkedLcdAnim: 'lofi-rain',
    createdAt: 'Preset',
  },
];

export default function RgbUnderglowStudio({
  configState,
  rawHardwareConfig,
  onUpdateRgbConfig,
  pressedKeyIds,
  liveWpm,
  telemetry,
  activePreviewAnim,
  lcdCustom,
  onSyncLcdTheme,
  targetSlot,
  onStatusLog,
}: RgbUnderglowStudioProps) {
  // Animation clock for 60 FPS per-key & 360-degree underglow visualizer
  const [animTimeSec, setAnimTimeSec] = useState<number>(0);
  const [ripples, setRipples] = useState<KeyRippleEvent[]>([]);
  const miniLcdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumPickerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Mode category filter
  const [selectedCategory, setSelectedCategory] = useState<RgbEffectCategory>('All');
  const [autoSyncLcdOnPreset, setAutoSyncLcdOnPreset] = useState<boolean>(true);

  // Reactive & Automation Engine state
  const [reactiveMode, setReactiveMode] = useState<ReactiveEngineMode>('off');
  const [streamReactiveToHardware, setStreamReactiveToHardware] = useState<boolean>(false);
  const [audioMicActive, setAudioMicActive] = useState<boolean>(false);
  const [audioSensitivity, setAudioSensitivity] = useState<number>(75);
  const [audioBands, setAudioBands] = useState<number[]>(() => new Array(16).fill(0.2));
  const [simulatedCpuLoad, setSimulatedCpuLoad] = useState<number | null>(null);
  const [cycleIntervalSec, setCycleIntervalSec] = useState<number>(4);
  const [dayStartHour, setDayStartHour] = useState<number>(8);
  const [nightStartHour, setNightStartHour] = useState<number>(20);
  const [dayPresetId, setDayPresetId] = useState<string>('nordic-frost');
  const [nightPresetId, setNightPresetId] = useState<string>('edgerunner');

  // Web Audio API refs for Audio-Reactive RGB
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const lastHardwarePushRef = useRef<number>(0);

  // Saved Custom Scenes
  const [savedScenes, setSavedScenes] = useState<SavedUserRgbScene[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SCENES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_SAVED_SCENES;
  });
  const [newSceneName, setNewSceneName] = useState<string>('');

  // Raw 48B/64B Hex Inspector baseline & copy state
  const [baselineBytes, setBaselineBytes] = useState<Uint8Array>(() => new Uint8Array(rawHardwareConfig));
  const userSnapshottedBaselineRef = useRef<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<boolean>(false);
  const [hexInputText, setHexInputText] = useState<string>('');

  useEffect(() => {
    if (!userSnapshottedBaselineRef.current && rawHardwareConfig && rawHardwareConfig.length >= 48) {
      setBaselineBytes(new Uint8Array(rawHardwareConfig));
    }
  }, [rawHardwareConfig]);

  const effectDirection = configState.effectDirection ?? 0;
  const rainbowMode = configState.rainbowMode ?? 0;
  const logoMode = configState.logoMode ?? 0;
  const logoBrightness = configState.logoBrightness ?? 4;
  const logoRainbow = configState.logoRainbow ?? 0;
  const logoColor = configState.logoColor ?? 0;

  const rgbHexColor = useMemo(() => {
    const r = Math.max(0, Math.min(255, configState.rgbHueR)).toString(16).padStart(2, '0');
    const g = Math.max(0, Math.min(255, configState.rgbHueG)).toString(16).padStart(2, '0');
    const b = Math.max(0, Math.min(255, configState.rgbHueB)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }, [configState.rgbHueR, configState.rgbHueG, configState.rgbHueB]);

  useEffect(() => {
    setHexInputText(rgbHexColor);
  }, [rgbHexColor]);

  const [hueDeg, satPct, valPct] = useMemo(
    () => rgbToHsv(configState.rgbHueR, configState.rgbHueG, configState.rgbHueB),
    [configState.rgbHueR, configState.rgbHueG, configState.rgbHueB]
  );

  const activeModeDef = useMemo(
    () =>
      GMK87_ALL_19_RGB_MODES.find((m) => m.id === configState.lightingEffect) ||
      GMK87_ALL_19_RGB_MODES[0],
    [configState.lightingEffect]
  );

  // Persist user scenes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SCENES, JSON.stringify(savedScenes));
    } catch {
      // ignore storage error
    }
  }, [savedScenes]);

  // Register physical keystrokes into the reactive ripple queue
  useEffect(() => {
    if (pressedKeyIds.size === 0) return;
    const now = performance.now();
    const added: KeyRippleEvent[] = [];
    pressedKeyIds.forEach((id) => {
      const k = GMK87_PHYSICAL_KEYS.find((item) => item.id === id);
      if (k) {
        added.push({
          x: k.x + k.w / 2,
          y: k.y + (k.h ?? 1) / 2,
          row: k.row,
          col: k.col,
          timestamp: now,
        });
      }
    });
    if (added.length > 0) {
      setRipples((prev) => [...prev.filter((r) => now - r.timestamp < 1600), ...added].slice(-24));
    }
  }, [pressedKeyIds]);

  // 25 FPS smooth animation ticker for the 87-key + 360-degree underglow visualizer (paused when hidden)
  useEffect(() => {
    const start = performance.now();
    let frameCount = 0;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = performance.now();
      setAnimTimeSec((now - start) / 1000);
      frameCount++;

      // Also draw the embedded 240x135 LCD preview inside the visualizer chassis
      const lcdCanvas = miniLcdCanvasRef.current;
      if (lcdCanvas && frameCount % 2 === 0) {
        const ctx = lcdCanvas.getContext('2d');
        if (ctx) {
          drawProceduralAnimationFrame(
            ctx,
            activePreviewAnim,
            Math.floor(frameCount / 2),
            telemetry,
            undefined,
            lcdCustom
          );
        }
      }
    }, 45);
    return () => clearInterval(id);
  }, [activePreviewAnim, telemetry, lcdCustom]);

  // Draw the 2D HSV Hue/Saturation Spectrum Canvas
  useEffect(() => {
    const canvas = spectrumPickerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;

    const img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      const s = 100 - (y / h) * 100;
      for (let x = 0; x < w; x++) {
        const hue = (x / w) * 360;
        const [r, g, b] = hsvToRgb(hue, s, 96);
        const idx = (y * w + x) * 4;
        img.data[idx] = r;
        img.data[idx + 1] = g;
        img.data[idx + 2] = b;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Draw crosshair at current [hueDeg, satPct]
    const cx = Math.round((hueDeg / 360) * w);
    const cy = Math.round(((100 - satPct) / 100) * h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#0b0f19';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
    ctx.stroke();
  }, [hueDeg, satPct]);

  const lastPushedReactiveRef = useRef<{
    lightingEffect?: number;
    brightness?: number;
    speed?: number;
    effectDirection?: number;
    rainbowMode?: number;
    rgbHueR: number;
    rgbHueG: number;
    rgbHueB: number;
  } | null>(null);

  // Update studio preview immediately; write USB EEPROM at most every 750ms on material change (reduces EEPROM flash wear)
  const pushReactiveRgbUpdate = useCallback(
    (partial: Partial<Gmk87ConfigState>) => {
      if (!streamReactiveToHardware) {
        onUpdateRgbConfig(partial, true);
        return;
      }

      const prevSnap = lastPushedReactiveRef.current;
      const nextR = partial.rgbHueR ?? configState.rgbHueR;
      const nextG = partial.rgbHueG ?? configState.rgbHueG;
      const nextB = partial.rgbHueB ?? configState.rgbHueB;

      const settingChanged =
        !prevSnap ||
        (partial.lightingEffect !== undefined && partial.lightingEffect !== prevSnap.lightingEffect) ||
        (partial.brightness !== undefined && partial.brightness !== prevSnap.brightness) ||
        (partial.speed !== undefined && partial.speed !== prevSnap.speed) ||
        (partial.effectDirection !== undefined && partial.effectDirection !== prevSnap.effectDirection) ||
        (partial.rainbowMode !== undefined && partial.rainbowMode !== prevSnap.rainbowMode);

      const rgbDelta = prevSnap
        ? Math.abs(nextR - prevSnap.rgbHueR) +
          Math.abs(nextG - prevSnap.rgbHueG) +
          Math.abs(nextB - prevSnap.rgbHueB)
        : 999;

      const now = Date.now();
      if (now - lastHardwarePushRef.current >= 750 && (settingChanged || rgbDelta >= 12)) {
        lastHardwarePushRef.current = now;
        lastPushedReactiveRef.current = {
          lightingEffect: partial.lightingEffect ?? configState.lightingEffect,
          brightness: partial.brightness ?? configState.brightness,
          speed: partial.speed ?? configState.speed,
          effectDirection: partial.effectDirection ?? configState.effectDirection,
          rainbowMode: partial.rainbowMode ?? configState.rainbowMode,
          rgbHueR: nextR,
          rgbHueG: nextG,
          rgbHueB: nextB,
        };
        onUpdateRgbConfig(partial, false);
      } else {
        onUpdateRgbConfig(partial, true);
      }
    },
    [
      onUpdateRgbConfig,
      streamReactiveToHardware,
      configState.lightingEffect,
      configState.brightness,
      configState.speed,
      configState.effectDirection,
      configState.rainbowMode,
      configState.rgbHueR,
      configState.rgbHueG,
      configState.rgbHueB,
    ]
  );

  // Toggle Web Audio Microphone for Audio-Reactive RGB
  const handleToggleAudioMic = async () => {
    if (audioMicActive) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      setAudioMicActive(false);
      onStatusLog('Audio-Reactive RGB switched to Built-in Synth Beat Generator.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);

      micStreamRef.current = stream;
      audioCtxRef.current = audioCtx;
      analyserRef.current = analyser;
      setAudioMicActive(true);
      setReactiveMode('audio');
      onStatusLog('Microphone connected to Audio-Reactive RGB Beat Engine.');
    } catch (err: any) {
      onStatusLog(
        `Microphone access unavailable (${err?.message || 'permission denied'}). Using Demo Beat Generator.`
      );
    }
  };

  // Cleanup mic on unmount
  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Smart Reactive Lighting Engine Loop (Audio Beat / Thermal CPU / WPM Velocity / Colour Cycle / Schedule)
  useEffect(() => {
    if (reactiveMode === 'off') return;

    const intervalMs =
      reactiveMode === 'audio'
        ? 180
        : reactiveMode === 'cycle'
        ? Math.max(500, cycleIntervalSec * 250)
        : 450;

    let stepCounter = 0;
    const timer = setInterval(() => {
      stepCounter++;

      if (reactiveMode === 'audio') {
        let bands: number[] = [];
        if (audioMicActive && analyserRef.current) {
          const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
          analyserRef.current.getByteFrequencyData(buf);
          for (let i = 0; i < 16; i++) {
            bands.push(Math.min(1, ((buf[i] || 0) / 255) * (audioSensitivity / 65)));
          }
        } else {
          // Synth beat generator
          const t = performance.now() / 1000;
          const kick = Math.pow(0.5 + 0.5 * Math.sin(t * 6.5), 4);
          for (let i = 0; i < 16; i++) {
            const wave =
              0.2 +
              0.5 * Math.abs(Math.sin(t * 4.2 + i * 0.45)) +
              (i < 4 ? kick * 0.45 : 0);
            bands.push(Math.min(1, wave * (audioSensitivity / 75)));
          }
        }
        setAudioBands(bands);

        const bassAvg = (bands[0] + bands[1] + bands[2] + bands[3]) / 4;
        const targetBri = Math.max(2, Math.min(9, Math.round(bassAvg * 9)));
        const beatHue = ( Math.round(bassAvg * 260 + stepCounter * 14) ) % 360;
        const [r, g, b] = hslToRgb(beatHue, 96, 54);

        if (stepCounter % 2 === 0) {
          pushReactiveRgbUpdate({
            brightness: targetBri,
            rgbHueR: r,
            rgbHueG: g,
            rgbHueB: b,
            rainbowMode: 0,
          });
        }
      } else if (reactiveMode === 'thermal') {
        const load = simulatedCpuLoad !== null ? simulatedCpuLoad : telemetry.cpuPercent;
        // Cool Cyan (190 deg) at 15% -> Emerald (140 deg) at 45% -> Amber (38 deg) at 75% -> Crimson (0 deg) at 95%
        const clamped = Math.max(10, Math.min(100, load));
        const hue = Math.max(0, Math.round(195 - ((clamped - 10) / 90) * 195));
        const [r, g, b] = hslToRgb(hue, 96, 52);
        const speed = clamped >= 80 ? 4 : clamped >= 55 ? 3 : clamped >= 35 ? 2 : 1;
        pushReactiveRgbUpdate({
          rgbHueR: r,
          rgbHueG: g,
          rgbHueB: b,
          speed,
          rainbowMode: 0,
        });
      } else if (reactiveMode === 'wpm') {
        // WPM Velocity Overdrive: 0 WPM = Deep Blue (230 deg), 50 WPM = Cyan (180), 90 WPM = Magenta (300), 120+ WPM = Crimson/Gold (15)
        const clampedWpm = Math.max(0, Math.min(130, liveWpm));
        const hue = (230 - Math.round((clampedWpm / 130) * 215) + 360) % 360;
        const [r, g, b] = hslToRgb(hue, 95, 55);
        const speed = clampedWpm >= 90 ? 4 : clampedWpm >= 60 ? 3 : clampedWpm >= 30 ? 2 : 1;
        const bri = clampedWpm > 5 ? 9 : 6;
        pushReactiveRgbUpdate({
          rgbHueR: r,
          rgbHueG: g,
          rgbHueB: b,
          speed,
          brightness: bri,
          rainbowMode: 0,
        });
      } else if (reactiveMode === 'cycle') {
        const nextHue = (hueDeg + 18) % 360;
        const [r, g, b] = hsvToRgb(nextHue, Math.max(80, satPct), Math.max(85, valPct));
        pushReactiveRgbUpdate({
          rgbHueR: r,
          rgbHueG: g,
          rgbHueB: b,
          rainbowMode: 0,
        });
      } else if (reactiveMode === 'schedule') {
        const currentHour = new Date().getHours();
        const isDaytime =
          dayStartHour < nightStartHour
            ? currentHour >= dayStartHour && currentHour < nightStartHour
            : currentHour >= dayStartHour || currentHour < nightStartHour;
        const targetId = isDaytime ? dayPresetId : nightPresetId;
        const preset =
          CURATED_RGB_PRESETS.find((p) => p.id === targetId) || CURATED_RGB_PRESETS[0];
        if (
          configState.lightingEffect !== preset.effect ||
          configState.rgbHueR !== preset.r ||
          configState.rgbHueG !== preset.g ||
          configState.rgbHueB !== preset.b
        ) {
          pushReactiveRgbUpdate({
            lightingEffect: preset.effect,
            brightness: preset.brightness,
            speed: preset.speed,
            effectDirection: preset.effectDirection,
            rainbowMode: preset.rainbowMode,
            rgbHueR: preset.r,
            rgbHueG: preset.g,
            rgbHueB: preset.b,
          });
        }
      }
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    reactiveMode,
    audioMicActive,
    audioSensitivity,
    simulatedCpuLoad,
    telemetry.cpuPercent,
    liveWpm,
    cycleIntervalSec,
    hueDeg,
    satPct,
    valPct,
    dayStartHour,
    nightStartHour,
    dayPresetId,
    nightPresetId,
    configState.lightingEffect,
    configState.rgbHueR,
    configState.rgbHueG,
    configState.rgbHueB,
    pushReactiveRgbUpdate,
  ]);

  // Apply Curated Preset
  const handleApplyPreset = (preset: RgbColorwayPreset, flashLcd = false) => {
    setReactiveMode('off');
    onUpdateRgbConfig({
      lightingEffect: preset.effect,
      brightness: preset.brightness,
      speed: preset.speed,
      effectDirection: preset.effectDirection,
      rainbowMode: preset.rainbowMode,
      rgbHueR: preset.r,
      rgbHueG: preset.g,
      rgbHueB: preset.b,
    });
    const hex = `#${preset.r.toString(16).padStart(2, '0')}${preset.g
      .toString(16)
      .padStart(2, '0')}${preset.b.toString(16).padStart(2, '0')}`;
    if (autoSyncLcdOnPreset || flashLcd) {
      onSyncLcdTheme(preset.linkedLcdAnim, hex, flashLcd);
    } else {
      onStatusLog(`Applied RGB Preset "${preset.name}" (Mode 0x${preset.effect.toString(16).padStart(2, '0')}, ${hex.toUpperCase()})`);
    }
  };

  // Save current RGB state as a custom user scene
  const handleSaveCurrentScene = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSceneName.trim() || `Custom Scene #${savedScenes.length + 1}`;
    const newScene: SavedUserRgbScene = {
      id: `scene_${Date.now()}`,
      name: title,
      effect: configState.lightingEffect,
      brightness: configState.brightness,
      speed: configState.speed,
      effectDirection,
      rainbowMode,
      r: configState.rgbHueR,
      g: configState.rgbHueG,
      b: configState.rgbHueB,
      linkedLcdAnim: activePreviewAnim,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setSavedScenes((prev) => [newScene, ...prev]);
    setNewSceneName('');
    onStatusLog(`Saved custom RGB + LCD scene "${title}" to studio memory.`);
  };

  // Execute hardware Fn Lighting Shortcut simulation
  const handleTriggerFnShortcut = (item: FnLightingShortcutItem) => {
    setReactiveMode('off');
    switch (item.actionType) {
      case 'next-effect': {
        const nextEff = (configState.lightingEffect % 18) + 1;
        onUpdateRgbConfig({ lightingEffect: nextEff });
        onStatusLog(`Simulated ${item.combo}: Cycled cfg[1] Lighting Effect → 0x${nextEff.toString(16).padStart(2, '0')}`);
        break;
      }
      case 'next-hue': {
        if (!rainbowMode) {
          onUpdateRgbConfig({ rainbowMode: 1 });
          onStatusLog(`Simulated ${item.combo}: Enabled Full-Spectrum Rainbow Mode (cfg[5] = 1)`);
        } else {
          const [r, g, b] = hslToRgb((hueDeg + 45) % 360, 95, 54);
          onUpdateRgbConfig({ rainbowMode: 0, rgbHueR: r, rgbHueG: g, rgbHueB: b });
          onStatusLog(`Simulated ${item.combo}: Cycled Single Hue R:${r} G:${g} B:${b} (cfg[5] = 0)`);
        }
        break;
      }
      case 'toggle-led': {
        const nextMode = configState.lightingEffect === 0 ? 1 : 0;
        onUpdateRgbConfig({ lightingEffect: nextMode });
        onStatusLog(
          `Simulated ${item.combo}: ${nextMode === 0 ? 'Turned LEDs OFF (0x00)' : 'Restored Wave LEDs (0x01)'}`
        );
        break;
      }
      case 'bri-up': {
        const nextBri = Math.min(4, configState.brightness + 1);
        onUpdateRgbConfig({ brightness: nextBri });
        onStatusLog(`Simulated ${item.combo}: Brightness cfg[2] → ${nextBri}/4`);
        break;
      }
      case 'bri-down': {
        const nextBri = Math.max(0, configState.brightness - 1);
        onUpdateRgbConfig({ brightness: nextBri });
        onStatusLog(`Simulated ${item.combo}: Brightness cfg[2] → ${nextBri}/4`);
        break;
      }
      case 'spd-up': {
        const nextSpd = Math.min(4, configState.speed + 1);
        onUpdateRgbConfig({ speed: nextSpd });
        onStatusLog(`Simulated ${item.combo}: Speed cfg[3] → ${nextSpd}/4`);
        break;
      }
      case 'spd-down': {
        const nextSpd = Math.max(0, configState.speed - 1);
        onUpdateRgbConfig({ speed: nextSpd });
        onStatusLog(`Simulated ${item.combo}: Speed cfg[3] → ${nextSpd}/4`);
        break;
      }
      case 'toggle-dir': {
        const nextDir = effectDirection ? 0 : 1;
        onUpdateRgbConfig({ effectDirection: nextDir });
        onStatusLog(
          `Simulated ${item.combo}: Reversed Effect Direction cfg[4] → ${nextDir} (${nextDir ? 'Reverse ◄/▲' : 'Forward ►/▼'})`
        );
        break;
      }
    }
  };

  // Click on 2D HSV Spectrum Canvas
  const handleSpectrumCanvasPick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = spectrumPickerCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(0, Math.min(canvas.width - 1, (e.clientX - rect.left) * (canvas.width / rect.width)));
    const y = Math.max(0, Math.min(canvas.height - 1, (e.clientY - rect.top) * (canvas.height / rect.height)));
    const pickedHue = Math.round((x / canvas.width) * 360);
    const pickedSat = Math.round(100 - (y / canvas.height) * 100);
    const [r, g, b] = hsvToRgb(pickedHue, pickedSat, Math.max(50, valPct));
    setReactiveMode('off');
    onUpdateRgbConfig({
      rgbHueR: r,
      rgbHueG: g,
      rgbHueB: b,
      rainbowMode: 0,
    });
  };

  // Current serialized 48B/64B EEPROM buffer for the live Hex Inspector
  const liveSerializedBytes = useMemo(
    () => serializeConfigBuffer(configState, rawHardwareConfig),
    [configState, rawHardwareConfig]
  );

  const modifiedByteIndices = useMemo(() => {
    const diffs = new Set<number>();
    const len = Math.min(liveSerializedBytes.length, baselineBytes.length);
    for (let i = 0; i < len; i++) {
      // Ignore ticking RTC clock registers [35..41] so diff count matches highlighted config diffs
      if (i >= 35 && i <= 41) continue;
      if (liveSerializedBytes[i] !== baselineBytes[i]) {
        diffs.add(i);
      }
    }
    return diffs;
  }, [liveSerializedBytes, baselineBytes]);

  // Compute 360-degree perimeter underglow halo + 4 edge diffuser bars + logo light bar synchronously from hardware shader
  const chassisUnderglow = useMemo(
    () =>
      computeChassisUnderglowVisuals({
        effect: configState.lightingEffect,
        brightness: configState.brightness,
        speed: configState.speed,
        direction: effectDirection,
        rainbow: rainbowMode,
        baseR: configState.rgbHueR,
        baseG: configState.rgbHueG,
        baseB: configState.rgbHueB,
        timeSec: animTimeSec,
        ripples,
      }),
    [
      configState.lightingEffect,
      configState.brightness,
      configState.speed,
      configState.rgbHueR,
      configState.rgbHueG,
      configState.rgbHueB,
      effectDirection,
      rainbowMode,
      animTimeSec,
      ripples,
    ]
  );

  const logoBarVisual = useMemo(
    () =>
      computeLogoBarVisual({
        logoMode,
        logoBrightness,
        logoRainbow,
        logoColor,
        timeSec: animTimeSec,
      }),
    [logoMode, logoBrightness, logoRainbow, logoColor, animTimeSec]
  );

  const filteredModes = useMemo(() => {
    if (selectedCategory === 'All') return GMK87_ALL_19_RGB_MODES;
    return GMK87_ALL_19_RGB_MODES.filter((m) => m.category === selectedCategory);
  }, [selectedCategory]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HERO STAGE: FULL 87-KEY TKL + 360° SIDE UNDERGLOW HALO VISUALIZER
         ===================================================================== */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#06b6d4]" />
                Live 87-Key South-Facing RGB + 360° Side Underglow Halo Visualizer
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-[#06b6d4]/15 border border-[#06b6d4]/40 text-[#06b6d4]">
                MODE {activeModeDef.hex}: {activeModeDef.name.toUpperCase()}
              </span>
              {reactiveMode !== 'off' && (
                <span className="px-2.5 py-0.5 text-[11px] font-mono font-semibold rounded-md bg-[#10b981]/20 border border-[#10b981] text-[#10b981]">
                  REACTIVE ENGINE: {reactiveMode.toUpperCase()}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time hardware shader previewing all 87 south-facing switch LEDs, 360° perimeter
              diffuser strips, and nav-cluster Logo LED bar. Click any keycap or type on your physical
              keyboard to test reactive modes (Slowly Off `0x07`, Stone Ripple `0x08`, Laser `0x09`).
            </p>
          </div>

          {/* 1-Click LCD + RGB Ambilight Cross-Sync Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() =>
                onSyncLcdTheme(activeModeDef.recommendedLcdAnim, rgbHexColor, false)
              }
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0b0f19] border border-[#06b6d4]/60 text-[#06b6d4] hover:bg-[#06b6d4]/15 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5" />
              Sync 240×135 LCD Preview ({activeModeDef.recommendedLcdAnim})
            </button>
            <button
              type="button"
              onClick={() =>
                onSyncLcdTheme(activeModeDef.recommendedLcdAnim, rgbHexColor, true)
              }
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5" />
              Flash Synced Ambilight LCD to Slot {targetSlot}
            </button>
          </div>
        </div>

        {/* 87-Key TKL Deck inside 360-Degree Underglow Halo Stage */}
        <div className="w-full overflow-x-auto py-10 px-8 flex justify-center bg-[#070a12] rounded-2xl border border-[#1e293b]">
          <div
            className="relative shrink-0 rounded-2xl p-4 bg-gradient-to-b from-[#0a0e18] via-[#070910] to-[#04060b] border-2 transition-[border-color] duration-150 select-none"
            style={{
              width: '1040px',
              height: '386px',
              borderColor: chassisUnderglow.borderColor,
              boxShadow: chassisUnderglow.boxShadow,
            }}
          >
            {/* 4 CNC Gasket Mounting Hex Bolts in Plate Corners */}
            <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>
            <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>
            <div className="absolute bottom-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>
            <div className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>

            {/* Technical Plate Engraving */}
            <div className="absolute bottom-2.5 right-12 text-[8px] font-mono tracking-widest text-slate-600 select-none uppercase pointer-events-none">
              GMK87 360° HALO // 19 HW MODES // REALTIME SHADER
            </div>

            {/* 360° Perimeter Side Underglow Diffuser Light Strips */}
            <div
              className="absolute -top-1.5 left-10 right-10 h-1.5 rounded-full pointer-events-none"
              style={{
                background: chassisUnderglow.topGradient,
                opacity: chassisUnderglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />
            <div
              className="absolute -bottom-1.5 left-10 right-10 h-1.5 rounded-full pointer-events-none"
              style={{
                background: chassisUnderglow.bottomGradient,
                opacity: chassisUnderglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />
            <div
              className="absolute top-8 bottom-8 -left-1.5 w-1.5 rounded-full pointer-events-none"
              style={{
                background: chassisUnderglow.leftGradient,
                opacity: chassisUnderglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />
            <div
              className="absolute top-8 bottom-8 -right-1.5 w-1.5 rounded-full pointer-events-none"
              style={{
                background: chassisUnderglow.rightGradient,
                opacity: chassisUnderglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />

            {/* Embedded 240x135 TFT Screen Module at Top-Right of GMK87 Deck */}
            <div
              style={{
                left: `${16 + 15.8 * 54}px`,
                top: '12px',
                width: `${2.45 * 54}px`,
                height: '54px',
              }}
              className="absolute rounded-lg bg-[#050811] border border-[#06b6d4]/60 p-1 flex items-center justify-between gap-1.5 shadow-inner z-10"
            >
              <canvas
                ref={miniLcdCanvasRef}
                width={LCD_WIDTH}
                height={LCD_HEIGHT}
                className="h-full aspect-[16/9] rounded border border-[#1e293b] bg-black pixelated-canvas"
              />
              <div className="flex flex-col justify-between h-full py-0.5 pr-1 text-right font-mono">
                <span className="text-[8px] text-[#06b6d4] font-bold leading-none">TFT SYNC</span>
                <span className="text-[7px] text-slate-400 leading-tight truncate max-w-[44px]">
                  {activePreviewAnim}
                </span>
                <span className="text-[8px] text-[#10b981] leading-none">
                  BRI {configState.brightness}/4
                </span>
              </div>
            </div>

            {/* GMK87 Signature Hardware Logo LED Bar in Nav Cluster (cfg[28..32]) */}
            <div
              className="absolute flex items-center justify-center select-none pointer-events-none"
              style={{
                left: `${16 + 15.25 * 54}px`,
                top: `${16 + 3.45 * 54}px`,
                width: `${3 * 54 - 5}px`,
                height: '24px',
              }}
            >
              <div
                className="w-full h-3 rounded-full border border-white/40 transition-opacity duration-75"
                style={{
                  background: logoBarVisual.background,
                  boxShadow: logoBarVisual.boxShadow,
                  opacity: logoBarVisual.opacity,
                }}
                title={logoBarVisual.title}
              />
            </div>

            {/* 87 Physical Keys with Real-Time Per-Key RGB Shader (Knob rendered via dedicated CNC encoder) */}
            {GMK87_PHYSICAL_KEYS.map((k) => {
              if (k.isKnob) return null;
              const unitPx = 54;
              const gapPx = 5;
              const isPressed = pressedKeyIds.has(k.id);

              const shade = computePerKeyShader({
                keyX: k.x + k.w / 2,
                keyY: k.y + (k.h ?? 1) / 2,
                row: k.row,
                col: k.col,
                effect: configState.lightingEffect,
                brightness: configState.brightness,
                speed: configState.speed,
                direction: effectDirection,
                rainbow: rainbowMode,
                baseR: configState.rgbHueR,
                baseG: configState.rgbHueG,
                baseB: configState.rgbHueB,
                timeSec: animTimeSec,
                ripples,
              });

              const keyRgbCss = `rgb(${shade.r}, ${shade.g}, ${shade.b})`;
              const keyGlowCss = `rgba(${shade.r}, ${shade.g}, ${shade.b}, ${Math.min(
                0.9,
                shade.alpha * 0.75
              )})`;

              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => {
                    const now = performance.now();
                    setRipples((prev) => [
                      ...prev.filter((r) => now - r.timestamp < 1600),
                      {
                        x: k.x + k.w / 2,
                        y: k.y + (k.h ?? 1) / 2,
                        row: k.row,
                        col: k.col,
                        timestamp: now,
                      },
                    ]);
                  }}
                  style={{
                    left: `${16 + k.x * unitPx}px`,
                    top: `${16 + k.y * unitPx}px`,
                    width: `${k.w * unitPx - gapPx}px`,
                    height: `${(k.h ?? 1) * unitPx - gapPx}px`,
                    borderColor: isPressed ? '#10b981' : keyRgbCss,
                    boxShadow:
                      configState.lightingEffect === 0 || configState.brightness === 0
                        ? 'none'
                        : `0 2px 10px ${keyGlowCss}, inset 0 -3px 8px ${keyGlowCss}`,
                    background: isPressed
                      ? 'rgba(16, 185, 129, 0.35)'
                      : `linear-gradient(180deg, rgba(19, 27, 46, 0.92) 0%, rgba(${shade.r}, ${
                          shade.g
                        }, ${shade.b}, ${Math.min(0.42, shade.alpha * 0.38)}) 100%)`,
                  }}
                  className={`absolute rounded-[6px] p-1.5 flex flex-col justify-between text-left border border-b-2 transition-transform duration-75 cursor-pointer select-none ${
                    isPressed ? 'keycap-dish-pressed' : 'keycap-dish-3d'
                  }`}
                >
                  <div className="flex items-center justify-between w-full text-[8px] font-mono text-slate-400 leading-none">
                    <span className="truncate">{k.label}</span>
                    <span className="opacity-60">
                      {k.row},{k.col}
                    </span>
                  </div>
                  <div
                    className="text-[10px] font-mono font-bold truncate leading-tight"
                    style={{
                      color:
                        configState.lightingEffect === 0 || configState.brightness === 0
                          ? '#64748b'
                          : '#f8fafc',
                    }}
                  >
                    {k.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Status Bar inside Hero Stage */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-xs font-mono text-slate-400">
          <div className="flex flex-wrap items-center gap-4">
            <span>
              REGISTER <code className="text-[#06b6d4]">cfg[1]</code> ={' '}
              <strong className="text-white">
                {configState.lightingEffect} ({activeModeDef.hex})
              </strong>
            </span>
            <span>
              BRI <code className="text-[#06b6d4]">cfg[2]</code> ={' '}
              <strong className="text-white">{configState.brightness}/4</strong>
            </span>
            <span>
              SPD <code className="text-[#06b6d4]">cfg[3]</code> ={' '}
              <strong className="text-white">
                {configState.speed}/4 (raw 0x0{4 - Math.min(4, Math.max(0, configState.speed))})
              </strong>
            </span>
            <span>
              DIR <code className="text-[#06b6d4]">cfg[4]</code> ={' '}
              <strong className="text-white">
                {effectDirection ? '1 (Reverse ◄/▲)' : '0 (Forward ►/▼)'}
              </strong>
            </span>
            <span>
              RAINBOW <code className="text-[#06b6d4]">cfg[5]</code> ={' '}
              <strong className="text-white">
                {rainbowMode || activeModeDef.colorSupport === 'built-in-rainbow'
                  ? activeModeDef.colorSupport === 'built-in-rainbow'
                    ? 'Built-In Rainbow'
                    : '0xFF (Rainbow)'
                  : '0x00 (Single Hue)'}
              </strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full border border-white/40 inline-block"
              style={{ backgroundColor: rgbHexColor }}
            />
            <span className="text-white font-bold">{rgbHexColor}</span>
            <span>
              (R:{configState.rgbHueR} G:{configState.rgbHueG} B:{configState.rgbHueB})
            </span>
          </div>
        </div>
      </div>

      {/* =====================================================================
          2. PRECISION COLOUR STUDIO, REGISTER DECK (cfg[1..8]) & 19-MODE MATRIX
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 5 Cols: Hardware Registers cfg[1..8] + HSV Spectrum + RGB/HEX Sliders */}
        <div className="lg:col-span-5 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-[#06b6d4]" />
                Hardware Register Deck (`cfg[1..8]`)
              </h3>
              <p className="text-xs text-slate-400">
                Direct 24-bit RGB colour calibration, PWM brightness, speed, wave direction, and
                rainbow spectrum flags.
              </p>
            </div>
          </div>

          {/* 2D HSV Hue/Saturation Spectrum Canvas + Quick Swatches */}
          {(activeModeDef.colorSupport === 'built-in-rainbow' ||
            activeModeDef.colorSupport === 'palette' ||
            rainbowMode === 1) && (
            <div className="px-3 py-2 rounded-lg bg-[#0b0f19] border border-[#10b981]/40 text-[11px] font-mono text-emerald-300">
              {activeModeDef.colorSupport === 'built-in-rainbow'
                ? `Mode ${activeModeDef.hex} (${activeModeDef.name}) uses firmware built-in rainbow spectrum (single RGB hue in cfg[6..8] is ignored by hardware).`
                : activeModeDef.colorSupport === 'palette'
                  ? `Mode ${activeModeDef.hex} (${activeModeDef.name}) cycles a built-in 4-colour palette on hardware unless Rainbow is enabled.`
                  : 'Rainbow Override (cfg[5] = 0xFF) is active — single RGB colour is overridden by multi-colour spectrum. Picking a hue below switches back to Single Hue.'}
            </div>
          )}

          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">2D HSV SPECTRUM (`cfg[6..8]`)</span>
              <span className="text-cyan-300">
                H:{hueDeg}° S:{satPct}% V:{valPct}%
              </span>
            </div>
            <canvas
              ref={spectrumPickerCanvasRef}
              width={320}
              height={110}
              onClick={handleSpectrumCanvasPick}
              onMouseMove={(e) => {
                if (e.buttons === 1) handleSpectrumCanvasPick(e);
              }}
              className="w-full h-[110px] rounded-xl border border-[#1e293b] cursor-crosshair block"
            />

            {/* Quick Neon Swatches */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {[
                { label: 'Cyan', r: 6, g: 182, b: 212 },
                { label: 'Purple', r: 139, g: 92, b: 246 },
                { label: 'Laser Pink', r: 236, g: 72, b: 153 },
                { label: 'Matrix Green', r: 16, g: 185, b: 129 },
                { label: 'Amber Gold', r: 245, g: 158, b: 11 },
                { label: 'Redline', r: 239, g: 68, b: 68 },
                { label: 'Ice White', r: 226, g: 232, b: 240 },
                { label: 'Royal Blue', r: 59, g: 130, b: 246 },
              ].map((sw) => {
                const hex = `#${sw.r.toString(16).padStart(2, '0')}${sw.g
                  .toString(16)
                  .padStart(2, '0')}${sw.b.toString(16).padStart(2, '0')}`;
                return (
                  <button
                    key={sw.label}
                    type="button"
                    title={sw.label}
                    onClick={() => {
                      setReactiveMode('off');
                      onUpdateRgbConfig({
                        rgbHueR: sw.r,
                        rgbHueG: sw.g,
                        rgbHueB: sw.b,
                        rainbowMode: 0,
                      });
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#0b0f19] border border-[#1e293b] hover:border-white/60 text-[11px] font-mono text-slate-200 flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: hex }}
                    />
                    {sw.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* HEX Input + Native Picker + Individual R / G / B Sliders */}
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] space-y-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <input
                  type="color"
                  value={rgbHexColor}
                  onChange={(e) => {
                    const hex = e.target.value.replace('#', '');
                    const r = parseInt(hex.substring(0, 2), 16) || 0;
                    const g = parseInt(hex.substring(2, 4), 16) || 0;
                    const b = parseInt(hex.substring(4, 6), 16) || 0;
                    setReactiveMode('off');
                    onUpdateRgbConfig({ rgbHueR: r, rgbHueG: g, rgbHueB: b, rainbowMode: 0 });
                  }}
                  className="w-10 h-9 rounded bg-[#131b2e] border border-[#1e293b] cursor-pointer"
                />
                <div>
                  <div className="text-[11px] font-mono text-slate-400">HEX CODE</div>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const clean = hexInputText.trim().replace(/^#/, '');
                      if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
                        const r = parseInt(clean.slice(0, 2), 16);
                        const g = parseInt(clean.slice(2, 4), 16);
                        const b = parseInt(clean.slice(4, 6), 16);
                        setReactiveMode('off');
                        onUpdateRgbConfig({ rgbHueR: r, rgbHueG: g, rgbHueB: b, rainbowMode: 0 });
                      }
                    }}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="text"
                      value={hexInputText}
                      onChange={(e) => setHexInputText(e.target.value)}
                      className="w-24 bg-[#131b2e] border border-[#1e293b] rounded px-2 py-1 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
                    />
                    <button
                      type="submit"
                      className="px-2 py-1 text-[11px] font-mono rounded bg-[#131b2e] border border-[#1e293b] text-[#06b6d4] hover:border-[#06b6d4] cursor-pointer"
                    >
                      Set
                    </button>
                  </form>
                </div>
              </div>

              <div className="text-right font-mono text-xs">
                <div className="text-slate-400 text-[10px]">REGISTERS `cfg[6..8]`</div>
                <div className="text-white font-bold">
                  [{configState.rgbHueR}, {configState.rgbHueG}, {configState.rgbHueB}]
                </div>
              </div>
            </div>

            {/* R, G, B 0-255 Fine Sliders */}
            {[
              {
                label: 'RED (`cfg[6]`)',
                val: configState.rgbHueR,
                color: '#ef4444',
                onChange: (v: number) =>
                  onUpdateRgbConfig({ rgbHueR: v, rainbowMode: 0 }),
              },
              {
                label: 'GREEN (`cfg[7]`)',
                val: configState.rgbHueG,
                color: '#10b981',
                onChange: (v: number) =>
                  onUpdateRgbConfig({ rgbHueG: v, rainbowMode: 0 }),
              },
              {
                label: 'BLUE (`cfg[8]`)',
                val: configState.rgbHueB,
                color: '#06b6d4',
                onChange: (v: number) =>
                  onUpdateRgbConfig({ rgbHueB: v, rainbowMode: 0 }),
              },
            ].map((ch) => (
              <div key={ch.label}>
                <div className="flex justify-between text-[11px] font-mono mb-1">
                  <span className="text-slate-400">{ch.label}</span>
                  <span className="text-white font-bold">
                    {ch.val} (0x{ch.val.toString(16).toUpperCase().padStart(2, '0')})
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={255}
                  value={ch.val}
                  onChange={(e) => {
                    setReactiveMode('off');
                    ch.onChange(Number(e.target.value));
                  }}
                  style={{ accentColor: ch.color }}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Hardware Brightness (`cfg[2]`) & Effect Speed (`cfg[3]`) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-[#1e293b]">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400">BRIGHTNESS (`cfg[2]`)</span>
                <span className="text-[#06b6d4] font-bold">{configState.brightness} / 4</span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                value={Math.min(4, Math.max(0, configState.brightness))}
                onChange={(e) =>
                  onUpdateRgbConfig({ brightness: Number(e.target.value) })
                }
                className="w-full accent-[#06b6d4]"
              />
            </div>

            <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-[#1e293b]">
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-slate-400">SPEED (`cfg[3]`)</span>
                <span className="text-[#8b5cf6] font-bold">
                  {configState.speed} / 4 {configState.speed === 4 ? '(Fastest)' : configState.speed === 0 ? '(Slowest)' : ''}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={4}
                value={Math.min(4, Math.max(0, configState.speed))}
                onChange={(e) =>
                  onUpdateRgbConfig({ speed: Number(e.target.value) })
                }
                className="w-full accent-[#8b5cf6]"
              />
            </div>
          </div>

          {/* Low-Level Direction (`cfg[4]`) & Rainbow Spectrum (`cfg[5]`) Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                onUpdateRgbConfig({ effectDirection: effectDirection ? 0 : 1 })
              }
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                effectDirection
                  ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-white'
                  : 'bg-[#0b0f19] border-[#1e293b] text-slate-200 hover:border-[#8b5cf6]/60'
              }`}
            >
              <div>
                <div className="text-[10px] font-mono text-slate-400">DIRECTION (`cfg[4]`)</div>
                <div className="text-xs font-bold mt-0.5">
                  {effectDirection ? '◄ Reverse / Up (0x01)' : '► Forward / Down (0x00)'}
                </div>
              </div>
              <ArrowLeftRight className="w-4 h-4 text-[#8b5cf6] shrink-0" />
            </button>

            <button
              type="button"
              onClick={() =>
                onUpdateRgbConfig({ rainbowMode: rainbowMode ? 0 : 1 })
              }
              className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between ${
                rainbowMode
                  ? 'bg-[#10b981]/20 border-[#10b981] text-white'
                  : 'bg-[#0b0f19] border-[#1e293b] text-slate-200 hover:border-[#10b981]/60'
              }`}
            >
              <div>
                <div className="text-[10px] font-mono text-slate-400">SPECTRUM (`cfg[5]`)</div>
                <div className="text-xs font-bold mt-0.5">
                  {rainbowMode ? '🌈 Rainbow Override ON' : '🎨 Single Calibrated Hue'}
                </div>
              </div>
              <Palette className="w-4 h-4 text-[#10b981] shrink-0" />
            </button>
          </div>

          {/* Signature Logo / Accent Light Bar (`cfg[28..32]`) */}
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white">
                  Signature Logo Light Bar (`cfg[28..32]`)
                </div>
                <div className="text-[11px] text-slate-400">
                  Independent RGB accent strip above the arrow cluster
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUpdateRgbConfig({ logoRainbow: logoRainbow ? 0 : 1 })}
                className={`px-2.5 py-1 text-[11px] font-mono rounded-lg border cursor-pointer ${
                  logoRainbow
                    ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                    : 'bg-[#131b2e] border-[#1e293b] text-slate-300'
                }`}
              >
                {logoRainbow ? 'Logo Rainbow ON' : 'Logo Single Color'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] font-mono text-slate-400 mb-1">
                  LOGO MODE (`cfg[28]`)
                </div>
                <select
                  value={logoMode}
                  onChange={(e) => onUpdateRgbConfig({ logoMode: Number(e.target.value) })}
                  className="w-full bg-[#131b2e] border border-[#1e293b] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                >
                  {GMK87_LOGO_MODES.map((lm) => (
                    <option key={lm.id} value={lm.id}>
                      {lm.id}: {lm.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-mono text-slate-400 mb-1">
                  <span>LOGO BRI (`cfg[29]`)</span>
                  <span className="text-[#06b6d4] font-bold">{logoBrightness}/4</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={logoBrightness}
                  onChange={(e) =>
                    onUpdateRgbConfig({ logoBrightness: Number(e.target.value) })
                  }
                  className="w-full accent-[#06b6d4]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {GMK87_LOGO_COLORS.map((lc) => {
                const active = !logoRainbow && logoColor === lc.id;
                return (
                  <button
                    key={lc.id}
                    type="button"
                    onClick={() =>
                      onUpdateRgbConfig({
                        logoColor: lc.id,
                        logoRainbow: 0,
                      })
                    }
                    className={`px-2 py-1 text-[10px] font-mono rounded-md border flex items-center gap-1 cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#131b2e] border-[#06b6d4] text-white font-bold'
                        : 'bg-[#131b2e]/60 border-[#1e293b] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full border border-white/30 inline-block"
                      style={{ backgroundColor: lc.hex }}
                    />
                    {lc.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 7 Cols: All 19 Hardware Lighting Modes (0x00..0x12) with Category Filters */}
        <div className="lg:col-span-7 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white">
                All 19 GMK87 Firmware Lighting Modes (`cfg[1]: 0x00–0x12`)
              </h3>
              <p className="text-xs text-slate-400">
                Complete hardware effect table including ambient waves, reactive keystroke ripples,
                crosshairs, and particle shaders.
              </p>
            </div>
            <span className="text-xs font-mono text-[#06b6d4] shrink-0">
              Showing {filteredModes.length} of 19 modes
            </span>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                'All',
                'Ambient Waves',
                'Static & Breathing',
                'Reactive Keystroke',
                'Particle & Matrix',
                'Power Saver',
              ] as RgbEffectCategory[]
            ).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                      : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#06b6d4]/60'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {/* Grid of 19 Hardware Modes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[540px] overflow-y-auto pr-1">
            {filteredModes.map((mode) => {
              const active = configState.lightingEffect === mode.id;
              return (
                <div
                  key={mode.id}
                  onClick={() => onUpdateRgbConfig({ lightingEffect: mode.id })}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                    active
                      ? 'bg-[#06b6d4]/15 border-2 border-[#06b6d4] text-white'
                      : 'bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-white flex items-center gap-2">
                        {mode.name}
                      </span>
                      <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-[#131b2e] border border-[#1e293b] text-[#06b6d4]">
                        {mode.hex}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">{mode.desc}</p>
                  </div>

                  {/* Mini 8-LED Bar Preview + Capability Badges + LCD Sync */}
                  <div className="pt-2 border-t border-[#1e293b]/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {Array.from({ length: 8 }).map((_, idx) => {
                        const miniShade = computePerKeyShader({
                          keyX: idx * 2,
                          keyY: 2,
                          row: 2,
                          col: idx * 2,
                          effect: mode.id,
                          brightness: Math.max(5, configState.brightness),
                          speed: configState.speed,
                          direction: effectDirection,
                          rainbow: rainbowMode,
                          baseR: configState.rgbHueR,
                          baseG: configState.rgbHueG,
                          baseB: configState.rgbHueB,
                          timeSec: animTimeSec,
                          ripples,
                        });
                        return (
                          <span
                            key={idx}
                            className="w-2.5 h-2 rounded-xs inline-block"
                            style={{
                              backgroundColor: `rgb(${miniShade.r}, ${miniShade.g}, ${miniShade.b})`,
                            }}
                          />
                        );
                      })}
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] font-mono">
                      {mode.supportsDirection && (
                        <span className="px-1.5 py-0.5 rounded bg-[#131b2e] text-purple-300">
                          DIR
                        </span>
                      )}
                      {mode.supportsRainbowToggle && (
                        <span className="px-1.5 py-0.5 rounded bg-[#131b2e] text-emerald-300">
                          RNBW
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateRgbConfig({ lightingEffect: mode.id });
                          onSyncLcdTheme(mode.recommendedLcdAnim, rgbHexColor, false);
                        }}
                        className="px-2 py-0.5 rounded bg-[#131b2e] border border-[#1e293b] text-[#06b6d4] hover:border-[#06b6d4] cursor-pointer"
                      >
                        +LCD
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =====================================================================
          3. SMART REACTIVE & CROSS-DEVICE LIGHTING ENGINES
         ===================================================================== */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#10b981]" />
              Smart Reactive & Automated Lighting Engines (Audio Beat · CPU Thermal · WPM · Schedule)
            </h3>
            <p className="text-xs text-slate-400">
              Drive your GMK87 LEDs dynamically from real-time music beats, Windows CPU/GPU thermal
              load, typing velocity (WPM), or a timed day/night schedule.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStreamReactiveToHardware((v) => !v)}
            className={`px-3.5 py-2 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer shrink-0 ${
              streamReactiveToHardware
                ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#06b6d4]'
            }`}
          >
            Hardware Live USB Stream (EEPROM · 750ms Safe): {streamReactiveToHardware ? 'ENABLED' : 'PREVIEW'}
          </button>
        </div>

        {/* 6 Engine Selector Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {[
            {
              id: 'off' as ReactiveEngineMode,
              title: 'Hardware Autonomous',
              sub: 'Standard on-board GMK87 MCU lighting',
              icon: Keyboard,
              accent: '#64748b',
            },
            {
              id: 'audio' as ReactiveEngineMode,
              title: 'Audio Beat Pulse',
              sub: 'Pulses hue & brightness to mic or synth beat',
              icon: Music,
              accent: '#06b6d4',
            },
            {
              id: 'thermal' as ReactiveEngineMode,
              title: 'CPU Thermal Shift',
              sub: 'Cyan (Cool) → Emerald → Amber → Crimson',
              icon: Cpu,
              accent: '#f59e0b',
            },
            {
              id: 'wpm' as ReactiveEngineMode,
              title: 'WPM Overdrive',
              sub: `Shifts colour with typing speed (${liveWpm} WPM)`,
              icon: Gauge,
              accent: '#10b981',
            },
            {
              id: 'cycle' as ReactiveEngineMode,
              title: 'HSV Colour Cycler',
              sub: 'Smooth automated 360° spectrum rotation',
              icon: RefreshCw,
              accent: '#8b5cf6',
            },
            {
              id: 'schedule' as ReactiveEngineMode,
              title: 'Day / Night Schedule',
              sub: 'Auto-switches presets by system hour',
              icon: Clock,
              accent: '#ec4899',
            },
          ].map((eng) => {
            const Icon = eng.icon;
            const active = reactiveMode === eng.id;
            return (
              <button
                key={eng.id}
                type="button"
                onClick={() => {
                  setReactiveMode(eng.id);
                  onStatusLog(`Reactive RGB Engine switched to: ${eng.title}`);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? 'bg-[#0b0f19] border-2 border-[#06b6d4] text-white'
                    : 'bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className="w-4 h-4" style={{ color: eng.accent }} />
                  {active && (
                    <span className="text-[10px] font-mono text-[#10b981] font-bold">ACTIVE</span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-white">{eng.title}</div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{eng.sub}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Contextual Controls for Active Reactive Engine */}
        {reactiveMode === 'audio' && (
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-2 w-full md:w-auto">
              <div className="text-xs font-bold text-white flex items-center gap-2">
                🎵 Audio-Reactive RGB Beat Analyzer ({audioMicActive ? 'Live Microphone' : 'Synth Beat Demo'})
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleToggleAudioMic}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                    audioMicActive
                      ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                      : 'bg-[#131b2e] border-[#1e293b] text-slate-200 hover:border-[#06b6d4]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  {audioMicActive ? 'Stop Microphone (Use Synth Beat)' : 'Enable Live Microphone Input'}
                </button>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                  <span>Beat Gain ({audioSensitivity}%):</span>
                  <input
                    type="range"
                    min={30}
                    max={150}
                    value={audioSensitivity}
                    onChange={(e) => setAudioSensitivity(Number(e.target.value))}
                    className="w-28 accent-[#06b6d4]"
                  />
                </div>
              </div>
            </div>

            {/* 16-Band Live Audio Beat Meter */}
            <div className="flex items-end gap-1 h-12 px-3 py-1.5 rounded-lg bg-[#131b2e] border border-[#1e293b]">
              {audioBands.map((v, i) => (
                <div
                  key={i}
                  className="w-2 rounded-t transition-all duration-75"
                  style={{
                    height: `${Math.max(12, Math.round(v * 100))}%`,
                    backgroundColor: i < 4 ? '#06b6d4' : i < 10 ? '#8b5cf6' : '#10b981',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {reactiveMode === 'thermal' && (
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold text-white">
                🌡️ CPU Load & Thermal Colour Interpolator (Current:{' '}
                <span className="text-[#06b6d4] font-mono">
                  {simulatedCpuLoad !== null ? simulatedCpuLoad : telemetry.cpuPercent}%
                </span>
                )
              </div>
              <p className="text-xs text-slate-400">
                Automatically transitions keyboard LEDs from Cyan (&lt;35%) → Emerald (50%) → Amber
                (75%) → Crimson Overdrive (&gt;85%).
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-slate-400">Test Load Override:</span>
              <input
                type="range"
                min={10}
                max={100}
                value={simulatedCpuLoad !== null ? simulatedCpuLoad : telemetry.cpuPercent}
                onChange={(e) => setSimulatedCpuLoad(Number(e.target.value))}
                className="w-36 accent-[#f59e0b]"
              />
              {simulatedCpuLoad !== null && (
                <button
                  type="button"
                  onClick={() => setSimulatedCpuLoad(null)}
                  className="px-2.5 py-1 text-xs font-mono rounded bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] cursor-pointer"
                >
                  Use Live PC CPU
                </button>
              )}
            </div>
          </div>
        )}

        {reactiveMode === 'cycle' && (
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex flex-wrap items-center justify-between gap-4">
            <div className="text-xs text-slate-300">
              <strong className="text-white">Automated HSV Spectrum Rotator:</strong> Smoothly
              advances `cfg[6..8]` around the 360° colour wheel every{' '}
              <span className="text-[#06b6d4] font-mono font-bold">{cycleIntervalSec}s</span>.
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
              <span>Step Interval ({cycleIntervalSec}s):</span>
              <input
                type="range"
                min={1}
                max={15}
                value={cycleIntervalSec}
                onChange={(e) => setCycleIntervalSec(Number(e.target.value))}
                className="w-36 accent-[#8b5cf6]"
              />
            </div>
          </div>
        )}

        {reactiveMode === 'schedule' && (
          <div className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between gap-3 bg-[#131b2e] p-3 rounded-lg border border-[#1e293b]">
              <div>
                <div className="text-xs font-bold text-amber-300">☀️ Daytime Profile ({dayStartHour}:00)</div>
                <div className="text-[11px] text-slate-400">Active during daylight work hours</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={dayStartHour}
                  onChange={(e) => setDayStartHour(Number(e.target.value))}
                  className="w-14 bg-[#0b0f19] border border-[#1e293b] rounded px-2 py-1 text-xs font-mono text-white"
                />
                <select
                  value={dayPresetId}
                  onChange={(e) => setDayPresetId(e.target.value)}
                  className="bg-[#0b0f19] border border-[#1e293b] rounded px-2.5 py-1 text-xs font-mono text-white"
                >
                  {CURATED_RGB_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 bg-[#131b2e] p-3 rounded-lg border border-[#1e293b]">
              <div>
                <div className="text-xs font-bold text-cyan-300">🌙 Nighttime Profile ({nightStartHour}:00)</div>
                <div className="text-[11px] text-slate-400">Active during evening gaming sessions</div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={nightStartHour}
                  onChange={(e) => setNightStartHour(Number(e.target.value))}
                  className="w-14 bg-[#0b0f19] border border-[#1e293b] rounded px-2 py-1 text-xs font-mono text-white"
                />
                <select
                  value={nightPresetId}
                  onChange={(e) => setNightPresetId(e.target.value)}
                  className="bg-[#0b0f19] border border-[#1e293b] rounded px-2.5 py-1 text-xs font-mono text-white"
                >
                  {CURATED_RGB_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================================
          4. CURATED DESIGNER COLORWAY PRESETS & SAVED USER SCENES
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: 12 Curated Designer Presets */}
        <div className="lg:col-span-8 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#06b6d4]" />
                12 Curated Desk-Setup Colorways (RGB + 240×135 LCD Ambilight)
              </h3>
              <p className="text-xs text-slate-400">
                One-click themes tuned for GMK keycap sets and paired with matching 240×135 TFT
                animations.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoSyncLcdOnPreset((v) => !v)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border cursor-pointer transition-colors ${
                autoSyncLcdOnPreset
                  ? 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4] font-semibold'
                  : 'bg-[#0b0f19] border-[#1e293b] text-slate-400'
              }`}
            >
              Auto-Sync LCD Preview on Preset Click: {autoSyncLcdOnPreset ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {CURATED_RGB_PRESETS.map((preset) => {
              const primaryHex = `#${preset.r.toString(16).padStart(2, '0')}${preset.g
                .toString(16)
                .padStart(2, '0')}${preset.b.toString(16).padStart(2, '0')}`;
              return (
                <div
                  key={preset.id}
                  className="p-3.5 rounded-xl bg-[#0b0f19] border border-[#1e293b] hover:border-[#06b6d4]/70 transition-all flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${primaryHex}, ${preset.secondaryHex})`,
                          }}
                        />
                        <span className="text-xs font-bold text-white truncate">{preset.name}</span>
                      </div>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#131b2e] text-cyan-300">
                        {preset.tag}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">{preset.subtitle}</p>
                    <div className="text-[10px] font-mono text-slate-500 flex items-center justify-between pt-0.5">
                      <span>Mode 0x{preset.effect.toString(16).padStart(2, '0')}</span>
                      <span>LCD: {preset.linkedLcdAnim}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset, false)}
                      className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors cursor-pointer"
                    >
                      Apply RGB
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApplyPreset(preset, true)}
                      className="py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                      title="Apply RGB and Flash paired animation to GMK87 LCD"
                    >
                      +Flash LCD
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right 4 Cols: Saved User Custom Scenes */}
        <div className="lg:col-span-4 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 flex flex-col justify-between gap-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#8b5cf6]" />
                Saved Custom Scenes
              </h3>
              <p className="text-xs text-slate-400">
                Store your favourite RGB + LCD combinations to local studio memory.
              </p>
            </div>

            <form onSubmit={handleSaveCurrentScene} className="flex items-center gap-2">
              <input
                type="text"
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                placeholder="Name current setup (e.g. Late Night)..."
                className="flex-1 bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#8b5cf6]"
              />
              <button
                type="submit"
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#8b5cf6] text-white hover:bg-purple-500 transition-colors flex items-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Save
              </button>
            </form>

            <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
              {savedScenes.map((sc) => {
                const hex = `#${sc.r.toString(16).padStart(2, '0')}${sc.g
                  .toString(16)
                  .padStart(2, '0')}${sc.b.toString(16).padStart(2, '0')}`;
                return (
                  <div
                    key={sc.id}
                    className="p-3 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                        style={{ backgroundColor: hex }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{sc.name}</div>
                        <div className="text-[10px] font-mono text-slate-400">
                          Mode 0x{sc.effect.toString(16).padStart(2, '0')} · Bri {sc.brightness}/4 ·{' '}
                          {sc.linkedLcdAnim}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setReactiveMode('off');
                          onUpdateRgbConfig({
                            lightingEffect: sc.effect,
                            brightness: sc.brightness,
                            speed: sc.speed,
                            effectDirection: sc.effectDirection,
                            rainbowMode: sc.rainbowMode,
                            rgbHueR: sc.r,
                            rgbHueG: sc.g,
                            rgbHueB: sc.b,
                          });
                          onSyncLcdTheme(sc.linkedLcdAnim, hex, false);
                        }}
                        className="px-2.5 py-1 text-xs font-semibold rounded bg-[#131b2e] border border-[#1e293b] text-[#06b6d4] hover:border-[#06b6d4] cursor-pointer"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setSavedScenes((prev) => prev.filter((item) => item.id !== sc.id))
                        }
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Delete saved scene"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-3 border-t border-[#1e293b] text-[11px] font-mono text-slate-400 flex items-center justify-between">
            <span>{savedScenes.length} scene(s) stored</span>
            <button
              type="button"
              onClick={() => {
                setSavedScenes(DEFAULT_SAVED_SCENES);
                onStatusLog('Restored default RGB studio scenes.');
              }}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Reset Defaults
            </button>
          </div>
        </div>
      </div>

      {/* =====================================================================
          5. QUICK-ACCESS FN LIGHTING SHORTCUT CHEATSHEET & LIVE TESTER
             + RAW 48-BYTE / 64-BYTE EEPROM HEX INSPECTOR & DIFF VIEWER
         ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: Quick-Access Fn Lighting Shortcut Cheatsheet & Tester */}
        <div className="lg:col-span-6 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-[#06b6d4]" />
              Hardware `Fn` Lighting Shortcuts & One-Click Simulator
            </h3>
            <p className="text-xs text-slate-400">
              Reference for on-board GMK87 Layer 1 RGB keycodes (`0x5CC2`–`0x5CCC`), or click{' '}
              <strong className="text-white">Trigger</strong> to execute the exact register action
              now.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FN_LIGHTING_SHORTCUTS.map((sc) => (
              <div
                key={sc.id}
                className="p-3.5 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex flex-col justify-between gap-2.5"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <kbd className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-[#131b2e] border border-[#06b6d4]/50 text-[#06b6d4]">
                      {sc.combo}
                    </kbd>
                    <span className="text-[10px] font-mono text-slate-500">{sc.matrixPos}</span>
                  </div>
                  <div className="text-xs font-bold text-white pt-0.5">{sc.title}</div>
                  <p className="text-[11px] text-slate-400 leading-snug">{sc.desc}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]/80">
                  <span className="text-[10px] font-mono text-purple-300">{sc.registerNote}</span>
                  <button
                    type="button"
                    onClick={() => handleTriggerFnShortcut(sc)}
                    className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] hover:text-[#06b6d4] cursor-pointer transition-colors"
                  >
                    Trigger →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right 6 Cols: Raw 48-Byte / 64-Byte EEPROM RGB Config Hex Inspector & Diff Viewer */}
        <div className="lg:col-span-6 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Binary className="w-4 h-4 text-[#10b981]" />
                Raw {liveSerializedBytes.length}-Byte EEPROM Config Hex Inspector (`0x06`)
              </h3>
              <p className="text-xs text-slate-400">
                Live byte map of `cfg[0..{liveSerializedBytes.length - 1}]` highlighting RGB
                registers (`cfg[1..8]`), LCD mode (`cfg[33]`), and modified bytes (`DIFF`).
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  userSnapshottedBaselineRef.current = true;
                  setBaselineBytes(new Uint8Array(liveSerializedBytes));
                  onStatusLog('Snapshotted current EEPROM config buffer as diff baseline.');
                }}
                className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] cursor-pointer"
              >
                Snapshot Baseline ({modifiedByteIndices.size} diffs)
              </button>
              <button
                type="button"
                onClick={() => {
                  const hexDump = Array.from(liveSerializedBytes)
                    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
                    .join(' ');
                  navigator.clipboard?.writeText(hexDump);
                  setCopiedHex(true);
                  setTimeout(() => setCopiedHex(false), 1800);
                }}
                className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-[#06b6d4] hover:border-[#06b6d4] flex items-center gap-1 cursor-pointer"
              >
                {copiedHex ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedHex ? 'Copied' : 'Copy Hex'}
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono">
            <span className="px-2 py-0.5 rounded bg-[#06b6d4]/20 border border-[#06b6d4] text-[#06b6d4]">
              [01..08] RGB Registers
            </span>
            <span className="px-2 py-0.5 rounded bg-[#8b5cf6]/20 border border-[#8b5cf6] text-purple-300">
              [33..34, 43..46] LCD Screen
            </span>
            <span className="px-2 py-0.5 rounded bg-[#10b981]/20 border border-[#10b981] text-[#10b981]">
              [35..41] BCD RTC Clock
            </span>
            <span className="px-2 py-0.5 rounded bg-[#f59e0b]/25 border border-[#f59e0b] text-amber-300">
              Changed vs Baseline
            </span>
          </div>

          {/* 8-Column Byte Grid */}
          <div className="grid grid-cols-8 gap-1.5 p-3 rounded-xl bg-[#0b0f19] border border-[#1e293b] font-mono text-[11px]">
            {Array.from(liveSerializedBytes).map((byteVal, idx) => {
              const isRgbReg = idx >= 1 && idx <= 8;
              const isLogoReg = idx === 28 || idx === 29 || idx === 31 || idx === 32;
              const isLcdReg = idx === 33 || idx === 34 || idx === 43 || idx === 44 || idx === 46;
              const isClockReg = idx >= 35 && idx <= 41;
              const isDiff = modifiedByteIndices.has(idx) && !isClockReg;

              const regLabelMap: Record<number, string> = {
                0: 'HDR',
                1: 'MODE',
                2: 'BRI',
                3: 'SPD',
                4: 'DIR',
                5: 'RNBW',
                6: 'RED',
                7: 'GRN',
                8: 'BLU',
                28: 'LGO_M',
                29: 'LGO_B',
                31: 'LGO_R',
                32: 'LGO_C',
                33: 'SCR',
                34: 'S0_F',
                35: 'SEC',
                36: 'MIN',
                37: 'HOUR',
                38: 'DOW',
                39: 'DATE',
                40: 'MON',
                41: 'YEAR',
                43: 'DLY_L',
                44: 'DLY_H',
                46: 'S1_F',
                49: 'VIA_P',
              };

              let cellStyle = 'bg-[#131b2e]/70 border-[#1e293b] text-slate-400';
              if (isDiff) {
                cellStyle = 'bg-[#f59e0b]/25 border-[#f59e0b] text-amber-200 font-bold';
              } else if (isRgbReg || isLogoReg) {
                cellStyle = 'bg-[#06b6d4]/15 border-[#06b6d4]/60 text-cyan-200 font-bold';
              } else if (isLcdReg) {
                cellStyle = 'bg-[#8b5cf6]/15 border-[#8b5cf6]/60 text-purple-200';
              } else if (isClockReg) {
                cellStyle = 'bg-[#10b981]/15 border-[#10b981]/50 text-emerald-200';
              }

              return (
                <div
                  key={idx}
                  title={`cfg[${idx}] (0x${idx.toString(16).toUpperCase().padStart(2, '0')}): 0x${byteVal
                    .toString(16)
                    .toUpperCase()
                    .padStart(2, '0')} (${byteVal})${
                    regLabelMap[idx] ? ` — ${regLabelMap[idx]}` : ''
                  }`}
                  className={`p-1.5 rounded border text-center flex flex-col items-center justify-center ${cellStyle}`}
                >
                  <span className="text-[8px] opacity-70 leading-none">
                    {regLabelMap[idx] || `[${String(idx).padStart(2, '0')}]`}
                  </span>
                  <span className="text-xs leading-tight mt-0.5">
                    {byteVal.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
