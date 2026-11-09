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
  Download,
  Palette,
  PictureInPicture2,
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
import {
  decodeImageOrGifBuffer,
  fetchAndDecodeExternalGif,
} from './utils/gifDecoder';
import RgbUnderglowStudio from './components/RgbUnderglowStudio';
import TftScreenPainterAndTimeline from './components/TftScreenPainterAndTimeline';
import InteractiveShortcutTrainer from './components/InteractiveShortcutTrainer';

type KeycapThemeId = 'cyberpunk' | 'olivia' | 'laser' | 'botanical' | 'dolch';

const KATAKANA_SUBLEGENDS: Record<string, string> = {
  '`': 'ろ',
  '~': 'ろ',
  '~ `': 'ろ',
  '1': 'ヌ',
  '2': 'フ',
  '3': 'ア',
  '4': 'ウ',
  '5': 'エ',
  '6': 'オ',
  '7': 'ヤ',
  '8': 'ユ',
  '9': 'ヨ',
  '0': 'ワ',
  '-': 'ホ',
  '=': 'ヘ',
  'Q': 'タ',
  'W': 'テ',
  'E': 'イ',
  'R': 'ス',
  'T': 'カ',
  'Y': 'ン',
  'U': 'ナ',
  'I': 'ニ',
  'O': 'ラ',
  'P': 'セ',
  '[': '゛',
  ']': '゜',
  '\\': 'ム',
  'A': 'チ',
  'S': 'ト',
  'D': 'シ',
  'F': 'ハ',
  'G': 'キ',
  'H': 'ク',
  'J': 'マ',
  'K': 'ノ',
  'L': 'リ',
  ';': 'レ',
  "'": 'ケ',
  'Z': 'ツ',
  'X': 'サ',
  'C': 'ソ',
  'V': 'ヒ',
  'B': 'コ',
  'N': 'ミ',
  'M': 'モ',
  ',': 'ネ',
  '.': 'ル',
  '/': 'メ',
};

const CYBER_MOD_GLYPHS: Record<string, string> = {
  r0c0: '△', // Esc - Red Tech Triangle
  r0c13: '⊕', // PrtSc - Crosshair Target
  r1c13: '<<<<<<', // Backspace - Cyan Chevron Gauge
  r2c0: '[-==--]', // Tab
  r3c0: '[++++]', // Caps Lock
  r3c13: '∿∿∿∿∿', // Enter - Red Waveform
  r4c0: '[==---]', // LShift
  r4c12: '[+ ++ ---]', // RShift
  r5c0: '☵', // LCtrl
  r5c1: '❖', // Win
  r5c2: '▲▼', // LAlt
  r5c9: '▲▼', // RAlt
  r5c10: 'FN', // Fn
  r5c11: '🗲', // Menu
  r5c12: '☵', // RCtrl
  // Nav Cluster
  r1c14: '⤾', // Ins
  r3c14: '☊', // Home
  r5c14: '⤿', // PgUp
  r2c14: '※', // Del
  r4c14: '≈', // End
  r6c14: '⛶', // PgDn
};

const GMK_KEYCAP_THEMES: Record<
  KeycapThemeId,
  {
    name: string;
    badge: string;
    alphaClass: string;
    modClass: string;
    accentClass: string;
    legendColor: string;
  }
> = {
  cyberpunk: {
    name: 'GMK Awaken (Yellow Space)',
    badge: '#facc15',
    alphaClass: 'bg-gradient-to-b from-[#141824] via-[#0d111c] to-[#070a12] border border-[#232c40] text-yellow-300',
    modClass: 'bg-gradient-to-b from-[#101522] via-[#0b0e18] to-[#060810] border border-[#1b253b] text-cyan-400',
    accentClass: 'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] border border-red-400 text-white font-bold',
    legendColor: 'text-yellow-300',
  },
  olivia: {
    name: 'GMK Olivia++',
    badge: '#e8b4b8',
    alphaClass: 'bg-gradient-to-b from-[#332f31] via-[#262325] to-[#1c1a1b] border border-[#474144] text-[#f7ecec]',
    modClass: 'bg-gradient-to-b from-[#1f1d1e] via-[#161415] to-[#0e0d0e] border border-[#332f31] text-[#f4bcc0]',
    accentClass: 'bg-gradient-to-b from-[#e8b4b8] to-[#d69fa4] border border-[#fce4e6] text-[#1a1718] font-bold',
    legendColor: 'text-[#f7ecec]',
  },
  laser: {
    name: 'GMK Laser Synth',
    badge: '#f43f5e',
    alphaClass: 'bg-gradient-to-b from-[#261854] via-[#1a0f3d] to-[#10072b] border border-[#442c94] text-[#22d3ee]',
    modClass: 'bg-gradient-to-b from-[#170a36] via-[#0e0524] to-[#080217] border border-[#331773] text-[#f43f5e]',
    accentClass: 'bg-gradient-to-b from-[#f43f5e] to-[#be123c] border border-[#fda4af] text-white font-bold',
    legendColor: 'text-[#22d3ee]',
  },
  botanical: {
    name: 'GMK Botanical',
    badge: '#10b981',
    alphaClass: 'bg-gradient-to-b from-[#223d34] via-[#172c25] to-[#0f1f1a] border border-[#355c4f] text-[#ecfdf5]',
    modClass: 'bg-gradient-to-b from-[#13241e] via-[#0b1814] to-[#06100d] border border-[#203a31] text-[#6ee7b7]',
    accentClass: 'bg-gradient-to-b from-[#10b981] to-[#047857] border border-[#6ee7b7] text-slate-950 font-bold',
    legendColor: 'text-[#ecfdf5]',
  },
  dolch: {
    name: 'GMK Retro Dolch',
    badge: '#f59e0b',
    alphaClass: 'bg-gradient-to-b from-[#3c434d] via-[#2c323b] to-[#1f242b] border border-[#535c69] text-slate-100',
    modClass: 'bg-gradient-to-b from-[#22272e] via-[#171b21] to-[#0f1216] border border-[#373e4a] text-amber-300',
    accentClass: 'bg-gradient-to-b from-[#ef4444] to-[#b91c1c] border border-[#fca5a5] text-white font-bold',
    legendColor: 'text-slate-100',
  },
};

interface WebGifItem {
  id: string;
  title: string;
  url: string;
  preview: string;
  source: string;
  width: number;
  height: number;
}

const WEB_GIF_CATEGORIES = [
  { label: 'Cyberpunk', query: 'cyberpunk neon' },
  { label: 'Trending', query: 'trending aesthetic' },
  { label: 'Anime', query: 'anime' },
  { label: 'Pixel Art', query: 'pixel art' },
  { label: 'Gaming', query: 'retro gaming arcade' },
  { label: 'Lo-Fi', query: 'lofi chill' },
  { label: 'Space', query: 'space nebula galaxy' },
  { label: 'Vaporwave', query: 'vaporwave synthwave' },
  { label: 'Sci-Fi', query: 'scifi hud hologram' },
  { label: 'Nature', query: 'nature waterfalls rain' },
  { label: 'Cars', query: 'jdm sports car drift' },
  { label: 'Cats', query: 'funny cute cat' },
  { label: 'Pokémon', query: 'pokemon sprite' },
];

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

  // Hardware Config State (48/64-byte buffer fields)
  const [configState, setConfigState] = useState<Gmk87ConfigState>(() => ({
    lightingEffect: 1, // Wave
    brightness: 9, // 0-9 hardware slider
    speed: 2, // 0-4 hardware slider
    effectDirection: 0, // 0 = Forward, 1 = Reverse
    rainbowMode: 0, // 0 = Single Hue, 1 = Rainbow
    rgbHueR: 6,
    rgbHueG: 182,
    rgbHueB: 212,
    activeScreenMode: 1, // Slot 0
    slot0FrameCount: 1,
    slot1FrameCount: 12,
    frameDurationMs: 100,
    clockDate: new Date(Date.now() - 142000), // Slightly drifted initially until hardware read/sync
  }));

  // HID Engine instance (USB Bridge + WebHID + Simulation)
  const hidEngineRef = useRef<Gmk87HidEngine | null>(null);
  if (!hidEngineRef.current) {
    hidEngineRef.current = new Gmk87HidEngine(configState);
  }

  const [isConnected, setIsConnected] = useState(false);
  const [transportMode, setTransportMode] = useState<'bridge' | 'webhid' | 'simulation'>(
    'simulation'
  );
  const [bridgeAvailable, setBridgeAvailable] = useState(false);
  const [viaProtocol, setViaProtocol] = useState<number>(9);
  const [connectedDeviceLabel, setConnectedDeviceLabel] = useState<string>('Zuoya GMK87');
  const [statusLog, setStatusLog] = useState<string>(
    'Probing USB HID Bridge (0x320F:0x5055) or ready for WebHID / Simulation Mode.'
  );
  const [lastViaPacketHex, setLastViaPacketHex] = useState<string>('05 00 07 00 00 AA 00 00');

  // Live 240x135 Hardware LCD Mini-Monitor state + Embedded In-Chassis TFT Canvas
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inChassisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const headerMiniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [monitorExpanded, setMonitorExpanded] = useState(false);
  const [floatingPipMonitor, setFloatingPipMonitor] = useState(false);
  const [isAnimPaused, setIsAnimPaused] = useState(false);
  const [activePreviewAnim, setActivePreviewAnim] = useState<ProceduralAnimId>('cyber-hud');
  const [customPreviewImageData, setCustomPreviewImageData] = useState<ImageData | null>(null);
  const [customPreviewFrames, setCustomPreviewFrames] = useState<ImageData[]>([]);
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

  // Tab 1: Key Remapper Studio State + Live NKRO Physical Key Press Tester + CNC Knob Dial + GMK Themes
  const [keymap, setKeymap] = useState<number[][][]>(() => createDefaultKeymap());
  const defaultKeymapRef = useRef<number[][][]>(createDefaultKeymap());
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('r7c0'); // Default highlight CCW Knob
  const [activeKeyCategory, setActiveKeyCategory] =
    useState<KeycodeItem['category']>('Media & Knob');
  const [keycodeSearchQuery, setKeycodeSearchQuery] = useState<string>('');
  const [pressedKeyIds, setPressedKeyIds] = useState<Set<string>>(() => new Set());
  const [actuationCount, setActuationCount] = useState<number>(0);
  const [knobAngleDeg, setKnobAngleDeg] = useState<number>(0);
  const [rgbPreviewEnabled, setRgbPreviewEnabled] = useState<boolean>(true);
  const [keycapThemeId, setKeycapThemeId] = useState<KeycapThemeId>('cyberpunk');
  const [dragOverKeyId, setDragOverKeyId] = useState<string | null>(null);
  const [showInlinePainterInGifs, setShowInlinePainterInGifs] = useState<boolean>(false);

  // Tab 2: GIF Library, Endless Web GIF Search, 240x135 Screen Customizer & Pokémon State
  const [gifCategoryFilter, setGifCategoryFilter] = useState<GifCategory>('All');
  const [gifSearchQuery, setGifSearchQuery] = useState<string>('');
  const [pokemonSearchQuery, setPokemonSearchQuery] = useState<string>('');
  const [lcdCustom, setLcdCustom] = useState<LcdCustomizationOptions>(DEFAULT_LCD_CUSTOMIZATION);
  const [shinyPokemon, setShinyPokemon] = useState(false);
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [customGifUrl, setCustomGifUrl] = useState<string>('');
  const [webGifQuery, setWebGifQuery] = useState<string>('cyberpunk neon');
  const [webGifPage, setWebGifPage] = useState<number>(0);
  const [webGifResults, setWebGifResults] = useState<WebGifItem[]>([]);
  const [webGifLoading, setWebGifLoading] = useState<boolean>(false);
  const [webGifError, setWebGifError] = useState<string>('');
  const [flashingWebGifId, setFlashingWebGifId] = useState<string | null>(null);
  const pokemonImagesCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const webGifReqIdRef = useRef<number>(0);
  const webGifAbortRef = useRef<AbortController | null>(null);

  // Tab 4: Clock & Profiles
  const [pcNow, setPcNow] = useState<Date>(() => new Date());
  const [hwClockOffsetMs, setHwClockOffsetMs] = useState<number>(-142000);
  const [autoSync15Min, setAutoSync15Min] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean((window as any).gmk87Electron?.isDesktopApp)
  );

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
  const [livePcTelemetry, setLivePcTelemetry] = useState<boolean>(true);
  const [autoStreamHud5s, setAutoStreamHud5s] = useState(false);
  const [spectrumDemoRunning, setSpectrumDemoRunning] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const liveSpectrumValuesRef = useRef<number[]>(new Array(24).fill(0.25));

  // Tab 6: Custom GIF Uploader (Static images & multi-frame animated GIFs)
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFrames, setUploadedFrames] = useState<ImageData[]>([]);
  const [uploadedSourceInfo, setUploadedSourceInfo] = useState<string>('');
  const uploaderPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // Tab 8: Smart Knob Multi-Engine
  const [activeKnobModeId, setActiveKnobModeId] = useState<string>('volume');

  // Tab 9: Beyond-Zuoya Interactive Lab (Live WPM Tachometer & Hardware Pomodoro Timer)
  const [typingTestText, setTypingTestText] = useState('');
  const [liveWpm, setLiveWpm] = useState(88);
  const keystrokeTimestampsRef = useRef<number[]>([]);
  const [pomodoroSeconds, setPomodoroSeconds] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);

  // Sync Electron desktop 15-min auto-clock setting on mount
  useEffect(() => {
    const bridge = (window as any).gmk87Electron;
    if (!bridge?.getDesktopStatus) return;
    bridge
      .getDesktopStatus()
      .then((st: any) => {
        if (typeof st?.autoSyncClock === 'boolean') {
          setAutoSync15Min(st.autoSyncClock);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-detect local USB HID Bridge + retry automatically when detached + load hardware config & VIA keymap
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const probeBridge = async (forceRefresh: boolean) => {
      if (!hidEngineRef.current || cancelled) return;
      const res = await hidEngineRef.current.checkBridgeStatus(forceRefresh);
      if (cancelled) return;

      if (typeof res.bridgeAvailable === 'boolean') {
        setBridgeAvailable(res.bridgeAvailable);
      }

      if (res.mode === 'bridge' || res.connected) {
        setBridgeAvailable(true);
        setIsConnected(res.connected);
        setTransportMode(res.mode);
        setConnectedDeviceLabel(res.deviceName);
        setViaProtocol(res.viaProtocol || 9);
        setStatusLog(res.message);

        if (res.config) {
          setConfigState(res.config);
          setHwClockOffsetMs(res.config.clockDate.getTime() - Date.now());
        }

        if (res.viaConnected) {
          const viaRes = await hidEngineRef.current.readViaKeymapBuffer();
          if (!cancelled && viaRes.keymap) {
            setKeymap(viaRes.keymap);
            setViaProtocol(viaRes.viaProtocol || 9);
            setLastViaPacketHex(viaRes.lastCmdHex);
          }
        }

        if (pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        }
      } else if (res.bridgeAvailable) {
        setStatusLog(res.message);
      }
    };

    probeBridge(true);
    pollTimer = setInterval(() => {
      if (!isConnected) {
        probeBridge(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [isConnected]);

  // Poll live Windows CPU/RAM/Now Playing telemetry when local backend exists
  useEffect(() => {
    if (!livePcTelemetry) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollTelemetry = async () => {
      try {
        const resp = await fetch('/api/system-telemetry', { signal: AbortSignal.timeout(2500) });
        const ct = resp.headers.get('content-type') || '';
        if (!resp.ok || !ct.includes('application/json')) {
          if (timer) clearInterval(timer);
          return;
        }
        const data = await resp.json();
        if (!active) return;
        setBridgeAvailable(true);
        setTelemetry((prev) => ({
          ...prev,
          cpuPercent: typeof data.cpuPercent === 'number' ? data.cpuPercent : prev.cpuPercent,
          ramPercent: typeof data.ramPercent === 'number' ? data.ramPercent : prev.ramPercent,
          ramUsedGb: typeof data.ramUsedGb === 'number' ? data.ramUsedGb : prev.ramUsedGb,
          ramTotalGb: typeof data.ramTotalGb === 'number' ? data.ramTotalGb : prev.ramTotalGb,
          uptimeStr: typeof data.uptimeStr === 'string' ? data.uptimeStr : prev.uptimeStr,
          trackTitle:
            data.media?.title && data.media.status !== 'Inactive'
              ? data.media.title
              : prev.trackTitle,
          trackArtist:
            data.media?.artist && data.media.status !== 'Inactive'
              ? data.media.artist
              : prev.trackArtist,
        }));
      } catch {
        if (timer) clearInterval(timer);
      }
    };

    pollTelemetry();
    timer = setInterval(pollTelemetry, 3000);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [livePcTelemetry]);

  // Helper: Search Endless Web GIFs across all categories via /api/gifs/search
  const handleSearchWebGifs = useCallback(
    async (queryOverride?: string, pageNum = 0, append = false) => {
      const q = (queryOverride ?? webGifQuery).trim() || 'cyberpunk neon';
      const reqId = ++webGifReqIdRef.current;
      webGifAbortRef.current?.abort();
      const controller = new AbortController();
      webGifAbortRef.current = controller;

      let timedOut = false;
      const timeoutTimer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, 35000);

      setWebGifLoading(true);
      setWebGifError('');
      try {
        const resp = await fetch(
          `/api/gifs/search?q=${encodeURIComponent(q)}&page=${pageNum}`,
          { signal: controller.signal }
        );
        if (webGifReqIdRef.current !== reqId) return;

        const ct = resp.headers.get('content-type') || '';
        if (!ct.includes('application/json')) {
          throw new Error('Web GIF search API requires running `npm run dev` local backend.');
        }

        const data = await resp.json();
        if (webGifReqIdRef.current !== reqId) return;

        if (!resp.ok) {
          throw new Error(data?.error || `Web GIF search returned HTTP ${resp.status}`);
        }

        const items: WebGifItem[] = Array.isArray(data.gifs) ? data.gifs : [];
        setWebGifPage(pageNum);
        setWebGifResults((prev) => {
          if (!append) return items;
          const seen = new Set(prev.map((x) => x.url));
          return [...prev, ...items.filter((x) => !seen.has(x.url))];
        });
        if (items.length === 0 && !append) {
          setWebGifError(`No GIFs matched "${q}". Try another keyword or category pill.`);
        }
      } catch (err: any) {
        if (webGifReqIdRef.current !== reqId) return;
        if (err?.name === 'AbortError' && !timedOut) return;
        setWebGifError(
          timedOut
            ? `GIF search timed out waiting for upstream providers on "${q}". Check internet connectivity and click Retry.`
            : err?.message || 'Web GIF Search unavailable without local Node backend (`npm run dev`).'
        );
      } finally {
        clearTimeout(timeoutTimer);
        if (webGifReqIdRef.current === reqId) {
          setWebGifLoading(false);
        }
      }
    },
    [webGifQuery]
  );

  // Load initial Web GIF search batch when opening Tab 2 for the first time
  useEffect(() => {
    if (activeTab === 'gifs' && webGifResults.length === 0 && !webGifLoading && !webGifError) {
      handleSearchWebGifs(webGifQuery, 0, false);
    }
  }, [activeTab, webGifResults.length, webGifLoading, webGifError, webGifQuery, handleSearchWebGifs]);

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

  // 15-Minute Auto-Sync Daemon (patches only cfg[35..41] without overwriting keyboard state)
  const handleSyncClockNow = useCallback(async () => {
    if (!hidEngineRef.current) return;
    const now = new Date();
    try {
      const res = await hidEngineRef.current.syncClockNow(now);
      if (res.bridgeDetected) {
        setBridgeAvailable(true);
        setIsConnected(true);
        setTransportMode('bridge');
      }
      if (res.config) {
        setConfigState(res.config);
      }
      if (res.hardwareApplied) {
        setHwClockOffsetMs(0);
        setUploadProgress((prev) => ({
          ...prev,
          lastPacketHex: res.packetHex,
          message: `Synced BCD Clock cfg[35..41] to ${now.toLocaleTimeString()}`,
        }));
        setStatusLog(`BCD Hardware Clock (cfg[35..41]) synchronized to ${now.toLocaleTimeString()}`);
      } else {
        setStatusLog(
          `Clock sync skipped — ${res.error || 'Connect GMK87 via wired USB-C to write RTC'}`
        );
      }
    } catch (err: any) {
      setStatusLog(`Clock sync failed: ${err?.message || 'HID write error'}`);
    }
  }, []);

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
        const now = performance.now();
        keystrokeTimestampsRef.current.push(now);
        keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter(
          (t) => now - t < 10000
        );
        const computedWpm = Math.min(
          220,
          Math.max(15, Math.round((keystrokeTimestampsRef.current.length / 5) * 6))
        );
        setLiveWpm(computedWpm);
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
      if (!isAnimPaused) {
        frameCount++;
      }

      let quantized: ImageData;
      if (customPreviewFrames.length > 0) {
        const activeFrame = customPreviewFrames[frameCount % customPreviewFrames.length];
        quantized = quantizeImageDataToRGB565Preview(activeFrame, useFloydSteinbergDither);
      } else if (customPreviewImageData) {
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
      headerMiniCanvasRef.current?.getContext('2d')?.putImageData(quantized, 0, 0);
      pipCanvasRef.current?.getContext('2d')?.putImageData(quantized, 0, 0);
    }, 110);

    return () => clearInterval(interval);
  }, [
    activePreviewAnim,
    customPreviewFrames,
    customPreviewImageData,
    telemetry,
    useFloydSteinbergDither,
    lcdCustom,
    isAnimPaused,
  ]);

  // Auto-stream Telemetry HUD every 5s when enabled
  useEffect(() => {
    if (!autoStreamHud5s) return;
    const timer = setInterval(() => {
      if (!livePcTelemetry || !bridgeAvailable) {
        setTelemetry((prev) => ({
          ...prev,
          cpuPercent: Math.max(
            12,
            Math.min(95, prev.cpuPercent + Math.round((Math.random() - 0.48) * 9))
          ),
          gpuTempC: Math.max(45, Math.min(82, prev.gpuTempC + Math.round((Math.random() - 0.5) * 3))),
        }));
      }
      const frames = generateProceduralFrames('cyber-hud', 1, telemetry, undefined, lcdCustom);
      setCustomPreviewFrames([]);
      setCustomPreviewImageData(frames[0]);
      hidEngineRef.current
        ?.uploadFramesToLcd(
          frames,
          targetSlot,
          configState,
          (info) => {
            setUploadProgress(info);
          },
          useFloydSteinbergDither
        )
        .then((res) => {
          if (res?.config) {
            setConfigState(res.config);
            if (hidEngineRef.current?.isConnected()) setHwClockOffsetMs(0);
          }
        });
    }, 5000);
    return () => clearInterval(timer);
  }, [
    autoStreamHud5s,
    livePcTelemetry,
    bridgeAvailable,
    telemetry,
    lcdCustom,
    targetSlot,
    configState,
    useFloydSteinbergDither,
  ]);

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

  // Connect Bridge / WebHID Handler
  const handleConnectWebHid = async () => {
    if (!hidEngineRef.current) return;
    if (isConnected) {
      await hidEngineRef.current.disconnect();
      setIsConnected(false);
      setTransportMode('simulation');
      setStatusLog('Disconnected from hardware. Running in Simulation Mode.');
      return;
    }

    const res = await hidEngineRef.current.connect();
    if (typeof res.bridgeAvailable === 'boolean') {
      setBridgeAvailable(res.bridgeAvailable);
    } else if (res.mode === 'bridge') {
      setBridgeAvailable(true);
    }
    setIsConnected(res.connected);
    setTransportMode(res.mode);
    setConnectedDeviceLabel(res.deviceName);
    setViaProtocol(res.viaProtocol || 9);
    setStatusLog(res.message);

    if (res.config) {
      setConfigState(res.config);
      setHwClockOffsetMs(res.config.clockDate.getTime() - Date.now());
    }
    if (res.viaConnected) {
      const viaRes = await hidEngineRef.current.readViaKeymapBuffer();
      if (viaRes.keymap) {
        setKeymap(viaRes.keymap);
        setViaProtocol(viaRes.viaProtocol || 9);
        setLastViaPacketHex(viaRes.lastCmdHex);
      }
    }
  };

  const applyPostUploadState = (
    res: { success: boolean; config?: Gmk87ConfigState; error?: string } | undefined,
    successMsg: string
  ) => {
    if (res?.config) {
      setConfigState(res.config);
      if (hidEngineRef.current?.isConnected()) {
        setHwClockOffsetMs(0);
      }
    }
    if (res && !res.success) {
      setStatusLog(`Upload failed: ${res.error || 'HID write error'}`);
    } else {
      setStatusLog(successMsg);
    }
  };

  // Flash Procedural Animation to GMK87
  const handleFlashProcedural = async (animId: ProceduralAnimId, frameCount = 12) => {
    setCustomPreviewFrames([]);
    setCustomPreviewImageData(null);
    setActivePreviewAnim(animId);
    const frames = generateProceduralFrames(
      animId,
      frameCount,
      telemetry,
      liveSpectrumValuesRef.current,
      lcdCustom
    );
    const res = await hidEngineRef.current?.uploadFramesToLcd(
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
      },
      useFloydSteinbergDither
    );
    applyPostUploadState(
      res,
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

    setCustomPreviewFrames(frames);
    setCustomPreviewImageData(frames[0]);
    if (flashImmediately) {
      const res = await hidEngineRef.current?.uploadFramesToLcd(
        frames,
        targetSlot,
        configState,
        (info) => {
          setUploadProgress(info);
        },
        useFloydSteinbergDither
      );
      applyPostUploadState(
        res,
        `Flashed #${id} ${shinyPokemon ? 'Shiny ' : ''}${name} (${lcdCustom.pokemonLayout}, 8 frames) to Slot ${targetSlot}`
      );
    } else {
      setStatusLog(
        `Previewing #${id} ${shinyPokemon ? 'Shiny ' : ''}${name} (${lcdCustom.pokemonLayout}) on 240×135 monitor`
      );
    }
  };

  // Preview or Flash Endless Web GIF Search Result (Multi-Frame Composite GIF Decoder via /api/proxy-gif)
  const handlePreviewOrFlashWebGif = async (item: WebGifItem, flash: boolean) => {
    setFlashingWebGifId(item.id);
    setStatusLog(`Downloading & decoding multi-frame GIF "${item.title}"...`);
    try {
      const decoded = await fetchAndDecodeExternalGif(item.url, lcdCustom);
      setCustomPreviewFrames(decoded.frames);
      setCustomPreviewImageData(decoded.frames[0] || null);
      setStatusLog(
        `Decoded "${item.title}": ${decoded.frames.length}/${decoded.sourceFrameCount} frames ready for 240×135 RGB565`
      );
      if (flash && decoded.frames.length > 0) {
        const res = await hidEngineRef.current?.uploadFramesToLcd(
          decoded.frames,
          targetSlot,
          configState,
          (info) => setUploadProgress(info),
          useFloydSteinbergDither
        );
        applyPostUploadState(
          res,
          `Flashed "${item.title}" (${decoded.frames.length} RGB565 frames) to Slot ${targetSlot}`
        );
      }
    } catch (err: any) {
      setStatusLog(`Failed to decode GIF "${item.title}": ${err?.message || 'CORS / fetch error'}`);
    } finally {
      setFlashingWebGifId(null);
    }
  };

  // Import Direct GIF/Image URL (Multi-frame animated GIF + CORS-free proxy decoding)
  const handleImportGifUrl = async (flash: boolean, overrideUrl?: string) => {
    const targetUrl = (overrideUrl ?? customGifUrl).trim();
    if (!targetUrl) return;
    if (overrideUrl) setCustomGifUrl(overrideUrl);

    setStatusLog(`Fetching & decoding external URL (${targetUrl.slice(0, 48)})...`);
    try {
      const decoded = await fetchAndDecodeExternalGif(targetUrl, lcdCustom);
      setCustomPreviewFrames(decoded.frames);
      setCustomPreviewImageData(decoded.frames[0] || null);
      if (flash && decoded.frames.length > 0) {
        const res = await hidEngineRef.current?.uploadFramesToLcd(
          decoded.frames,
          targetSlot,
          configState,
          (info) => setUploadProgress(info),
          useFloydSteinbergDither
        );
        applyPostUploadState(
          res,
          `Flashed imported URL (${decoded.frames.length}/${decoded.sourceFrameCount} frames) to Slot ${targetSlot}`
        );
      } else {
        setStatusLog(
          `Previewing imported URL (${decoded.frames.length}/${decoded.sourceFrameCount} frames) on 240×135 monitor`
        );
      }
    } catch (err: any) {
      setStatusLog(`URL import failed: ${err?.message || 'Could not load URL'}`);
    }
  };

  // Assign Keycode in Tab 1 (VIA Command 0x05) — supports click or drag-and-drop onto any key
  const handleAssignKeycode = async (code: number, targetKeyIdOverride?: string) => {
    const resolvedKeyId = targetKeyIdOverride || selectedKeyId;
    if (targetKeyIdOverride) {
      setSelectedKeyId(targetKeyIdOverride);
    }
    const keyDef = GMK87_PHYSICAL_KEYS.find((k) => k.id === resolvedKeyId);
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
          code,
          viaProtocol
        )} (0x${code.toString(16).toUpperCase().padStart(4, '0')})`
      );
    }
  };

  // Export 4-Layer VIA Keymap + RGB Config as .gmk87.json
  const handleExportKeymapProfile = () => {
    const payload = {
      app: 'GMK87 Master Control Center',
      device: 'Zuoya GMK87 (0x320F:0x5055)',
      exportedAt: new Date().toISOString(),
      viaProtocol,
      keycapThemeId,
      keymap,
      configState,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zuoya-gmk87-profile-${new Date().toISOString().slice(0, 10)}.gmk87.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusLog('Exported 4-layer VIA keymap & hardware lighting profile (.gmk87.json).');
  };

  // Import .gmk87.json Profile
  const handleImportKeymapProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.keymap) && parsed.keymap.length === 4) {
        setKeymap(parsed.keymap);
        if (parsed.keycapThemeId && GMK_KEYCAP_THEMES[parsed.keycapThemeId as KeycapThemeId]) {
          setKeycapThemeId(parsed.keycapThemeId as KeycapThemeId);
        }
        setStatusLog(`Imported 4-layer keymap profile from "${file.name}".`);
      } else {
        setStatusLog(`Invalid .gmk87.json file "${file.name}" — missing 4-layer keymap matrix.`);
      }
    } catch (err: any) {
      setStatusLog(`Failed to parse profile "${file.name}": ${err?.message || 'Invalid JSON'}`);
    }
  };

  // Read Full 960B VIA Keymap Buffer (Command 0x12)
  const handleReadViaBuffer = async () => {
    if (!hidEngineRef.current) return;
    const res = await hidEngineRef.current.readViaKeymapBuffer();
    setLastViaPacketHex(res.lastCmdHex);
    setViaProtocol(res.viaProtocol || 9);
    if (res.keymap) {
      setKeymap(res.keymap);
      setStatusLog(
        `VIA P${res.viaProtocol} Read 960B Keymap applied to studio (${res.chunksRead} chunks across 4 layers).`
      );
    } else {
      setStatusLog(
        `VIA 0x12 Simulation Read: ${res.totalBytes} bytes across ${res.chunksRead} chunks (Connect keyboard for live EEPROM keymap)`
      );
    }
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

  // Handle Local Image/GIF File Upload in Tab 6 (decodes up to 16 animated GIF frames via omggif)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      const decoded = await decodeImageOrGifBuffer(buffer, file.type, lcdCustom);
      setUploadedFrames(decoded.frames);
      setCustomPreviewFrames(decoded.frames);
      setCustomPreviewImageData(decoded.frames[0] || null);
      setUploadedSourceInfo(
        `${decoded.frames.length}${
          decoded.sourceFrameCount > decoded.frames.length
            ? ` of ${decoded.sourceFrameCount}`
            : ''
        } frame(s) · 240×135 RGB565`
      );
      setStatusLog(
        `Loaded "${file.name}" (${decoded.frames.length}/${decoded.sourceFrameCount} frames) → 240×135 RGB565`
      );
    } catch (err: any) {
      setStatusLog(`Failed to decode "${file.name}": ${err?.message || 'Unsupported image'}`);
    }
  };

  // Animate uploaded multi-frame GIF / re-quantize on Floyd-Steinberg toggle inside Tab 6 preview canvas
  useEffect(() => {
    if (uploadedFrames.length === 0) return;
    let idx = 0;
    const renderUploaderFrame = () => {
      const canvas = uploaderPreviewRef.current;
      if (!canvas) return;
      const frame = uploadedFrames[idx % uploadedFrames.length];
      const quantized = quantizeImageDataToRGB565Preview(frame, useFloydSteinbergDither);
      canvas.getContext('2d')?.putImageData(quantized, 0, 0);
      idx++;
    };
    renderUploaderFrame();
    if (uploadedFrames.length === 1) return;
    const timer = setInterval(renderUploaderFrame, 95);
    return () => clearInterval(timer);
  }, [uploadedFrames, useFloydSteinbergDither]);

  // Apply RGB & Underglow Config (Tab 7) and Display Profile Mode (Tab 4)
  const handleUpdateRgbConfig = async (partial: Partial<Gmk87ConfigState>) => {
    const next: Gmk87ConfigState = { ...configState, ...partial, clockDate: new Date() };
    setConfigState(next);
    if (hidEngineRef.current) {
      try {
        const pktHex = await hidEngineRef.current.writeConfig(next);
        if (hidEngineRef.current.isConnected()) {
          setHwClockOffsetMs(0);
        }
        setUploadProgress((prev) => ({
          ...prev,
          lastPacketHex: pktHex,
          message: `Updated Config: Mode=${next.activeScreenMode}, Effect=0x${next.lightingEffect
            .toString(16)
            .padStart(2, '0')}, Bri=${next.brightness}, Spd=${next.speed}, Dir=${
            next.effectDirection ?? 0
          }, Rnbw=${next.rainbowMode ?? 0}`,
        }));
        if (partial.activeScreenMode !== undefined) {
          const modeNames = [
            'Default Screen (Mode 0)',
            'Custom Slot 0 (Mode 1)',
            'Custom Slot 1 (Mode 2)',
          ];
          setStatusLog(
            `Switched cfg[33] Active Screen Mode to ${modeNames[partial.activeScreenMode] || `Mode ${partial.activeScreenMode}`}`
          );
        }
      } catch (err: any) {
        setStatusLog(`Hardware config update failed: ${err?.message || 'HID write error'}`);
      }
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
      setCustomPreviewFrames([]);
      setCustomPreviewImageData(osdFrame);
      const res = await hidEngineRef.current.uploadFramesToLcd(
        [osdFrame],
        targetSlot,
        configState,
        (info) => {
          setUploadProgress(info);
        },
        useFloydSteinbergDither
      );
      applyPostUploadState(
        res,
        `Smart Knob Engine → ${mode.title}: Rewrote VIA Layer 0 [7,0]=${mode.ccwLabel}, [0,14]=${mode.clickLabel}, [7,1]=${mode.cwLabel} & flashed LCD OSD`
      );
      return;
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
    setCustomPreviewFrames([]);
    setCustomPreviewImageData(frame);
    const res = await hidEngineRef.current?.uploadFramesToLcd(
      [frame],
      targetSlot,
      configState,
      (info) => {
        setUploadProgress(info);
      },
      useFloydSteinbergDither
    );
    applyPostUploadState(
      res,
      `Flashed Beyond-Zuoya ${mode === 'wpm' ? 'Live WPM Tachometer' : 'Pomodoro Focus Timer'} frame to GMK87 LCD`
    );
  };

  const selectedKeyDef =
    GMK87_PHYSICAL_KEYS.find((k) => k.id === selectedKeyId) || GMK87_PHYSICAL_KEYS[0];
  const currentSelectedKeycode =
    keymap[activeLayer]?.[selectedKeyDef.row]?.[selectedKeyDef.col] ?? 0;

  const hwClockDisplay = new Date(pcNow.getTime() + hwClockOffsetMs);

  const progressPercent =
    uploadProgress.totalBytes > 0
      ? Math.min(100, Math.round((uploadProgress.bytesSent / uploadProgress.totalBytes) * 100))
      : 0;

  const rgbHexColor = `#${configState.rgbHueR.toString(16).padStart(2, '0')}${configState.rgbHueG
    .toString(16)
    .padStart(2, '0')}${configState.rgbHueB.toString(16).padStart(2, '0')}`;

  // Count how many keys on the active layer differ from the factory default keymap
  const activeLayerModifiedCount = GMK87_PHYSICAL_KEYS.reduce((acc, k) => {
    const cur = keymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
    const def = defaultKeymapRef.current[activeLayer]?.[k.row]?.[k.col] ?? 0;
    return cur !== def ? acc + 1 : acc;
  }, 0);

  const activeKeycapTheme = GMK_KEYCAP_THEMES[keycapThemeId];

  const STUDIO_PILLARS: {
    id: string;
    title: string;
    subtitle: string;
    tabs: TabId[];
    defaultTab: TabId;
  }[] = [
    {
      id: 'pillar-input',
      title: '1. Keymap & Rotary',
      subtitle: '87-Key VIA + Smart Knob',
      tabs: ['keymap', 'knob'],
      defaultTab: 'keymap',
    },
    {
      id: 'pillar-screen',
      title: '2. 240×135 TFT Studio',
      subtitle: 'GIFs, Sprites & Painter',
      tabs: ['gifs', 'uploader'],
      defaultTab: 'gifs',
    },
    {
      id: 'pillar-lighting',
      title: '3. RGB & Underglow',
      subtitle: '19 Modes + 360° Halo',
      tabs: ['rgb'],
      defaultTab: 'rgb',
    },
    {
      id: 'pillar-live',
      title: '4. Live HUD & Clock',
      subtitle: 'RTC, Audio & Telemetry',
      tabs: ['telemetry', 'clock', 'ecosystem'],
      defaultTab: 'telemetry',
    },
    {
      id: 'pillar-diag',
      title: '5. Hardware & Shortcuts',
      subtitle: 'Fn Trainer & HID Packets',
      tabs: ['shortcuts'],
      defaultTab: 'shortcuts',
    },
  ];

  return (
    <div className="min-h-screen bg-[#06080d] text-slate-100 flex flex-col font-sans">
      {/* Precision Industrial Command Ribbon with Embedded 240x135 RGB565 Mini-HUD */}
      <header className="sticky top-0 z-30 bg-[#080b12]/98 backdrop-blur-md border-b border-[#151d2b] px-4 sm:px-6 py-2 shadow-[0_4px_24px_rgba(0,0,0,0.6)]">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          {/* Left: Industrial Instrument Brand Lockup */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-md bg-[#0e1422] border border-[#1f2e47] flex items-center justify-center text-[#06b6d4] font-mono font-black text-xs shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
              87
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xs sm:text-sm font-bold tracking-tight text-white whitespace-nowrap uppercase">
                  GMK87 Master Control Center
                </h1>
                <span className="hidden md:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-[#06b6d4]/10 border border-[#06b6d4]/40 text-[#06b6d4]">
                  STUDIO v2.5
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono tracking-tight">
                VID 0x320F · PID 0x5055 · VIA P{viaProtocol} · TFT 0xFF1C
              </p>
            </div>
          </div>

          {/* Center-Right: Inline Docked 240x135 Hardware LCD Mini-Monitor + Upload Progress */}
          <div className="hidden xl:flex items-center gap-3 bg-[#0a0e17] border border-[#1a2538] rounded-lg px-3 py-1.5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8)]">
            <div
              onClick={() => setMonitorExpanded((v) => !v)}
              title="Click to expand 1:1 240×135 Hardware Framebuffer Inspector"
              className="relative rounded border border-[#06b6d4]/60 bg-black overflow-hidden cursor-pointer shrink-0"
            >
              <canvas
                ref={headerMiniCanvasRef}
                width={LCD_WIDTH}
                height={LCD_HEIGHT}
                className="w-[88px] h-[50px] pixelated-canvas block"
              />
              <span className="absolute bottom-0 right-0 px-1 bg-black/85 text-[8px] font-mono text-[#06b6d4]">
                240×135
              </span>
            </div>

            <div className="w-56 space-y-1">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="text-cyan-300 font-semibold truncate max-w-[165px]">
                  {uploadProgress.phase === 'idle'
                    ? `TFT FRAMEBUFFER · SLOT ${targetSlot}`
                    : uploadProgress.message}
                </span>
                <span className="text-[#10b981] font-bold">{progressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#06080d] rounded-full overflow-hidden border border-[#151d2b]">
                <div
                  className="h-full bg-gradient-to-r from-[#06b6d4] via-[#8b5cf6] to-[#10b981] transition-all duration-150"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[9px] font-mono text-slate-400">
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setTargetSlot(0)}
                    className={`px-1.5 py-0.2 rounded cursor-pointer ${
                      targetSlot === 0 ? 'bg-[#06b6d4] text-slate-950 font-bold' : 'hover:text-white'
                    }`}
                  >
                    Slot 0
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetSlot(1)}
                    className={`px-1.5 py-0.2 rounded cursor-pointer ${
                      targetSlot === 1 ? 'bg-[#8b5cf6] text-white font-bold' : 'hover:text-white'
                    }`}
                  >
                    Slot 1
                  </button>
                </div>
                <span>
                  {uploadProgress.currentFrame}/{uploadProgress.totalFrames}f · RGB565
                </span>
              </div>
            </div>
          </div>

          {/* Right: Connection Status & Tactile Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#0a0e17] border border-[#182233] text-xs font-mono">
              {isConnected ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                  <span className="text-[#10b981] font-bold">
                    {transportMode === 'bridge' ? `USB: ${connectedDeviceLabel}` : 'WEBHID LIVE'}
                  </span>
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                  <span className="text-[#f59e0b] font-medium">
                    {bridgeAvailable ? 'USB STANDBY' : 'SIMULATION'}
                  </span>
                </>
              )}
            </div>

            {(window as any).gmk87Electron?.isDesktopApp && (
              <button
                onClick={() => (window as any).gmk87Electron?.minimizeToTray()}
                className="px-2.5 py-1.5 text-xs font-mono rounded-md bg-[#0c121e] border border-[#1b273b] text-slate-200 hover:border-[#8b5cf6] transition-colors whitespace-nowrap cursor-pointer"
              >
                TRAY
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAnimPaused((p) => !p)}
              title={isAnimPaused ? 'Resume screen animation' : 'Pause screen animation (calm display)'}
              className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isAnimPaused
                  ? 'bg-amber-500/20 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                  : 'bg-[#0c121e] border-[#1b273b] text-slate-300 hover:text-white hover:border-slate-500'
              }`}
            >
              {isAnimPaused ? (
                <Play className="w-3.5 h-3.5 fill-current text-amber-400" />
              ) : (
                <Pause className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{isAnimPaused ? 'PAUSED' : 'LIVE'}</span>
            </button>

            <button
              type="button"
              onClick={() => setFloatingPipMonitor((v) => !v)}
              title="Pin floating bottom-right 240×135 Picture-in-Picture Monitor"
              className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                floatingPipMonitor
                  ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-purple-200 shadow-[0_0_12px_rgba(139,92,246,0.3)]'
                  : 'bg-[#0c121e] border-[#1b273b] text-slate-300 hover:border-[#8b5cf6]'
              }`}
            >
              <PictureInPicture2 className="w-3.5 h-3.5 text-[#8b5cf6]" />
              <span className="hidden md:inline">PIP HUD</span>
            </button>

            <button
              type="button"
              onClick={() => setMonitorExpanded((v) => !v)}
              className={`px-2.5 py-1.5 text-xs font-mono rounded-md border transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                monitorExpanded
                  ? 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4] shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                  : 'bg-[#0c121e] border-[#1b273b] text-slate-200 hover:border-[#06b6d4]'
              }`}
            >
              <Eye className="w-3.5 h-3.5 text-[#06b6d4]" />
              {monitorExpanded ? 'HIDE 1:1' : '1:1 MONITOR'}
            </button>

            <button
              onClick={handleConnectWebHid}
              className={`px-3 py-1.5 text-xs font-mono font-bold rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                isConnected
                  ? 'bg-[#10b981]/20 border border-[#10b981] text-[#10b981] hover:bg-[#10b981]/30'
                  : 'bg-[#06b6d4] text-slate-950 hover:bg-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.35)]'
              }`}
            >
              <Usb className="w-3.5 h-3.5" />
              {isConnected
                ? 'DISCONNECT'
                : bridgeAvailable
                ? 'CONNECT USB'
                : 'CONNECT GMK87'}
            </button>
          </div>
        </div>
      </header>

      {/* Floating Bottom-Right Picture-in-Picture (PiP) 240x135 Hardware LCD Monitor */}
      {floatingPipMonitor && (
        <div className="fixed bottom-5 right-5 z-50 bg-[#0b0f19]/95 backdrop-blur-md border-2 border-[#06b6d4] rounded-2xl p-3 shadow-[0_12px_40px_rgba(0,0,0,0.75)] w-[272px] space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-[#06b6d4] font-bold">LIVE 240×135 TFT PiP</span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setTargetSlot(targetSlot === 0 ? 1 : 0)}
                className="px-1.5 py-0.5 rounded bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:text-white cursor-pointer"
              >
                Slot {targetSlot}
              </button>
              <button
                type="button"
                onClick={() => setFloatingPipMonitor(false)}
                className="px-1.5 py-0.5 rounded bg-[#131b2e] text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>
          </div>
          <canvas
            ref={pipCanvasRef}
            width={LCD_WIDTH}
            height={LCD_HEIGHT}
            className="w-[240px] h-[135px] mx-auto rounded border border-[#1e293b] bg-black pixelated-canvas block"
          />
          <div className="w-full h-1.5 bg-[#131b2e] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#06b6d4] to-[#10b981]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Industrial Cockpit Workspace: Left Sidebar + Fluid Main Canvas */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        {/* Left Vertical Industrial Hardware Cockpit Sidebar */}
        <aside className="w-full md:w-72 lg:w-80 shrink-0 bg-[#090d16] border-r border-[#1a2333] flex flex-col justify-between overflow-y-auto z-20">
          <div className="p-4 space-y-5">
            {/* Studio Header Brand */}
            <div className="flex items-center justify-between pb-3 border-b border-[#1a2333]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-[#06b6d4]/10 border border-[#06b6d4]/50 flex items-center justify-center text-[#06b6d4] font-mono font-bold text-xs">
                  87
                </div>
                <div>
                  <div className="text-xs font-mono font-bold text-white tracking-wider">
                    STUDIO SUITE
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    VIA P9 · 1000Hz USB
                  </div>
                </div>
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded bg-[#10b981]/15 border border-[#10b981]/40 text-[#10b981]">
                ONLINE
              </span>
            </div>

            {/* Studio Navigation Groups */}
            <div className="space-y-4">
              {/* Group 1: CORE HARDWARE */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-bold tracking-wider text-slate-400 px-2 uppercase">
                  Core Hardware
                </div>
                {[
                  {
                    id: 'keymap' as TabId,
                    label: 'Key Remapper',
                    subtitle: '87-Key TKL Matrix',
                    icon: Keyboard,
                    badge: activeLayerModifiedCount > 0 ? `${activeLayerModifiedCount} mod` : undefined,
                    badgeColor: 'bg-[#10b981]/20 text-[#10b981] border-[#10b981]/40',
                  },
                  {
                    id: 'knob' as TabId,
                    label: 'Smart Knob',
                    subtitle: 'Rotary Encoder OSD',
                    icon: Sliders,
                    badge: activeKnobModeId.toUpperCase(),
                    badgeColor: 'bg-[#8b5cf6]/20 text-purple-200 border-[#8b5cf6]/40',
                  },
                  {
                    id: 'rgb' as TabId,
                    label: 'RGB & Underglow',
                    subtitle: '19 HW Modes & Sync',
                    icon: Sparkles,
                    badge: '19 MODES',
                    badgeColor: 'bg-[#06b6d4]/20 text-[#06b6d4] border-[#06b6d4]/40',
                  },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between group ${
                        isActive
                          ? 'bg-[#06b6d4]/15 border-[#06b6d4] text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-[#0c111d]/60 border-[#1a2333] text-slate-300 hover:text-white hover:bg-[#121927] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#06b6d4]' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ml-1.5 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Group 2: TFT 240x135 SCREEN */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-bold tracking-wider text-slate-400 px-2 uppercase">
                  TFT Screen Studio
                </div>
                {[
                  {
                    id: 'gifs' as TabId,
                    label: 'GIF & Sprite Vault',
                    subtitle: '50+ Built-in & Web',
                    icon: Film,
                    badge: 'VAULT',
                    badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
                  },
                  {
                    id: 'uploader' as TabId,
                    label: 'Pixel & Custom GIF',
                    subtitle: 'Canvas Editor & Dither',
                    icon: Palette,
                    badge: '240×135',
                    badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                  },
                  {
                    id: 'clock' as TabId,
                    label: 'RTC Clock & Slots',
                    subtitle: 'BCD Sync & Profiles',
                    icon: Clock,
                    badge: `SLOT ${targetSlot}`,
                    badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                  },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between group ${
                        isActive
                          ? 'bg-[#06b6d4]/15 border-[#06b6d4] text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-[#0c111d]/60 border-[#1a2333] text-slate-300 hover:text-white hover:bg-[#121927] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#06b6d4]' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ml-1.5 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Group 3: TELEMETRY & LAB */}
              <div className="space-y-1">
                <div className="text-[10px] font-mono font-bold tracking-wider text-slate-400 px-2 uppercase">
                  Telemetry & Lab
                </div>
                {[
                  {
                    id: 'telemetry' as TabId,
                    label: 'Live HUD & Audio',
                    subtitle: 'Realtime Hardware Telemetry',
                    icon: Gauge,
                    badge: `${liveWpm} WPM`,
                    badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
                  },
                  {
                    id: 'ecosystem' as TabId,
                    label: 'Beyond-Zuoya Lab',
                    subtitle: 'OSDs, Benchmark & Fixes',
                    icon: FlaskConical,
                    badge: 'OSD',
                    badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
                  },
                  {
                    id: 'shortcuts' as TabId,
                    label: 'Fn Shortcuts & VIA',
                    subtitle: 'Cheatsheet & HID Raw',
                    icon: BookOpen,
                    badge: 'HID',
                    badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
                  },
                ].map((item) => {
                  const isActive = activeTab === item.id;
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTab(item.id)}
                      className={`w-full px-3 py-2.5 rounded-lg border text-left transition-all cursor-pointer flex items-center justify-between group ${
                        isActive
                          ? 'bg-[#06b6d4]/15 border-[#06b6d4] text-white shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                          : 'bg-[#0c111d]/60 border-[#1a2333] text-slate-300 hover:text-white hover:bg-[#121927] hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            isActive ? 'text-[#06b6d4]' : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <div className="min-w-0">
                          <div className={`text-xs font-semibold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ml-1.5 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Docked Cockpit Telemetry Box */}
          <div className="p-4 border-t border-[#1a2333] bg-[#070b13] space-y-3">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-slate-400">HARDWARE TRANSPORT</span>
              <span className="text-[#10b981] font-bold">
                {transportMode === 'bridge' ? 'NODE-HID' : isConnected ? 'WEBHID' : 'SIMULATION'}
              </span>
            </div>

            {/* Quick TFT Slot switch & status */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#0c111d] border border-[#1a2333]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#06b6d4] animate-pulse" />
                <span className="text-[10px] font-mono text-slate-300">Target Slot:</span>
              </div>
              <div className="inline-flex rounded bg-[#070a10] p-0.5 border border-[#1a2333]">
                <button
                  type="button"
                  onClick={() => setTargetSlot(0)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                    targetSlot === 0 ? 'bg-[#06b6d4] text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setTargetSlot(1)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                    targetSlot === 1 ? 'bg-[#8b5cf6] text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1
                </button>
              </div>
            </div>

            <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between">
              <span>VID: 0x320F PID: 0x5055</span>
              <span>1000Hz POLLING</span>
            </div>
          </div>
        </aside>

        {/* Fluid Hardware Workspace Canvas */}
        <main className="flex-1 min-w-0 overflow-y-auto hardware-grid-bg p-4 sm:p-6 flex flex-col gap-5">
          {/* Expandable 1:1 240x135 Hardware LCD Monitor & 56-Byte Chunk Inspector Dock */}
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
                      LIVE HARDWARE FRAMEBUFFER MONITOR (1:1 PIXEL SCALE)
                    </div>
                    <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                      Displays the exact 16-bit big-endian{' '}
                      <code className="text-cyan-300">RGB565</code> pixel stream (64,800B payload
                      padded to 65,536B flash boundary) sent via Report{' '}
                      <code className="text-cyan-300">0x04</code>.
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

                      {(customPreviewImageData || customPreviewFrames.length > 0) && (
                        <button
                          onClick={() => {
                            setCustomPreviewFrames([]);
                            setCustomPreviewImageData(null);
                          }}
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

          {/* Top Ticker & Breadcrumb Bar */}
          <div className="bg-[#0c111d]/90 backdrop-blur border border-[#1a2333] rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-mono">
              <span className="text-[#06b6d4] font-bold tracking-wider uppercase">
                STUDIO // {activeTab.toUpperCase()}
              </span>
              <span className="text-slate-600">/</span>
              <span className="text-slate-400 text-[11px]">
                {activeTab === 'keymap' && '87-Key TKL Switch Matrix & VIA Dynamic Key Remapper'}
                {activeTab === 'knob' && 'Programmable CNC Rotary Encoder Action Mapping & OSD'}
                {activeTab === 'rgb' && '19 Hardware Light Modes, HSV Wheel & Underglow Halo'}
                {activeTab === 'gifs' && '240×135 RGB565 Curated Animation & Sprite Vault'}
                {activeTab === 'uploader' && 'Pixel-Precise Canvas Painter & Custom GIF Quantizer'}
                {activeTab === 'clock' && 'BCD Hardware Real-Time Clock Sync & Flash Slot 0/1'}
                {activeTab === 'telemetry' && 'Real-Time Hardware Telemetry, CPU, Temp & Audio HUD'}
                {activeTab === 'ecosystem' && 'Beyond-Zuoya Architectural Innovations & OSD Engine'}
                {activeTab === 'shortcuts' && 'Factory Fn Shortcut Keycodes & Raw VIA HID Packets'}
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 px-2.5 py-1 rounded bg-[#070a10] border border-[#1a2333] max-w-full lg:max-w-md truncate">
              <Zap className="w-3 h-3 text-[#06b6d4] shrink-0" />
              <span className="truncate text-slate-300">{statusLog}</span>
            </div>
          </div>

        {/* =====================================================================
            TAB 1: ⌨️ KEY REMAPPER STUDIO (87-Key TKL + GMK Themes + Drag & Drop + Rotary Knob)
           ===================================================================== */}
        {activeTab === 'keymap' && (
          <div className="space-y-5">
            {/* Top Bar: Layer Switcher, GMK Keycap Themes & Profile Export/Import */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-[#06b6d4]" />
                  LAYER:
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
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                      activeLayer === layer.idx
                        ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                        : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#06b6d4]/60'
                    }`}
                  >
                    {layer.name}
                  </button>
                ))}

                {activeLayerModifiedCount > 0 && (
                  <span className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-[#10b981]/15 border border-[#10b981]/50 text-[#10b981]">
                    {activeLayerModifiedCount} Modified Key{activeLayerModifiedCount > 1 ? 's' : ''}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-[#8b5cf6]/15 border border-[#8b5cf6]/40 text-purple-200">
                  VIA P{viaProtocol}
                </span>
                <button
                  onClick={handleReadViaBuffer}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#06b6d4]" />
                  Read 960B (0x12)
                </button>
                <button
                  onClick={handleExportKeymapProfile}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export .gmk87.json
                </button>
                <label className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#8b5cf6] transition-colors flex items-center gap-1.5 cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#8b5cf6]" />
                  Import Profile
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportKeymapProfile}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={() => {
                    setKeymap(createDefaultKeymap());
                    setStatusLog('Restored factory default 4-layer GMK87 VIA keymap.');
                  }}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>

            {/* Keycap Colorway Theme Selector + Embedded Quick Smart Rotary Knob Mode Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Left 7 Cols: 5 Curated GMK Keycap Colorways */}
              <div className="lg:col-span-7 bg-[#131b2e] border border-[#1e293b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-[#06b6d4]" />
                  GMK KEYCAP COLORWAY:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(Object.keys(GMK_KEYCAP_THEMES) as KeycapThemeId[]).map((tid) => {
                    const th = GMK_KEYCAP_THEMES[tid];
                    const active = keycapThemeId === tid;
                    return (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => setKeycapThemeId(tid)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#0b0f19] border-[#06b6d4] text-white'
                            : 'bg-[#0b0f19]/60 border-[#1e293b] text-slate-400 hover:text-white'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: th.badge }}
                        />
                        {th.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right 5 Cols: Quick Rotary Encoder Mode Switcher */}
              <div className="lg:col-span-5 bg-[#131b2e] border border-[#1e293b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                  <Disc className="w-3.5 h-3.5 text-[#8b5cf6]" />
                  ROTARY KNOB ENGINE:
                </span>
                <div className="flex flex-wrap items-center gap-1">
                  {SMART_KNOB_MODES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => handleSelectSmartKnobMode(m)}
                      className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer ${
                        activeKnobModeId === m.id
                          ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white font-bold'
                          : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#8b5cf6]'
                      }`}
                    >
                      {m.title}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Interactive 87-Key Physical TKL + Embedded Live 240x135 TFT + CNC Rotary Knob Deck */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 overflow-x-auto">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    Zuoya GMK87 Physical Chassis (8 Rows × 15 Cols · Click or Drag-and-Drop Keycodes)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Press keys on your physical keyboard for live NKRO switch testing, click or drag
                    any keycode onto a keycap, or click the embedded 240×135 TFT screen.
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
                    <span className="text-[#10b981] font-bold">{actuationCount} presses</span> ·{' '}
                    <span className="text-[#06b6d4] font-bold">{liveWpm} WPM</span>
                  </div>

                  <div className="text-xs font-mono bg-[#0b0f19] border border-[#1e293b] px-3.5 py-1.5 rounded-lg">
                    Selected:{' '}
                    <span className="text-[#06b6d4] font-bold">{selectedKeyDef.label}</span> ·{' '}
                    <span className="text-[#8b5cf6]">
                      [{selectedKeyDef.row},{selectedKeyDef.col}]
                    </span>{' '}
                    →{' '}
                    <span className="text-[#10b981] font-bold">
                      {getKeycodeLabel(currentSelectedKeycode, viaProtocol)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Physical Gasket-Mount Keyboard Chassis with Dynamic RGB Underglow */}
              <div
                className="relative mx-auto bg-gradient-to-b from-[#0a0e18] via-[#070910] to-[#04060b] border-2 rounded-2xl p-4 transition-all duration-300 shadow-[0_20px_50px_rgba(0,0,0,0.9)] select-none"
                style={{
                  width: '1040px',
                  height: '386px',
                  borderColor:
                    rgbPreviewEnabled && configState.lightingEffect !== 0
                      ? rgbHexColor
                      : '#1e293b',
                  boxShadow:
                    rgbPreviewEnabled && configState.lightingEffect !== 0
                      ? `0 0 38px -4px ${rgbHexColor}66, inset 0 0 20px -8px ${rgbHexColor}44, 0 24px 60px rgba(0,0,0,0.95)`
                      : '0 20px 50px rgba(0,0,0,0.95), inset 0 1px 0 rgba(255,255,255,0.08)',
                }}
              >
                {/* 4 CNC Gasket Mounting Hex Bolts in Plate Corners */}
                <div className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>
                <div className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>
                <div className="absolute bottom-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>
                <div className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none" title="Anodized Gasket Mount Bolt">⬡</div>

                {/* Technical Engraved Legend on Lower Plate */}
                <div className="absolute bottom-2.5 right-12 text-[8px] font-mono tracking-widest text-slate-600 select-none uppercase pointer-events-none">
                  ZUOYA GMK87 // GASKET FR4 // 1000HZ NKRO // VIA P{viaProtocol} // 0xFF1C TFT
                </div>

                {/* Interactive Metallic CNC Rotary Knob Dial Overlay at Top-Right */}
                <div
                  className="absolute flex flex-col items-center gap-1 z-20"
                  style={{
                    left: `${16 + 17.3 * 54}px`,
                    top: '12px',
                  }}
                >
                  <div className="relative group flex items-center justify-center">
                    <div
                      onClick={() => {
                        setSelectedKeyId('r0c14');
                      }}
                      title="Zuoya GMK87 CNC Knurled Aluminum Rotary Encoder (Push Click: MUTE / Rotate: VOL)"
                      className="w-12 h-12 rounded-full knurled-dial border-2 border-[#06b6d4] shadow-[0_6px_20px_rgba(0,0,0,0.85)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-75"
                      style={{ transform: `rotate(${knobAngleDeg}deg)` }}
                    >
                      <div className="absolute inset-1 rounded-full border border-slate-600/40 flex items-center justify-center">
                        <div className="w-1.5 h-3.5 bg-[#06b6d4] rounded-full shadow-[0_0_8px_rgba(6,182,212,0.9)] -translate-y-2.5" />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      title="Rotate Counter-Clockwise (Vol -)"
                      onClick={() => {
                        setKnobAngleDeg((a) => a - 24);
                        setSelectedKeyId('r7c0');
                      }}
                      className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      title="Push Encoder Switch (Mute)"
                      onClick={() => {
                        setSelectedKeyId('r0c14');
                      }}
                      className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:text-white cursor-pointer"
                    >
                      ●
                    </button>
                    <button
                      type="button"
                      title="Rotate Clockwise (Vol +)"
                      onClick={() => {
                        setKnobAngleDeg((a) => a + 24);
                        setSelectedKeyId('r7c1');
                      }}
                      className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
                    >
                      ↻
                    </button>
                  </div>
                </div>

                {/* Live Synchronized 240×135 TFT LCD Screen Embedded Inside the GMK87 Chassis */}
                <div
                  onClick={() => setActiveTab('gifs')}
                  title="Embedded 240×135 RGB565 Color TFT Screen — Click to open 240×135 Screen Studio"
                  className="absolute rounded-lg bg-black border-2 border-[#06b6d4]/80 overflow-hidden cursor-pointer group z-10 shadow-lg ring-1 ring-cyan-500/30"
                  style={{
                    left: `${16 + 15.35 * 54}px`,
                    top: '12px',
                    width: '96px',
                    height: '54px',
                  }}
                >
                  <canvas
                    ref={inChassisCanvasRef}
                    width={LCD_WIDTH}
                    height={LCD_HEIGHT}
                    className="w-full h-full object-cover pixelated-canvas block"
                  />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-mono text-[#06b6d4] font-bold">
                    240×135 TFT
                  </div>
                </div>

                {/* GMK87 Signature Hardware RGB LED Strip Bar in Nav Cluster (Matches Physical Keyboard) */}
                <div
                  className="absolute flex items-center justify-center select-none"
                  style={{
                    left: `${16 + 15.25 * 54}px`,
                    top: `${16 + 3.45 * 54}px`,
                    width: `${3 * 54 - 5}px`,
                    height: '24px',
                  }}
                >
                  <div
                    className="w-full h-3.5 rounded-full bg-gradient-to-r from-cyan-400 via-indigo-300 to-purple-400 border border-white/60 shadow-[0_0_18px_rgba(168,85,247,0.95),0_0_30px_rgba(6,182,212,0.85)] animate-pulse"
                    title="GMK87 Signature Hardware RGB Light Bar (FN + PGUP to toggle modes, FN + PGDN to change color)"
                  />
                </div>

                {GMK87_PHYSICAL_KEYS.map((k) => {
                  if (k.isKnob) return null;
                  const assignedCode = keymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
                  const defaultCode =
                    defaultKeymapRef.current[activeLayer]?.[k.row]?.[k.col] ?? 0;
                  const isModifiedFromDefault = assignedCode !== defaultCode;
                  const codeLabel = getKeycodeLabel(assignedCode, viaProtocol);
                  const isSelected = selectedKeyId === k.id;
                  const isPhysicallyPressed = pressedKeyIds.has(k.id);
                  const isDragTarget = dragOverKeyId === k.id;
                  const unitPx = 54;
                  const gapPx = 5;

                  const isCyberpunk = keycapThemeId === 'cyberpunk';
                  const isSpacebar = k.id === 'r5c6';
                  const isEnter = k.id === 'r3c13';
                  const isBackspace = k.id === 'r1c13';
                  const isEsc = k.id === 'r0c0';
                  const isPrtSc = k.id === 'r0c13';
                  const isArrow =
                    k.id === 'r4c13' || // Up
                    k.id === 'r6c12' || // Down
                    k.id === 'r5c13' || // Left
                    k.id === 'r6c13'; // Right
                  const isFRowYellow =
                    k.id === 'r0c1' || k.id === 'r0c2' || k.id === 'r0c3' || k.id === 'r0c4' || // F1-F4
                    k.id === 'r0c9' || k.id === 'r0c10' || k.id === 'r0c11' || k.id === 'r0c12'; // F9-F12
                  const isFRowCyan =
                    k.id === 'r0c5' || k.id === 'r0c6' || k.id === 'r0c7' || k.id === 'r0c8'; // F5-F8
                  const isModKey = k.w > 1.15 || k.row === 0 || k.col >= 13;

                  // Cyberpunk custom palette matching user physical keycaps
                  let themeCapClass = activeKeycapTheme.alphaClass;
                  if (isCyberpunk) {
                    if (isSpacebar) {
                      themeCapClass = 'bg-[#facc15] border border-[#fde047] text-slate-950 font-black shadow-[0_2px_12px_rgba(250,204,21,0.5)]';
                    } else if (isEnter) {
                      themeCapClass = 'bg-gradient-to-b from-[#dc2626] to-[#991b1b] border border-red-400 text-white font-black shadow-[0_2px_12px_rgba(239,68,68,0.45)]';
                    } else if (isBackspace) {
                      themeCapClass = 'bg-gradient-to-b from-[#0891b2] to-[#0e7490] border border-cyan-300 text-cyan-100 font-bold shadow-[0_2px_10px_rgba(6,182,212,0.4)]';
                    } else if (isEsc) {
                      themeCapClass = 'bg-gradient-to-b from-[#dc2626] to-[#991b1b] border border-red-400 text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]';
                    } else if (isArrow) {
                      themeCapClass = 'bg-[#0a0d16] border border-[#232c40] text-red-500 font-black';
                    } else if (isFRowCyan || isPrtSc) {
                      themeCapClass = 'bg-[#0d121e] border border-[#1e2a3e] text-cyan-400 font-bold';
                    } else if (isFRowYellow) {
                      themeCapClass = 'bg-[#0d121e] border border-[#1e2a3e] text-yellow-400 font-bold';
                    } else if (isModKey) {
                      themeCapClass = activeKeycapTheme.modClass;
                    }
                  } else {
                    const isAccentKey = isEsc || isEnter || isArrow;
                    themeCapClass = isAccentKey
                      ? activeKeycapTheme.accentClass
                      : isModKey
                      ? activeKeycapTheme.modClass
                      : activeKeycapTheme.alphaClass;
                  }

                  const katakanaChar = KATAKANA_SUBLEGENDS[k.label];
                  const cyberGlyph = CYBER_MOD_GLYPHS[k.id];

                  return (
                    <button
                      key={k.id}
                      onClick={() => {
                        setSelectedKeyId(k.id);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverKeyId !== k.id) setDragOverKeyId(k.id);
                      }}
                      onDragLeave={() => {
                        if (dragOverKeyId === k.id) setDragOverKeyId(null);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverKeyId(null);
                        const rawCode = Number(e.dataTransfer.getData('text/plain'));
                        if (Number.isFinite(rawCode) && rawCode >= 0) {
                          handleAssignKeycode(rawCode, k.id);
                        }
                      }}
                      style={{
                        left: `${16 + k.x * unitPx}px`,
                        top: `${16 + k.y * unitPx}px`,
                        width: `${k.w * unitPx - gapPx}px`,
                        height: `${(k.h ?? 1) * unitPx - gapPx}px`,
                        boxShadow:
                          rgbPreviewEnabled && configState.lightingEffect !== 0
                            ? `${isPhysicallyPressed ? '0 1px 0 #05080f' : '0 4px 0 #05080f, 0 7px 14px rgba(0,0,0,0.7)'}, 0 4px 12px ${rgbHexColor}35`
                            : undefined,
                      }}
                      className={`absolute rounded-[6px] p-1.5 flex flex-col justify-between text-left transition-all duration-75 cursor-pointer select-none border border-b-2 ${
                        isPhysicallyPressed ? 'keycap-dish-pressed' : 'keycap-dish-3d'
                      } ${
                        isDragTarget
                          ? 'bg-[#06b6d4]/40 border-2 border-white scale-105 z-30'
                          : isPhysicallyPressed
                          ? 'bg-[#10b981]/30 border-2 border-[#10b981] text-white z-20'
                          : isSelected
                          ? 'bg-[#06b6d4]/20 border-2 border-[#06b6d4] text-white ring-2 ring-[#06b6d4]/40 z-10'
                          : `${themeCapClass} hover:brightness-110`
                      }`}
                    >
                      {/* Key Face Legends */}
                      {isCyberpunk && isEsc ? (
                        <div className="flex items-center justify-center w-full h-full text-base font-black text-red-200">
                          △
                        </div>
                      ) : isCyberpunk && isPrtSc ? (
                        <div className="flex items-center justify-center w-full h-full text-base font-black text-cyan-300">
                          ⊕
                        </div>
                      ) : isCyberpunk && isEnter ? (
                        <div className="flex flex-col justify-between w-full h-full">
                          <span className="text-[10px] font-mono font-black text-white/90">ENTER</span>
                          <span className="text-[9px] font-mono font-bold text-red-200 truncate">∿∿∿∿∿</span>
                        </div>
                      ) : isCyberpunk && isBackspace ? (
                        <div className="flex flex-col justify-between w-full h-full">
                          <span className="text-[10px] font-mono font-black text-cyan-100">BKSP</span>
                          <span className="text-[8px] font-mono font-bold text-cyan-200 truncate">&lt;&lt;&lt;&lt;&lt;&lt;</span>
                        </div>
                      ) : isCyberpunk && isSpacebar ? (
                        <div className="flex items-center justify-center w-full h-full text-[10px] font-mono font-black text-slate-900 tracking-widest">
                          SPACE
                        </div>
                      ) : isCyberpunk && isArrow ? (
                        <div className="flex items-center justify-center w-full h-full text-base font-black text-red-500">
                          {k.label}
                        </div>
                      ) : isCyberpunk && katakanaChar ? (
                        <div className="flex flex-col justify-between w-full h-full leading-none">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-black text-xs font-mono text-yellow-300">{k.label}</span>
                            {isModifiedFromDefault && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]"
                                title="Modified from factory default"
                              />
                            )}
                          </div>
                          <span className="font-bold text-[10px] font-mono text-yellow-500/90 self-end">
                            {katakanaChar}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col justify-between w-full h-full leading-none">
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold text-[11px] sm:text-xs font-mono truncate">{k.label}</span>
                            {isModifiedFromDefault && (
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]"
                                title="Modified from factory default"
                              />
                            )}
                          </div>
                          {cyberGlyph && isCyberpunk && (
                            <span className="text-[9px] font-mono text-cyan-400 truncate opacity-80">
                              {cyberGlyph}
                            </span>
                          )}
                          {isModifiedFromDefault && (
                            <div className="text-[10px] font-mono font-bold text-[#10b981] truncate w-full">
                              {codeLabel}
                            </div>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Key Remapping Drawer & Categorized Keycode Palette */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5 space-y-4">
              {/* Top Row: Selected Key Inspector & Quick Search */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b]">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-3 py-1.5 rounded-lg bg-[#06b6d4]/20 border border-[#06b6d4] text-[#06b6d4] font-mono font-bold text-sm">
                    {selectedKeyDef.label}
                  </div>
                  <div>
                    <div className="text-xs text-slate-300 font-semibold flex items-center gap-2">
                      <span>Action:</span>
                      <span className="text-[#10b981] font-mono font-bold">
                        {getKeycodeLabel(currentSelectedKeycode, viaProtocol)}
                      </span>
                      <span className="text-slate-500 font-mono text-[11px]">
                        (0x{currentSelectedKeycode.toString(16).toUpperCase().padStart(4, '0')})
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Switch: Row {selectedKeyDef.row}, Col {selectedKeyDef.col} · Layer {activeLayer}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selectedKeyDef.isKnob && (
                    <div className="flex items-center gap-1.5 mr-2">
                      <span className="text-xs font-mono text-purple-300">Knob Action:</span>
                      <button
                        type="button"
                        onClick={() => setSelectedKeyId('r7c0')}
                        className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                          selectedKeyId === 'r7c0' ? 'bg-[#8b5cf6] text-white font-bold' : 'bg-[#131b2e] text-slate-300'
                        }`}
                      >
                        CCW (Vol -)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedKeyId('r0c14')}
                        className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                          selectedKeyId === 'r0c14' ? 'bg-[#8b5cf6] text-white font-bold' : 'bg-[#131b2e] text-slate-300'
                        }`}
                      >
                        Click (Mute)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedKeyId('r7c1')}
                        className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                          selectedKeyId === 'r7c1' ? 'bg-[#8b5cf6] text-white font-bold' : 'bg-[#131b2e] text-slate-300'
                        }`}
                      >
                        CW (Vol +)
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const def = defaultKeymapRef.current[activeLayer]?.[selectedKeyDef.row]?.[selectedKeyDef.col] ?? 0;
                      handleAssignKeycode(def, selectedKeyDef.id);
                    }}
                    className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:text-white hover:border-[#06b6d4] transition-colors cursor-pointer"
                  >
                    Reset This Key
                  </button>
                </div>
              </div>

              {/* Category Pills & Keycode Search Input */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
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
                      onClick={() => {
                        setActiveKeyCategory(cat);
                        setKeycodeSearchQuery('');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                        activeKeyCategory === cat && !keycodeSearchQuery
                          ? 'bg-[#8b5cf6] text-white'
                          : 'bg-[#0b0f19] text-slate-400 border border-[#1e293b] hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={keycodeSearchQuery}
                    onChange={(e) => setKeycodeSearchQuery(e.target.value)}
                    placeholder="Search keycodes (e.g. Mute, Vol, Calc, Play)..."
                    className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4]"
                  />
                  {keycodeSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setKeycodeSearchQuery('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Keycode Items Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {KEYCODE_CATALOG.filter((item) => {
                  if (keycodeSearchQuery) {
                    const q = keycodeSearchQuery.toLowerCase();
                    return (
                      item.name.toLowerCase().includes(q) ||
                      item.shortLabel.toLowerCase().includes(q) ||
                      item.category.toLowerCase().includes(q)
                    );
                  }
                  return item.category === activeKeyCategory;
                }).map((item) => {
                  const isCurrent = currentSelectedKeycode === item.code;
                  return (
                    <button
                      key={item.code}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/plain', String(item.code));
                      }}
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
                })}
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

            {/* Endless Live Web GIF Search Across All Categories */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    🌐 Endless Web GIF Search (All Categories — Anime, Cyberpunk, Gaming, Sci-Fi & More)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Search millions of animated GIFs across any category, decode up to 16 composite
                    frames in real time, and preview or flash directly to GMK87 Slot {targetSlot}.
                  </p>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSearchWebGifs(webGifQuery, 0, false);
                  }}
                  className="flex items-center gap-2"
                >
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={webGifQuery}
                      onChange={(e) => setWebGifQuery(e.target.value)}
                      placeholder="Search any GIF (cyberpunk, anime, matrix, cats)..."
                      className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-full sm:w-72"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={webGifLoading}
                    className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {webGifLoading ? 'Searching...' : 'Search GIFs'}
                  </button>
                </form>
              </div>

              {/* 13 Quick Category Discovery Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {WEB_GIF_CATEGORIES.map((cat) => {
                  const active = webGifQuery.trim().toLowerCase() === cat.query.toLowerCase();
                  return (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => {
                        setWebGifQuery(cat.query);
                        handleSearchWebGifs(cat.query, 0, false);
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                          : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#8b5cf6]/60'
                      }`}
                    >
                      {cat.label}
                    </button>
                  );
                })}
              </div>

              {webGifError && (
                <div className="rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/40 px-4 py-3 text-xs text-[#f59e0b] font-mono flex items-center justify-between gap-3">
                  <span>{webGifError}</span>
                  <button
                    type="button"
                    onClick={() => handleSearchWebGifs(webGifQuery, 0, false)}
                    className="px-3 py-1 rounded bg-[#f59e0b] text-slate-950 font-semibold cursor-pointer shrink-0"
                  >
                    Retry
                  </button>
                </div>
              )}

              {webGifResults.length > 0 && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {webGifResults.map((item) => {
                      const isBusy = flashingWebGifId === item.id;
                      return (
                        <div
                          key={item.id}
                          className="rounded-xl p-3 bg-[#0b0f19] border border-[#1e293b] hover:border-[#06b6d4]/70 transition-colors flex flex-col justify-between gap-2.5"
                        >
                          <div className="space-y-2">
                            <div className="w-full aspect-[16/9] rounded-lg border border-[#1e293b] bg-black overflow-hidden flex items-center justify-center">
                              <img
                                src={item.url}
                                alt={item.title}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const el = e.currentTarget as HTMLImageElement;
                                  if (!el.dataset.proxied) {
                                    el.dataset.proxied = '1';
                                    el.src = `/api/proxy-gif?url=${encodeURIComponent(item.url)}`;
                                  } else if (!el.dataset.previewTried && item.preview) {
                                    el.dataset.previewTried = '1';
                                    el.src = item.preview;
                                  }
                                }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                              <span className="text-[#8b5cf6] truncate max-w-[140px]">
                                {item.source}
                              </span>
                              <span>
                                {item.width}×{item.height}
                              </span>
                            </div>
                            <h3 className="text-xs font-semibold text-white truncate">
                              {item.title}
                            </h3>
                          </div>

                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handlePreviewOrFlashWebGif(item, false)}
                              className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {isBusy ? 'Decoding...' : 'Monitor'}
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handlePreviewOrFlashWebGif(item, true)}
                              className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer"
                            >
                              {isBusy ? 'Wait...' : `Flash Slot ${targetSlot}`}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center pt-2">
                    <button
                      type="button"
                      disabled={webGifLoading}
                      onClick={() => handleSearchWebGifs(webGifQuery, webGifPage + 1, true)}
                      className="px-5 py-2.5 text-xs font-mono font-semibold rounded-lg bg-[#0b0f19] border border-[#06b6d4]/50 text-[#06b6d4] hover:bg-[#06b6d4]/10 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      {webGifLoading
                        ? 'Loading More GIFs...'
                        : `Load More GIFs · Showing ${webGifResults.length}`}
                    </button>
                  </div>
                </>
              )}
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
                    !customPreviewImageData &&
                    customPreviewFrames.length === 0 &&
                    activePreviewAnim === preset.id;
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
                            setCustomPreviewFrames([]);
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
                <button
                  type="button"
                  onClick={() => setShowInlinePainterInGifs((v) => !v)}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer whitespace-nowrap ${
                    showInlinePainterInGifs
                      ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                      : 'bg-[#0b0f19] border-[#8b5cf6]/60 text-purple-300 hover:border-[#8b5cf6]'
                  }`}
                >
                  {showInlinePainterInGifs
                    ? 'Hide Pixel Painter & Frame Timeline'
                    : '🖌️ Open Pixel Painter & Frame Timeline'}
                </button>
              </div>
            </div>

            {showInlinePainterInGifs && (
              <TftScreenPainterAndTimeline
                frames={
                  customPreviewFrames.length > 0
                    ? customPreviewFrames
                    : customPreviewImageData
                    ? [customPreviewImageData]
                    : uploadedFrames
                }
                onUpdateFrames={(nextFrames, msg) => {
                  setUploadedFrames(nextFrames);
                  setCustomPreviewFrames(nextFrames);
                  setCustomPreviewImageData(nextFrames[0] || null);
                  if (msg) setStatusLog(msg);
                }}
                onFlashFrames={async (framesToFlash, label) => {
                  const res = await hidEngineRef.current?.uploadFramesToLcd(
                    framesToFlash,
                    targetSlot,
                    configState,
                    (info) => setUploadProgress(info),
                    useFloydSteinbergDither
                  );
                  applyPostUploadState(res, `Flashed ${label} to Slot ${targetSlot}`);
                }}
                frameDurationMs={configState.frameDurationMs || 100}
                onChangeFrameDurationMs={(ms) => handleUpdateRgbConfig({ frameDurationMs: ms })}
                useFloydSteinbergDither={useFloydSteinbergDither}
                onToggleDither={() => setUseFloydSteinbergDither((v) => !v)}
                targetSlot={targetSlot}
                onSelectSlot={setTargetSlot}
              />
            )}
          </div>
        )}

        {/* =====================================================================
            TAB 3: 📖 KEYBOARD SHORTCUTS & INTERACTIVE HARDWARE DIAGNOSTICS
           ===================================================================== */}
        {activeTab === 'shortcuts' && (
          <InteractiveShortcutTrainer
            configState={configState}
            onUpdateConfig={handleUpdateRgbConfig}
            onSwitchViaLayer={(layer) => {
              setActiveLayer(layer);
              setActiveTab('keymap');
            }}
            lastLcdPacketHex={uploadProgress.lastPacketHex}
            lastViaPacketHex={lastViaPacketHex}
            onStatusLog={setStatusLog}
          />
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
                  Encodes `sec`, `min`, `hour`, `dayOfWeek` (0=Sun..6=Sat), `date`, `month`, and `year % 100`
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
                    [38] DOW: 0x{toBcd(pcNow.getDay()).toString(16).padStart(2, '0')}
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
                  onClick={async () => {
                    const nextVal = !autoSync15Min;
                    const bridge = (window as any).gmk87Electron;
                    if (bridge?.setAutoSyncClock) {
                      const confirmed = await bridge.setAutoSyncClock(nextVal).catch(() => nextVal);
                      setAutoSync15Min(Boolean(confirmed));
                    } else {
                      setAutoSync15Min(nextVal);
                    }
                  }}
                  className={`px-4 py-2.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                    autoSync15Min
                      ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                      : 'bg-[#0b0f19] border-[#1e293b] text-slate-300'
                  }`}
                >
                  15-Min Auto-Sync Daemon: {autoSync15Min ? 'ACTIVE' : 'OFF'}
                </button>
              </div>

              {configState.activeScreenMode !== 0 && (
                <div className="rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/40 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed">
                  Your LCD is currently showing <strong>Custom Slot {configState.activeScreenMode - 1}</strong>. Switch to{' '}
                  <strong>Default Screen (Mode 0)</strong> on the right (or press{' '}
                  <kbd className="text-cyan-300 font-mono">Fn + Enter</kbd>) to display the synced clock on your keyboard.
                </div>
              )}
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
                      onClick={() => handleUpdateRgbConfig({ activeScreenMode: prof.mode })}
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
            TAB 5: 🎵 MEDIA & TELEMETRY HUD (Cyberpunk HUD + 24-Band Spectrum + Quick RTC/OSD Bar)
           ===================================================================== */}
        {activeTab === 'telemetry' && (
          <div className="space-y-6">
            {/* Unified Live HUD, RTC Clock Sync & Applet Quick-Launch Strip */}
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3 py-1.5 rounded-lg bg-[#0b0f19] border border-[#1e293b] text-xs font-mono flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-[#10b981]" />
                  <span className="text-slate-400">PC RTC:</span>
                  <span className="text-[#10b981] font-bold">{pcNow.toLocaleTimeString()}</span>
                </div>
                <button
                  type="button"
                  onClick={handleSyncClockNow}
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#06b6d4]/20 border border-[#06b6d4] text-[#06b6d4] hover:bg-[#06b6d4] hover:text-slate-950 transition-colors cursor-pointer"
                >
                  Sync BCD Clock Now
                </button>
                <div className="inline-flex rounded-lg bg-[#0b0f19] p-1 border border-[#1e293b] text-xs font-mono">
                  {[
                    { m: 0, label: 'Mode 0: Clock' },
                    { m: 1, label: 'Mode 1: Slot 0' },
                    { m: 2, label: 'Mode 2: Slot 1' },
                  ].map((item) => (
                    <button
                      key={item.m}
                      type="button"
                      onClick={() => handleUpdateRgbConfig({ activeScreenMode: item.m })}
                      className={`px-2.5 py-1 rounded cursor-pointer ${
                        configState.activeScreenMode === item.m
                          ? 'bg-[#06b6d4] text-slate-950 font-bold'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleFlashBeyondApplet('wpm')}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
                >
                  ⚡ Flash {liveWpm} WPM OSD
                </button>
                <button
                  type="button"
                  onClick={() => handleFlashBeyondApplet('pomodoro')}
                  className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-amber-300 hover:border-[#f59e0b] cursor-pointer"
                >
                  ⏱️ Flash Pomodoro ({String(Math.floor(pomodoroSeconds / 60)).padStart(2, '0')}:
                  {String(pomodoroSeconds % 60).padStart(2, '0')})
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Cyberpunk Telemetry HUD Generator */}
              <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-white">
                    📊 Cyberpunk Telemetry HUD Generator
                  </h2>
                  <p className="text-xs text-slate-400">
                    Customize or stream live Windows CPU %, DDR5 RAM, Uptime, and Now-Playing track
                    onto the 240×135 TFT screen.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setLivePcTelemetry((v) => !v)}
                  className={`px-3 py-1.5 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer shrink-0 ${
                    livePcTelemetry && bridgeAvailable
                      ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981] font-bold'
                      : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#06b6d4]'
                  }`}
                >
                  {bridgeAvailable && livePcTelemetry
                    ? 'LIVE WINDOWS TELEMETRY: ON'
                    : `Live PC Sync: ${livePcTelemetry ? 'POLLING' : 'MANUAL'}`}
                </button>
              </div>

              {bridgeAvailable && livePcTelemetry && (
                <div className="grid grid-cols-3 gap-2 text-[11px] font-mono bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3 py-2 text-slate-300">
                  <div>
                    UPTIME: <span className="text-[#06b6d4]">{telemetry.uptimeStr}</span>
                  </div>
                  <div>
                    RAM:{' '}
                    <span className="text-[#8b5cf6]">
                      {telemetry.ramUsedGb}/{telemetry.ramTotalGb} GB
                    </span>
                  </div>
                  <div className="truncate text-right">
                    CPU: <span className="text-[#10b981]">{telemetry.cpuPercent}%</span>
                  </div>
                </div>
              )}

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
                      setLivePcTelemetry(false);
                      setTelemetry(next);
                      setActivePreviewAnim('cyber-hud');
                      setCustomPreviewFrames([]);
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
                        ramUsedGb: Number(((pct / 100) * telemetry.ramTotalGb).toFixed(1)),
                      };
                      setLivePcTelemetry(false);
                      setTelemetry(next);
                      setActivePreviewAnim('cyber-hud');
                      setCustomPreviewFrames([]);
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
                    onChange={(e) => {
                      setLivePcTelemetry(false);
                      setTelemetry((prev) => ({ ...prev, trackTitle: e.target.value }));
                    }}
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
                    onChange={(e) => {
                      setLivePcTelemetry(false);
                      setTelemetry((prev) => ({ ...prev, trackArtist: e.target.value }));
                    }}
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
          </div>
        )}

        {/* =====================================================================
            TAB 6: 🎨 CUSTOM GIF UPLOADER + 240×135 PIXEL ART & TIMELINE STUDIO
           ===================================================================== */}
        {activeTab === 'uploader' && (
          <div className="space-y-6">
            <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-white">
                    Custom PNG / JPG / GIF Hardware Uploader (240×135 Letterbox & RGB565 Quantizer)
                  </h2>
                  <p className="text-xs text-slate-400">
                    Automatically scales and centers any local image onto 240×135, decodes up to 36
                    animated GIF frames, applies Floyd-Steinberg dithering, and opens in the Pixel
                    Painter & Timeline below.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
                <label className="border-2 border-dashed border-[#1e293b] hover:border-[#06b6d4] rounded-xl p-8 bg-[#0b0f19] flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
                  <Upload className="w-8 h-8 text-[#06b6d4] mb-3" />
                  <span className="text-sm font-semibold text-white">
                    Click to choose a PNG, JPG, WebP, or Animated GIF file
                  </span>
                  <span className="text-xs text-slate-400 mt-1">
                    {uploadedFileName
                      ? `${uploadedFileName}${uploadedSourceInfo ? ` · ${uploadedSourceInfo}` : ''}`
                      : 'Auto-letterboxed to 240×135 · Multi-Frame GIF & Big-Endian RGB565 (65,536B padded)'}
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
                      onClick={async () => {
                        const framesToFlash =
                          uploadedFrames.length > 0
                            ? uploadedFrames
                            : customPreviewFrames.length > 0
                            ? customPreviewFrames
                            : customPreviewImageData
                            ? [customPreviewImageData]
                            : [];
                        if (framesToFlash.length === 0) {
                          setStatusLog(
                            'Select an image/GIF file first, or paint a custom frame below.'
                          );
                          return;
                        }
                        const res = await hidEngineRef.current?.uploadFramesToLcd(
                          framesToFlash,
                          targetSlot,
                          configState,
                          (info) => setUploadProgress(info),
                          useFloydSteinbergDither
                        );
                        applyPostUploadState(
                          res,
                          `Flashed ${framesToFlash.length} custom frame(s) to Slot ${targetSlot}`
                        );
                      }}
                      className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                    >
                      Flash{' '}
                      {uploadedFrames.length > 1
                        ? `${uploadedFrames.length}-Frame GIF`
                        : 'Custom Frame'}{' '}
                      to Slot {targetSlot}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Integrated 240x135 Pixel Art Painter & Multi-Frame SPI Timeline Editor */}
            <TftScreenPainterAndTimeline
              frames={
                uploadedFrames.length > 0
                  ? uploadedFrames
                  : customPreviewFrames.length > 0
                  ? customPreviewFrames
                  : customPreviewImageData
                  ? [customPreviewImageData]
                  : []
              }
              onUpdateFrames={(nextFrames, msg) => {
                setUploadedFrames(nextFrames);
                setCustomPreviewFrames(nextFrames);
                setCustomPreviewImageData(nextFrames[0] || null);
                if (msg) setStatusLog(msg);
              }}
              onFlashFrames={async (framesToFlash, label) => {
                const res = await hidEngineRef.current?.uploadFramesToLcd(
                  framesToFlash,
                  targetSlot,
                  configState,
                  (info) => setUploadProgress(info),
                  useFloydSteinbergDither
                );
                applyPostUploadState(res, `Flashed ${label} to Slot ${targetSlot}`);
              }}
              frameDurationMs={configState.frameDurationMs || 100}
              onChangeFrameDurationMs={(ms) => handleUpdateRgbConfig({ frameDurationMs: ms })}
              useFloydSteinbergDither={useFloydSteinbergDither}
              onToggleDither={() => setUseFloydSteinbergDither((v) => !v)}
              targetSlot={targetSlot}
              onSelectSlot={setTargetSlot}
            />
          </div>
        )}

        {/* =====================================================================
            TAB 7: 💡 RGB & UNDERGLOW STUDIO (Full 19-Mode Matrix + 360° Halo + Reactive Engines)
           ===================================================================== */}
        {activeTab === 'rgb' && (
          <RgbUnderglowStudio
            configState={configState}
            rawHardwareConfig={
              hidEngineRef.current?.getRawConfigBuffer() || new Uint8Array(48)
            }
            onUpdateRgbConfig={handleUpdateRgbConfig}
            pressedKeyIds={pressedKeyIds}
            liveWpm={liveWpm}
            telemetry={telemetry}
            activePreviewAnim={activePreviewAnim}
            lcdCustom={lcdCustom}
            onSyncLcdTheme={async (animId, tintHex, flashImmediately) => {
              setCustomPreviewFrames([]);
              setCustomPreviewImageData(null);
              setActivePreviewAnim(animId);
              setLcdCustom((prev) => ({
                ...prev,
                accentColor: tintHex,
              }));
              if (flashImmediately) {
                await handleFlashProcedural(animId, 12);
              } else {
                setStatusLog(
                  `Ambilight LCD Sync → Paired 240×135 screen with "${animId}" (${tintHex.toUpperCase()})`
                );
              }
            }}
            targetSlot={targetSlot}
            onStatusLog={setStatusLog}
          />
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
        </main>
      </div>
    </div>
  );
}
