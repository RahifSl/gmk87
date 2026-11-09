import React, { useState } from 'react';
import {
  Search,
  Zap,
  Terminal,
  Copy,
  Check,
  Keyboard,
  Play,
  Cpu,
} from 'lucide-react';
import {
  GMK87_PHYSICAL_KEYS,
  GMK87_SHORTCUTS,
  ShortcutEntry,
} from '../data/gmk87KeymapData';
import { Gmk87ConfigState } from '../services/gmk87Hid';

interface InteractiveShortcutTrainerProps {
  configState: Gmk87ConfigState;
  onUpdateConfig: (partial: Partial<Gmk87ConfigState>) => Promise<void>;
  onSwitchViaLayer: (layer: number) => void;
  lastLcdPacketHex: string;
  lastViaPacketHex: string;
  onStatusLog: (msg: string) => void;
}

const SHORTCUT_KEY_ID_MAP: Record<string, string[]> = {
  'sc-1': ['r5c10', 'r4c12'], // Fn + Right Shift
  'sc-2': ['r5c10', 'r3c13'], // Fn + Enter
  'sc-3': ['r5c10', 'r4c13', 'r6c12', 'r5c13', 'r6c13'], // Fn + Arrows
  'sc-4': ['r5c10', 'r2c1'], // Fn + Q
  'sc-5': ['r5c10', 'r2c2'], // Fn + W
  'sc-6': ['r5c10', 'r2c3'], // Fn + E
  'sc-7': ['r5c10', 'r2c4'], // Fn + R
  'sc-8': ['r5c10', 'r2c5'], // Fn + T
  'sc-9': ['r5c10', 'r2c13'], // Fn + \ |
  'sc-10': ['r5c10', 'r2c14'], // Fn + Del
  'sc-11': ['r5c10', 'r4c13', 'r6c12'], // Fn + Up/Down
  'sc-12': ['r5c10', 'r5c13', 'r6c13'], // Fn + Left/Right
  'sc-13': ['r5c10', 'r1c13'], // Fn + Backspace
  'sc-14': ['r5c10', 'r5c1'], // Fn + Win
  'sc-15': ['r5c10', 'r3c1'], // Fn + A
  'sc-16': ['r5c10', 'r3c2'], // Fn + S
  'sc-17': ['r5c10', 'r0c0'], // Fn + Esc
};

const HUE_PRESET_CYCLE: [number, number, number][] = [
  [6, 182, 212], // Cyan
  [139, 92, 246], // Purple
  [16, 185, 129], // Emerald
  [245, 158, 11], // Amber
  [244, 63, 94], // Rose
  [59, 130, 246], // Blue
  [255, 255, 255], // White
];

export default function InteractiveShortcutTrainer({
  configState,
  onUpdateConfig,
  onSwitchViaLayer,
  lastLcdPacketHex,
  lastViaPacketHex,
  onStatusLog,
}: InteractiveShortcutTrainerProps) {
  const [shortcutQuery, setShortcutQuery] = useState('');
  const [shortcutCat, setShortcutCat] = useState<
    'All' | 'Screen' | 'Wireless' | 'Lighting' | 'System'
  >('All');
  const [activeShortcutId, setActiveShortcutId] = useState<string>('sc-2');
  const [copiedHex, setCopiedHex] = useState<boolean>(false);

  const filteredShortcuts = GMK87_SHORTCUTS.filter((s) => {
    const matchesCat = shortcutCat === 'All' || s.category === shortcutCat;
    const q = shortcutQuery.toLowerCase();
    const matchesQuery =
      !q ||
      s.action.toLowerCase().includes(q) ||
      s.details.toLowerCase().includes(q) ||
      s.keys.some((k) => k.toLowerCase().includes(q));
    return matchesCat && matchesQuery;
  });

  const activeShortcut =
    GMK87_SHORTCUTS.find((s) => s.id === activeShortcutId) || GMK87_SHORTCUTS[0];
  const highlightedKeyIds = new Set(SHORTCUT_KEY_ID_MAP[activeShortcut.id] || ['r5c10']);

  const handleExecuteShortcut = async (sc: ShortcutEntry) => {
    setActiveShortcutId(sc.id);
    switch (sc.id) {
      case 'sc-2': {
        const nextMode = (configState.activeScreenMode + 1) % 3;
        await onUpdateConfig({ activeScreenMode: nextMode });
        onStatusLog(
          `Executed [Fn + Enter] via USB → Cycled cfg[33] Screen Mode to Mode ${nextMode}`
        );
        break;
      }
      case 'sc-9': {
        const nextEffect = configState.lightingEffect >= 18 ? 1 : configState.lightingEffect + 1;
        await onUpdateConfig({ lightingEffect: nextEffect });
        onStatusLog(
          `Executed [Fn + \\|] via USB → Cycled cfg[1] Lighting Effect to 0x${nextEffect
            .toString(16)
            .padStart(2, '0')}`
        );
        break;
      }
      case 'sc-10': {
        const idx = Math.floor(Math.random() * HUE_PRESET_CYCLE.length);
        const [r, g, b] = HUE_PRESET_CYCLE[idx];
        await onUpdateConfig({ rgbHueR: r, rgbHueG: g, rgbHueB: b, rainbowMode: 0 });
        onStatusLog(`Executed [Fn + Del] via USB → Cycled RGB Hue to rgb(${r},${g},${b})`);
        break;
      }
      case 'sc-11': {
        const nextBri = configState.brightness >= 9 ? 2 : configState.brightness + 2;
        await onUpdateConfig({ brightness: Math.min(9, nextBri) });
        onStatusLog(`Executed [Fn + ▲/▼] via USB → Adjusted cfg[2] Brightness to ${nextBri}/9`);
        break;
      }
      case 'sc-12': {
        const nextSpd = (configState.speed + 1) % 5;
        await onUpdateConfig({ speed: nextSpd });
        onStatusLog(`Executed [Fn + ◄/►] via USB → Adjusted cfg[3] Speed to ${nextSpd}/4`);
        break;
      }
      case 'sc-13': {
        const nextEff = configState.lightingEffect === 0 ? 1 : 0;
        await onUpdateConfig({ lightingEffect: nextEff });
        onStatusLog(
          `Executed [Fn + Backspace] via USB → ${
            nextEff === 0 ? 'Turned RGB Off (0x00)' : 'Restored RGB Wave (0x01)'
          }`
        );
        break;
      }
      case 'sc-15': {
        onSwitchViaLayer(0);
        onStatusLog('Switched active studio keymap view to Windows Base (Layer 0).');
        break;
      }
      case 'sc-16': {
        onSwitchViaLayer(2);
        onStatusLog('Switched active studio keymap view to macOS Base (Layer 2).');
        break;
      }
      default: {
        onStatusLog(
          `Highlighted [${sc.keys.join(' + ')}] on 87-Key Matrix — Firmware Action: ${sc.action}`
        );
      }
    }
  };

  const canSimulateUsb = (id: string) =>
    ['sc-2', 'sc-9', 'sc-10', 'sc-11', 'sc-12', 'sc-13', 'sc-15', 'sc-16'].includes(id);

  return (
    <div className="space-y-6">
      {/* Top Interactive 87-Key Visual Shortcut Trainer */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4 overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Keyboard className="w-4 h-4 text-[#06b6d4]" />
              Interactive 87-Key Hardware Shortcut Visualizer & USB Action Tester
            </h2>
            <p className="text-xs text-slate-400">
              Click or hover any shortcut below to illuminate the exact physical switch matrix
              combination on the GMK87 chassis, or click <strong>Trigger via USB</strong> to fire the
              matching firmware register change immediately.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-[#0b0f19] border border-[#06b6d4]/50 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              {activeShortcut.keys.map((k, idx) => (
                <React.Fragment key={k}>
                  <kbd className="px-2 py-1 text-xs font-mono font-bold bg-[#131b2e] border border-[#06b6d4] rounded text-cyan-300">
                    {k}
                  </kbd>
                  {idx < activeShortcut.keys.length - 1 && (
                    <span className="text-slate-500 font-bold">+</span>
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="border-l border-[#1e293b] pl-3">
              <div className="text-xs font-bold text-white">{activeShortcut.action}</div>
              <div className="text-[11px] font-mono text-[#06b6d4]">{activeShortcut.category}</div>
            </div>
          </div>
        </div>

        {/* Scaled Interactive 87-Key Chassis Showing Highlighted Fn + Target Keys */}
        <div
          className="relative mx-auto bg-[#070a12] border-2 border-[#1e293b] rounded-2xl p-3"
          style={{ width: '900px', height: '332px' }}
        >
          {/* Embedded Mini TFT Screen Indicator */}
          <div
            className={`absolute rounded-lg border flex flex-col items-center justify-center text-center p-1 transition-all ${
              activeShortcut.category === 'Screen'
                ? 'bg-[#06b6d4]/25 border-2 border-[#06b6d4] shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                : 'bg-black border-[#1e293b]'
            }`}
            style={{
              left: `${12 + 15.25 * 46.5}px`,
              top: `${12 + 3.35 * 46.5}px`,
              width: `${2 * 46.5 - 4}px`,
              height: `${46.5 - 4}px`,
            }}
          >
            <span className="text-[8px] font-mono font-bold text-[#06b6d4]">240×135 TFT</span>
            <span className="text-[8px] font-mono text-slate-300">
              MODE {configState.activeScreenMode}
            </span>
          </div>

          {GMK87_PHYSICAL_KEYS.map((k) => {
            if (k.isKnob) return null;
            const isHighlighted = highlightedKeyIds.has(k.id);
            const isFnKey = k.id === 'r5c10';
            const unitPx = 46.5;
            const gapPx = 4;

            return (
              <div
                key={k.id}
                style={{
                  left: `${12 + k.x * unitPx}px`,
                  top: `${12 + k.y * unitPx}px`,
                  width: `${k.w * unitPx - gapPx}px`,
                  height: `${(k.h ?? 1) * unitPx - gapPx}px`,
                }}
                className={`absolute rounded-md p-1 flex flex-col justify-between transition-all duration-150 select-none ${
                  isHighlighted
                    ? isFnKey
                      ? 'bg-[#8b5cf6] border-2 border-white text-white shadow-[0_0_18px_rgba(139,92,246,0.85)] z-20 scale-105'
                      : 'bg-[#06b6d4] border-2 border-white text-slate-950 shadow-[0_0_18px_rgba(6,182,212,0.85)] z-20 scale-105'
                    : 'bg-[#131b2e]/90 border border-[#1e293b] text-slate-400 opacity-65'
                }`}
              >
                <div className="flex items-center justify-between text-[8px] font-mono leading-none">
                  <span className="truncate font-bold">{k.label}</span>
                  <span className="opacity-75">
                    {k.row},{k.col}
                  </span>
                </div>
                {isHighlighted && (
                  <div className="text-[8px] font-mono font-extrabold uppercase truncate">
                    {isFnKey ? 'HOLD FN' : 'PRESS'}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filterable Shortcut Reference Table with Interactive Hover & USB Trigger */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">
              Complete GMK87 Hardware Fn Combination Matrix ({filteredShortcuts.length} Shortcuts)
            </h3>
            <p className="text-xs text-slate-400">
              Hover any row to locate the keys on the 87-key diagram above, or click{' '}
              <strong className="text-cyan-300">Trigger USB</strong> on supported firmware actions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={shortcutQuery}
                onChange={(e) => setShortcutQuery(e.target.value)}
                placeholder="Filter shortcuts (e.g. Bluetooth, Reset, Screen)..."
                className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-60"
              />
            </div>

            <div className="inline-flex rounded-lg bg-[#0b0f19] p-1 border border-[#1e293b]">
              {(['All', 'Screen', 'Wireless', 'Lighting', 'System'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setShortcutCat(cat)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                    shortcutCat === cat
                      ? 'bg-[#06b6d4] text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1e293b] text-[11px] font-mono text-slate-400">
                <th className="py-3 px-4">CATEGORY</th>
                <th className="py-3 px-4">KEY COMBINATION</th>
                <th className="py-3 px-4">HARDWARE FUNCTION</th>
                <th className="py-3 px-4">PROTOCOL / FIRMWARE BEHAVIOR</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1e293b] text-xs">
              {filteredShortcuts.map((item) => {
                const isSelected = item.id === activeShortcutId;
                const usbSupported = canSimulateUsb(item.id);
                return (
                  <tr
                    key={item.id}
                    onMouseEnter={() => setActiveShortcutId(item.id)}
                    onClick={() => setActiveShortcutId(item.id)}
                    className={`transition-colors cursor-pointer ${
                      isSelected ? 'bg-[#06b6d4]/10' : 'hover:bg-[#0b0f19]/60'
                    }`}
                  >
                    <td className="py-3.5 px-4 font-mono text-[#06b6d4] whitespace-nowrap">
                      {item.category}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {item.keys.map((k, idx) => (
                          <React.Fragment key={k}>
                            <kbd className="px-2 py-1 text-[11px] font-mono font-bold bg-[#0b0f19] border border-slate-700 rounded text-cyan-300 shadow-inner">
                              {k}
                            </kbd>
                            {idx < item.keys.length - 1 && (
                              <span className="text-slate-500">+</span>
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-white">{item.action}</td>
                    <td className="py-3.5 px-4 text-slate-400 leading-relaxed">{item.details}</td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {usbSupported ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExecuteShortcut(item);
                          }}
                          className="px-2.5 py-1 text-[11px] font-mono font-semibold rounded bg-[#06b6d4]/20 border border-[#06b6d4] text-[#06b6d4] hover:bg-[#06b6d4] hover:text-slate-950 transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          Trigger USB
                        </button>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-500">MCU Hardware</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Live Dual-Interface USB HID Protocol Packet Decoder */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[#8b5cf6]" />
            <h3 className="text-sm font-bold text-white">
              Live Dual-Interface 64-Byte USB HID Packet Inspector (`0xFF1C` LCD & `0xFF60` VIA)
            </h3>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(
                `LCD (0xFF1C): ${lastLcdPacketHex}\nVIA (0xFF60): ${lastViaPacketHex}`
              );
              setCopiedHex(true);
              setTimeout(() => setCopiedHex(false), 1800);
            }}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] flex items-center gap-1.5 cursor-pointer"
          >
            {copiedHex ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#10b981]" /> Copied Packet Trace
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#06b6d4]" /> Copy Packet Trace
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs font-mono">
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[#06b6d4] font-bold">
                INTERFACE 1: LCD & RGB ENGINE (usagePage 0xFF1C · Report 0x04)
              </span>
              <span>64 Bytes</span>
            </div>
            <div className="p-2.5 rounded bg-[#131b2e] border border-[#1e293b] text-cyan-300 break-all">
              {lastLcdPacketHex}
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-400 pt-1">
              <div>
                <span className="text-slate-500">Byte 0:</span> 0x04 Report
              </div>
              <div>
                <span className="text-slate-500">Bytes 1..2:</span> LE16 Sum
              </div>
              <div>
                <span className="text-slate-500">Byte 3:</span> Cmd ID
              </div>
              <div>
                <span className="text-slate-500">Bytes 8..63:</span> 56B Payload
              </div>
            </div>
          </div>

          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-[#8b5cf6] font-bold">
                INTERFACE 2: QMK/VIA KEYMAP ENGINE (usagePage 0xFF60 · Report 0x00)
              </span>
              <span>32 Bytes</span>
            </div>
            <div className="p-2.5 rounded bg-[#131b2e] border border-[#1e293b] text-purple-300 break-all">
              {lastViaPacketHex}
            </div>
            <div className="grid grid-cols-4 gap-2 text-[10px] text-slate-400 pt-1">
              <div>
                <span className="text-slate-500">0x01:</span> Get Proto
              </div>
              <div>
                <span className="text-slate-500">0x05:</span> Set Keycode
              </div>
              <div>
                <span className="text-slate-500">0x12:</span> Read Buffer
              </div>
              <div>
                <span className="text-slate-500">Matrix:</span> 4×8×15 (960B)
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
