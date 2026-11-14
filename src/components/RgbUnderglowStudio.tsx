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
  Sun,
  Flame,
  Search,
  RotateCcw,
  Upload,
  Download,
  Eye,
  SlidersHorizontal,
  ChevronRight,
  Layers,
} from 'lucide-react';
import {
  Gmk87ConfigState,
  LCD_WIDTH,
  LCD_HEIGHT,
  serializeConfigBuffer,
} from '../services/gmk87Hid';
import { GMK87_PHYSICAL_KEYS, KeyDefinition } from '../data/gmk87KeymapData';
import {
  GMK87_ALL_19_RGB_MODES,
  CURATED_RGB_PRESETS,
  FN_LIGHTING_SHORTCUTS,
  GMK87_LOGO_MODES,
  GMK87_LOGO_COLORS,
  RgbEffectCategory,
  RgbColorwayPreset,
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
  customBacklightMap?: Record<string, string>;
}

type StudioViewTab = 'effects' | 'backlight-editor' | 'reactive' | 'presets' | 'diagnostics';
type ReactiveEngineMode = 'off' | 'audio' | 'thermal' | 'wpm' | 'cycle' | 'schedule';
type BacklightPresetZone = 'all' | 'wasd' | 'arrows' | 'alphas' | 'modifiers' | 'f-row' | 'nav';

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
const STORAGE_KEY_BACKLIGHT = 'gmk87_custom_backlight_editor_v1';

const COLOR_PALETTE_SWATCHES = [
  { name: 'Cyan Neon', hex: '#06B6D4', r: 6, g: 182, b: 212 },
  { name: 'Violet', hex: '#8B5CF6', r: 139, g: 92, b: 246 },
  { name: 'Hot Pink', hex: '#EC4899', r: 236, g: 72, b: 153 },
  { name: 'Matrix Emerald', hex: '#10B981', r: 16, g: 185, b: 129 },
  { name: 'Amber Gold', hex: '#F59E0B', r: 245, g: 158, b: 11 },
  { name: 'Crimson', hex: '#EF4444', r: 239, g: 68, b: 68 },
  { name: 'Glacier Blue', hex: '#38BDF8', r: 56, g: 189, b: 248 },
  { name: 'Lime Electric', hex: '#84CC16', r: 132, g: 204, b: 22 },
  { name: 'Pure White', hex: '#F8FAFC', r: 248, g: 250, b: 252 },
  { name: 'Warm White', hex: '#FEF08A', r: 254, g: 240, b: 138 },
  { name: 'Deep Purple', hex: '#6366F1', r: 99, g: 102, b: 241 },
  { name: 'Black (Off)', hex: '#000000', r: 0, g: 0, b: 0 },
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
  // Navigation sub-tabs within RGB Lighting Suite
  const [activeStudioTab, setActiveStudioTab] = useState<StudioViewTab>('effects');

  // Animation ticker for 60 FPS deck shader
  const [animTimeSec, setAnimTimeSec] = useState<number>(0);
  const [ripples, setRipples] = useState<KeyRippleEvent[]>([]);
  const miniLcdCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumPickerCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Search and Category filtering for 19 hardware effects
  const [effectCategory, setEffectCategory] = useState<RgbEffectCategory>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Per-Key Backlight Custom Studio state
  const [activePaintColor, setActivePaintColor] = useState<string>('#06B6D4');
  const [paintModeEnabled, setPaintModeEnabled] = useState<boolean>(false);
  const [isMouseDownOnKeys, setIsMouseDownOnKeys] = useState<boolean>(false);
  const [customKeyColors, setCustomKeyColors] = useState<Record<string, string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_BACKLIGHT);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {};
  });

  // Reactive engine states
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

  // Audio refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const lastHardwarePushRef = useRef<number>(0);

  // Saved scenes
  const [savedScenes, setSavedScenes] = useState<SavedUserRgbScene[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SCENES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return [
      {
        id: 'user_night_city',
        name: 'Night City Cyberpunk',
        effect: 1,
        brightness: 4,
        speed: 3,
        effectDirection: 0,
        rainbowMode: 0,
        r: 6,
        g: 182,
        b: 212,
        linkedLcdAnim: 'sandevistan-cyber',
        createdAt: 'Default',
      },
      {
        id: 'user_laser_glow',
        name: 'Retro Laser Wave',
        effect: 13,
        brightness: 4,
        speed: 2,
        effectDirection: 0,
        rainbowMode: 0,
        r: 236,
        g: 72,
        b: 153,
        linkedLcdAnim: 'synthwave-grid',
        createdAt: 'Default',
      },
    ];
  });
  const [newSceneName, setNewSceneName] = useState<string>('');

  // Raw EEPROM hex inspector baseline
  const [baselineBytes, setBaselineBytes] = useState<Uint8Array>(() => new Uint8Array(rawHardwareConfig));
  const userSnapshottedBaselineRef = useRef<boolean>(false);
  const [copiedHex, setCopiedHex] = useState<boolean>(false);
  const [hexInputText, setHexInputText] = useState<string>('');

  // Persist custom backlight colors
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_BACKLIGHT, JSON.stringify(customKeyColors));
    } catch {
      // ignore
    }
  }, [customKeyColors]);

  // Persist scenes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SCENES, JSON.stringify(savedScenes));
    } catch {
      // ignore
    }
  }, [savedScenes]);

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

  // Filter 19 hardware effects with category and search
  const filteredModes = useMemo(() => {
    return GMK87_ALL_19_RGB_MODES.filter((m) => {
      const matchCat = effectCategory === 'All' || m.category === effectCategory;
      const matchQuery =
        !searchQuery.trim() ||
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.desc.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.hex.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [effectCategory, searchQuery]);

  // Physical key ripple listener
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

  // 25 FPS Animation loop
  useEffect(() => {
    const start = performance.now();
    let frameCount = 0;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const now = performance.now();
      setAnimTimeSec((now - start) / 1000);
      frameCount++;

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

  // 2D HSV Spectrum Canvas
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

  // Push reactive updates to hardware safely
  const pushReactiveRgbUpdate = useCallback(
    (partial: Partial<Gmk87ConfigState>) => {
      if (!streamReactiveToHardware) {
        onUpdateRgbConfig(partial, true);
        return;
      }
      const now = Date.now();
      if (now - lastHardwarePushRef.current >= 750) {
        lastHardwarePushRef.current = now;
        onUpdateRgbConfig(partial, false);
      } else {
        onUpdateRgbConfig(partial, true);
      }
    },
    [onUpdateRgbConfig, streamReactiveToHardware]
  );

  // Audio mic toggle
  const handleToggleAudioMic = async () => {
    if (audioMicActive) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
      audioCtxRef.current?.close().catch(() => {});
      audioCtxRef.current = null;
      analyserRef.current = null;
      setAudioMicActive(false);
      onStatusLog('Audio-Reactive RGB reverted to Synth Beat Generator.');
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
      onStatusLog(`Microphone access unavailable (${err?.message || 'permission denied'}). Using Synth Beat.`);
    }
  };

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Reactive engine loop
  useEffect(() => {
    if (reactiveMode === 'off') return;

    const intervalMs = reactiveMode === 'audio' ? 180 : reactiveMode === 'cycle' ? Math.max(500, cycleIntervalSec * 250) : 450;
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
          const t = performance.now() / 1000;
          const kick = Math.pow(0.5 + 0.5 * Math.sin(t * 6.5), 4);
          for (let i = 0; i < 16; i++) {
            const wave = 0.2 + 0.5 * Math.abs(Math.sin(t * 4.2 + i * 0.45)) + (i < 4 ? kick * 0.45 : 0);
            bands.push(Math.min(1, wave * (audioSensitivity / 75)));
          }
        }
        setAudioBands(bands);

        const bassAvg = (bands[0] + bands[1] + bands[2] + bands[3]) / 4;
        const targetBri = Math.max(2, Math.min(4, Math.round(bassAvg * 4)));
        const beatHue = (Math.round(bassAvg * 260 + stepCounter * 14)) % 360;
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
        const clamped = Math.max(10, Math.min(100, load));
        const hue = Math.max(0, Math.round(195 - ((clamped - 10) / 90) * 195));
        const [r, g, b] = hslToRgb(hue, 96, 52);
        const speed = clamped >= 80 ? 4 : clamped >= 55 ? 3 : clamped >= 35 ? 2 : 1;
        pushReactiveRgbUpdate({ rgbHueR: r, rgbHueG: g, rgbHueB: b, speed, rainbowMode: 0 });
      } else if (reactiveMode === 'wpm') {
        const clampedWpm = Math.max(0, Math.min(130, liveWpm));
        const hue = (230 - Math.round((clampedWpm / 130) * 215) + 360) % 360;
        const [r, g, b] = hslToRgb(hue, 95, 55);
        const speed = clampedWpm >= 90 ? 4 : clampedWpm >= 60 ? 3 : clampedWpm >= 30 ? 2 : 1;
        const bri = clampedWpm > 5 ? 4 : 2;
        pushReactiveRgbUpdate({ rgbHueR: r, rgbHueG: g, rgbHueB: b, speed, brightness: bri, rainbowMode: 0 });
      } else if (reactiveMode === 'cycle') {
        const nextHue = (hueDeg + 18) % 360;
        const [r, g, b] = hsvToRgb(nextHue, Math.max(80, satPct), Math.max(85, valPct));
        pushReactiveRgbUpdate({ rgbHueR: r, rgbHueG: g, rgbHueB: b, rainbowMode: 0 });
      } else if (reactiveMode === 'schedule') {
        const currentHour = new Date().getHours();
        const isDaytime = dayStartHour < nightStartHour
          ? currentHour >= dayStartHour && currentHour < nightStartHour
          : currentHour >= dayStartHour || currentHour < nightStartHour;
        const targetId = isDaytime ? dayPresetId : nightPresetId;
        const preset = CURATED_RGB_PRESETS.find((p) => p.id === targetId) || CURATED_RGB_PRESETS[0];
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

  // Backlight Zone selection helper
  const handleApplyZoneColor = (zone: BacklightPresetZone, hex: string) => {
    setCustomKeyColors((prev) => {
      const next = { ...prev };
      GMK87_PHYSICAL_KEYS.forEach((k) => {
        if (k.isKnob) return;
        let match = false;
        if (zone === 'all') match = true;
        else if (zone === 'wasd') match = ['W', 'A', 'S', 'D'].includes(k.label.toUpperCase());
        else if (zone === 'arrows') match = ['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(k.label.toUpperCase());
        else if (zone === 'f-row') match = k.row === 0 && k.col >= 1 && k.col <= 12;
        else if (zone === 'nav') match = ['INS', 'DEL', 'PGUP', 'PGDN', 'HOME', 'END', 'PRTSC'].includes(k.label.toUpperCase());
        else if (zone === 'alphas') {
          match = /^[A-Z0-9]$/i.test(k.label) || ['~ `', '- _', '= +', '[ {', '] }', '\\ |', '; :', '\' "', ', <', '. >', '/ ?'].includes(k.label);
        } else if (zone === 'modifiers') {
          match = ['CTRL', 'ALT', 'SHIFT', 'WIN', 'FN', 'SPACE', 'ENTER', 'BKSP', 'TAB', 'CAPS'].some((m) => k.label.toUpperCase().includes(m));
        }
        if (match) {
          next[k.id] = hex;
        }
      });
      return next;
    });
    onStatusLog(`Backlight Editor: Applied ${hex} to zone "${zone.toUpperCase()}"`);
  };

  const handlePaintKey = (keyId: string) => {
    setCustomKeyColors((prev) => ({
      ...prev,
      [keyId]: activePaintColor,
    }));
  };

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
    const hex = `#${preset.r.toString(16).padStart(2, '0')}${preset.g.toString(16).padStart(2, '0')}${preset.b.toString(16).padStart(2, '0')}`;
    onSyncLcdTheme(preset.linkedLcdAnim, hex, flashLcd);
  };

  const handleSaveCurrentScene = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newSceneName.trim() || `Custom Setup #${savedScenes.length + 1}`;
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
      customBacklightMap: Object.keys(customKeyColors).length > 0 ? customKeyColors : undefined,
    };
    setSavedScenes((prev) => [newScene, ...prev]);
    setNewSceneName('');
    onStatusLog(`Saved custom RGB scene "${title}".`);
  };

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

  const liveSerializedBytes = useMemo(
    () => serializeConfigBuffer(configState, rawHardwareConfig),
    [configState, rawHardwareConfig]
  );

  const modifiedByteIndices = useMemo(() => {
    const diffs = new Set<number>();
    const len = Math.min(liveSerializedBytes.length, baselineBytes.length);
    for (let i = 0; i < len; i++) {
      if (i >= 35 && i <= 41) continue;
      if (liveSerializedBytes[i] !== baselineBytes[i]) {
        diffs.add(i);
      }
    }
    return diffs;
  }, [liveSerializedBytes, baselineBytes]);

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HERO KEYBOARD STAGE (Uncluttered, High-Resolution Visualizer)
         ===================================================================== */}
      <div className="bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4 shadow-xl">
        {/* Stage Header & Sub-Nav */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#06b6d4]" />
                GMK87 Keyboard Lights Studio
              </h2>
              <span className="text-xs font-mono text-[#06b6d4] bg-[#06b6d4]/10 border border-[#06b6d4]/30 px-2 py-0.5 rounded">
                MODE {activeModeDef.hex}: {activeModeDef.name.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Real-time south-facing RGB LED matrix, 360° halo diffuser strips, and rotary knob OSD.
            </p>
          </div>

          {/* Quick Tab Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-[#070a12] border border-[#1b263b] rounded-lg">
            {[
              { id: 'effects' as StudioViewTab, label: 'Lighting Effects', icon: Sparkles },
              { id: 'backlight-editor' as StudioViewTab, label: 'Backlight Editor', icon: Palette },
              { id: 'presets' as StudioViewTab, label: 'Colorways & Presets', icon: Layers },
              { id: 'reactive' as StudioViewTab, label: 'Reactive Engines', icon: Zap },
              { id: 'diagnostics' as StudioViewTab, label: 'Registers & Hex', icon: Binary },
            ].map((tab) => {
              const active = activeStudioTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveStudioTab(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#06b6d4] text-slate-950 font-bold shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-[#121a2c]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* The 87-Key Visualizer Stage */}
        <div
          className="w-full overflow-x-auto py-8 px-6 flex justify-center bg-[#070a12] rounded-xl border border-[#162032]"
          onMouseDown={() => setIsMouseDownOnKeys(true)}
          onMouseUp={() => setIsMouseDownOnKeys(false)}
        >
          <div
            className="relative shrink-0 rounded-2xl p-4 bg-gradient-to-b from-[#0a0e18] via-[#070910] to-[#04060b] border-2 transition-[border-color] duration-150 select-none"
            style={{
              width: '1040px',
              height: '386px',
              borderColor: chassisUnderglow.borderColor,
              boxShadow: chassisUnderglow.boxShadow,
            }}
          >
            {/* Hex Bolt Screws */}
            <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono">⬡</div>
            <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono">⬡</div>
            <div className="absolute bottom-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono">⬡</div>
            <div className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono">⬡</div>

            {/* 360° Underglow strips */}
            <div className="absolute -top-1.5 left-10 right-10 h-1.5 rounded-full pointer-events-none" style={{ background: chassisUnderglow.topGradient, opacity: chassisUnderglow.stripOpacity, filter: 'blur(2px)' }} />
            <div className="absolute -bottom-1.5 left-10 right-10 h-1.5 rounded-full pointer-events-none" style={{ background: chassisUnderglow.bottomGradient, opacity: chassisUnderglow.stripOpacity, filter: 'blur(2px)' }} />
            <div className="absolute top-8 bottom-8 -left-1.5 w-1.5 rounded-full pointer-events-none" style={{ background: chassisUnderglow.leftGradient, opacity: chassisUnderglow.stripOpacity, filter: 'blur(2px)' }} />
            <div className="absolute top-8 bottom-8 -right-1.5 w-1.5 rounded-full pointer-events-none" style={{ background: chassisUnderglow.rightGradient, opacity: chassisUnderglow.stripOpacity, filter: 'blur(2px)' }} />

            {/* Embedded Mini TFT Screen */}
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

            {/* Logo LED Bar */}
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

            {/* 87 Physical Keycaps with Per-Key Shader or Custom Backlight Paint */}
            {GMK87_PHYSICAL_KEYS.map((k) => {
              if (k.isKnob) return null;
              const unitPx = 54;
              const gapPx = 5;
              const isPressed = pressedKeyIds.has(k.id);

              const customOverrideHex = customKeyColors[k.id];

              let keyRgbCss = '';
              let keyGlowCss = '';
              let shadeAlpha = 0.8;
              let isUnlit = configState.lightingEffect === 0 || configState.brightness === 0;

              if (activeStudioTab === 'backlight-editor' && customOverrideHex) {
                keyRgbCss = customOverrideHex;
                keyGlowCss = `${customOverrideHex}99`;
                shadeAlpha = 0.9;
                isUnlit = false;
              } else {
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
                keyRgbCss = `rgb(${shade.r}, ${shade.g}, ${shade.b})`;
                keyGlowCss = `rgba(${shade.r}, ${shade.g}, ${shade.b}, ${Math.min(0.9, shade.alpha * 0.75)})`;
                shadeAlpha = shade.alpha;
              }

              return (
                <button
                  key={k.id}
                  type="button"
                  onMouseEnter={() => {
                    if (activeStudioTab === 'backlight-editor' && isMouseDownOnKeys) {
                      handlePaintKey(k.id);
                    }
                  }}
                  onClick={() => {
                    if (activeStudioTab === 'backlight-editor') {
                      handlePaintKey(k.id);
                    } else {
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
                    }
                  }}
                  style={{
                    left: `${16 + k.x * unitPx}px`,
                    top: `${16 + k.y * unitPx}px`,
                    width: `${k.w * unitPx - gapPx}px`,
                    height: `${(k.h ?? 1) * unitPx - gapPx}px`,
                    borderColor: isPressed ? '#10b981' : keyRgbCss,
                    boxShadow: isUnlit ? 'none' : `0 2px 10px ${keyGlowCss}, inset 0 -3px 8px ${keyGlowCss}`,
                    background: isPressed
                      ? 'rgba(16, 185, 129, 0.35)'
                      : `linear-gradient(180deg, rgba(19, 27, 46, 0.92) 0%, ${keyGlowCss} 100%)`,
                  }}
                  className={`absolute rounded-[6px] p-1.5 flex flex-col justify-between text-left border border-b-2 transition-transform duration-75 select-none ${
                    isPressed ? 'keycap-dish-pressed' : 'keycap-dish-3d'
                  } ${activeStudioTab === 'backlight-editor' ? 'cursor-cell hover:ring-2 hover:ring-white/40' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center justify-between w-full text-[8px] font-mono text-slate-400 leading-none">
                    <span className="truncate">{k.label}</span>
                    <span className="opacity-60">{k.row},{k.col}</span>
                  </div>
                  <div
                    className="text-[10px] font-mono font-bold truncate leading-tight"
                    style={{ color: isUnlit ? '#64748b' : '#f8fafc' }}
                  >
                    {k.label}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Global Controls Toolbar (Brightness, Speed, Direction, Color, Power) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
          {/* Brightness */}
          <div className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-[#06b6d4]" /> Brightness
              </span>
              <span className="text-white font-bold">{configState.brightness} / 4</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              value={configState.brightness}
              onChange={(e) => onUpdateRgbConfig({ brightness: Number(e.target.value) })}
              className="w-full accent-[#06b6d4] h-1.5"
            />
          </div>

          {/* Speed */}
          <div className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-[#8b5cf6]" /> Speed
              </span>
              <span className="text-white font-bold">{configState.speed} / 4</span>
            </div>
            <input
              type="range"
              min={0}
              max={4}
              value={configState.speed}
              onChange={(e) => onUpdateRgbConfig({ speed: Number(e.target.value) })}
              className="w-full accent-[#8b5cf6] h-1.5"
            />
          </div>

          {/* Direction */}
          <button
            type="button"
            onClick={() => onUpdateRgbConfig({ effectDirection: effectDirection ? 0 : 1 })}
            className="p-3 bg-[#070a12] border border-[#1b263b] hover:border-[#8b5cf6] rounded-lg text-left flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-[10px] font-mono text-slate-400">Direction</div>
              <div className="text-xs font-bold text-white mt-0.5">
                {effectDirection ? 'Reverse ◄/▲' : 'Forward ►/▼'}
              </div>
            </div>
            <ArrowLeftRight className="w-4 h-4 text-[#8b5cf6]" />
          </button>

          {/* Rainbow vs Solid */}
          <button
            type="button"
            onClick={() => onUpdateRgbConfig({ rainbowMode: rainbowMode ? 0 : 1 })}
            className="p-3 bg-[#070a12] border border-[#1b263b] hover:border-[#10b981] rounded-lg text-left flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-[10px] font-mono text-slate-400">Spectrum Mode</div>
              <div className="text-xs font-bold text-white mt-0.5">
                {rainbowMode ? '🌈 Rainbow Wave' : '🎨 Calibrated Hue'}
              </div>
            </div>
            <Palette className="w-4 h-4 text-[#10b981]" />
          </button>

          {/* Quick LCD Ambilight Sync */}
          <button
            type="button"
            onClick={() => onSyncLcdTheme(activeModeDef.recommendedLcdAnim, rgbHexColor, false)}
            className="p-3 bg-[#070a12] border border-[#06b6d4]/50 hover:bg-[#06b6d4]/10 rounded-lg text-left flex items-center justify-between cursor-pointer transition-colors"
          >
            <div>
              <div className="text-[10px] font-mono text-[#06b6d4]">LCD Ambilight Sync</div>
              <div className="text-xs font-bold text-white mt-0.5 truncate max-w-[120px]">
                {activeModeDef.recommendedLcdAnim}
              </div>
            </div>
            <Tv className="w-4 h-4 text-[#06b6d4]" />
          </button>
        </div>
      </div>

      {/* =====================================================================
          2. TAB CONTENT VIEWPORT: CHOOSE BETWEEN CLEAN WORKSPACES
         ===================================================================== */}

      {/* SUB-TAB 1: 19 HARDWARE LIGHTING EFFECTS & COLOR TUNER */}
      {activeStudioTab === 'effects' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 4 Cols: Precision HSV Wheel & Register Calibration */}
          <div className="lg:col-span-4 bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#06b6d4]" />
                Color Calibration
              </h3>
              <p className="text-xs text-slate-400">
                Calibrate 24-bit RGB values directly written to hardware registers cfg[6..8].
              </p>
            </div>

            {/* 2D Canvas */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-mono text-slate-400">
                <span>HSV Spectrum</span>
                <span className="text-[#06b6d4]">{hueDeg}° · {satPct}%</span>
              </div>
              <canvas
                ref={spectrumPickerCanvasRef}
                width={320}
                height={100}
                onClick={handleSpectrumCanvasPick}
                onMouseMove={(e) => {
                  if (e.buttons === 1) handleSpectrumCanvasPick(e);
                }}
                className="w-full h-[100px] rounded-lg border border-[#1b263b] cursor-crosshair block"
              />
            </div>

            {/* Quick Swatches */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-mono text-slate-400">Curated Neon Swatches</span>
              <div className="grid grid-cols-4 gap-2">
                {COLOR_PALETTE_SWATCHES.slice(0, 8).map((sw) => (
                  <button
                    key={sw.name}
                    type="button"
                    onClick={() => {
                      setReactiveMode('off');
                      onUpdateRgbConfig({
                        rgbHueR: sw.r,
                        rgbHueG: sw.g,
                        rgbHueB: sw.b,
                        rainbowMode: 0,
                      });
                    }}
                    className="flex items-center gap-1.5 p-1.5 rounded bg-[#070a12] border border-[#1b263b] hover:border-slate-400 text-[10px] font-mono text-slate-300 cursor-pointer"
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: sw.hex }} />
                    <span className="truncate">{sw.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Hex & R/G/B Channels */}
            <div className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">HEX Code</span>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const clean = hexInputText.trim().replace(/^#/, '');
                    if (/^[0-9A-Fa-f]{6}$/.test(clean)) {
                      const r = parseInt(clean.slice(0, 2), 16);
                      const g = parseInt(clean.slice(2, 4), 16);
                      const b = parseInt(clean.slice(4, 6), 16);
                      onUpdateRgbConfig({ rgbHueR: r, rgbHueG: g, rgbHueB: b, rainbowMode: 0 });
                    }
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    type="text"
                    value={hexInputText}
                    onChange={(e) => setHexInputText(e.target.value)}
                    className="w-24 bg-[#0e1422] border border-[#1b263b] rounded px-2 py-1 text-xs font-mono text-white text-right focus:border-[#06b6d4] focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="px-2 py-1 text-xs font-mono bg-[#1b263b] hover:bg-[#06b6d4] hover:text-slate-950 text-slate-200 rounded cursor-pointer"
                  >
                    Set
                  </button>
                </form>
              </div>

              {/* R, G, B slider channels */}
              {[
                { label: 'R', val: configState.rgbHueR, color: '#ef4444', ch: 'rgbHueR' },
                { label: 'G', val: configState.rgbHueG, color: '#10b981', ch: 'rgbHueG' },
                { label: 'B', val: configState.rgbHueB, color: '#06b6d4', ch: 'rgbHueB' },
              ].map((c) => (
                <div key={c.label} className="flex items-center gap-2 text-xs font-mono">
                  <span className="w-4 text-slate-400 font-bold" style={{ color: c.color }}>{c.label}</span>
                  <input
                    type="range"
                    min={0}
                    max={255}
                    value={c.val}
                    onChange={(e) => onUpdateRgbConfig({ [c.ch]: Number(e.target.value), rainbowMode: 0 })}
                    className="flex-1 h-1.5"
                    style={{ accentColor: c.color }}
                  />
                  <span className="w-8 text-right text-slate-300">{c.val}</span>
                </div>
              ))}
            </div>

            {/* Logo Bar Controls */}
            <div className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-300 font-bold">Logo Light Strip (cfg[28..32])</span>
                <span className="text-slate-500">{logoRainbow ? 'Rainbow' : 'Solid'}</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={logoMode}
                  onChange={(e) => onUpdateRgbConfig({ logoMode: Number(e.target.value) })}
                  className="flex-1 bg-[#0e1422] border border-[#1b263b] text-xs font-mono rounded px-2 py-1 text-slate-200 focus:outline-none"
                >
                  {GMK87_LOGO_MODES.map((lm) => (
                    <option key={lm.id} value={lm.id}>{lm.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onUpdateRgbConfig({ logoRainbow: logoRainbow ? 0 : 1 })}
                  className={`px-2 py-1 text-xs font-mono rounded border cursor-pointer ${
                    logoRainbow ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]' : 'bg-[#0e1422] border-[#1b263b] text-slate-400'
                  }`}
                >
                  Rainbow
                </button>
              </div>
            </div>
          </div>

          {/* Right 8 Cols: All 19 Hardware Modes with Filter Bar */}
          <div className="lg:col-span-8 bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  19 Hardware Lighting Modes (Firmware cfg[1])
                </h3>
                <p className="text-xs text-slate-400">
                  Select an effect to flash directly to your GMK87 microcontroller.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder="Search 19 modes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-[#070a12] border border-[#1b263b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4] w-48"
                />
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', 'Ambient Waves', 'Static & Breathing', 'Reactive Keystroke', 'Particle & Matrix', 'Power Saver'] as RgbEffectCategory[]).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setEffectCategory(cat)}
                  className={`px-3 py-1 text-xs rounded-lg transition-colors cursor-pointer ${
                    effectCategory === cat
                      ? 'bg-[#06b6d4] text-slate-950 font-bold'
                      : 'bg-[#070a12] border border-[#1b263b] text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* 19 Modes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[520px] overflow-y-auto pr-1">
              {filteredModes.map((m) => {
                const isActive = configState.lightingEffect === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onUpdateRgbConfig({ lightingEffect: m.id })}
                    className={`p-3 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isActive
                        ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-white shadow-[0_0_12px_rgba(6,182,212,0.2)]'
                        : 'bg-[#070a12] border-[#1b263b] text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-white">{m.name}</span>
                        <span className="font-mono text-[10px] text-[#06b6d4]">{m.hex}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {m.desc}
                      </p>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 pt-1 border-t border-[#1b263b]">
                      <span>{m.category}</span>
                      {m.supportsDirection && <span className="text-purple-300">DIR</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: KEYBOARD BACKLIGHT EDITOR (Interactive Per-Key & Zone Painter) */}
      {activeStudioTab === 'backlight-editor' && (
        <div className="bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-[#1b263b]">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#06b6d4]" />
                Interactive Keyboard Backlight Editor
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Click or drag across keys on the keyboard stage above to paint individual key colors, or apply colors by zone below.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCustomKeyColors({});
                  onStatusLog('Cleared all custom backlight colors.');
                }}
                className="px-3 py-1.5 text-xs font-mono rounded bg-[#070a12] border border-[#1b263b] text-slate-400 hover:text-white cursor-pointer"
              >
                Clear Backlight
              </button>
              <button
                type="button"
                onClick={() => {
                  // Apply Solid mode (0x06) to hardware
                  const cleanHex = activePaintColor.replace('#', '');
                  const r = parseInt(cleanHex.substring(0, 2), 16) || 0;
                  const g = parseInt(cleanHex.substring(2, 4), 16) || 0;
                  const b = parseInt(cleanHex.substring(4, 6), 16) || 0;
                  onUpdateRgbConfig({
                    lightingEffect: 6, // Solid Light
                    rgbHueR: r,
                    rgbHueG: g,
                    rgbHueB: b,
                    rainbowMode: 0,
                  });
                  onStatusLog(`Flashed Solid Backlight (${activePaintColor}) to GMK87 EEPROM.`);
                }}
                className="px-3.5 py-1.5 text-xs font-bold rounded bg-[#06b6d4] text-slate-950 hover:bg-cyan-300 cursor-pointer shadow-sm"
              >
                Flash Solid Color
              </button>
            </div>
          </div>

          {/* Color Palette Selector */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-slate-400">1. Select Paint Color:</span>
            <div className="flex flex-wrap items-center gap-2">
              {COLOR_PALETTE_SWATCHES.map((sw) => {
                const isSelected = activePaintColor.toUpperCase() === sw.hex.toUpperCase();
                return (
                  <button
                    key={sw.name}
                    type="button"
                    onClick={() => setActivePaintColor(sw.hex)}
                    className={`px-2.5 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-mono cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#1b263b] border-white text-white font-bold shadow-[0_0_8px_rgba(255,255,255,0.2)]'
                        : 'bg-[#070a12] border-[#1b263b] text-slate-400 hover:text-white'
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: sw.hex }} />
                    <span>{sw.name}</span>
                  </button>
                );
              })}

              {/* Custom Hex input */}
              <div className="flex items-center gap-1.5 bg-[#070a12] border border-[#1b263b] rounded-lg px-2 py-1">
                <input
                  type="color"
                  value={activePaintColor}
                  onChange={(e) => setActivePaintColor(e.target.value)}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0"
                />
                <span className="text-xs font-mono text-slate-200 uppercase">{activePaintColor}</span>
              </div>
            </div>
          </div>

          {/* Quick Zone Presets */}
          <div className="space-y-2 pt-2 border-t border-[#1b263b]">
            <span className="text-xs font-mono text-slate-400">2. Quick Apply by Keyboard Zone:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {[
                { id: 'wasd' as BacklightPresetZone, label: 'WASD Gamer' },
                { id: 'arrows' as BacklightPresetZone, label: 'Arrow Keys' },
                { id: 'alphas' as BacklightPresetZone, label: 'All Alphas' },
                { id: 'modifiers' as BacklightPresetZone, label: 'Modifiers' },
                { id: 'f-row' as BacklightPresetZone, label: 'Function F1-F12' },
                { id: 'nav' as BacklightPresetZone, label: 'Navigation Cluster' },
                { id: 'all' as BacklightPresetZone, label: 'Fill Entire Board' },
              ].map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => handleApplyZoneColor(zone.id, activePaintColor)}
                  className="p-2.5 rounded-lg bg-[#070a12] border border-[#1b263b] hover:border-[#06b6d4] text-xs font-mono text-slate-200 hover:text-white cursor-pointer transition-colors text-center"
                >
                  {zone.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg text-xs font-mono text-slate-400 flex items-center justify-between">
            <span>
              Keys Painted: <strong className="text-[#06b6d4]">{Object.keys(customKeyColors).length}</strong> of 87 keys
            </span>
            <span>
              Tip: Click any key on the visualizer above to apply <strong className="text-white">{activePaintColor}</strong>
            </span>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CURATED COLORWAYS & USER SCENES */}
      {activeStudioTab === 'presets' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 8 Cols: Curated Designer Presets */}
          <div className="lg:col-span-8 bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#06b6d4]" />
                12 Curated Desk-Setup Colorways
              </h3>
              <p className="text-xs text-slate-400">
                Crafted colorways tuned for GMK keycap sets and automatically paired with matching 240×135 TFT animations.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {CURATED_RGB_PRESETS.map((p) => {
                const hex = `#${p.r.toString(16).padStart(2, '0')}${p.g.toString(16).padStart(2, '0')}${p.b.toString(16).padStart(2, '0')}`;
                return (
                  <div
                    key={p.id}
                    className="p-3.5 bg-[#070a12] border border-[#1b263b] hover:border-[#06b6d4]/60 rounded-xl flex flex-col justify-between gap-3 transition-colors"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0"
                            style={{ background: `linear-gradient(135deg, ${hex}, ${p.secondaryHex})` }}
                          />
                          <span className="text-xs font-bold text-white truncate">{p.name}</span>
                        </div>
                        <span className="text-[10px] font-mono text-cyan-300 bg-[#0e1422] px-1.5 py-0.5 rounded">
                          {p.tag}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {p.subtitle}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#1b263b]">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(p, false)}
                        className="flex-1 py-1 px-2 text-xs font-semibold rounded bg-[#1b263b] hover:bg-[#06b6d4] hover:text-slate-950 text-slate-200 transition-colors cursor-pointer"
                      >
                        Apply RGB
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset(p, true)}
                        className="py-1 px-2.5 text-xs font-semibold rounded bg-[#06b6d4] text-slate-950 hover:bg-cyan-300 transition-colors cursor-pointer"
                        title="Flash paired 240x135 animation to LCD"
                      >
                        +LCD
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 4 Cols: Saved User Scenes */}
          <div className="lg:col-span-4 bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#8b5cf6]" />
                Saved Custom Scenes
              </h3>
              <p className="text-xs text-slate-400">
                Save your active lighting, brightness, and LCD pairing to browser memory.
              </p>
            </div>

            <form onSubmit={handleSaveCurrentScene} className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Name current setup..."
                value={newSceneName}
                onChange={(e) => setNewSceneName(e.target.value)}
                className="flex-1 bg-[#070a12] border border-[#1b263b] rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#8b5cf6]"
              />
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-[#8b5cf6] text-white hover:bg-purple-500 cursor-pointer"
              >
                Save
              </button>
            </form>

            <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
              {savedScenes.map((sc) => {
                const hex = `#${sc.r.toString(16).padStart(2, '0')}${sc.g.toString(16).padStart(2, '0')}${sc.b.toString(16).padStart(2, '0')}`;
                return (
                  <div
                    key={sc.id}
                    className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-white truncate">{sc.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          Mode 0x{sc.effect.toString(16).padStart(2, '0')} · {sc.createdAt}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
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
                          if (sc.customBacklightMap) {
                            setCustomKeyColors(sc.customBacklightMap);
                          }
                          onSyncLcdTheme(sc.linkedLcdAnim, hex, false);
                        }}
                        className="px-2.5 py-1 text-xs font-mono rounded bg-[#1b263b] hover:bg-[#06b6d4] hover:text-slate-950 text-slate-200 cursor-pointer"
                      >
                        Load
                      </button>
                      <button
                        type="button"
                        onClick={() => setSavedScenes((prev) => prev.filter((item) => item.id !== sc.id))}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: SMART REACTIVE ENGINES (Audio, CPU Thermal, WPM, Schedule) */}
      {activeStudioTab === 'reactive' && (
        <div className="bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#1b263b]">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#10b981]" />
                Smart Reactive & Automated Lighting Engines
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Automatically pulse or modulate keyboard lighting from live audio beats, PC thermal metrics, or typing velocity.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setStreamReactiveToHardware((v) => !v)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer ${
                streamReactiveToHardware
                  ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                  : 'bg-[#070a12] border-[#1b263b] text-slate-400 hover:text-white'
              }`}
            >
              Hardware USB Stream: {streamReactiveToHardware ? 'ENABLED (750ms)' : 'PREVIEW ONLY'}
            </button>
          </div>

          {/* Engine Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {[
              { id: 'off' as ReactiveEngineMode, title: 'Autonomous', sub: 'Standard MCU effects', icon: Keyboard, color: '#64748b' },
              { id: 'audio' as ReactiveEngineMode, title: 'Audio Beat', sub: 'Microphone & Synth beat', icon: Music, color: '#06b6d4' },
              { id: 'thermal' as ReactiveEngineMode, title: 'CPU Thermal', sub: 'Cyan → Amber → Crimson', icon: Cpu, color: '#f59e0b' },
              { id: 'wpm' as ReactiveEngineMode, title: 'WPM Overdrive', sub: `${liveWpm} WPM velocity`, icon: Gauge, color: '#10b981' },
              { id: 'cycle' as ReactiveEngineMode, title: 'Color Cycler', sub: 'Rotates 360° spectrum', icon: RefreshCw, color: '#8b5cf6' },
              { id: 'schedule' as ReactiveEngineMode, title: 'Day / Night', sub: 'Timed lighting schedule', icon: Clock, color: '#ec4899' },
            ].map((eng) => {
              const Icon = eng.icon;
              const active = reactiveMode === eng.id;
              return (
                <button
                  key={eng.id}
                  type="button"
                  onClick={() => setReactiveMode(eng.id)}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                    active
                      ? 'bg-[#06b6d4]/10 border-[#06b6d4] text-white shadow-sm'
                      : 'bg-[#070a12] border-[#1b263b] text-slate-400 hover:text-white hover:border-slate-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="w-4 h-4" style={{ color: eng.color }} />
                    {active && <span className="text-[10px] font-mono text-[#10b981] font-bold">ACTIVE</span>}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{eng.title}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{eng.sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Contextual Settings for Selected Engine */}
          {reactiveMode === 'audio' && (
            <div className="p-4 bg-[#070a12] border border-[#1b263b] rounded-lg flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <Music className="w-4 h-4 text-[#06b6d4]" /> Audio Beat Pulse ({audioMicActive ? 'Microphone' : 'Synth Demo'})
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleToggleAudioMic}
                    className={`px-3 py-1.5 text-xs font-mono rounded border cursor-pointer ${
                      audioMicActive ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]' : 'bg-[#1b263b] text-slate-200'
                    }`}
                  >
                    <Mic className="w-3.5 h-3.5 inline mr-1" />
                    {audioMicActive ? 'Stop Mic' : 'Enable Microphone'}
                  </button>
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                    <span>Gain:</span>
                    <input
                      type="range"
                      min={30}
                      max={150}
                      value={audioSensitivity}
                      onChange={(e) => setAudioSensitivity(Number(e.target.value))}
                      className="w-24 accent-[#06b6d4]"
                    />
                  </div>
                </div>
              </div>

              {/* Band Meter */}
              <div className="flex items-end gap-1 h-10 px-3 py-1 bg-[#0e1422] border border-[#1b263b] rounded">
                {audioBands.map((v, i) => (
                  <div
                    key={i}
                    className="w-2 rounded-t transition-all duration-75"
                    style={{
                      height: `${Math.max(15, Math.round(v * 100))}%`,
                      backgroundColor: i < 4 ? '#06b6d4' : i < 10 ? '#8b5cf6' : '#10b981',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {reactiveMode === 'thermal' && (
            <div className="p-4 bg-[#070a12] border border-[#1b263b] rounded-lg flex items-center justify-between gap-4 text-xs font-mono">
              <div className="text-slate-300">
                Current CPU Load:{' '}
                <strong className="text-[#f59e0b]">
                  {simulatedCpuLoad !== null ? simulatedCpuLoad : telemetry.cpuPercent}%
                </strong>
              </div>
              <div className="flex items-center gap-2">
                <span>Test Override:</span>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={simulatedCpuLoad !== null ? simulatedCpuLoad : telemetry.cpuPercent}
                  onChange={(e) => setSimulatedCpuLoad(Number(e.target.value))}
                  className="w-32 accent-[#f59e0b]"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 5: EEPROM REGISTERS & HARDWARE SHORTCUTS */}
      {activeStudioTab === 'diagnostics' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 6 Cols: Hardware Shortcuts */}
          <div className="lg:col-span-6 bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                <Keyboard className="w-4 h-4 text-[#06b6d4]" />
                Hardware Fn Lighting Shortcuts
              </h3>
              <p className="text-xs text-slate-400">
                Trigger onboard GMK87 Layer 1 firmware lighting shortcuts directly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FN_LIGHTING_SHORTCUTS.map((sc) => (
                <div
                  key={sc.id}
                  className="p-3 bg-[#070a12] border border-[#1b263b] rounded-lg flex flex-col justify-between gap-2"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <kbd className="px-1.5 py-0.5 text-xs font-mono font-bold bg-[#1b263b] text-[#06b6d4] rounded">
                        {sc.combo}
                      </kbd>
                      <span className="text-[10px] font-mono text-purple-300">{sc.registerNote}</span>
                    </div>
                    <div className="text-xs font-bold text-white mt-1">{sc.title}</div>
                    <p className="text-[11px] text-slate-400 leading-snug">{sc.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      switch (sc.actionType) {
                        case 'next-effect':
                          onUpdateRgbConfig({ lightingEffect: (configState.lightingEffect % 18) + 1 });
                          break;
                        case 'next-hue':
                          onUpdateRgbConfig({ rainbowMode: rainbowMode ? 0 : 1 });
                          break;
                        case 'toggle-led':
                          onUpdateRgbConfig({ lightingEffect: configState.lightingEffect === 0 ? 1 : 0 });
                          break;
                        case 'bri-up':
                          onUpdateRgbConfig({ brightness: Math.min(4, configState.brightness + 1) });
                          break;
                        case 'bri-down':
                          onUpdateRgbConfig({ brightness: Math.max(0, configState.brightness - 1) });
                          break;
                        case 'spd-up':
                          onUpdateRgbConfig({ speed: Math.min(4, configState.speed + 1) });
                          break;
                        case 'spd-down':
                          onUpdateRgbConfig({ speed: Math.max(0, configState.speed - 1) });
                          break;
                        case 'toggle-dir':
                          onUpdateRgbConfig({ effectDirection: effectDirection ? 0 : 1 });
                          break;
                      }
                    }}
                    className="w-full py-1 text-xs font-mono rounded bg-[#1b263b] hover:bg-[#06b6d4] hover:text-slate-950 text-slate-200 cursor-pointer"
                  >
                    Simulate Action →
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right 6 Cols: Hex Inspector */}
          <div className="lg:col-span-6 bg-[#0e1422] border border-[#1b263b] rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide flex items-center gap-2">
                  <Binary className="w-4 h-4 text-[#10b981]" />
                  Raw EEPROM Register Map (cfg[0..47])
                </h3>
                <p className="text-xs text-slate-400">
                  Exact 48-byte hardware state written via HID command 0x06.
                </p>
              </div>

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
                className="px-2.5 py-1 text-xs font-mono rounded bg-[#070a12] border border-[#1b263b] text-[#06b6d4] cursor-pointer"
              >
                {copiedHex ? 'Copied' : 'Copy Hex'}
              </button>
            </div>

            {/* 8-col byte grid */}
            <div className="grid grid-cols-8 gap-1.5 p-3 bg-[#070a12] border border-[#1b263b] rounded-lg font-mono text-[11px]">
              {Array.from(liveSerializedBytes).slice(0, 48).map((byteVal, idx) => {
                const isRgb = idx >= 1 && idx <= 8;
                const isLogo = idx >= 28 && idx <= 32;
                return (
                  <div
                    key={idx}
                    className={`p-1.5 rounded border text-center ${
                      isRgb
                        ? 'bg-[#06b6d4]/15 border-[#06b6d4]/60 text-cyan-200 font-bold'
                        : isLogo
                        ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/60 text-purple-200'
                        : 'bg-[#0e1422] border-[#1b263b] text-slate-400'
                    }`}
                  >
                    <div className="text-[8px] opacity-60">[{idx}]</div>
                    <div className="text-xs">{byteVal.toString(16).toUpperCase().padStart(2, '0')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
