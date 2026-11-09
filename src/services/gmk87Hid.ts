/**
 * Zuoya GMK87 WebHID Hardware Protocol Engine
 * Vendor ID: 0x320F (12815), Product ID: 0x5055 (20565)
 * - LCD Screen Interface: usagePage 0xFF1C (65308), Report ID 0x04
 * - VIA Keymap Interface: usagePage 0xFF60 (65376), Report ID 0x00
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
  lightingEffect: number; // cfg[1]: 0-20
  brightness: number; // cfg[2]: 0-9
  speed: number; // cfg[3]: 0-4
  rgbHueR: number; // cfg[6]
  rgbHueG: number; // cfg[7]
  rgbHueB: number; // cfg[8]
  activeScreenMode: number; // cfg[33]: 0 = Clock/Stats, 1 = Slot 0, 2 = Slot 1
  slot0FrameCount: number; // cfg[34]
  slot1FrameCount: number; // cfg[46]
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
 * Convert 16-bit RGB565 back to 24-bit RGB for accurate hardware monitor preview
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
 * Encodes an HTMLCanvasElement or ImageData (240x135) into a 65,536-byte padded RGB565 buffer (big-endian per pixel)
 */
export function encodeImageDataToRGB565Frame(imageData: ImageData): Uint8Array {
  const buffer = new Uint8Array(PADDED_FRAME_BYTES);
  const data = imageData.data;
  let byteOffset = 0;

  const pixelCount = Math.min(LCD_WIDTH * LCD_HEIGHT, data.length / 4);
  for (let i = 0; i < pixelCount; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const rgb565 = toRGB565(r, g, b);
    // Stored big-endian: highByte, lowByte
    buffer[byteOffset++] = (rgb565 >> 8) & 0xff;
    buffer[byteOffset++] = rgb565 & 0xff;
  }

  return buffer;
}

/**
 * Builds the 64-byte LCD packet (returns the 63-byte payload passed to device.sendReport(0x04, payload),
 * plus the full 64-byte representation for inspection).
 *
 * Packet Format (64-byte full packet):
 * - Byte 0: Report ID 0x04
 * - Bytes 1..2: 16-bit little-endian sum of bytes 3..63 (sum & 0xFFFF)
 * - Byte 3: Command ID
 * - Byte 4: Payload data length (up to 56)
 * - Bytes 5..7: 24-bit little-endian position offset
 * - Bytes 8..63: Up to 56 bytes of payload data
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

/**
 * Serializes Gmk87ConfigState into the 48-byte hardware config buffer
 */
export function serializeConfigBuffer(state: Gmk87ConfigState): Uint8Array {
  const cfg = new Uint8Array(48);
  cfg[0] = 0xa5; // Header marker
  cfg[1] = Math.max(0, Math.min(20, state.lightingEffect));
  cfg[2] = Math.max(0, Math.min(9, state.brightness));
  cfg[3] = Math.max(0, Math.min(4, state.speed));
  cfg[6] = state.rgbHueR & 0xff;
  cfg[7] = state.rgbHueG & 0xff;
  cfg[8] = state.rgbHueB & 0xff;

  cfg[33] = Math.max(0, Math.min(2, state.activeScreenMode));
  cfg[34] = Math.max(1, Math.min(255, state.slot0FrameCount));
  cfg[46] = Math.max(1, Math.min(255, state.slot1FrameCount));

  const d = state.clockDate;
  const dayOfWeek = d.getDay() === 0 ? 7 : d.getDay(); // 1-7 (Mon=1 .. Sun=7)
  cfg[35] = toBcd(d.getSeconds());
  cfg[36] = toBcd(d.getMinutes());
  cfg[37] = toBcd(d.getHours());
  cfg[38] = toBcd(dayOfWeek);
  cfg[39] = toBcd(d.getDate());
  cfg[40] = toBcd(d.getMonth() + 1);
  cfg[41] = toBcd(d.getFullYear() % 100);

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
  private configBuffer: Uint8Array;
  private isUploading = false;

  constructor(initialConfig: Gmk87ConfigState) {
    this.configBuffer = serializeConfigBuffer(initialConfig);
  }

  public isWebHidSupported(): boolean {
    return typeof navigator !== 'undefined' && 'hid' in navigator;
  }

  public isConnected(): boolean {
    return Boolean(this.lcdDevice?.opened || this.viaDevice?.opened);
  }

  public getConnectedDeviceName(): string {
    if (this.lcdDevice?.opened) return this.lcdDevice.productName || 'Zuoya GMK87 (LCD + VIA)';
    if (this.viaDevice?.opened) return this.viaDevice.productName || 'Zuoya GMK87 (VIA)';
    return 'Simulation Mode';
  }

  public getRawConfigBuffer(): Uint8Array {
    return new Uint8Array(this.configBuffer);
  }

  /**
   * Requests pairing with Zuoya GMK87 (VID 0x320F, PID 0x5055)
   * Discovers both 0xFF1C (LCD Screen) and 0xFF60 (VIA Keymap) interfaces.
   */
  public async connect(): Promise<{ connected: boolean; mode: 'hardware' | 'simulation'; message: string }> {
    if (!this.isWebHidSupported()) {
      return {
        connected: false,
        mode: 'simulation',
        message: 'WebHID API is unavailable in this browser context. Running in full-fidelity Simulation Mode.',
      };
    }

    try {
      const navHid = (navigator as any).hid;
      const devices: HidDevice[] = await navHid.requestDevice({
        filters: [
          { vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID, usagePage: LCD_USAGE_PAGE },
          { vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID, usagePage: VIA_USAGE_PAGE },
          { vendorId: GMK87_VENDOR_ID, productId: GMK87_PRODUCT_ID },
        ],
      });

      const allPermitted: HidDevice[] = await navHid.getDevices();
      const pool = [...devices, ...allPermitted];

      for (const dev of pool) {
        if (dev.vendorId !== GMK87_VENDOR_ID || dev.productId !== GMK87_PRODUCT_ID) continue;
        const hasLcd = dev.collections?.some((c) => c.usagePage === LCD_USAGE_PAGE);
        const hasVia = dev.collections?.some((c) => c.usagePage === VIA_USAGE_PAGE);

        if (hasLcd && !this.lcdDevice) {
          if (!dev.opened) await dev.open();
          this.lcdDevice = dev;
        }
        if (hasVia && !this.viaDevice) {
          if (!dev.opened) await dev.open();
          this.viaDevice = dev;
        }
      }

      if (this.isConnected()) {
        return {
          connected: true,
          mode: 'hardware',
          message: `Connected to ${this.getConnectedDeviceName()} (0x320F:0x5055)`,
        };
      }

      return {
        connected: false,
        mode: 'simulation',
        message: 'No Zuoya GMK87 selected. Active in Hardware Protocol Simulation Mode.',
      };
    } catch (err: any) {
      return {
        connected: false,
        mode: 'simulation',
        message: `WebHID pairing skipped (${err?.message || 'user cancelled'}). Simulation Mode active.`,
      };
    }
  }

  public async disconnect(): Promise<void> {
    if (this.lcdDevice?.opened) {
      await this.lcdDevice.close().catch(() => {});
    }
    if (this.viaDevice?.opened) {
      await this.viaDevice.close().catch(() => {});
    }
    this.lcdDevice = null;
    this.viaDevice = null;
  }

  private async sendLcdPacket(
    command: LcdCommand,
    offset: number,
    payload?: Uint8Array
  ): Promise<{ fullPacket64: Uint8Array; checksum: number }> {
    const built = buildLcdPacket(command, offset, payload);
    if (this.lcdDevice?.opened) {
      await this.lcdDevice.sendReport(LCD_REPORT_ID, built.reportPayload63);
    }
    return { fullPacket64: built.fullPacket64, checksum: built.checksum };
  }

  /**
   * Writes the 48-byte configuration buffer:
   * Sequence: 0x01 (Init) -> 0x06 (Write Config, 48 bytes) -> 0x02 (Commit)
   */
  public async writeConfig(state: Gmk87ConfigState): Promise<string> {
    this.configBuffer = serializeConfigBuffer(state);
    await this.sendLcdPacket(LcdCommand.INIT, 0);
    const { fullPacket64 } = await this.sendLcdPacket(LcdCommand.WRITE_CONFIG, 0, this.configBuffer);
    await this.sendLcdPacket(LcdCommand.COMMIT, 0);
    return formatPacketHex(fullPacket64, 16);
  }

  /**
   * Streams one or more 240x135 RGB565 frames (each 65,536 bytes padded) to the GMK87 LCD flash memory.
   * Sequence:
   * 1. Write updated config (0x01 -> 0x06 -> 0x02)
   * 2. Send 0x23 (Ready for Upload)
   * 3. Stream 56-byte chunks with command 0x21 (yielding 25ms every 65,536 bytes; in simulation mode, paced smoothly for live visual feedback)
   * 4. Send 0x02 (Commit)
   */
  public async uploadFramesToLcd(
    frames: ImageData[],
    targetSlot: 0 | 1,
    configState: Gmk87ConfigState,
    onProgress: (info: UploadProgressInfo, currentFrameImageData?: ImageData) => void
  ): Promise<void> {
    if (this.isUploading) return;
    this.isUploading = true;

    try {
      const frameCount = Math.max(1, frames.length);
      const updatedConfig: Gmk87ConfigState = {
        ...configState,
        activeScreenMode: targetSlot === 0 ? 1 : 2,
        slot0FrameCount: targetSlot === 0 ? frameCount : configState.slot0FrameCount,
        slot1FrameCount: targetSlot === 1 ? frameCount : configState.slot1FrameCount,
      };

      const totalBytes = frameCount * PADDED_FRAME_BYTES;

      // Step 1: Write updated config (0x01 -> 0x06 -> 0x02)
      const cfgHex = await this.writeConfig(updatedConfig);
      onProgress({
        phase: 'config',
        bytesSent: 0,
        totalBytes,
        currentFrame: 1,
        totalFrames: frameCount,
        lastPacketHex: cfgHex,
        message: 'Step 1/4: Wrote 48B Config (0x01 → 0x06 → 0x02)',
      });

      // Step 2: Send 0x23 (Ready for Upload)
      const slotBaseOffset = targetSlot === 0 ? 0 : 16 * PADDED_FRAME_BYTES;
      const readyRes = await this.sendLcdPacket(LcdCommand.READY_UPLOAD, slotBaseOffset);
      onProgress({
        phase: 'ready',
        bytesSent: 0,
        totalBytes,
        currentFrame: 1,
        totalFrames: frameCount,
        lastPacketHex: formatPacketHex(readyRes.fullPacket64, 16),
        message: 'Step 2/4: Sent 0x23 Ready for Upload handshake',
      });

      // Encode all frames to 65,536-byte RGB565 buffers
      const encodedFrames = frames.map((img) => encodeImageDataToRGB565Frame(img));
      let bytesSent = 0;

      // Step 3: Stream 56-byte chunks with Command 0x21
      for (let f = 0; f < encodedFrames.length; f++) {
        const frameBuf = encodedFrames[f];
        const frameStartOffset = slotBaseOffset + f * PADDED_FRAME_BYTES;

        let posInFrame = 0;
        let chunkCounter = 0;
        while (posInFrame < PADDED_FRAME_BYTES) {
          const chunkLen = Math.min(56, PADDED_FRAME_BYTES - posInFrame);
          const chunkData = frameBuf.subarray(posInFrame, posInFrame + chunkLen);
          const globalOffset = frameStartOffset + posInFrame;

          const pkt = await this.sendLcdPacket(LcdCommand.FRAME_CHUNK, globalOffset, chunkData);
          posInFrame += chunkLen;
          bytesSent += chunkLen;
          chunkCounter++;

          // Update UI progress every 64 chunks (~3.5KB) so React renders at 60fps without choking
          if (chunkCounter % 64 === 0 || posInFrame >= PADDED_FRAME_BYTES) {
            onProgress(
              {
                phase: 'streaming',
                bytesSent,
                totalBytes,
                currentFrame: f + 1,
                totalFrames: frameCount,
                lastPacketHex: formatPacketHex(pkt.fullPacket64, 14),
                message: `Step 3/4: Streaming 56B RGB565 chunks (Frame ${f + 1}/${frameCount})`,
              },
              frames[f]
            );
            if (!this.lcdDevice?.opened) {
              // Brief yield in simulation mode so the user sees the 56B chunk progress bar animate smoothly
              await new Promise((r) => setTimeout(r, 4));
            }
          }
        }

        // Hardware requirement: yield 25ms every 65,536 bytes (1 frame boundary)
        await new Promise((r) => setTimeout(r, 25));
      }

      // Step 4: Send 0x02 (Commit)
      const commitRes = await this.sendLcdPacket(LcdCommand.COMMIT, 0);
      onProgress(
        {
          phase: 'complete',
          bytesSent: totalBytes,
          totalBytes,
          currentFrame: frameCount,
          totalFrames: frameCount,
          lastPacketHex: formatPacketHex(commitRes.fullPacket64, 16),
          message: `Flashed ${frameCount} frame(s) (${(totalBytes / 1024).toFixed(0)} KB RGB565) to Slot ${targetSlot}`,
        },
        frames[0]
      );
    } catch (err: any) {
      onProgress({
        phase: 'error',
        bytesSent: 0,
        totalBytes: 0,
        currentFrame: 0,
        totalFrames: frames.length,
        lastPacketHex: 'ERR',
        message: `Upload failed: ${err?.message || 'Unknown WebHID error'}`,
      });
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * VIA Protocol 9: Set Keycode Command 0x05 ([0x05, layer, row, col, keycodeHi, keycodeLo])
   */
  public async setViaKeycode(
    layer: number,
    row: number,
    col: number,
    keycode: number
  ): Promise<{ packetHex: string }> {
    const packet = new Uint8Array(32);
    packet[0] = 0x05; // DYNAMIC_KEYMAP_SET_KEYCODE
    packet[1] = layer & 0x03;
    packet[2] = row & 0x07;
    packet[3] = col & 0x0f;
    packet[4] = (keycode >> 8) & 0xff;
    packet[5] = keycode & 0xff;

    if (this.viaDevice?.opened) {
      await this.viaDevice.sendReport(VIA_REPORT_ID, packet);
    }

    return { packetHex: formatPacketHex(packet, 8) };
  }

  /**
   * VIA Protocol 9: Read Keymap Buffer Command 0x12 ([0x12, offsetHi, offsetLo, size])
   * Reads 28-byte chunks up to 4 * 8 * 15 * 2 = 960 bytes.
   */
  public async readViaKeymapBuffer(): Promise<{ totalBytes: number; chunksRead: number; lastCmdHex: string }> {
    const TOTAL_KEYMAP_BYTES = 4 * 8 * 15 * 2; // 960 bytes
    const CHUNK_SIZE = 28;
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

      if (this.viaDevice?.opened) {
        await this.viaDevice.sendReport(VIA_REPORT_ID, packet);
      }
      lastCmdHex = formatPacketHex(packet, 6);
      offset += size;
      chunksRead++;
    }

    return { totalBytes: TOTAL_KEYMAP_BYTES, chunksRead, lastCmdHex };
  }
}
