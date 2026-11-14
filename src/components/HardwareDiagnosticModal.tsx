import React, { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  XCircle,
  Play,
  Copy,
  Check,
  X,
  Usb,
  Clock,
  Palette,
  Keyboard,
  Film,
  Database,
  RefreshCw,
} from 'lucide-react';
import {
  Gmk87HidEngine,
  Gmk87ConfigState,
  LCD_WIDTH,
  LCD_HEIGHT,
  formatPacketHex,
} from '../services/gmk87Hid';

export interface DiagnosticStepResult {
  id: 'transport' | 'eeprom_read' | 'rtc_clock' | 'rgb_write' | 'via_read' | 'lcd_flash';
  title: string;
  commandLabel: string;
  status: 'idle' | 'running' | 'pass' | 'fail';
  durationMs?: number;
  summary: string;
  packetHex?: string;
  details?: string;
}

interface HardwareDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  hidEngine: Gmk87HidEngine | null;
  configState: Gmk87ConfigState;
  rawHardwareConfig: Uint8Array;
  onSyncConfigState: (next: Gmk87ConfigState, raw: Uint8Array) => void;
  onSyncKeymap?: (nextKeymap: number[][][]) => void;
  onStatusLog: (msg: string) => void;
}

const INITIAL_STEPS: DiagnosticStepResult[] = [
  {
    id: 'transport',
    title: '1. USB Bridge / WebHID Interface Check',
    commandLabel: '0x320F:0x5055 (0xFF1C + 0xFF60)',
    status: 'idle',
    summary: 'Verifies physical USB connection via Local Windows Bridge (127.0.0.1:3887) or Browser WebHID.',
  },
  {
    id: 'eeprom_read',
    title: '2. EEPROM Config Read & Decode',
    commandLabel: '0x01 -> 0x05 (48B ClassA+ClassB)',
    status: 'idle',
    summary: 'Reads 48/64-byte config block and decodes brightness (0..4), RGB mode, logo bar, and screen slots.',
  },
  {
    id: 'rtc_clock',
    title: '3. Hardware RTC Clock Write & Enable',
    commandLabel: '0x01 -> 0x06 (cfg[21]=1, BCD[35..41]) -> 0x02',
    status: 'idle',
    summary: 'Writes current PC time to BCD registers, sets ClassA clock enable flag (cfg[21]=1), and switches to Clock Mode.',
  },
  {
    id: 'rgb_write',
    title: '4. RGB Underglow & Logo Bar Write',
    commandLabel: '0x01 -> 0x06 (cfg[1..8, 28..32]) -> 0x02',
    status: 'idle',
    summary: 'Tests writing current RGB mode, brightness (0..4), and logo bar state to hardware.',
  },
  {
    id: 'via_read',
    title: '5. VIA 4-Layer Keymap Buffer Read',
    commandLabel: 'VIA 0x01 + 0x12 (960B)',
    status: 'idle',
    summary: 'Reads all 35 chunks (960 bytes) of the 4×8×15 VIA keymap matrix on interface 0xFF60.',
  },
  {
    id: 'lcd_flash',
    title: '6. 1-Frame 240×135 Neo-Tokyo Clock HUD Flash',
    commandLabel: '0x06 -> 0x23 (Erase) -> 0x21 (65,536B) -> 0x02',
    status: 'idle',
    summary: 'Flashes a high-contrast 240×135 RGB565 Custom Digital Clock & Telemetry HUD to Slot 0 (~18s).',
  },
];

export function createLiveClockHudFrame(now: Date = new Date(), cfg?: Gmk87ConfigState): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Deep obsidian cyber background
  ctx.fillStyle = '#050811';
  ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

  // Subtle top/bottom tactical framing
  ctx.strokeStyle = '#06b6d4';
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, LCD_WIDTH - 4, LCD_HEIGHT - 4);

  // Top telemetry header bar
  ctx.fillStyle = '#0b1528';
  ctx.fillRect(4, 4, LCD_WIDTH - 8, 20);
  ctx.fillStyle = '#06b6d4';
  ctx.fillRect(4, 23, LCD_WIDTH - 8, 1);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('GMK87 PRO', 10, 17);

  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const dateStr = `${days[now.getDay()]} · ${months[now.getMonth()]} ${String(now.getDate()).padStart(2, '0')}`;
  ctx.fillStyle = '#22d3ee';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(dateStr, 134, 17);

  // Giant High-Contrast Digital Clock (HH:MM) + Seconds (:SS)
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px monospace';
  ctx.fillText(`${hh}:${mm}`, 14, 78);

  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 20px monospace';
  ctx.fillText(`:${ss}`, 176, 56);

  ctx.fillStyle = '#10b981';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('SYNCED', 180, 76);

  // Divider bar with RGB color indicator pills
  const barColors = ['#ef4444', '#facc15', '#10b981', '#06b6d4', '#8b5cf6'];
  const segW = Math.floor((LCD_WIDTH - 24) / barColors.length);
  barColors.forEach((c, idx) => {
    ctx.fillStyle = c;
    ctx.fillRect(12 + idx * segW, 90, segW - 3, 4);
  });

  // Bottom Hardware Telemetry Footer
  ctx.fillStyle = '#0b1528';
  ctx.fillRect(4, 102, LCD_WIDTH - 8, 29);

  const brt = cfg ? `${cfg.brightness}/4` : '4/4';
  const modeId = cfg ? `M${cfg.lightingEffect}` : 'M1';
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 11px monospace';
  ctx.fillText(`RGB:${modeId} BRT:${brt}`, 10, 120);

  ctx.fillStyle = '#10b981';
  ctx.fillRect(138, 108, 92, 17);
  ctx.fillStyle = '#041019';
  ctx.font = 'bold 10px monospace';
  ctx.fillText('USB · VIA P9', 146, 120);

  return ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
}

export default function HardwareDiagnosticModal({
  isOpen,
  onClose,
  hidEngine,
  configState,
  rawHardwareConfig,
  onSyncConfigState,
  onSyncKeymap,
  onStatusLog,
}: HardwareDiagnosticModalProps) {
  const [steps, setSteps] = useState<DiagnosticStepResult[]>(INITIAL_STEPS);
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [isFixingClock, setIsFixingClock] = useState(false);
  const [isRepairingKeys, setIsRepairingKeys] = useState(false);
  const [isFlashingHud, setIsFlashingHud] = useState(false);
  const [hudProgressPct, setHudProgressPct] = useState<number | null>(null);
  const [hudStatusMsg, setHudStatusMsg] = useState<string>('');
  const [copiedReport, setCopiedReport] = useState(false);

  if (!isOpen) return null;

  const updateStep = (id: DiagnosticStepResult['id'], patch: Partial<DiagnosticStepResult>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const handleFixNativeClock = async () => {
    if (!hidEngine) return;
    setIsFixingClock(true);
    const t0 = performance.now();
    try {
      const res = await hidEngine.fixClockAndRestoreNativeMode(configState);
      onSyncConfigState(res.config, res.rawConfig);
      const dt = Math.round(performance.now() - t0);
      if (!res.success) {
        throw new Error(res.error || 'Could not reach GMK87 LCD interface (0xFF1C)');
      }
      const viaLabel = res.usedDirectWebHid
        ? 'Direct WebHID'
        : 'USB Bridge';
      const msg = `Native Clock Synced to ${res.config.clockDate.toLocaleTimeString()} (${viaLabel}: cfg[0]=0x01, ScreenMode=0) in ${dt}ms`;
      setHudStatusMsg(msg);
      onStatusLog(msg);
      updateStep('rtc_clock', {
        status: 'pass',
        durationMs: dt,
        summary: msg,
        packetHex: res.packetHex,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      setHudStatusMsg(`Clock fix error: ${msg}`);
      onStatusLog(`Clock fix error: ${msg}`);
    } finally {
      setIsFixingClock(false);
    }
  };

  const handleRepairMangledKeys = async () => {
    if (!hidEngine) return;
    setIsRepairingKeys(true);
    setHudStatusMsg('Repairing EEPROM (cfg[0]=0x01, cfg[9..27]=0x00) & restoring 4-layer VIA keymap...');
    const t0 = performance.now();
    try {
      const res = await hidEngine.repairKeyboardKeysAndConfig(configState);
      onSyncConfigState(res.config, res.rawConfig);
      if (onSyncKeymap) {
        onSyncKeymap(res.keymap);
      }
      const dt = Math.round(performance.now() - t0);
      const msg = `${res.message} (${dt}ms)`;
      setHudStatusMsg(msg);
      onStatusLog(msg);
      updateStep('via_read', {
        status: 'pass',
        durationMs: dt,
        summary: msg,
        packetHex: res.packetHex,
      });
    } catch (err: any) {
      const msg = err?.message || String(err);
      setHudStatusMsg(`Key repair error: ${msg}`);
      onStatusLog(`Key repair error: ${msg}`);
    } finally {
      setIsRepairingKeys(false);
    }
  };

  const handleFlashCustomClockHud = async () => {
    if (!hidEngine) return;
    setIsFlashingHud(true);
    setHudProgressPct(1);
    setHudStatusMsg('Preparing 240×135 RGB565 Neo-Tokyo Clock HUD...');
    try {
      const ok = await runSingleStep('lcd_flash', true);
      if (ok) {
        setHudStatusMsg('Custom Neo-Tokyo Digital Clock HUD flashed to Keyboard Slot 0!');
      }
    } finally {
      setIsFlashingHud(false);
      setHudProgressPct(null);
    }
  };

  const runSingleStep = async (
    id: DiagnosticStepResult['id'],
    allowInteractiveWebHid = true
  ): Promise<boolean> => {
    if (!hidEngine) return false;
    const t0 = performance.now();
    updateStep(id, { status: 'running', details: undefined });

    try {
      if (id === 'transport') {
        const isRemoteHost =
          typeof window !== 'undefined' &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1';

        if (allowInteractiveWebHid && isRemoteHost && !hidEngine.isConnected() && hidEngine.isWebHidSupported()) {
          const directWebRes = await hidEngine.connectWebHidDirect();
          if (directWebRes.connected) {
            if (directWebRes.config) {
              onSyncConfigState(directWebRes.config, hidEngine.getRawConfigBuffer());
            }
            const dt = Math.round(performance.now() - t0);
            updateStep(id, {
              status: 'pass',
              durationMs: dt,
              summary: `Connected (WEBHID): ${directWebRes.deviceName} · LCD=${
                directWebRes.lcdConnected ? 'OK' : 'NO'
              } · VIA=${directWebRes.viaConnected ? 'OK' : 'NO'}`,
              packetHex: directWebRes.message,
            });
            return true;
          }
        }

        const res = await hidEngine.checkBridgeStatus(true, false);
        const dt = Math.round(performance.now() - t0);
        if (res.connected) {
          if (res.config) {
            onSyncConfigState(res.config, hidEngine.getRawConfigBuffer());
          }
          updateStep(id, {
            status: 'pass',
            durationMs: dt,
            summary: `Connected (${res.mode.toUpperCase()}): ${res.deviceName} · LCD=${
              res.lcdConnected ? 'OK' : 'NO'
            } · VIA=${res.viaConnected ? `OK (P${res.viaProtocol})` : 'NO'}`,
            packetHex: `Endpoint: ${hidEngine.getBridgeBaseUrl()}`,
          });
          return true;
        }

        const webRes = await hidEngine.tryAutoReconnectWebHid();
        const dt2 = Math.round(performance.now() - t0);
        if (webRes?.connected || hidEngine.isConnected()) {
          updateStep(id, {
            status: 'pass',
            durationMs: dt2,
            summary: `Connected (${hidEngine.getTransportMode().toUpperCase()}): ${hidEngine.getConnectedDeviceName()}`,
          });
          return true;
        }

        const meta = hidEngine.getDiagnosticMetadata();
        const probeDetails = Object.entries(meta.bridgeProbeLog)
          .map(([k, v]) => `${k}: ${v}`)
          .join(' | ');
        const webHidNote = meta.lastWebHidError ? `WebHID: ${meta.lastWebHidError}` : '';

        updateStep(id, {
          status: 'fail',
          durationMs: dt2,
          summary: res.message || 'GMK87 not connected in wired USB mode.',
          packetHex: [webHidNote, probeDetails].filter(Boolean).join(' · '),
          details: meta.inIframe
            ? 'Browser is inside AI Studio iframe (which blocks direct USB WebHID popups unless opened in a top-level tab or connected via local port 3887). Click "Open Full Tab for USB" above or start `npm run dev` in PowerShell.'
            : 'Make sure your Zuoya GMK87 switch is set to USB mode and click "Pair USB (WebHID)" or run `npm run dev` in PowerShell (port 3887).',
        });
        return false;
      }

      if (id === 'eeprom_read') {
        let cfg: Gmk87ConfigState | undefined;
        if (hidEngine.isBridgeActive()) {
          const st = await hidEngine.checkBridgeStatus(true, false);
          if (!st.connected || !st.config) {
            throw new Error(st.message || 'Bridge EEPROM config read returned no config');
          }
          cfg = st.config;
        } else if (hidEngine.isConnected()) {
          cfg = await hidEngine.readWebHidConfig();
        } else {
          throw new Error('Keyboard not connected (run Step 1 or click Pair USB first)');
        }
        const raw = hidEngine.getRawConfigBuffer();
        onSyncConfigState(cfg, raw);
        const dt = Math.round(performance.now() - t0);
        const hexDump = formatPacketHex(raw, 48);
        updateStep(id, {
          status: 'pass',
          durationMs: dt,
          summary: `Read ${raw.length}B EEPROM · Mode=${cfg.lightingEffect}, Bright=${cfg.brightness}/4, Speed=${cfg.speed}/4, LogoMode=${cfg.logoMode ?? 0}, ScreenMode=${cfg.activeScreenMode}, Slot0=${cfg.slot0FrameCount}f, Slot1=${cfg.slot1FrameCount}f`,
          packetHex: hexDump,
        });
        return true;
      }

      if (id === 'rtc_clock') {
        const now = new Date();
        const res = await hidEngine.syncClockNow(now, true);
        const dt = Math.round(performance.now() - t0);
        if (!res.success || !res.hardwareApplied) {
          throw new Error(res.error || 'RTC Clock write was not acknowledged by hardware');
        }
        if (res.config) {
          onSyncConfigState(res.config, hidEngine.getRawConfigBuffer());
        }
        updateStep(id, {
          status: 'pass',
          durationMs: dt,
          summary: `Hardware RTC synced & enabled at ${now.toLocaleTimeString()} (${
            res.bridgeDetected ? 'USB Bridge' : 'WebHID Direct'
          })`,
          packetHex: res.packetHex,
        });
        return true;
      }

      if (id === 'rgb_write') {
        if (!hidEngine.isConnected()) {
          throw new Error('Keyboard not connected in USB mode');
        }
        const hex = await hidEngine.writeConfig(configState);
        const dt = Math.round(performance.now() - t0);
        onSyncConfigState(configState, hidEngine.getRawConfigBuffer());
        updateStep(id, {
          status: 'pass',
          durationMs: dt,
          summary: `Wrote RGB & Logo config (Effect=${configState.lightingEffect}, Brightness=${configState.brightness}/4, LogoMode=${configState.logoMode ?? 0})`,
          packetHex: hex,
        });
        return true;
      }

      if (id === 'via_read') {
        if (!hidEngine.isViaConnected()) {
          throw new Error(
            'VIA interface (0xFF60) not connected — if using WebHID, click "Pair USB (WebHID)" a second time and select the second Zuoya GMK87 entry (0xFF60)'
          );
        }
        const res = await hidEngine.readViaKeymapBuffer();
        const dt = Math.round(performance.now() - t0);
        if (!res.keymap) {
          throw new Error('VIA 0x12 buffer read returned null keymap');
        }
        updateStep(id, {
          status: 'pass',
          durationMs: dt,
          summary: `Read ${res.totalBytes}B across ${res.chunksRead} chunks (VIA Protocol V${res.viaProtocol})`,
          packetHex: res.lastCmdHex,
        });
        return true;
      }

      if (id === 'lcd_flash') {
        if (!hidEngine.isConnected()) {
          throw new Error('Keyboard LCD interface (0xFF1C) not connected');
        }
        const now = new Date();
        const frame = createLiveClockHudFrame(now, configState);
        let lastHex = '';
        const res = await hidEngine.uploadFramesToLcd(
          [frame],
          0,
          { ...configState, activeScreenMode: 1, slot0FrameCount: 1 },
          (info) => {
            lastHex = info.lastPacketHex || lastHex;
            if (info.totalBytes > 0) {
              setHudProgressPct(Math.min(99, Math.round((info.bytesSent / info.totalBytes) * 100)));
            }
            if (info.message) {
              setHudStatusMsg(info.message);
            }
          },
          false
        );
        const dt = Math.round(performance.now() - t0);
        if (!res.success) {
          throw new Error(res.error || '1-frame Clock HUD LCD upload failed');
        }
        if (res.config) {
          onSyncConfigState(res.config, hidEngine.getRawConfigBuffer());
        }
        updateStep(id, {
          status: 'pass',
          durationMs: dt,
          summary: `Flashed Custom Neo-Tokyo Clock HUD (${now.toLocaleTimeString()}) to Slot 0 in ${(
            dt / 1000
          ).toFixed(2)}s`,
          packetHex: lastHex,
        });
        return true;
      }

      return false;
    } catch (err: any) {
      const dt = Math.round(performance.now() - t0);
      const msg = err?.message || String(err);
      updateStep(id, {
        status: 'fail',
        durationMs: dt,
        summary: `FAILED: ${msg}`,
        details: msg,
      });
      onStatusLog(`Diagnostic [${id}] failed: ${msg}`);
      return false;
    }
  };

  const handleDirectWebHidPair = async () => {
    if (!hidEngine) return;
    const res = await hidEngine.connectWebHidDirect();
    if (res.connected && res.config) {
      onSyncConfigState(res.config, hidEngine.getRawConfigBuffer());
    }
    onStatusLog(res.message);
    setHudStatusMsg(res.message);
    await runSingleStep('transport', false);
  };

  const handleRunFullSuite = async (includeLcdFlash = false) => {
    setIsRunningAll(true);
    try {
      const order: DiagnosticStepResult['id'][] = [
        'transport',
        'eeprom_read',
        'rtc_clock',
        'rgb_write',
        'via_read',
      ];
      if (includeLcdFlash) {
        order.push('lcd_flash');
      }
      for (const stepId of order) {
        await runSingleStep(stepId, stepId === 'transport');
      }
    } finally {
      setIsRunningAll(false);
    }
  };

  const handleCopyReport = async () => {
    const report = {
      timestamp: new Date().toISOString(),
      transportMode: hidEngine?.getTransportMode() || 'unknown',
      bridgeEndpoint: hidEngine?.getBridgeBaseUrl() || 'same-origin',
      connectedDevice: hidEngine?.getConnectedDeviceName() || 'none',
      viaProtocol: hidEngine?.getViaProtocol() || 9,
      environment: hidEngine?.getDiagnosticMetadata() || null,
      configState: {
        lightingEffect: configState.lightingEffect,
        brightness: configState.brightness,
        speed: configState.speed,
        effectDirection: configState.effectDirection,
        rainbowMode: configState.rainbowMode,
        logoMode: configState.logoMode,
        logoBrightness: configState.logoBrightness,
        logoRainbow: configState.logoRainbow,
        logoColor: configState.logoColor,
        activeScreenMode: configState.activeScreenMode,
        slot0FrameCount: configState.slot0FrameCount,
        slot1FrameCount: configState.slot1FrameCount,
        frameDurationMs: configState.frameDurationMs,
        clockIso: configState.clockDate.toISOString(),
      },
      rawConfigHex: formatPacketHex(rawHardwareConfig, rawHardwareConfig.length),
      steps: steps.map((s) => ({
        id: s.id,
        status: s.status,
        durationMs: s.durationMs,
        summary: s.summary,
        packetHex: s.packetHex,
        details: s.details,
      })),
    };
    const text = `=== GMK87 HARDWARE DIAGNOSTIC REPORT ===\n${JSON.stringify(report, null, 2)}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 2500);
      onStatusLog('Copied GMK87 Hardware Diagnostic Report to clipboard — paste it into chat!');
    } catch {
      // Fallback
    }
  };

  const getStepIcon = (id: DiagnosticStepResult['id']) => {
    switch (id) {
      case 'transport':
        return Usb;
      case 'eeprom_read':
        return Database;
      case 'rtc_clock':
        return Clock;
      case 'rgb_write':
        return Palette;
      case 'via_read':
        return Keyboard;
      case 'lcd_flash':
        return Film;
    }
  };

  const diagMeta = hidEngine?.getDiagnosticMetadata();
  const topLevelDevUrl =
    typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3887';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b101b] border border-[#1e293b] rounded-xl max-w-3xl w-full max-h-[92vh] flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.85)] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#080b12] border-b border-[#182233] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#06b6d4]/15 border border-[#06b6d4]/40 flex items-center justify-center text-[#06b6d4]">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wide">
                GMK87 Live Hardware Self-Test &amp; Clock Fix Studio
              </h2>
              <p className="text-[11px] font-mono text-slate-400">
                Fixes 00:00 Clock (`cfg[21]=1` + BCD RTC) &amp; Flashes High-Contrast 240×135 Clock HUD
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Dedicated 1-Click Clock 00:00 Fix & Custom HUD Flash Panel */}
        <div className="px-5 py-3 bg-[#0c1424] border-b border-[#1e293b] space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-mono font-bold text-yellow-300 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-yellow-400" />
              INSTANT KEYBOARD CLOCK &amp; SCREEN UPGRADE:
            </div>
            <button
              type="button"
              onClick={handleDirectWebHidPair}
              className="px-2.5 py-1 rounded bg-[#131b2e] hover:bg-[#1c2842] border border-cyan-400/50 text-cyan-300 font-mono font-bold text-[11px] flex items-center gap-1 cursor-pointer"
              title="Pair WebHID directly in Chrome so ClassA clock enable bytes (cfg[19..22]) are written immediately even before restarting PowerShell"
            >
              <Usb className="w-3 h-3" />
              Pair Direct WebHID (No PowerShell Restart Needed)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              disabled={isRepairingKeys || isFixingClock || isFlashingHud || isRunningAll}
              onClick={handleRepairMangledKeys}
              className="p-2.5 rounded-lg bg-[#06b6d4]/20 hover:bg-[#06b6d4]/30 border-2 border-[#06b6d4] text-left transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-200 flex items-center gap-1.5">
                  <Keyboard className="w-3.5 h-3.5 text-[#06b6d4]" />
                  {isRepairingKeys ? 'Repairing Keys...' : '1. REPAIR MANGLED KEYS (<2s)'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-cyan-300">
                  EEPROM + VIA
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 mt-1">
                Wipes corrupted `cfg[9..27]` bytes, restores `cfg[0]=0x01`, and flashes all 87 factory keys across Layers 0–3.
              </p>
            </button>

            <button
              type="button"
              disabled={isFixingClock || isRepairingKeys || isFlashingHud || isRunningAll}
              onClick={handleFixNativeClock}
              className="p-2.5 rounded-lg bg-[#10b981]/15 hover:bg-[#10b981]/25 border border-[#10b981]/50 text-left transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#10b981] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  {isFixingClock ? 'Syncing Clock...' : '2. Sync Native Clock (<1s)'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-emerald-300">
                  Mode 0
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 mt-1">
                Writes BCD time (`cfg[35..41]`) with clean `PID 0x5055` header (`cfg[0]=0x01`) and switches to built-in clock.
              </p>
            </button>

            <button
              type="button"
              disabled={isFlashingHud || isRepairingKeys || isFixingClock || isRunningAll}
              onClick={handleFlashCustomClockHud}
              className="p-2.5 rounded-lg bg-[#facc15]/15 hover:bg-[#facc15]/25 border border-[#facc15]/50 text-left transition-colors cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-[#facc15] flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5" />
                  {isFlashingHud
                    ? `Flashing HUD (${hudProgressPct ?? 0}%)...`
                    : '3. Flash Neo-Tokyo Clock HUD'}
                </span>
                <span className="px-1.5 py-0.5 rounded bg-black/40 text-[10px] font-mono text-yellow-300">
                  240×135
                </span>
              </div>
              <p className="text-[11px] font-mono text-slate-300 mt-1">
                Flashes a high-contrast 240×135 digital clock + date + RGB status HUD to Slot 0 (`cfg[33]=1`).
              </p>
            </button>
          </div>

          {hudStatusMsg && (
            <div className="px-3 py-1.5 rounded bg-[#070b14] border border-[#1e293b] text-[11px] font-mono text-cyan-300 flex items-center justify-between">
              <span>{hudStatusMsg}</span>
              {hudProgressPct !== null && (
                <span className="font-bold text-yellow-300">{hudProgressPct}%</span>
              )}
            </div>
          )}
        </div>

        {/* Iframe / USB Guidance Banner when not connected */}
        {!hidEngine?.isConnected() && (
          <div className="px-5 py-2 bg-amber-500/10 border-b border-amber-500/30 flex flex-wrap items-center justify-between gap-2">
            <div className="text-[11px] font-mono text-amber-200">
              <span className="font-bold text-yellow-300">USB NOT CONNECTED YET:</span> Either run{' '}
              <code className="px-1 py-0.5 rounded bg-black/40 text-cyan-300">npm run dev</code> in{' '}
              <code className="px-1 py-0.5 rounded bg-black/40 text-cyan-300">
                C:\Users\rahif\gmk87-controller
              </code>{' '}
              (Port 3887) OR pair directly via Browser WebHID.
            </div>
            {diagMeta?.inIframe && (
              <a
                href={topLevelDevUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 rounded bg-[#131b2e] hover:bg-[#1c2842] border border-cyan-400/50 text-cyan-300 font-mono font-bold text-[11px] flex items-center gap-1"
              >
                Open Full Tab ↗
              </a>
            )}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="px-5 py-2.5 bg-[#0e1525] border-b border-[#182233] flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isRunningAll}
              onClick={() => handleRunFullSuite(false)}
              className="px-3 py-1.5 rounded-md bg-[#06b6d4] hover:bg-cyan-300 disabled:opacity-50 text-slate-950 font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {isRunningAll ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Play className="w-3.5 h-3.5 fill-current" />
              )}
              Run Steps 1–5 (Leaves Native Clock Active)
            </button>

            <button
              type="button"
              disabled={isRunningAll}
              onClick={() => handleRunFullSuite(true)}
              className="px-3 py-1.5 rounded-md bg-[#131b2e] hover:bg-[#1a253d] border border-[#06b6d4]/40 text-cyan-300 font-mono font-semibold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Film className="w-3.5 h-3.5" />
              Run All + Flash Custom Clock HUD
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopyReport}
            className={`px-3 py-1.5 rounded-md font-mono font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors border ${
              copiedReport
                ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                : 'bg-[#131b2e] border-[#28354d] text-slate-200 hover:border-yellow-400 hover:text-yellow-300'
            }`}
          >
            {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedReport ? 'COPIED TO CLIPBOARD!' : 'COPY DIAGNOSTIC REPORT'}
          </button>
        </div>

        {/* Steps List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {steps.map((step) => {
            const Icon = getStepIcon(step.id);
            return (
              <div
                key={step.id}
                className={`rounded-lg border p-3 transition-colors ${
                  step.status === 'pass'
                    ? 'bg-[#10b981]/5 border-[#10b981]/40'
                    : step.status === 'fail'
                    ? 'bg-red-500/10 border-red-500/50'
                    : step.status === 'running'
                    ? 'bg-[#06b6d4]/10 border-[#06b6d4]/50'
                    : 'bg-[#0f1626] border-[#1c283d]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div className="mt-0.5 shrink-0">
                      {step.status === 'pass' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
                      ) : step.status === 'fail' ? (
                        <XCircle className="w-4 h-4 text-red-400" />
                      ) : step.status === 'running' ? (
                        <RefreshCw className="w-4 h-4 text-[#06b6d4] animate-spin" />
                      ) : (
                        <Icon className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono font-bold text-white">{step.title}</span>
                        <span className="px-1.5 py-0.5 rounded bg-[#070a11] border border-[#1e293b] text-[10px] font-mono text-cyan-300">
                          {step.commandLabel}
                        </span>
                        {step.durationMs !== undefined && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {step.durationMs}ms
                          </span>
                        )}
                      </div>
                      <p
                        className={`text-xs font-mono mt-1 break-words ${
                          step.status === 'fail'
                            ? 'text-red-300 font-semibold'
                            : step.status === 'pass'
                            ? 'text-emerald-200'
                            : 'text-slate-400'
                        }`}
                      >
                        {step.summary}
                      </p>
                      {step.packetHex && (
                        <div className="mt-1.5 px-2 py-1 rounded bg-[#06080e] border border-[#182233] text-[10px] font-mono text-slate-300 overflow-x-auto">
                          {step.packetHex}
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isRunningAll || step.status === 'running'}
                    onClick={() => runSingleStep(step.id)}
                    className="px-2.5 py-1 rounded bg-[#151f33] hover:bg-[#1e2c47] border border-[#263552] text-[11px] font-mono text-slate-200 shrink-0 cursor-pointer"
                  >
                    Test
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Workflow Tip */}
        <div className="px-5 py-2.5 bg-[#080b12] border-t border-[#182233] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-slate-400">
          <span>
            Tip: Run <code className="text-cyan-300">git pull</code> then restart{' '}
            <code className="text-cyan-300">npm run dev</code> in PowerShell (or click Pair Direct WebHID above).
          </span>
          <span className="text-yellow-300">
            Click &ldquo;Copy Diagnostic Report&rdquo; to share results!
          </span>
        </div>
      </div>
    </div>
  );
}
