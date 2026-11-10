import React, { useState, useEffect } from 'react';
import { Gauge, Timer } from 'lucide-react';
import { KEYBOARD_APPS_COMPARISON, GMK87_FIXES_AND_INNOVATIONS } from '../data/ecosystemResearch';
import {
  TabId,
  PomodoroState,
  computePomodoroRemainingSeconds,
} from '../data/studioPresets';

export type { PomodoroState };
export { computePomodoroRemainingSeconds };

export interface BeyondZuoyaLabTabProps {
  liveWpm: number;
  onTypingWpmInput: (text: string) => void;
  typingTestText: string;
  pomodoroState: PomodoroState;
  onTogglePomodoro: () => void;
  onResetPomodoro: () => void;
  onFlashBeyondApplet: (mode: 'wpm' | 'pomodoro') => Promise<void>;
  onNavigateTab: (tab: TabId) => void;
}

export default function BeyondZuoyaLabTab({
  liveWpm,
  onTypingWpmInput,
  typingTestText,
  pomodoroState,
  onTogglePomodoro,
  onResetPomodoro,
  onFlashBeyondApplet,
  onNavigateTab,
}: BeyondZuoyaLabTabProps) {
  const [displaySeconds, setDisplaySeconds] = useState<number>(() =>
    computePomodoroRemainingSeconds(pomodoroState)
  );

  // Sync display whenever props change or every 1s only while timer is running and tab is visible
  useEffect(() => {
    setDisplaySeconds(computePomodoroRemainingSeconds(pomodoroState));
    if (!pomodoroState.running) return;
    const id = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setDisplaySeconds(computePomodoroRemainingSeconds(pomodoroState));
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoroState]);

  const mins = String(Math.floor(displaySeconds / 60)).padStart(2, '0');
  const secs = String(displaySeconds % 60).padStart(2, '0');

  return (
    <div className="space-y-6">
      {/* Interactive Beyond-Zuoya Hardware Applets (WPM Tachometer + Pomodoro Timer) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gauge className="w-5 h-5 text-[#06b6d4]" />
              <h3 className="text-sm font-bold text-white">
                Beyond-Zuoya Applet #1: Live WPM Typing Tachometer OSD
              </h3>
            </div>
            <span className="text-lg font-mono font-bold text-[#06b6d4]">{liveWpm} WPM</span>
          </div>
          <p className="text-xs text-slate-400">
            Inspired by ASUS ROG Omni & Finalmouse Centerpiece: type in the test box below to measure
            your real-time keystroke cadence and flash your live WPM gauge onto the GMK87 TFT
            screen.
          </p>
          <input
            type="text"
            value={typingTestText}
            onChange={(e) => onTypingWpmInput(e.target.value)}
            placeholder="Type here rapidly to test live WPM calculation..."
            className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
          />
          <button
            onClick={() => onFlashBeyondApplet('wpm')}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer"
          >
            Flash Live {liveWpm} WPM Tachometer to GMK87 LCD
          </button>
        </div>

        <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-[#f59e0b]" />
              <h3 className="text-sm font-bold text-white">
                Beyond-Zuoya Applet #2: Hardware Pomodoro Focus Timer OSD
              </h3>
            </div>
            <span className="text-lg font-mono font-bold text-[#f59e0b]">
              {mins}:{secs}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Turns your GMK87 screen into a dedicated desk focus timer—a productivity feature absent
            from the stock Zuoya Windows utility.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={onTogglePomodoro}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#f59e0b] cursor-pointer"
            >
              {pomodoroState.running ? 'Pause Timer' : 'Start 25m Sprint'}
            </button>
            <button
              onClick={onResetPomodoro}
              className="px-3.5 py-2 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white cursor-pointer"
            >
              Reset 25:00
            </button>
            <button
              onClick={() => onFlashBeyondApplet('pomodoro')}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#f59e0b] text-slate-950 hover:bg-amber-400 cursor-pointer"
            >
              Flash Timer OSD to GMK87 LCD
            </button>
          </div>
        </div>
      </div>

      {/* Fixes & Innovations Architectural Breakdown */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <h2 className="text-base font-bold text-white">
          What We Fixed in the Stock Zuoya Ecosystem vs. What We Added Beyond It
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GMK87_FIXES_AND_INNOVATIONS.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b] flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span
                    className={
                      item.type === 'fix' ? 'text-[#f59e0b] font-bold' : 'text-[#10b981] font-bold'
                    }
                  >
                    {item.type === 'fix'
                      ? '🔧 ZUOYA ECOSYSTEM FIX'
                      : '🚀 BEYOND-ZUOYA INNOVATION'}
                  </span>
                  <span className="text-slate-500">{item.hardwareMechanism}</span>
                </div>
                <h3 className="text-sm font-bold text-white">{item.title}</h3>
                <p className="text-xs text-slate-400">{item.problemOrOpportunity}</p>
                <p className="text-xs text-cyan-200/90 pt-1">{item.howWeSolvedIt}</p>
              </div>
              <div>
                <button
                  onClick={() => onNavigateTab(item.targetTab as TabId)}
                  className="text-xs font-mono text-[#06b6d4] hover:underline cursor-pointer"
                >
                  Open Feature in Studio →
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Industry Keyboard Apps Comparison Table */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4 overflow-x-auto">
        <h2 className="text-base font-bold text-white">
          Industry Keyboard Configurator Benchmark vs. Zuoya GMK87 Hardware
        </h2>
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-[#1e293b] text-[11px] font-mono text-slate-400">
              <th className="py-3 px-3">ECOSYSTEM / APP</th>
              <th className="py-3 px-3">KEY REMAPPING</th>
              <th className="py-3 px-3">LCD / TFT ENGINE</th>
              <th className="py-3 px-3">LIVE TELEMETRY / OSD</th>
              <th className="py-3 px-3">RGB565 DITHERING</th>
              <th className="py-3 px-3">GMK87 VERDICT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1e293b]">
            {KEYBOARD_APPS_COMPARISON.map((row) => (
              <tr key={row.app} className="hover:bg-[#0b0f19]/60">
                <td className="py-3 px-3 font-bold text-white">{row.app}</td>
                <td className="py-3 px-3 text-slate-300">{row.keyRemapping}</td>
                <td className="py-3 px-3 text-slate-300">{row.lcdScreenSupport}</td>
                <td className="py-3 px-3 text-slate-300">{row.liveTelemetryOsd}</td>
                <td className="py-3 px-3 font-mono text-[#06b6d4]">{row.rgb565Dithering}</td>
                <td className="py-3 px-3 text-slate-400">{row.verdictForGmk87}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
