/// <reference types="node" />
import express, { type Request, type Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import type { Server } from 'node:http';
import { lookup as dnsLookup } from 'node:dns';
import zlib from 'node:zlib';
import * as HID from 'node-hid';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';

function resolveBaseDir(): string {
  if (typeof __dirname !== 'undefined') return __dirname;
  return process.cwd();
}

function resolveCliAndEnvNetworkConfig(): { port: number; host?: string } {
  let cliPort: number | undefined;
  let cliHost: string | undefined;
  const argv = typeof process !== 'undefined' && Array.isArray(process.argv) ? process.argv : [];
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--port' && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) cliPort = parsed;
      i++;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isFinite(parsed) && parsed > 0) cliPort = parsed;
    } else if (arg === '--host' && argv[i + 1]) {
      cliHost = argv[i + 1];
      i++;
    } else if (arg.startsWith('--host=')) {
      cliHost = arg.slice('--host='.length);
    }
  }

  const defaultAppPort = Number(process.env.DEFAULT_APP_PORT);
  const envPort = Number(process.env.PORT);
  const resolvedPort =
    cliPort ||
    (Number.isFinite(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 0) ||
    (Number.isFinite(envPort) && envPort > 0 && envPort !== 8080 ? envPort : 0) ||
    3887;

  return {
    port: resolvedPort,
    host: cliHost || process.env.HOST,
  };
}

export interface StartServerOptions {
  port?: number;
  host?: string;
  isProd?: boolean;
  distDir?: string;
  mediaScriptPath?: string;
}

export interface ServerHandle {
  server: Server;
  port: number;
  syncClock: () => Promise<{ success: boolean; time?: string; error?: string }>;
  getHardwareSummary: () => { detected: boolean; deviceName: string; viaConnected: boolean };
  stop: () => Promise<void>;
}

const DEFAULT_NETWORK_CONFIG = resolveCliAndEnvNetworkConfig();
const PORT = DEFAULT_NETWORK_CONFIG.port;
const VENDOR_ID = 0x320f;
const PRODUCT_ID = 0x5055;
const LCD_REPORT_ID = 0x04;
const PADDED_FRAME_BYTES = 65536;
const RAW_FRAME_BYTES = 240 * 135 * 2; // 64,800 bytes
const MAX_TOTAL_FRAMES = 36;

// ============================================================================
// Hardware HID State & Mutex
// ============================================================================
let hidQueue: Promise<unknown> = Promise.resolve();
let lastDeviceCloseTime = 0;
let cachedLcdPath: string | null = null;
let cachedLcdRelease = 0;
let cachedProductName = 'Zuoya GMK87';

interface CachedStatus {
  timestamp: number;
  connected: boolean;
  viaConnected: boolean;
  viaProtocol: number;
  firmwareRelease: number;
  firmwareVersion: string;
  deviceName: string;
  rawConfig: number[];
  config: {
    lightingEffect: number;
    brightness: number;
    speed: number;
    effectDirection: number;
    rainbowMode: number;
    rgbHueR: number;
    rgbHueG: number;
    rgbHueB: number;
    activeScreenMode: number;
    slot0FrameCount: number;
    slot1FrameCount: number;
    frameDurationMs: number;
    clockIso: string;
    clockTimestampMs: number;
  };
}

let cachedStatus: CachedStatus | null = null;
let lastRawConfig: Buffer | null = null;
const cachedSlotFrames: [Buffer[] | null, Buffer[] | null] = [null, null];

let uploadProgress = {
  phase: 'idle',
  bytesSent: 0,
  totalBytes: 65536,
  currentFrame: 0,
  totalFrames: 1,
  lastPacketHex: '04 28 00 01 00 00 00 00',
  message: 'Idle',
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withHidLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = hidQueue.then(fn, fn);
  hidQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function checksum16(buf: Buffer): number {
  let sum = 0;
  for (let i = 3; i < 64; i++) {
    sum = (sum + (buf[i] & 0xff)) & 0xffff;
  }
  return sum;
}

function formatHex(buf: Buffer | Uint8Array, maxLen = 16): string {
  return Array.from(buf.subarray(0, maxLen))
    .map((b) => b.toString(16).toUpperCase().padStart(2, '0'))
    .join(' ');
}

function toBcd(n: number): number {
  const c = Math.max(0, Math.min(99, Math.floor(n)));
  return (Math.floor(c / 10) << 4) | (c % 10);
}

function fromBcd(val: number): number {
  return ((val >> 4) & 0x0f) * 10 + (val & 0x0f);
}

function formatRelease(release: number): string {
  if (!release) return 'V0104';
  return 'V' + release.toString(16).toUpperCase().padStart(4, '0');
}

function discoverGmk87Interfaces(): {
  lcd: HID.Device | null;
  via: HID.Device | null;
} {
  const devices = HID.devices();
  const lcd =
    devices.find(
      (d) =>
        d.vendorId === VENDOR_ID &&
        d.productId === PRODUCT_ID &&
        (d.interface === 3 || d.usagePage === 0xff1c)
    ) || null;
  const via =
    devices.find(
      (d) =>
        d.vendorId === VENDOR_ID &&
        d.productId === PRODUCT_ID &&
        (d.interface === 1 || d.usagePage === 0xff60)
    ) || null;

  if (lcd?.path) {
    cachedLcdPath = lcd.path;
    cachedLcdRelease = lcd.release || 0x0104;
    cachedProductName = lcd.product || cachedProductName;
  } else {
    cachedLcdPath = null;
  }

  return { lcd, via };
}

async function openHidPath(devicePath: string): Promise<HID.HID> {
  const sinceClose = Date.now() - lastDeviceCloseTime;
  if (sinceClose < 100) {
    await delay(100 - sinceClose);
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
  throw new Error('Failed to open HID device');
}

function closeHidDevice(dev: HID.HID | null | undefined): void {
  if (!dev) return;
  try {
    dev.close();
  } catch {
    // ignore close error
  }
  lastDeviceCloseTime = Date.now();
}

async function safeWrite(device: HID.HID, buffer: Buffer): Promise<void> {
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

function buildLcdPacketBuffer(
  commandId: number,
  data: Uint8Array = Buffer.alloc(0),
  pos = 0
): Buffer {
  const buffer = Buffer.alloc(64, 0x00);
  const len = Math.min(56, data.length);
  buffer[0] = LCD_REPORT_ID;
  buffer[3] = commandId & 0xff;
  buffer[4] = len & 0xff;
  buffer[5] = pos & 0xff;
  buffer[6] = (pos >> 8) & 0xff;
  buffer[7] = (pos >> 16) & 0xff;
  if (len > 0) {
    buffer.set(data.subarray(0, len), 8);
  }
  const chk = checksum16(buffer);
  buffer[1] = chk & 0xff;
  buffer[2] = (chk >> 8) & 0xff;
  return buffer;
}

function drainDevice(device: HID.HID, maxPackets = 24): number {
  let count = 0;
  for (let i = 0; i < maxPackets; i++) {
    try {
      const r = device.readTimeout(15);
      if (!r || r.length === 0) break;
      count++;
    } catch {
      break;
    }
  }
  return count;
}

async function sendWithPosition(
  device: HID.HID,
  commandId: number,
  data: Uint8Array = Buffer.alloc(0),
  pos = 0,
  waitMs = 2500,
  matchPos = false
): Promise<Buffer | null> {
  if (commandId === 0x02) {
    await delay(100);
  }

  const buffer = buildLcdPacketBuffer(commandId, data, pos);
  await safeWrite(device, buffer);

  const expectedCmd = commandId & 0xff;
  const expectedLen = Math.min(56, data.length) & 0xff;
  const p0 = pos & 0xff;
  const p1 = (pos >> 8) & 0xff;
  const p2 = (pos >> 16) & 0xff;

  const start = Date.now();
  while (Date.now() - start < waitMs) {
    const remaining = waitMs - (Date.now() - start);
    if (remaining <= 0) break;
    const sliceMs = Math.max(5, Math.min(80, remaining));
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
    await delay(1);
  }
  return null;
}

async function readLcdConfig(device: HID.HID, releaseHint = 0x0104): Promise<Buffer> {
  drainDevice(device);

  const initAck = await sendWithPosition(device, 0x01, Buffer.alloc(0), 0);
  if (!initAck) {
    throw new Error('GMK87 did not acknowledge INIT (0x01) while reading config');
  }
  for (let i = 0; i < 9; i++) {
    await sendWithPosition(device, 0x03, Buffer.alloc(4, 0x00), i * 4);
  }
  await sendWithPosition(device, 0x03, Buffer.alloc(1, 0x00), 36);
  const prepCommitAck = await sendWithPosition(device, 0x02, Buffer.alloc(0), 0);
  if (!prepCommitAck) {
    throw new Error('GMK87 did not acknowledge COMMIT (0x02) while preparing config read');
  }

  const raw48 = Buffer.alloc(48, 0x00);
  for (let i = 0; i < 12; i++) {
    const chunk = await sendWithPosition(device, 0x05, Buffer.alloc(4, 0x00), i * 4);
    if (!chunk || chunk.length < 4) {
      throw new Error(`GMK87 timed out reading config chunk at offset ${i * 4}`);
    }
    chunk.copy(raw48, i * 4, 0, 4);
  }

  // V0112 stores 64 bytes (extended tail 48..63 contains 0x31 VIA protocol selector)
  if (releaseHint >= 0x0112) {
    const raw64 = Buffer.alloc(64, 0x00);
    raw48.copy(raw64, 0);
    let gotExtended = false;
    for (let pos = 48; pos < 64; pos += 4) {
      const chunk = await sendWithPosition(device, 0x05, Buffer.alloc(4, 0x00), pos, 250);
      if (chunk && chunk.length >= 4) {
        chunk.copy(raw64, pos, 0, 4);
        gotExtended = true;
      } else {
        break;
      }
    }
    if (gotExtended) {
      lastRawConfig = raw64;
      return raw64;
    }
  }

  lastRawConfig = raw48;
  return raw48;
}

async function writeLcdConfig(device: HID.HID, cfgBuffer: Buffer): Promise<string> {
  if (cfgBuffer.length >= 64 && cfgBuffer[0x31] !== 9 && cfgBuffer[0x31] !== 11) {
    cfgBuffer[0x31] = 11;
  }

  drainDevice(device);

  const initAck = await sendWithPosition(device, 0x01, Buffer.alloc(0), 0);
  if (!initAck) {
    throw new Error('GMK87 did not acknowledge INIT (0x01) before writing config');
  }
  let lastHex = '';
  for (let pos = 0; pos < cfgBuffer.length; pos += 56) {
    const slice = cfgBuffer.subarray(pos, Math.min(pos + 56, cfgBuffer.length));
    const pkt = buildLcdPacketBuffer(0x06, slice, pos);
    lastHex = formatHex(pkt, 16);
    const writeAck = await sendWithPosition(device, 0x06, slice, pos);
    if (!writeAck) {
      throw new Error(`GMK87 did not acknowledge WRITE_CONFIG (0x06) at offset ${pos}`);
    }
  }
  const commitAck = await sendWithPosition(device, 0x02, Buffer.alloc(0), 0);
  if (!commitAck) {
    throw new Error('GMK87 did not acknowledge COMMIT (0x02) after writing config');
  }
  lastRawConfig = Buffer.from(cfgBuffer);
  return lastHex;
}

function parseConfigStruct(cfg: Buffer) {
  const sec = fromBcd(cfg[35] ?? 0);
  const min = fromBcd(cfg[36] ?? 0);
  const hour = fromBcd(cfg[37] ?? 0);
  const date = Math.max(1, Math.min(31, fromBcd(cfg[39] ?? 1) || 1));
  const month = Math.max(1, Math.min(12, fromBcd(cfg[40] ?? 1) || 1));
  const year = 2000 + fromBcd(cfg[41] ?? 26);

  const parsed = new Date(year, month - 1, date, hour, min, sec);
  const frameDurationMs = Math.max(60, (cfg[43] | (cfg[44] << 8)) || 100);

  return {
    lightingEffect: cfg[1],
    brightness: Math.max(0, Math.min(9, cfg[2])),
    speed: Math.max(0, Math.min(4, cfg[3])),
    effectDirection: (cfg[4] ?? 0) & 0x01,
    rainbowMode: (cfg[5] ?? 0) & 0x01,
    rgbHueR: cfg[6],
    rgbHueG: cfg[7],
    rgbHueB: cfg[8],
    activeScreenMode: Math.max(0, Math.min(2, cfg[33])),
    slot0FrameCount: Math.max(1, cfg[34] || 1),
    slot1FrameCount: Math.max(1, cfg[46] || 1),
    frameDurationMs,
    clockIso: `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')} ${String(
      hour
    ).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`,
    clockTimestampMs: Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime(),
  };
}

function patchConfigBuffer(base: Buffer, patch: Record<string, any>): Buffer {
  const cfg = Buffer.from(base);
  if (patch.lightingEffect !== undefined) {
    cfg[1] = Math.max(0, Math.min(18, Number(patch.lightingEffect)));
  }
  if (patch.brightness !== undefined) {
    cfg[2] = Math.max(0, Math.min(9, Number(patch.brightness)));
  }
  if (patch.speed !== undefined) {
    cfg[3] = Math.max(0, Math.min(4, Number(patch.speed)));
  }
  if (patch.effectDirection !== undefined) {
    cfg[4] = Number(patch.effectDirection) ? 1 : 0;
  }
  if (patch.rainbowMode !== undefined) {
    cfg[5] = Number(patch.rainbowMode) ? 1 : 0;
  }
  if (patch.rgbHueR !== undefined) cfg[6] = Number(patch.rgbHueR) & 0xff;
  if (patch.rgbHueG !== undefined) cfg[7] = Number(patch.rgbHueG) & 0xff;
  if (patch.rgbHueB !== undefined) cfg[8] = Number(patch.rgbHueB) & 0xff;
  if (patch.activeScreenMode !== undefined) {
    cfg[33] = Math.max(0, Math.min(2, Number(patch.activeScreenMode)));
  }
  if (patch.slot0FrameCount !== undefined) {
    cfg[34] = Math.max(1, Math.min(255, Number(patch.slot0FrameCount)));
  }
  if (patch.slot1FrameCount !== undefined) {
    cfg[46] = Math.max(1, Math.min(255, Number(patch.slot1FrameCount)));
  }

  const existingDelay = cfg[43] | (cfg[44] << 8);
  const frameDurationMs = Math.max(
    60,
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
      cfg[38] = d.getDay();
      cfg[39] = toBcd(d.getDate());
      cfg[40] = toBcd(d.getMonth() + 1);
      cfg[41] = toBcd(d.getFullYear() % 100);
    }
  }

  return cfg;
}

async function readViaProtocolAndClose(viaPath: string): Promise<number> {
  const dev = await openHidPath(viaPath);
  try {
    const req = Buffer.alloc(33, 0);
    req[0] = 0x00;
    req[1] = 0x01; // GetProtocolVersion
    await safeWrite(dev, req);
    const resp = dev.readTimeout(400);
    if (resp && resp.length >= 3 && resp[0] === 0x01) {
      return (resp[1] << 8) | resp[2] || 9;
    }
    return 9;
  } finally {
    closeHidDevice(dev);
  }
}

// ============================================================================
// System CPU Delta + Windows Media Session Telemetry
// ============================================================================
let prevCpuTotals: { idle: number; total: number } | null = null;
let cachedCpuPercent = 18;

function sampleCpuPercent(): number {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total +=
      cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  if (prevCpuTotals) {
    const idleDiff = idle - prevCpuTotals.idle;
    const totalDiff = total - prevCpuTotals.total;
    if (totalDiff > 0) {
      cachedCpuPercent = Math.max(1, Math.min(99, Math.round(100 - (100 * idleDiff) / totalDiff)));
    }
  }
  prevCpuTotals = { idle, total };
  return cachedCpuPercent;
}

function getSystemMetricsSnapshot() {
  const cpuPercent = sampleCpuPercent();
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = Math.max(0, totalBytes - freeBytes);
  const totalMemGb = Math.round((totalBytes / (1024 * 1024 * 1024)) * 10) / 10;
  const usedMemGb = Math.round((usedBytes / (1024 * 1024 * 1024)) * 10) / 10;
  const ramPercent = Math.max(1, Math.min(100, Math.round((usedBytes / totalBytes) * 100)));

  const upSec = Math.floor(os.uptime());
  const hrs = Math.floor(upSec / 3600);
  const mins = Math.floor((upSec % 3600) / 60);
  const secs = upSec % 60;
  const uptimeStr = `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(
    secs
  ).padStart(2, '0')}`;

  return {
    cpuPercent,
    ramPercent,
    ramUsedGb: usedMemGb,
    ramTotalGb: totalMemGb,
    uptimeStr,
    uptimeHours: Math.round((upSec / 3600) * 10) / 10,
    platform: os.platform(),
  };
}

let cachedMedia = {
  status: 'Inactive',
  title: 'No Active Windows Media',
  artist: 'Windows Media Session Idle',
  album: '',
};
let isMediaPolling = false;

function pollWindowsMedia(scriptPath: string): void {
  if (isMediaPolling || process.platform !== 'win32') return;
  isMediaPolling = true;
  execFile(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath],
    { timeout: 3500 },
    (err, stdout) => {
      isMediaPolling = false;
      if (err || !stdout) return;
      try {
        const parsed = JSON.parse(stdout.trim());
        if (parsed && parsed.Status !== 'Error') {
          cachedMedia = {
            status: parsed.Status || 'Inactive',
            title: parsed.Title || (parsed.Status === 'Playing' ? 'Unknown Track' : 'No Active Media'),
            artist: parsed.Artist || 'Windows Audio Session',
            album: parsed.Album || '',
          };
        }
      } catch {
        // Ignore malformed PS output
      }
    }
  );
}

// ============================================================================
// Web GIF Search & Proxy Helpers (HTTP/2 Multiplexed + IPv4 Keep-Alive)
// ============================================================================
export interface WebGifSearchResult {
  id: string;
  title: string;
  url: string;
  preview: string;
  source: string;
  width: number;
  height: number;
}

const DEFAULT_BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface PooledH2Entry {
  session: http2.ClientHttp2Session;
  waiters: Set<(err: Error) => void>;
}

const h2SessionPool = new Map<string, PooledH2Entry>();
const h2CapableCache = new Map<string, boolean>();
const keepAliveHttpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8 });
const keepAliveHttpAgent = new http.Agent({ keepAlive: true, maxSockets: 8 });

const GIF_CACHE_TTL_MS = 10 * 60 * 1000;
const tenorPoolCache = new Map<string, { timestamp: number; items: WebGifSearchResult[] }>();
const gifPageCache = new Map<string, { timestamp: number; items: WebGifSearchResult[] }>();
const gifInFlightRequests = new Map<string, Promise<WebGifSearchResult[]>>();

function cleanupUpstreamPools(): void {
  for (const entry of h2SessionPool.values()) {
    try {
      entry.session.close();
    } catch {
      // ignore close error
    }
  }
  h2SessionPool.clear();
  keepAliveHttpsAgent.destroy();
  keepAliveHttpAgent.destroy();
}

function ipv4DnsLookup(
  hostname: string,
  options: any,
  callback: (err: NodeJS.ErrnoException | null, address: any, family?: number) => void
) {
  if (typeof options === 'function') {
    return dnsLookup(hostname, { family: 4 }, options);
  }
  return dnsLookup(hostname, { ...(options || {}), family: 4 }, callback);
}

function decodeContentEncoding(buf: Buffer, encodingHeader: string | string[] | undefined): Buffer {
  const enc = String(Array.isArray(encodingHeader) ? encodingHeader[0] : encodingHeader || '').toLowerCase();
  if (!enc) return buf;
  try {
    if (enc.includes('br')) return zlib.brotliDecompressSync(buf);
    if (enc.includes('gzip')) return zlib.gunzipSync(buf);
    if (enc.includes('deflate')) return zlib.inflateSync(buf);
  } catch {
    // Return raw bytes if upstream mislabeled encoding
  }
  return buf;
}

function getOrCreateH2Session(origin: string): PooledH2Entry {
  const existing = h2SessionPool.get(origin);
  if (existing && !existing.session.closed && !existing.session.destroyed) {
    return existing;
  }

  const waiters = new Set<(err: Error) => void>();
  const session = http2.connect(origin, {
    ALPNProtocols: ['h2'],
    lookup: ipv4DnsLookup,
  } as any);

  const entry: PooledH2Entry = { session, waiters };
  const handleDown = (reason: Error) => {
    if (h2SessionPool.get(origin) === entry) {
      h2SessionPool.delete(origin);
    }
    for (const notify of Array.from(waiters)) {
      notify(reason);
    }
    waiters.clear();
  };

  session.on('error', (err) => handleDown(err));
  session.on('goaway', () => handleDown(new Error(`HTTP/2 GOAWAY from ${origin}`)));
  session.on('close', () => handleDown(new Error(`HTTP/2 session closed for ${origin}`)));

  h2SessionPool.set(origin, entry);
  return entry;
}

interface UpstreamResponse {
  status: number;
  headers: Record<string, string>;
  body: Buffer;
  finalUrl: string;
}

function requestOnceHttp2(
  u: URL,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const entry = getOrCreateH2Session(u.origin);
    let settled = false;
    let req: http2.ClientHttp2Stream | null = null;

    const cleanupAndFinish = (err: Error | null, val?: { status: number; headers: Record<string, string>; body: Buffer }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      entry.waiters.delete(onSessionDrop);
      if (err) reject(err);
      else if (val) resolve(val);
    };

    const onSessionDrop = (err: Error) => {
      cleanupAndFinish(err);
    };
    entry.waiters.add(onSessionDrop);

    const timer = setTimeout(() => {
      try {
        req?.close();
      } catch {
        // ignore stream close error
      }
      cleanupAndFinish(new Error(`Upstream HTTP/2 timeout after ${timeoutMs}ms (${u.hostname})`));
    }, timeoutMs);

    const h2Headers: Record<string, string> = {
      ':path': `${u.pathname}${u.search}` || '/',
    };
    for (const [k, v] of Object.entries(headers)) {
      const lower = k.toLowerCase();
      if (lower !== 'connection' && lower !== 'host' && lower !== 'keep-alive' && v != null) {
        h2Headers[lower] = v;
      }
    }

    try {
      req = entry.session.request(h2Headers);
    } catch (err: any) {
      cleanupAndFinish(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;
    let status = 0;
    const flatHeaders: Record<string, string> = {};

    req.on('response', (respHeaders) => {
      status = Number(respHeaders[':status']) || 0;
      for (const [k, v] of Object.entries(respHeaders)) {
        if (!k.startsWith(':') && v != null) {
          flatHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
        }
      }
    });

    req.on('data', (chunk: Buffer) => {
      totalBytes += chunk.length;
      if (totalBytes > maxBytes) {
        try {
          req?.close();
        } catch {
          // ignore
        }
        cleanupAndFinish(new Error(`Image exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`));
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      h2CapableCache.set(u.origin, true);
      const raw = Buffer.concat(chunks);
      const body = decodeContentEncoding(raw, flatHeaders['content-encoding']);
      cleanupAndFinish(null, { status, headers: flatHeaders, body });
    });

    req.on('error', (err) => cleanupAndFinish(err));
    req.end();
  });
}

function requestOnceHttp1(
  u: URL,
  headers: Record<string, string>,
  timeoutMs: number,
  maxBytes: number
): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const isHttps = u.protocol === 'https:';
    const lib = isHttps ? https : http;
    const agent = isHttps ? keepAliveHttpsAgent : keepAliveHttpAgent;
    let settled = false;

    const cleanupAndFinish = (err: Error | null, val?: { status: number; headers: Record<string, string>; body: Buffer }) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) reject(err);
      else if (val) resolve(val);
    };

    const req = lib.request(
      u,
      {
        agent,
        lookup: ipv4DnsLookup,
        headers,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        const flatHeaders: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (v != null) {
            flatHeaders[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
          }
        }

        res.on('data', (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes > maxBytes) {
            req.destroy();
            cleanupAndFinish(new Error(`Image exceeds ${Math.round(maxBytes / (1024 * 1024))}MB limit`));
            return;
          }
          chunks.push(chunk);
        });

        res.on('end', () => {
          const raw = Buffer.concat(chunks);
          const body = decodeContentEncoding(raw, flatHeaders['content-encoding']);
          cleanupAndFinish(null, { status: res.statusCode || 0, headers: flatHeaders, body });
        });

        res.on('error', (err) => cleanupAndFinish(err));
      }
    );

    const timer = setTimeout(() => {
      req.destroy();
      cleanupAndFinish(new Error(`Upstream timeout after ${timeoutMs}ms (${u.hostname})`));
    }, timeoutMs);

    req.on('error', (err) => cleanupAndFinish(err));
    req.end();
  });
}

async function fetchUpstreamBuffer(
  urlStr: string,
  options: {
    headers?: Record<string, string>;
    timeoutMs?: number;
    maxRedirects?: number;
    maxBytes?: number;
    validateHost?: boolean;
  } = {}
): Promise<UpstreamResponse> {
  const timeoutMs = options.timeoutMs ?? 25000;
  const maxRedirects = options.maxRedirects ?? 4;
  const maxBytes = options.maxBytes ?? 20 * 1024 * 1024;
  const baseHeaders = options.headers || {};
  const deadline = Date.now() + timeoutMs;
  let currentUrl = urlStr;

  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(currentUrl);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      throw new Error('Unsupported URL protocol');
    }
    if (options.validateHost && isDisallowedProxyHost(u.hostname)) {
      throw new Error('Target host not allowed');
    }

    const remaining = Math.max(3000, deadline - Date.now());
    let resp: { status: number; headers: Record<string, string>; body: Buffer };

    if (u.protocol === 'https:' && h2CapableCache.get(u.origin) !== false) {
      try {
        resp = await requestOnceHttp2(u, baseHeaders, remaining, maxBytes);
      } catch (err: any) {
        const code = String(err?.code || '');
        const msg = String(err?.message || '');
        if (code.includes('HTTP2') || msg.includes('ALPN') || msg.includes('protocol') || msg.includes('GOAWAY')) {
          h2CapableCache.set(u.origin, false);
        }
        const fallbackRemaining = deadline - Date.now();
        if (fallbackRemaining > 2000 && !msg.includes('exceeds')) {
          resp = await requestOnceHttp1(u, baseHeaders, fallbackRemaining, maxBytes);
        } else {
          throw err;
        }
      }
    } else {
      resp = await requestOnceHttp1(u, baseHeaders, remaining, maxBytes);
    }

    if (resp.status >= 300 && resp.status < 400 && resp.headers.location && hop < maxRedirects) {
      currentUrl = new URL(resp.headers.location, u).toString();
      continue;
    }

    return {
      status: resp.status,
      headers: resp.headers,
      body: resp.body,
      finalUrl: currentUrl,
    };
  }

  throw new Error('Too many upstream redirects');
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, '');
}

function formatSlugTitle(urlStr: string, fallback: string): string {
  try {
    const file = decodeURIComponent(new URL(urlStr).pathname.split('/').pop() || '');
    const stripped = file.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
    if (stripped.length >= 2) {
      return stripped.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 48);
    }
  } catch {
    // ignore URL parse error
  }
  return fallback.slice(0, 48);
}

async function fetchTenorRawQuery(searchQuery: string): Promise<WebGifSearchResult[]> {
  const key = searchQuery.trim().toLowerCase();
  const cached = tenorPoolCache.get(key);
  if (cached && Date.now() - cached.timestamp < GIF_CACHE_TTL_MS && cached.items.length > 0) {
    return cached.items;
  }

  const resp = await fetchUpstreamBuffer(
    `https://tenor.com/search?q=${encodeURIComponent(searchQuery)}`,
    {
      timeoutMs: 22000,
      headers: {
        'User-Agent': DEFAULT_BROWSER_UA,
        Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'br, gzip, deflate',
      },
    }
  );

  if (resp.status !== 200) {
    throw new Error(`Tenor returned HTTP ${resp.status}`);
  }

  const html = resp.body.toString('utf8');
  const results: WebGifSearchResult[] = [];
  const seenUrls = new Set<string>();

  const storeMatch = html.match(/<script[^>]*id="store-cache"[^>]*>([\s\S]*?)<\/script>/i);
  if (storeMatch) {
    try {
      const storeJson: any = JSON.parse(storeMatch[1]);
      const searchBucket = storeJson?.universal?.search;
      if (searchBucket && typeof searchBucket === 'object') {
        for (const bucketVal of Object.values<any>(searchBucket)) {
          const list: any[] = Array.isArray(bucketVal?.results) ? bucketVal.results : [];
          for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const fmts = item?.media_formats || {};
            // tinygif lives on media.tenor.com (HTTP/2 fast, ~220px wide matching 240x135 LCD)
            const chosen = fmts.tinygif?.url
              ? fmts.tinygif
              : fmts.gif?.url
                ? fmts.gif
                : fmts.mediumgif;
            const gifUrl = typeof chosen?.url === 'string' ? chosen.url : '';
            if (!gifUrl.startsWith('https://') && !gifUrl.startsWith('http://')) continue;
            if (seenUrls.has(gifUrl)) continue;
            seenUrls.add(gifUrl);

            const dims = Array.isArray(chosen?.dims) ? chosen.dims : [220, 135];
            const rawTitle =
              item.h1_title ||
              item.title ||
              item.content_description ||
              formatSlugTitle(gifUrl, `${searchQuery} GIF #${results.length + 1}`);

            results.push({
              id: `tenor_${item.id || i}_${Math.random().toString(36).slice(2, 6)}`,
              title: decodeHtmlEntities(String(rawTitle)).slice(0, 48),
              url: gifUrl,
              preview: typeof fmts.tinygif?.url === 'string' ? fmts.tinygif.url : gifUrl,
              source: 'Tenor',
              width: Number(dims[0]) || 220,
              height: Number(dims[1]) || 135,
            });
          }
        }
      }
    } catch {
      // Fall through to HTML URL extraction fallback below
    }
  }

  if (results.length === 0) {
    const regexUrls = html.match(/https:\/\/media\.tenor\.com\/[^"'\\\s<>]+?\.gif/gi) || [];
    for (let i = 0; i < regexUrls.length; i++) {
      const u = regexUrls[i];
      if (seenUrls.has(u)) continue;
      seenUrls.add(u);
      results.push({
        id: `tenor_rx_${i}_${Math.random().toString(36).slice(2, 6)}`,
        title: formatSlugTitle(u, `${searchQuery} GIF #${results.length + 1}`),
        url: u,
        preview: u,
        source: 'Tenor',
        width: 220,
        height: 135,
      });
    }
  }

  if (results.length > 0) {
    tenorPoolCache.set(key, { timestamp: Date.now(), items: results });
  }
  return results;
}

async function searchWikimediaGifs(query: string, page = 0): Promise<WebGifSearchResult[]> {
  const cleanQuery = query.trim() || 'cyberpunk';
  const offset = Math.max(0, page) * 25;
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6` +
    `&gsrsearch=${encodeURIComponent(`${cleanQuery} filemime:image/gif`)}` +
    `&gsrlimit=25&gsroffset=${offset}&prop=imageinfo&iiprop=url|mime|size&format=json`;

  const resp = await fetchUpstreamBuffer(url, {
    timeoutMs: 20000,
    headers: {
      'User-Agent': 'GMK87MasterControlCenter/1.0 (https://github.com/RahifSl/gmk87)',
      Accept: 'application/json',
      'Accept-Encoding': 'br, gzip, deflate',
    },
  });

  if (resp.status !== 200) {
    throw new Error(`Wikimedia returned HTTP ${resp.status}`);
  }

  const data: any = JSON.parse(resp.body.toString('utf8'));
  const pages: any[] = Object.values(data?.query?.pages || {});
  const results: WebGifSearchResult[] = [];

  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const info = Array.isArray(p?.imageinfo) ? p.imageinfo[0] : null;
    const gifUrl = typeof info?.url === 'string' ? info.url : '';
    if (!gifUrl || info?.mime !== 'image/gif') continue;
    const title = String(p?.title || '')
      .replace(/^File:/i, '')
      .replace(/\.gif$/i, '')
      .replace(/_/g, ' ')
      .trim();
    results.push({
      id: `wiki_${p.pageid || i}_${page}`,
      title: (title || `${cleanQuery} GIF`).slice(0, 48),
      url: gifUrl,
      preview: gifUrl,
      source: 'Wikimedia',
      width: Number(info?.width) || 240,
      height: Number(info?.height) || 135,
    });
  }

  return results;
}

async function searchDuckDuckGoGifs(query: string, page = 0): Promise<WebGifSearchResult[]> {
  const cleanQuery = query.trim() || 'cyberpunk';
  const searchParam = encodeURIComponent(`${cleanQuery} gif`);
  const headers = {
    'User-Agent': DEFAULT_BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'br, gzip, deflate',
  };

  const tokenRes = await fetchUpstreamBuffer(`https://duckduckgo.com/?q=${searchParam}`, {
    timeoutMs: 18000,
    headers,
  });
  if (tokenRes.status !== 200) {
    throw new Error(`DuckDuckGo returned HTTP ${tokenRes.status}`);
  }
  const html = tokenRes.body.toString('utf8');
  const match = html.match(/vqd=["']?([\d-]+)/);
  if (!match) {
    return [];
  }
  const vqd = match[1];
  const apiUrl = `https://duckduckgo.com/i.js?q=${searchParam}&o=json&vqd=${vqd}&f=type:gif&s=${page * 30}`;
  const apiRes = await fetchUpstreamBuffer(apiUrl, {
    timeoutMs: 18000,
    headers: {
      ...headers,
      Referer: 'https://duckduckgo.com/',
    },
  });
  // Strictly require 200 (DDG returns 202 anti-bot JSON challenge when rate-limited)
  if (apiRes.status !== 200) {
    throw new Error(`DuckDuckGo i.js returned HTTP ${apiRes.status}`);
  }
  const data: any = JSON.parse(apiRes.body.toString('utf8'));
  const rawResults: any[] = Array.isArray(data?.results) ? data.results : [];

  return rawResults
    .filter(
      (r) =>
        typeof r?.image === 'string' &&
        (r.image.startsWith('https://') || r.image.startsWith('http://'))
    )
    .slice(0, 30)
    .map((r, i) => ({
      id: `ddg_${page}_${i}_${Math.random().toString(36).slice(2, 7)}`,
      title: decodeHtmlEntities(r.title || `${cleanQuery} GIF #${page * 30 + i + 1}`).slice(0, 48),
      url: r.image,
      preview: r.thumbnail || r.image,
      source: r.source || 'Web',
      width: Number(r.width) || 240,
      height: Number(r.height) || 135,
    }));
}

async function searchWebGifs(query: string, page = 0): Promise<WebGifSearchResult[]> {
  const cleanQuery = query.trim() || 'cyberpunk neon';
  const cacheKey = `${cleanQuery.toLowerCase()}::p${page}`;

  const cachedPage = gifPageCache.get(cacheKey);
  if (cachedPage && Date.now() - cachedPage.timestamp < GIF_CACHE_TTL_MS && cachedPage.items.length > 0) {
    return cachedPage.items;
  }

  const pending = gifInFlightRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const task = (async (): Promise<WebGifSearchResult[]> => {
    const PAGE_SIZE = 25;
    let items: WebGifSearchResult[] = [];
    const errors: string[] = [];

    // Strategy 1: Tenor (returns 50 items per query -> serves page 0 [0..24] and page 1 [25..49] cleanly,
    // and cycles semantic variations for page >= 2 while deduplicating already-seen URLs)
    try {
      const baseItems = await fetchTenorRawQuery(cleanQuery);
      if (page === 0) {
        items = baseItems.slice(0, PAGE_SIZE);
      } else if (page === 1) {
        items = baseItems.slice(PAGE_SIZE, PAGE_SIZE * 2);
        if (items.length < 15) {
          const seen = new Set(baseItems.map((x) => x.url));
          const extra = await fetchTenorRawQuery(`${cleanQuery} loop`).catch(() => []);
          for (const it of extra) {
            if (!seen.has(it.url)) {
              seen.add(it.url);
              items.push(it);
              if (items.length >= PAGE_SIZE) break;
            }
          }
        }
      } else {
        const seen = new Set(baseItems.map((x) => x.url));
        const suffixes = ['loop', 'aesthetic', 'animation', 'wallpaper', 'retro', 'art', 'vibe'];
        const suffix = suffixes[(page - 2) % suffixes.length];
        const variantItems = await fetchTenorRawQuery(`${cleanQuery} ${suffix}`);
        for (const it of variantItems) {
          if (!seen.has(it.url)) {
            seen.add(it.url);
            items.push(it);
            if (items.length >= PAGE_SIZE) break;
          }
        }
      }
    } catch (err: any) {
      errors.push(err?.message || 'Tenor unavailable');
    }

    // Strategy 2: Wikimedia Commons Animated GIFs (true cursor offset pagination, zero Fastly dependency)
    if (items.length === 0) {
      try {
        items = await searchWikimediaGifs(cleanQuery, page);
      } catch (err: any) {
        errors.push(err?.message || 'Wikimedia unavailable');
      }
    }

    // Strategy 3: DuckDuckGo Images (last resort when other providers return nothing)
    if (items.length === 0) {
      try {
        items = await searchDuckDuckGoGifs(cleanQuery, page);
      } catch (err: any) {
        errors.push(err?.message || 'DuckDuckGo unavailable');
      }
    }

    if (items.length === 0 && errors.length > 0) {
      throw new Error(`Web GIF providers unreachable: ${errors.join('; ')}`);
    }

    if (items.length > 0) {
      gifPageCache.set(cacheKey, { timestamp: Date.now(), items });
    }
    return items;
  })();

  gifInFlightRequests.set(cacheKey, task);
  try {
    return await task;
  } finally {
    gifInFlightRequests.delete(cacheKey);
  }
}

function isDisallowedProxyHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower === '::1' ||
    lower.endsWith('.local') ||
    lower === '0.0.0.0'
  ) {
    return true;
  }
  const ipv4Match = lower.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (ipv4Match) {
    const a = Number(ipv4Match[1]);
    const b = Number(ipv4Match[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }
  return false;
}

// ============================================================================
// Express App & Server Startup
// ============================================================================
async function syncHardwareClockNow(): Promise<{ success: boolean; time?: string; error?: string }> {
  try {
    return await withHidLock(async () => {
      const { lcd } = discoverGmk87Interfaces();
      if (!lcd?.path) {
        return { success: false, error: 'GMK87 not connected in wired USB mode' };
      }
      const dev = await openHidPath(lcd.path);
      try {
        // Always read live EEPROM/flash config so on-keyboard Fn adjustments are never overwritten
        const base = await readLcdConfig(dev, lcd.release || 0x0104);
        const updatedCfg = patchConfigBuffer(base, { clockTimestampMs: Date.now() });
        await writeLcdConfig(dev, updatedCfg);
        const parsed = parseConfigStruct(updatedCfg);
        if (cachedStatus) {
          cachedStatus = {
            ...cachedStatus,
            timestamp: Date.now(),
            rawConfig: Array.from(updatedCfg),
            config: parsed,
          };
        }
        return { success: true, time: parsed.clockIso };
      } finally {
        closeHidDevice(dev);
      }
    });
  } catch (err: any) {
    return { success: false, error: err?.message || 'Clock sync failed' };
  }
}

export async function startServer(options: StartServerOptions = {}): Promise<ServerHandle> {
  const baseDir = resolveBaseDir();
  const listenPort = options.port ?? PORT;
  const isProd = options.isProd ?? process.env.NODE_ENV === 'production';
  const distDir = options.distDir || path.resolve(baseDir, 'dist');
  const mediaScriptPath = options.mediaScriptPath || path.resolve(baseDir, 'get_media.ps1');

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.use((_req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const { lcd, via } = discoverGmk87Interfaces();
    res.json({
      ok: true,
      app: 'gmk87-master-control-center',
      pid: process.pid,
      port: listenPort,
      hardwareDetected: Boolean(lcd || via),
      deviceName: cachedProductName,
    });
  });

  // --------------------------------------------------------------------------
  // Hardware USB HID API Routes
  // --------------------------------------------------------------------------
  app.get('/api/hid/status', async (req: Request, res: Response) => {
    const forceRefresh = req.query.refresh === '1';
    if (!forceRefresh && cachedStatus && Date.now() - cachedStatus.timestamp < 5000) {
      return res.json({ bridgeAvailable: true, ...cachedStatus });
    }

    try {
      const result = await withHidLock(async () => {
        const { lcd, via } = discoverGmk87Interfaces();
        if (!lcd && !via) {
          cachedStatus = null;
          return {
            bridgeAvailable: true,
            connected: false,
            viaConnected: false,
            viaProtocol: 9,
            firmwareRelease: 0,
            firmwareVersion: 'Offline',
            deviceName: 'Zuoya GMK87',
            error: 'Zuoya GMK87 not detected in wired USB mode (VID 0x320F / PID 0x5055)',
          };
        }

        let viaProtocol = 9;
        if (via?.path) {
          try {
            viaProtocol = await readViaProtocolAndClose(via.path);
          } catch {
            viaProtocol = 9;
          }
        }

        if (!lcd?.path) {
          return {
            bridgeAvailable: true,
            connected: false,
            viaConnected: Boolean(via),
            viaProtocol,
            firmwareRelease: via?.release || 0x0104,
            firmwareVersion: formatRelease(via?.release || 0x0104),
            deviceName: via?.product || cachedProductName,
            error: 'VIA interface found, but LCD interface (MI_03 / 0xFF1C) is not available.',
          };
        }

        const dev = await openHidPath(lcd.path);
        try {
          const cfg = await readLcdConfig(dev, lcd.release || 0x0104);
          const parsed = parseConfigStruct(cfg);
          const nextCached: CachedStatus = {
            timestamp: Date.now(),
            connected: true,
            viaConnected: Boolean(via),
            viaProtocol,
            firmwareRelease: lcd.release || 0x0104,
            firmwareVersion: formatRelease(lcd.release || 0x0104),
            deviceName: lcd.product || cachedProductName,
            rawConfig: Array.from(cfg),
            config: parsed,
          };
          cachedStatus = nextCached;
          return { bridgeAvailable: true, ...nextCached };
        } finally {
          closeHidDevice(dev);
        }
      });

      res.json(result);
    } catch (err: any) {
      cachedLcdPath = null;
      cachedStatus = null;
      res.json({
        bridgeAvailable: true,
        connected: false,
        viaConnected: false,
        viaProtocol: 9,
        firmwareVersion: 'Error',
        deviceName: 'Zuoya GMK87',
        error: err?.message || 'HID status read failed',
      });
    }
  });

  app.post('/api/hid/config', async (req: Request, res: Response) => {
    try {
      const patch = req.body || {};
      const result = await withHidLock(async () => {
        const { lcd } = discoverGmk87Interfaces();
        if (!lcd?.path) {
          throw new Error('GMK87 LCD interface (0xFF1C) not found in USB mode');
        }
        const dev = await openHidPath(lcd.path);
        try {
          // Always read current hardware config before patching so uncommitted keyboard edits stay intact
          const base = await readLcdConfig(dev, lcd.release || 0x0104);
          const updatedCfg = patchConfigBuffer(base, patch);
          const packetHex = await writeLcdConfig(dev, updatedCfg);
          const parsed = parseConfigStruct(updatedCfg);
          if (cachedStatus) {
            cachedStatus = {
              ...cachedStatus,
              timestamp: Date.now(),
              rawConfig: Array.from(updatedCfg),
              config: parsed,
            };
          }
          return { success: true, packetHex, config: parsed, rawConfig: Array.from(updatedCfg) };
        } finally {
          closeHidDevice(dev);
        }
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Config update failed' });
    }
  });

  app.get('/api/hid/upload-progress', (_req: Request, res: Response) => {
    res.json(uploadProgress);
  });

  app.post('/api/hid/upload', async (req: Request, res: Response) => {
    req.setTimeout(0);
    res.setTimeout(0);
    try {
      const targetSlot: 0 | 1 = req.body?.targetSlot === 1 ? 1 : 0;
      const framesBase64: string[] = Array.isArray(req.body?.framesBase64)
        ? req.body.framesBase64
        : [];
      const cfgPatch = req.body?.config || {};
      const requestedDuration = Math.max(60, Number(req.body?.frameDurationMs ?? 100));

      if (framesBase64.length === 0) {
        return res.status(400).json({ success: false, error: 'No RGB565 frames provided' });
      }
      if (framesBase64.length > MAX_TOTAL_FRAMES) {
        return res.status(400).json({
          success: false,
          error: `Too many frames (${framesBase64.length}); max is ${MAX_TOTAL_FRAMES}`,
        });
      }

      const rawTargetBuffers = framesBase64.map((b64) => {
        const raw = Buffer.from(b64, 'base64');
        const padded = Buffer.alloc(PADDED_FRAME_BYTES, 0x00);
        raw.copy(padded, 0, 0, Math.min(raw.length, PADDED_FRAME_BYTES));
        return padded;
      });

      let targetBuffers = rawTargetBuffers;
      let uploadList: Buffer[];
      let slot0Count: number;
      let slot1Count: number;

      if (targetSlot === 0) {
        cachedSlotFrames[0] = targetBuffers;
        const slot1Suffix = cachedSlotFrames[1] || [Buffer.alloc(PADDED_FRAME_BYTES, 0x00)];
        const maxS1 = Math.max(0, MAX_TOTAL_FRAMES - targetBuffers.length);
        const usableS1 = slot1Suffix.slice(0, maxS1);
        if (usableS1.length > 0) {
          cachedSlotFrames[1] = usableS1;
        }
        uploadList = [...targetBuffers, ...usableS1];
        slot0Count = targetBuffers.length;
        slot1Count = Math.max(1, usableS1.length);
      } else {
        targetBuffers = rawTargetBuffers.slice(0, MAX_TOTAL_FRAMES - 1);
        cachedSlotFrames[1] = targetBuffers;
        const slot0Prefix = cachedSlotFrames[0] || [Buffer.alloc(PADDED_FRAME_BYTES, 0x00)];
        const maxS0 = Math.max(1, MAX_TOTAL_FRAMES - targetBuffers.length);
        const usableS0 = slot0Prefix.slice(0, maxS0);
        cachedSlotFrames[0] = usableS0;
        uploadList = [...usableS0, ...targetBuffers];
        slot0Count = usableS0.length;
        slot1Count = targetBuffers.length;
      }

      const fullBuffer = Buffer.concat(uploadList);
      const totalBytes = fullBuffer.length;
      const totalFrames = uploadList.length;

      uploadProgress = {
        phase: 'config',
        bytesSent: 0,
        totalBytes,
        currentFrame: 1,
        totalFrames,
        lastPacketHex: '04 ... 06',
        message: 'Step 1/4: Writing EEPROM config to GMK87...',
      };

      const result = await withHidLock(async () => {
        const { lcd } = discoverGmk87Interfaces();
        if (!lcd?.path) {
          throw new Error('GMK87 LCD interface (0xFF1C) not found in USB mode');
        }
        const dev = await openHidPath(lcd.path);
        try {
          const base = await readLcdConfig(dev, lcd.release || 0x0104);
          const nextCfg = patchConfigBuffer(base, {
            ...cfgPatch,
            activeScreenMode: targetSlot === 0 ? 1 : 2,
            slot0FrameCount: slot0Count,
            slot1FrameCount: slot1Count,
            frameDurationMs: requestedDuration,
            clockTimestampMs: Date.now(),
          });

          const cfgHex = await writeLcdConfig(dev, nextCfg);

          const pkt23 = buildLcdPacketBuffer(0x23, Buffer.alloc(0), 0);
          uploadProgress = {
            phase: 'ready',
            bytesSent: 0,
            totalBytes,
            currentFrame: 1,
            totalFrames,
            lastPacketHex: cfgHex,
            message: `Step 2/4: Erasing LCD SPI flash for ${totalFrames} frame(s) (0x23)...`,
          };

          // 0x23 triggers synchronous SPI NOR flash erase on MCU (~0.45s per 64KB block); wait for IN ACK
          const readyAck = await sendWithPosition(dev, 0x23, Buffer.alloc(0), 0, 30000);
          if (!readyAck) {
            throw new Error('GMK87 timed out waiting for 0x23 flash-erase ACK before streaming');
          }

          let pos = 0;
          let chunkCount = 0;
          let lastHex = formatHex(pkt23, 14);

          while (pos < totalBytes) {
            const size = Math.min(56, totalBytes - pos);
            const chunk = fullBuffer.subarray(pos, pos + size);
            const pkt21 = buildLcdPacketBuffer(0x21, chunk, pos);

            // Wait for each 0x21 packet's exact IN echo so SPI flash writes never drop trailing sectors
            const ack21 = await sendWithPosition(dev, 0x21, chunk, pos, 8000, true);
            if (!ack21) {
              throw new Error(`GMK87 timed out waiting for 0x21 frame chunk ACK at offset ${pos}`);
            }

            pos += size;
            chunkCount++;

            if (chunkCount === 1 || chunkCount % 16 === 0 || pos >= totalBytes) {
              const curFrame = Math.min(totalFrames, Math.floor((pos - 1) / PADDED_FRAME_BYTES) + 1);
              lastHex = formatHex(pkt21, 14);
              uploadProgress = {
                phase: 'streaming',
                bytesSent: pos,
                totalBytes,
                currentFrame: curFrame,
                totalFrames,
                lastPacketHex: lastHex,
                message: `Step 3/4: Streaming RGB565 frame ${curFrame}/${totalFrames} (ACK verified)`,
              };
              // Yield to Node/libuv I/O so /api/hid/upload-progress & UI polling never starve
              await new Promise<void>((resolve) => setImmediate(resolve));
            }
          }

          const pkt02 = buildLcdPacketBuffer(0x02, Buffer.alloc(0), 0);
          uploadProgress = {
            phase: 'commit',
            bytesSent: totalBytes,
            totalBytes,
            currentFrame: totalFrames,
            totalFrames,
            lastPacketHex: lastHex,
            message: 'Step 4/4: Finalizing SPI flash commit (0x02)...',
          };

          const commitAck = await sendWithPosition(dev, 0x02, Buffer.alloc(0), 0, 8000);
          if (!commitAck) {
            throw new Error('GMK87 did not acknowledge final COMMIT (0x02) after streaming');
          }
          await delay(100);

          // Re-stamp hardware RTC after the multi-second flash transfer so the clock has zero upload lag
          const postCfg = patchConfigBuffer(nextCfg, { clockTimestampMs: Date.now() });
          await writeLcdConfig(dev, postCfg);

          const parsed = parseConfigStruct(postCfg);
          if (cachedStatus) {
            cachedStatus = {
              ...cachedStatus,
              timestamp: Date.now(),
              rawConfig: Array.from(postCfg),
              config: parsed,
            };
          }

          const commitHex = formatHex(pkt02, 16);
          uploadProgress = {
            phase: 'complete',
            bytesSent: totalBytes,
            totalBytes,
            currentFrame: totalFrames,
            totalFrames,
            lastPacketHex: commitHex,
            message: `Flashed ${targetBuffers.length} frame(s) to Slot ${targetSlot} via USB Bridge`,
          };

          return {
            success: true,
            uploadedBytes: totalBytes,
            frames: targetBuffers.length,
            lastPacketHex: commitHex,
            config: parsed,
          };
        } catch (innerErr: any) {
          uploadProgress = {
            ...uploadProgress,
            phase: 'error',
            lastPacketHex: 'ERR',
            message: innerErr?.message || 'USB upload error',
          };
          throw innerErr;
        } finally {
          closeHidDevice(dev);
        }
      });

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'USB upload failed' });
    }
  });

  app.get('/api/hid/keymap', async (_req: Request, res: Response) => {
    try {
      const result = await withHidLock(async () => {
        const { via } = discoverGmk87Interfaces();
        if (!via?.path) {
          throw new Error('GMK87 VIA interface (0xFF60) not found in USB mode');
        }
        const dev = await openHidPath(via.path);
        try {
          // 1. Read VIA protocol version
          let viaProtocol = 9;
          const verReq = Buffer.alloc(33, 0);
          verReq[0] = 0x00;
          verReq[1] = 0x01;
          await safeWrite(dev, verReq);
          const verResp = dev.readTimeout(500);
          if (verResp && verResp.length >= 3 && verResp[0] === 0x01) {
            viaProtocol = (verResp[1] << 8) | verResp[2] || 9;
          }

          // 2. Read 960 bytes (4 * 8 * 15 * 2) in 28-byte chunks
          const LAYERS = 4;
          const ROWS = 8;
          const COLS = 15;
          const TOTAL = LAYERS * ROWS * COLS * 2;
          const CHUNK = 28;
          const raw = Buffer.alloc(TOTAL, 0);

          for (let offset = 0; offset < TOTAL; offset += CHUNK) {
            const size = Math.min(CHUNK, TOTAL - offset);
            const req = Buffer.alloc(33, 0);
            req[0] = 0x00;
            req[1] = 0x12;
            req[2] = (offset >> 8) & 0xff;
            req[3] = offset & 0xff;
            req[4] = size;

            await safeWrite(dev, req);
            const resp = dev.readTimeout(1000);
            if (!resp || resp[0] !== 0x12) {
              throw new Error(`Failed reading keymap chunk at offset ${offset}`);
            }
            Buffer.from(resp).copy(raw, offset, 4, 4 + size);
          }

          const keymap: number[][][] = [];
          for (let l = 0; l < LAYERS; l++) {
            const layer: number[][] = [];
            for (let r = 0; r < ROWS; r++) {
              const row: number[] = [];
              for (let c = 0; c < COLS; c++) {
                const idx = (l * ROWS * COLS + r * COLS + c) * 2;
                row.push((raw[idx] << 8) | raw[idx + 1]);
              }
              layer.push(row);
            }
            keymap.push(layer);
          }

          return {
            success: true,
            viaProtocol,
            layers: LAYERS,
            rows: ROWS,
            cols: COLS,
            keymap,
          };
        } finally {
          closeHidDevice(dev);
        }
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'VIA read failed' });
    }
  });

  app.post('/api/hid/keymap/set', async (req: Request, res: Response) => {
    try {
      const layer = Number(req.body?.layer ?? 0) & 0x03;
      const row = Number(req.body?.row ?? 0) & 0x07;
      const col = Number(req.body?.col ?? 0) & 0x0f;
      const keycode = Number(req.body?.keycode ?? 0) & 0xffff;

      const result = await withHidLock(async () => {
        const { via } = discoverGmk87Interfaces();
        if (!via?.path) {
          throw new Error('GMK87 VIA interface (0xFF60) not found in USB mode');
        }
        const dev = await openHidPath(via.path);
        try {
          const packet = Buffer.alloc(33, 0);
          packet[0] = 0x00;
          packet[1] = 0x05;
          packet[2] = layer;
          packet[3] = row;
          packet[4] = col;
          packet[5] = (keycode >> 8) & 0xff;
          packet[6] = keycode & 0xff;

          await safeWrite(dev, packet);
          const resp = dev.readTimeout(1000);
          if (!resp || resp[0] !== 0x05) {
            throw new Error(`VIA setKeycode failed at [${layer},${row},${col}]`);
          }
          return {
            success: true,
            layer,
            row,
            col,
            keycode,
            packetHex: formatHex(packet.subarray(1), 8),
          };
        } finally {
          closeHidDevice(dev);
        }
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'VIA write failed' });
    }
  });

  // --------------------------------------------------------------------------
  // Live Telemetry, Web GIF Search & CORS-free GIF Proxy APIs
  // --------------------------------------------------------------------------
  app.get('/api/system-telemetry', (_req: Request, res: Response) => {
    const sys = getSystemMetricsSnapshot();
    res.json({
      ...sys,
      media: cachedMedia,
    });
  });

  app.get('/api/gifs/search', async (req: Request, res: Response) => {
    try {
      const q = String(req.query.q || 'cyberpunk neon').slice(0, 80);
      const page = Math.max(0, Math.min(20, parseInt(String(req.query.page || '0'), 10) || 0));
      const gifs = await searchWebGifs(q, page);
      res.json({ query: q, page, count: gifs.length, gifs });
    } catch (err: any) {
      res.status(502).json({
        query: req.query.q || '',
        page: 0,
        count: 0,
        gifs: [],
        error: err?.message || 'Web GIF search failed',
      });
    }
  });

  app.get('/api/proxy-gif', async (req: Request, res: Response) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      return res.status(400).send('Missing url query parameter');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      return res.status(400).send('Invalid URL');
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(403).send('Unsupported URL protocol');
    }
    if (isDisallowedProxyHost(parsedUrl.hostname)) {
      return res.status(403).send('Target host not allowed');
    }

    try {
      const upstream = await fetchUpstreamBuffer(parsedUrl.toString(), {
        timeoutMs: 28000,
        maxRedirects: 4,
        maxBytes: 20 * 1024 * 1024,
        validateHost: true,
        headers: {
          'User-Agent': DEFAULT_BROWSER_UA,
          Accept: 'image/gif,image/webp,image/png,image/jpeg,*/*',
          Referer: `${parsedUrl.origin}/`,
        },
      });

      if (upstream.status < 200 || upstream.status >= 300) {
        return res.status(upstream.status || 502).send(`Upstream returned HTTP ${upstream.status}`);
      }

      const contentType = upstream.headers['content-type'] || 'image/gif';
      const magic = upstream.body.subarray(0, 12).toString('ascii');
      const hasImageSignature =
        magic.startsWith('GIF87a') ||
        magic.startsWith('GIF89a') ||
        (upstream.body.length >= 4 && upstream.body[0] === 0x89 && upstream.body[1] === 0x50) ||
        (upstream.body.length >= 3 && upstream.body[0] === 0xff && upstream.body[1] === 0xd8) ||
        (magic.startsWith('RIFF') && magic.slice(8, 12) === 'WEBP');

      if (!contentType.toLowerCase().startsWith('image/') && !hasImageSignature) {
        return res.status(502).send(`Upstream did not return an image (${contentType})`);
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.send(upstream.body);
    } catch (err: any) {
      const msg = err?.message || 'Unknown error';
      const status = msg.includes('Target host') || msg.includes('Unsupported URL')
        ? 403
        : msg.includes('exceeds')
          ? 413
          : 502;
      res.status(status).send(`Failed to proxy image: ${msg}`);
    }
  });

  // --------------------------------------------------------------------------
  // Frontend Serving (Vite Dev Middleware or Production Dist)
  // --------------------------------------------------------------------------
  if (isProd) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const explicitHost = options.host || DEFAULT_NETWORK_CONFIG.host;
  const server = await new Promise<Server>((resolve, reject) => {
    const instance = explicitHost
      ? app.listen(listenPort, explicitHost, () => resolve(instance))
      : app.listen(listenPort, () => resolve(instance));
    instance.once('error', (err) => reject(err));
  });
  server.requestTimeout = 0;

  const addr = server.address();
  const actualPort = typeof addr === 'object' && addr ? addr.port : listenPort;
  const boundAddress =
    typeof addr === 'object' && addr ? `${addr.address} (${addr.family})` : String(addr || '');

  sampleCpuPercent();
  pollWindowsMedia(mediaScriptPath);
  const mediaTimer = setInterval(() => pollWindowsMedia(mediaScriptPath), 4000);
  mediaTimer.unref();

  // Pre-warm default Web GIF search cache & HTTP/2 session in background unless disabled by tests
  let warmTimer: ReturnType<typeof setTimeout> | null = null;
  if (process.env.GMK87_NO_GIF_PREWARM !== '1') {
    warmTimer = setTimeout(() => {
      searchWebGifs('cyberpunk neon', 0).catch(() => {});
    }, 350);
    warmTimer.unref();
  }

  console.log('');
  console.log('=====================================================');
  console.log('   GMK87 MASTER CONTROL CENTER (HYBRID USB + WEB)');
  console.log('=====================================================');
  console.log(`> Web Studio UI : http://localhost:${actualPort}  [${boundAddress}]`);
  console.log(`> Mode          : ${isProd ? 'Production (dist/)' : 'Vite Dev HMR'}`);
  const { lcd, via } = discoverGmk87Interfaces();
  console.log(
    `> USB Hardware  : ${lcd || via ? `DETECTED (${cachedProductName})` : 'Standby / Not Plugged'}`
  );
  console.log('=====================================================');
  console.log('');

  return {
    server,
    port: actualPort,
    syncClock: syncHardwareClockNow,
    getHardwareSummary: () => {
      const ifaces = discoverGmk87Interfaces();
      return {
        detected: Boolean(ifaces.lcd || ifaces.via),
        deviceName: cachedProductName,
        viaConnected: Boolean(ifaces.via),
      };
    },
    stop: async () => {
      if (warmTimer) clearTimeout(warmTimer);
      clearInterval(mediaTimer);
      cleanupUpstreamPools();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}

const isDirectCliRun =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  Boolean(process.argv[1]) &&
  /local-server\.(ts|js|mjs|cjs)$/i.test(process.argv[1]);

if (isDirectCliRun && process.env.GMK87_NO_AUTOSTART !== '1') {
  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}
