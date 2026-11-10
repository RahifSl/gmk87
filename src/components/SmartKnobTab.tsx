import React from 'react';
import { SMART_KNOB_MODES, SmartKnobMode } from '../data/studioPresets';

export interface SmartKnobTabProps {
  activeKnobModeId: string;
  onSelectSmartKnobMode: (mode: SmartKnobMode) => Promise<void>;
}

export default function SmartKnobTab({
  activeKnobModeId,
  onSelectSmartKnobMode,
}: SmartKnobTabProps) {
  return (
    <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-6">
      <div>
        <h2 className="text-base font-bold text-white">
          Smart Rotary Knob Multi-Engine (Simultaneous VIA Matrix + 240×135 OSD Banner)
        </h2>
        <p className="text-xs text-slate-400">
          Clicking any card below batch-programs Layer 0 VIA keycodes for{' '}
          <code className="text-cyan-300">[7,0] CCW</code>,{' '}
          <code className="text-cyan-300">[0,14] Click</code>, and{' '}
          <code className="text-cyan-300">[7,1] CW</code> via command{' '}
          <code className="text-cyan-300">0x05</code>, and immediately flashes a custom Rotary Knob
          Active Mode OSD card to the TFT LCD.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {SMART_KNOB_MODES.map((mode) => {
          const active = activeKnobModeId === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onSelectSmartKnobMode(mode)}
              className={`p-5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-4 ${
                active
                  ? 'bg-[#0b0f19] border-2 border-[#06b6d4] shadow-lg'
                  : 'bg-[#0b0f19] border border-[#1e293b] hover:border-slate-600'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base font-bold text-white">{mode.title}</span>
                  {active && (
                    <span className="text-[10px] font-mono text-[#10b981] font-bold">ACTIVE</span>
                  )}
                </div>
                <p className="text-xs text-slate-400">{mode.subtitle}</p>
              </div>

              <div className="space-y-1.5 pt-3 border-t border-[#1e293b] text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">↺ [7,0] CCW:</span>
                  <span className="text-[#06b6d4] font-bold">{mode.ccwLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">● [0,14] CLICK:</span>
                  <span className="text-[#8b5cf6] font-bold">{mode.clickLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">↻ [7,1] CW:</span>
                  <span className="text-[#10b981] font-bold">{mode.cwLabel}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
