/**
 * Shared Zuoya GMK87 Hardware Protocol Codec (Node HID Worker + Browser WebHID + UI)
 * Vendor ID: 0x320F, Product ID: 0x5055
 * - LCD Screen Interface: usagePage 0xFF1C (interface 3 fallback), Report ID 0x04
 * - VIA Keymap Interface: usagePage 0xFF60 (interface 1 fallback), Report ID 0x00
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
export const PADDED_FRAME_BYTES = 65536; // 64KB SPI NOR erase sector boundary per frame
export const MAX_TOTAL_FRAMES = 36;
export const MIN_FRAME_DURATION_MS = 60;

export const VIA_LAYERS = 4;
export const VIA_ROWS = 8;
export const VIA_COLS = 15;
export const VIA_KEYMAP_BYTES = VIA_LAYERS * VIA_ROWS * VIA_COLS * 2; // 960 bytes

export enum LcdCommand {
  INIT = 0x01,
  COMMIT = 0x02,
  PREPARE_READ = 0x03,
  READ_CONFIG = 0x05,
  WRITE_CONFIG = 0x06,
  FRAME_CHUNK = 0x21,
  READY_UPLOAD = 0x23,
}

export interface Gmk87ParsedConfig {
  lightingEffect: number;
  brightness: number;
  speed: number;
  effectDirection: number;
  rainbowMode: number;
  rgbHueR: number;
  rgbHueG: number;
  rgbHueB: number;
  logoMode: number;
  logoBrightness: number;
  logoRainbow: number;
  logoColor: number;
  activeScreenMode: number;
  slot0FrameCount: number;
  slot1FrameCount: number;
  frameDurationMs: number;
  clockIso: string;
  clockTimestampMs: number;
}

export interface Gmk87ConfigPatch {
  lightingEffect?: number;
  brightness?: number;
  speed?: number;
  effectDirection?: number;
  rainbowMode?: number;
  rgbHueR?: number;
  rgbHueG?: number;
  rgbHueB?: number;
  logoMode?: number;
  logoBrightness?: number;
  logoRainbow?: number;
  logoColor?: number;
  activeScreenMode?: number;
  slot0FrameCount?: number;
  slot1FrameCount?: number;
  frameDurationMs?: number;
  clockTimestampMs?: number;
}

export function toBcd(n: number): number {
  const clamped = Math.max(0, Math.min(99, Math.floor(n)));
  return (Math.floor(clamped / 10) << 4) | (clamped % 10);
}

export function fromBcd(bcd: number): number {
  return ((bcd >> 4) & 0x0f) * 10 + (bcd & 0x0f);
}

export function formatRelease(release: number): string {
  if (!release) return 'V0104';
  return 'V' + release.toString(16).toUpperCase().padStart(4, '0');
}

export function formatPacketHex(buf: Uint8Array, maxBytes = 16): string {
  const slice = buf.subarray(0, maxBytes);
  return Array.from(slice)
    .map((b) => (b & 0xff).toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

export function checksum16(pkt64: Uint8Array): number {
  let sum = 0;
  const end = Math.min(64, pkt64.length);
  for (let i = 3; i < end; i++) {
    sum = (sum + (pkt64[i] & 0xff)) & 0xffff;
  }
  return sum;
}

export function buildLcdPacketBytes(
  commandId: LcdCommand | number,
  data?: Uint8Array,
  pos = 0
): Uint8Array {
  const pkt = new Uint8Array(64);
  const len = data ? Math.min(56, data.length) : 0;
  pkt[0] = LCD_REPORT_ID;
  pkt[3] = commandId & 0xff;
  pkt[4] = len & 0xff;
  pkt[5] = pos & 0xff;
  pkt[6] = (pos >> 8) & 0xff;
  pkt[7] = (pos >> 16) & 0xff;
  if (data && len > 0) {
    pkt.set(data.subarray(0, len), 8);
  }
  const chk = checksum16(pkt);
  pkt[1] = chk & 0xff;
  pkt[2] = (chk >> 8) & 0xff;
  return pkt;
}

export function parseRawConfigBytes(cfg: Uint8Array): Gmk87ParsedConfig {
  const sec = Math.max(0, Math.min(59, fromBcd(cfg[35] ?? 0)));
  const min = Math.max(0, Math.min(59, fromBcd(cfg[36] ?? 0)));
  const hour = Math.max(0, Math.min(23, fromBcd(cfg[37] ?? 0)));
  const day = Math.max(1, Math.min(31, fromBcd(cfg[39] ?? 1) || 1));
  const month = Math.max(1, Math.min(12, fromBcd(cfg[40] ?? 1) || 1));
  const year = 2000 + fromBcd(cfg[41] ?? 26);

  const parsedDate = new Date(year, month - 1, day, hour, min, sec);
  const rawDelay = (cfg[43] ?? 0) | ((cfg[44] ?? 0) << 8);
  const rawSpeed = Math.max(0, Math.min(4, cfg[3] ?? 2));

  return {
    lightingEffect: cfg[1] ?? 1,
    brightness: Math.max(0, Math.min(4, cfg[2] ?? 2)),
    speed: 4 - rawSpeed,
    effectDirection: (cfg[4] ?? 0) & 0x01,
    rainbowMode: (cfg[5] ?? 0) !== 0 ? 1 : 0,
    rgbHueR: cfg[6] ?? 255,
    rgbHueG: cfg[7] ?? 255,
    rgbHueB: cfg[8] ?? 255,
    logoMode: Math.max(0, Math.min(4, cfg[28] ?? 0)),
    logoBrightness: Math.max(0, Math.min(4, cfg[29] ?? 4)),
    logoRainbow: (cfg[31] ?? 0) !== 0 ? 1 : 0,
    logoColor: Math.max(0, Math.min(8, cfg[32] ?? 0)),
    activeScreenMode: Math.max(0, Math.min(2, cfg[33] ?? 1)),
    slot0FrameCount: Math.max(1, cfg[34] || 1),
    slot1FrameCount: Math.max(1, cfg[46] || 1),
    frameDurationMs: Math.max(MIN_FRAME_DURATION_MS, rawDelay || 100),
    clockIso: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')} ${String(
      hour
    ).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
    clockTimestampMs: Number.isNaN(parsedDate.getTime()) ? Date.now() : parsedDate.getTime(),
  };
}

export function patchRawConfigBytes(
  base: Uint8Array | null | undefined,
  patch: Gmk87ConfigPatch,
  defaultLen: 48 | 64 = 48
): Uint8Array {
  const targetLen = base && base.length >= 64 ? 64 : base && base.length >= 48 ? 48 : defaultLen;
  const cfg = new Uint8Array(targetLen);
  if (base && base.length > 0) {
    cfg.set(base.subarray(0, targetLen), 0);
  }

  if (patch.lightingEffect !== undefined) {
    cfg[1] = Math.max(0, Math.min(18, Number(patch.lightingEffect)));
  }
  if (patch.brightness !== undefined) {
    cfg[2] = Math.max(0, Math.min(4, Number(patch.brightness)));
  }
  if (patch.speed !== undefined) {
    const uiSpeed = Math.max(0, Math.min(4, Number(patch.speed)));
    cfg[3] = 4 - uiSpeed; // Firmware stores 0=fastest .. 4=slowest
  }
  if (patch.effectDirection !== undefined) {
    cfg[4] = Number(patch.effectDirection) ? 1 : 0;
  }
  if (patch.rainbowMode !== undefined) {
    cfg[5] = Number(patch.rainbowMode) ? 0xff : 0x00;
  }
  if (patch.rgbHueR !== undefined) cfg[6] = Number(patch.rgbHueR) & 0xff;
  if (patch.rgbHueG !== undefined) cfg[7] = Number(patch.rgbHueG) & 0xff;
  if (patch.rgbHueB !== undefined) cfg[8] = Number(patch.rgbHueB) & 0xff;
  if (patch.logoMode !== undefined) {
    cfg[28] = Math.max(0, Math.min(4, Number(patch.logoMode)));
  }
  if (patch.logoBrightness !== undefined) {
    cfg[29] = Math.max(0, Math.min(4, Number(patch.logoBrightness)));
  }
  if (patch.logoRainbow !== undefined) {
    cfg[31] = Number(patch.logoRainbow) ? 0xff : 0x00;
  }
  if (patch.logoColor !== undefined) {
    cfg[32] = Math.max(0, Math.min(8, Number(patch.logoColor)));
  }
  if (patch.activeScreenMode !== undefined) {
    cfg[33] = Math.max(0, Math.min(2, Number(patch.activeScreenMode)));
  }
  if (patch.slot0FrameCount !== undefined) {
    cfg[34] = Math.max(1, Math.min(255, Number(patch.slot0FrameCount)));
  }
  if (patch.slot1FrameCount !== undefined) {
    cfg[46] = Math.max(1, Math.min(255, Number(patch.slot1FrameCount)));
  }

  const existingDelay = (cfg[43] ?? 0) | ((cfg[44] ?? 0) << 8);
  const frameDurationMs = Math.max(
    MIN_FRAME_DURATION_MS,
    Math.min(65535, Number(patch.frameDurationMs ?? (existingDelay || 100)))
  );
  cfg[43] = frameDurationMs & 0xff;
  cfg[44] = (frameDurationMs >> 8) & 0xff;

  if (patch.clockTimestampMs !== undefined) {
    const d = new Date(Number(patch.clockTimestampMs));
    if (!Number.isNaN(d.getTime())) {
      cfg[35] = toBcd(d.getSeconds());
      cfg[36] = toBcd(d.getMinutes());
      cfg[37] = toBcd(d.getHours());
      cfg[38] = d.getDay(); // 0=Sunday..6=Saturday
      cfg[39] = toBcd(d.getDate());
      cfg[40] = toBcd(d.getMonth() + 1);
      cfg[41] = toBcd(d.getFullYear() % 100);
    }
  }

  // Repair damaged V0112 VIA protocol selector on extended 64-byte EEPROM block
  if (targetLen >= 64 && cfg[0x31] !== 9 && cfg[0x31] !== 11) {
    cfg[0x31] = 11;
  }

  return cfg;
}

export function decodeViaKeymapBytes(raw: Uint8Array): number[][][] {
  const keymap: number[][][] = [];
  for (let l = 0; l < VIA_LAYERS; l++) {
    const layer: number[][] = [];
    for (let r = 0; r < VIA_ROWS; r++) {
      const row: number[] = [];
      for (let c = 0; c < VIA_COLS; c++) {
        const idx = (l * VIA_ROWS * VIA_COLS + r * VIA_COLS + c) * 2;
        row.push(((raw[idx] ?? 0) << 8) | (raw[idx + 1] ?? 0));
      }
      layer.push(row);
    }
    keymap.push(layer);
  }
  return keymap;
}

export function encodeViaKeymapToBytes(keymap: number[][][]): Uint8Array {
  const raw = new Uint8Array(VIA_KEYMAP_BYTES);
  for (let l = 0; l < VIA_LAYERS; l++) {
    for (let r = 0; r < VIA_ROWS; r++) {
      for (let c = 0; c < VIA_COLS; c++) {
        const idx = (l * VIA_ROWS * VIA_COLS + r * VIA_COLS + c) * 2;
        const code = (keymap[l]?.[r]?.[c] ?? 0) & 0xffff;
        raw[idx] = (code >> 8) & 0xff;
        raw[idx + 1] = code & 0xff;
      }
    }
  }
  return raw;
}
