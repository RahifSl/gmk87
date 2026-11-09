/**
 * Zuoya GMK87 Hardware Protocol Engine (Local USB HID Bridge + Browser WebHID)
 * Vendor ID: 0x320F (12815), Product ID: 0x5055 (20565)
 * - LCD Screen Interface: usagePage 0xFF1C (65308), interface 3, Report ID 0x04
 * - VIA Keymap Interface: usagePage 0xFF60 (65376), interface 1, Report ID 0x00
 */

export const GMK87_VENDOR_ID = 0x320f;
export const GMK87_PRODUCT_ID = 0x5055;
export const LCD_USAGE_PAGE = 0xff1c;
export const VIA_USAGE_PAGE = 0xff60;
export const LCD_REPORT_ID = 0x04;
export const VIA_REPORT_ID = 0x00;

export const LCD_WIDTH = 240;
export const LCD_HEIGHT = 135;
export const RAW_FRAME_BYTES = LCD_WIDTH * LCD_HEIGHT * 2; // 64,800 bytes
export const PADDED_FRAME_BYTES = 65536; // 64KB boundary per frame
export const MAX_TOTAL_FRAMES = 36;

export enum LcdCommand {
  INIT = 0x01,
  COMMIT = 0x02,
  PREPARE_READ = 0x03,
  READ_CONFIG = 0x05,
  WRITE_CONFIG = 0x06,
  FRAME_CHUNK = 0x21,
  READY_UPLOAD = 0x23,
}

export interface Gmk87ConfigState {
  lightingEffect: number; // cfg[1]: 0-18 (or up to 20)
  brightness: number; // cfg[2]: 0-9
  speed: number; // cfg[3]: 0-4
  effectDirection?: number; // cfg[4]: 0 = Forward (Right/Down), 1 = Reverse (Left/Up)
  rainbowMode?: number; // cfg[5]: 0 = Custom Single Hue, 1 = Rainbow / Multicolour
  rgbHueR: number; // cfg[6]
  rgbHueG: number; // cfg[7]
  rgbHueB: number; // cfg[8]
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
}

/**
 * BCD Helper: toBcd(n) = ((Math.floor(n / 10) << 4) | (n % 10))
 */
export function toBcd(n: number): number {
  const clamped = Math.max(0, Math.min(99, Math.floor(n)));
  return (Math.floor(clamped / 10) << 4) | (clamped % 10);
}

export function fromBcd(bcd: number): number {
  return ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
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
 * Builds the 64-byte LCD packet (returns the 63-byte payload passed to device.sendReport(0x04, payload),
 * plus the full 64-byte representation for inspection).
 */
export function buildLcdPacket(
  command: LcdCommand | number,
  posOffset: number,
  payload?: Uint8Array
): { reportPayload63: Uint8Array; fullPacket64: Uint8Array; checksum: number } {
  const fullPacket64 = new Uint8Array(64);
  fullPacket64[0] = LCD_REPORT_ID;

  const len = payload ? Math.min(56, payload.length) : 0;
  fullPacket64[3] = command & 0xff;
  fullPacket64[4] = len & 0xff;
  fullPacket64[5] = posOffset & 0xff;
  fullPacket64[6] = (posOffset >> 8) & 0xff;
  fullPacket64[7] = (posOffset >> 16) & 0xff;

  if (payload && len > 0) {
    fullPacket64.set(payload.subarray(0, len), 8);
  }

  let sum = 0;
  for (let i = 3; i < 64; i++) {
    sum += fullPacket64[i];
  }
  const checksum = sum & 0xffff;
  fullPacket64[1] = checksum & 0xff;
  fullPacket64[2] = (checksum >> 8) & 0xff;

  const reportPayload63 = fullPacket64.subarray(1, 64);
  return { reportPayload63, fullPacket64, checksum };
}

export function formatPacketHex(packet: Uint8Array, maxBytes = 16): string {
  const slice = packet.subarray(0, maxBytes);
  return Array.from(slice)
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
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
  const sec = fromBcd(cfg[35] ?? 0);
  const min = fromBcd(cfg[36] ?? 0);
  const hour = fromBcd(cfg[37] ?? 0);
  const day = Math.max(1, Math.min(31, fromBcd(cfg[39] ?? 1) || 1));
  const month = Math.max(1, Math.min(12, fromBcd(cfg[40] ?? 1) || 1));
  const year = 2000 + fromBcd(cfg[41] ?? 26);

  const parsedDate = new Date(year, month - 1, day, hour, min, sec);
  const rawDelay = (cfg[43] ?? 0) | ((cfg[44] ?? 0) << 8);

  return {
    lightingEffect: cfg[1] ?? 1,
    brightness: Math.max(0, Math.min(9, cfg[2] ?? 5)),
    speed: Math.max(0, Math.min(4, cfg[3] ?? 2)),
    effectDirection: (cfg[4] ?? 0) & 0x01,
    rainbowMode: (cfg[5] ?? 0) & 0x01,
    rgbHueR: cfg[6] ?? 255,
    rgbHueG: cfg[7] ?? 255,
    rgbHueB: cfg[8] ?? 255,
    activeScreenMode: Math.max(0, Math.min(2, cfg[33] ?? 1)),
    slot0FrameCount: Math.max(1, cfg[34] || 1),
    slot1FrameCount: Math.max(1, cfg[46] || 1),
    frameDurationMs: Math.max(60, rawDelay || 100),
    clockDate: Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
  };
}

/**
 * Serializes Gmk87ConfigState into a 48-byte or 64-byte config buffer,
 * preserving unknown hardware bytes (logo LED, direction, V0112 protocol selector) when baseBuffer is supplied.
 */
export function serializeConfigBuffer(
  state: Gmk87ConfigState,
  baseBuffer?: Uint8Array | null
): Uint8Array {
  const len = baseBuffer && baseBuffer.length >= 64 ? 64 : 48;
  const cfg = new Uint8Array(len);
  if (baseBuffer) {
    cfg.set(baseBuffer.subarray(0, len), 0);
  }

  cfg[0] = baseBuffer ? baseBuffer[0] : 0x00;
  cfg[1] = Math.max(0, Math.min(18, state.lightingEffect));
  cfg[2] = Math.max(0, Math.min(9, state.brightness));
  cfg[3] = Math.max(0, Math.min(4, state.speed));
  if (state.effectDirection !== undefined) {
    cfg[4] = state.effectDirection ? 1 : 0;
  }
  if (state.rainbowMode !== undefined) {
    cfg[5] = state.rainbowMode ? 1 : 0;
  }
  cfg[6] = state.rgbHueR & 0xff;
  cfg[7] = state.rgbHueG & 0xff;
  cfg[8] = state.rgbHueB & 0xff;

  cfg[33] = Math.max(0, Math.min(2, state.activeScreenMode));
  cfg[34] = Math.max(1, Math.min(255, state.slot0FrameCount));
  cfg[46] = Math.max(1, Math.min(255, state.slot1FrameCount));

  const existingDelay = (cfg[43] ?? 0) | ((cfg[44] ?? 0) << 8);
  const frameDurationMs = Math.max(60, Math.min(65535, state.frameDurationMs ?? (existingDelay || 100)));
  cfg[43] = frameDurationMs & 0xff;
  cfg[44] = (frameDurationMs >> 8) & 0xff;

  const d = state.clockDate;
  cfg[35] = toBcd(d.getSeconds());
  cfg[36] = toBcd(d.getMinutes());
  cfg[37] = toBcd(d.getHours());
  cfg[38] = d.getDay(); // 0=Sunday..6=Saturday matching GMK87 firmware & ConfigClient.cs
  cfg[39] = toBcd(d.getDate());
  cfg[40] = toBcd(d.getMonth() + 1);
  cfg[41] = toBcd(d.getFullYear() % 100);

  // Repair damaged V0112 VIA protocol selector if reading extended 64-byte config
  if (len >= 64 && cfg[0x31] !== 9 && cfg[0x31] !== 11) {
    cfg[0x31] = 11;
  }

  return cfg;
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
  private bridgeActive = false;
  private bridgeLcdConnected = false;
  private bridgeViaConnected = false;
  private bridgeViaProtocol = 9;
  private bridgeFirmwareVersion = '';
  private bridgeDeviceName = 'Zuoya GMK87';
  private configBuffer: Uint8Array;
  private hasReadHardwareConfig = false;
  private isUploading = false;
  private cachedSlotFrames: [Uint8Array[] | null, Uint8Array[] | null] = [null, null];

  constructor(initialConfig: Gmk87ConfigState) {
    this.configBuffer = serializeConfigBuffer(initialConfig);
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

  public getConnectedDeviceName(): string {
    if (this.isBridgeActive()) {
      return `${this.bridgeDeviceName}${this.bridgeFirmwareVersion ? ` (${this.bridgeFirmwareVersion})` : ''}`;
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

  /**
   * Probes the local Node USB HID bridge (/api/hid/status) for zero-click automatic connection.
   */
  public async checkBridgeStatus(forceRefresh = false): Promise<ConnectionResult> {
    try {
      const url = forceRefresh ? '/api/hid/status?refresh=1' : '/api/hid/status';
      const resp = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const contentType = resp.headers.get('content-type') || '';
      if (!resp.ok || !contentType.includes('application/json')) {
        this.bridgeActive = false;
        this.bridgeLcdConnected = false;
        this.bridgeViaConnected = false;
        return {
          connected: Boolean(this.lcdDevice?.opened || this.viaDevice?.opened),
          bridgeAvailable: false,
          lcdConnected: Boolean(this.lcdDevice?.opened),
          viaConnected: Boolean(this.viaDevice?.opened),
          mode: this.lcdDevice?.opened || this.viaDevice?.opened ? 'webhid' : 'simulation',
          viaProtocol: 9,
          deviceName: this.getConnectedDeviceName(),
          message: 'Local USB bridge unavailable; using WebHID / Simulation Mode.',
        };
      }

      const data = await resp.json();
      if (!data.bridgeAvailable) {
        this.bridgeActive = false;
        return {
          connected: false,
          bridgeAvailable: false,
          lcdConnected: false,
          viaConnected: false,
          mode: 'simulation',
          viaProtocol: 9,
          deviceName: 'Simulation Mode',
          message: 'Local USB bridge not active.',
        };
      }

      this.bridgeActive = Boolean(data.connected || data.viaConnected);
      this.bridgeLcdConnected = Boolean(data.connected);
      this.bridgeViaConnected = Boolean(data.viaConnected);
      this.bridgeViaProtocol = Number(data.viaProtocol) || 9;
      this.bridgeFirmwareVersion = data.firmwareVersion || '';
      this.bridgeDeviceName = data.deviceName || 'Zuoya GMK87';

      let parsedConfig: Gmk87ConfigState | undefined;
      if (data.config) {
        parsedConfig = {
          lightingEffect: data.config.lightingEffect,
          brightness: data.config.brightness,
          speed: data.config.speed,
          effectDirection: data.config.effectDirection ?? 0,
          rainbowMode: data.config.rainbowMode ?? 0,
          rgbHueR: data.config.rgbHueR,
          rgbHueG: data.config.rgbHueG,
          rgbHueB: data.config.rgbHueB,
          activeScreenMode: data.config.activeScreenMode,
          slot0FrameCount: data.config.slot0FrameCount,
          slot1FrameCount: data.config.slot1FrameCount,
          frameDurationMs: data.config.frameDurationMs || 100,
          clockDate: data.config.clockTimestampMs
            ? new Date(data.config.clockTimestampMs)
            : new Date(),
        };
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
          message: `USB Bridge Auto-Connected: ${this.bridgeDeviceName} ${this.bridgeFirmwareVersion} (LCD: ${
            this.bridgeLcdConnected ? 'OK' : 'N/A'
          }, VIA P${this.bridgeViaProtocol}: ${this.bridgeViaConnected ? 'OK' : 'N/A'})`,
        };
      }

      return {
        connected: false,
        bridgeAvailable: true,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message:
          data.error ||
          'USB Bridge active, but Zuoya GMK87 (0x320F:0x5055) not detected in wired USB mode.',
      };
    } catch {
      this.bridgeActive = false;
      this.bridgeLcdConnected = false;
      this.bridgeViaConnected = false;
      return {
        connected: Boolean(this.lcdDevice?.opened || this.viaDevice?.opened),
        bridgeAvailable: false,
        lcdConnected: Boolean(this.lcdDevice?.opened),
        viaConnected: Boolean(this.viaDevice?.opened),
        mode: this.lcdDevice?.opened || this.viaDevice?.opened ? 'webhid' : 'simulation',
        viaProtocol: 9,
        deviceName: this.getConnectedDeviceName(),
        message: 'Running without local USB bridge (WebHID / Simulation Mode).',
      };
    }
  }

  /**
   * Requests pairing with Zuoya GMK87 (VID 0x320F, PID 0x5055) via WebHID or refreshes USB bridge.
   * Note: On Windows, 0xFF1C (LCD) and 0xFF60 (VIA) are exposed as two separate HID collections,
   * so clicking Connect when one is paired prompts for the missing interface automatically.
   */
  public async connect(): Promise<ConnectionResult> {
    // Check if local USB bridge already sees the physical keyboard
    const bridge = await this.checkBridgeStatus(true);
    if (bridge.connected) {
      return bridge;
    }

    if (!this.isWebHidSupported()) {
      return {
        connected: false,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message: 'WebHID API unavailable & local bridge not detected. Simulation Mode active.',
      };
    }

    try {
      const navHid = (navigator as any).hid;

      const filters: Array<{ vendorId: number; productId: number; usagePage?: number }> = [];
      if (!this.lcdDevice) {
        filters.push({ vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID, usagePage: LCD_USAGE_PAGE });
      }
      if (!this.viaDevice) {
        filters.push({ vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID, usagePage: VIA_USAGE_PAGE });
      }
      if (filters.length === 0) {
        filters.push({ vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID });
      }

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
        const missingHint =
          this.lcdDevice && !this.viaDevice
            ? ' (LCD connected; click Connect again to pair VIA 0xFF60 if needed)'
            : !this.lcdDevice && this.viaDevice
            ? ' (VIA connected; click Connect again to pair LCD 0xFF1C for screen flashing)'
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

      return {
        connected: false,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message: 'No Zuoya GMK87 selected. Simulation Mode active.',
      };
    } catch (err: any) {
      return {
        connected: false,
        lcdConnected: false,
        viaConnected: false,
        mode: 'simulation',
        viaProtocol: 9,
        deviceName: 'Simulation Mode',
        message: `WebHID pairing skipped (${err?.message || 'cancelled'}). Simulation Mode active.`,
      };
    }
  }

  public async disconnect(): Promise<void> {
    this.bridgeActive = false;
    this.bridgeLcdConnected = false;
    this.bridgeViaConnected = false;
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
   * Reads the real 48-byte (or 64-byte on V0112) config buffer via WebHID 0xFF1C
   */
  public async readWebHidConfig(): Promise<Gmk87ConfigState> {
    if (!this.lcdDevice?.opened) {
      return parseConfigBuffer(this.configBuffer);
    }

    await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
    for (let i = 0; i < 9; i++) {
      await this.transactWebHidLcd(LcdCommand.PREPARE_READ, i * 4, new Uint8Array(4), true);
    }
    await this.transactWebHidLcd(LcdCommand.PREPARE_READ, 36, new Uint8Array(1), true);
    await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);

    const raw48 = new Uint8Array(48);
    for (let i = 0; i < 12; i++) {
      const res = await this.transactWebHidLcd(LcdCommand.READ_CONFIG, i * 4, new Uint8Array(4), true);
      if (res.replyPayload && res.replyPayload.length >= 4) {
        raw48.set(res.replyPayload.subarray(0, 4), i * 4);
      }
    }

    // Probe V0112 extended tail (positions 48..60) with quick timeout
    const probe48 = await this.transactWebHidLcd(
      LcdCommand.READ_CONFIG,
      48,
      new Uint8Array(4),
      true,
      150
    );
    if (probe48.replyPayload && probe48.replyPayload.length >= 4) {
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
        if (res.replyPayload && res.replyPayload.length >= 4) {
          raw64.set(res.replyPayload.subarray(0, 4), pos);
        }
      }
      this.configBuffer = raw64;
    } else {
      this.configBuffer = raw48;
    }

    this.hasReadHardwareConfig = true;
    return parseConfigBuffer(this.configBuffer);
  }

  /**
   * Synchronizes ONLY the hardware BCD clock registers (cfg[35..41]) via local USB bridge or WebHID,
   * preserving all other on-keyboard flash settings (RGB effect, brightness, speed, screen mode).
   */
  public async syncClockNow(clockDate: Date = new Date()): Promise<{
    success: boolean;
    hardwareApplied: boolean;
    bridgeDetected?: boolean;
    packetHex: string;
    config?: Gmk87ConfigState;
    error?: string;
  }> {
    let bridgeError = '';
    try {
      const resp = await fetch('/api/hid/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clockTimestampMs: clockDate.getTime() }),
        signal: AbortSignal.timeout(5000),
      });
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await resp.json();
        if (resp.ok && data.success) {
          this.bridgeActive = true;
          this.bridgeLcdConnected = true;
          const parsedConfig: Gmk87ConfigState | undefined = data.config
            ? {
                lightingEffect: data.config.lightingEffect,
                brightness: data.config.brightness,
                speed: data.config.speed,
                effectDirection: data.config.effectDirection ?? 0,
                rainbowMode: data.config.rainbowMode ?? 0,
                rgbHueR: data.config.rgbHueR,
                rgbHueG: data.config.rgbHueG,
                rgbHueB: data.config.rgbHueB,
                activeScreenMode: data.config.activeScreenMode,
                slot0FrameCount: data.config.slot0FrameCount,
                slot1FrameCount: data.config.slot1FrameCount,
                frameDurationMs: data.config.frameDurationMs || 100,
                clockDate: data.config.clockTimestampMs
                  ? new Date(data.config.clockTimestampMs)
                  : clockDate,
              }
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

    if (this.lcdDevice?.opened) {
      const liveState = await this.readWebHidConfig();
      const updatedState: Gmk87ConfigState = { ...liveState, clockDate };
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
        packetHex: lastHex,
        config: updatedState,
      };
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
   * Uses local USB bridge when available, or WebHID 0x01 -> 0x06 -> 0x02 sequence.
   */
  public async writeConfig(state: Gmk87ConfigState): Promise<string> {
    if (this.isBridgeActive()) {
      const resp = await fetch('/api/hid/config', {
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
          activeScreenMode: state.activeScreenMode,
          slot0FrameCount: state.slot0FrameCount,
          slot1FrameCount: state.slot1FrameCount,
          frameDurationMs: state.frameDurationMs ?? 100,
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
        this.configBuffer = serializeConfigBuffer({ ...state, clockDate: new Date() }, this.configBuffer);
      }
      return data.packetHex || '04 ... 06';
    }

    if (this.lcdDevice?.opened && !this.hasReadHardwareConfig) {
      await this.readWebHidConfig().catch(() => {});
    }

    const liveState: Gmk87ConfigState = { ...state, clockDate: new Date() };
    this.configBuffer = serializeConfigBuffer(liveState, this.hasReadHardwareConfig ? this.configBuffer : null);

    const initRes = await this.transactWebHidLcd(LcdCommand.INIT, 0, undefined, true);
    if (this.lcdDevice?.opened && !initRes.ackReceived) {
      throw new Error('WebHID INIT (0x01) did not acknowledge config write');
    }
    let lastHex = '';
    for (let pos = 0; pos < this.configBuffer.length; pos += 56) {
      const slice = this.configBuffer.subarray(pos, Math.min(pos + 56, this.configBuffer.length));
      const res = await this.transactWebHidLcd(LcdCommand.WRITE_CONFIG, pos, slice, true);
      if (this.lcdDevice?.opened && !res.ackReceived) {
        throw new Error(`WebHID WRITE_CONFIG (0x06) did not acknowledge offset ${pos}`);
      }
      lastHex = formatPacketHex(res.fullPacket64, 16);
    }
    const commitRes = await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, true);
    if (this.lcdDevice?.opened && !commitRes.ackReceived) {
      throw new Error('WebHID COMMIT (0x02) did not acknowledge config write');
    }
    return lastHex;
  }

  /**
   * Streams 1..16 240x135 RGB565 frames (65,536B padded each) to the GMK87 LCD flash memory.
   * Applies Floyd-Steinberg dithering to actual transmitted frames when enabled, and handles
   * both Slot 0 and Slot 1 using the verified contiguous flash upload layout starting at pos = 0.
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

      // Via Local USB Bridge: stream via Express -> node-hid while polling live progress
      if (this.isBridgeActive()) {
        const framesBase64 = usableTarget.map((buf) => uint8ToBase64(buf.subarray(0, RAW_FRAME_BYTES)));
        let polling = true;

        const pollTimer = setInterval(async () => {
          if (!polling) return;
          try {
            const pResp = await fetch('/api/hid/upload-progress');
            if (pResp.ok) {
              const pData = await pResp.json();
              if (pData && pData.phase && pData.phase !== 'idle') {
                const frameIdx = Math.max(0, Math.min(cappedFrames.length - 1, (pData.currentFrame || 1) - 1));
                onProgress(pData, cappedFrames[frameIdx]);
              }
            }
          } catch {
            // ignore transient polling error
          }
        }, 120);

        try {
          const uploadResp = await fetch('/api/hid/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              targetSlot,
              frameDurationMs: Math.max(60, configState.frameDurationMs ?? 100),
              config: {
                lightingEffect: configState.lightingEffect,
                brightness: configState.brightness,
                speed: configState.speed,
                effectDirection: configState.effectDirection ?? 0,
                rainbowMode: configState.rainbowMode ?? 0,
                rgbHueR: configState.rgbHueR,
                rgbHueG: configState.rgbHueG,
                rgbHueB: configState.rgbHueB,
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

          let returnedConfig: Gmk87ConfigState | undefined;
          if (resData.config) {
            returnedConfig = {
              lightingEffect: resData.config.lightingEffect,
              brightness: resData.config.brightness,
              speed: resData.config.speed,
              effectDirection: resData.config.effectDirection ?? 0,
              rainbowMode: resData.config.rainbowMode ?? 0,
              rgbHueR: resData.config.rgbHueR,
              rgbHueG: resData.config.rgbHueG,
              rgbHueB: resData.config.rgbHueB,
              activeScreenMode: resData.config.activeScreenMode,
              slot0FrameCount: resData.config.slot0FrameCount,
              slot1FrameCount: resData.config.slot1FrameCount,
              frameDurationMs: resData.config.frameDurationMs || 100,
              clockDate: resData.config.clockTimestampMs
                ? new Date(resData.config.clockTimestampMs)
                : new Date(),
            };
            this.configBuffer = serializeConfigBuffer(returnedConfig, this.configBuffer);
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

      // Direct WebHID or Simulation Mode
      if (this.lcdDevice?.opened && !this.hasReadHardwareConfig) {
        await this.readWebHidConfig().catch(() => {});
      }

      let uploadFramesList: Uint8Array[];
      let slot0Count: number;
      let slot1Count: number;

      if (targetSlot === 0) {
        const slot1Suffix = this.cachedSlotFrames[1] || [new Uint8Array(PADDED_FRAME_BYTES)];
        const maxSlot1 = Math.max(0, MAX_TOTAL_FRAMES - usableTarget.length);
        const usableSlot1 = slot1Suffix.slice(0, maxSlot1);
        if (usableSlot1.length > 0) {
          this.cachedSlotFrames[1] = usableSlot1;
        }
        uploadFramesList = [...usableTarget, ...usableSlot1];
        slot0Count = usableTarget.length;
        slot1Count = Math.max(1, usableSlot1.length);
      } else {
        const slot0Prefix = this.cachedSlotFrames[0] || [new Uint8Array(PADDED_FRAME_BYTES)];
        const maxSlot0 = Math.max(1, MAX_TOTAL_FRAMES - usableTarget.length);
        const usableSlot0 = slot0Prefix.slice(0, maxSlot0);
        this.cachedSlotFrames[0] = usableSlot0;
        uploadFramesList = [...usableSlot0, ...usableTarget];
        slot0Count = usableSlot0.length;
        slot1Count = usableTarget.length;
      }

      const updatedConfig: Gmk87ConfigState = {
        ...configState,
        activeScreenMode: targetSlot === 0 ? 1 : 2,
        slot0FrameCount: slot0Count,
        slot1FrameCount: slot1Count,
        frameDurationMs: Math.max(60, configState.frameDurationMs ?? 100),
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

      // Step 3: Stream 56-byte chunks starting at pos = 0 (ACKed on every packet in WebHID)
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
                message: `Step 3/4: Streaming 56B RGB565 chunks (Frame ${f + 1}/${uploadFramesList.length})`,
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
      const commitRes = await this.transactWebHidLcd(LcdCommand.COMMIT, 0, undefined, webHidActive, 8000);
      if (webHidActive && !commitRes.ackReceived) {
        throw new Error('GMK87 did not acknowledge final COMMIT (0x02) after streaming');
      }
      await new Promise((r) => setTimeout(r, 100));

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
        const resp = await fetch('/api/hid/keymap/set', {
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
      const replyPromise = this.waitForInputReport(
        this.viaDevice,
        (_rid, data) => data.length > 0 && data[0] === 0x05,
        600
      );
      await this.viaDevice.sendReport(VIA_REPORT_ID, packet);
      await replyPromise;
      return { packetHex: formatPacketHex(packet, 8), hardwareApplied: true };
    }

    return { packetHex: formatPacketHex(packet, 8), hardwareApplied: false };
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
  }> {
    const TOTAL_KEYMAP_BYTES = 4 * 8 * 15 * 2; // 960 bytes
    const CHUNK_SIZE = 28;

    if (this.isBridgeActive()) {
      try {
        const resp = await fetch('/api/hid/keymap', { signal: AbortSignal.timeout(8000) });
        if (resp.ok) {
          const data = await resp.json();
          if (data.success && Array.isArray(data.keymap)) {
            this.bridgeViaProtocol = Number(data.viaProtocol) || 9;
            return {
              totalBytes: TOTAL_KEYMAP_BYTES,
              chunksRead: Math.ceil(TOTAL_KEYMAP_BYTES / CHUNK_SIZE),
              lastCmdHex: '12 03 A4 10 (USB Bridge)',
              viaProtocol: this.bridgeViaProtocol,
              keymap: data.keymap,
            };
          }
        }
      } catch {
        // Fall through to WebHID
      }
    }

    if (this.viaDevice?.opened) {
      // Read protocol version (0x01)
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
      let lastCmdHex = '';

      while (offset < TOTAL_KEYMAP_BYTES) {
        const size = Math.min(CHUNK_SIZE, TOTAL_KEYMAP_BYTES - offset);
        const packet = new Uint8Array(32);
        packet[0] = 0x12; // DYNAMIC_KEYMAP_GET_BUFFER
        packet[1] = (offset >> 8) & 0xff;
        packet[2] = offset & 0xff;
        packet[3] = size & 0xff;

        const replyPromise = this.waitForInputReport(
          this.viaDevice,
          (_rid, data) => data.length >= 4 + size && data[0] === 0x12,
          700
        );
        await this.viaDevice.sendReport(VIA_REPORT_ID, packet);
        const reply = await replyPromise;
        if (reply) {
          buffer.set(reply.subarray(4, 4 + size), offset);
        }
        lastCmdHex = formatPacketHex(packet, 6);
        offset += size;
        chunksRead++;
      }

      const keymap: number[][][] = [];
      for (let l = 0; l < 4; l++) {
        const layer: number[][] = [];
        for (let r = 0; r < 8; r++) {
          const row: number[] = [];
          for (let c = 0; c < 15; c++) {
            const idx = (l * 8 * 15 + r * 15 + c) * 2;
            row.push((buffer[idx] << 8) | buffer[idx + 1]);
          }
          layer.push(row);
        }
        keymap.push(layer);
      }

      return { totalBytes: TOTAL_KEYMAP_BYTES, chunksRead, lastCmdHex, viaProtocol, keymap };
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
}
