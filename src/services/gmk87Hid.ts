/**
 * Zuoya GMK87 Hardware Protocol Engine (Local USB HID Bridge Worker + Browser WebHID)
 * Vendor ID: 0x320F (12815), Product ID: 0x5055 (20565)
 * - LCD Screen Interface: usagePage 0xFF1C (65308), interface 3 fallback, Report ID 0x04
 * - VIA Keymap Interface: usagePage 0xFF60 (65376), interface 1 fallback, Report ID 0x00
 */

import {
  GMK87_VENDOR_ID,
  GMK87_PRODUCT_ID,
  LCD_USAGE_PAGE,
  VIA_USAGE_PAGE,
  LCD_REPORT_ID,
  VIA_REPORT_ID,
  LCD_WIDTH,
  LCD_HEIGHT,
  RAW_FRAME_BYTES,
  PADDED_FRAME_BYTES,
  MAX_TOTAL_FRAMES,
  MIN_FRAME_DURATION_MS,
  VIA_LAYERS,
  VIA_ROWS,
  VIA_COLS,
  VIA_KEYMAP_BYTES,
  LcdCommand,
  type Gmk87ParsedConfig,
  type Gmk87ConfigPatch,
  toBcd,
  fromBcd,
  formatRelease,
  formatPacketHex,
  checksum16,
  buildLcdPacketBytes,
  parseRawConfigBytes,
  patchRawConfigBytes,
  decodeViaKeymapBytes,
  encodeViaKeymapToBytes,
} from '../shared/gmk87Protocol';
import {
  GMK87_PHYSICAL_KEYS,
  createDefaultKeymap,
  isKeymapMangled,
} from '../data/gmk87KeymapData';

export {
  GMK87_VENDOR_ID,
  GMK87_PRODUCT_ID,
  LCD_USAGE_PAGE,
  VIA_USAGE_PAGE,
  LCD_REPORT_ID,
  VIA_REPORT_ID,
  LCD_WIDTH,
  LCD_HEIGHT,
  RAW_FRAME_BYTES,
  PADDED_FRAME_BYTES,
  MAX_TOTAL_FRAMES,
  MIN_FRAME_DURATION_MS,
  VIA_LAYERS,
  VIA_ROWS,
  VIA_COLS,
  VIA_KEYMAP_BYTES,
  LcdCommand,
  toBcd,
  fromBcd,
  formatRelease,
  formatPacketHex,
  checksum16,
  buildLcdPacketBytes,
  parseRawConfigBytes,
  patchRawConfigBytes,
  decodeViaKeymapBytes,
  encodeViaKeymapToBytes,
};
export type { Gmk87ParsedConfig, Gmk87ConfigPatch };

export interface Gmk87ConfigState {
  lightingEffect: number; // cfg[1]: 0-18
  brightness: number; // cfg[2]: 0-9
  speed: number; // UI level 0 (slowest) .. 4 (fastest), stored in cfg[3] as (4 - speed)
  effectDirection?: number; // cfg[4]: 0 = Forward (Right/Down), 1 = Reverse (Left/Up)
  rainbowMode?: number; // cfg[5]: 0 = Custom Single Hue, 1 (0xFF on hardware) = Rainbow / Multicolour
  rgbHueR: number; // cfg[6]
  rgbHueG: number; // cfg[7]
  rgbHueB: number; // cfg[8]
  logoMode?: number; // cfg[28]: 0-4 (Blinking, Pulse Rainbow, Blinking Alt, Fixed, Fixed Alt)
  logoBrightness?: number; // cfg[29]: 0-9 (0 = off)
  logoRainbow?: number; // cfg[31]: 0 = Preset color, 1 (0xFF on hardware) = Rainbow
  logoColor?: number; // cfg[32]: 0-8 (Red, Orange, Yellow, Green, Teal, Blue, Purple, White, Off)
  activeScreenMode: number; // cfg[33]: 0 = Clock/Stats, 1 = Slot 0, 2 = Slot 1
  slot0FrameCount: number; // cfg[34]
  slot1FrameCount: number; // cfg[46]
  frameDurationMs?: number; // cfg[43..44]: >= 60ms (default 100ms)
  clockDate: Date; // cfg[35..41] BCD encoded
}

export interface UploadProgressInfo {
  phase: 'idle' | 'config' | 'ready' | 'streaming' | 'commit' | 'complete' | 'error';
  bytesSent: number;
  totalBytes: number;
  currentFrame: number;
  totalFrames: number;
  lastPacketHex: string;
  message: string;
}

export interface ConnectionResult {
  connected: boolean;
  bridgeAvailable?: boolean;
  lcdConnected: boolean;
  viaConnected: boolean;
  mode: 'bridge' | 'webhid' | 'simulation';
  viaProtocol: number;
  firmwareVersion?: string;
  deviceName: string;
  message: string;
  config?: Gmk87ConfigState;
  slotCache?: { slot0Frames: number; slot1Frames: number };
}

export interface ViaBatchEntry {
  layer: number;
  row: number;
  col: number;
  keycode: number;
}

export interface ViaMacroReadResult {
  success: boolean;
  supported: boolean;
  viaProtocol: number;
  count: number;
  bufferSize: number;
  macros: string[];
  rawBytes?: number[];
  error?: string;
}

/**
 * Pixel conversion: toRGB565(r,g,b) = ((r >> 3) << 11) | ((g >> 2) << 5) | (b >> 3)
 */
export function toRGB565(r: number, g: number, b: number): number {
  return (((r & 0xff) >> 3) << 11) | (((g & 0xff) >> 2) << 5) | ((b & 0xff) >> 3);
}

/**
 * Convert 16-bit RGB565 back to 24-bit RGB for accurate hardware monitor preview and error diffusion
 */
export function fromRGB565(rgb565: number): [number, number, number] {
  const r5 = (rgb565 >> 11) & 0x1f;
  const g6 = (rgb565 >> 5) & 0x3f;
  const b5 = rgb565 & 0x1f;
  const r8 = (r5 << 3) | (r5 >> 2);
  const g8 = (g6 << 2) | (g6 >> 4);
  const b8 = (b5 << 3) | (b5 >> 2);
  return [r8, g8, b8];
}

/**
 * Encodes an ImageData (240x135) into a 65,536-byte padded RGB565 buffer (big-endian per pixel),
 * optionally applying Floyd-Steinberg error-diffusion dithering before packing to 16-bit RGB565.
 */
export function encodeImageDataToRGB565Frame(
  imageData: ImageData,
  useDithering = false
): Uint8Array {
  const buffer = new Uint8Array(PADDED_FRAME_BYTES);
  const data = imageData.data;
  const w = Math.min(LCD_WIDTH, imageData.width || LCD_WIDTH);
  const h = Math.min(LCD_HEIGHT, imageData.height || LCD_HEIGHT);

  if (!useDithering) {
    let byteOffset = 0;
    const pixelCount = Math.min(LCD_WIDTH * LCD_HEIGHT, Math.floor(data.length / 4));
    for (let i = 0; i < pixelCount; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const rgb565 = toRGB565(r, g, b);
      buffer[byteOffset++] = (rgb565 >> 8) & 0xff;
      buffer[byteOffset++] = rgb565 & 0xff;
    }
    return buffer;
  }

  const work = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    work[i * 3] = data[i * 4];
    work[i * 3 + 1] = data[i * 4 + 1];
    work[i * 3 + 2] = data[i * 4 + 2];
  }

  let byteOffset = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const pIdx = (y * w + x) * 3;
      const oldR = Math.max(0, Math.min(255, Math.round(work[pIdx])));
      const oldG = Math.max(0, Math.min(255, Math.round(work[pIdx + 1])));
      const oldB = Math.max(0, Math.min(255, Math.round(work[pIdx + 2])));

      const rgb565 = toRGB565(oldR, oldG, oldB);
      const [newR, newG, newB] = fromRGB565(rgb565);

      buffer[byteOffset++] = (rgb565 >> 8) & 0xff;
      buffer[byteOffset++] = rgb565 & 0xff;

      const errR = oldR - newR;
      const errG = oldG - newG;
      const errB = oldB - newB;

      const distribute = (dx: number, dy: number, factor: number) => {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nIdx = (ny * w + nx) * 3;
          work[nIdx] += errR * factor;
          work[nIdx + 1] += errG * factor;
          work[nIdx + 2] += errB * factor;
        }
      };

      distribute(1, 0, 7 / 16);
      distribute(-1, 1, 3 / 16);
      distribute(0, 1, 5 / 16);
      distribute(1, 1, 1 / 16);
    }
  }

  return buffer;
}

/**
 * Builds the 64-byte LCD packet via shared codec (returns the 63-byte payload passed to
 * device.sendReport(0x04, payload), plus the full 64-byte representation for inspection).
 */
export function buildLcdPacket(
  command: LcdCommand | number,
  posOffset: number,
  payload?: Uint8Array
): { reportPayload63: Uint8Array; fullPacket64: Uint8Array; checksum: number } {
  const fullPacket64 = buildLcdPacketBytes(command, payload, posOffset);
  const checksum = fullPacket64[1] | (fullPacket64[2] << 8);
  const reportPayload63 = fullPacket64.subarray(1, 64);
  return { reportPayload63, fullPacket64, checksum };
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Parses a raw 48B or 64B GMK87 EEPROM config block into Gmk87ConfigState
 */
export function parseConfigBuffer(cfg: Uint8Array): Gmk87ConfigState {
  const parsed = parseRawConfigBytes(cfg);
  return {
    lightingEffect: parsed.lightingEffect,
    brightness: parsed.brightness,
    speed: parsed.speed,
    effectDirection: parsed.effectDirection,
    rainbowMode: parsed.rainbowMode,
    rgbHueR: parsed.rgbHueR,
    rgbHueG: parsed.rgbHueG,
    rgbHueB: parsed.rgbHueB,
    logoMode: parsed.logoMode,
    logoBrightness: parsed.logoBrightness,
    logoRainbow: parsed.logoRainbow,
    logoColor: parsed.logoColor,
    activeScreenMode: parsed.activeScreenMode,
    slot0FrameCount: parsed.slot0FrameCount,
    slot1FrameCount: parsed.slot1FrameCount,
    frameDurationMs: parsed.frameDurationMs,
    clockDate: new Date(parsed.clockTimestampMs),
  };
}

/**
 * Serializes Gmk87ConfigState into a 48-byte or 64-byte config buffer using shared codec,
 * preserving unknown hardware bytes (V0112 protocol selector, unknown EEPROM flags) when baseBuffer is supplied.
 */
export function serializeConfigBuffer(
  state: Gmk87ConfigState,
  baseBuffer?: Uint8Array | null
): Uint8Array {
  return patchRawConfigBytes(
    baseBuffer,
    {
      lightingEffect: state.lightingEffect,
      brightness: state.brightness,
      speed: state.speed,
      effectDirection: state.effectDirection,
      rainbowMode: state.rainbowMode,
      rgbHueR: state.rgbHueR,
      rgbHueG: state.rgbHueG,
      rgbHueB: state.rgbHueB,
      logoMode: state.logoMode,
      logoBrightness: state.logoBrightness,
      logoRainbow: state.logoRainbow,
      logoColor: state.logoColor,
      activeScreenMode: state.activeScreenMode,
      slot0FrameCount: state.slot0FrameCount,
      slot1FrameCount: state.slot1FrameCount,
      frameDurationMs: state.frameDurationMs,
      clockTimestampMs: state.clockDate.getTime(),
    },
    48
  );
}

// ============================================================================
// Persistent WebHID Slot 0 / Slot 1 IndexedDB Frame Cache (browser fallback)
// ============================================================================
const IDB_NAME = 'gmk87_slot_cache_v1';
const IDB_STORE = 'slots';

function openSlotDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE)) {
          db.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function loadSlotFromIndexedDB(slot: 0 | 1): Promise<Uint8Array[] | null> {
  const db = await openSlotDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(`slot${slot}`);
      req.onsuccess = () => {
        db.close();
        const val = req.result;
        if (val && Array.isArray(val.frames) && val.frames.length > 0) {
          const restored: Uint8Array[] = [];
          for (const rawBuf of val.frames) {
            if (rawBuf instanceof ArrayBuffer || ArrayBuffer.isView(rawBuf)) {
              const src =
                rawBuf instanceof ArrayBuffer
                  ? new Uint8Array(rawBuf)
                  : new Uint8Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength);
              const padded = new Uint8Array(PADDED_FRAME_BYTES);
              padded.set(src.subarray(0, PADDED_FRAME_BYTES), 0);
              restored.push(padded);
            }
          }
          resolve(restored.length > 0 ? restored : null);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function saveSlotToIndexedDB(slot: 0 | 1, frames: Uint8Array[]): Promise<void> {
  const db = await openSlotDb();
  if (!db) return;
  try {
    const rawSlices = frames.map((buf) => {
      const copy = new Uint8Array(RAW_FRAME_BYTES);
      copy.set(buf.subarray(0, RAW_FRAME_BYTES), 0);
      return copy.buffer;
    });
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put({ frames: rawSlices, updatedAt: Date.now() }, `slot${slot}`);
    tx.oncomplete = () => db.close();
    tx.onerror = () => db.close();
  } catch {
    db.close();
  }
}

function parsedPayloadToConfigState(cfg: any, fallbackDate = new Date()): Gmk87ConfigState {
  return {
    lightingEffect: cfg.lightingEffect,
    brightness: cfg.brightness,
    speed: cfg.speed,
    effectDirection: cfg.effectDirection ?? 0,
    rainbowMode: cfg.rainbowMode ?? 0,
    rgbHueR: cfg.rgbHueR,
    rgbHueG: cfg.rgbHueG,
    rgbHueB: cfg.rgbHueB,
    logoMode: cfg.logoMode ?? 0,
    logoBrightness: cfg.logoBrightness ?? 9,
    logoRainbow: cfg.logoRainbow ?? 0,
    logoColor: cfg.logoColor ?? 0,
    activeScreenMode: cfg.activeScreenMode,
    slot0FrameCount: cfg.slot0FrameCount,
    slot1FrameCount: cfg.slot1FrameCount,
    frameDurationMs: Math.max(MIN_FRAME_DURATION_MS, cfg.frameDurationMs || 100),
    clockDate: cfg.clockTimestampMs ? new Date(cfg.clockTimestampMs) : fallbackDate,
  };
}

// Minimal WebHID TypeScript declarations for browsers
interface HidCollectionInfo {
  usagePage?: number;
  usage?: number;
}

interface HidDevice {
  opened: boolean;
  vendorId: number;
  productId: number;
  productName: string;
  collections: HidCollectionInfo[];
  open(): Promise<void>;
  close(): Promise<void>;
  sendReport(reportId: number, data: Uint8Array | BufferSource): Promise<void>;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
}

export class Gmk87HidEngine {
  private lcdDevice: HidDevice | null = null;
  private viaDevice: HidDevice | null = null;
  private bridgeBaseUrl = '';
  private bridgeActive = false;
  private bridgeLcdConnected = false;
  private bridgeViaConnected = false;
  private bridgeViaProtocol = 9;
  private bridgeFirmwareVersion = '';
  private bridgeDeviceName = 'Zuoya GMK87';
  private bridgeSlotCache = { slot0Frames: 0, slot1Frames: 0 };
  private configBuffer: Uint8Array;
  private hasReadHardwareConfig = false;
  private isUploading = false;
  private cachedSlotFrames: [Uint8Array[] | null, Uint8Array[] | null] = [null, null];
  private hardwareChangeListener:
    | ((event: { type: 'connect' | 'disconnect'; deviceName?: string }) => void)
    | null = null;
  private webHidEventsBound = false;

  constructor(initialConfig: Gmk87ConfigState) {
    this.configBuffer = serializeConfigBuffer(initialConfig);
    this.ensureWebHidEventBindings();
  }

  public setHardwareChangeListener(
    cb: ((event: { type: 'connect' | 'disconnect'; deviceName?: string }) => void) | null
  ): void {
    this.hardwareChangeListener = cb;
    this.ensureWebHidEventBindings();
  }

  private ensureWebHidEventBindings(): void {
    if (this.webHidEventsBound || !this.isWebHidSupported()) return;
    const navHid = (navigator as any).hid;
    if (!navHid?.addEventListener) return;
    this.webHidEventsBound = true;

    navHid.addEventListener('disconnect', (evt: any) => {
      const dev: HidDevice | undefined = evt?.device;
      if (!dev) return;
      let affected = false;
      if (dev === this.lcdDevice) {
        this.lcdDevice = null;
        affected = true;
      }
      if (dev === this.viaDevice) {
        this.viaDevice = null;
        affected = true;
      }
      if (affected && !this.isConnected()) {
        this.hasReadHardwareConfig = false;
        this.hardwareChangeListener?.({
          type: 'disconnect',
          deviceName: dev.productName || 'Zuoya GMK87',
        });
      }
    });

    navHid.addEventListener('connect', (evt: any) => {
      const dev: HidDevice | undefined = evt?.device;
      if (!dev) return;
      if (dev.vendorId === GMK87_VENDOR_ID && dev.productId === GMK87_PRODUCT_ID) {
        this.hardwareChangeListener?.({
          type: 'connect',
          deviceName: dev.productName || 'Zuoya GMK87',
        });
      }
    });
  }

  public isWebHidSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator;
  }

  public isBridgeActive(): boolean {
    return this.bridgeActive && (this.bridgeLcdConnected || this.bridgeViaConnected);
  }

  public getTransportMode(): 'bridge' | 'webhid' | 'simulation' {
    if (this.isBridgeActive()) return 'bridge';
    if (this.lcdDevice?.opened || this.viaDevice?.opened) return 'webhid';
    return 'simulation';
  }

  public isConnected(): boolean {
    return this.isBridgeActive() || Boolean(this.lcdDevice?.opened || this.viaDevice?.opened);
  }

  public isViaConnected(): boolean {
    return (this.bridgeActive && this.bridgeViaConnected) || Boolean(this.viaDevice?.opened);
  }

  public getViaProtocol(): number {
    return this.bridgeViaProtocol;
  }

  public getSlotCacheCounts(): { slot0Frames: number; slot1Frames: number } {
    if (this.isBridgeActive()) {
      return { ...this.bridgeSlotCache };
    }
    return {
      slot0Frames: this.cachedSlotFrames[0]?.length ?? 0,
      slot1Frames: this.cachedSlotFrames[1]?.length ?? 0,
    };
  }

  public getConnectedDeviceName(): string {
    if (this.isBridgeActive()) {
      return `${this.bridgeDeviceName}${
        this.bridgeFirmwareVersion ? ` (${this.bridgeFirmwareVersion})` : ''
      }`;
    }
    if (this.lcdDevice?.opened && this.viaDevice?.opened) {
      return `${this.lcdDevice.productName || 'Zuoya GMK87'} (LCD + VIA)`;
    }
    if (this.lcdDevice?.opened) return `${this.lcdDevice.productName || 'Zuoya GMK87'} (LCD)`;
    if (this.viaDevice?.opened) return `${this.viaDevice.productName || 'Zuoya GMK87'} (VIA)`;
    return 'Simulation Mode';
  }

  public getRawConfigBuffer(): Uint8Array {
    return new Uint8Array(this.configBuffer);
  }

  private lastWebHidError = '';
  private lastBridgeProbeLog: Record<string, string> = {};

  public getDiagnosticMetadata(): {
    inIframe: boolean;
    windowOrigin: string;
    webHidSupported: boolean;
    lastWebHidError: string;
    bridgeProbeLog: Record<string, string>;
  } {
    let inIframe = false;
    let windowOrigin = '';
    if (typeof window !== 'undefined') {
      windowOrigin = window.location.origin;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }
    }
    return {
      inIframe,
      windowOrigin,
      webHidSupported: this.isWebHidSupported(),
      lastWebHidError: this.lastWebHidError,
      bridgeProbeLog: { ...this.lastBridgeProbeLog },
    };
  }

  public getBridgeBaseUrl(): string {
    return this.bridgeBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  private getBridgeUrl(apiPath: string): string {
    return `${this.bridgeBaseUrl}${apiPath}`;
  }

  /**
   * Probes the local Node USB HID bridge (/api/hid/status) for zero-click automatic connection.
   * When running in a remote preview, automatically falls back to probing the user's local Windows
   * USB bridge at http://127.0.0.1:3887 and http://localhost:3887 if same-origin has no physical GMK87 attached.
   */
  public async checkBridgeStatus(
    forceRefresh = false,
    lightOnly = false
  ): Promise<ConnectionResult> {
    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set('refresh', '1');
      if (lightOnly) params.set('light', '1');
      const qs = params.toString();
      const relPath = qs ? `/api/hid/status?${qs}` : '/api/hid/status';

      const isRemoteHost =
        typeof window !== 'undefined' &&
        window.location.hostname !== 'localhost' &&
        window.location.hostname !== '127.0.0.1';

      // When running on remote preview, probe the user's local Windows bridge (127.0.0.1:3887 / localhost:3887) FIRST
      const candidateBases: string[] = [];
      if (this.bridgeBaseUrl) candidateBases.push(this.bridgeBaseUrl);
      if (isRemoteHost) {
        if (!candidateBases.includes('http://127.0.0.1:3887')) {
          candidateBases.push('http://127.0.0.1:3887');
        }
        if (!candidateBases.includes('http://localhost:3887')) {
          candidateBases.push('http://localhost:3887');
        }
      }
      if (!candidateBases.includes('')) candidateBases.push('');

      let data: any = null;
      let chosenBase = this.bridgeBaseUrl;
      const probeLog: Record<string, string> = {};

      for (const base of candidateBases) {
        const label = base || 'same-origin';
        try {
          const resp = await fetch(`${base}${relPath}`, {
            signal: AbortSignal.timeout(base ? 1500 : 3500),
          });
          const contentType = resp.headers.get('content-type') || '';
          if (!resp.ok || !contentType.includes('application/json')) {
            probeLog[label] = `HTTP ${resp.status} (${contentType || 'no content-type'})`;
            continue;
          }
          const parsed = await resp.json();
          if (!parsed?.bridgeAvailable) {
            probeLog[label] = 'bridgeAvailable=false';
            continue;
          }
          probeLog[label] = `OK (connected=${Boolean(parsed.connected)}, via=${Boolean(
            parsed.viaConnected
          )}, err=${parsed.error || 'none'})`;
          data = parsed;
          chosenBase = base;
          if (parsed.connected || parsed.viaConnected) {
            break;
          }
        } catch (err: any) {
          probeLog[label] = `Fetch error: ${err?.name || 'Error'}: ${err?.message || String(err)}`;
        }
      }

      this.lastBridgeProbeLog = probeLog;

      if (!data || !data.bridgeAvailable) {
        this.bridgeActive = false;
        this.bridgeLcdConnected = false;
        this.bridgeViaConnected = false;
        const webHidOpen = Boolean(this.lcdDevice?.opened || this.viaDevice?.opened);
        return {
          connected: webHidOpen,
          bridgeAvailable: false,
          lcdConnected: Boolean(this.lcdDevice?.opened),
          viaConnected: Boolean(this.viaDevice?.opened),
          mode: webHidOpen ? 'webhid' : 'simulation',
          viaProtocol: 9,
          deviceName: this.getConnectedDeviceName(),
          message: 'Local USB bridge unavailable; using WebHID / Simulation Mode.',
        };
      }

      this.bridgeBaseUrl = chosenBase;

      this.bridgeActive = Boolean(data.connected || data.viaConnected);
      this.bridgeLcdConnected = Boolean(data.connected);
      this.bridgeViaConnected = Boolean(data.viaConnected);
      this.bridgeViaProtocol = Number(data.viaProtocol) || 9;
      this.bridgeFirmwareVersion = data.firmwareVersion || '';
      this.bridgeDeviceName = data.deviceName || 'Zuoya GMK87';
      if (data.slotCache && typeof data.slotCache === 'object') {
        this.bridgeSlotCache = {
          slot0Frames: Number(data.slotCache.slot0Frames) || 0,
          slot1Frames: Number(data.slotCache.slot1Frames) || 0,
        };
      }

      let parsedConfig: Gmk87ConfigState | undefined;
      if (data.config) {
        parsedConfig = parsedPayloadToConfigState(data.config);
        this.configBuffer = Array.isArray(data.rawConfig)
          ? new Uint8Array(data.rawConfig)
          : serializeConfigBuffer(parsedConfig, this.configBuffer);
        this.hasReadHardwareConfig = true;
      }

      if (this.bridgeActive) {
        return {
          connected: true,
          bridgeAvailable: true,
          lcdConnected: this.bridgeLcdConnected,
          viaConnected: this.bridgeViaConnected,
          mode: 'bridge',
          viaProtocol: this.bridgeViaProtocol,
          firmwareVersion: this.bridgeFirmwareVersion,
          deviceName: this.getConnectedDeviceName(),
          config: parsedConfig,
          slotCache: this.bridgeSlotCache,
          message: `USB Bridge Auto-Connected: ${this.bridgeDeviceName} ${
            this.bridgeFirmwareVersion
          } (LCD: ${this.bridgeLcdConnected ? 'OK' : 'N/A'}, VIA P${this.bridgeViaProtocol}: ${
            this.bridgeViaConnected ? 'OK' : 'N/A'
          })`,
        };
      }

      const webHidOpen = Boolean(this.lcdDevice?.opened || this.viaDevice?.opened);
      return {
        connected: webHidOpen,
        bridgeAvailable: true,
        lcdConnected: Boolean(this.lcdDevice?.opened),
        viaConnected: Boolean(this.viaDevice?.opened),
        mode: webHidOpen ? 'webhid' : 'simulation',
        viaProtocol: 9,
        deviceName: this.getConnectedDeviceName(),
        slotCache: this.bridgeSlotCache,
        message:
          data.error ||
          'USB Bridge active, but Zuoya GMK87 (0x320F:0x5055) not detected in wired USB mode.',
      };
    } catch {
      this.bridgeActive = false;
      this.bridgeLcdConnected = false;
      this.bridgeViaConnected = false;
      const webHidOpen = Boolean(this.lcdDevice?.opened || this.viaDevice?.opened);
      return {
        connected: webHidOpen,
        bridgeAvailable: false,
        lcdConnected: Boolean(this.lcdDevice?.opened),
        viaConnected: Boolean(this.viaDevice?.opened),
        mode: webHidOpen ? 'webhid' : 'simulation',
        viaProtocol: 9,
        deviceName: this.getConnectedDeviceName(),
        message: 'Running without local USB bridge (WebHID / Simulation Mode).',
      };
    }
  }

  /**
   * Attempts silent WebHID reconnection to already-permitted 0x320F:0x5055 interfaces (no chooser dialog).
   */
  public async tryAutoReconnectWebHid(): Promise<ConnectionResult | null> {
    if (!this.isWebHidSupported() || this.isBridgeActive()) return null;
    try {
      const navHid = (navigator as any).hid;
      const permitted: HidDevice[] = await navHid.getDevices();
      const matching = permitted.filter(
        (d) => d.vendorId === GMK87_VENDOR_ID && d.productId === GMK87_PRODUCT_ID
      );
      if (matching.length === 0) return null;

      for (const dev of matching) {
        const hasLcd = dev.collections?.some((c) => c.usagePage === LCD_USAGE_PAGE);
        const hasVia = dev.collections?.some((c) => c.usagePage === VIA_USAGE_PAGE);
        if (hasLcd && (!this.lcdDevice || !this.lcdDevice.opened)) {
          if (!dev.opened) await dev.open();
          this.lcdDevice = dev;
        }
        if (hasVia && (!this.viaDevice || !this.viaDevice.opened)) {
          if (!dev.opened) await dev.open();
          this.viaDevice = dev;
        }
      }

      if (!this.lcdDevice?.opened && !this.viaDevice?.opened) return null;

      let config: Gmk87ConfigState | undefined;
      if (this.lcdDevice?.opened) {
        config = await this.readWebHidConfig().catch(() => undefined);
      }

      return {
        connected: true,
        lcdConnected: Boolean(this.lcdDevice?.opened),
        viaConnected: Boolean(this.viaDevice?.opened),
        mode: 'webhid',
        viaProtocol: this.bridgeViaProtocol || 9,
        deviceName: this.getConnectedDeviceName(),
        config,
        message: `WebHID Auto-Connected: ${this.getConnectedDeviceName()}`,
      };
    } catch (err: any) {
      this.lastWebHidError = `${err?.name || 'Error'}: ${err?.message || String(err)}`;
      return null;
    }
  }

  /**
   * Immediately invokes navigator.hid.requestDevice() on the first synchronous turn of a user click
   * so the browser's transient user activation is never lost to prior network fetches.
   */
  public async connectWebHidDirect(): Promise<ConnectionResult> {
    if (!this.isWebHidSupported()) {
      this.lastWebHidError = 'navigator.hid is not available in this browser';
      return {
        connected: false,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message: 'WebHID API unavailable in this browser.',
      };
    }

    try {
      const navHid = (navigator as any).hid;

      const filters: Array<{ vendorId: number; productId: number; usagePage?: number }> = [];
      if (!this.lcdDevice?.opened) {
        filters.push({
          vendorId: GMK87_VENDOR_ID,
          productId: GMK87_PRODUCT_ID,
          usagePage: LCD_USAGE_PAGE,
        });
      }
      if (!this.viaDevice?.opened) {
        filters.push({
          vendorId: GMK87_VENDOR_ID,
          productId: GMK87_PRODUCT_ID,
          usagePage: VIA_USAGE_PAGE,
        });
      }
      if (filters.length === 0) {
        filters.push({ vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID });
      }

      // CRITICAL: Must be called before any other await to preserve user gesture!
      const selected: HidDevice[] = await navHid.requestDevice({ filters });
      const alreadyPermitted: HidDevice[] = await navHid.getDevices();
      const pool = [...selected, ...alreadyPermitted];

      for (const dev of pool) {
        if (dev.vendorId !== GMK87_VENDOR_ID || dev.productId !== GMK87_PRODUCT_ID) continue;
        const hasLcd = dev.collections?.some((c) => c.usagePage === LCD_USAGE_PAGE);
        const hasVia = dev.collections?.some((c) => c.usagePage === VIA_USAGE_PAGE);

        if (hasLcd && (!this.lcdDevice || !this.lcdDevice.opened)) {
          if (!dev.opened) await dev.open();
          this.lcdDevice = dev;
        }
        if (hasVia && (!this.viaDevice || !this.viaDevice.opened)) {
          if (!dev.opened) await dev.open();
          this.viaDevice = dev;
        }
      }

      let config: Gmk87ConfigState | undefined;
      if (this.lcdDevice?.opened) {
        config = await this.readWebHidConfig().catch(() => undefined);
      }

      if (this.isConnected()) {
        this.lastWebHidError = '';
        const missingHint =
          this.lcdDevice?.opened && !this.viaDevice?.opened
            ? ' (LCD 0xFF1C paired; click Pair WebHID again to also grant VIA 0xFF60)'
            : !this.lcdDevice?.opened && this.viaDevice?.opened
            ? ' (VIA 0xFF60 paired; click Pair WebHID again to also grant LCD 0xFF1C)'
            : '';
        return {
          connected: true,
          lcdConnected: Boolean(this.lcdDevice?.opened),
          viaConnected: Boolean(this.viaDevice?.opened),
          mode: 'webhid',
          viaProtocol: 9,
          deviceName: this.getConnectedDeviceName(),
          config,
          message: `Connected via WebHID: ${this.getConnectedDeviceName()}${missingHint}`,
        };
      }

      this.lastWebHidError = 'User closed chooser without selecting Zuoya GMK87 (0x320F:0x5055)';
      return {
        connected: false,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message: 'No Zuoya GMK87 selected in WebHID chooser.',
      };
    } catch (err: any) {
      this.lastWebHidError = `${err?.name || 'Error'}: ${err?.message || String(err)}`;
      return {
        connected: false,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message: `WebHID error: ${this.lastWebHidError}`,
      };
    }
  }

  /**
   * Requests pairing with Zuoya GMK87 (VID 0x320F, PID 0x5055) via WebHID or refreshes USB bridge.
   * Note: On Windows, 0xFF1C (LCD) and 0xFF60 (VIA) are exposed as two separate HID collections,
   * so clicking Connect when one is paired prompts for the missing interface automatically.
   */
  public async connect(): Promise<ConnectionResult> {
    const isRemoteHost =
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1';

    // When running in a remote browser preview and not yet connected to a local bridge,
    // invoke WebHID requestDevice FIRST so network timeouts do not consume the user gesture!
    if (isRemoteHost && !this.isBridgeActive() && this.isWebHidSupported()) {
      const webRes = await this.connectWebHidDirect();
      if (webRes.connected) {
        return webRes;
      }
    }

    const bridge = await this.checkBridgeStatus(true);
    if (bridge.connected) {
      return bridge;
    }

    if (!isRemoteHost && this.isWebHidSupported()) {
      return this.connectWebHidDirect();
    }

    return {
      connected: false,
      lcdConnected: false,
      viaConnected: false,
      mode: 'simulation',
      viaProtocol: 9,
      deviceName: 'Simulation Mode',
      message: this.lastWebHidError
        ? `WebHID blocked/skipped (${this.lastWebHidError}) & local bridge not detected.`
        : 'WebHID unavailable & local bridge not detected.',
    };
  }

  public async disconnect(): Promise<void> {
    this.bridgeActive = false;
    this.bridgeLcdConnected = false;
    this.bridgeViaConnected = false;
    this.hasReadHardwareConfig = false;
    if (this.lcdDevice?.opened) {
      await this.lcdDevice.close().catch(() => {});
    }
    if (this.viaDevice?.opened) {
      await this.viaDevice.close().catch(() => {});
    }
    this.lcdDevice = null;
    this.viaDevice = null;
  }

  private waitForInputReport(
    device: HidDevice,
    matchFn: (reportId: number, data: Uint8Array) => boolean,
    timeoutMs = 800
  ): Promise<Uint8Array | null> {
    return new Promise((resolve) => {
      let done = false;
      const timer = setTimeout(() => {
        if (!done) {
          done = true;
          device.removeEventListener('inputreport', onReport);
          resolve(null);
        }
      }, timeoutMs);

      const onReport = (event: any) => {
        if (done) return;
        const dv: DataView = event.data;
        const bytes = new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength);
        if (matchFn(event.reportId, bytes)) {
          done = true;
          clearTimeout(timer);
          device.removeEventListener('inputreport', onReport);
          resolve(bytes);
        }
      };

      device.addEventListener('inputreport', onReport);
    });
  }

  private async transactWebHidLcd(
    command: LcdCommand,
    offset: number,
    payload?: Uint8Array,
    waitReply = true,
    timeoutMs = 800,
    matchPos = false
  ): Promise<{
    fullPacket64: Uint8Array;
    checksum: number;
    replyPayload?: Uint8Array;
    ackReceived: boolean;
  }> {
    if (command === LcdCommand.COMMIT) {
      await new Promise((r) => setTimeout(r, 100));
    }

    const built = buildLcdPacket(command, offset, payload);
    if (!this.lcdDevice?.opened) {
      return { fullPacket64: built.fullPacket64, checksum: built.checksum, ackReceived: false };
    }

    const expectedCmd = command & 0xff;
    const expectedLen = (payload ? Math.min(56, payload.length) : 0) & 0xff;
    const p0 = offset & 0xff;
    const p1 = (offset >> 8) & 0xff;
    const p2 = (offset >> 16) & 0xff;

    let replyPromise: Promise<Uint8Array | null> | null = null;
    if (waitReply) {
      // Chrome WebHID strips Report ID 0x04 so event.data[2] == command, event.data[3] == len, event.data[4..6] == pos
      replyPromise = this.waitForInputReport(
        this.lcdDevice,
        (_rid, data) =>
          data.length >= 4 &&
          data[2] === expectedCmd &&
          (!matchPos ||
            (data.length >= 7 &&
              data[3] === expectedLen &&
              data[4] === p0 &&
              data[5] === p1 &&
              data[6] === p2)),
        timeoutMs
      );
    }

    await this.lcdDevice.sendReport(LCD_REPORT_ID, built.reportPayload63);

    if (replyPromise) {
      const reply = await replyPromise;
      return {
        fullPacket64: built.fullPacket64,
        checksum: built.checksum,
        replyPayload: reply ? reply.subarray(3) : undefined,
        ackReceived: Boolean(reply),
      };
    }

    return { fullPacket64: built.fullPacket64, checksum: built.checksum, ackReceived: true };
  }

  /**
   * Reads the real 48-byte (or 64-byte on V0112) config buffer via WebHID 0xFF1C with strict ACK verification.
   */
  public async readWebHidConfig(): Promise<Gmk87ConfigState> {
    if (!this.lcdDevice?.opened) {
      return parseConfigBuffer(this.configBuffer);
    }

    const initRes = await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
    if (!initRes.ackReceived) {
      throw new Error('WebHID INIT (0x01) timeout while reading GMK87 config');
    }

    for (let i = 0; i < 9; i++) {
      const prep = await this.transactWebHidLcd(LcdCommand.PREPARE_READ, i * 4, new Uint8Array(4), true);
      if (!prep.ackReceived) {
        throw new Error(`WebHID PREPARE_READ (0x03) timeout at offset ${i * 4}`);
      }
    }
    const prepTail = await this.transactWebHidLcd(LcdCommand.PREPARE_READ, 36, new Uint8Array(1), true);
    if (!prepTail.ackReceived) {
      throw new Error('WebHID PREPARE_READ (0x03) timeout at offset 36');
    }

    const commitRes = await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);
    if (!commitRes.ackReceived) {
      throw new Error('WebHID COMMIT (0x02) timeout before reading EEPROM config');
    }

    const raw48 = new Uint8Array(48);
    for (let i = 0; i < 12; i++) {
      const res = await this.transactWebHidLcd(LcdCommand.READ_CONFIG, i * 4, new Uint8Array(4), true);
      if (!res.ackReceived || !res.replyPayload || res.replyPayload.length < 4) {
        throw new Error(`WebHID READ_CONFIG (0x05) timeout/short read at offset ${i * 4}`);
      }
      raw48.set(res.replyPayload.subarray(0, 4), i * 4);
    }

    // Optional probe for V0112 extended tail (positions 48..60); ignore blank 0xFF EEPROM on V0104
    const probe48 = await this.transactWebHidLcd(
      LcdCommand.READ_CONFIG,
      48,
      new Uint8Array(4),
      true,
      150
    );
    const hasExtendedFirmwareBlock =
      probe48.ackReceived &&
      probe48.replyPayload &&
      probe48.replyPayload.length >= 4 &&
      !probe48.replyPayload.subarray(0, 4).every((b) => b === 0xff);
    if (hasExtendedFirmwareBlock && probe48.replyPayload) {
      const raw64 = new Uint8Array(64);
      raw64.set(raw48, 0);
      raw64.set(probe48.replyPayload.subarray(0, 4), 48);
      for (let pos = 52; pos < 64; pos += 4) {
        const res = await this.transactWebHidLcd(
          LcdCommand.READ_CONFIG,
          pos,
          new Uint8Array(4),
          true,
          250
        );
        if (!res.ackReceived || !res.replyPayload || res.replyPayload.length < 4) {
          throw new Error(`WebHID READ_CONFIG (0x05) timeout at extended offset ${pos}`);
        }
        raw64.set(res.replyPayload.subarray(0, 4), pos);
      }
      this.configBuffer = raw64;
    } else {
      this.configBuffer = raw48;
    }

    this.hasReadHardwareConfig = true;
    return parseConfigBuffer(this.configBuffer);
  }

  public hasWebHidLcdOpen(): boolean {
    return Boolean(this.lcdDevice?.opened);
  }

  /**
   * 1-Click Option 1 ("Fix 00:00 & Show Native Clock"):
   * Automatically pairs/opens direct WebHID (0xFF1C) on user click if supported so the browser's
   * latest ClassA + ClassB 48-byte EEPROM payload (cfg[0]=0, cfg[19..22]=[slot0,slot1,1,0],
   * cfg[33]=0, cfg[35..41]=BCD) is written directly to the keyboard even if the local Windows
   * bridge has not been git-pulled yet.
   */
  public async fixClockAndRestoreNativeMode(
    baseState: Gmk87ConfigState
  ): Promise<{
    success: boolean;
    hardwareApplied: boolean;
    usedDirectWebHid: boolean;
    packetHex: string;
    config: Gmk87ConfigState;
    rawConfig: Uint8Array;
    error?: string;
  }> {
    const now = new Date();
    if (!this.isBridgeActive() && !this.lcdDevice?.opened && this.isWebHidSupported()) {
      try {
        await this.connectWebHidDirect();
      } catch {
        // User may have closed chooser; fall back to syncClockNow / bridge
      }
    }

    const syncRes = await this.syncClockNow(now, true);
    const nextState: Gmk87ConfigState = {
      ...(syncRes.config || baseState),
      activeScreenMode: 0,
      clockDate: now,
    };

    if (!this.lcdDevice?.opened && this.isBridgeActive()) {
      try {
        const pkt = await this.writeConfig(nextState);
        return {
          success: true,
          hardwareApplied: true,
          usedDirectWebHid: false,
          packetHex: pkt || syncRes.packetHex,
          config: nextState,
          rawConfig: this.getRawConfigBuffer(),
        };
      } catch (err: any) {
        return {
          success: syncRes.success,
          hardwareApplied: syncRes.hardwareApplied,
          usedDirectWebHid: false,
          packetHex: syncRes.packetHex,
          config: nextState,
          rawConfig: this.getRawConfigBuffer(),
          error: err?.message,
        };
      }
    }

    return {
      success: syncRes.success,
      hardwareApplied: syncRes.hardwareApplied,
      usedDirectWebHid: Boolean(this.lcdDevice?.opened),
      packetHex: syncRes.packetHex,
      config: nextState,
      rawConfig: this.getRawConfigBuffer(),
      error: syncRes.error,
    };
  }

  /**
   * 1-Click Hardware Key & EEPROM Config Repair for Zuoya GMK87 (PID 0x5055):
   * 1. Restores clean 48B 0xFF1C EEPROM config (cfg[0] = 0x01, cfg[9..27] = 0x00) to wipe any
   *    corrupted ClassA bytes at cfg[19..22] (using silent permitted WebHID AND/OR Local USB Bridge).
   * 2. Restores all 87 physical keys + 3 rotary encoder actions across all 4 VIA layers (0xFF60)
   *    to exact factory defaults via batchSetViaKeycodes (0x05).
   */
  public async repairKeyboardKeysAndConfig(
    baseState: Gmk87ConfigState
  ): Promise<{
    success: boolean;
    eepromRepaired: boolean;
    viaKeysRestored: number;
    config: Gmk87ConfigState;
    rawConfig: Uint8Array;
    keymap: number[][][];
    packetHex: string;
    message: string;
  }> {
    const now = new Date();
    const cleanState: Gmk87ConfigState = {
      ...baseState,
      clockDate: now,
    };
    const factoryKeymap = createDefaultKeymap();
    let eepromRepaired = false;
    let lastPacketHex = '';

    // 1. Repair 0xFF1C EEPROM (cfg[0]=0x01, cfg[9..27]=0x00) via silent WebHID if permitted in browser
    //    (guarantees immediate wipe of cfg[19..22] even if local PowerShell bridge wasn't restarted yet)
    let openedTempWebHidLcd = false;
    if (this.isWebHidSupported() && !this.lcdDevice?.opened) {
      try {
        const navHid = (navigator as any).hid;
        const permitted: HidDevice[] = await navHid.getDevices();
        const lcdDev = permitted.find(
          (d) =>
            d.vendorId === GMK87_VENDOR_ID &&
            d.productId === GMK87_PRODUCT_ID &&
            d.collections?.some((c) => c.usagePage === LCD_USAGE_PAGE)
        );
        if (lcdDev) {
          if (!lcdDev.opened) await lcdDev.open();
          this.lcdDevice = lcdDev;
          openedTempWebHidLcd = true;
        }
      } catch {
        // Ignore if already claimed by bridge
      }
    }

    if (this.lcdDevice?.opened) {
      try {
        this.configBuffer = serializeConfigBuffer(cleanState, this.configBuffer);
        this.configBuffer[0] = 0x01;
        this.configBuffer.fill(0x00, 9, 28);

        await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
        for (let pos = 0; pos < this.configBuffer.length; pos += 56) {
          const slice = this.configBuffer.subarray(pos, Math.min(pos + 56, this.configBuffer.length));
          const res = await this.transactWebHidLcd(LcdCommand.WRITE_CONFIG, pos, slice, true);
          lastPacketHex = formatPacketHex(res.fullPacket64, 16);
        }
        await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);
        eepromRepaired = true;
      } catch {
        // Fall through to bridge write
      } finally {
        if (openedTempWebHidLcd && this.isBridgeActive() && this.lcdDevice?.opened) {
          await this.lcdDevice.close().catch(() => {});
          this.lcdDevice = null;
        }
      }
    }

    // Also repair via Local USB Bridge if active
    if (this.isBridgeActive()) {
      try {
        const bridgeHex = await this.writeConfig(cleanState);
        if (bridgeHex) lastPacketHex = bridgeHex;
        this.configBuffer[0] = 0x01;
        this.configBuffer.fill(0x00, 9, 28);
        eepromRepaired = true;
      } catch {
        // Ignore if WebHID already repaired it
      }
    }

    // 2. Build factory default VIA keycode batch across all 4 layers for all physical keys + rotary knob
    const entries: ViaBatchEntry[] = [];
    for (let layer = 0; layer < 4; layer++) {
      for (const keyDef of GMK87_PHYSICAL_KEYS) {
        const keycode = factoryKeymap[layer]?.[keyDef.row]?.[keyDef.col] ?? 0x0000;
        entries.push({
          layer,
          row: keyDef.row,
          col: keyDef.col,
          keycode,
        });
      }
    }

    const viaRes = await this.batchSetViaKeycodes(entries);
    const viaKeysRestored = viaRes.hardwareApplied ? viaRes.appliedCount : 0;
    if (viaRes.lastPacketHex) {
      lastPacketHex = viaRes.lastPacketHex;
    }

    const success = eepromRepaired || viaRes.hardwareApplied;
    const msg = success
      ? `Repaired GMK87 Keys & EEPROM: Cleared cfg[9..27]=0x00, restored cfg[0]=0x01${
          viaKeysRestored > 0 ? `, and flashed ${viaKeysRestored} factory VIA keycodes across Layers 0–3` : ''
        }`
      : 'Reset studio keymap to factory defaults (connect USB to flash keyboard EEPROM)';

    return {
      success,
      eepromRepaired,
      viaKeysRestored,
      config: cleanState,
      rawConfig: this.getRawConfigBuffer(),
      keymap: factoryKeymap,
      packetHex: lastPacketHex,
      message: msg,
    };
  }

  /**
   * Synchronizes the hardware BCD clock registers (cfg[35..41]) AND enables the ClassA/ClassB
   * clock display flags (cfg[21]=1, cfg[22]=0, cfg[33]=0 when switchToClockMode=true).
   * If WebHID (0xFF1C) is also open in the browser, writes the full patched 48B ClassA+ClassB
   * config directly so the fix works even before restarting a local PowerShell bridge!
   */
  public async syncClockNow(
    clockDate: Date = new Date(),
    switchToClockMode = true
  ): Promise<{
    success: boolean;
    hardwareApplied: boolean;
    bridgeDetected?: boolean;
    packetHex: string;
    config?: Gmk87ConfigState;
    error?: string;
  }> {
    // If WebHID is open, prefer direct WebHID write first so ClassA bytes (cfg[19..22]) are guaranteed written
    // even if the local Windows bridge is running an older build prior to git pull.
    if (this.lcdDevice?.opened) {
      try {
        const liveState = await this.readWebHidConfig().catch(() =>
          parseConfigBuffer(this.configBuffer)
        );
        const updatedState: Gmk87ConfigState = {
          ...liveState,
          activeScreenMode: switchToClockMode ? 0 : liveState.activeScreenMode,
          clockDate,
        };
        this.configBuffer = serializeConfigBuffer(updatedState, this.configBuffer);

        const initRes = await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
        if (!initRes.ackReceived) {
          throw new Error('WebHID INIT (0x01) timeout while syncing clock');
        }
        let lastHex = '';
        for (let pos = 0; pos < this.configBuffer.length; pos += 56) {
          const slice = this.configBuffer.subarray(pos, Math.min(pos + 56, this.configBuffer.length));
          const res = await this.transactWebHidLcd(LcdCommand.WRITE_CONFIG, pos, slice, true);
          if (!res.ackReceived) {
            throw new Error(`WebHID WRITE_CONFIG (0x06) timeout at offset ${pos}`);
          }
          lastHex = formatPacketHex(res.fullPacket64, 16);
        }
        const commitRes = await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);
        if (!commitRes.ackReceived) {
          throw new Error('WebHID COMMIT (0x02) timeout while syncing clock');
        }
        return {
          success: true,
          hardwareApplied: true,
          bridgeDetected: false,
          packetHex: lastHex,
          config: updatedState,
        };
      } catch {
        // Fall through to USB Bridge if WebHID write failed
      }
    }

    let bridgeError = '';
    try {
      const payload: Record<string, number> = {
        clockTimestampMs: clockDate.getTime(),
      };
      if (switchToClockMode) {
        payload.activeScreenMode = 0;
      }
      const resp = await fetch(this.getBridgeUrl('/api/hid/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await resp.json();
        if (resp.ok && data.success) {
          this.bridgeActive = true;
          this.bridgeLcdConnected = true;
          const parsedConfig = data.config
            ? parsedPayloadToConfigState(data.config, clockDate)
            : undefined;
          if (Array.isArray(data.rawConfig)) {
            this.configBuffer = new Uint8Array(data.rawConfig);
            this.hasReadHardwareConfig = true;
          } else if (parsedConfig) {
            this.configBuffer = serializeConfigBuffer(parsedConfig, this.configBuffer);
          }
          return {
            success: true,
            hardwareApplied: true,
            bridgeDetected: true,
            packetHex: data.packetHex || '04 ... 06',
            config: parsedConfig,
          };
        }
        bridgeError = data?.error || `Bridge clock sync failed (HTTP ${resp.status})`;
      }
    } catch (err: any) {
      bridgeError = err?.message || 'Local USB bridge unreachable';
    }

    return {
      success: false,
      hardwareApplied: false,
      packetHex: '',
      error: bridgeError || 'Zuoya GMK87 not detected in wired USB mode',
    };
  }

  /**
   * Writes the configuration buffer cleanly (preserving unknown fields + frameDurationMs >= 60):
   * Prefers direct WebHID (0x01 -> 0x06 -> 0x02) when open in the browser so ClassA+ClassB bytes
   * are always written with the latest protocol, or uses the local USB bridge when available.
   */
  public async writeConfig(state: Gmk87ConfigState): Promise<string> {
    if (this.lcdDevice?.opened) {
      if (!this.hasReadHardwareConfig) {
        await this.readWebHidConfig().catch(() => null);
      }
      const liveState: Gmk87ConfigState = { ...state, clockDate: new Date() };
      this.configBuffer = serializeConfigBuffer(
        liveState,
        this.hasReadHardwareConfig ? this.configBuffer : null
      );

      const initRes = await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
      if (!initRes.ackReceived) {
        throw new Error('WebHID INIT (0x01) did not acknowledge config write');
      }
      let lastHex = '';
      for (let pos = 0; pos < this.configBuffer.length; pos += 56) {
        const slice = this.configBuffer.subarray(pos, Math.min(pos + 56, this.configBuffer.length));
        const res = await this.transactWebHidLcd(LcdCommand.WRITE_CONFIG, pos, slice, true);
        if (!res.ackReceived) {
          throw new Error(`WebHID WRITE_CONFIG (0x06) did not acknowledge offset ${pos}`);
        }
        lastHex = formatPacketHex(res.fullPacket64, 16);
      }
      const commitRes = await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);
      if (!commitRes.ackReceived) {
        throw new Error('WebHID COMMIT (0x02) did not acknowledge config write');
      }
      return lastHex;
    }

    if (this.isBridgeActive()) {
      const resp = await fetch(this.getBridgeUrl('/api/hid/config'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lightingEffect: state.lightingEffect,
          brightness: state.brightness,
          speed: state.speed,
          effectDirection: state.effectDirection ?? 0,
          rainbowMode: state.rainbowMode ?? 0,
          rgbHueR: state.rgbHueR,
          rgbHueG: state.rgbHueG,
          rgbHueB: state.rgbHueB,
          logoMode: state.logoMode,
          logoBrightness: state.logoBrightness,
          logoRainbow: state.logoRainbow,
          logoColor: state.logoColor,
          activeScreenMode: state.activeScreenMode,
          slot0FrameCount: state.slot0FrameCount,
          slot1FrameCount: state.slot1FrameCount,
          frameDurationMs: Math.max(MIN_FRAME_DURATION_MS, state.frameDurationMs ?? 100),
          clockTimestampMs: Date.now(),
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data?.success) {
        throw new Error(data?.error || `USB Bridge config write failed (HTTP ${resp.status})`);
      }
      if (Array.isArray(data.rawConfig)) {
        this.configBuffer = new Uint8Array(data.rawConfig);
        this.hasReadHardwareConfig = true;
      } else if (data.config) {
        this.configBuffer = serializeConfigBuffer(
          { ...state, clockDate: new Date() },
          this.configBuffer
        );
      }
      return data.packetHex || '04 ... 06';
    }

    const liveState: Gmk87ConfigState = { ...state, clockDate: new Date() };
    this.configBuffer = serializeConfigBuffer(
      liveState,
      this.hasReadHardwareConfig ? this.configBuffer : null
    );

    const initRes = await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
    let lastHex = '';
    for (let pos = 0; pos < this.configBuffer.length; pos += 56) {
      const slice = this.configBuffer.subarray(pos, Math.min(pos + 56, this.configBuffer.length));
      const res = await this.transactWebHidLcd(LcdCommand.WRITE_CONFIG, pos, slice, true);
      lastHex = formatPacketHex(res.fullPacket64, 16);
    }
    await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);
    void initRes;
    return lastHex;
  }

  /**
   * Streams 1..36 240x135 RGB565 frames (65,536B padded each) to GMK87 SPI NOR flash.
   * Slot 0 supports up to 36 frames; Slot 1 supports up to 35 frames (preserving >= 1 frame in Slot 0)
   * using contiguous SPI flash upload layout starting at pos = 0.
   */
  public async uploadFramesToLcd(
    frames: ImageData[],
    targetSlot: 0 | 1,
    configState: Gmk87ConfigState,
    onProgress: (info: UploadProgressInfo, currentFrameImageData?: ImageData) => void,
    useDithering = false
  ): Promise<{ success: boolean; config?: Gmk87ConfigState; error?: string }> {
    if (this.isUploading) {
      return { success: false, error: 'Upload already in progress' };
    }
    this.isUploading = true;

    try {
      const cappedFrames = frames.slice(0, MAX_TOTAL_FRAMES);
      const encodedTarget = cappedFrames.map((img) => encodeImageDataToRGB565Frame(img, useDithering));
      const usableTarget =
        targetSlot === 1 ? encodedTarget.slice(0, MAX_TOTAL_FRAMES - 1) : encodedTarget;
      const frameCount = Math.max(1, usableTarget.length);
      this.cachedSlotFrames[targetSlot] = usableTarget;
      void saveSlotToIndexedDB(targetSlot, usableTarget);

      // Via Local USB Bridge: stream via Worker Thread -> node-hid while polling live progress
      if (this.isBridgeActive()) {
        const framesBase64 = usableTarget.map((buf) => uint8ToBase64(buf.subarray(0, RAW_FRAME_BYTES)));
        let polling = true;

        const pollTimer = setInterval(async () => {
          if (!polling) return;
          try {
            const pResp = await fetch(this.getBridgeUrl('/api/hid/upload-progress'));
            if (pResp.ok) {
              const pData = await pResp.json();
              if (pData && pData.phase && pData.phase !== 'idle') {
                const frameIdx = Math.max(
                  0,
                  Math.min(cappedFrames.length - 1, (pData.currentFrame || 1) - 1)
                );
                onProgress(pData, cappedFrames[frameIdx]);
              }
            }
          } catch {
            // ignore transient polling error
          }
        }, 120);

        try {
          const uploadResp = await fetch(this.getBridgeUrl('/api/hid/upload'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetSlot,
              frameDurationMs: Math.max(MIN_FRAME_DURATION_MS, configState.frameDurationMs ?? 100),
              config: {
                lightingEffect: configState.lightingEffect,
                brightness: configState.brightness,
                speed: configState.speed,
                effectDirection: configState.effectDirection ?? 0,
                rainbowMode: configState.rainbowMode ?? 0,
                rgbHueR: configState.rgbHueR,
                rgbHueG: configState.rgbHueG,
                rgbHueB: configState.rgbHueB,
                logoMode: configState.logoMode,
                logoBrightness: configState.logoBrightness,
                logoRainbow: configState.logoRainbow,
                logoColor: configState.logoColor,
                clockTimestampMs: Date.now(),
              },
              framesBase64,
            }),
          });
          const resData = await uploadResp.json();
          polling = false;
          clearInterval(pollTimer);

          if (!uploadResp.ok || !resData.success) {
            throw new Error(resData.error || `HTTP ${uploadResp.status} bridge upload failed`);
          }

          if (resData.slotCache && typeof resData.slotCache === 'object') {
            this.bridgeSlotCache = {
              slot0Frames: Number(resData.slotCache.slot0Frames) || 0,
              slot1Frames: Number(resData.slotCache.slot1Frames) || 0,
            };
          }

          let returnedConfig: Gmk87ConfigState | undefined;
          if (resData.config) {
            returnedConfig = parsedPayloadToConfigState(resData.config);
            this.configBuffer = Array.isArray(resData.rawConfig)
              ? new Uint8Array(resData.rawConfig)
              : serializeConfigBuffer(returnedConfig, this.configBuffer);
            this.hasReadHardwareConfig = true;
          }

          onProgress(
            {
              phase: 'complete',
              bytesSent: resData.uploadedBytes || frameCount * PADDED_FRAME_BYTES,
              totalBytes: resData.uploadedBytes || frameCount * PADDED_FRAME_BYTES,
              currentFrame: frameCount,
              totalFrames: frameCount,
              lastPacketHex: resData.lastPacketHex || '04 27 00 02 00 00 00 00',
              message: `USB Bridge flashed ${frameCount} frame(s)${
                useDithering ? ' (Dithered RGB565)' : ''
              } to Slot ${targetSlot}`,
            },
            cappedFrames[0]
          );
          return { success: true, config: returnedConfig };
        } finally {
          polling = false;
          clearInterval(pollTimer);
        }
      }

      // Direct WebHID or Simulation Mode (lazily hydrate other slot from IndexedDB across reloads)
      const otherSlot: 0 | 1 = targetSlot === 0 ? 1 : 0;
      if (!this.cachedSlotFrames[otherSlot]) {
        this.cachedSlotFrames[otherSlot] = await loadSlotFromIndexedDB(otherSlot);
      }

      if (this.lcdDevice?.opened && !this.hasReadHardwareConfig) {
        await this.readWebHidConfig();
      }

      let uploadFramesList: Uint8Array[];
      let slot0Count: number;
      let slot1Count: number;

      if (targetSlot === 0) {
        const slot1Suffix = this.cachedSlotFrames[1] || [];
        const maxSlot1 = Math.max(0, MAX_TOTAL_FRAMES - usableTarget.length);
        const usableSlot1 = slot1Suffix.slice(0, maxSlot1);
        if (this.cachedSlotFrames[1]) {
          this.cachedSlotFrames[1] = usableSlot1;
        }
        uploadFramesList = [...usableTarget, ...usableSlot1];
        slot0Count = usableTarget.length;
        slot1Count = Math.max(1, usableSlot1.length);
      } else {
        const slot0Prefix = this.cachedSlotFrames[0] || [new Uint8Array(PADDED_FRAME_BYTES)];
        const maxSlot0 = Math.max(1, MAX_TOTAL_FRAMES - usableTarget.length);
        const usableSlot0 = slot0Prefix.slice(0, maxSlot0);
        if (this.cachedSlotFrames[0]) {
          this.cachedSlotFrames[0] = usableSlot0;
        }
        uploadFramesList = [...usableSlot0, ...usableTarget];
        slot0Count = usableSlot0.length;
        slot1Count = usableTarget.length;
      }

      const updatedConfig: Gmk87ConfigState = {
        ...configState,
        activeScreenMode: targetSlot === 0 ? 1 : 2,
        slot0FrameCount: slot0Count,
        slot1FrameCount: slot1Count,
        frameDurationMs: Math.max(MIN_FRAME_DURATION_MS, configState.frameDurationMs ?? 100),
        clockDate: new Date(),
      };

      const totalBytes = uploadFramesList.length * PADDED_FRAME_BYTES;

      // Step 1: Write updated config (0x01 -> 0x06 -> 0x02)
      const cfgHex = await this.writeConfig(updatedConfig);

      onProgress({
        phase: 'config',
        bytesSent: 0,
        totalBytes,
        currentFrame: 1,
        totalFrames: uploadFramesList.length,
        lastPacketHex: cfgHex,
        message: 'Step 1/4: Wrote hardware Config (0x01 -> 0x06 -> 0x02)',
      });

      // Step 2: Send 0x23 (Ready for Upload, pos = 0) and wait for flash-erase IN ACK
      const webHidActive = Boolean(this.lcdDevice?.opened);
      onProgress({
        phase: 'ready',
        bytesSent: 0,
        totalBytes,
        currentFrame: 1,
        totalFrames: uploadFramesList.length,
        lastPacketHex: cfgHex,
        message: `Step 2/4: Erasing LCD SPI flash for ${uploadFramesList.length} frame(s) (0x23)...`,
      });

      const readyRes = await this.transactWebHidLcd(
        LcdCommand.READY_UPLOAD,
        0,
        undefined,
        webHidActive,
        30000
      );
      if (webHidActive && !readyRes.ackReceived) {
        throw new Error('GMK87 timed out waiting for 0x23 flash-erase ACK before streaming');
      }

      let bytesSent = 0;

      // Step 3: Stream 56-byte chunks starting at pos = 0 (strictly ACKed on every packet in WebHID)
      for (let f = 0; f < uploadFramesList.length; f++) {
        const frameBuf = uploadFramesList[f];
        const frameStartOffset = f * PADDED_FRAME_BYTES;
        const previewImg =
          targetSlot === 0
            ? cappedFrames[Math.min(f, cappedFrames.length - 1)]
            : cappedFrames[Math.max(0, Math.min(cappedFrames.length - 1, f - slot0Count))];

        let posInFrame = 0;
        let chunkCounter = 0;
        while (posInFrame < PADDED_FRAME_BYTES) {
          const chunkLen = Math.min(56, PADDED_FRAME_BYTES - posInFrame);
          const chunkData = frameBuf.subarray(posInFrame, posInFrame + chunkLen);
          const globalOffset = frameStartOffset + posInFrame;

          const pkt = await this.transactWebHidLcd(
            LcdCommand.FRAME_CHUNK,
            globalOffset,
            chunkData,
            webHidActive,
            8000,
            webHidActive
          );
          if (webHidActive && !pkt.ackReceived) {
            throw new Error(`GMK87 timed out waiting for 0x21 ACK at offset ${globalOffset}`);
          }

          posInFrame += chunkLen;
          bytesSent += chunkLen;
          chunkCounter++;

          if (chunkCounter === 1 || chunkCounter % 16 === 0 || posInFrame >= PADDED_FRAME_BYTES) {
            onProgress(
              {
                phase: 'streaming',
                bytesSent,
                totalBytes,
                currentFrame: f + 1,
                totalFrames: uploadFramesList.length,
                lastPacketHex: formatPacketHex(pkt.fullPacket64, 14),
                message: `Step 3/4: Streaming 56B RGB565 chunks (Frame ${f + 1}/${
                  uploadFramesList.length
                })`,
              },
              previewImg
            );
            if (!webHidActive) {
              await new Promise((r) => setTimeout(r, 4));
            }
          }
        }
      }

      // Step 4: Send 0x02 (Commit with 100ms settle wait)
      const commitRes = await this.transactWebHidLcd(
        LcdCommand.COMMIT,
        0,
        undefined,
        webHidActive,
        8000
      );
      if (webHidActive && !commitRes.ackReceived) {
        throw new Error('GMK87 did not acknowledge final COMMIT (0x02) after streaming');
      }
      await new Promise((r) => setTimeout(r, 100));

      // Re-stamp hardware RTC so multi-second SPI transfer adds zero clock lag
      if (webHidActive) {
        await this.writeConfig({ ...updatedConfig, clockDate: new Date() }).catch(() => {});
      }

      onProgress(
        {
          phase: 'complete',
          bytesSent: totalBytes,
          totalBytes,
          currentFrame: uploadFramesList.length,
          totalFrames: uploadFramesList.length,
          lastPacketHex: formatPacketHex(commitRes.fullPacket64, 16),
          message: `Flashed ${frameCount} frame(s)${
            useDithering ? ' (Dithered RGB565)' : ''
          } (${Math.round(totalBytes / 1024)} KB) to Slot ${targetSlot}`,
        },
        cappedFrames[0]
      );
      return { success: true, config: updatedConfig };
    } catch (err: any) {
      const errorMsg = err?.message || 'Unknown HID error';
      onProgress({
        phase: 'error',
        bytesSent: 0,
        totalBytes: 0,
        currentFrame: 0,
        totalFrames: frames.length,
        lastPacketHex: 'ERR',
        message: `Upload failed: ${errorMsg}`,
      });
      return { success: false, error: errorMsg };
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * VIA Set Keycode Command 0x05 ([0x05, layer, row, col, keycodeHi, keycodeLo])
   */
  public async setViaKeycode(
    layer: number,
    row: number,
    col: number,
    keycode: number
  ): Promise<{ packetHex: string; hardwareApplied: boolean }> {
    const packet = new Uint8Array(32);
    packet[0] = 0x05; // DYNAMIC_KEYMAP_SET_KEYCODE
    packet[1] = layer & 0x03;
    packet[2] = row & 0x07;
    packet[3] = col & 0x0f;
    packet[4] = (keycode >> 8) & 0xff;
    packet[5] = keycode & 0xff;

    if (this.isBridgeActive()) {
      try {
        const resp = await fetch(this.getBridgeUrl('/api/hid/keymap/set'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layer, row, col, keycode }),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success) {
            return {
              packetHex: data.packetHex || formatPacketHex(packet, 8),
              hardwareApplied: true,
            };
          }
        }
      } catch {
        // Fallback to WebHID if present
      }
    }

    if (this.viaDevice?.opened) {
      const l = layer & 0x03;
      const r = row & 0x07;
      const c = col & 0x0f;
      const replyPromise = this.waitForInputReport(
        this.viaDevice,
        (_rid, data) =>
          data.length >= 4 && data[0] === 0x05 && data[1] === l && data[2] === r && data[3] === c,
        600
      );
      await this.viaDevice.sendReport(VIA_REPORT_ID, packet);
      const reply = await replyPromise;
      return { packetHex: formatPacketHex(packet, 8), hardwareApplied: Boolean(reply) };
    }

    return { packetHex: formatPacketHex(packet, 8), hardwareApplied: false };
  }

  /**
   * Batch programs multiple VIA keycodes in a single worker transaction (for Smart Knob,
   * .gmk87.json Profile Import, and Reset Default).
   */
  public async batchSetViaKeycodes(entries: ViaBatchEntry[]): Promise<{
    success: boolean;
    appliedCount: number;
    lastPacketHex: string;
    hardwareApplied: boolean;
  }> {
    if (!entries || entries.length === 0) {
      return { success: true, appliedCount: 0, lastPacketHex: '', hardwareApplied: false };
    }

    if (this.isBridgeActive()) {
      try {
        const resp = await fetch(this.getBridgeUrl('/api/hid/keymap/batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entries }),
          signal: AbortSignal.timeout(20000),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.success) {
          return {
            success: true,
            appliedCount: Number(data.appliedCount) || entries.length,
            lastPacketHex: data.lastPacketHex || '',
            hardwareApplied: true,
          };
        }
      } catch {
        // Fall through
      }
    }

    if (this.viaDevice?.opened) {
      let appliedCount = 0;
      let lastPacketHex = '';
      for (const entry of entries) {
        const res = await this.setViaKeycode(entry.layer, entry.row, entry.col, entry.keycode);
        if (res.hardwareApplied) appliedCount++;
        lastPacketHex = res.packetHex;
      }
      return {
        success: appliedCount > 0,
        appliedCount,
        lastPacketHex,
        hardwareApplied: appliedCount > 0,
      };
    }

    const last = entries[entries.length - 1];
    const pkt = new Uint8Array([
      0x05,
      last.layer & 0x03,
      last.row & 0x07,
      last.col & 0x0f,
      (last.keycode >> 8) & 0xff,
      last.keycode & 0xff,
    ]);
    return {
      success: true,
      appliedCount: entries.length,
      lastPacketHex: formatPacketHex(pkt, 6),
      hardwareApplied: false,
    };
  }

  /**
   * VIA Read Keymap Buffer Command 0x12 ([0x12, offsetHi, offsetLo, size])
   * Reads 28-byte chunks up to 4 * 8 * 15 * 2 = 960 bytes AND decodes actual keymap[][][].
   */
  public async readViaKeymapBuffer(): Promise<{
    totalBytes: number;
    chunksRead: number;
    lastCmdHex: string;
    viaProtocol: number;
    keymap: number[][][] | null;
    mangledDetected?: boolean;
  }> {
    const TOTAL_KEYMAP_BYTES = VIA_KEYMAP_BYTES; // 960 bytes
    const CHUNK_SIZE = 28;

    if (this.isBridgeActive()) {
      try {
        const resp = await fetch(this.getBridgeUrl('/api/hid/keymap'), {
          signal: AbortSignal.timeout(8000),
        });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && Array.isArray(data.keymap)) {
            this.bridgeViaProtocol = Number(data.viaProtocol) || 9;
            const mangled = isKeymapMangled(data.keymap);
            return {
              totalBytes: TOTAL_KEYMAP_BYTES,
              chunksRead: Math.ceil(TOTAL_KEYMAP_BYTES / CHUNK_SIZE),
              lastCmdHex: '12 03 A4 10 (USB Bridge)',
              viaProtocol: this.bridgeViaProtocol,
              keymap: mangled ? createDefaultKeymap() : data.keymap,
              mangledDetected: mangled,
            };
          }
        }
      } catch {
        // Fall through to WebHID
      }
    }

    if (this.viaDevice?.opened) {
      let viaProtocol = 9;
      const verReq = new Uint8Array(32);
      verReq[0] = 0x01;
      const verPromise = this.waitForInputReport(
        this.viaDevice,
        (_rid, data) => data.length >= 3 && data[0] === 0x01,
        500
      );
      await this.viaDevice.sendReport(VIA_REPORT_ID, verReq);
      const verResp = await verPromise;
      if (verResp) {
        viaProtocol = (verResp[1] << 8) | verResp[2] || 9;
        this.bridgeViaProtocol = viaProtocol;
      }

      const buffer = new Uint8Array(TOTAL_KEYMAP_BYTES);
      let offset = 0;
      let chunksRead = 0;
      let validChunks = 0;
      let lastCmdHex = '';

      while (offset < TOTAL_KEYMAP_BYTES) {
        const size = Math.min(CHUNK_SIZE, TOTAL_KEYMAP_BYTES - offset);
        const hi = (offset >> 8) & 0xff;
        const lo = offset & 0xff;
        const packet = new Uint8Array(32);
        packet[0] = 0x12; // DYNAMIC_KEYMAP_GET_BUFFER
        packet[1] = hi;
        packet[2] = lo;
        packet[3] = size & 0xff;

        const replyPromise = this.waitForInputReport(
          this.viaDevice,
          (_rid, data) =>
            data.length >= 4 + size && data[0] === 0x12 && data[1] === hi && data[2] === lo,
          700
        );
        await this.viaDevice.sendReport(VIA_REPORT_ID, packet);
        const reply = await replyPromise;
        if (reply) {
          buffer.set(reply.subarray(4, 4 + size), offset);
          validChunks++;
        }
        lastCmdHex = formatPacketHex(packet, 6);
        offset += size;
        chunksRead++;
      }

      const decoded = validChunks === chunksRead ? decodeViaKeymapBytes(buffer) : null;
      const mangled = !decoded || isKeymapMangled(decoded);

      return {
        totalBytes: TOTAL_KEYMAP_BYTES,
        chunksRead,
        lastCmdHex,
        viaProtocol,
        keymap: mangled ? createDefaultKeymap() : decoded,
        mangledDetected: mangled,
      };
    }

    // Simulation fallback
    let offset = 0;
    let chunksRead = 0;
    let lastCmdHex = '';
    while (offset < TOTAL_KEYMAP_BYTES) {
      const size = Math.min(CHUNK_SIZE, TOTAL_KEYMAP_BYTES - offset);
      const packet = new Uint8Array(32);
      packet[0] = 0x12;
      packet[1] = (offset >> 8) & 0xff;
      packet[2] = offset & 0xff;
      packet[3] = size & 0xff;
      lastCmdHex = formatPacketHex(packet, 6);
      offset += size;
      chunksRead++;
    }

    return {
      totalBytes: TOTAL_KEYMAP_BYTES,
      chunksRead,
      lastCmdHex,
      viaProtocol: 9,
      keymap: null,
    };
  }

  /**
   * Probes VIA Dynamic Macros (0x0C GetCount, 0x0D GetBufferSize, 0x0E GetBuffer).
   * Stock V0104 firmware may report 0 slots; handled gracefully without errors.
   */
  public async readViaMacros(): Promise<ViaMacroReadResult> {
    if (this.isBridgeActive()) {
      try {
        const resp = await fetch(this.getBridgeUrl('/api/hid/macros'), {
          signal: AbortSignal.timeout(5000),
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data) return data;
      } catch {
        // fallback below
      }
    }

    if (this.viaDevice?.opened) {
      const reqCount = new Uint8Array(32);
      reqCount[0] = 0x0c;
      const pCount = this.waitForInputReport(
        this.viaDevice,
        (_rid, d) => d.length >= 2 && d[0] === 0x0c,
        400
      );
      await this.viaDevice.sendReport(VIA_REPORT_ID, reqCount);
      const rCount = await pCount;
      if (!rCount) {
        return {
          success: true,
          supported: false,
          viaProtocol: this.bridgeViaProtocol || 9,
          count: 0,
          bufferSize: 0,
          macros: [],
          error: 'Firmware did not respond to VIA Macro GetCount (0x0C)',
        };
      }
      const count = rCount[1] & 0xff;
      const reqSize = new Uint8Array(32);
      reqSize[0] = 0x0d;
      const pSize = this.waitForInputReport(
        this.viaDevice,
        (_rid, d) => d.length >= 3 && d[0] === 0x0d,
        400
      );
      await this.viaDevice.sendReport(VIA_REPORT_ID, reqSize);
      const rSize = await pSize;
      const bufferSize = rSize ? ((rSize[1] & 0xff) << 8) | (rSize[2] & 0xff) : 0;
      if (count === 0 || bufferSize === 0 || bufferSize > 4096) {
        return {
          success: true,
          supported: false,
          viaProtocol: this.bridgeViaProtocol || 9,
          count,
          bufferSize,
          macros: [],
        };
      }
      const raw = new Uint8Array(bufferSize);
      for (let off = 0; off < bufferSize; off += 28) {
        const sz = Math.min(28, bufferSize - off);
        const pkt = new Uint8Array(32);
        pkt[0] = 0x0e;
        pkt[1] = (off >> 8) & 0xff;
        pkt[2] = off & 0xff;
        pkt[3] = sz;
        const p = this.waitForInputReport(
          this.viaDevice,
          (_rid, d) => d.length >= 4 + sz && d[0] === 0x0e,
          500
        );
        await this.viaDevice.sendReport(VIA_REPORT_ID, pkt);
        const r = await p;
        if (r) raw.set(r.subarray(4, 4 + sz), off);
      }
      const macros: string[] = [];
      let cur = 0;
      for (let i = 0; i < count; i++) {
        let end = cur;
        while (end < raw.length && raw[end] !== 0) end++;
        let text = '';
        for (let j = cur; j < end; j++) {
          if (raw[j] >= 0x20 && raw[j] <= 0x7e) text += String.fromCharCode(raw[j]);
        }
        macros.push(text);
        cur = Math.min(raw.length, end + 1);
      }
      return {
        success: true,
        supported: true,
        viaProtocol: this.bridgeViaProtocol || 9,
        count,
        bufferSize,
        macros,
      };
    }

    return {
      success: true,
      supported: false,
      viaProtocol: 9,
      count: 0,
      bufferSize: 0,
      macros: [],
      error: 'Connect Zuoya GMK87 via USB to probe VIA Dynamic Macro slots',
    };
  }

  public async writeViaMacros(macros: string[]): Promise<{
    success: boolean;
    writtenMacros: number;
    bufferSize: number;
    error?: string;
  }> {
    if (this.isBridgeActive()) {
      const resp = await fetch(this.getBridgeUrl('/api/hid/macros/set'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ macros }),
      });
      return resp.json();
    }
    return {
      success: false,
      writtenMacros: 0,
      bufferSize: 0,
      error: 'VIA Macro writing requires active USB Bridge connection',
    };
  }
}
