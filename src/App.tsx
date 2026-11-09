import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Keyboard,
  Cpu,
  Clock,
  Sparkles,
  Upload,
  Sliders,
  Disc,
  BookOpen,
  Film,
  Usb,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  RefreshCw,
  Search,
  Volume2,
  Music,
  FastForward,
  ZoomIn,
  Eye,
  Zap,
  Mic,
  MicOff,
  Layers,
  FlaskConical,
  Timer,
  Gauge,
} from 'lucide-react';
import {
  Gmk87HidEngine,
  Gmk87ConfigState,
  UploadProgressInfo,
  LCD_WIDTH,
  LCD_HEIGHT,
  toRGB565,
  toBcd,
} from './services/gmk87Hid';
import {
  GMK87_PHYSICAL_KEYS,
  KEYCODE_CATALOG,
  KeycodeItem,
  getKeycodeLabel,
  createDefaultKeymap,
  GMK87_SHORTCUTS,
  CURATED_POKEMON_SPRITES,
  getPokemonSpriteUrl,
} from './data/gmk87KeymapData';
import {
  ProceduralAnimId,
  GifCategory,
  CURATED_GIF_LIBRARY,
  LcdCustomizationOptions,
  DEFAULT_LCD_CUSTOMIZATION,
  TelemetryHudMetrics,
  drawProceduralAnimationFrame,
  generateProceduralFrames,
  quantizeImageDataToRGB565Preview,
  renderSmartKnobOsdFrame,
  renderPokemonLcdFrame,
  applyLcdCustomOverlays,
} from './utils/lcdGenerators';
import {
  KEYBOARD_APPS_COMPARISON,
  GMK87_FIXES_AND_INNOVATIONS,
} from './data/ecosystemResearch';

type TabId =
  | 'keymap'
  | 'gifs'
  | 'shortcuts'
  | 'clock'
  | 'telemetry'
  | 'uploader'
  | 'rgb'
  | 'knob'
  | 'ecosystem';

/**
 * Live 240x135 animated thumbnail canvas for each card in the GIF Library
 */
function MiniLcdCardCanvas({
  animId,
  custom,
}: {
  animId: ProceduralAnimId;
  custom: LcdCustomizationOptions;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      drawProceduralAnimationFrame(ctx, animId, frame, undefined, undefined, custom);
      frame++;
    };
    draw();
    const id = setInterval(draw, 140);
    return () => clearInterval(id);
  }, [animId, custom]);

  return (
    <canvas
      ref={canvasRef}
      width={LCD_WIDTH}
      height={LCD_HEIGHT}
      className="w-full aspect-[16/9] rounded-lg border border-[#1e293b] bg-black pixelated-canvas block"
    />
  );
}

const RGB_EFFECTS = [
  { id: 1, name: 'Wave', desc: 'Continuous horizontal rainbow wave across 87 keys' },
  { id: 2, name: 'Colour Cloud', desc: 'Soft drifting pastel & neon nebula clouds' },
  { id: 3, name: 'Vortex', desc: 'Spiral radial colour vortex centered on G/H keys' },
  { id: 4, name: 'Mix Colour', desc: 'Multi-zone shifting cyber palette' },
  { id: 5, name: 'Breathe', desc: 'Smooth sinusoidal fade in/out in selected hue' },
  { id: 6, name: 'Solid', desc: 'Static calibrated per-key RGB colour' },
  { id: 7, name: 'Starry Night', desc: 'Random twinkling keys over deep dark backdrop' },
  { id: 8, name: 'Meteor', desc: 'High-speed shooting light trails across rows' },
  { id: 9, name: 'Matrix Rain', desc: 'Vertical cascading droplets down key columns' },
  { id: 0, name: 'Off', desc: 'Disable all per-key & underglow LEDs (battery saver)' },
];

const SMART_KNOB_MODES = [
  {
    id: 'volume',
    title: '🔊 System Volume',
    subtitle: 'Standard master audio control',
    ccwCode: 0x00aa, // VOL-
    cwCode: 0x00a9, // VOL+
    clickCode: 0x00a8, // MUTE
    ccwLabel: 'VOL -',
    clickLabel: 'MUTE',
    cwLabel: 'VOL +',
    accent: '#06b6d4',
  },
  {
    id: 'media',
    title: '🎵 Media Player',
    subtitle: 'Playlist transport & track skip',
    ccwCode: 0x00ac, // PREV
    cwCode: 0x00ab, // NEXT
    clickCode: 0x00ae, // PLAY/PAUSE
    ccwLabel: 'PREV',
    clickLabel: 'PLAY',
    cwLabel: 'NEXT',
    accent: '#10b981',
  },
  {
    id: 'scrubber',
    title: '⏩ Timeline Scrubber',
    subtitle: 'Frame/timeline jog for video & code',
    ccwCode: 0x0050, // LEFT
    cwCode: 0x004f, // RIGHT
    clickCode: 0x002c, // SPACE
    ccwLabel: 'STEP ◄',
    clickLabel: 'SPACE',
    cwLabel: 'STEP ►',
    accent: '#8b5cf6',
  },
  {
    id: 'zoom',
    title: '🔍 Zoom & Navigation',
    subtitle: 'Canvas & browser zoom control',
    ccwCode: 0x012d, // Ctrl -
    cwCode: 0x012e, // Ctrl +
    clickCode: 0x0127, // Ctrl 0
    ccwLabel: 'ZOOM -',
    clickLabel: '100%',
    cwLabel: 'ZOOM +',
    accent: '#f59e0b',
  },
];

export default function App() {
  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabId>('keymap');

  // Hardware Config State (48-byte buffer fields)
  const [configState, setConfigState] = useState<Gmk87ConfigState>(() => ({
    lightingEffect: 1, // Wave
    brightness: 4, // 0-5 UI slider
    speed: 3, // 1-5 UI slider
    rgbHueR: 6,
    rgbHueG: 182,
    rgbHueB: 212,
    activeScreenMode: 1, // Slot 0
    slot0FrameCount: 12,
    slot1FrameCount: 16,
    clockDate: new Date(Date.now() - 142000), // Slightly drifted by ~2m22s initially to show sync utility
  }));

  // WebHID Engine instance
  const hidEngineRef = useRef<Gmk87HidEngine | null>(null);
  if (!hidEngineRef.current) {
    hidEngineRef.current = new Gmk87HidEngine(configState);
  }

  const [isConnected, setIsConnected] = useState(false);
  const [statusLog, setStatusLog] = useState<string>(
    'Simulation Mode Active — Ready for WebHID (0x320F:0x5055) or offline studio testing.'
  );
  const [lastViaPacketHex, setLastViaPacketHex] = useState<string>('05 00 07 00 00 AA 00 00');

  // Live 240x135 Hardware LCD Mini-Monitor state + Embedded In-Chassis TFT Canvas
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inChassisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [monitorExpanded, setMonitorExpanded] = useState(true);
  const [activePreviewAnim, setActivePreviewAnim] = useState<ProceduralAnimId>('bongo-cat');
  const [customPreviewImageData, setCustomPreviewImageData] = useState<ImageData | null>(null);
  const [useFloydSteinbergDither, setUseFloydSteinbergDither] = useState(true);
  const [targetSlot, setTargetSlot] = useState<0 | 1>(0);
  const [uploadProgress, setUploadProgress] = useState<UploadProgressInfo>({
    phase: 'idle',
    bytesSent: 0,
    totalBytes: 65536,
    currentFrame: 0,
    totalFrames: 1,
    lastPacketHex: '04 28 00 01 00 00 00 00',
    message: 'Idle — 240×135 RGB565 (65,536B padded frame buffer)',
  });

  // Tab 1: Key Remapper Studio State + Live NKRO Physical Key Press Tester + CNC Knob Dial
  const [keymap, setKeymap] = useState<number[][][]>(() => createDefaultKeymap());
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('r7c0'); // Default highlight CCW Knob
  const [activeKeyCategory, setActiveKeyCategory] =
    useState<KeycodeItem['category']>('Media & Knob');
  const [pressedKeyIds, setPressedKeyIds] = useState<Set<string>>(() => new Set());
  const [actuationCount, setActuationCount] = useState<number>(0);
  const [knobAngleDeg, setKnobAngleDeg] = useState<number>(0);
  const [rgbPreviewEnabled, setRgbPreviewEnabled] = useState<boolean>(true);

  // Tab 2: GIF Library, 240x135 Screen Customizer & Pokémon State
  const [gifCategoryFilter, setGifCategoryFilter] = useState<GifCategory>('All');
  const [gifSearchQuery, setGifSearchQuery] = useState<string>('');
  const [pokemonSearchQuery, setPokemonSearchQuery] = useState<string>('');
  const [lcdCustom, setLcdCustom] = useState<LcdCustomizationOptions>(DEFAULT_LCD_CUSTOMIZATION);
  const [shinyPokemon, setShinyPokemon] = useState(false);
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [customGifUrl, setCustomGifUrl] = useState<string>('');
  const pokemonImagesCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Tab 3: Keyboard Shortcuts Search & Filter
  const [shortcutQuery, setShortcutQuery] = useState('');
  const [shortcutCat, setShortcutCat] = useState<'All' | 'Screen' | 'Wireless' | 'Lighting' | 'System'>('All');

  // Tab 4: Clock & Profiles
  const [pcNow, setPcNow] = useState<Date>(() => new Date());
  const [hwClockOffsetMs, setHwClockOffsetMs] = useState<number>(-142000); // -2m 22s initial drift
  const [autoSync15Min, setAutoSync15Min] = useState<boolean>(false);

  // Tab 5: Media & Telemetry HUD + 24-Band Audio Spectrum
  const [telemetry, setTelemetry] = useState<TelemetryHudMetrics>({
    cpuPercent: 38,
    ramPercent: 64,
    ramUsedGb: 20.5,
    ramTotalGb: 32,
    gpuTempC: 59,
    uptimeStr: '05:18:42',
    trackTitle: 'Resonance (Synthwave Mix)',
    trackArtist: 'HOME // Zuoya GMK87 DSP',
    wpm: 96,
  });
  const [autoStreamHud5s, setAutoStreamHud5s] = useState(false);
  const [spectrumDemoRunning, setSpectrumDemoRunning] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const liveSpectrumValuesRef = useRef<number[]>(new Array(24).fill(0.25));

  // Tab 6: Custom GIF Uploader
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedRawImage, setUploadedRawImage] = useState<HTMLImageElement | null>(null);
  const uploaderPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // Tab 8: Smart Knob Multi-Engine
  const [activeKnobModeId, setActiveKnobModeId] = useState<string>('volume');

  // Tab 9: Beyond-Zuoya Interactive Lab (Live WPM Tachometer & Hardware Pomodoro Timer)
  const [typingTestText, setTypingTestText] = useState('');
  const [liveWpm, setLiveWpm] = useState(88);
  const keystrokeTimestampsRef = useRef<number[]>([]);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);

  // 1-second Clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setPcNow(new Date());
      if (pomodoroRunning) {
        setPomodoroSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [pomodoroRunning]);

  // 15-Minute Auto-Sync Daemon
  const handleSyncClockNow = useCallback(async () => {
    const now = new Date();
    setHwClockOffsetMs(0);
    const updated: Gmk87ConfigState = {
      ...configState,
      clockDate: now,
    };
    setConfigState(updated);
    if (hidEngineRef.current) {
      const pktHex = await hidEngineRef.current.writeConfig(updated);
      setUploadProgress((prev) => ({
        ...prev,
        lastPacketHex: pktHex,
        message: `Synced BCD Clock cfg[35..41] to ${now.toLocaleTimeString()}`,
      }));
    }
    setStatusLog(`BCD Hardware Clock (cfg[35..41]) synchronized to ${now.toLocaleTimeString()}`);
  }, [configState]);

  useEffect(() => {
    if (!autoSync15Min) return;
    const interval = setInterval(() => {
      handleSyncClockNow();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [autoSync15Min, handleSyncClockNow]);

  // Live Physical Keyboard Matrix Tester (NKRO Keydown/Keyup Listener)
  useEffect(() => {
    const codeMap: Record<string, string> = {
      Escape: 'r0c0',
      F1: 'r0c1',
      F2: 'r0c2',
      F3: 'r0c3',
      F4: 'r0c4',
      F5: 'r0c5',
      F6: 'r0c6',
      F7: 'r0c7',
      F8: 'r0c8',
      F9: 'r0c9',
      F10: 'r0c10',
      F11: 'r0c11',
      F12: 'r0c12',
      Backquote: 'r1c0',
      Digit1: 'r1c1',
      Digit2: 'r1c2',
      Digit3: 'r1c3',
      Digit4: 'r1c4',
      Digit5: 'r1c5',
      Digit6: 'r1c6',
      Digit7: 'r1c7',
      Digit8: 'r1c8',
      Digit9: 'r1c9',
      Digit0: 'r1c10',
      Minus: 'r1c11',
      Equal: 'r1c12',
      Backspace: 'r1c13',
      Insert: 'r1c14',
      Delete: 'r2c14',
      Tab: 'r2c0',
      KeyQ: 'r2c1',
      KeyW: 'r2c2',
      KeyE: 'r2c3',
      KeyR: 'r2c4',
      KeyT: 'r2c5',
      KeyY: 'r2c6',
      KeyU: 'r2c7',
      KeyI: 'r2c8',
      KeyO: 'r2c9',
      KeyP: 'r2c10',
      BracketLeft: 'r2c11',
      BracketRight: 'r2c12',
      Backslash: 'r2c13',
      Home: 'r3c14',
      End: 'r4c14',
      PageUp: 'r5c14',
      PageDown: 'r6c14',
      CapsLock: 'r3c0',
      KeyA: 'r3c1',
      KeyS: 'r3c2',
      KeyD: 'r3c3',
      KeyF: 'r3c4',
      KeyG: 'r3c5',
      KeyH: 'r3c6',
      KeyJ: 'r3c7',
      KeyK: 'r3c8',
      KeyL: 'r3c9',
      Semicolon: 'r3c10',
      Quote: 'r3c11',
      Enter: 'r3c13',
      ShiftLeft: 'r4c0',
      KeyZ: 'r4c2',
      KeyX: 'r4c3',
      KeyC: 'r4c4',
      KeyV: 'r4c5',
      KeyB: 'r4c6',
      KeyN: 'r4c7',
      KeyM: 'r4c8',
      Comma: 'r4c9',
      Period: 'r4c10',
      Slash: 'r4c11',
      ShiftRight: 'r4c12',
      ArrowUp: 'r4c13',
      ControlLeft: 'r5c0',
      MetaLeft: 'r5c1',
      AltLeft: 'r5c2',
      Space: 'r5c6',
      AltRight: 'r5c9',
      ContextMenu: 'r5c11',
      ControlRight: 'r5c12',
      ArrowLeft: 'r5c13',
      ArrowDown: 'r6c12',
      ArrowRight: 'r6c13',
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;
      const mapped = codeMap[e.code];
      if (mapped) {
        setPressedKeyIds((prev) => {
          const next = new Set(prev);
          next.add(mapped);
          return next;
        });
        setActuationCount((c) => c + 1);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const mapped = codeMap[e.code];
      if (mapped) {
        setPressedKeyIds((prev) => {
          const next = new Set(prev);
          next.delete(mapped);
          return next;
        });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Live 240x135 Hardware Monitor + Embedded In-Chassis Screen Animation Loop
  useEffect(() => {
    let frameCount = 0;
    const interval = setInterval(() => {
      frameCount++;

      let quantized: ImageData;
      if (customPreviewImageData) {
        quantized = quantizeImageDataToRGB565Preview(
          customPreviewImageData,
          useFloydSteinbergDither
        );
      } else {
        const offscreen = document.createElement('canvas');
        offscreen.width = LCD_WIDTH;
        offscreen.height = LCD_HEIGHT;
        const offCtx = offscreen.getContext('2d')!;
        drawProceduralAnimationFrame(
          offCtx,
          activePreviewAnim,
          frameCount,
          telemetry,
          liveSpectrumValuesRef.current,
          lcdCustom
        );
        const rawImg = offCtx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
        quantized = quantizeImageDataToRGB565Preview(rawImg, useFloydSteinbergDither);
      }

      monitorCanvasRef.current?.getContext('2d')?.putImageData(quantized, 0, 0);
      inChassisCanvasRef.current?.getContext('2d')?.putImageData(quantized, 0, 0);
    }, 90);

    return () => clearInterval(interval);
  }, [activePreviewAnim, customPreviewImageData, telemetry, useFloydSteinbergDither, lcdCustom]);

  // Auto-stream Telemetry HUD every 5s when enabled
  useEffect(() => {
    if (!autoStreamHud5s) return;
    const timer = setInterval(() => {
      setTelemetry((prev) => ({
        ...prev,
        cpuPercent: Math.max(12, Math.min(95, prev.cpuPercent + Math.round((Math.random() - 0.48) * 9))),
        gpuTempC: Math.max(45, Math.min(82, prev.gpuTempC + Math.round((Math.random() - 0.5) * 3))),
      }));
      const frames = generateProceduralFrames('cyber-hud', 1, telemetry);
      setCustomPreviewImageData(frames[0]);
      hidEngineRef.current?.uploadFramesToLcd(frames, targetSlot, configState, (info) => {
        setUploadProgress(info);
      });
    }, 5000);
    return () => clearInterval(timer);
  }, [autoStreamHud5s, telemetry, targetSlot, configState]);

  // Dual-Layer 24-Band Neon Audio Spectrum Visualizer Loop (480x150 canvas on Tab 5)
  useEffect(() => {
    let animFrame = 0;
    let tick = 0;

    const renderSpectrum = () => {
      tick++;
      const bands = 24;
      const vals = liveSpectrumValuesRef.current;

      if (micActive && analyserRef.current) {
        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        for (let i = 0; i < bands; i++) {
          const bin = Math.min(freqData.length - 1, Math.floor((i / bands) * (freqData.length * 0.65)));
          vals[i] = Math.max(0.06, freqData[bin] / 255);
        }
      } else if (spectrumDemoRunning) {
        for (let i = 0; i < bands; i++) {
          const w1 = Math.sin(i * 0.42 + tick * 0.12) * 0.5 + 0.5;
          const w2 = Math.cos(i * 0.25 - tick * 0.18) * 0.5 + 0.5;
          const bassBoost = i < 5 ? 0.22 * Math.sin(tick * 0.25) : 0;
          vals[i] = Math.max(0.08, Math.min(0.98, w1 * 0.55 + w2 * 0.35 + bassBoost));
        }
      }

      const canvas = spectrumCanvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const W = canvas.width;
          const H = canvas.height;
          ctx.fillStyle = '#070b14';
          ctx.fillRect(0, 0, W, H);

          // Grid lines
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
          ctx.lineWidth = 1;
          for (let gy = 25; gy < H; gy += 25) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
            ctx.stroke();
          }

          // Top Layer: Cyan Oscilloscope Waveform
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (let x = 0; x < W; x += 4) {
            const bandIdx = Math.min(bands - 1, Math.floor((x / W) * bands));
            const amp = vals[bandIdx] * 18;
            const y = 26 + Math.sin(x * 0.06 + tick * 0.2) * amp;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();

          // Bottom Layer: 24 Neon Bars + Peak Dots
          const barW = 14;
          const gap = 5.2;
          const startX = 12;
          const baseY = H - 14;

          for (let i = 0; i < bands; i++) {
            const v = vals[i];
            const barH = Math.max(6, Math.round(v * 92));
            const bx = startX + i * (barW + gap);
            const by = baseY - barH;

            const grad = ctx.createLinearGradient(0, baseY, 0, baseY - 95);
            grad.addColorStop(0, '#06b6d4');
            grad.addColorStop(0.6, '#8b5cf6');
            grad.addColorStop(1, '#10b981');

            ctx.fillStyle = grad;
            ctx.fillRect(bx, by, barW, barH);

            // Peak cap
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(bx, Math.max(36, by - 5), barW, 3);
          }
        }
      }

      animFrame = requestAnimationFrame(renderSpectrum);
    };

    animFrame = requestAnimationFrame(renderSpectrum);
    return () => cancelAnimationFrame(animFrame);
  }, [micActive, spectrumDemoRunning]);

  // Connect WebHID Handler
  const handleConnectWebHid = async () => {
    if (!hidEngineRef.current) return;
    if (isConnected) {
      await hidEngineRef.current.disconnect();
      setIsConnected(false);
      setStatusLog('Disconnected from hardware. Running in Simulation Mode.');
      return;
    }

    const res = await hidEngineRef.current.connect();
    setIsConnected(res.connected);
    setStatusLog(res.message);
  };

  // Flash Procedural Animation to GMK87
  const handleFlashProcedural = async (animId: ProceduralAnimId, frameCount = 12) => {
    setCustomPreviewImageData(null);
    setActivePreviewAnim(animId);
    const frames = generateProceduralFrames(
      animId,
      frameCount,
      telemetry,
      liveSpectrumValuesRef.current,
      lcdCustom
    );
    await hidEngineRef.current?.uploadFramesToLcd(
      frames,
      targetSlot,
      configState,
      (info, currentFrame) => {
        setUploadProgress(info);
        if (currentFrame && info.phase === 'streaming') {
          const canvas = monitorCanvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (ctx) {
            ctx.putImageData(
              quantizeImageDataToRGB565Preview(currentFrame, useFloydSteinbergDither),
              0,
              0
            );
          }
        }
      }
    );
    setStatusLog(
      `Flashed "${animId}" (${frameCount} RGB565 frames, ${(frameCount * 64).toFixed(0)} KB) to Slot ${targetSlot}`
    );
  };

  // Preview & Flash Curated Pokémon Sprite
  const handleSelectPokemon = async (
    id: number,
    name: string,
    typeLabel: string,
    accentColor: string,
    flashImmediately: boolean
  ) => {
    setSelectedPokemonId(id);
    const url = getPokemonSpriteUrl(id, shinyPokemon);
    let img = pokemonImagesCache.current.get(url) || null;

    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = url;
      await new Promise<void>((resolve) => {
        img!.onload = () => resolve();
        img!.onerror = () => resolve();
      });
      pokemonImagesCache.current.set(url, img);
    }

    // Generate 8 animated battle bounce frames for the LCD with custom layout
    const frames: ImageData[] = [];
    for (let f = 0; f < 8; f++) {
      frames.push(
        renderPokemonLcdFrame(id, name, typeLabel, accentColor, shinyPokemon, img, f, lcdCustom)
      );
    }

    setCustomPreviewImageData(frames[0]);
    if (flashImmediately) {
      await hidEngineRef.current?.uploadFramesToLcd(frames, targetSlot, configState, (info) => {
        setUploadProgress(info);
      });
      setStatusLog(
        `Flashed #${id} ${shinyPokemon ? 'Shiny ' : ''}${name} (${lcdCustom.pokemonLayout}, 8 frames) to Slot ${targetSlot}`
      );
    } else {
      setStatusLog(
        `Previewing #${id} ${shinyPokemon ? 'Shiny ' : ''}${name} (${lcdCustom.pokemonLayout}) on 240×135 monitor`
      );
    }
  };

  // Import Direct GIF/Image URL
  const handleImportGifUrl = async (flash: boolean, overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? customGifUrl).trim();
    if (!targetUrl) return;
    if (overrideUrl) setCustomGifUrl(overrideUrl);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = targetUrl;

    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    const canvas = document.createElement('canvas');
    canvas.width = LCD_WIDTH;
    canvas.height = LCD_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    if (img.naturalWidth > 0) {
      const availX = lcdCustom.overlayMode === 'split-clock' ? 88 : 0;
      const availW = LCD_WIDTH - availX;
      const scale = Math.min(availW / img.naturalWidth, LCD_HEIGHT / img.naturalHeight);
      const dw = Math.round(img.naturalWidth * scale);
      const dh = Math.round(img.naturalHeight * scale);
      const dx = availX + Math.round((availW - dw) / 2);
      const dy = Math.round((LCD_HEIGHT - dh) / 2);
      try {
        ctx.drawImage(img, dx, dy, dw, dh);
      } catch {
        ctx.fillStyle = '#06b6d4';
        ctx.font = 'bold 11px "JetBrains Mono", monospace';
        ctx.fillText('EXTERNAL URL LOADED', 48, 68);
      }
    } else {
      ctx.strokeStyle = '#06b6d4';
      ctx.strokeRect(6, 6, LCD_WIDTH - 12, LCD_HEIGHT - 12);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText('URL STREAM // RGB565', 45, 62);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText(targetUrl.slice(0, 32), 20, 82);
    }

    applyLcdCustomOverlays(ctx, lcdCustom);
    const frame = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
    setCustomPreviewImageData(frame);

    if (flash) {
      await hidEngineRef.current?.uploadFramesToLcd([frame], targetSlot, configState, (info) => {
        setUploadProgress(info);
      });
      setStatusLog(`Flashed imported URL frame to Slot ${targetSlot}`);
    }
  };

  // Assign Keycode in Tab 1 (VIA Protocol 9 Command 0x05)
  const handleAssignKeycode = async (code: number) => {
    const keyDef = GMK87_PHYSICAL_KEYS.find((k) => k.id === selectedKeyId);
    if (!keyDef) return;

    setKeymap((prev) => {
      const copy = prev.map((layer) => layer.map((row) => [...row]));
      copy[activeLayer][keyDef.row][keyDef.col] = code;
      return copy;
    });

    if (hidEngineRef.current) {
      const { packetHex } = await hidEngineRef.current.setViaKeycode(
        activeLayer,
        keyDef.row,
        keyDef.col,
        code
      );
      setLastViaPacketHex(packetHex);
      setStatusLog(
        `VIA 0x05 Set Keycode: Layer ${activeLayer} [${keyDef.row},${keyDef.col}] (${keyDef.label}) → ${getKeycodeLabel(
          code
        )} (0x${code.toString(16).toUpperCase().padStart(4, '0')})`
      );
    }
  };

  // Read Full 960B VIA Keymap Buffer (Command 0x12)
  const handleReadViaBuffer = async () => {
    if (!hidEngineRef.current) return;
    const res = await hidEngineRef.current.readViaKeymapBuffer();
    setLastViaPacketHex(res.lastCmdHex);
    setStatusLog(
      `VIA 0x12 Read Keymap Buffer complete: ${res.totalBytes} bytes across ${res.chunksRead} chunks (4 Layers × 8 Rows × 15 Cols)`
    );
  };

  // Toggle Web Audio API Microphone Capture for Tab 5
  const handleToggleMic = async () => {
    if (micActive) {
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
      micStreamRef.current = null;
      analyserRef.current = null;
      setMicActive(false);
      setStatusLog('Stopped Web Audio microphone capture; reverted to internal DSP synth.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);

      micStreamRef.current = stream;
      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;
      setMicActive(true);
      setStatusLog('Live Web Audio API microphone spectrum capture active (24-Band FFT).');
    } catch {
      setStatusLog(
        'Microphone permission declined or unavailable in sandbox — running 24-Band Demo Synth.'
      );
    }
  };

  // Handle Local Image/GIF File Upload in Tab 6
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setUploadedRawImage(img);
        const canvas = document.createElement('canvas');
        canvas.width = LCD_WIDTH;
        canvas.height = LCD_HEIGHT;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

        // Aspect-ratio letterboxing onto 240x135
        const scale = Math.min(LCD_WIDTH / img.naturalWidth, LCD_HEIGHT / img.naturalHeight);
        const dw = Math.round(img.naturalWidth * scale);
        const dh = Math.round(img.naturalHeight * scale);
        const dx = Math.round((LCD_WIDTH - dw) / 2);
        const dy = Math.round((LCD_HEIGHT - dh) / 2);
        ctx.drawImage(img, dx, dy, dw, dh);

        const rawData = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
        const quantized = quantizeImageDataToRGB565Preview(rawData, useFloydSteinbergDither);
        setCustomPreviewImageData(rawData);

        if (uploaderPreviewRef.current) {
          const upCtx = uploaderPreviewRef.current.getContext('2d');
          upCtx?.putImageData(quantized, 0, 0);
        }
        setStatusLog(
          `Loaded "${file.name}" (${img.naturalWidth}×${img.naturalHeight}) → letterboxed to 240×135 RGB565`
        );
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Re-quantize uploader preview when Floyd-Steinberg toggle changes
  useEffect(() => {
    if (!uploadedRawImage || !uploaderPreviewRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = LCD_WIDTH;
    canvas.height = LCD_HEIGHT;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);
    const scale = Math.min(
      LCD_WIDTH / uploadedRawImage.naturalWidth,
      LCD_HEIGHT / uploadedRawImage.naturalHeight
    );
    const dw = Math.round(uploadedRawImage.naturalWidth * scale);
    const dh = Math.round(uploadedRawImage.naturalHeight * scale);
    const dx = Math.round((LCD_WIDTH - dw) / 2);
    const dy = Math.round((LCD_HEIGHT - dh) / 2);
    ctx.drawImage(uploadedRawImage, dx, dy, dw, dh);
    const rawData = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
    const quantized = quantizeImageDataToRGB565Preview(rawData, useFloydSteinbergDither);
    uploaderPreviewRef.current.getContext('2d')?.putImageData(quantized, 0, 0);
  }, [useFloydSteinbergDither, uploadedRawImage]);

  // Apply RGB & Underglow Config (Tab 7)
  const handleUpdateRgbConfig = async (partial: Partial<Gmk87ConfigState>) => {
    const next = { ...configState, ...partial };
    setConfigState(next);
    if (hidEngineRef.current) {
      const pktHex = await hidEngineRef.current.writeConfig(next);
      setUploadProgress((prev) => ({
        ...prev,
        lastPacketHex: pktHex,
        message: `Updated RGB Config: Effect=${next.lightingEffect}, Bri=${next.brightness}, Spd=${next.speed}`,
      }));
    }
  };

  // Activate Smart Knob Mode (Tab 8)
  const handleSelectSmartKnobMode = async (mode: (typeof SMART_KNOB_MODES)[0]) => {
    setActiveKnobModeId(mode.id);

    // 1. Update Layer 0 VIA keycodes for CCW (7,0), Click (0,14), and CW (7,1)
    setKeymap((prev) => {
      const copy = prev.map((l) => l.map((r) => [...r]));
      copy[0][7][0] = mode.ccwCode;
      copy[0][0][14] = mode.clickCode;
      copy[0][7][1] = mode.cwCode;
      return copy;
    });

    if (hidEngineRef.current) {
      await hidEngineRef.current.setViaKeycode(0, 7, 0, mode.ccwCode);
      await hidEngineRef.current.setViaKeycode(0, 0, 14, mode.clickCode);
      const lastVia = await hidEngineRef.current.setViaKeycode(0, 7, 1, mode.cwCode);
      setLastViaPacketHex(lastVia.packetHex);

      // 2. Render & Flash 240x135 Rotary Knob Active Mode OSD banner to LCD
      const osdFrame = renderSmartKnobOsdFrame(
        mode.title.replace(/^[^\s]+\s/, ''),
        mode.ccwLabel,
        mode.clickLabel,
        mode.cwLabel,
        mode.accent
      );
      setCustomPreviewImageData(osdFrame);
      await hidEngineRef.current.uploadFramesToLcd([osdFrame], targetSlot, configState, (info) => {
        setUploadProgress(info);
      });
    }

    setStatusLog(
      `Smart Knob Engine → ${mode.title}: Rewrote VIA Layer 0 [7,0]=${mode.ccwLabel}, [0,14]=${mode.clickLabel}, [7,1]=${mode.cwLabel} & flashed LCD OSD`
    );
  };

  // Interactive Typing Speedometer (Tab 9 Beyond-Zuoya Lab)
  const handleTypingInput = (val: string) => {
    setTypingTestText(val);
    const now = performance.now();
    keystrokeTimestampsRef.current.push(now);
    // Keep last 10 seconds of keystrokes
    keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter((t) => now - t < 10000);
    const charsInWindow = keystrokeTimestampsRef.current.length;
    const computedWpm = Math.min(220, Math.max(25, Math.round((charsInWindow / 5) * 6)));
    setLiveWpm(computedWpm);
  };

  const handleFlashBeyondApplet = async (mode: 'wpm' | 'pomodoro') => {
    const canvas = document.createElement('canvas');
    canvas.width = LCD_WIDTH;
    canvas.height = LCD_HEIGHT;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

    if (mode === 'wpm') {
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, LCD_WIDTH - 6, LCD_HEIGHT - 6);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('BEYOND-ZUOYA // WPM TACHOMETER', 12, 20);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 34px "JetBrains Mono", monospace';
      ctx.fillText(`${liveWpm}`, 24, 76);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 14px "JetBrains Mono", monospace';
      ctx.fillText('WPM', 102, 74);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('PEAK NKRO: 1000Hz USB-C HID', 24, 96);

      ctx.fillStyle = '#131b2e';
      ctx.fillRect(24, 106, 192, 12);
      ctx.fillStyle = liveWpm > 100 ? '#10b981' : '#06b6d4';
      ctx.fillRect(24, 106, Math.min(192, Math.round((liveWpm / 160) * 192)), 12);
    } else {
      const mins = String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0');
      const secs = String(pomodoroSeconds % 60).padStart(2, '0');

      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.strokeRect(3, 3, LCD_WIDTH - 6, LCD_HEIGHT - 6);
      ctx.fillStyle = '#f59e0b';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('BEYOND-ZUOYA // POMODORO OSD', 12, 20);

      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 36px "JetBrains Mono", monospace';
      ctx.fillText(`${mins}:${secs}`, 52, 78);

      ctx.fillStyle = '#10b981';
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText(pomodoroRunning ? 'FOCUS SESSION ACTIVE' : 'READY FOR SPRINT', 54, 104);
    }

    const frame = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
    setCustomPreviewImageData(frame);
    await hidEngineRef.current?.uploadFramesToLcd([frame], targetSlot, configState, (info) => {
      setUploadProgress(info);
    });
    setStatusLog(
      `Flashed Beyond-Zuoya ${mode === 'wpm' ? 'Live WPM Tachometer' : 'Pomodoro Focus Timer'} frame to GMK87 LCD`
    );
  };

  const selectedKeyDef =
    GMK87_PHYSICAL_KEYS.find((k) => k.id === selectedKeyId) || GMK87_PHYSICAL_KEYS[0];
  const currentSelectedKeycode =
    keymap[activeLayer]?.[selectedKeyDef.row]?.[selectedKeyDef.col] ?? 0;

  const hwClockDisplay = new Date(pcNow.getTime() + hwClockOffsetMs);
  const filteredShortcuts = GMK87_SHORTCUTS.filter((s) => {
    const matchesCat = shortcutCat === 'All' || s.category === shortcutCat;
    const q = shortcutQuery.toLowerCase();
    const matchesQuery =
      !q ||
      s.action.toLowerCase().includes(q) ||
      s.details.toLowerCase().includes(q) ||
      s.keys.some((k) => k.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const progressPercent =
    uploadProgress.totalBytes > 0
      ? Math.min(100, Math.round((uploadProgress.bytesSent / uploadProgress.totalBytes) * 100))
      : 0;

  const rgbHexColor = `#${configState.rgbHueR.toString(16).padStart(2, '0')}${configState.rgbHueG
    .toString(16)
    .padStart(2, '0')}${configState.rgbHueB.toString(16).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#0b0f19]/95 backdrop-blur-md border-b border-[#1e293b] px-6 py-3.5">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between gap-6">
          {/* Brand Lockup */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-[#131b2e] border border-[#06b6d4]/50 flex items-center justify-center text-[#06b6d4] font-mono font-bold text-sm">
              87
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white whitespace-nowrap">
                GMK87 Master Control Center
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                VID 0x320F · PID 0x5055 · LCD 0xFF1C · VIA 0xFF60
              </p>
            </div>
          </div>

          {/* Connection Status & Primary Action */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-300">
              {isConnected ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                  <span className="text-[#10b981] font-semibold">Connected: Zuoya GMK87</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-[#f59e0b]" />
                  <span className="text-[#f59e0b] font-semibold">Simulation / Disconnected</span>
                </>
              )}
            </div>

            <button
              onClick={() => setMonitorExpanded((v) => !v)}
              className="px-3 py-2 text-xs font-medium rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-[#06b6d4]" />
              {monitorExpanded ? 'Hide 240×135 Monitor' : 'Show 240×135 Monitor'}
            </button>

            <button
              onClick={handleConnectWebHid}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                isConnected
                  ? 'bg-[#10b981]/20 border border-[#10b981] text-[#10b981] hover:bg-[#10b981]/30'
                  : 'bg-[#06b6d4] text-slate-950 hover:bg-cyan-400'
              }`}
            >
              <Usb className="w-4 h-4" />
              {isConnected ? 'Disconnect GMK87' : 'Connect GMK87 (WebHID)'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Container */}
      <div className="max-w-[1440px] w-full mx-auto px-6 py-6 flex-1 flex flex-col gap-6">
        {/* Persistent / Toggleable Live 240x135 Hardware LCD Mini-Monitor Dock */}
        {monitorExpanded && (
          <section className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              {/* Left: Physical 240x135 TFT Bezel Replica */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 shrink-0">
                <div className="relative p-2.5 rounded-xl bg-[#070a12] border-2 border-[#1e293b] shadow-inner">
                  <div className="flex items-center justify-between mb-1.5 px-1 text-[10px] font-mono text-slate-400">
                    <span>TFT LCD · 240×135 RGB565</span>
                    <span className="text-[#06b6d4]">SLOT {targetSlot}</span>
                  </div>
                  <canvas
                    ref={monitorCanvasRef}
                    width={LCD_WIDTH}
                    height={LCD_HEIGHT}
                    className="w-[240px] h-[135px] rounded border border-[#1e293b] pixelated-canvas bg-black block"
                  />
                </div>

                {/* Monitor Controls & Quantization Info */}
                <div className="space-y-2.5">
                  <div className="text-xs font-mono text-[#06b6d4]">
                    LIVE HARDWARE FRAMEBUFFER MONITOR
                  </div>
                  <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                    Displays the exact 16-bit big-endian{' '}
                    <code className="text-cyan-300">RGB565</code> pixel stream (64,800B payload
                    padded to 65,536B flash boundary) sent via Report <code className="text-cyan-300">0x04</code>.
                  </p>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <div className="inline-flex rounded-lg bg-[#0b0f19] p-1 border border-[#1e293b]">
                      <button
                        onClick={() => setTargetSlot(0)}
                        className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                          targetSlot === 0
                            ? 'bg-[#06b6d4] text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Target: Slot 0
                      </button>
                      <button
                        onClick={() => setTargetSlot(1)}
                        className={`px-2.5 py-1 text-xs font-mono rounded-md transition-colors cursor-pointer ${
                          targetSlot === 1
                            ? 'bg-[#8b5cf6] text-white font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Target: Slot 1
                      </button>
                    </div>

                    <button
                      onClick={() => setUseFloydSteinbergDither((v) => !v)}
                      className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                        useFloydSteinbergDither
                          ? 'bg-[#10b981]/15 border-[#10b981]/60 text-[#10b981]'
                          : 'bg-[#0b0f19] border-[#1e293b] text-slate-400'
                      }`}
                    >
                      Floyd-Steinberg RGB565 Dither: {useFloydSteinbergDither ? 'ON' : 'OFF'}
                    </button>

                    {customPreviewImageData && (
                      <button
                        onClick={() => setCustomPreviewImageData(null)}
                        className="px-2.5 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] cursor-pointer"
                      >
                        Resume Live Anim
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: 56-Byte Chunk Upload Progress & Packet Telemetry */}
              <div className="w-full lg:max-w-md bg-[#0b0f19] border border-[#1e293b] rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-300 font-semibold">{uploadProgress.message}</span>
                  <span className="text-[#06b6d4] font-bold">{progressPercent}%</span>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2.5 bg-[#131b2e] rounded-full overflow-hidden border border-[#1e293b]">
                  <div
                    className="h-full bg-gradient-to-r from-[#06b6d4] via-[#8b5cf6] to-[#10b981] transition-all duration-150"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400 pt-0.5">
                  <div>
                    CHUNK STREAM:{' '}
                    <span className="text-slate-200">
                      {uploadProgress.bytesSent.toLocaleString()} /{' '}
                      {uploadProgress.totalBytes.toLocaleString()} B
                    </span>
                  </div>
                  <div className="text-right">
                    FRAME:{' '}
                    <span className="text-slate-200">
                      {uploadProgress.currentFrame}/{uploadProgress.totalFrames} (56B/pkt)
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-[#1e293b] flex items-center justify-between gap-2 text-[11px] font-mono">
                  <span className="text-slate-400">0xFF1C PKT:</span>
                  <code className="text-cyan-300 truncate">{uploadProgress.lastPacketHex}</code>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Navigation Tabs Bar */}
        <nav className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-[#1e293b]">
          {[
            { id: 'keymap', label: '⌨️ Key Remapper Studio', icon: Keyboard },
            { id: 'gifs', label: '🎁 GMK87 GIF Library', icon: Film },
            { id: 'shortcuts', label: '📖 Keyboard Shortcuts', icon: BookOpen },
            { id: 'clock', label: '⏱️ Clock & Profiles', icon: Clock },
            { id: 'telemetry', label: '🎵 Media & Telemetry HUD', icon: Cpu },
            { id: 'uploader', label: '🎨 Custom GIF Uploader', icon: Upload },
            { id: 'rgb', label: '💡 RGB & Underglow', icon: Sliders },
            { id: 'knob', label: '🎛️ Smart Knob Multi-Engine', icon: Disc },
            { id: 'ecosystem', label: '🔬 Ecosystem vs. GMK87 Lab', icon: FlaskConical },
          ].map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabId)}
                className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#131b2e] text-[#06b6d4] border-[#06b6d4]'
                    : 'text-slate-400 border-transparent hover:text-slate-200 hover:bg-[#131b2e]/50'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Status Bar Strip */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-2.5 rounded-lg bg-[#131b2e] border border-[#1e293b] text-xs font-mono">
          <div className="flex items-center gap-2 text-slate-300">
            <Zap className="w-3.5 h-3.5 text-[#06b6d4] shrink-0" />
            <span>{statusLog}</span>
          </div>
          <div className="text-slate-400">
            LAST VIA 0xFF60:{' '}
            <code className="text-[#8b5cf6] font-semibold">{lastViaPacketHex}</code>
          </div>
        </div>

        {/* =====================================================================
            TAB 1: ⌨️ KEY REMAPPER STUDIO (87-Key TKL + 3 Rotary Knob Controls)
           ===================================================================== */}
        {activeTab === 'keymap' && (
          <div className="space-y-6">
            {/* Layer Switcher & VIA Buffer Actions */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-400 mr-2 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#06b6d4]" />
                  VIA LAYER:
                </span>
                {[
                  { idx: 0, name: 'Layer 0 Win Base' },
                  { idx: 1, name: 'Layer 1 Win Fn' },
                  { idx: 2, name: 'Layer 2 Mac Base' },
                  { idx: 3, name: 'Layer 3 Mac Fn' },
                ].map((layer) => (
                  <button
                    key={layer.idx}
                    onClick={() => setActiveLayer(layer.idx)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      activeLayer === layer.idx
                        ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                        : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#06b6d4]/60'
                    }`}
                  >
                    {layer.name}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleReadViaBuffer}
                  className="px-3.5 py-2 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#06b6d4]" />
                  Read 960B Keymap (0x12)
                </button>
                <button
                  onClick={() => {
                    setKeymap(createDefaultKeymap());
                    setStatusLog('Restored factory default 4-layer GMK87 VIA keymap.');
                  }}
                  className="px-3.5 py-2 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Reset Default Layout
                </button>
              </div>
            </div>

            {/* Interactive 87-Key Physical TKL + Embedded Live 240x135 TFT + CNC Rotary Knob Deck */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    Zuoya GMK87 Physical Chassis (8 Rows × 15 Cols + Live NKRO Switch Tester)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Press keys on your physical keyboard to test matrix actuation live, click any
                    keycap to remap, or spin the CNC Rotary Knob (`7,0` CCW, `0,14` Push, `7,1` CW).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setRgbPreviewEnabled((v) => !v)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                      rgbPreviewEnabled
                        ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-purple-200'
                        : 'bg-[#0b0f19] border-[#1e293b] text-slate-400'
                    }`}
                  >
                    South-Facing RGB Glow: {rgbPreviewEnabled ? 'ON' : 'OFF'}
                  </button>

                  <div className="text-xs font-mono bg-[#0b0f19] border border-[#1e293b] px-3 py-1.5 rounded-lg text-slate-300">
                    NKRO Tester:{' '}
                    <span className="text-[#10b981] font-bold">{actuationCount} presses</span>
                  </div>

                  <div className="text-xs font-mono bg-[#0b0f19] border border-[#1e293b] px-3.5 py-1.5 rounded-lg">
                    Selected:{' '}
                    <span className="text-[#06b6d4] font-bold">{selectedKeyDef.label}</span> ·{' '}
                    <span className="text-[#8b5cf6]">
                      [{selectedKeyDef.row},{selectedKeyDef.col}]
                    </span>{' '}
                    →{' '}
                    <span className="text-[#10b981] font-bold">
                      {getKeycodeLabel(currentSelectedKeycode)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Physical Gasket-Mount Keyboard Chassis with Dynamic RGB Underglow */}
              <div
                className="relative mx-auto bg-[#070a12] border-2 rounded-2xl p-4 transition-all duration-300"
                style={{
                  width: '1040px',
                  height: '386px',
                  borderColor:
                    rgbPreviewEnabled && configState.lightingEffect !== 0
                      ? rgbHexColor
                      : '#1e293b',
                  boxShadow:
                    rgbPreviewEnabled && configState.lightingEffect !== 0
                      ? `0 0 34px -6px ${rgbHexColor}55, inset 0 0 18px -8px ${rgbHexColor}44`
                      : 'none',
                }}
              >
                {/* Interactive Metallic CNC Rotary Knob Dial Overlay at Top-Right */}
                <div
                  className="absolute flex items-center gap-1.5 z-20 pointer-events-none"
                  style={{
                    left: `${16 + 14.35 * 54}px`,
                    top: '14px',
                  }}
                >
                  <div
                    onClick={() => {
                      setKnobAngleDeg((a) => a - 24);
                      setSelectedKeyId('r0c14');
                    }}
                    title="CNC Aluminum Rotary Encoder"
                    className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950 border-2 border-[#06b6d4] shadow-lg flex items-center justify-center pointer-events-auto cursor-pointer"
                    style={{ transform: `rotate(${knobAngleDeg}deg)` }}
                  >
                    <div className="w-1.5 h-3.5 bg-[#06b6d4] rounded-full -translate-y-2" />
                  </div>
                </div>

                {/* Live Synchronized 240×135 TFT LCD Screen Embedded Inside the GMK87 Chassis (x:15.25..17.25, y:3.35) */}
                <div
                  onClick={() => setActiveTab('gifs')}
                  title="Live Embedded 240x135 RGB565 TFT Screen — Click to open GIF Library"
                  className="absolute rounded-lg bg-black border-2 border-[#06b6d4] overflow-hidden cursor-pointer group z-10 shadow-md"
                  style={{
                    left: `${16 + 15.25 * 54}px`,
                    top: `${16 + 3.35 * 54}px`,
                    width: `${2 * 54 - 5}px`,
                    height: `${54 - 5}px`,
                  }}
                >
                  <canvas
                    ref={inChassisCanvasRef}
                    width={LCD_WIDTH}
                    height={LCD_HEIGHT}
                    className="w-full h-full object-cover pixelated-canvas block"
                  />
                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[9px] font-mono text-[#06b6d4] font-bold">
                    EDIT 240×135 TFT
                  </div>
                </div>

                {GMK87_PHYSICAL_KEYS.map((k) => {
                  const assignedCode = keymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
                  const codeLabel = getKeycodeLabel(assignedCode);
                  const isSelected = selectedKeyId === k.id;
                  const isPhysicallyPressed = pressedKeyIds.has(k.id);
                  const unitPx = 54;
                  const gapPx = 5;

                  return (
                    <button
                      key={k.id}
                      onClick={() => {
                        setSelectedKeyId(k.id);
                        if (k.id === 'r7c0') setKnobAngleDeg((a) => a - 25);
                        if (k.id === 'r7c1') setKnobAngleDeg((a) => a + 25);
                      }}
                      style={{
                        left: `${16 + k.x * unitPx}px`,
                        top: `${16 + k.y * unitPx}px`,
                        width: `${k.w * unitPx - gapPx}px`,
                        height: `${(k.h || 1) * unitPx - gapPx}px`,
                      }}
                      className={`absolute rounded-lg p-1.5 flex flex-col justify-between text-left transition-all duration-100 cursor-pointer select-none ${
                        isPhysicallyPressed
                          ? 'bg-[#10b981]/30 border-2 border-[#10b981] text-white translate-y-0.5 z-20'
                          : isSelected
                          ? 'bg-[#06b6d4]/20 border-2 border-[#06b6d4] border-b-4 text-white ring-2 ring-[#06b6d4]/40 z-10'
                          : k.isKnob
                          ? 'bg-[#8b5cf6]/15 border border-[#8b5cf6]/60 border-b-4 text-purple-200 hover:border-[#8b5cf6]'
                          : 'bg-[#131b2e] border border-[#1e293b] border-b-4 border-b-[#090d16] text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full text-[9px] font-mono text-slate-400 leading-none">
                        <span className="truncate">{k.label}</span>
                        <span>
                          {k.row},{k.col}
                        </span>
                      </div>
                      <div
                        className={`text-[11px] font-mono font-bold truncate w-full ${
                          isPhysicallyPressed
                            ? 'text-[#10b981]'
                            : isSelected
                            ? 'text-[#06b6d4]'
                            : k.isKnob
                            ? 'text-[#8b5cf6]'
                            : 'text-slate-100'
                        }`}
                      >
                        {codeLabel}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bottom Categorized QMK/VIA Keycode Palette */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      'Basic',
                      'Alpha',
                      'Number',
                      'Function',
                      'Navigation',
                      'Modifier',
                      'Media & Knob',
                      'Layers',
                      'Lighting & Hardware',
                    ] as KeycodeItem['category'][]
                  ).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveKeyCategory(cat)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        activeKeyCategory === cat
                          ? 'bg-[#8b5cf6] text-white'
                          : 'bg-[#0b0f19] text-slate-400 border border-[#1e293b] hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Click any keycode below to write VIA <code className="text-cyan-300">0x05</code> to{' '}
                  <strong className="text-white">{selectedKeyDef.label}</strong> [{selectedKeyDef.row},
                  {selectedKeyDef.col}]
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {KEYCODE_CATALOG.filter((item) => item.category === activeKeyCategory).map(
                  (item) => {
                    const isCurrent = currentSelectedKeycode === item.code;
                    return (
                      <button
                        key={item.code}
                        onClick={() => handleAssignKeycode(item.code)}
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                          isCurrent
                            ? 'bg-[#10b981]/20 border-[#10b981] text-white'
                            : 'bg-[#0b0f19] border-[#1e293b] hover:border-[#06b6d4] text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <span className="text-xs font-mono font-bold text-[#06b6d4]">
                            {item.shortLabel}
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            0x{item.code.toString(16).toUpperCase().padStart(4, '0')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{item.name}</div>
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: 🎁 GMK87 GIF LIBRARY (33 Widescreen 240x135 Animations + 32 Pokémon + Customizer)
           ===================================================================== */}
        {activeTab === 'gifs' && (
          <div className="space-y-6">
            {/* Top Bar: 240×135 Keyboard Screen Customizer Studio */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    🎛️ 240×135 Keyboard Screen Customizer (Applied Live to All GIFs & Sprites)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Customize any animation specifically for the GMK87 TFT screen: add a live
                    split-screen digital clock, custom callsign tag, CRT scanlines, or GameBoy
                    palette before flashing.
                  </p>
                </div>
                <button
                  onClick={() => setLcdCustom(DEFAULT_LCD_CUSTOMIZATION)}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white cursor-pointer"
                >
                  Reset Screen Filters
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Screen Overlay Mode */}
                <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400">
                    SCREEN HUD / CLOCK OVERLAY
                  </label>
                  <select
                    value={lcdCustom.overlayMode}
                    onChange={(e) =>
                      setLcdCustom((prev) => ({
                        ...prev,
                        overlayMode: e.target.value as LcdCustomizationOptions['overlayMode'],
                      }))
                    }
                    className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  >
                    <option value="default">Default Animation HUD</option>
                    <option value="split-clock">⏱️ Split Clock + GIF (Left Clock + Right Anim)</option>
                    <option value="top-tag">🏷️ Top Custom Callsign Banner</option>
                    <option value="clean">🖼️ Clean Cinema (Hide HUD Text)</option>
                  </select>
                </div>

                {/* 2. Custom Gamer Tag / Callsign Text */}
                <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400">
                    CUSTOM SCREEN CALLSIGN TEXT
                  </label>
                  <input
                    type="text"
                    maxLength={24}
                    value={lcdCustom.customTagText}
                    onChange={(e) =>
                      setLcdCustom((prev) => ({ ...prev, customTagText: e.target.value }))
                    }
                    placeholder="GMK87 // PRO"
                    className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>

                {/* 3. Hardware Shader / Color Filter */}
                <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400">
                    TFT DISPLAY SHADER / PALETTE
                  </label>
                  <select
                    value={lcdCustom.colorFilter}
                    onChange={(e) =>
                      setLcdCustom((prev) => ({
                        ...prev,
                        colorFilter: e.target.value as LcdCustomizationOptions['colorFilter'],
                      }))
                    }
                    className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  >
                    <option value="none">True 16-Bit RGB565 Color</option>
                    <option value="crt-scanlines">📺 Retro CRT Scanline Grille</option>
                    <option value="gameboy">🕹️ 1989 GameBoy DMG 4-Shade Green</option>
                    <option value="cyber-tint">💎 Night-Vision Cyber Cyan Tint</option>
                  </select>
                </div>

                {/* 4. Pokémon Arena Layout Selector */}
                <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
                  <label className="block text-[11px] font-mono text-slate-400">
                    POKÉMON 240×135 FRAMING STYLE
                  </label>
                  <select
                    value={lcdCustom.pokemonLayout}
                    onChange={(e) =>
                      setLcdCustom((prev) => ({
                        ...prev,
                        pokemonLayout: e.target.value as LcdCustomizationOptions['pokemonLayout'],
                      }))
                    }
                    className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
                  >
                    <option value="pokedex-hud">Pokédex Battle Arena + HP Bar</option>
                    <option value="fullscreen-cinema">Full-Screen Centered Cinema</option>
                    <option value="split-clock-sprite">⏱️ Split Digital Clock + Sprite</option>
                    <option value="wanted-bounty">Wanted Bounty Poster Card</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 1: 33 Widescreen 240×135 Animations Across 6 Web-Culture Categories */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    🌐 Widescreen 240×135 Keyboard Animation Vault ({CURATED_GIF_LIBRARY.length}{' '}
                    Custom-Engineered Scenes)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Every animation below is native 240×135 (16:9), rendered live in your browser
                    with your active overlays/shaders, and flashes to Slot {targetSlot} in 1 click.
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={gifSearchQuery}
                    onChange={(e) => setGifSearchQuery(e.target.value)}
                    placeholder="Search animations (e.g. Pac-Man, AE86, NERV, Cat)..."
                    className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-full sm:w-72"
                  />
                </div>
              </div>

              {/* Category Filter Bar */}
              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    'All',
                    'Memes & Pets',
                    'Retro Arcade',
                    'Anime & Mecha',
                    'JDM & Racing',
                    'Lo-Fi & Sci-Fi',
                    'Hardware HUDs',
                  ] as GifCategory[]
                ).map((cat) => {
                  const count =
                    cat === 'All'
                      ? CURATED_GIF_LIBRARY.length
                      : CURATED_GIF_LIBRARY.filter((g) => g.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setGifCategoryFilter(cat)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        gifCategoryFilter === cat
                          ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                          : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#06b6d4]/60'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Grid of Live 240x135 Animated Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {CURATED_GIF_LIBRARY.filter((item) => {
                  const matchesCat =
                    gifCategoryFilter === 'All' || item.category === gifCategoryFilter;
                  const q = gifSearchQuery.toLowerCase();
                  const matchesSearch =
                    !q ||
                    item.title.toLowerCase().includes(q) ||
                    item.subtitle.toLowerCase().includes(q) ||
                    item.category.toLowerCase().includes(q);
                  return matchesCat && matchesSearch;
                }).map((preset) => {
                  const isPreviewing =
                    !customPreviewImageData && activePreviewAnim === preset.id;
                  return (
                    <div
                      key={preset.id}
                      className={`rounded-xl p-3.5 bg-[#0b0f19] border transition-colors flex flex-col justify-between gap-3 ${
                        isPreviewing ? 'border-2 border-[#06b6d4]' : 'border-[#1e293b]'
                      }`}
                    >
                      {/* Live 240x135 Animated Mini Monitor */}
                      <div className="space-y-2">
                        <MiniLcdCardCanvas animId={preset.id} custom={lcdCustom} />

                        <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                          <span style={{ color: preset.badgeColor }}>{preset.category}</span>
                          <span>
                            {preset.frames}f · {(preset.frames * 64).toFixed(0)}KB
                          </span>
                        </div>

                        <h3 className="text-xs font-bold text-white">{preset.title}</h3>
                        <p className="text-[11px] text-slate-400 leading-snug">
                          {preset.subtitle}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => {
                            setCustomPreviewImageData(null);
                            setActivePreviewAnim(preset.id);
                            setStatusLog(
                              `Pinned "${preset.title}" to top 240×135 Hardware LCD Monitor.`
                            );
                          }}
                          className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors cursor-pointer"
                        >
                          Monitor
                        </button>
                        <button
                          onClick={() => handleFlashProcedural(preset.id, preset.frames)}
                          className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                        >
                          Flash Slot {targetSlot}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 2: 32 Curated Pokémon Animated Showdown Sprites with Custom 240×135 Arena Layouts */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    ⚡ 32 Animated Pokémon Showdown Battle Sprites (Custom 240×135 Framing)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Choose between Pokédex Battle HUD, Full-Screen Cinema, Split Clock + Sprite, or
                    Wanted Bounty Poster in the customizer above, then click View or Flash.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={pokemonSearchQuery}
                      onChange={(e) => setPokemonSearchQuery(e.target.value)}
                      placeholder="Find Pokémon (e.g. Rayquaza, Umbreon, Mew)..."
                      className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-56"
                    />
                  </div>

                  <button
                    onClick={() => setShinyPokemon((s) => !s)}
                    className={`px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                      shinyPokemon
                        ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]'
                        : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#f59e0b]'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {shinyPokemon ? '★ Shiny Mode: ON' : 'Toggle ★ Shiny'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {CURATED_POKEMON_SPRITES.filter((p) => {
                  const q = pokemonSearchQuery.toLowerCase();
                  return (
                    !q ||
                    p.name.toLowerCase().includes(q) ||
                    p.type.toLowerCase().includes(q) ||
                    String(p.id).includes(q)
                  );
                }).map((poke) => {
                  const spriteUrl = getPokemonSpriteUrl(poke.id, shinyPokemon);
                  const isSelected = selectedPokemonId === poke.id;
                  return (
                    <div
                      key={poke.id}
                      className={`rounded-xl p-3 bg-[#0b0f19] border flex flex-col items-center justify-between gap-2 transition-colors ${
                        isSelected ? 'border-[#06b6d4]' : 'border-[#1e293b]'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>#{String(poke.id).padStart(3, '0')}</span>
                        <span style={{ color: poke.accentColor }}>
                          {shinyPokemon ? '★ SHINY' : poke.type.split(' ')[0]}
                        </span>
                      </div>

                      <div className="h-14 flex items-center justify-center">
                        <img
                          src={spriteUrl}
                          alt={poke.name}
                          referrerPolicy="no-referrer"
                          className="max-h-13 max-w-13 object-contain pixelated-canvas"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="text-xs font-bold text-white text-center">{poke.name}</div>

                      <div className="w-full flex items-center gap-1 pt-1">
                        <button
                          onClick={() =>
                            handleSelectPokemon(
                              poke.id,
                              poke.name,
                              poke.type,
                              poke.accentColor,
                              false
                            )
                          }
                          className="flex-1 py-1 text-[10px] font-mono rounded bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          onClick={() =>
                            handleSelectPokemon(
                              poke.id,
                              poke.name,
                              poke.type,
                              poke.accentColor,
                              true
                            )
                          }
                          className="flex-1 py-1 text-[10px] font-mono font-semibold rounded bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer"
                        >
                          Flash
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Direct Web GIF / Image URL Importer & Quick Web Presets */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-white">
                  🔗 Direct Web GIF / Sprite URL Importer (Auto-Framed to 240×135 + Custom Overlays)
                </h2>
                <p className="text-xs text-slate-400">
                  Paste any direct GIF, PNG, or WebP URL from the web (or click a quick-load web
                  sprite preset below). Automatically applies your Split-Clock, Gamer Tag, or CRT
                  Scanline settings!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400">QUICK WEB URLS:</span>
                {[
                  {
                    label: '⚡ Shiny Rayquaza GIF',
                    url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/384.gif',
                  },
                  {
                    label: '🔥 Shiny Charizard GIF',
                    url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/6.gif',
                  },
                  {
                    label: '👻 Gengar Battle GIF',
                    url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/94.gif',
                  },
                  {
                    label: '🌙 Shiny Umbreon GIF',
                    url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/197.gif',
                  },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => handleImportGifUrl(false, preset.url)}
                    className="px-2.5 py-1 text-xs font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="url"
                  value={customGifUrl}
                  onChange={(e) => setCustomGifUrl(e.target.value)}
                  placeholder="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif"
                  className="flex-1 bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
                />
                <button
                  onClick={() => handleImportGifUrl(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] cursor-pointer whitespace-nowrap"
                >
                  Preview 240×135
                </button>
                <button
                  onClick={() => handleImportGifUrl(true)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
                >
                  Flash URL to Slot {targetSlot}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: 📖 KEYBOARD SHORTCUTS (Searchable Hardware Reference Table)
           ===================================================================== */}
        {activeTab === 'shortcuts' && (
          <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Zuoya GMK87 Hardware Fn Combination Reference
                </h2>
                <p className="text-xs text-slate-400">
                  Built-in MCU shortcuts for the 240×135 TFT LCD, 3-Host Bluetooth 5.0 / 2.4GHz
                  wireless, South-facing RGB, and EEPROM reset.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={shortcutQuery}
                    onChange={(e) => setShortcutQuery(e.target.value)}
                    placeholder="Filter shortcuts (e.g. Bluetooth, Screen, Reset)..."
                    className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-64"
                  />
                </div>

                <div className="flex items-center gap-1 bg-[#0b0f19] p-1 rounded-lg border border-[#1e293b]">
                  {(['All', 'Screen', 'Wireless', 'Lighting', 'System'] as const).map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setShortcutCat(cat)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                        shortcutCat === cat
                          ? 'bg-[#06b6d4] text-slate-950 font-semibold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1e293b] text-[11px] font-mono text-slate-400">
                    <th className="py-3 px-4">CATEGORY</th>
                    <th className="py-3 px-4">KEY COMBINATION</th>
                    <th className="py-3 px-4">HARDWARE FUNCTION</th>
                    <th className="py-3 px-4">PROTOCOL / FIRMWARE BEHAVIOR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b] text-xs">
                  {filteredShortcuts.map((item) => (
                    <tr key={item.id} className="hover:bg-[#0b0f19]/60 transition-colors">
                      <td className="py-3.5 px-4 font-mono text-[#06b6d4] whitespace-nowrap">
                        {item.category}
                      </td>
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {item.keys.map((k, idx) => (
                            <React.Fragment key={k}>
                              <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-[#0b0f19] border border-slate-700 rounded text-cyan-300 shadow-inner">
                                {k}
                              </kbd>
                              {idx < item.keys.length - 1 && (
                                <span className="text-slate-500">+</span>
                              )}
                            </React.Fragment>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-white">{item.action}</td>
                      <td className="py-3.5 px-4 text-slate-400 leading-relaxed">
                        {item.details}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: ⏱️ CLOCK & PROFILES (BCD Clock Sync & Display Mode Switcher)
           ===================================================================== */}
        {activeTab === 'clock' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Side-by-Side PC System Clock vs GMK87 Hardware BCD Clock */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white">
                  BCD Hardware Real-Time Clock Synchronizer (`cfg[35..41]`)
                </h2>
                <p className="text-xs text-slate-400">
                  Encodes `sec`, `min`, `hour`, `dayOfWeek` (1–7), `date`, `month`, and `year % 100`
                  using <code className="text-cyan-300">toBcd(n) = ((Math.floor(n/10)&lt;&lt;4) | (n%10))</code>.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4">
                  <div className="text-[11px] font-mono text-slate-400 mb-1">
                    PC SYSTEM CLOCK (LOCAL)
                  </div>
                  <div className="text-2xl font-mono font-bold text-[#10b981]">
                    {pcNow.toLocaleTimeString()}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    {pcNow.toLocaleDateString(undefined, {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                </div>

                <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4">
                  <div className="text-[11px] font-mono text-slate-400 mb-1">
                    GMK87 HARDWARE RTC (`cfg[35..41]`)
                  </div>
                  <div
                    className={`text-2xl font-mono font-bold ${
                      hwClockOffsetMs === 0 ? 'text-[#06b6d4]' : 'text-[#f59e0b]'
                    }`}
                  >
                    {hwClockDisplay.toLocaleTimeString()}
                  </div>
                  <div className="text-xs font-mono text-slate-400 mt-1">
                    {hwClockOffsetMs === 0
                      ? 'Δ 0.0s (Locked to PC)'
                      : `Drift: ${Math.round(hwClockOffsetMs / 1000)}s (Needs Sync)`}
                  </div>
                </div>
              </div>

              {/* Live BCD Byte Breakdown */}
              <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3.5 text-xs font-mono space-y-1.5">
                <div className="text-slate-400">LIVE BCD REGISTER ENCODING (`cfg[35..41]`):</div>
                <div className="text-cyan-300 flex flex-wrap gap-3">
                  <span>[35] SEC: 0x{toBcd(pcNow.getSeconds()).toString(16).padStart(2, '0')}</span>
                  <span>[36] MIN: 0x{toBcd(pcNow.getMinutes()).toString(16).padStart(2, '0')}</span>
                  <span>[37] HOUR: 0x{toBcd(pcNow.getHours()).toString(16).padStart(2, '0')}</span>
                  <span>
                    [38] DOW: 0x
                    {toBcd(pcNow.getDay() === 0 ? 7 : pcNow.getDay())
                      .toString(16)
                      .padStart(2, '0')}
                  </span>
                  <span>[39] DAY: 0x{toBcd(pcNow.getDate()).toString(16).padStart(2, '0')}</span>
                  <span>
                    [40] MON: 0x{toBcd(pcNow.getMonth() + 1).toString(16).padStart(2, '0')}
                  </span>
                  <span>
                    [41] YR: 0x{toBcd(pcNow.getFullYear() % 100).toString(16).padStart(2, '0')}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={handleSyncClockNow}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                >
                  Sync Keyboard Clock to PC Now
                </button>

                <button
                  onClick={() => setAutoSync15Min((v) => !v)}
                  className={`px-4 py-2.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                    autoSync15Min
                      ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                      : 'bg-[#0b0f19] border-[#1e293b] text-slate-300'
                  }`}
                >
                  15-Min Auto-Sync Daemon: {autoSync15Min ? 'ACTIVE' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Right: Display Profile Switcher (cfg[33]) */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-base font-bold text-white">
                  Active TFT Display Profile Switcher (`cfg[33]`)
                </h2>
                <p className="text-xs text-slate-400">
                  Switch the GMK87 240×135 screen between Factory Clock/Battery mode and your two
                  custom flash slots without pressing <kbd className="text-cyan-300">Fn + Enter</kbd>.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    mode: 0,
                    title: 'Default Screen (Mode 0)',
                    desc: 'Factory Zuoya digital clock, date, battery meter, Win/Mac & BT/2.4G/USB indicators.',
                    framesLabel: 'Built-in ROM UI',
                  },
                  {
                    mode: 1,
                    title: 'Custom Slot 0 (Mode 1)',
                    desc: 'Primary user animation slot starting at SPI Flash offset 0x000000.',
                    framesLabel: `cfg[34] = ${configState.slot0FrameCount} Frames`,
                  },
                  {
                    mode: 2,
                    title: 'Custom Slot 1 (Mode 2)',
                    desc: 'Secondary user animation slot starting at SPI Flash offset 0x100000.',
                    framesLabel: `cfg[46] = ${configState.slot1FrameCount} Frames`,
                  },
                ].map((prof) => {
                  const active = configState.activeScreenMode === prof.mode;
                  return (
                    <button
                      key={prof.mode}
                      onClick={() => {
                        handleUpdateRgbConfig({ activeScreenMode: prof.mode });
                        setStatusLog(`Switched cfg[33] Active Screen Mode to ${prof.title}`);
                      }}
                      className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                        active
                          ? 'bg-[#06b6d4]/15 border-[#06b6d4] text-white'
                          : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-sm font-bold text-white">{prof.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{prof.desc}</div>
                      </div>
                      <span className="text-xs font-mono text-[#06b6d4] shrink-0">
                        {prof.framesLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: 🎵 MEDIA & TELEMETRY HUD (Cyberpunk HUD + 24-Band Spectrum)
           ===================================================================== */}
        {activeTab === 'telemetry' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: Cyberpunk Telemetry HUD Generator */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    📊 Cyberpunk Telemetry HUD Generator
                  </h2>
                  <p className="text-xs text-slate-400">
                    Customize or stream live system CPU %, DDR5 RAM, GPU Temp, and Now-Playing track
                    onto the 240×135 TFT screen.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    CPU LOAD ({telemetry.cpuPercent}%)
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={100}
                    value={telemetry.cpuPercent}
                    onChange={(e) => {
                      const next = { ...telemetry, cpuPercent: Number(e.target.value) };
                      setTelemetry(next);
                      setActivePreviewAnim('cyber-hud');
                      setCustomPreviewImageData(null);
                    }}
                    className="w-full accent-[#06b6d4]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    RAM USAGE ({telemetry.ramPercent}% · {telemetry.ramUsedGb} GB)
                  </label>
                  <input
                    type="range"
                    min={5}
                    max={100}
                    value={telemetry.ramPercent}
                    onChange={(e) => {
                      const pct = Number(e.target.value);
                      const next = {
                        ...telemetry,
                        ramPercent: pct,
                        ramUsedGb: Number(((pct / 100) * 32).toFixed(1)),
                      };
                      setTelemetry(next);
                      setActivePreviewAnim('cyber-hud');
                      setCustomPreviewImageData(null);
                    }}
                    className="w-full accent-[#8b5cf6]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    NOW PLAYING TRACK
                  </label>
                  <input
                    type="text"
                    value={telemetry.trackTitle}
                    onChange={(e) =>
                      setTelemetry((prev) => ({ ...prev, trackTitle: e.target.value }))
                    }
                    className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-400 mb-1">
                    ARTIST / SOURCE
                  </label>
                  <input
                    type="text"
                    value={telemetry.trackArtist}
                    onChange={(e) =>
                      setTelemetry((prev) => ({ ...prev, trackArtist: e.target.value }))
                    }
                    className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  onClick={() => handleFlashProcedural('cyber-hud', 1)}
                  className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Flash Snapshot to Slot {targetSlot}
                </button>
                <button
                  onClick={() => setAutoStreamHud5s((v) => !v)}
                  className={`px-4 py-2.5 text-xs font-mono rounded-lg border cursor-pointer ${
                    autoStreamHud5s
                      ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                      : 'bg-[#0b0f19] border-[#1e293b] text-slate-300'
                  }`}
                >
                  Auto-Stream Every 5s: {autoStreamHud5s ? 'STREAMING' : 'OFF'}
                </button>
              </div>
            </div>

            {/* Right: Dual-Layer 24-Band Neon Audio Spectrum */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    🎵 Dual-Layer 24-Band Neon Audio Spectrum
                  </h2>
                  <p className="text-xs text-slate-400">
                    Real-time 480×150 DSP analyzer with Demo Synth or Web Audio API Microphone
                    capture.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSpectrumDemoRunning((v) => !v)}
                    className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] flex items-center gap-1 cursor-pointer"
                  >
                    {spectrumDemoRunning ? (
                      <>
                        <Pause className="w-3.5 h-3.5 text-[#f59e0b]" /> Pause Demo
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 text-[#10b981]" /> Resume Demo
                      </>
                    )}
                  </button>

                  <button
                    onClick={handleToggleMic}
                    className={`px-3 py-1.5 text-xs font-mono rounded-lg border flex items-center gap-1 cursor-pointer ${
                      micActive
                        ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                        : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#06b6d4]'
                    }`}
                  >
                    {micActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    {micActive ? 'Mic Active' : 'Use Mic Audio'}
                  </button>
                </div>
              </div>

              <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-2 flex justify-center">
                <canvas
                  ref={spectrumCanvasRef}
                  width={480}
                  height={150}
                  className="w-full max-w-[480px] h-[150px] rounded pixelated-canvas"
                />
              </div>

              <button
                onClick={() => handleFlashProcedural('neon-spectrum', 16)}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#8b5cf6] text-white hover:bg-purple-500 transition-colors cursor-pointer"
              >
                Flash 16-Frame Spectrum to GMK87 (Slot {targetSlot})
              </button>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 6: 🎨 CUSTOM GIF UPLOADER (File Picker + RGB565 Quantizer)
           ===================================================================== */}
        {activeTab === 'uploader' && (
          <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  Custom PNG / JPG / GIF Hardware Uploader (240×135 Letterbox & RGB565 Quantizer)
                </h2>
                <p className="text-xs text-slate-400">
                  Automatically scales and centers any local image onto 240×135, applies optional
                  Floyd-Steinberg dithering to prevent 16-bit banding, and streams 56-byte chunks.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
              <label className="border-2 border-dashed border-[#1e293b] hover:border-[#06b6d4] rounded-xl p-8 bg-[#0b0f19] flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                <Upload className="w-8 h-8 text-[#06b6d4] mb-3" />
                <span className="text-sm font-semibold text-white">
                  Click to choose a PNG, JPG, or GIF file
                </span>
                <span className="text-xs text-slate-400 mt-1">
                  {uploadedFileName
                    ? `Selected: ${uploadedFileName}`
                    : 'Auto-letterboxed to 240×135 · Big-Endian RGB565 (65,536B padded)'}
                </span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
                <div className="shrink-0">
                  <div className="text-[10px] font-mono text-slate-400 mb-1">
                    QUANTIZED RGB565 PREVIEW
                  </div>
                  <canvas
                    ref={uploaderPreviewRef}
                    width={LCD_WIDTH}
                    height={LCD_HEIGHT}
                    className="w-[240px] h-[135px] bg-black border border-[#1e293b] rounded pixelated-canvas"
                  />
                </div>

                <div className="space-y-3 w-full">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setTargetSlot(0)}
                      className={`flex-1 py-1.5 text-xs font-mono rounded-lg border cursor-pointer ${
                        targetSlot === 0
                          ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4] font-bold'
                          : 'bg-[#131b2e] text-slate-300 border-[#1e293b]'
                      }`}
                    >
                      Slot 0
                    </button>
                    <button
                      onClick={() => setTargetSlot(1)}
                      className={`flex-1 py-1.5 text-xs font-mono rounded-lg border cursor-pointer ${
                        targetSlot === 1
                          ? 'bg-[#8b5cf6] text-white border-[#8b5cf6] font-bold'
                          : 'bg-[#131b2e] text-slate-300 border-[#1e293b]'
                      }`}
                    >
                      Slot 1
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      if (!customPreviewImageData) {
                        setStatusLog('Select an image file first, or flash current monitor frame.');
                        return;
                      }
                      hidEngineRef.current?.uploadFramesToLcd(
                        [customPreviewImageData],
                        targetSlot,
                        configState,
                        (info) => setUploadProgress(info)
                      );
                    }}
                    className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                  >
                    Flash Custom Frame to Slot {targetSlot}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 7: 💡 RGB & UNDERGLOW (cfg[1..8] Hardware Lighting Controller)
           ===================================================================== */}
        {activeTab === 'rgb' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Sliders & Hue Picker */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
              <h2 className="text-base font-bold text-white">
                Backlight & Underglow Parameters (`cfg[1..8]`)
              </h2>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-slate-400">BRIGHTNESS (`cfg[2]`)</span>
                  <span className="text-[#06b6d4] font-bold">{configState.brightness} / 5</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={5}
                  value={Math.min(5, configState.brightness)}
                  onChange={(e) => handleUpdateRgbConfig({ brightness: Number(e.target.value) })}
                  className="w-full accent-[#06b6d4]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-slate-400">EFFECT SPEED (`cfg[3]`)</span>
                  <span className="text-[#8b5cf6] font-bold">{configState.speed} / 5</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={Math.max(1, configState.speed)}
                  onChange={(e) => handleUpdateRgbConfig({ speed: Number(e.target.value) })}
                  className="w-full accent-[#8b5cf6]"
                />
              </div>

              <div>
                <div className="flex justify-between text-xs font-mono mb-1.5">
                  <span className="text-slate-400">RGB HUE (`cfg[6..8]`)</span>
                  <span className="font-mono" style={{ color: rgbHexColor }}>
                    {rgbHexColor.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={rgbHexColor}
                    onChange={(e) => {
                      const hex = e.target.value.replace('#', '');
                      const r = parseInt(hex.substring(0, 2), 16) || 0;
                      const g = parseInt(hex.substring(2, 4), 16) || 0;
                      const b = parseInt(hex.substring(4, 6), 16) || 0;
                      handleUpdateRgbConfig({ rgbHueR: r, rgbHueG: g, rgbHueB: b });
                    }}
                    className="w-12 h-10 rounded bg-[#0b0f19] border border-[#1e293b] cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-400">
                    R:{configState.rgbHueR} G:{configState.rgbHueG} B:{configState.rgbHueB}
                  </span>
                </div>
              </div>
            </div>

            {/* Right 2 Cols: 10 Underglow & South-Facing Matrix Effect Cards */}
            <div className="lg:col-span-2 bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">
                South-Facing RGB & Underglow Effect Selector (`cfg[1]`)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {RGB_EFFECTS.map((eff) => {
                  const active = configState.lightingEffect === eff.id;
                  return (
                    <button
                      key={eff.id}
                      onClick={() => handleUpdateRgbConfig({ lightingEffect: eff.id })}
                      className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#06b6d4]/15 border-[#06b6d4] text-white'
                          : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-white">{eff.name}</span>
                        <span className="text-[10px] font-mono text-[#06b6d4]">
                          ID 0x{eff.id.toString(16).padStart(2, '0')}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{eff.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 8: 🎛️ SMART KNOB MULTI-ENGINE (VIA 0x05 + LCD Mode OSD Flash)
           ===================================================================== */}
        {activeTab === 'knob' && (
          <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-6">
            <div>
              <h2 className="text-base font-bold text-white">
                Smart Rotary Knob Multi-Engine (Simultaneous VIA Matrix + 240×135 OSD Banner)
              </h2>
              <p className="text-xs text-slate-400">
                Clicking any card below dynamically re-programs Layer 0 VIA keycodes for{' '}
                <code className="text-cyan-300">[7,0] CCW</code>,{' '}
                <code className="text-cyan-300">[0,14] Click</code>, and{' '}
                <code className="text-cyan-300">[7,1] CW</code> via command <code className="text-cyan-300">0x05</code>,
                and immediately flashes a custom Rotary Knob Active Mode OSD card to the TFT LCD.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {SMART_KNOB_MODES.map((mode) => {
                const active = activeKnobModeId === mode.id;
                return (
                  <button
                    key={mode.id}
                    onClick={() => handleSelectSmartKnobMode(mode)}
                    className={`p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                      active
                        ? 'bg-[#0b0f19] border-2 border-[#06b6d4] shadow-lg'
                        : 'bg-[#0b0f19] border border-[#1e293b] hover:border-slate-600'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-bold text-white">{mode.title}</span>
                        {active && (
                          <span className="text-[10px] font-mono text-[#10b981] font-bold">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{mode.subtitle}</p>
                    </div>

                    <div className="space-y-1.5 pt-3 border-t border-[#1e293b] text-xs font-mono">
                      <div className="flex justify-between">
                        <span className="text-slate-400">↺ [7,0] CCW:</span>
                        <span className="text-[#06b6d4] font-bold">{mode.ccwLabel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">● [0,14] CLICK:</span>
                        <span className="text-[#8b5cf6] font-bold">{mode.clickLabel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">↻ [7,1] CW:</span>
                        <span className="text-[#10b981] font-bold">{mode.cwLabel}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 9: 🔬 ECOSYSTEM RESEARCH & BEYOND-ZUOYA LAB
           ===================================================================== */}
        {activeTab === 'ecosystem' && (
          <div className="space-y-6">
            {/* Interactive Beyond-Zuoya Hardware Applets (WPM Tachometer + Pomodoro Timer) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Live WPM Typing Tachometer */}
              <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-5 h-5 text-[#06b6d4]" />
                    <h3 className="text-sm font-bold text-white">
                      Beyond-Zuoya Applet #1: Live WPM Typing Tachometer OSD
                    </h3>
                  </div>
                  <span className="text-lg font-mono font-bold text-[#06b6d4]">{liveWpm} WPM</span>
                </div>
                <p className="text-xs text-slate-400">
                  Inspired by ASUS ROG Omni & Finalmouse Centerpiece: type in the test box below to
                  measure your real-time keystroke cadence and flash your live WPM gauge onto the
                  GMK87 TFT screen.
                </p>
                <input
                  type="text"
                  value={typingTestText}
                  onChange={(e) => handleTypingInput(e.target.value)}
                  placeholder="Type here rapidly to test live WPM calculation..."
                  className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
                />
                <button
                  onClick={() => handleFlashBeyondApplet('wpm')}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer"
                >
                  Flash Live {liveWpm} WPM Tachometer to GMK87 LCD
                </button>
              </div>

              {/* Hardware Pomodoro Focus Timer */}
              <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="w-5 h-5 text-[#f59e0b]" />
                    <h3 className="text-sm font-bold text-white">
                      Beyond-Zuoya Applet #2: Hardware Pomodoro Focus Timer OSD
                    </h3>
                  </div>
                  <span className="text-lg font-mono font-bold text-[#f59e0b]">
                    {String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0')}:
                    {String(pomodoroSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Turns your GMK87 screen into a dedicated desk focus timer—a productivity feature
                  absent from the stock Zuoya Windows utility.
                </p>
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    onClick={() => setPomodoroRunning((r) => !r)}
                    className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#f59e0b] cursor-pointer"
                  >
                    {pomodoroRunning ? 'Pause Timer' : 'Start 25m Sprint'}
                  </button>
                  <button
                    onClick={() => {
                      setPomodoroRunning(false);
                      setPomodoroSeconds(25 * 60);
                    }}
                    className="px-3.5 py-2 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white cursor-pointer"
                  >
                    Reset 25:00
                  </button>
                  <button
                    onClick={() => handleFlashBeyondApplet('pomodoro')}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#f59e0b] text-slate-950 hover:bg-amber-400 cursor-pointer"
                  >
                    Flash Timer OSD to GMK87 LCD
                  </button>
                </div>
              </div>
            </div>

            {/* Fixes & Innovations Architectural Breakdown */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <h2 className="text-base font-bold text-white">
                What We Fixed in the Stock Zuoya Ecosystem vs. What We Added Beyond It
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {GMK87_FIXES_AND_INNOVATIONS.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span
                          className={
                            item.type === 'fix' ? 'text-[#f59e0b] font-bold' : 'text-[#10b981] font-bold'
                          }
                        >
                          {item.type === 'fix'
                            ? '🔧 ZUOYA ECOSYSTEM FIX'
                            : '🚀 BEYOND-ZUOYA INNOVATION'}
                        </span>
                        <span className="text-slate-500">{item.hardwareMechanism}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      <p className="text-xs text-slate-400">{item.problemOrOpportunity}</p>
                      <p className="text-xs text-cyan-200/90 pt-1">{item.howWeSolvedIt}</p>
                    </div>
                    <div>
                      <button
                        onClick={() => setActiveTab(item.targetTab as TabId)}
                        className="text-xs font-mono text-[#06b6d4] hover:underline cursor-pointer"
                      >
                        Open Feature in Studio →
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Industry Keyboard Apps Comparison Table */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4 overflow-x-auto">
              <h2 className="text-base font-bold text-white">
                Industry Keyboard Configurator Benchmark vs. Zuoya GMK87 Hardware
              </h2>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#1e293b] text-[11px] font-mono text-slate-400">
                    <th className="py-3 px-3">ECOSYSTEM / APP</th>
                    <th className="py-3 px-3">KEY REMAPPING</th>
                    <th className="py-3 px-3">LCD / TFT ENGINE</th>
                    <th className="py-3 px-3">LIVE TELEMETRY / OSD</th>
                    <th className="py-3 px-3">RGB565 DITHERING</th>
                    <th className="py-3 px-3">GMK87 VERDICT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1e293b]">
                  {KEYBOARD_APPS_COMPARISON.map((row) => (
                    <tr key={row.app} className="hover:bg-[#0b0f19]/60">
                      <td className="py-3 px-3 font-bold text-white">{row.app}</td>
                      <td className="py-3 px-3 text-slate-300">{row.keyRemapping}</td>
                      <td className="py-3 px-3 text-slate-300">{row.lcdScreenSupport}</td>
                      <td className="py-3 px-3 text-slate-300">{row.liveTelemetryOsd}</td>
                      <td className="py-3 px-3 font-mono text-[#06b6d4]">{row.rgb565Dithering}</td>
                      <td className="py-3 px-3 text-slate-400">{row.verdictForGmk87}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
