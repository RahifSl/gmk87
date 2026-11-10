import React, { useState, useEffect } from 'react';
import { Gmk87ConfigState, toBcd } from '../services/gmk87Hid';

export interface ClockAndProfilesTabProps {
  configState: Gmk87ConfigState;
  hwClockOffsetMs: number;
  autoSync15Min: boolean;
  onSyncClockNow: () => Promise<void>;
  onToggleAutoSync: () => Promise<void>;
  onChangeScreenMode: (mode: number) => Promise<void>;
}

export default function ClockAndProfilesTab({
  configState,
  hwClockOffsetMs,
  autoSync15Min,
  onSyncClockNow,
  onToggleAutoSync,
  onChangeScreenMode,
}: ClockAndProfilesTabProps) {
  const [pcNow, setPcNow] = useState<Date>(() => new Date());

  // Isolated 1-second clock ticker — only runs while this tab is mounted & visible
  useEffect(() => {
    const syncVis = () => {
      if (typeof document === 'undefined' || !document.hidden) {
        setPcNow(new Date());
      }
    };
    const timer = setInterval(syncVis, 1000);
    document.addEventListener('visibilitychange', syncVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', syncVis);
    };
  }, []);

  const hwClockDisplay = new Date(pcNow.getTime() + hwClockOffsetMs);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: Side-by-Side PC System Clock vs GMK87 Hardware BCD Clock */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-white">
            BCD Hardware Real-Time Clock Synchronizer (`cfg[35..41]`)
          </h2>
          <p className="text-xs text-slate-400">
            Encodes `sec`, `min`, `hour`, `dayOfWeek` (0=Sun..6=Sat), `date`, `month`, and `year %
            100` using{' '}
            <code className="text-cyan-300">toBcd(n) = ((Math.floor(n/10)&lt;&lt;4) | (n%10))</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4">
            <div className="text-[11px] font-mono text-slate-400 mb-1">PC SYSTEM CLOCK (LOCAL)</div>
            <div className="text-2xl font-mono font-bold text-[#10b981]">
              {pcNow.toLocaleTimeString()}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              {pcNow.toLocaleDateString(undefined, {
                weekday: 'short',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
          </div>

          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4">
            <div className="text-[11px] font-mono text-slate-400 mb-1">
              GMK87 HARDWARE RTC (`cfg[35..41]`)
            </div>
            <div
              className={`text-2xl font-mono font-bold ${
                hwClockOffsetMs === 0 ? 'text-[#06b6d4]' : 'text-[#f59e0b]'
              }`}
            >
              {hwClockDisplay.toLocaleTimeString()}
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              {hwClockOffsetMs === 0
                ? 'Δ 0.0s (Locked to PC)'
                : `Drift: ${Math.round(hwClockOffsetMs / 1000)}s (Needs Sync)`}
            </div>
          </div>
        </div>

        {/* Live BCD Byte Breakdown */}
        <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3.5 text-xs font-mono space-y-1.5">
          <div className="text-slate-400">LIVE BCD REGISTER ENCODING (`cfg[35..41]`):</div>
          <div className="text-cyan-300 flex flex-wrap gap-3">
            <span>[35] SEC: 0x{toBcd(pcNow.getSeconds()).toString(16).padStart(2, '0')}</span>
            <span>[36] MIN: 0x{toBcd(pcNow.getMinutes()).toString(16).padStart(2, '0')}</span>
            <span>[37] HOUR: 0x{toBcd(pcNow.getHours()).toString(16).padStart(2, '0')}</span>
            <span>[38] DOW: 0x{toBcd(pcNow.getDay()).toString(16).padStart(2, '0')}</span>
            <span>[39] DAY: 0x{toBcd(pcNow.getDate()).toString(16).padStart(2, '0')}</span>
            <span>[40] MON: 0x{toBcd(pcNow.getMonth() + 1).toString(16).padStart(2, '0')}</span>
            <span>[41] YR: 0x{toBcd(pcNow.getFullYear() % 100).toString(16).padStart(2, '0')}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={onSyncClockNow}
            className="px-4 py-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
          >
            Sync Keyboard Clock to PC Now
          </button>

          <button
            onClick={onToggleAutoSync}
            className={`px-4 py-2.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
              autoSync15Min
                ? 'bg-[#10b981]/20 border-[#10b981] text-[#10b981]'
                : 'bg-[#0b0f19] border-[#1e293b] text-slate-300'
            }`}
          >
            15-Min Auto-Sync Daemon: {autoSync15Min ? 'ACTIVE' : 'OFF'}
          </button>
        </div>

        {configState.activeScreenMode !== 0 && (
          <div className="rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/40 px-3.5 py-2.5 text-xs text-amber-200 leading-relaxed">
            Your LCD is currently showing{' '}
            <strong>Custom Slot {configState.activeScreenMode - 1}</strong>. Switch to{' '}
            <strong>Default Screen (Mode 0)</strong> on the right (or press{' '}
            <kbd className="text-cyan-300 font-mono">Fn + Enter</kbd>) to display the synced clock on
            your keyboard.
          </div>
        )}
      </div>

      {/* Right: Display Profile Switcher (cfg[33]) */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div>
          <h2 className="text-base font-bold text-white">
            Active TFT Display Profile Switcher (`cfg[33]`)
          </h2>
          <p className="text-xs text-slate-400">
            Switch the GMK87 240×135 screen between Factory Clock/Battery mode and your two custom
            flash slots without pressing <kbd className="text-cyan-300">Fn + Enter</kbd>.
          </p>
        </div>

        <div className="space-y-3">
          {[
            {
              mode: 0,
              title: 'Default Screen (Mode 0)',
              desc: 'Factory Zuoya digital clock, date, battery meter, Win/Mac & BT/2.4G/USB indicators.',
              framesLabel: 'Built-in ROM UI',
            },
            {
              mode: 1,
              title: 'Custom Slot 0 (Mode 1)',
              desc: 'Primary user animation slot starting at SPI Flash offset 0x000000.',
              framesLabel: `cfg[34] = ${configState.slot0FrameCount} Frames`,
            },
            {
              mode: 2,
              title: 'Custom Slot 1 (Mode 2)',
              desc: 'Secondary user animation slot (preserved with Slot 0 prefix framing).',
              framesLabel: `cfg[46] = ${configState.slot1FrameCount} Frames`,
            },
          ].map((prof) => {
            const active = configState.activeScreenMode === prof.mode;
            return (
              <button
                key={prof.mode}
                onClick={() => onChangeScreenMode(prof.mode)}
                className={`w-full p-4 rounded-xl border text-left transition-colors cursor-pointer flex items-center justify-between gap-4 ${
                  active
                    ? 'bg-[#06b6d4]/15 border-[#06b6d4] text-white'
                    : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="text-sm font-bold text-white">{prof.title}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{prof.desc}</div>
                </div>
                <span className="text-xs font-mono text-[#06b6d4] shrink-0">{prof.framesLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
