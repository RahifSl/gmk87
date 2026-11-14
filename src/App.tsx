import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import {
  Keyboard,
  Clock,
  Sparkles,
  Sliders,
  BookOpen,
  Film,
  Usb,
  Play,
  Pause,
  Zap,
  FlaskConical,
  Gauge,
  Palette,
  PictureInPicture2,
  Eye,
  Activity,
  Wrench,
} from 'lucide-react';
import {
  Gmk87HidEngine,
  Gmk87ConfigState,
  UploadProgressInfo,
  ViaBatchEntry,
  LCD_WIDTH,
  LCD_HEIGHT,
  MIN_FRAME_DURATION_MS,
} from './services/gmk87Hid';
import {
  GMK87_PHYSICAL_KEYS,
  getKeycodeLabel,
  createDefaultKeymap,
  getPokemonSpriteUrl,
} from './data/gmk87KeymapData';
import {
  ProceduralAnimId,
  LcdCustomizationOptions,
  DEFAULT_LCD_CUSTOMIZATION,
  TelemetryHudMetrics,
  drawProceduralAnimationFrame,
  generateProceduralFrames,
  quantizeImageDataToRGB565Preview,
  renderSmartKnobOsdFrame,
  renderPokemonLcdFrame,
} from './utils/lcdGenerators';
import {
  decodeImageOrGifBuffer,
  fetchAndDecodeExternalGif,
} from './utils/gifDecoder';
import {
  KeycapThemeId,
  TabId,
  WebGifItem,
  SmartKnobMode,
  PomodoroState,
  computePomodoroRemainingSeconds,
} from './data/studioPresets';

const KeymapStudioTab = React.lazy(() => import('./components/KeymapStudioTab'));
const GifVaultTab = React.lazy(() => import('./components/GifVaultTab'));
const InteractiveShortcutTrainer = React.lazy(
  () => import('./components/InteractiveShortcutTrainer')
);
const ClockAndProfilesTab = React.lazy(() => import('./components/ClockAndProfilesTab'));
const TelemetryAndAudioTab = React.lazy(() => import('./components/TelemetryAndAudioTab'));
const CustomUploaderTab = React.lazy(() => import('./components/CustomUploaderTab'));
const RgbUnderglowStudio = React.lazy(() => import('./components/RgbUnderglowStudio'));
const SmartKnobTab = React.lazy(() => import('./components/SmartKnobTab'));
const BeyondZuoyaLabTab = React.lazy(() => import('./components/BeyondZuoyaLabTab'));
const HardwareDiagnosticModal = React.lazy(
  () => import('./components/HardwareDiagnosticModal')
);

function TabLoadingFallback() {
  return (
    <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-10 flex items-center justify-center">
      <div className="flex items-center gap-3 text-xs font-mono text-cyan-300">
        <span className="w-2.5 h-2.5 rounded-full bg-[#06b6d4] animate-pulse" />
        Loading Studio Module...
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('keymap');

  // Hardware Config State (48/64-byte buffer fields)
  const [configState, setConfigState] = useState<Gmk87ConfigState>(() => ({
    lightingEffect: 1, // Wave
    brightness: 4, // 0-4
    speed: 2, // 0 (slowest) .. 4 (fastest)
    effectDirection: 0, // 0 = Forward, 1 = Reverse
    rainbowMode: 0, // 0 = Single Hue, 1 = Rainbow
    rgbHueR: 6,
    rgbHueG: 182,
    rgbHueB: 212,
    logoMode: 0, // 0-4
    logoBrightness: 4, // 0-4
    logoRainbow: 0, // 0 or 1
    logoColor: 0, // 0-8
    activeScreenMode: 1, // Slot 0
    slot0FrameCount: 1,
    slot1FrameCount: 12,
    frameDurationMs: 100,
    clockDate: new Date(),
  }));
  const configStateRef = useRef<Gmk87ConfigState>(configState);
  configStateRef.current = configState;

  // HID Engine instance (USB Bridge Worker Thread + WebHID + Simulation)
  const hidEngineRef = useRef<Gmk87HidEngine | null>(null);
  if (!hidEngineRef.current) {
    hidEngineRef.current = new Gmk87HidEngine(configState);
  }
  const [rawHardwareConfig, setRawHardwareConfig] = useState<Uint8Array>(
    () => hidEngineRef.current?.getRawConfigBuffer() || new Uint8Array(48)
  );
  const configWriteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const configWriteInFlightRef = useRef<boolean>(false);
  const configWritePendingRef = useRef<boolean>(false);
  const configWriteWaitersRef = useRef<Array<() => void>>([]);
  const manualDisconnectRef = useRef<boolean>(false);

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

  // Live 240x135 Hardware LCD Mini-Monitors + Persistent Offscreen Buffer
  const monitorCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const inChassisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const headerMiniCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pipCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const offscreenMonitorCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [monitorExpanded, setMonitorExpanded] = useState(false);
  const [floatingPipMonitor, setFloatingPipMonitor] = useState(false);
  const [diagnosticOpen, setDiagnosticOpen] = useState(false);
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

  // Tab 1: Keymap & NKRO Matrix Tester State
  const [keymap, setKeymap] = useState<number[][][]>(() => createDefaultKeymap());
  const keymapRef = useRef<number[][][]>(keymap);
  keymapRef.current = keymap;
  const defaultKeymapRef = useRef<number[][][]>(createDefaultKeymap());
  const [activeLayer, setActiveLayer] = useState<number>(0);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('r7c0');
  const [pressedKeyIds, setPressedKeyIds] = useState<Set<string>>(() => new Set());
  const [actuationCount, setActuationCount] = useState<number>(0);

  // Tab 2: Screen Customizer, Web GIF Search & Pokémon Cache State
  const [lcdCustom, setLcdCustom] = useState<LcdCustomizationOptions>(DEFAULT_LCD_CUSTOMIZATION);
  const [webGifQuery, setWebGifQuery] = useState<string>('cyberpunk neon');
  const [webGifPage, setWebGifPage] = useState<number>(0);
  const [webGifResults, setWebGifResults] = useState<WebGifItem[]>([]);
  const [webGifLoading, setWebGifLoading] = useState<boolean>(false);
  const [webGifError, setWebGifError] = useState<string>('');
  const [flashingWebGifId, setFlashingWebGifId] = useState<string | null>(null);
  const pokemonImagesCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const webGifReqIdRef = useRef<number>(0);
  const webGifAbortRef = useRef<AbortController | null>(null);

  // Tab 4: Clock Offset & 15-Min Auto Sync (Isolated 1s UI clock lives inside ClockAndProfilesTab)
  const [hwClockOffsetMs, setHwClockOffsetMs] = useState<number>(0);
  const [autoSync15Min, setAutoSync15Min] = useState<boolean>(() =>
    typeof window !== 'undefined' && Boolean((window as any).gmk87Electron?.isDesktopApp)
  );

  // Tab 5: Telemetry HUD + Web Audio API Spectrum Refs
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
  const telemetryRef = useRef<TelemetryHudMetrics>(telemetry);
  telemetryRef.current = telemetry;

  const [livePcTelemetry, setLivePcTelemetry] = useState<boolean>(true);
  const [autoStreamHud5s, setAutoStreamHud5s] = useState(false);
  const [spectrumDemoRunning, setSpectrumDemoRunning] = useState(true);
  const [micActive, setMicActive] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const liveSpectrumValuesRef = useRef<number[]>(new Array(24).fill(0.25));

  // Tab 6: Custom Uploader State
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFrames, setUploadedFrames] = useState<ImageData[]>([]);
  const [uploadedSourceInfo, setUploadedSourceInfo] = useState<string>('');

  // Tab 8: Smart Knob Multi-Engine
  const [activeKnobModeId, setActiveKnobModeId] = useState<string>('volume');

  // Tab 9: Beyond-Zuoya Lab (Live WPM + Timestamp-based Pomodoro State — 0 root ticks)
  const [typingTestText, setTypingTestText] = useState('');
  const [liveWpm, setLiveWpm] = useState(88);
  const keystrokeTimestampsRef = useRef<number[]>([]);
  const [pomodoroState, setPomodoroState] = useState<PomodoroState>({
    running: false,
    targetEndMs: 0,
    pausedSeconds: 25 * 60,
  });

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

  // Unified USB Bridge + WebHID Connection Synchronizer + Auto-Reconnect + Unplug Detection
  useEffect(() => {
    const engine = hidEngineRef.current;
    if (!engine) return;
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;
    let attachedInSession = false;

    let autoRepairedInSession = false;

    const applyConnectedState = async (
      res: Awaited<ReturnType<Gmk87HidEngine['checkBridgeStatus']>>,
      loadViaKeymap: boolean
    ) => {
      if (cancelled) return;
      if (typeof res.bridgeAvailable === 'boolean') {
        setBridgeAvailable(res.bridgeAvailable);
      }
      setIsConnected(res.connected);
      setTransportMode(res.mode);
      setConnectedDeviceLabel(res.deviceName);
      setViaProtocol(res.viaProtocol || 9);
      setStatusLog(res.message);

      let needsAutoRepair = false;
      if (res.config) {
        configStateRef.current = res.config;
        setConfigState(res.config);
        const raw = engine.getRawConfigBuffer();
        setRawHardwareConfig(raw);
        setHwClockOffsetMs(res.config.clockDate.getTime() - Date.now());
        if (
          res.connected &&
          (raw[0] !== 0x01 || raw.subarray(9, 28).some((b) => b !== 0x00))
        ) {
          needsAutoRepair = true;
        }
      }

      if (loadViaKeymap && res.viaConnected) {
        const viaRes = await engine.readViaKeymapBuffer().catch(() => null);
        if (!cancelled && viaRes?.keymap) {
          setKeymap(viaRes.keymap);
          setViaProtocol(viaRes.viaProtocol || 9);
          setLastViaPacketHex(viaRes.lastCmdHex);
          if (viaRes.mangledDetected) {
            needsAutoRepair = true;
          }
        }
      }

      if (needsAutoRepair && !autoRepairedInSession && !cancelled) {
        autoRepairedInSession = true;
        setStatusLog(
          'Detected corrupted GMK87 EEPROM / VIA keymap — auto-repairing cfg[0]=0x01, clearing cfg[9..27], and restoring factory keys...'
        );
        const repairRes = await engine
          .repairKeyboardKeysAndConfig(configStateRef.current)
          .catch(() => null);
        if (!cancelled && repairRes?.success) {
          configStateRef.current = repairRes.config;
          setConfigState(repairRes.config);
          setRawHardwareConfig(repairRes.rawConfig);
          setKeymap(repairRes.keymap);
          setStatusLog(repairRes.message);
        }
      }
    };

    const syncFromBridge = async (forceRefresh: boolean, lightOnly: boolean) => {
      if (cancelled) return;
      if (manualDisconnectRef.current && !forceRefresh) return;

      const res = await engine.checkBridgeStatus(forceRefresh, lightOnly);
      if (cancelled) return;

      if (typeof res.bridgeAvailable === 'boolean') {
        setBridgeAvailable(res.bridgeAvailable);
      }

      if (res.mode === 'bridge' || res.connected) {
        const wasOffline = !attachedInSession;
        attachedInSession = true;

        // If light probe detected newly attached USB bridge, upgrade to full config + VIA load
        if (lightOnly && (wasOffline || !res.config)) {
          const fullRes = await engine.checkBridgeStatus(true, false);
          if (!cancelled && fullRes.connected) {
            await applyConnectedState(fullRes, true);
          }
          return;
        }

        await applyConnectedState(res, forceRefresh || wasOffline);
        return;
      }

      // Bridge detached or absent
      if (attachedInSession) {
        attachedInSession = false;
        setIsConnected(false);
        setTransportMode('simulation');
        setStatusLog(res.message || 'Zuoya GMK87 USB detached — Standby Mode');
      } else if (res.bridgeAvailable) {
        setStatusLog(res.message);
      }

      // If running without local USB bridge, attempt silent WebHID auto-reconnect to paired device
      if (!res.bridgeAvailable && !manualDisconnectRef.current && engine.isWebHidSupported()) {
        const webRes = await engine.tryAutoReconnectWebHid();
        if (!cancelled && webRes?.connected) {
          attachedInSession = true;
          await applyConnectedState(webRes, true);
        }
      }
    };

    engine.setHardwareChangeListener((evt) => {
      if (cancelled) return;
      if (evt.type === 'disconnect') {
        attachedInSession = false;
        setIsConnected(false);
        setTransportMode(engine.isBridgeActive() ? 'bridge' : 'simulation');
        setStatusLog(`USB disconnected: ${evt.deviceName || 'Zuoya GMK87'}. Simulation Mode active.`);
      } else if (evt.type === 'connect') {
        manualDisconnectRef.current = false;
        if (!engine.isBridgeActive()) {
          void engine.tryAutoReconnectWebHid().then((webRes) => {
            if (!cancelled && webRes?.connected) {
              attachedInSession = true;
              void applyConnectedState(webRes, true);
            }
          });
        } else {
          void syncFromBridge(true, false);
        }
      }
    });

    const electronBridge = (window as any).gmk87Electron;
    const unsubUsb = electronBridge?.onUsbStateChange?.((usb: any) => {
      if (cancelled) return;
      if (!usb?.detected) {
        attachedInSession = false;
        manualDisconnectRef.current = false;
        setIsConnected(false);
        setTransportMode('simulation');
        setStatusLog('Zuoya GMK87 USB detached — Standby Mode');
      } else {
        manualDisconnectRef.current = false;
        void syncFromBridge(true, false);
      }
    });

    const startPolling = () => {
      if (timer) return;
      timer = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        if (manualDisconnectRef.current) return;
        // Skip HTTP polling when connected via pure browser WebHID
        if (attachedInSession && engine.getTransportMode() === 'webhid') return;
        void syncFromBridge(false, true);
      }, 4000);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        stopPolling();
      } else {
        startPolling();
        if (!manualDisconnectRef.current) {
          void syncFromBridge(false, true);
        }
      }
    };

    void syncFromBridge(true, false);
    if (typeof document === 'undefined' || !document.hidden) {
      startPolling();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      engine.setHardwareChangeListener(null);
      if (typeof unsubUsb === 'function') unsubUsb();
    };
  }, []);

  // Demand-gated live Windows CPU/RAM/Now Playing telemetry polling
  const needsTelemetryPolling =
    livePcTelemetry &&
    (activeTab === 'telemetry' ||
      activeTab === 'rgb' ||
      autoStreamHud5s ||
      activePreviewAnim === 'cyber-hud');

  useEffect(() => {
    if (!needsTelemetryPolling) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    const pollTelemetry = async () => {
      if (!active || (typeof document !== 'undefined' && document.hidden)) return;
      try {
        const resp = await fetch('/api/system-telemetry', { signal: AbortSignal.timeout(2500) });
        const ct = resp.headers.get('content-type') || '';
        if (!resp.ok || !ct.includes('application/json')) {
          if (timer) {
            clearInterval(timer);
            timer = null;
          }
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
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      }
    };

    const syncTicker = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        if (timer) {
          clearInterval(timer);
          timer = null;
        }
      } else if (!timer) {
        void pollTelemetry();
        timer = setInterval(pollTelemetry, 3000);
      }
    };

    syncTicker();
    document.addEventListener('visibilitychange', syncTicker);
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', syncTicker);
    };
  }, [needsTelemetryPolling]);

  // Search Endless Web GIFs across all categories via /api/gifs/search
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

  // Load initial Web GIF search batch when opening GIF Vault for the first time
  useEffect(() => {
    if (activeTab === 'gifs' && webGifResults.length === 0 && !webGifLoading && !webGifError) {
      void handleSearchWebGifs(webGifQuery, 0, false);
    }
  }, [activeTab, webGifResults.length, webGifLoading, webGifError, webGifQuery, handleSearchWebGifs]);

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
        configStateRef.current = res.config;
        setConfigState(res.config);
      }
      setRawHardwareConfig(hidEngineRef.current.getRawConfigBuffer());
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
      void handleSyncClockNow();
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
      Home: 'r5c4',
      End: 'r5c5',
      PageUp: 'r3c14',
      PageDown: 'r5c6',
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
      ShiftRight: 'r4c13',
      ArrowUp: 'r4c14',
      ControlLeft: 'r5c0',
      MetaLeft: 'r5c1',
      AltLeft: 'r5c2',
      Space: 'r5c8',
      AltRight: 'r5c9',
      ContextMenu: 'r5c11',
      ControlRight: 'r5c12',
      ArrowLeft: 'r5c13',
      ArrowDown: 'r5c14',
      ArrowRight: 'r5c7',
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

  // Unmount cleanup for coalesced USB writes, pending fetches, & microphone AudioContext
  useEffect(() => {
    return () => {
      if (configWriteTimerRef.current) {
        clearTimeout(configWriteTimerRef.current);
        configWriteTimerRef.current = null;
      }
      webGifAbortRef.current?.abort();
      micStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioContextRef.current?.close().catch(() => {});
    };
  }, []);

  // Persistent Offscreen 240x135 Hardware Monitor + Embedded In-Chassis Screen Animation Loop
  useEffect(() => {
    let frameCount = 0;
    let interval: ReturnType<typeof setInterval> | null = null;

    if (!offscreenMonitorCanvasRef.current && typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = LCD_WIDTH;
      canvas.height = LCD_HEIGHT;
      offscreenMonitorCanvasRef.current = canvas;
    }

    const renderFrame = (advanceFrame: boolean) => {
      if (typeof document !== 'undefined' && document.hidden) return;
      if (advanceFrame && !isAnimPaused) {
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
        const offscreen = offscreenMonitorCanvasRef.current;
        if (!offscreen) return;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return;
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
    };

    const syncMonitorLoop = () => {
      const hidden = typeof document !== 'undefined' && document.hidden;
      if (hidden || isAnimPaused) {
        if (interval) {
          clearInterval(interval);
          interval = null;
        }
        if (!hidden) renderFrame(false);
      } else {
        renderFrame(false);
        if (!interval) {
          interval = setInterval(() => renderFrame(true), 110);
        }
      }
    };

    syncMonitorLoop();
    document.addEventListener('visibilitychange', syncMonitorLoop);
    return () => {
      if (interval) clearInterval(interval);
      document.removeEventListener('visibilitychange', syncMonitorLoop);
    };
  }, [
    activePreviewAnim,
    customPreviewFrames,
    customPreviewImageData,
    telemetry,
    useFloydSteinbergDither,
    lcdCustom,
    isAnimPaused,
    monitorExpanded,
    floatingPipMonitor,
    activeTab,
  ]);

  // Auto-stream Telemetry HUD every 5s when enabled & visible
  useEffect(() => {
    if (!autoStreamHud5s) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const curTelemetry = telemetryRef.current;
      const frames = generateProceduralFrames('cyber-hud', 1, curTelemetry, undefined, lcdCustom);
      setCustomPreviewFrames([]);
      setCustomPreviewImageData(frames[0]);
      hidEngineRef.current
        ?.uploadFramesToLcd(
          frames,
          targetSlot,
          configStateRef.current,
          (info) => {
            setUploadProgress(info);
          },
          useFloydSteinbergDither
        )
        .then((res) => {
          if (res?.config) {
            configStateRef.current = res.config;
            setConfigState(res.config);
            if (hidEngineRef.current) {
              setRawHardwareConfig(hidEngineRef.current.getRawConfigBuffer());
            }
            if (hidEngineRef.current?.isConnected()) setHwClockOffsetMs(0);
          }
        });
    }, 5000);
    return () => clearInterval(timer);
  }, [autoStreamHud5s, lcdCustom, targetSlot, useFloydSteinbergDither]);

  // Connect / Disconnect USB Handler
  const handleConnectWebHid = async () => {
    const engine = hidEngineRef.current;
    if (!engine) return;
    if (isConnected) {
      manualDisconnectRef.current = true;
      await engine.disconnect();
      setIsConnected(false);
      setTransportMode('simulation');
      setStatusLog('Disconnected from hardware. Running in Simulation Mode.');
      return;
    }

    manualDisconnectRef.current = false;
    const res = await engine.connect();
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
      configStateRef.current = res.config;
      setConfigState(res.config);
      setRawHardwareConfig(engine.getRawConfigBuffer());
      setHwClockOffsetMs(res.config.clockDate.getTime() - Date.now());
    }
    if (res.viaConnected) {
      const viaRes = await engine.readViaKeymapBuffer();
      if (viaRes.keymap) {
        setKeymap(viaRes.keymap);
        setViaProtocol(viaRes.viaProtocol || 9);
        setLastViaPacketHex(viaRes.lastCmdHex);
      }
    }
  };

  const applyPostUploadState = useCallback(
    (
      res: { success: boolean; config?: Gmk87ConfigState; error?: string } | undefined,
      successMsg: string
    ) => {
      if (res?.config) {
        configStateRef.current = res.config;
        setConfigState(res.config);
        if (hidEngineRef.current) {
          setRawHardwareConfig(hidEngineRef.current.getRawConfigBuffer());
        }
        if (hidEngineRef.current?.isConnected()) {
          setHwClockOffsetMs(0);
        }
      }
      if (res && !res.success) {
        setStatusLog(`Upload failed: ${res.error || 'HID write error'}`);
      } else {
        setStatusLog(successMsg);
      }
    },
    []
  );

  // Flash Procedural Animation to GMK87
  const handleFlashProcedural = async (animId: ProceduralAnimId, frameCount = 12) => {
    setCustomPreviewFrames([]);
    setCustomPreviewImageData(null);
    setActivePreviewAnim(animId);
    const frames = generateProceduralFrames(
      animId,
      frameCount,
      telemetryRef.current,
      liveSpectrumValuesRef.current,
      lcdCustom
    );
    const res = await hidEngineRef.current?.uploadFramesToLcd(
      frames,
      targetSlot,
      configStateRef.current,
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
    shiny: boolean,
    flashImmediately: boolean
  ) => {
    const url = getPokemonSpriteUrl(id, shiny);
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

    const frames: ImageData[] = [];
    for (let f = 0; f < 8; f++) {
      frames.push(
        renderPokemonLcdFrame(id, name, typeLabel, accentColor, shiny, img, f, lcdCustom)
      );
    }

    setCustomPreviewFrames(frames);
    setCustomPreviewImageData(frames[0]);
    if (flashImmediately) {
      const res = await hidEngineRef.current?.uploadFramesToLcd(
        frames,
        targetSlot,
        configStateRef.current,
        (info) => {
          setUploadProgress(info);
        },
        useFloydSteinbergDither
      );
      applyPostUploadState(
        res,
        `Flashed #${id} ${shiny ? 'Shiny ' : ''}${name} (${lcdCustom.pokemonLayout}, 8 frames) to Slot ${targetSlot}`
      );
    } else {
      setStatusLog(
        `Previewing #${id} ${shiny ? 'Shiny ' : ''}${name} (${lcdCustom.pokemonLayout}) on 240×135 monitor`
      );
    }
  };

  // Preview or Flash Endless Web GIF Search Result
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
          configStateRef.current,
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

  // Import Direct GIF/Image URL
  const handleImportGifUrl = async (url: string, flash: boolean) => {
    const targetUrl = url.trim();
    if (!targetUrl) return;

    setStatusLog(`Fetching & decoding external URL (${targetUrl.slice(0, 48)})...`);
    try {
      const decoded = await fetchAndDecodeExternalGif(targetUrl, lcdCustom);
      setCustomPreviewFrames(decoded.frames);
      setCustomPreviewImageData(decoded.frames[0] || null);
      if (flash && decoded.frames.length > 0) {
        const res = await hidEngineRef.current?.uploadFramesToLcd(
          decoded.frames,
          targetSlot,
          configStateRef.current,
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

  // Assign Single Keycode in VIA (Command 0x05)
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
        `VIA 0x05 Set Keycode: Layer ${activeLayer} [${keyDef.row},${keyDef.col}] (${
          keyDef.label
        }) → ${getKeycodeLabel(code, viaProtocol)} (0x${code
          .toString(16)
          .toUpperCase()
          .padStart(4, '0')})`
      );
    }
  };

  // Batch Apply Imported Profile / Reset Default directly to VIA EEPROM via Worker
  const handleBatchApplyKeymap = async (
    nextKeymap: number[][][],
    _themeHint?: KeycapThemeId,
    label?: string
  ) => {
    const prevKeymap = keymapRef.current;
    const diffEntries: ViaBatchEntry[] = [];
    for (let layer = 0; layer < 4; layer++) {
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 15; col++) {
          const nextCode = nextKeymap[layer]?.[row]?.[col];
          const prevCode = prevKeymap[layer]?.[row]?.[col];
          if (typeof nextCode === 'number' && nextCode !== prevCode) {
            diffEntries.push({ layer, row, col, keycode: nextCode & 0xffff });
          }
        }
      }
    }

    setKeymap(nextKeymap.map((layer) => layer.map((row) => [...row])));
    const engine = hidEngineRef.current;
    if (!engine || diffEntries.length === 0) {
      setStatusLog(
        `${label || 'Keymap'} applied (${diffEntries.length} keycode diff(s) across 4 layers).`
      );
      return;
    }

    const res = await engine.batchSetViaKeycodes(diffEntries);
    if (res.lastPacketHex) {
      setLastViaPacketHex(res.lastPacketHex);
    }
    setStatusLog(
      res.hardwareApplied
        ? `${label || 'Keymap'}: Batch-programmed ${res.appliedCount} VIA keycode(s) to keyboard EEPROM`
        : `${label || 'Keymap'}: Updated studio matrix (${diffEntries.length} diff(s); connect USB to flash EEPROM)`
    );
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

  // 1-Click Hardware Key & EEPROM Sanitizer (fixes mangled physical keys on PID 0x5055)
  const handleRepairMangledKeys = async () => {
    const engine = hidEngineRef.current;
    if (!engine) return;
    setStatusLog(
      'Repairing mangled keys: restoring PID 0x5055 cfg[0]=0x01, wiping cfg[9..27]=0x00, and flashing all 4 VIA layers...'
    );
    const res = await engine.repairKeyboardKeysAndConfig(configStateRef.current);
    configStateRef.current = res.config;
    setConfigState(res.config);
    setRawHardwareConfig(res.rawConfig);
    setKeymap(res.keymap);
    setIsConnected(Boolean(engine.isConnected()));
    setTransportMode(engine.getTransportMode());
    setConnectedDeviceLabel(engine.getConnectedDeviceName());
    if (res.packetHex) {
      setLastViaPacketHex(res.packetHex);
      setUploadProgress((prev) => ({
        ...prev,
        lastPacketHex: res.packetHex,
        message: res.message,
      }));
    }
    setStatusLog(res.message);
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
        'Microphone permission declined or unavailable — running 24-Band Demo Synth.'
      );
    }
  };

  // Handle Local Image/GIF File Upload in Tab 6 (decodes up to 36 composite animated GIF frames)
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

  // Coalesced single-flight HID EEPROM config flush
  const flushHardwareConfigWrite = useCallback(async () => {
    const engine = hidEngineRef.current;
    if (!engine) {
      const drained = configWriteWaitersRef.current.splice(0);
      drained.forEach((fn) => fn());
      return;
    }
    if (configWriteInFlightRef.current) {
      configWritePendingRef.current = true;
      return;
    }
    configWriteInFlightRef.current = true;
    try {
      do {
        configWritePendingRef.current = false;
        const snapshot: Gmk87ConfigState = {
          ...configStateRef.current,
          clockDate: new Date(),
        };
        const pktHex = await engine.writeConfig(snapshot);
        setRawHardwareConfig(engine.getRawConfigBuffer());
        if (engine.isConnected()) {
          setHwClockOffsetMs(0);
        }
        setUploadProgress((prev) => ({
          ...prev,
          lastPacketHex: pktHex,
          message: `Updated Config: Mode=${snapshot.activeScreenMode}, Effect=0x${snapshot.lightingEffect
            .toString(16)
            .padStart(2, '0')}, Bri=${snapshot.brightness}, Spd=${snapshot.speed}, Dir=${
            snapshot.effectDirection ?? 0
          }, Rnbw=${snapshot.rainbowMode ?? 0}`,
        }));
      } while (configWritePendingRef.current);
    } catch (err: any) {
      setStatusLog(`Hardware config update failed: ${err?.message || 'HID write error'}`);
    } finally {
      configWriteInFlightRef.current = false;
      const drained = configWriteWaitersRef.current.splice(0);
      drained.forEach((fn) => fn());
    }
  }, []);

  const handleUpdateRgbConfig = async (
    partial: Partial<Gmk87ConfigState>,
    previewOnly = false
  ) => {
    const next: Gmk87ConfigState = {
      ...configStateRef.current,
      ...partial,
      clockDate: new Date(),
    };
    if (partial.frameDurationMs !== undefined) {
      next.frameDurationMs = Math.max(MIN_FRAME_DURATION_MS, partial.frameDurationMs);
    }
    configStateRef.current = next;
    setConfigState(next);

    if (partial.activeScreenMode !== undefined) {
      const modeNames = [
        'Default Screen (Mode 0)',
        'Custom Slot 0 (Mode 1)',
        'Custom Slot 1 (Mode 2)',
      ];
      setStatusLog(
        `Switched cfg[33] Active Screen Mode to ${
          modeNames[partial.activeScreenMode] || `Mode ${partial.activeScreenMode}`
        }`
      );
    }

    if (previewOnly) {
      return;
    }

    if (configWriteTimerRef.current) {
      clearTimeout(configWriteTimerRef.current);
      configWriteTimerRef.current = null;
    }

    await new Promise<void>((resolve) => {
      configWriteWaitersRef.current.push(resolve);
      configWriteTimerRef.current = setTimeout(() => {
        configWriteTimerRef.current = null;
        void flushHardwareConfigWrite();
      }, 85);
    });
  };

  // Batch program Smart Knob (single Worker batch call) + flash 240x135 OSD banner
  const handleSelectSmartKnobMode = async (mode: SmartKnobMode) => {
    setActiveKnobModeId(mode.id);
    setKeymap((prev) => {
      const copy = prev.map((l) => l.map((r) => [...r]));
      copy[0][7][0] = mode.ccwCode;
      copy[0][0][14] = mode.clickCode;
      copy[0][7][1] = mode.cwCode;
      return copy;
    });

    if (hidEngineRef.current) {
      const viaRes = await hidEngineRef.current.batchSetViaKeycodes([
        { layer: 0, row: 7, col: 0, keycode: mode.ccwCode },
        { layer: 0, row: 0, col: 14, keycode: mode.clickCode },
        { layer: 0, row: 7, col: 1, keycode: mode.cwCode },
      ]);
      if (viaRes.lastPacketHex) {
        setLastViaPacketHex(viaRes.lastPacketHex);
      }

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
        configStateRef.current,
        (info) => {
          setUploadProgress(info);
        },
        useFloydSteinbergDither
      );
      applyPostUploadState(
        res,
        `Smart Knob Engine → ${mode.title}: Batch-wrote VIA Layer 0 [7,0]=${mode.ccwLabel}, [0,14]=${mode.clickLabel}, [7,1]=${mode.cwLabel} & flashed LCD OSD`
      );
      return;
    }

    setStatusLog(
      `Smart Knob Engine → ${mode.title}: Batch-wrote VIA Layer 0 [7,0]=${mode.ccwLabel}, [0,14]=${mode.clickLabel}, [7,1]=${mode.cwLabel} & flashed LCD OSD`
    );
  };

  // Interactive Typing Speedometer (Tab 9 Beyond-Zuoya Lab)
  const handleTypingInput = (val: string) => {
    setTypingTestText(val);
    const now = performance.now();
    keystrokeTimestampsRef.current.push(now);
    keystrokeTimestampsRef.current = keystrokeTimestampsRef.current.filter((t) => now - t < 10000);
    const charsInWindow = keystrokeTimestampsRef.current.length;
    const computedWpm = Math.min(220, Math.max(25, Math.round((charsInWindow / 5) * 6)));
    setLiveWpm(computedWpm);
  };

  const handleTogglePomodoro = () => {
    setPomodoroState((prev) => {
      if (prev.running) {
        return {
          running: false,
          targetEndMs: 0,
          pausedSeconds: computePomodoroRemainingSeconds(prev),
        };
      }
      const startSecs = prev.pausedSeconds > 0 ? prev.pausedSeconds : 25 * 60;
      return {
        running: true,
        targetEndMs: Date.now() + startSecs * 1000,
        pausedSeconds: startSecs,
      };
    });
  };

  const handleResetPomodoro = () => {
    setPomodoroState({
      running: false,
      targetEndMs: 0,
      pausedSeconds: 25 * 60,
    });
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
      const remSeconds = computePomodoroRemainingSeconds(pomodoroState);
      const mins = String(Math.floor(remSeconds / 60)).padStart(2, '0');
      const secs = String(remSeconds % 60).padStart(2, '0');

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
      ctx.fillText(pomodoroState.running ? 'FOCUS SESSION ACTIVE' : 'READY FOR SPRINT', 54, 104);
    }

    const frame = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
    setCustomPreviewFrames([]);
    setCustomPreviewImageData(frame);
    const res = await hidEngineRef.current?.uploadFramesToLcd(
      [frame],
      targetSlot,
      configStateRef.current,
      (info) => {
        setUploadProgress(info);
      },
      useFloydSteinbergDither
    );
    applyPostUploadState(
      res,
      `Flashed Beyond-Zuoya ${
        mode === 'wpm' ? 'Live WPM Tachometer' : 'Pomodoro Focus Timer'
      } frame to GMK87 LCD`
    );
  };

  const handleFlashCustomFrames = async (framesToFlash: ImageData[], label: string) => {
    const res = await hidEngineRef.current?.uploadFramesToLcd(
      framesToFlash,
      targetSlot,
      configStateRef.current,
      (info) => setUploadProgress(info),
      useFloydSteinbergDither
    );
    applyPostUploadState(res, `Flashed ${label} to Slot ${targetSlot}`);
  };

  const progressPercent =
    uploadProgress.totalBytes > 0
      ? Math.min(100, Math.round((uploadProgress.bytesSent / uploadProgress.totalBytes) * 100))
      : 0;

  const activeLayerModifiedCount = GMK87_PHYSICAL_KEYS.reduce((acc, k) => {
    const cur = keymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
    const def = defaultKeymapRef.current[activeLayer]?.[k.row]?.[k.col] ?? 0;
    return cur !== def ? acc + 1 : acc;
  }, 0);

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
                      targetSlot === 0
                        ? 'bg-[#06b6d4] text-slate-950 font-bold'
                        : 'hover:text-white'
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
              title={
                isAnimPaused ? 'Resume screen animation' : 'Pause screen animation (calm display)'
              }
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
              type="button"
              onClick={handleRepairMangledKeys}
              title="1-Click Hardware Key Repair: Wipes corrupted cfg[9..27], restores cfg[0]=0x01, and flashes factory VIA 4-layer keymap"
              className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-md border border-cyan-400/70 bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-[0_0_12px_rgba(6,182,212,0.25)]"
            >
              <Wrench className="w-3.5 h-3.5 text-cyan-300" />
              <span>REPAIR KEYS</span>
            </button>

            <button
              type="button"
              onClick={async () => {
                const engine = hidEngineRef.current;
                if (!engine) return;
                setStatusLog('Fixing 00:00 Clock & switching LCD to Native Clock Mode (PID 0x5055 ScreenMode=0)...');
                const res = await engine.fixClockAndRestoreNativeMode(configStateRef.current);
                configStateRef.current = res.config;
                setConfigState(res.config);
                setRawHardwareConfig(res.rawConfig);
                setIsConnected(Boolean(engine.isConnected()));
                setTransportMode(engine.getTransportMode());
                setConnectedDeviceLabel(engine.getConnectedDeviceName());
                if (res.success) {
                  setHwClockOffsetMs(0);
                  setUploadProgress((prev) => ({
                    ...prev,
                    lastPacketHex: res.packetHex,
                    message: `Fixed 00:00 Clock → ${res.config.clockDate.toLocaleTimeString()} (${
                      res.usedDirectWebHid ? 'Direct WebHID' : 'USB Bridge'
                    })`,
                  }));
                  setStatusLog(
                    `Fixed 00:00 Clock! Synced BCD RTC & restored ScreenMode=0 (${res.config.clockDate.toLocaleTimeString()})`
                  );
                } else {
                  setStatusLog(`Clock fix failed: ${res.error || 'Connect GMK87 USB first'}`);
                }
              }}
              title="Fix 00:00 Clock & Switch Keyboard LCD to Built-in Native Clock (<1s)"
              className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-md border border-emerald-400/60 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-[0_0_12px_rgba(16,185,129,0.2)]"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-300" />
              <span>FIX 00:00 CLOCK</span>
            </button>

            <button
              type="button"
              onClick={() => setDiagnosticOpen(true)}
              title="Open 1-Click GMK87 Hardware Self-Test & Diagnostic Suite"
              className="px-2.5 py-1.5 text-xs font-mono font-bold rounded-md border border-yellow-400/50 bg-yellow-400/10 text-yellow-300 hover:bg-yellow-400/20 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-yellow-300" />
              <span>TEST KEYBOARD</span>
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
              {isConnected ? 'DISCONNECT' : bridgeAvailable ? 'CONNECT USB' : 'CONNECT GMK87'}
            </button>
          </div>
        </div>
      </header>

      {diagnosticOpen && (
        <Suspense fallback={null}>
          <HardwareDiagnosticModal
            isOpen={diagnosticOpen}
            onClose={() => setDiagnosticOpen(false)}
            hidEngine={hidEngineRef.current}
            configState={configState}
            rawHardwareConfig={rawHardwareConfig}
            onSyncConfigState={(next, raw) => {
              configStateRef.current = next;
              setConfigState(next);
              setRawHardwareConfig(raw);
              setIsConnected(Boolean(hidEngineRef.current?.isConnected()));
              if (hidEngineRef.current) {
                setTransportMode(hidEngineRef.current.getTransportMode());
                setConnectedDeviceLabel(hidEngineRef.current.getConnectedDeviceName());
              }
            }}
            onSyncKeymap={setKeymap}
            onStatusLog={setStatusLog}
          />
        </Suspense>
      )}

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
                  <div className="text-[10px] font-mono text-slate-400">VIA P{viaProtocol} · 1000Hz USB</div>
                </div>
              </div>
              <span
                className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded border ${
                  isConnected
                    ? 'bg-[#10b981]/15 border-[#10b981]/40 text-[#10b981]'
                    : 'bg-[#f59e0b]/15 border-[#f59e0b]/40 text-[#f59e0b]'
                }`}
              >
                {isConnected ? 'ONLINE' : 'STANDBY'}
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
                    badge:
                      activeLayerModifiedCount > 0 ? `${activeLayerModifiedCount} mod` : undefined,
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
                            isActive
                              ? 'text-[#06b6d4]'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-white' : 'text-slate-200'
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ml-1.5 ${item.badgeColor}`}
                        >
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
                            isActive
                              ? 'text-[#06b6d4]'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-white' : 'text-slate-200'
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ml-1.5 ${item.badgeColor}`}
                        >
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
                            isActive
                              ? 'text-[#06b6d4]'
                              : 'text-slate-400 group-hover:text-slate-200'
                          }`}
                        />
                        <div className="min-w-0">
                          <div
                            className={`text-xs font-semibold truncate ${
                              isActive ? 'text-white' : 'text-slate-200'
                            }`}
                          >
                            {item.label}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400 truncate">
                            {item.subtitle}
                          </div>
                        </div>
                      </div>
                      {item.badge && (
                        <span
                          className={`px-1.5 py-0.5 text-[9px] font-mono font-bold rounded border shrink-0 ml-1.5 ${item.badgeColor}`}
                        >
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
                    targetSlot === 0
                      ? 'bg-[#06b6d4] text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setTargetSlot(1)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                    targetSlot === 1
                      ? 'bg-[#8b5cf6] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  1
                </button>
              </div>
            </div>

            <div className="text-[9px] font-mono text-slate-400 flex items-center justify-between">
              <span>VID: 0x320F PID: 0x5055</span>
              <span>WORKER HID</span>
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

          <Suspense fallback={<TabLoadingFallback />}>
            {activeTab === 'keymap' && (
              <KeymapStudioTab
                keymap={keymap}
                defaultKeymap={defaultKeymapRef.current}
                activeLayer={activeLayer}
                onChangeLayer={setActiveLayer}
                selectedKeyId={selectedKeyId}
                onSelectKeyId={setSelectedKeyId}
                viaProtocol={viaProtocol}
                pressedKeyIds={pressedKeyIds}
                actuationCount={actuationCount}
                liveWpm={liveWpm}
                configState={configState}
                activeKnobModeId={activeKnobModeId}
                inChassisCanvasRef={inChassisCanvasRef}
                onAssignKeycode={handleAssignKeycode}
                onBatchApplyKeymap={handleBatchApplyKeymap}
                onReadViaBuffer={handleReadViaBuffer}
                onRepairKeys={handleRepairMangledKeys}
                onReadViaMacros={() => hidEngineRef.current!.readViaMacros()}
                onWriteViaMacros={(macros) => hidEngineRef.current!.writeViaMacros(macros)}
                onSelectSmartKnobMode={handleSelectSmartKnobMode}
                onOpenRgbStudio={() => setActiveTab('rgb')}
                onOpenGifsTab={() => setActiveTab('gifs')}
                onStatusLog={setStatusLog}
              />
            )}

            {activeTab === 'gifs' && (
              <GifVaultTab
                lcdCustom={lcdCustom}
                onChangeLcdCustom={setLcdCustom}
                targetSlot={targetSlot}
                onSelectSlot={setTargetSlot}
                activePreviewAnim={activePreviewAnim}
                customPreviewImageData={customPreviewImageData}
                customPreviewFrames={customPreviewFrames}
                uploadedFrames={uploadedFrames}
                frameDurationMs={configState.frameDurationMs || 100}
                useFloydSteinbergDither={useFloydSteinbergDither}
                webGifQuery={webGifQuery}
                onChangeWebGifQuery={setWebGifQuery}
                webGifPage={webGifPage}
                webGifResults={webGifResults}
                webGifLoading={webGifLoading}
                webGifError={webGifError}
                flashingWebGifId={flashingWebGifId}
                onSearchWebGifs={handleSearchWebGifs}
                onPreviewOrFlashWebGif={handlePreviewOrFlashWebGif}
                onPinProceduralPreview={(animId, title) => {
                  setCustomPreviewFrames([]);
                  setCustomPreviewImageData(null);
                  setActivePreviewAnim(animId);
                  setStatusLog(`Pinned "${title}" to Live 240×135 Hardware LCD Monitor`);
                }}
                onFlashProcedural={handleFlashProcedural}
                onSelectPokemon={handleSelectPokemon}
                onImportGifUrl={handleImportGifUrl}
                onUpdateFrames={(nextFrames, msg) => {
                  setUploadedFrames(nextFrames);
                  setCustomPreviewFrames(nextFrames);
                  setCustomPreviewImageData(nextFrames[0] || null);
                  if (msg) setStatusLog(msg);
                }}
                onFlashFrames={handleFlashCustomFrames}
                onChangeFrameDurationMs={(ms) => void handleUpdateRgbConfig({ frameDurationMs: ms })}
                onToggleDither={() => setUseFloydSteinbergDither((v) => !v)}
              />
            )}

            {activeTab === 'shortcuts' && (
              <InteractiveShortcutTrainer
                configState={configState}
                onUpdateConfig={handleUpdateRgbConfig}
                onSwitchViaLayer={setActiveLayer}
                lastLcdPacketHex={uploadProgress.lastPacketHex}
                lastViaPacketHex={lastViaPacketHex}
                onStatusLog={setStatusLog}
              />
            )}

            {activeTab === 'clock' && (
              <ClockAndProfilesTab
                configState={configState}
                hwClockOffsetMs={hwClockOffsetMs}
                autoSync15Min={autoSync15Min}
                onSyncClockNow={handleSyncClockNow}
                onToggleAutoSync={async () => {
                  const nextVal = !autoSync15Min;
                  setAutoSync15Min(nextVal);
                  const bridge = (window as any).gmk87Electron;
                  if (bridge?.setAutoSyncClock) {
                    const persisted = await bridge.setAutoSyncClock(nextVal).catch(() => nextVal);
                    setAutoSync15Min(Boolean(persisted));
                  }
                  setStatusLog(`15-Minute Auto Clock Sync ${nextVal ? 'ENABLED' : 'DISABLED'}`);
                }}
                onChangeScreenMode={async (mode) => handleUpdateRgbConfig({ activeScreenMode: mode })}
              />
            )}

            {activeTab === 'telemetry' && (
              <TelemetryAndAudioTab
                activeScreenMode={configState.activeScreenMode}
                targetSlot={targetSlot}
                liveWpm={liveWpm}
                pomodoroState={pomodoroState}
                telemetry={telemetry}
                livePcTelemetry={livePcTelemetry}
                bridgeAvailable={bridgeAvailable}
                autoStreamHud5s={autoStreamHud5s}
                spectrumDemoRunning={spectrumDemoRunning}
                micActive={micActive}
                analyserRef={analyserRef}
                liveSpectrumValuesRef={liveSpectrumValuesRef}
                onSyncClockNow={handleSyncClockNow}
                onChangeScreenMode={async (mode) => handleUpdateRgbConfig({ activeScreenMode: mode })}
                onFlashBeyondApplet={handleFlashBeyondApplet}
                onToggleLivePcTelemetry={() => setLivePcTelemetry((v) => !v)}
                onChangeManualTelemetry={(next) => {
                  setLivePcTelemetry(false);
                  setTelemetry(next);
                }}
                onToggleAutoStreamHud5s={() => setAutoStreamHud5s((v) => !v)}
                onToggleSpectrumDemo={() => setSpectrumDemoRunning((v) => !v)}
                onToggleMic={handleToggleMic}
                onFlashProcedural={handleFlashProcedural}
              />
            )}

            {activeTab === 'uploader' && (
              <CustomUploaderTab
                uploadedFileName={uploadedFileName}
                uploadedSourceInfo={uploadedSourceInfo}
                uploadedFrames={uploadedFrames}
                customPreviewFrames={customPreviewFrames}
                customPreviewImageData={customPreviewImageData}
                targetSlot={targetSlot}
                frameDurationMs={configState.frameDurationMs || 100}
                useFloydSteinbergDither={useFloydSteinbergDither}
                onSelectSlot={setTargetSlot}
                onToggleDither={() => setUseFloydSteinbergDither((v) => !v)}
                onChangeFrameDurationMs={(ms) => void handleUpdateRgbConfig({ frameDurationMs: ms })}
                onFileUpload={handleFileUpload}
                onUpdateFrames={(nextFrames, msg) => {
                  setUploadedFrames(nextFrames);
                  setCustomPreviewFrames(nextFrames);
                  setCustomPreviewImageData(nextFrames[0] || null);
                  if (msg) setStatusLog(msg);
                }}
                onFlashFrames={handleFlashCustomFrames}
                onStatusLog={setStatusLog}
              />
            )}

            {activeTab === 'rgb' && (
              <RgbUnderglowStudio
                configState={configState}
                rawHardwareConfig={rawHardwareConfig}
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

            {activeTab === 'knob' && (
              <SmartKnobTab
                activeKnobModeId={activeKnobModeId}
                onSelectSmartKnobMode={handleSelectSmartKnobMode}
              />
            )}

            {activeTab === 'ecosystem' && (
              <BeyondZuoyaLabTab
                liveWpm={liveWpm}
                onTypingWpmInput={handleTypingInput}
                typingTestText={typingTestText}
                pomodoroState={pomodoroState}
                onTogglePomodoro={handleTogglePomodoro}
                onResetPomodoro={handleResetPomodoro}
                onFlashBeyondApplet={handleFlashBeyondApplet}
                onNavigateTab={setActiveTab}
              />
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
