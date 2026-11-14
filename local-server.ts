/// <reference types="node" />
import express, { type Request, type Response } from 'express';
import http from 'node:http';
import https from 'node:https';
import http2 from 'node:http2';
import type { Server } from 'node:http';
import { lookup as dnsLookup } from 'node:dns';
import zlib from 'node:zlib';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { Worker } from 'node:worker_threads';
import {
  Gmk87HidDriver,
  type HardwareStatusSnapshot,
  type HardwareSummary,
  type UploadProgressState,
  type ViaBatchEntry,
} from './electron/hid-driver';

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
  dataDir?: string;
}

export interface ServerHandle {
  server: Server;
  port: number;
  syncClock: () => Promise<{ success: boolean; time?: string; error?: string }>;
  getHardwareSummary: () => HardwareSummary;
  probeHardwareSummary: () => Promise<HardwareSummary>;
  stop: () => Promise<void>;
}

const DEFAULT_NETWORK_CONFIG = resolveCliAndEnvNetworkConfig();
const PORT = DEFAULT_NETWORK_CONFIG.port;

// ============================================================================
// Persistent HID Worker Client (Runs node-hid Off Main Event Loop)
// ============================================================================
class HidWorkerClient {
  private worker: Worker | null = null;
  private fallbackDriver: Gmk87HidDriver | null = null;
  private reqCounter = 1;
  private pending = new Map<
    number,
    { resolve: (val: any) => void; reject: (err: Error) => void }
  >();
  private progress: UploadProgressState = {
    phase: 'idle',
    bytesSent: 0,
    totalBytes: 65536,
    currentFrame: 0,
    totalFrames: 1,
    lastPacketHex: '04 28 00 01 00 00 00 00',
    message: 'Idle',
  };
  private lastSummary: HardwareSummary = {
    detected: false,
    lcdDetected: false,
    viaDetected: false,
    deviceName: 'Zuoya GMK87',
    viaConnected: false,
    firmwareVersion: 'Offline',
  };
  private closed = false;

  constructor(private readonly baseDir: string, private readonly dataDir?: string) {
    this.initWorker();
  }

  private resolveBuiltWorkerPath(): string | null {
    const candidates = [
      path.join(this.baseDir, 'hid-worker.cjs'),
      path.join(this.baseDir, 'dist-electron', 'hid-worker.cjs'),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  private initWorker(): void {
    const builtWorker = this.resolveBuiltWorkerPath();
    if (builtWorker) {
      try {
        const w = new Worker(builtWorker, {
          workerData: { dataDir: this.dataDir },
        });
        w.on('message', (msg: any) => {
          if (msg?.type === 'progress' && msg.data) {
            this.progress = msg.data;
            return;
          }
          if (typeof msg?.id === 'number') {
            const entry = this.pending.get(msg.id);
            if (!entry) return;
            this.pending.delete(msg.id);
            if (msg.ok) entry.resolve(msg.result);
            else entry.reject(new Error(msg.error || 'HID worker error'));
          }
        });
        w.on('error', (err) => {
          for (const entry of this.pending.values()) {
            entry.reject(err);
          }
          this.pending.clear();
          this.worker = null;
        });
        w.on('exit', () => {
          for (const entry of this.pending.values()) {
            entry.reject(new Error('HID worker exited unexpectedly'));
          }
          this.pending.clear();
          this.worker = null;
        });
        this.worker = w;
        return;
      } catch {
        this.worker = null;
      }
    }

    // Fallback for unbuilt `tsx` dev mode: reuse Gmk87HidDriver cleanly in-process
    this.fallbackDriver = new Gmk87HidDriver(this.dataDir, (p) => {
      this.progress = p;
    });
  }

  public isUsingWorkerThread(): boolean {
    return Boolean(this.worker);
  }

  public getCachedSummary(): HardwareSummary {
    return { ...this.lastSummary };
  }

  public getUploadProgress(): UploadProgressState {
    if (this.fallbackDriver) {
      return this.fallbackDriver.getUploadProgress();
    }
    return { ...this.progress };
  }

  private callWorker<T>(method: string, args: any[] = []): Promise<T> {
    if (this.closed) {
      return Promise.reject(new Error('HID worker stopped'));
    }
    if (this.worker) {
      return new Promise<T>((resolve, reject) => {
        const id = this.reqCounter++;
        this.pending.set(id, { resolve, reject });
        this.worker!.postMessage({ id, method, args });
      });
    }
    if (!this.fallbackDriver) {
      this.fallbackDriver = new Gmk87HidDriver(this.dataDir, (p) => {
        this.progress = p;
      });
    }
    const d = this.fallbackDriver as any;
    return Promise.resolve(d[method](...args));
  }

  public async checkAttached(): Promise<HardwareSummary> {
    const res = await this.callWorker<HardwareSummary>('checkAttached');
    this.lastSummary = res;
    return res;
  }

  public async getStatus(forceRefresh = false, lightOnly = false): Promise<HardwareStatusSnapshot> {
    const snap = await this.callWorker<HardwareStatusSnapshot>('getStatus', [
      forceRefresh,
      lightOnly,
    ]);
    this.lastSummary = {
      detected: Boolean(snap.connected || snap.viaConnected),
      lcdDetected: Boolean(snap.connected),
      viaDetected: Boolean(snap.viaConnected),
      deviceName: snap.deviceName || this.lastSummary.deviceName,
      viaConnected: Boolean(snap.viaConnected),
      firmwareVersion: snap.firmwareVersion || this.lastSummary.firmwareVersion,
    };
    return snap;
  }

  public writeConfigPatch(patch: Record<string, any>, forceFreshRead = false) {
    return this.callWorker<any>('writeConfigPatch', [patch, forceFreshRead]);
  }

  public syncClockNow() {
    return this.callWorker<{ success: boolean; time?: string; error?: string }>('syncClockNow');
  }

  public uploadFrames(params: {
    targetSlot: 0 | 1;
    framesBase64: string[];
    configPatch?: Record<string, any>;
    frameDurationMs?: number;
  }) {
    return this.callWorker<any>('uploadFrames', [params]);
  }

  public readViaKeymap() {
    return this.callWorker<any>('readViaKeymap');
  }

  public setViaKeycode(layer: number, row: number, col: number, keycode: number) {
    return this.callWorker<any>('setViaKeycode', [layer, row, col, keycode]);
  }

  public batchSetViaKeycodes(entries: ViaBatchEntry[]) {
    return this.callWorker<any>('batchSetViaKeycodes', [entries]);
  }

  public readViaMacros() {
    return this.callWorker<any>('readViaMacros');
  }

  public writeViaMacros(macros: string[]) {
    return this.callWorker<any>('writeViaMacros', [macros]);
  }

  public async stop(): Promise<void> {
    if (this.closed) return;
    if (this.worker) {
      const w = this.worker;
      try {
        await Promise.race([
          this.callWorker('shutdown'),
          new Promise((r) => setTimeout(r, 400)),
        ]);
      } catch {
        // ignore shutdown rpc error
      }
      this.closed = true;
      this.worker = null;
      await w.terminate().catch(() => {});
      return;
    }
    this.closed = true;
    this.fallbackDriver?.shutdown();
    this.fallbackDriver = null;
  }
}

// ============================================================================
// System CPU Delta + Demand-Gated Windows Media Session Telemetry
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
let lastMediaPollAt = 0;

function maybeRefreshWindowsMediaOnDemand(scriptPath: string): void {
  if (isMediaPolling || process.platform !== 'win32') return;
  if (Date.now() - lastMediaPollAt < 4000) return;
  lastMediaPollAt = Date.now();
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
      timeoutMs: 8000,
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
    timeoutMs: 8000,
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
    timeoutMs: 8000,
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
    timeoutMs: 8000,
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
export async function startServer(options: StartServerOptions = {}): Promise<ServerHandle> {
  const baseDir = resolveBaseDir();
  const listenPort = options.port ?? PORT;
  const isProd = options.isProd ?? process.env.NODE_ENV === 'production';
  const distDir = options.distDir || path.resolve(baseDir, 'dist');
  const mediaScriptPath = options.mediaScriptPath || path.resolve(baseDir, 'get_media.ps1');

  const worker = new HidWorkerClient(baseDir, options.dataDir);
  const initialHardware = await worker.checkAttached().catch(() => worker.getCachedSummary());

  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    next();
  });

  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const summary = await worker.checkAttached();
      res.json({
        ok: true,
        app: 'gmk87-master-control-center',
        pid: process.pid,
        port: listenPort,
        workerThread: worker.isUsingWorkerThread(),
        hardwareDetected: summary.detected,
        lcdDetected: summary.lcdDetected,
        viaDetected: summary.viaDetected,
        deviceName: summary.deviceName,
        firmwareVersion: summary.firmwareVersion,
      });
    } catch {
      const summary = worker.getCachedSummary();
      res.json({
        ok: true,
        app: 'gmk87-master-control-center',
        pid: process.pid,
        port: listenPort,
        workerThread: worker.isUsingWorkerThread(),
        hardwareDetected: summary.detected,
        lcdDetected: summary.lcdDetected,
        viaDetected: summary.viaDetected,
        deviceName: summary.deviceName,
        firmwareVersion: summary.firmwareVersion,
      });
    }
  });

  // --------------------------------------------------------------------------
  // Hardware USB HID API Routes (Routed through Dedicated HID Worker Thread)
  // --------------------------------------------------------------------------
  app.get('/api/hid/status', async (req: Request, res: Response) => {
    const forceRefresh = req.query.refresh === '1';
    const lightOnly = req.query.light === '1';
    try {
      const snap = await worker.getStatus(forceRefresh, lightOnly);
      res.json({ bridgeAvailable: true, ...snap });
    } catch (err: any) {
      res.json({
        bridgeAvailable: true,
        connected: false,
        viaConnected: false,
        viaProtocol: 9,
        firmwareRelease: 0,
        firmwareVersion: 'Error',
        deviceName: 'Zuoya GMK87',
        slotCache: { slot0Frames: 0, slot1Frames: 0 },
        error: err?.message || 'HID status read failed',
      });
    }
  });

  app.post('/api/hid/config', async (req: Request, res: Response) => {
    try {
      const patch = req.body || {};
      const result = await worker.writeConfigPatch(patch, false);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'Config update failed' });
    }
  });

  app.get('/api/hid/upload-progress', (_req: Request, res: Response) => {
    res.json(worker.getUploadProgress());
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
      if (framesBase64.length > 36) {
        return res.status(400).json({
          success: false,
          error: `Too many frames (${framesBase64.length}); max is 36`,
        });
      }

      const result = await worker.uploadFrames({
        targetSlot,
        framesBase64,
        configPatch: cfgPatch,
        frameDurationMs: requestedDuration,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'USB upload failed' });
    }
  });

  app.get('/api/hid/keymap', async (_req: Request, res: Response) => {
    try {
      const result = await worker.readViaKeymap();
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

      const result = await worker.setViaKeycode(layer, row, col, keycode);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'VIA write failed' });
    }
  });

  app.post('/api/hid/keymap/batch', async (req: Request, res: Response) => {
    try {
      const entries = Array.isArray(req.body?.entries) ? req.body.entries : [];
      const result = await worker.batchSetViaKeycodes(entries);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'VIA batch write failed' });
    }
  });

  app.get('/api/hid/macros', async (_req: Request, res: Response) => {
    try {
      const result = await worker.readViaMacros();
      res.json(result);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        supported: false,
        count: 0,
        bufferSize: 0,
        macros: [],
        error: err?.message || 'VIA macro read failed',
      });
    }
  });

  app.post('/api/hid/macros/set', async (req: Request, res: Response) => {
    try {
      const macros = Array.isArray(req.body?.macros) ? req.body.macros : [];
      const result = await worker.writeViaMacros(macros);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ success: false, error: err?.message || 'VIA macro write failed' });
    }
  });

  // --------------------------------------------------------------------------
  // Demand-Gated System Telemetry, Web GIF Search & CORS-free GIF Proxy APIs
  // --------------------------------------------------------------------------
  app.get('/api/system-telemetry', (_req: Request, res: Response) => {
    maybeRefreshWindowsMediaOnDemand(mediaScriptPath);
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
  console.log(
    `> HID Engine    : ${worker.isUsingWorkerThread() ? 'Dedicated Worker Thread' : 'Direct In-Process'} (Persistent Handles)`
  );
  console.log(
    `> USB Hardware  : ${initialHardware.detected ? `DETECTED (${initialHardware.deviceName} ${initialHardware.firmwareVersion})` : 'Standby / Not Plugged'}`
  );
  console.log('=====================================================');
  console.log('');

  return {
    server,
    port: actualPort,
    syncClock: () => worker.syncClockNow(),
    getHardwareSummary: () => worker.getCachedSummary(),
    probeHardwareSummary: () => worker.checkAttached(),
    stop: async () => {
      if (warmTimer) clearTimeout(warmTimer);
      cleanupUpstreamPools();
      await worker.stop();
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
  process.on('uncaughtException', (err) => {
    console.warn('[GMK87 Server] Recovered from uncaught exception:', err?.message || err);
  });
  process.on('unhandledRejection', (reason: any) => {
    console.warn('[GMK87 Server] Recovered from unhandled rejection:', reason?.message || reason);
  });

  startServer().catch((err) => {
    console.error('Fatal server startup error:', err);
    process.exit(1);
  });
}

