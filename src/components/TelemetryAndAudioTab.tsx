import React, { useState, useEffect, useRef } from 'react';
import { Clock, Play, Pause, Mic, MicOff } from 'lucide-react';
import { TelemetryHudMetrics, ProceduralAnimId } from '../utils/lcdGenerators';
import { PomodoroState, computePomodoroRemainingSeconds } from '../data/studioPresets';

export interface TelemetryAndAudioTabProps {
  activeScreenMode: number;
  targetSlot: 0 | 1;
  liveWpm: number;
  pomodoroState: PomodoroState;
  telemetry: TelemetryHudMetrics;
  livePcTelemetry: boolean;
  bridgeAvailable: boolean;
  autoStreamHud5s: boolean;
  spectrumDemoRunning: boolean;
  micActive: boolean;
  analyserRef: React.MutableRefObject<AnalyserNode | null>;
  liveSpectrumValuesRef: React.MutableRefObject<number[]>;
  onSyncClockNow: () => Promise<void>;
  onChangeScreenMode: (mode: number) => Promise<void>;
  onFlashBeyondApplet: (mode: 'wpm' | 'pomodoro') => Promise<void>;
  onToggleLivePcTelemetry: () => void;
  onChangeManualTelemetry: (next: TelemetryHudMetrics) => void;
  onToggleAutoStreamHud5s: () => void;
  onToggleSpectrumDemo: () => void;
  onToggleMic: () => Promise<void>;
  onFlashProcedural: (animId: ProceduralAnimId, frameCount: number) => Promise<void>;
}

export default function TelemetryAndAudioTab({
  activeScreenMode,
  targetSlot,
  liveWpm,
  pomodoroState,
  telemetry,
  livePcTelemetry,
  bridgeAvailable,
  autoStreamHud5s,
  spectrumDemoRunning,
  micActive,
  analyserRef,
  liveSpectrumValuesRef,
  onSyncClockNow,
  onChangeScreenMode,
  onFlashBeyondApplet,
  onToggleLivePcTelemetry,
  onChangeManualTelemetry,
  onToggleAutoStreamHud5s,
  onToggleSpectrumDemo,
  onToggleMic,
  onFlashProcedural,
}: TelemetryAndAudioTabProps) {
  const [pcNow, setPcNow] = useState<Date>(() => new Date());
  const [pomodoroSec, setPomodoroSec] = useState<number>(() =>
    computePomodoroRemainingSeconds(pomodoroState)
  );
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Isolated 1-second RTC clock & pomodoro display ticker while mounted & visible
  useEffect(() => {
    const syncClock = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setPcNow(new Date());
      setPomodoroSec(computePomodoroRemainingSeconds(pomodoroState));
    };
    syncClock();
    const timer = setInterval(syncClock, 1000);
    document.addEventListener('visibilitychange', syncClock);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', syncClock);
    };
  }, [pomodoroState]);

  // Dual-Layer 24-Band Neon Audio Spectrum Visualizer Loop (only runs while tab mounted & visible)
  useEffect(() => {
    let animFrame = 0;
    let tick = 0;
    let active = true;

    const renderSpectrum = () => {
      if (!active) return;
      if (typeof document !== 'undefined' && document.hidden) {
        animFrame = 0;
        return;
      }

      tick++;
      const bands = 24;
      const vals = liveSpectrumValuesRef.current;

      if (micActive && analyserRef.current) {
        const freqData = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(freqData);
        for (let i = 0; i < bands; i++) {
          const bin = Math.min(
            freqData.length - 1,
            Math.floor((i / bands) * (freqData.length * 0.65))
          );
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

          ctx.strokeStyle = 'rgba(30, 41, 59, 0.7)';
          ctx.lineWidth = 1;
          for (let gy = 25; gy < H; gy += 25) {
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(W, gy);
            ctx.stroke();
          }

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

            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(bx, Math.max(36, by - 5), barW, 3);
          }
        }
      }

      if (micActive || spectrumDemoRunning) {
        animFrame = requestAnimationFrame(renderSpectrum);
      } else {
        animFrame = 0;
      }
    };

    const onVisibility = () => {
      if (!document.hidden && animFrame === 0 && (micActive || spectrumDemoRunning)) {
        animFrame = requestAnimationFrame(renderSpectrum);
      }
    };

    animFrame = requestAnimationFrame(renderSpectrum);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      if (animFrame) cancelAnimationFrame(animFrame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [micActive, spectrumDemoRunning, analyserRef, liveSpectrumValuesRef]);

  return (
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
            onClick={onSyncClockNow}
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
                onClick={() => onChangeScreenMode(item.m)}
                className={`px-2.5 py-1 rounded cursor-pointer ${
                  activeScreenMode === item.m
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
            onClick={() => onFlashBeyondApplet('wpm')}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
          >
            ⚡ Flash {liveWpm} WPM OSD
          </button>
          <button
            type="button"
            onClick={() => onFlashBeyondApplet('pomodoro')}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-amber-300 hover:border-[#f59e0b] cursor-pointer"
          >
            ⏱️ Flash Pomodoro ({String(Math.floor(pomodoroSec / 60)).padStart(2, '0')}:
            {String(pomodoroSec % 60).padStart(2, '0')})
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
              onClick={onToggleLivePcTelemetry}
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
                onChange={(e) =>
                  onChangeManualTelemetry({ ...telemetry, cpuPercent: Number(e.target.value) })
                }
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
                  onChangeManualTelemetry({
                    ...telemetry,
                    ramPercent: pct,
                    ramUsedGb: Number(((pct / 100) * telemetry.ramTotalGb).toFixed(1)),
                  });
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
                onChange={(e) =>
                  onChangeManualTelemetry({ ...telemetry, trackTitle: e.target.value })
                }
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
                onChange={(e) =>
                  onChangeManualTelemetry({ ...telemetry, trackArtist: e.target.value })
                }
                className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3 py-1.5 text-xs text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onFlashProcedural('cyber-hud', 1)}
              className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer"
            >
              Flash Snapshot to Slot {targetSlot}
            </button>
            <button
              onClick={onToggleAutoStreamHud5s}
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
                Real-time 480×150 DSP analyzer with Demo Synth or Web Audio API Microphone capture.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onToggleSpectrumDemo}
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
                onClick={onToggleMic}
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
            onClick={() => onFlashProcedural('neon-spectrum', 16)}
            className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#8b5cf6] text-white hover:bg-purple-500 transition-colors cursor-pointer"
          >
            Flash 16-Frame Spectrum to GMK87 (Slot {targetSlot})
          </button>
        </div>
      </div>
    </div>
  );
}
