/// <reference types="node" />
import * as HID from 'node-hid';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  GMK87_VENDOR_ID,
  GMK87_PRODUCT_ID,
  LCD_USAGE_PAGE,
  VIA_USAGE_PAGE,
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
  formatRelease,
  formatPacketHex,
  buildLcdPacketBytes,
  parseRawConfigBytes,
  patchRawConfigBytes,
  decodeViaKeymapBytes,
} from '../src/shared/gmk87Protocol';

export interface UploadProgressState {
  phase: 'idle' | 'config' | 'ready' | 'streaming' | 'commit' | 'complete' | 'error';
  bytesSent: number;
  totalBytes: number;
  currentFrame: number;
  totalFrames: number;
  lastPacketHex: string;
  message: string;
}

export interface HardwareStatusSnapshot {
  timestamp: number;
  connected: boolean;
  viaConnected: boolean;
  viaProtocol: number;
  firmwareRelease: number;
  firmwareVersion: string;
  deviceName: string;
  slotCache: { slot0Frames: number; slot1Frames: number };
  rawConfig?: number[];
  config?: Gmk87ParsedConfig;
  error?: string;
}

export interface HardwareSummary {
  detected: boolean;
  lcdDetected: boolean;
  viaDetected: boolean;
  deviceName: string;
  viaConnected: boolean;
  firmwareVersion: string;
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNodeBuffer(u8: Uint8Array): Buffer {
  return Buffer.from(u8.buffer, u8.byteOffset, u8.byteLength);
}

/**
 * Persistent node-hid hardware driver for Zuoya GMK87 (0x320F:0x5055).
 * Designed to live inside a dedicated Worker Thread (electron/hid-worker.ts)
 * so synchronous native HID calls never block the Express/Node event loop.
 */
export class Gmk87HidDriver {
  private readonly dataDir: string;
  private lcdDev: HID.HID | null = null;
  private lcdPath: string | null = null;
  private lcdRelease = 0x0104;
  private viaDev: HID.HID | null = null;
  private viaPath: string | null = null;
  private cachedProductName = 'Zuoya GMK87';
  private lastCloseAt = 0;

  private lastRawConfig: Uint8Array | null = null;
  private lastConfigIoAt = 0;
  private cachedStatus: HardwareStatusSnapshot | null = null;
  private cachedSlotFrames: [Buffer[] | null, Buffer[] | null] = [null, null];

  private uploadProgress: UploadProgressState = {
    phase: 'idle',
    bytesSent: 0,
    totalBytes: PADDED_FRAME_BYTES,
    currentFrame: 0,
    totalFrames: 1,
    lastPacketHex: '04 28 00 01 00 00 00 00',
    message: 'Idle',
  };

  private readonly onProgress?: (progress: UploadProgressState) => void;

  constructor(dataDir?: string, onProgress?: (progress: UploadProgressState) => void) {
    this.dataDir = dataDir || process.env.GMK87_DATA_DIR || path.join(os.homedir(), '.gmk87-studio');
    this.onProgress = onProgress;
    this.loadSlotCacheFromDisk();
  }

  private slotCacheFilePath(slot: 0 | 1): string {
    return path.join(this.dataDir, `lcd-slot${slot}.bin`);
  }

  private loadSlotCacheFromDisk(): void {
    for (const slot of [0, 1] as const) {
      const p = this.slotCacheFilePath(slot);
      try {
        if (!fs.existsSync(p)) continue;
        const data = fs.readFileSync(p);
        if (
          data.length >= PADDED_FRAME_BYTES &&
          data.length % PADDED_FRAME_BYTES === 0 &&
          data.length <= MAX_TOTAL_FRAMES * PADDED_FRAME_BYTES
        ) {
          const count = data.length / PADDED_FRAME_BYTES;
          const frames: Buffer[] = [];
          for (let i = 0; i < count; i++) {
            frames.push(Buffer.from(data.subarray(i * PADDED_FRAME_BYTES, (i + 1) * PADDED_FRAME_BYTES)));
          }
          this.cachedSlotFrames[slot] = frames;
        }
      } catch {
        // Ignore unreadable slot cache
      }
    }
  }

  private saveSlotCacheToDisk(slot: 0 | 1, frames: Buffer[]): void {
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
      const target = this.slotCacheFilePath(slot);
      const tmp = `${target}.tmp`;
      fs.writeFileSync(tmp, Buffer.concat(frames));
      fs.renameSync(tmp, target);
    } catch {
      // Non-fatal if cache dir cannot be written
    }
  }

  public getSlotCacheCounts(): { slot0Frames: number; slot1Frames: number } {
    return {
      slot0Frames: this.cachedSlotFrames[0]?.length || 0,
      slot1Frames: this.cachedSlotFrames[1]?.length || 0,
    };
  }

  public getUploadProgress(): UploadProgressState {
    return { ...this.uploadProgress };
  }

  private emitProgress(next: UploadProgressState): void {
    this.uploadProgress = next;
    this.onProgress?.({ ...next });
  }

  /**
   * Non-intrusive interface discovery using HID.devices() (sends 0 USB packets).
   * Always prioritizes verified usagePage 0xFF1C (LCD) and 0xFF60 (VIA) before interface fallbacks.
   */
  public discoverInterfaces(): { lcd: HID.Device | null; via: HID.Device | null } {
    const devices = HID.devices();
    const gmkDevices = devices.filter(
      (d) => d.vendorId === GMK87_VENDOR_ID && d.productId === GMK87_PRODUCT_ID
    );

    const lcd =
      gmkDevices.find((d) => d.usagePage === LCD_USAGE_PAGE && Boolean(d.path)) ||
      gmkDevices.find((d) => d.interface === 3 && Boolean(d.path)) ||
      null;

    const via =
      gmkDevices.find((d) => d.usagePage === VIA_USAGE_PAGE && Boolean(d.path)) ||
      gmkDevices.find((d) => d.interface === 1 && Boolean(d.path)) ||
      null;

    if (lcd?.product) {
      this.cachedProductName = lcd.product;
    } else if (via?.product) {
      this.cachedProductName = via.product;
    }
    if (lcd?.release) {
      this.lcdRelease = lcd.release;
    } else if (via?.release) {
      this.lcdRelease = via.release;
    }

    if (!lcd?.path) {
      this.closeLcd();
    }
    if (!via?.path) {
      this.closeVia();
    }

    return { lcd, via };
  }

  public checkAttached(): HardwareSummary {
    const { lcd, via } = this.discoverInterfaces();
    return {
      detected: Boolean(lcd || via),
      lcdDetected: Boolean(lcd),
      viaDetected: Boolean(via),
      deviceName: this.cachedProductName,
      viaConnected: Boolean(via),
      firmwareVersion: lcd || via ? formatRelease(this.lcdRelease) : 'Offline',
    };
  }

  private async openHidPath(devicePath: string): Promise<HID.HID> {
    const elapsed = Date.now() - this.lastCloseAt;
    if (elapsed < 100) {
      await delay(100 - elapsed);
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return new HID.HID(devicePath);
      } catch (err) {
        if (attempt < 2) {
          await delay(60 * (attempt + 1));
        } else {
          throw err;
        }
      }
    }
    throw new Error('Failed to open HID interface');
  }

  private async ensureLcdOpen(lcd: HID.Device | null): Promise<HID.HID> {
    if (!lcd?.path) {
      this.closeLcd();
      throw new Error('GMK87 LCD interface (0xFF1C) not found in wired USB mode');
    }
    if (this.lcdDev && this.lcdPath === lcd.path) {
      return this.lcdDev;
    }
    this.closeLcd();
    const dev = await this.openHidPath(lcd.path);
    this.lcdDev = dev;
    this.lcdPath = lcd.path;
    return dev;
  }

  private async ensureViaOpen(via: HID.Device | null): Promise<HID.HID> {
    if (!via?.path) {
      this.closeVia();
      throw new Error('GMK87 VIA interface (0xFF60) not found in wired USB mode');
    }
    if (this.viaDev && this.viaPath === via.path) {
      return this.viaDev;
    }
    this.closeVia();
    const dev = await this.openHidPath(via.path);
    this.viaDev = dev;
    this.viaPath = via.path;
    return dev;
  }

  private closeLcd(): void {
    if (this.lcdDev) {
      try {
        this.lcdDev.close();
      } catch {
        // ignore close error
      }
      this.lcdDev = null;
      this.lcdPath = null;
      this.lastCloseAt = Date.now();
    }
  }

  private closeVia(): void {
    if (this.viaDev) {
      try {
        this.viaDev.close();
      } catch {
        // ignore close error
      }
      this.viaDev = null;
      this.viaPath = null;
      this.lastCloseAt = Date.now();
    }
  }

  public shutdown(): void {
    this.closeLcd();
    this.closeVia();
    this.cachedStatus = null;
    this.lastRawConfig = null;
  }

  private async safeWrite(device: HID.HID, buffer: Buffer): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        device.write([...buffer]);
        return;
      } catch (err: any) {
        const msg = String(err?.message || '');
        if ((msg.includes('0x000003E5') || msg.includes('0x000000AA')) && attempt < 4) {
          await delay(40 * (attempt + 1));
        } else {
          throw err;
        }
      }
    }
  }

  private drainDevice(device: HID.HID, maxPackets = 24): number {
    let count = 0;
    for (let i = 0; i < maxPackets; i++) {
      try {
        const r = device.readTimeout(10);
        if (!r || r.length === 0) break;
        count++;
      } catch {
        break;
      }
    }
    return count;
  }

  private async sendWithPosition(
    device: HID.HID,
    commandId: number,
    data: Uint8Array = Buffer.alloc(0),
    pos = 0,
    waitMs = 2500,
    matchPos = false
  ): Promise<Buffer | null> {
    if (commandId === LcdCommand.COMMIT) {
      await delay(10);
    }

    const pkt = buildLcdPacketBytes(commandId, data, pos);
    await this.safeWrite(device, toNodeBuffer(pkt));

    const expectedCmd = commandId & 0xff;
    const expectedLen = Math.min(56, data.length) & 0xff;
    const p0 = pos & 0xff;
    const p1 = (pos >> 8) & 0xff;
    const p2 = (pos >> 16) & 0xff;

    const start = Date.now();
    while (Date.now() - start < waitMs) {
      const remaining = waitMs - (Date.now() - start);
      if (remaining <= 0) break;
      const sliceMs = Math.max(5, Math.min(40, remaining));
      try {
        const resp = device.readTimeout(sliceMs);
        if (resp && resp.length > 3 && resp[3] === expectedCmd) {
          if (
            !matchPos ||
            (resp.length >= 8 &&
              resp[4] === expectedLen &&
              resp[5] === p0 &&
              resp[6] === p1 &&
              resp[7] === p2)
          ) {
            return Buffer.from(resp).subarray(4);
          }
        }
        if (resp && resp.length > 0) {
          continue;
        }
      } catch {
        return null;
      }
    }
    return null;
  }

  private async readLcdConfigInternal(device: HID.HID, releaseHint = 0x0104): Promise<Uint8Array> {
    this.drainDevice(device);

    const initAck = await this.sendWithPosition(device, LcdCommand.INIT, Buffer.alloc(0), 0);
    if (!initAck) {
      throw new Error('GMK87 did not acknowledge INIT (0x01) while reading config');
    }
    for (let i = 0; i < 9; i++) {
      await this.sendWithPosition(device, LcdCommand.PREPARE_READ, Buffer.alloc(4, 0x00), i * 4);
    }
    await this.sendWithPosition(device, LcdCommand.PREPARE_READ, Buffer.alloc(1, 0x00), 36);
    const prepCommitAck = await this.sendWithPosition(device, LcdCommand.COMMIT, Buffer.alloc(0), 0);
    if (!prepCommitAck) {
      throw new Error('GMK87 did not acknowledge COMMIT (0x02) while preparing config read');
    }

    const raw48 = new Uint8Array(48);
    for (let i = 0; i < 12; i++) {
      const chunk = await this.sendWithPosition(
        device,
        LcdCommand.READ_CONFIG,
        Buffer.alloc(4, 0x00),
        i * 4
      );
      if (!chunk || chunk.length < 4) {
        throw new Error(`GMK87 timed out reading config chunk at offset ${i * 4}`);
      }
      raw48.set(chunk.subarray(0, 4), i * 4);
    }

    // V0112 exposes extended 64-byte config block (0x31 holds VIA protocol 9/11 selector)
    if (releaseHint >= 0x0112) {
      const raw64 = new Uint8Array(64);
      raw64.set(raw48, 0);
      let gotExtended = false;
      for (let pos = 48; pos < 64; pos += 4) {
        const chunk = await this.sendWithPosition(
          device,
          LcdCommand.READ_CONFIG,
          Buffer.alloc(4, 0x00),
          pos,
          250
        );
        if (chunk && chunk.length >= 4) {
          raw64.set(chunk.subarray(0, 4), pos);
          gotExtended = true;
        } else {
          break;
        }
      }
      if (gotExtended) {
        this.lastRawConfig = raw64;
        this.lastConfigIoAt = Date.now();
        return raw64;
      }
    }

    this.lastRawConfig = raw48;
    this.lastConfigIoAt = Date.now();
    return raw48;
  }

  private async writeLcdConfigInternal(device: HID.HID, cfg: Uint8Array): Promise<string> {
    const normalized = patchRawConfigBytes(cfg, {});
    this.drainDevice(device);

    const initAck = await this.sendWithPosition(device, LcdCommand.INIT, Buffer.alloc(0), 0);
    if (!initAck) {
      throw new Error('GMK87 did not acknowledge INIT (0x01) before writing config');
    }

    let lastHex = '';
    for (let pos = 0; pos < normalized.length; pos += 56) {
      const slice = normalized.subarray(pos, Math.min(pos + 56, normalized.length));
      const pkt = buildLcdPacketBytes(LcdCommand.WRITE_CONFIG, slice, pos);
      lastHex = formatPacketHex(pkt, 16);
      const ack = await this.sendWithPosition(device, LcdCommand.WRITE_CONFIG, slice, pos);
      if (!ack) {
        throw new Error(`GMK87 did not acknowledge WRITE_CONFIG (0x06) at offset ${pos}`);
      }
    }

    const commitAck = await this.sendWithPosition(device, LcdCommand.COMMIT, Buffer.alloc(0), 0);
    if (!commitAck) {
      throw new Error('GMK87 did not acknowledge COMMIT (0x02) after writing config');
    }

    this.lastRawConfig = new Uint8Array(normalized);
    this.lastConfigIoAt = Date.now();
    return lastHex;
  }

  private async readViaProtocolVersionInternal(viaDev: HID.HID): Promise<number> {
    this.drainDevice(viaDev, 8);
    const req = Buffer.alloc(33, 0);
    req[0] = 0x00;
    req[1] = 0x01; // GET_PROTOCOL_VERSION
    await this.safeWrite(viaDev, req);
    const resp = viaDev.readTimeout(400);
    if (resp && resp.length >= 3 && resp[0] === 0x01) {
      return (resp[1] << 8) | resp[2] || 9;
    }
    return 9;
  }

  private async getBaseConfigForWrite(
    dev: HID.HID,
    releaseHint: number,
    forceFreshRead: boolean
  ): Promise<Uint8Array> {
    const recentEnough =
      !forceFreshRead &&
      this.lastRawConfig &&
      this.lastRawConfig.length >= 48 &&
      Date.now() - this.lastConfigIoAt < 300;

    if (recentEnough && this.lastRawConfig) {
      return this.lastRawConfig;
    }
    return this.readLcdConfigInternal(dev, releaseHint);
  }

  public async getStatus(forceRefresh = false, lightOnly = false): Promise<HardwareStatusSnapshot> {
    if (lightOnly) {
      const summary = this.checkAttached();
      if (!summary.detected) {
        this.cachedStatus = null;
        return {
          timestamp: Date.now(),
          connected: false,
          viaConnected: false,
          viaProtocol: 9,
          firmwareRelease: 0,
          firmwareVersion: 'Offline',
          deviceName: 'Zuoya GMK87',
          slotCache: this.getSlotCacheCounts(),
          error: 'Zuoya GMK87 not detected in wired USB mode (VID 0x320F / PID 0x5055)',
        };
      }
      if (this.cachedStatus && this.cachedStatus.connected && Date.now() - this.cachedStatus.timestamp < 15000) {
        return {
          ...this.cachedStatus,
          viaConnected: summary.viaConnected,
          slotCache: this.getSlotCacheCounts(),
        };
      }
      return {
        timestamp: Date.now(),
        connected: summary.lcdDetected,
        viaConnected: summary.viaConnected,
        viaProtocol: this.cachedStatus?.viaProtocol || 9,
        firmwareRelease: this.lcdRelease,
        firmwareVersion: summary.firmwareVersion,
        deviceName: summary.deviceName,
        slotCache: this.getSlotCacheCounts(),
        rawConfig: this.cachedStatus?.rawConfig,
        config: this.cachedStatus?.config,
      };
    }

    if (!forceRefresh && this.cachedStatus && Date.now() - this.cachedStatus.timestamp < 4000) {
      const summary = this.checkAttached();
      if (summary.detected) {
        return { ...this.cachedStatus, slotCache: this.getSlotCacheCounts() };
      }
      this.cachedStatus = null;
    }

    const { lcd, via } = this.discoverInterfaces();
    if (!lcd && !via) {
      this.cachedStatus = null;
      return {
        timestamp: Date.now(),
        connected: false,
        viaConnected: false,
        viaProtocol: 9,
        firmwareRelease: 0,
        firmwareVersion: 'Offline',
        deviceName: 'Zuoya GMK87',
        slotCache: this.getSlotCacheCounts(),
        error: 'Zuoya GMK87 not detected in wired USB mode (VID 0x320F / PID 0x5055)',
      };
    }

    let viaProtocol = this.cachedStatus?.viaProtocol || 9;
    if (via?.path) {
      try {
        const vDev = await this.ensureViaOpen(via);
        viaProtocol = await this.readViaProtocolVersionInternal(vDev);
      } catch {
        this.closeVia();
        viaProtocol = 9;
      }
    }

    if (!lcd?.path) {
      return {
        timestamp: Date.now(),
        connected: false,
        viaConnected: Boolean(via),
        viaProtocol,
        firmwareRelease: via?.release || 0x0104,
        firmwareVersion: formatRelease(via?.release || 0x0104),
        deviceName: via?.product || this.cachedProductName,
        slotCache: this.getSlotCacheCounts(),
        error: 'VIA interface found, but LCD interface (0xFF1C / MI_03) is not available.',
      };
    }

    try {
      const lDev = await this.ensureLcdOpen(lcd);
      const cfg = await this.readLcdConfigInternal(lDev, lcd.release || 0x0104);
      const parsed = parseRawConfigBytes(cfg);
      const snap: HardwareStatusSnapshot = {
        timestamp: Date.now(),
        connected: true,
        viaConnected: Boolean(via),
        viaProtocol,
        firmwareRelease: lcd.release || 0x0104,
        firmwareVersion: formatRelease(lcd.release || 0x0104),
        deviceName: lcd.product || this.cachedProductName,
        slotCache: this.getSlotCacheCounts(),
        rawConfig: Array.from(cfg),
        config: parsed,
      };
      this.cachedStatus = snap;
      return snap;
    } catch (err: any) {
      this.closeLcd();
      this.cachedStatus = null;
      return {
        timestamp: Date.now(),
        connected: false,
        viaConnected: Boolean(via),
        viaProtocol,
        firmwareRelease: 0,
        firmwareVersion: 'Error',
        deviceName: this.cachedProductName,
        slotCache: this.getSlotCacheCounts(),
        error: err?.message || 'HID status read failed',
      };
    }
  }

  public async writeConfigPatch(
    patch: Gmk87ConfigPatch,
    forceFreshRead = false
  ): Promise<{ success: boolean; packetHex: string; config: Gmk87ParsedConfig; rawConfig: number[] }> {
    const { lcd } = this.discoverInterfaces();
    try {
      const dev = await this.ensureLcdOpen(lcd);
      const releaseHint = lcd?.release || 0x0104;
      const base = await this.getBaseConfigForWrite(dev, releaseHint, forceFreshRead);
      const updatedCfg = patchRawConfigBytes(base, patch);
      const packetHex = await this.writeLcdConfigInternal(dev, updatedCfg);
      const parsed = parseRawConfigBytes(updatedCfg);
      if (this.cachedStatus) {
        this.cachedStatus = {
          ...this.cachedStatus,
          timestamp: Date.now(),
          slotCache: this.getSlotCacheCounts(),
          rawConfig: Array.from(updatedCfg),
          config: parsed,
        };
      }
      return {
        success: true,
        packetHex,
        config: parsed,
        rawConfig: Array.from(updatedCfg),
      };
    } catch (err) {
      this.closeLcd();
      throw err;
    }
  }

  public async syncClockNow(): Promise<{
    success: boolean;
    time?: string;
    packetHex?: string;
    config?: Gmk87ParsedConfig;
    rawConfig?: number[];
    error?: string;
  }> {
    try {
      const res = await this.writeConfigPatch({ clockTimestampMs: Date.now() }, true);
      return {
        success: true,
        time: res.config.clockIso,
        packetHex: res.packetHex,
        config: res.config,
        rawConfig: res.rawConfig,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err?.message || 'GMK87 not connected in wired USB mode',
      };
    }
  }

  public async uploadFrames(params: {
    targetSlot: 0 | 1;
    framesBase64: string[];
    configPatch?: Gmk87ConfigPatch;
    frameDurationMs?: number;
  }): Promise<{
    success: boolean;
    uploadedBytes: number;
    frames: number;
    lastPacketHex: string;
    config: Gmk87ParsedConfig;
    rawConfig: number[];
    slotCache: { slot0Frames: number; slot1Frames: number };
  }> {
    const targetSlot: 0 | 1 = params.targetSlot === 1 ? 1 : 0;
    const framesBase64 = Array.isArray(params.framesBase64) ? params.framesBase64 : [];
    const cfgPatch = params.configPatch || {};
    const requestedDuration = Math.max(
      MIN_FRAME_DURATION_MS,
      Number(params.frameDurationMs ?? 100)
    );

    if (framesBase64.length === 0) {
      throw new Error('No RGB565 frames provided');
    }
    if (framesBase64.length > MAX_TOTAL_FRAMES) {
      throw new Error(`Too many frames (${framesBase64.length}); max is ${MAX_TOTAL_FRAMES}`);
    }

    const rawTargetBuffers = framesBase64.map((b64) => {
      const raw = Buffer.from(b64, 'base64');
      const padded = Buffer.alloc(PADDED_FRAME_BYTES, 0x00);
      raw.copy(padded, 0, 0, Math.min(raw.length, Math.max(RAW_FRAME_BYTES, PADDED_FRAME_BYTES)));
      return padded;
    });

    let targetBuffers = rawTargetBuffers;
    let uploadList: Buffer[];
    let slot0Count: number;
    let slot1Count: number;

    if (targetSlot === 0) {
      this.cachedSlotFrames[0] = targetBuffers;
      this.saveSlotCacheToDisk(0, targetBuffers);

      const slot1Suffix = this.cachedSlotFrames[1] || [Buffer.alloc(PADDED_FRAME_BYTES, 0x00)];
      const maxS1 = Math.max(0, MAX_TOTAL_FRAMES - targetBuffers.length);
      const usableS1 = slot1Suffix.slice(0, maxS1);
      if (usableS1.length > 0 && this.cachedSlotFrames[1]) {
        this.cachedSlotFrames[1] = usableS1;
      }
      uploadList = [...targetBuffers, ...usableS1];
      slot0Count = targetBuffers.length;
      slot1Count = Math.max(1, usableS1.length);
    } else {
      targetBuffers = rawTargetBuffers.slice(0, MAX_TOTAL_FRAMES - 1);
      this.cachedSlotFrames[1] = targetBuffers;
      this.saveSlotCacheToDisk(1, targetBuffers);

      const slot0Prefix = this.cachedSlotFrames[0] || [Buffer.alloc(PADDED_FRAME_BYTES, 0x00)];
      const maxS0 = Math.max(1, MAX_TOTAL_FRAMES - targetBuffers.length);
      const usableS0 = slot0Prefix.slice(0, maxS0);
      if (this.cachedSlotFrames[0]) {
        this.cachedSlotFrames[0] = usableS0;
      }
      uploadList = [...usableS0, ...targetBuffers];
      slot0Count = usableS0.length;
      slot1Count = targetBuffers.length;
    }

    const fullBuffer = Buffer.concat(uploadList);
    const totalBytes = fullBuffer.length;
    const totalFrames = uploadList.length;

    this.emitProgress({
      phase: 'config',
      bytesSent: 0,
      totalBytes,
      currentFrame: 1,
      totalFrames,
      lastPacketHex: '04 ... 06',
      message: 'Step 1/4: Writing EEPROM config to GMK87...',
    });

    const { lcd } = this.discoverInterfaces();
    try {
      const dev = await this.ensureLcdOpen(lcd);
      const base = await this.readLcdConfigInternal(dev, lcd?.release || 0x0104);
      const nextCfg = patchRawConfigBytes(base, {
        ...cfgPatch,
        activeScreenMode: targetSlot === 0 ? 1 : 2,
        slot0FrameCount: slot0Count,
        slot1FrameCount: slot1Count,
        frameDurationMs: requestedDuration,
        clockTimestampMs: Date.now(),
      });

      const cfgHex = await this.writeLcdConfigInternal(dev, nextCfg);

      const pkt23 = buildLcdPacketBytes(LcdCommand.READY_UPLOAD, undefined, 0);
      this.emitProgress({
        phase: 'ready',
        bytesSent: 0,
        totalBytes,
        currentFrame: 1,
        totalFrames,
        lastPacketHex: cfgHex,
        message: `Step 2/4: Erasing LCD SPI flash for ${totalFrames} frame(s) (0x23)...`,
      });

      const readyAck = await this.sendWithPosition(
        dev,
        LcdCommand.READY_UPLOAD,
        Buffer.alloc(0),
        0,
        30000
      );
      if (!readyAck) {
        throw new Error('GMK87 timed out waiting for 0x23 flash-erase ACK before streaming');
      }

      let pos = 0;
      let chunkCount = 0;
      let lastHex = formatPacketHex(pkt23, 14);

      while (pos < totalBytes) {
        const size = Math.min(56, totalBytes - pos);
        const chunk = fullBuffer.subarray(pos, pos + size);
        const pkt21 = buildLcdPacketBytes(LcdCommand.FRAME_CHUNK, chunk, pos);

        const ack21 = await this.sendWithPosition(
          dev,
          LcdCommand.FRAME_CHUNK,
          chunk,
          pos,
          8000,
          true
        );
        if (!ack21) {
          throw new Error(`GMK87 timed out waiting for 0x21 frame chunk ACK at offset ${pos}`);
        }

        pos += size;
        chunkCount++;

        if (chunkCount === 1 || chunkCount % 16 === 0 || pos >= totalBytes) {
          const curFrame = Math.min(totalFrames, Math.floor((pos - 1) / PADDED_FRAME_BYTES) + 1);
          lastHex = formatPacketHex(pkt21, 14);
          this.emitProgress({
            phase: 'streaming',
            bytesSent: pos,
            totalBytes,
            currentFrame: curFrame,
            totalFrames,
            lastPacketHex: lastHex,
            message: `Step 3/4: Streaming RGB565 frame ${curFrame}/${totalFrames} (ACK verified)`,
          });
        }
      }

      const pkt02 = buildLcdPacketBytes(LcdCommand.COMMIT, undefined, 0);
      this.emitProgress({
        phase: 'commit',
        bytesSent: totalBytes,
        totalBytes,
        currentFrame: totalFrames,
        totalFrames,
        lastPacketHex: lastHex,
        message: 'Step 4/4: Finalizing SPI flash commit (0x02)...',
      });

      const commitAck = await this.sendWithPosition(dev, LcdCommand.COMMIT, Buffer.alloc(0), 0, 8000);
      if (!commitAck) {
        throw new Error('GMK87 did not acknowledge final COMMIT (0x02) after streaming');
      }
      await delay(100);

      // Re-stamp hardware RTC right after SPI commit so multi-second transfer adds zero clock lag
      const postCfg = patchRawConfigBytes(nextCfg, { clockTimestampMs: Date.now() });
      await this.writeLcdConfigInternal(dev, postCfg);

      const parsed = parseRawConfigBytes(postCfg);
      if (this.cachedStatus) {
        this.cachedStatus = {
          ...this.cachedStatus,
          timestamp: Date.now(),
          slotCache: this.getSlotCacheCounts(),
          rawConfig: Array.from(postCfg),
          config: parsed,
        };
      }

      const commitHex = formatPacketHex(pkt02, 16);
      this.emitProgress({
        phase: 'complete',
        bytesSent: totalBytes,
        totalBytes,
        currentFrame: totalFrames,
        totalFrames,
        lastPacketHex: commitHex,
        message: `Flashed ${targetBuffers.length} frame(s) to Slot ${targetSlot} via USB Bridge`,
      });

      return {
        success: true,
        uploadedBytes: totalBytes,
        frames: targetBuffers.length,
        lastPacketHex: commitHex,
        config: parsed,
        rawConfig: Array.from(postCfg),
        slotCache: this.getSlotCacheCounts(),
      };
    } catch (innerErr: any) {
      this.closeLcd();
      this.emitProgress({
        ...this.uploadProgress,
        phase: 'error',
        lastPacketHex: 'ERR',
        message: innerErr?.message || 'USB upload error',
      });
      throw innerErr;
    }
  }

  public async readViaKeymap(): Promise<{
    success: boolean;
    viaProtocol: number;
    layers: number;
    rows: number;
    cols: number;
    keymap: number[][][];
  }> {
    const { via } = this.discoverInterfaces();
    try {
      const dev = await this.ensureViaOpen(via);
      const viaProtocol = await this.readViaProtocolVersionInternal(dev);
      const CHUNK = 28;
      const raw = new Uint8Array(VIA_KEYMAP_BYTES);

      for (let offset = 0; offset < VIA_KEYMAP_BYTES; offset += CHUNK) {
        const size = Math.min(CHUNK, VIA_KEYMAP_BYTES - offset);
        const req = Buffer.alloc(33, 0);
        req[0] = 0x00;
        req[1] = 0x12; // DYNAMIC_KEYMAP_GET_BUFFER
        req[2] = (offset >> 8) & 0xff;
        req[3] = offset & 0xff;
        req[4] = size;

        await this.safeWrite(dev, req);
        const resp = dev.readTimeout(1000);
        if (!resp || resp[0] !== 0x12) {
          throw new Error(`Failed reading keymap chunk at offset ${offset}`);
        }
        raw.set(Uint8Array.from(resp).subarray(4, 4 + size), offset);
      }

      return {
        success: true,
        viaProtocol,
        layers: VIA_LAYERS,
        rows: VIA_ROWS,
        cols: VIA_COLS,
        keymap: decodeViaKeymapBytes(raw),
      };
    } catch (err) {
      this.closeVia();
      throw err;
    }
  }

  public async setViaKeycode(
    layer: number,
    row: number,
    col: number,
    keycode: number
  ): Promise<{
    success: boolean;
    layer: number;
    row: number;
    col: number;
    keycode: number;
    packetHex: string;
  }> {
    const { via } = this.discoverInterfaces();
    try {
      const dev = await this.ensureViaOpen(via);
      const l = Number(layer) & 0x03;
      const r = Number(row) & 0x07;
      const c = Number(col) & 0x0f;
      const k = Number(keycode) & 0xffff;

      const packet = Buffer.alloc(33, 0);
      packet[0] = 0x00;
      packet[1] = 0x05; // DYNAMIC_KEYMAP_SET_KEYCODE
      packet[2] = l;
      packet[3] = r;
      packet[4] = c;
      packet[5] = (k >> 8) & 0xff;
      packet[6] = k & 0xff;

      await this.safeWrite(dev, packet);
      const resp = dev.readTimeout(1000);
      if (!resp || resp[0] !== 0x05) {
        throw new Error(`VIA setKeycode failed at [${l},${r},${c}]`);
      }
      return {
        success: true,
        layer: l,
        row: r,
        col: c,
        keycode: k,
        packetHex: formatPacketHex(packet.subarray(1), 8),
      };
    } catch (err) {
      this.closeVia();
      throw err;
    }
  }

  public async batchSetViaKeycodes(entries: ViaBatchEntry[]): Promise<{
    success: boolean;
    appliedCount: number;
    lastPacketHex: string;
  }> {
    if (!Array.isArray(entries) || entries.length === 0) {
      return { success: true, appliedCount: 0, lastPacketHex: '' };
    }
    const { via } = this.discoverInterfaces();
    try {
      const dev = await this.ensureViaOpen(via);
      this.drainDevice(dev, 8);

      let appliedCount = 0;
      let lastPacketHex = '';
      for (const entry of entries) {
        const l = Number(entry.layer) & 0x03;
        const r = Number(entry.row) & 0x07;
        const c = Number(entry.col) & 0x0f;
        const k = Number(entry.keycode) & 0xffff;

        const packet = Buffer.alloc(33, 0);
        packet[0] = 0x00;
        packet[1] = 0x05;
        packet[2] = l;
        packet[3] = r;
        packet[4] = c;
        packet[5] = (k >> 8) & 0xff;
        packet[6] = k & 0xff;

        await this.safeWrite(dev, packet);
        const resp = dev.readTimeout(800);
        if (!resp || resp[0] !== 0x05) {
          throw new Error(`VIA batch setKeycode failed at [${l},${r},${c}]`);
        }
        appliedCount++;
        lastPacketHex = formatPacketHex(packet.subarray(1), 8);
      }

      return { success: true, appliedCount, lastPacketHex };
    } catch (err) {
      this.closeVia();
      throw err;
    }
  }

  public async readViaMacros(): Promise<ViaMacroReadResult> {
    const { via } = this.discoverInterfaces();
    try {
      const dev = await this.ensureViaOpen(via);
      const viaProtocol = await this.readViaProtocolVersionInternal(dev);

      const countReq = Buffer.alloc(33, 0);
      countReq[0] = 0x00;
      countReq[1] = 0x0c; // DYNAMIC_KEYMAP_MACRO_GET_COUNT
      await this.safeWrite(dev, countReq);
      const countResp = dev.readTimeout(400);
      if (!countResp || countResp.length < 2 || countResp[0] !== 0x0c) {
        return {
          success: true,
          supported: false,
          viaProtocol,
          count: 0,
          bufferSize: 0,
          macros: [],
          error: 'Firmware did not respond to VIA Macro GetCount (0x0C)',
        };
      }

      const count = countResp[1] & 0xff;

      const sizeReq = Buffer.alloc(33, 0);
      sizeReq[0] = 0x00;
      sizeReq[1] = 0x0d; // DYNAMIC_KEYMAP_MACRO_GET_BUFFER_SIZE
      await this.safeWrite(dev, sizeReq);
      const sizeResp = dev.readTimeout(400);
      if (!sizeResp || sizeResp.length < 3 || sizeResp[0] !== 0x0d) {
        return {
          success: true,
          supported: false,
          viaProtocol,
          count,
          bufferSize: 0,
          macros: [],
          error: 'Firmware did not respond to VIA Macro GetBufferSize (0x0D)',
        };
      }

      const bufferSize = ((sizeResp[1] & 0xff) << 8) | (sizeResp[2] & 0xff);
      if (count === 0 || bufferSize === 0 || bufferSize > 4096) {
        return {
          success: true,
          supported: false,
          viaProtocol,
          count,
          bufferSize,
          macros: [],
        };
      }

      const CHUNK = 28;
      const raw = Buffer.alloc(bufferSize, 0);
      for (let offset = 0; offset < bufferSize; offset += CHUNK) {
        const size = Math.min(CHUNK, bufferSize - offset);
        const req = Buffer.alloc(33, 0);
        req[0] = 0x00;
        req[1] = 0x0e; // DYNAMIC_KEYMAP_MACRO_GET_BUFFER
        req[2] = (offset >> 8) & 0xff;
        req[3] = offset & 0xff;
        req[4] = size;

        await this.safeWrite(dev, req);
        const resp = dev.readTimeout(600);
        if (!resp || resp[0] !== 0x0e) {
          throw new Error(`VIA macro read failed at offset ${offset}`);
        }
        Buffer.from(resp).copy(raw, offset, 4, 4 + size);
      }

      const macros: string[] = [];
      let cursor = 0;
      for (let m = 0; m < count; m++) {
        let end = cursor;
        while (end < raw.length && raw[end] !== 0x00) {
          end++;
        }
        const slice = raw.subarray(cursor, end);
        const decoded = Buffer.from(slice)
          .toString('utf8')
          .replace(/[^\x20-\x7E]/g, '');
        macros.push(decoded);
        cursor = Math.min(raw.length, end + 1);
      }

      return {
        success: true,
        supported: true,
        viaProtocol,
        count,
        bufferSize,
        macros,
        rawBytes: Array.from(raw),
      };
    } catch (err: any) {
      this.closeVia();
      return {
        success: false,
        supported: false,
        viaProtocol: 9,
        count: 0,
        bufferSize: 0,
        macros: [],
        error: err?.message || 'VIA macro read failed',
      };
    }
  }

  public async writeViaMacros(macros: string[]): Promise<{
    success: boolean;
    writtenMacros: number;
    bufferSize: number;
    error?: string;
  }> {
    const { via } = this.discoverInterfaces();
    try {
      const dev = await this.ensureViaOpen(via);

      const countReq = Buffer.alloc(33, 0);
      countReq[0] = 0x00;
      countReq[1] = 0x0c;
      await this.safeWrite(dev, countReq);
      const countResp = dev.readTimeout(400);
      const count = countResp && countResp[0] === 0x0c ? countResp[1] & 0xff : 0;

      const sizeReq = Buffer.alloc(33, 0);
      sizeReq[0] = 0x00;
      sizeReq[1] = 0x0d;
      await this.safeWrite(dev, sizeReq);
      const sizeResp = dev.readTimeout(400);
      const bufferSize =
        sizeResp && sizeResp.length >= 3 && sizeResp[0] === 0x0d
          ? ((sizeResp[1] & 0xff) << 8) | (sizeResp[2] & 0xff)
          : 0;

      if (count === 0 || bufferSize === 0 || bufferSize > 4096) {
        return {
          success: false,
          writtenMacros: 0,
          bufferSize,
          error: 'Firmware reports 0 VIA dynamic macro slots/buffer',
        };
      }

      const raw = Buffer.alloc(bufferSize, 0x00);
      let cursor = 0;
      const limit = Math.min(count, macros.length);
      for (let i = 0; i < limit && cursor < bufferSize; i++) {
        const cleanText = String(macros[i] || '').replace(/[^\x20-\x7E]/g, '');
        const bytes = Buffer.from(cleanText, 'ascii');
        const avail = Math.max(0, bufferSize - cursor - (limit - i));
        const copyLen = Math.min(bytes.length, avail);
        if (copyLen > 0) {
          bytes.copy(raw, cursor, 0, copyLen);
          cursor += copyLen;
        }
        if (cursor < bufferSize) {
          raw[cursor++] = 0x00; // NUL terminator between macros
        }
      }

      const CHUNK = 28;
      for (let offset = 0; offset < bufferSize; offset += CHUNK) {
        const size = Math.min(CHUNK, bufferSize - offset);
        const packet = Buffer.alloc(33, 0);
        packet[0] = 0x00;
        packet[1] = 0x0f; // DYNAMIC_KEYMAP_MACRO_SET_BUFFER
        packet[2] = (offset >> 8) & 0xff;
        packet[3] = offset & 0xff;
        packet[4] = size;
        raw.copy(packet, 5, offset, offset + size);

        await this.safeWrite(dev, packet);
        const resp = dev.readTimeout(600);
        if (!resp || resp[0] !== 0x0f) {
          throw new Error(`VIA macro write failed at offset ${offset}`);
        }
      }

      return {
        success: true,
        writtenMacros: limit,
        bufferSize,
      };
    } catch (err: any) {
      this.closeVia();
      return {
        success: false,
        writtenMacros: 0,
        bufferSize: 0,
        error: err?.message || 'VIA macro write failed',
      };
    }
  }
}
