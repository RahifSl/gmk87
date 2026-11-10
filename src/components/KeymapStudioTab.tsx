import React, { useState, useEffect } from 'react';
import {
  Layers,
  RefreshCw,
  Download,
  Upload,
  Palette,
  Disc,
  Search,
  Sparkles,
  Terminal,
  Save,
} from 'lucide-react';
import {
  LCD_WIDTH,
  LCD_HEIGHT,
  Gmk87ConfigState,
  ViaMacroReadResult,
} from '../services/gmk87Hid';
import {
  GMK87_PHYSICAL_KEYS,
  KEYCODE_CATALOG,
  KeycodeItem,
  getKeycodeLabel,
  createDefaultKeymap,
} from '../data/gmk87KeymapData';
import {
  GMK87_ALL_19_RGB_MODES,
  KeyRippleEvent,
  computePerKeyShader,
  computeChassisUnderglowVisuals,
  computeLogoBarVisual,
} from '../data/rgbStudioData';
import {
  KeycapThemeId,
  GMK_KEYCAP_THEMES,
  KATAKANA_SUBLEGENDS,
  CYBER_MOD_GLYPHS,
  SMART_KNOB_MODES,
  SmartKnobMode,
} from '../data/studioPresets';

export interface KeymapStudioTabProps {
  keymap: number[][][];
  defaultKeymap: number[][][];
  activeLayer: number;
  onChangeLayer: (layer: number) => void;
  selectedKeyId: string;
  onSelectKeyId: (id: string) => void;
  viaProtocol: number;
  pressedKeyIds: Set<string>;
  actuationCount: number;
  liveWpm: number;
  configState: Gmk87ConfigState;
  activeKnobModeId: string;
  inChassisCanvasRef: React.RefObject<HTMLCanvasElement | null>;
  onAssignKeycode: (code: number, targetKeyIdOverride?: string) => Promise<void>;
  onBatchApplyKeymap: (nextKeymap: number[][][], themeHint?: KeycapThemeId, label?: string) => Promise<void>;
  onReadViaBuffer: () => Promise<void>;
  onReadViaMacros: () => Promise<ViaMacroReadResult>;
  onWriteViaMacros: (macros: string[]) => Promise<{
    success: boolean;
    writtenMacros: number;
    bufferSize: number;
    error?: string;
  }>;
  onSelectSmartKnobMode: (mode: SmartKnobMode) => Promise<void>;
  onOpenRgbStudio: () => void;
  onOpenGifsTab: () => void;
  onStatusLog: (msg: string) => void;
}

export default function KeymapStudioTab({
  keymap,
  defaultKeymap,
  activeLayer,
  onChangeLayer,
  selectedKeyId,
  onSelectKeyId,
  viaProtocol,
  pressedKeyIds,
  actuationCount,
  liveWpm,
  configState,
  activeKnobModeId,
  inChassisCanvasRef,
  onAssignKeycode,
  onBatchApplyKeymap,
  onReadViaBuffer,
  onReadViaMacros,
  onWriteViaMacros,
  onSelectSmartKnobMode,
  onOpenRgbStudio,
  onOpenGifsTab,
  onStatusLog,
}: KeymapStudioTabProps) {
  const [activeKeyCategory, setActiveKeyCategory] =
    useState<KeycodeItem['category']>('Media & Knob');
  const [keycodeSearchQuery, setKeycodeSearchQuery] = useState<string>('');
  const [knobAngleDeg, setKnobAngleDeg] = useState<number>(0);
  const [rgbPreviewEnabled, setRgbPreviewEnabled] = useState<boolean>(true);
  const [tab1AnimTimeSec, setTab1AnimTimeSec] = useState<number>(0);
  const [tab1Ripples, setTab1Ripples] = useState<KeyRippleEvent[]>([]);
  const [keycapThemeId, setKeycapThemeId] = useState<KeycapThemeId>('cyberpunk');
  const [dragOverKeyId, setDragOverKeyId] = useState<string | null>(null);

  // VIA Dynamic Macros Inspector (0x0C..0x0F)
  const [showMacroPanel, setShowMacroPanel] = useState<boolean>(false);
  const [macroResult, setMacroResult] = useState<ViaMacroReadResult | null>(null);
  const [macroDrafts, setMacroDrafts] = useState<string[]>([]);
  const [macroBusy, setMacroBusy] = useState<boolean>(false);

  // Register physical keystrokes into Tab 1 ripple queue while mounted
  useEffect(() => {
    if (pressedKeyIds.size === 0) return;
    const now = performance.now();
    const added: KeyRippleEvent[] = [];
    pressedKeyIds.forEach((id) => {
      const k = GMK87_PHYSICAL_KEYS.find((item) => item.id === id);
      if (k) {
        added.push({
          x: k.x + k.w / 2,
          y: k.y + (k.h ?? 1) / 2,
          row: k.row,
          col: k.col,
          timestamp: now,
        });
      }
    });
    if (added.length > 0) {
      setTab1Ripples((prev) =>
        [...prev.filter((r) => now - r.timestamp < 1600), ...added].slice(-24)
      );
    }
  }, [pressedKeyIds]);

  // Animate South-Facing RGB & Logo Light Bar shader only while mounted, visible, and enabled
  useEffect(() => {
    const perKeyActive = configState.lightingEffect !== 0 && configState.brightness > 0;
    const logoActive =
      (configState.logoBrightness ?? 9) > 0 &&
      (Boolean(configState.logoRainbow) || (configState.logoColor ?? 0) !== 8);
    if (!rgbPreviewEnabled || (!perKeyActive && !logoActive)) {
      return;
    }
    const start = performance.now();
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setTab1AnimTimeSec((performance.now() - start) / 1000);
    }, 55);
    return () => clearInterval(timer);
  }, [
    rgbPreviewEnabled,
    configState.lightingEffect,
    configState.brightness,
    configState.logoBrightness,
    configState.logoRainbow,
    configState.logoColor,
  ]);

  const handleLoadViaMacros = async () => {
    setMacroBusy(true);
    try {
      const res = await onReadViaMacros();
      setMacroResult(res);
      setMacroDrafts(res.macros || []);
      onStatusLog(
        res.supported
          ? `VIA Macros (0x0C..0x0E): Loaded ${res.count} slots (${res.bufferSize}B EEPROM buffer)`
          : res.error || `Firmware reported ${res.count} VIA dynamic macro slots`
      );
    } finally {
      setMacroBusy(false);
    }
  };

  const handleSaveViaMacros = async () => {
    setMacroBusy(true);
    try {
      const res = await onWriteViaMacros(macroDrafts);
      onStatusLog(
        res.success
          ? `VIA Macros (0x0F): Saved ${res.writtenMacros} macro(s) into ${res.bufferSize}B EEPROM`
          : `VIA Macro write skipped: ${res.error || 'Unsupported on stock V0104 firmware'}`
      );
    } finally {
      setMacroBusy(false);
    }
  };

  const handleExportKeymapProfile = () => {
    const payload = {
      app: 'GMK87 Master Control Center',
      device: 'Zuoya GMK87 (0x320F:0x5055)',
      exportedAt: new Date().toISOString(),
      viaProtocol,
      keycapThemeId,
      keymap,
      configState,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zuoya-gmk87-profile-${new Date().toISOString().slice(0, 10)}.gmk87.json`;
    a.click();
    URL.revokeObjectURL(url);
    onStatusLog('Exported 4-layer VIA keymap & hardware lighting profile (.gmk87.json).');
  };

  const handleImportKeymapProfile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed.keymap) && parsed.keymap.length === 4) {
        const themeHint =
          parsed.keycapThemeId && GMK_KEYCAP_THEMES[parsed.keycapThemeId as KeycapThemeId]
            ? (parsed.keycapThemeId as KeycapThemeId)
            : undefined;
        if (themeHint) {
          setKeycapThemeId(themeHint);
        }
        await onBatchApplyKeymap(parsed.keymap, themeHint, `Profile "${file.name}"`);
      } else {
        onStatusLog(`Invalid .gmk87.json file "${file.name}" — missing 4-layer keymap matrix.`);
      }
    } catch (err: any) {
      onStatusLog(`Failed to parse profile "${file.name}": ${err?.message || 'Invalid JSON'}`);
    }
  };

  const selectedKeyDef =
    GMK87_PHYSICAL_KEYS.find((k) => k.id === selectedKeyId) || GMK87_PHYSICAL_KEYS[0];
  const currentSelectedKeycode =
    keymap[activeLayer]?.[selectedKeyDef.row]?.[selectedKeyDef.col] ?? 0;

  const activeLayerModifiedCount = GMK87_PHYSICAL_KEYS.reduce((acc, k) => {
    const cur = keymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
    const def = defaultKeymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
    return cur !== def ? acc + 1 : acc;
  }, 0);

  const activeKeycapTheme = GMK_KEYCAP_THEMES[keycapThemeId];

  const tab1ActiveModeDef =
    GMK87_ALL_19_RGB_MODES.find((m) => m.id === configState.lightingEffect) ||
    GMK87_ALL_19_RGB_MODES[0];

  const tab1Underglow = rgbPreviewEnabled
    ? computeChassisUnderglowVisuals({
        effect: configState.lightingEffect,
        brightness: configState.brightness,
        speed: configState.speed,
        direction: configState.effectDirection ?? 0,
        rainbow: configState.rainbowMode ?? 0,
        baseR: configState.rgbHueR,
        baseG: configState.rgbHueG,
        baseB: configState.rgbHueB,
        timeSec: tab1AnimTimeSec,
        ripples: tab1Ripples,
      })
    : computeChassisUnderglowVisuals({
        effect: 0,
        brightness: 0,
        speed: configState.speed,
        direction: configState.effectDirection ?? 0,
        rainbow: configState.rainbowMode ?? 0,
        baseR: configState.rgbHueR,
        baseG: configState.rgbHueG,
        baseB: configState.rgbHueB,
        timeSec: 0,
        ripples: [],
      });

  const tab1LogoVisual = rgbPreviewEnabled
    ? computeLogoBarVisual({
        logoMode: configState.logoMode,
        logoBrightness: configState.logoBrightness,
        logoRainbow: configState.logoRainbow,
        logoColor: configState.logoColor,
        timeSec: tab1AnimTimeSec,
      })
    : computeLogoBarVisual({
        logoMode: configState.logoMode,
        logoBrightness: 0,
        logoRainbow: 0,
        logoColor: 8,
        timeSec: 0,
      });

  return (
    <div className="space-y-5">
      {/* Top Bar: Layer Switcher, VIA Tools & Profile Export/Import */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-mono text-slate-400 mr-1 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-[#06b6d4]" />
            LAYER:
          </span>
          {[
            { idx: 0, name: 'Layer 0 Win Base' },
            { idx: 1, name: 'Layer 1 Win Fn' },
            { idx: 2, name: 'Layer 2 Mac Base' },
            { idx: 3, name: 'Layer 3 Mac Fn' },
          ].map((layer) => (
            <button
              key={layer.idx}
              onClick={() => onChangeLayer(layer.idx)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap cursor-pointer ${
                activeLayer === layer.idx
                  ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                  : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#06b6d4]/60'
              }`}
            >
              {layer.name}
            </button>
          ))}

          {activeLayerModifiedCount > 0 && (
            <span className="px-2.5 py-1 text-[11px] font-mono rounded-lg bg-[#10b981]/15 border border-[#10b981]/50 text-[#10b981]">
              {activeLayerModifiedCount} Modified Key{activeLayerModifiedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="px-2.5 py-1.5 text-[11px] font-mono rounded-lg bg-[#8b5cf6]/15 border border-[#8b5cf6]/40 text-purple-200">
            VIA P{viaProtocol}
          </span>
          <button
            type="button"
            onClick={() => {
              const next = !showMacroPanel;
              setShowMacroPanel(next);
              if (next && !macroResult) {
                void handleLoadViaMacros();
              }
            }}
            className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showMacroPanel
                ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white'
                : 'bg-[#0b0f19] border-[#1e293b] text-purple-200 hover:border-[#8b5cf6]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Macros (0x0C)
          </button>
          <button
            onClick={onReadViaBuffer}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#06b6d4]" />
            Read 960B (0x12)
          </button>
          <button
            onClick={handleExportKeymapProfile}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Export .gmk87.json
          </button>
          <label className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#8b5cf6] transition-colors flex items-center gap-1.5 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-[#8b5cf6]" />
            Import Profile
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleImportKeymapProfile}
              className="hidden"
            />
          </label>
          <button
            onClick={() => onBatchApplyKeymap(createDefaultKeymap(), undefined, 'Factory Default')}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Reset Default
          </button>
        </div>
      </div>

      {/* Expandable VIA Dynamic Macros Drawer (0x0C..0x0F) */}
      {showMacroPanel && (
        <div className="bg-[#131b2e] border border-[#8b5cf6]/50 rounded-xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Terminal className="w-4 h-4 text-[#8b5cf6]" />
                VIA Dynamic Macro Probe & Editor (Opcodes 0x0C – 0x0F)
              </h3>
              <p className="text-xs text-slate-400">
                Reads hardware macro slot count (0x0C) and EEPROM buffer size (0x0D) from your
                connected GMK87.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={macroBusy}
                onClick={handleLoadViaMacros}
                className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] disabled:opacity-50 cursor-pointer"
              >
                {macroBusy ? 'Probing...' : 'Probe Hardware Macros'}
              </button>
              {macroResult?.supported && (
                <button
                  type="button"
                  disabled={macroBusy}
                  onClick={handleSaveViaMacros}
                  className="px-3 py-1.5 text-xs font-mono font-semibold rounded-lg bg-[#10b981] text-slate-950 hover:bg-emerald-400 disabled:opacity-50 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  Write Macros (0x0F)
                </button>
              )}
            </div>
          </div>

          {!macroResult ? (
            <div className="text-xs font-mono text-slate-400">Probing 0xFF60 VIA interface...</div>
          ) : !macroResult.supported ? (
            <div className="rounded-lg bg-[#0b0f19] border border-[#1e293b] p-3.5 text-xs font-mono text-amber-300">
              Hardware response: {macroResult.count} macro slots / {macroResult.bufferSize}B buffer
              {macroResult.error ? ` (${macroResult.error})` : ''}. Stock GMK87 firmware reserves
              VIA for 4×8×15 dynamic keycodes (0x05 / 0x12).
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {macroDrafts.map((val, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5"
                >
                  <label className="block text-[10px] font-mono text-[#8b5cf6] font-bold">
                    MACRO M{idx}
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) =>
                      setMacroDrafts((prev) => prev.map((m, i) => (i === idx ? e.target.value : m)))
                    }
                    placeholder="Empty ASCII macro..."
                    className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Keycap Colorway Theme Selector + Embedded Quick Smart Rotary Knob Mode Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-[#131b2e] border border-[#1e293b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-[#06b6d4]" />
            GMK KEYCAP COLORWAY:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {(Object.keys(GMK_KEYCAP_THEMES) as KeycapThemeId[]).map((tid) => {
              const th = GMK_KEYCAP_THEMES[tid];
              const active = keycapThemeId === tid;
              return (
                <button
                  key={tid}
                  type="button"
                  onClick={() => setKeycapThemeId(tid)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg border flex items-center gap-1.5 transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#0b0f19] border-[#06b6d4] text-white'
                      : 'bg-[#0b0f19]/60 border-[#1e293b] text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: th.badge }} />
                  {th.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-[#131b2e] border border-[#1e293b] rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
            <Disc className="w-3.5 h-3.5 text-[#8b5cf6]" />
            ROTARY KNOB ENGINE:
          </span>
          <div className="flex flex-wrap items-center gap-1">
            {SMART_KNOB_MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectSmartKnobMode(m)}
                className={`px-2 py-1 text-[11px] font-mono rounded-lg border transition-colors cursor-pointer ${
                  activeKnobModeId === m.id
                    ? 'bg-[#8b5cf6] border-[#8b5cf6] text-white font-bold'
                    : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#8b5cf6]'
                }`}
              >
                {m.title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Interactive 87-Key Physical TKL + Embedded Live 240x135 TFT + CNC Rotary Knob Deck */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              Zuoya GMK87 Physical Chassis (8 Rows × 15 Cols · Click or Drag-and-Drop Keycodes)
            </h2>
            <p className="text-xs text-slate-400">
              Press keys on your physical keyboard for live NKRO switch testing, click or drag any
              keycode onto a keycap, or click the embedded 240×135 TFT screen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setRgbPreviewEnabled((v) => !v)}
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                rgbPreviewEnabled
                  ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-purple-200'
                  : 'bg-[#0b0f19] border-[#1e293b] text-slate-400'
              }`}
            >
              South-Facing RGB Glow: {rgbPreviewEnabled ? 'ON' : 'OFF'}
            </button>

            <button
              type="button"
              onClick={onOpenRgbStudio}
              title="Open RGB & Underglow Studio to customize effects, brightness, color & Logo LED bar"
              className={`px-3 py-1.5 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
                configState.lightingEffect === 0 || configState.brightness <= 0
                  ? 'bg-[#f59e0b]/15 border-[#f59e0b]/50 text-amber-300 hover:border-[#f59e0b]'
                  : 'bg-[#0b0f19] border-[#06b6d4]/50 text-cyan-300 hover:border-[#06b6d4]'
              }`}
            >
              {configState.lightingEffect === 0 || configState.brightness <= 0
                ? `HW RGB OFF (${configState.lightingEffect === 0 ? '0x00' : 'Bri 0/4'}) · RGB Studio →`
                : `${tab1ActiveModeDef.name} · Bri ${configState.brightness}/4 →`}
            </button>

            <div className="text-xs font-mono bg-[#0b0f19] border border-[#1e293b] px-3 py-1.5 rounded-lg text-slate-300">
              NKRO Tester:{' '}
              <span className="text-[#10b981] font-bold">{actuationCount} presses</span> ·{' '}
              <span className="text-[#06b6d4] font-bold">{liveWpm} WPM</span>
            </div>

            <div className="text-xs font-mono bg-[#0b0f19] border border-[#1e293b] px-3.5 py-1.5 rounded-lg">
              Selected: <span className="text-[#06b6d4] font-bold">{selectedKeyDef.label}</span> ·{' '}
              <span className="text-[#8b5cf6]">
                [{selectedKeyDef.row},{selectedKeyDef.col}]
              </span>{' '}
              →{' '}
              <span className="text-[#10b981] font-bold">
                {getKeycodeLabel(currentSelectedKeycode, viaProtocol)}
              </span>
            </div>
          </div>
        </div>

        {/* Physical Gasket-Mount Keyboard Chassis with Dynamic RGB Underglow */}
        <div className="w-full overflow-x-auto py-8 px-6 flex justify-center bg-[#070a12]/70 rounded-2xl border border-[#1e293b]/80">
          <div
            className="relative shrink-0 bg-gradient-to-b from-[#0a0e18] via-[#070910] to-[#04060b] border-2 rounded-2xl p-4 transition-[border-color] duration-150 select-none"
            style={{
              width: '1040px',
              height: '386px',
              borderColor: tab1Underglow.borderColor,
              boxShadow: tab1Underglow.boxShadow,
            }}
          >
            {/* 360° Perimeter Side Underglow Diffuser Light Strips */}
            <div
              className="absolute -top-1.5 left-10 right-10 h-1.5 rounded-full pointer-events-none"
              style={{
                background: tab1Underglow.topGradient,
                opacity: tab1Underglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />
            <div
              className="absolute -bottom-1.5 left-10 right-10 h-1.5 rounded-full pointer-events-none"
              style={{
                background: tab1Underglow.bottomGradient,
                opacity: tab1Underglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />
            <div
              className="absolute top-8 bottom-8 -left-1.5 w-1.5 rounded-full pointer-events-none"
              style={{
                background: tab1Underglow.leftGradient,
                opacity: tab1Underglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />
            <div
              className="absolute top-8 bottom-8 -right-1.5 w-1.5 rounded-full pointer-events-none"
              style={{
                background: tab1Underglow.rightGradient,
                opacity: tab1Underglow.stripOpacity,
                filter: 'blur(2px)',
              }}
            />

            {/* 4 CNC Gasket Mounting Hex Bolts */}
            <div
              className="absolute top-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none"
              title="Anodized Gasket Mount Bolt"
            >
              ⬡
            </div>
            <div
              className="absolute top-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none"
              title="Anodized Gasket Mount Bolt"
            >
              ⬡
            </div>
            <div
              className="absolute bottom-2.5 left-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none"
              title="Anodized Gasket Mount Bolt"
            >
              ⬡
            </div>
            <div
              className="absolute bottom-2.5 right-2.5 w-4 h-4 rounded-full bg-[#182030] gasket-screw border border-[#2b3952] flex items-center justify-center text-[7px] text-slate-500 font-mono select-none"
              title="Anodized Gasket Mount Bolt"
            >
              ⬡
            </div>

            {/* Technical Engraved Legend */}
            <div className="absolute bottom-2.5 right-12 text-[8px] font-mono tracking-widest text-slate-600 select-none uppercase pointer-events-none">
              ZUOYA GMK87 // GASKET FR4 // 1000HZ NKRO // VIA P{viaProtocol} // 0xFF1C TFT
            </div>

            {/* Interactive Metallic CNC Rotary Knob Dial Overlay */}
            <div
              className="absolute flex flex-col items-center gap-1 z-20"
              style={{
                left: `${16 + 17.3 * 54}px`,
                top: '12px',
              }}
            >
              <div className="relative group flex items-center justify-center">
                <div
                  onClick={() => onSelectKeyId('r0c14')}
                  title="Zuoya GMK87 CNC Knurled Aluminum Rotary Encoder (Push Click: MUTE / Rotate: VOL)"
                  className="w-12 h-12 rounded-full knurled-dial border-2 border-[#06b6d4] shadow-[0_6px_20px_rgba(0,0,0,0.85)] flex items-center justify-center cursor-pointer active:scale-95 transition-transform duration-75"
                  style={{ transform: `rotate(${knobAngleDeg}deg)` }}
                >
                  <div className="absolute inset-1 rounded-full border border-slate-600/40 flex items-center justify-center">
                    <div className="w-1.5 h-3.5 bg-[#06b6d4] rounded-full shadow-[0_0_8px_rgba(6,182,212,0.9)] -translate-y-2.5" />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  title="Rotate Counter-Clockwise (Vol -)"
                  onClick={() => {
                    setKnobAngleDeg((a) => a - 24);
                    onSelectKeyId('r7c0');
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
                >
                  ↺
                </button>
                <button
                  type="button"
                  title="Push Encoder Switch (Mute)"
                  onClick={() => onSelectKeyId('r0c14')}
                  className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-slate-300 hover:text-white cursor-pointer"
                >
                  ●
                </button>
                <button
                  type="button"
                  title="Rotate Clockwise (Vol +)"
                  onClick={() => {
                    setKnobAngleDeg((a) => a + 24);
                    onSelectKeyId('r7c1');
                  }}
                  className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
                >
                  ↻
                </button>
              </div>
            </div>

            {/* Live Synchronized 240×135 TFT LCD Screen Embedded Inside Chassis */}
            <div
              onClick={onOpenGifsTab}
              title="Embedded 240×135 RGB565 Color TFT Screen — Click to open 240×135 Screen Studio"
              className="absolute rounded-lg bg-black border-2 border-[#06b6d4]/80 overflow-hidden cursor-pointer group z-10 shadow-lg ring-1 ring-cyan-500/30"
              style={{
                left: `${16 + 15.35 * 54}px`,
                top: '12px',
                width: '96px',
                height: '54px',
              }}
            >
              <canvas
                ref={inChassisCanvasRef}
                width={LCD_WIDTH}
                height={LCD_HEIGHT}
                className="w-full h-full object-cover pixelated-canvas block"
              />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-mono text-[#06b6d4] font-bold">
                240×135 TFT
              </div>
            </div>

            {/* GMK87 Signature Hardware RGB LED Strip Bar in Nav Cluster (cfg[28..32]) */}
            <button
              type="button"
              onClick={onOpenRgbStudio}
              className="absolute flex items-center justify-center select-none cursor-pointer"
              style={{
                left: `${16 + 15.25 * 54}px`,
                top: `${16 + 3.45 * 54}px`,
                width: `${3 * 54 - 5}px`,
                height: '24px',
              }}
              title={`${tab1LogoVisual.title} — Click to customize in RGB Studio`}
            >
              <span
                className="w-full h-3.5 rounded-full border border-white/45 transition-opacity duration-75 block"
                style={{
                  background: tab1LogoVisual.background,
                  boxShadow: tab1LogoVisual.boxShadow,
                  opacity: tab1LogoVisual.opacity,
                }}
              />
            </button>

            {GMK87_PHYSICAL_KEYS.map((k) => {
              if (k.isKnob) return null;
              const assignedCode = keymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
              const defaultCode = defaultKeymap[activeLayer]?.[k.row]?.[k.col] ?? 0;
              const isModifiedFromDefault = assignedCode !== defaultCode;
              const codeLabel = getKeycodeLabel(assignedCode, viaProtocol);
              const isSelected = selectedKeyId === k.id;
              const isPhysicallyPressed = pressedKeyIds.has(k.id);
              const isDragTarget = dragOverKeyId === k.id;
              const unitPx = 54;
              const gapPx = 5;

              const isCyberpunk = keycapThemeId === 'cyberpunk';
              const isSpacebar = k.id === 'r5c6';
              const isEnter = k.id === 'r3c13';
              const isBackspace = k.id === 'r1c13';
              const isEsc = k.id === 'r0c0';
              const isPrtSc = k.id === 'r0c13';
              const isArrow =
                k.id === 'r4c13' || k.id === 'r6c12' || k.id === 'r5c13' || k.id === 'r6c13';
              const isFRowYellow =
                k.id === 'r0c1' ||
                k.id === 'r0c2' ||
                k.id === 'r0c3' ||
                k.id === 'r0c4' ||
                k.id === 'r0c9' ||
                k.id === 'r0c10' ||
                k.id === 'r0c11' ||
                k.id === 'r0c12';
              const isFRowCyan =
                k.id === 'r0c5' || k.id === 'r0c6' || k.id === 'r0c7' || k.id === 'r0c8';
              const isModKey = k.w > 1.15 || k.row === 0 || k.col >= 13;

              let themeCapClass = activeKeycapTheme.alphaClass;
              if (isCyberpunk) {
                if (isSpacebar) {
                  themeCapClass =
                    'bg-[#facc15] border border-[#fde047] text-slate-950 font-black shadow-[0_2px_12px_rgba(250,204,21,0.5)]';
                } else if (isEnter) {
                  themeCapClass =
                    'bg-gradient-to-b from-[#dc2626] to-[#991b1b] border border-red-400 text-white font-black shadow-[0_2px_12px_rgba(239,68,68,0.45)]';
                } else if (isBackspace) {
                  themeCapClass =
                    'bg-gradient-to-b from-[#0891b2] to-[#0e7490] border border-cyan-300 text-cyan-100 font-bold shadow-[0_2px_10px_rgba(6,182,212,0.4)]';
                } else if (isEsc) {
                  themeCapClass =
                    'bg-gradient-to-b from-[#dc2626] to-[#991b1b] border border-red-400 text-white font-bold shadow-[0_0_10px_rgba(239,68,68,0.5)]';
                } else if (isArrow) {
                  themeCapClass = 'bg-[#0a0d16] border border-[#232c40] text-red-500 font-black';
                } else if (isFRowCyan || isPrtSc) {
                  themeCapClass = 'bg-[#0d121e] border border-[#1e2a3e] text-cyan-400 font-bold';
                } else if (isFRowYellow) {
                  themeCapClass = 'bg-[#0d121e] border border-[#1e2a3e] text-yellow-400 font-bold';
                } else if (isModKey) {
                  themeCapClass = activeKeycapTheme.modClass;
                }
              } else {
                const isAccentKey = isEsc || isEnter || isArrow;
                themeCapClass = isAccentKey
                  ? activeKeycapTheme.accentClass
                  : isModKey
                  ? activeKeycapTheme.modClass
                  : activeKeycapTheme.alphaClass;
              }

              const katakanaChar = KATAKANA_SUBLEGENDS[k.label];
              const cyberGlyph = CYBER_MOD_GLYPHS[k.id];

              const tab1KeyGlowActive =
                rgbPreviewEnabled && configState.lightingEffect !== 0 && configState.brightness > 0;
              const tab1Shade = tab1KeyGlowActive
                ? computePerKeyShader({
                    keyX: k.x + k.w / 2,
                    keyY: k.y + (k.h ?? 1) / 2,
                    row: k.row,
                    col: k.col,
                    effect: configState.lightingEffect,
                    brightness: configState.brightness,
                    speed: configState.speed,
                    direction: configState.effectDirection ?? 0,
                    rainbow: configState.rainbowMode ?? 0,
                    baseR: configState.rgbHueR,
                    baseG: configState.rgbHueG,
                    baseB: configState.rgbHueB,
                    timeSec: tab1AnimTimeSec,
                    ripples: tab1Ripples,
                  })
                : null;
              const keyHasEmission = Boolean(tab1Shade && tab1Shade.alpha > 0.01);
              const dishBaseShadow = isPhysicallyPressed
                ? '0 1px 0 #05080f, 0 2px 4px rgba(0,0,0,0.9)'
                : '0 4px 0 #05080f, 0 7px 14px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.22)';
              const southLedShadow =
                tab1Shade && keyHasEmission
                  ? `, 0 5px 14px rgba(${tab1Shade.r}, ${tab1Shade.g}, ${tab1Shade.b}, ${Math.min(
                      0.92,
                      tab1Shade.alpha * 0.85
                    ).toFixed(3)}), 0 0 8px rgba(${tab1Shade.r}, ${tab1Shade.g}, ${
                      tab1Shade.b
                    }, ${(tab1Shade.alpha * 0.45).toFixed(
                      3
                    )}), inset 0 -3px 6px rgba(${tab1Shade.r}, ${tab1Shade.g}, ${
                      tab1Shade.b
                    }, ${Math.min(0.75, tab1Shade.alpha * 0.65).toFixed(3)})`
                  : '';

              return (
                <button
                  key={k.id}
                  onClick={() => {
                    onSelectKeyId(k.id);
                    const now = performance.now();
                    setTab1Ripples((prev) =>
                      [
                        ...prev.filter((r) => now - r.timestamp < 1600),
                        {
                          x: k.x + k.w / 2,
                          y: k.y + (k.h ?? 1) / 2,
                          row: k.row,
                          col: k.col,
                          timestamp: now,
                        },
                      ].slice(-24)
                    );
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (dragOverKeyId !== k.id) setDragOverKeyId(k.id);
                  }}
                  onDragLeave={() => {
                    if (dragOverKeyId === k.id) setDragOverKeyId(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKeyId(null);
                    const rawCode = Number(e.dataTransfer.getData('text/plain'));
                    if (Number.isFinite(rawCode) && rawCode >= 0) {
                      void onAssignKeycode(rawCode, k.id);
                    }
                  }}
                  style={{
                    left: `${16 + k.x * unitPx}px`,
                    top: `${16 + k.y * unitPx}px`,
                    width: `${k.w * unitPx - gapPx}px`,
                    height: `${(k.h ?? 1) * unitPx - gapPx}px`,
                    boxShadow: keyHasEmission ? `${dishBaseShadow}${southLedShadow}` : undefined,
                    borderBottomColor:
                      keyHasEmission &&
                      tab1Shade &&
                      !isSelected &&
                      !isPhysicallyPressed &&
                      !isDragTarget
                        ? `rgb(${tab1Shade.r}, ${tab1Shade.g}, ${tab1Shade.b})`
                        : undefined,
                    outline:
                      isSelected && keyHasEmission
                        ? '2px solid rgba(6, 182, 212, 0.7)'
                        : undefined,
                    outlineOffset: isSelected && keyHasEmission ? '1px' : undefined,
                  }}
                  className={`absolute rounded-[6px] p-1.5 flex flex-col justify-between text-left transition-all duration-75 cursor-pointer select-none border border-b-2 ${
                    isPhysicallyPressed ? 'keycap-dish-pressed' : 'keycap-dish-3d'
                  } ${
                    isDragTarget
                      ? 'bg-[#06b6d4]/40 border-2 border-white scale-105 z-30'
                      : isPhysicallyPressed
                      ? 'bg-[#10b981]/30 border-2 border-[#10b981] text-white z-20'
                      : isSelected
                      ? 'bg-[#06b6d4]/20 border-2 border-[#06b6d4] text-white ring-2 ring-[#06b6d4]/40 z-10'
                      : `${themeCapClass} hover:brightness-110`
                  }`}
                >
                  {isCyberpunk && isEsc ? (
                    <div className="flex items-center justify-center w-full h-full text-base font-black text-red-200">
                      △
                    </div>
                  ) : isCyberpunk && isPrtSc ? (
                    <div className="flex items-center justify-center w-full h-full text-base font-black text-cyan-300">
                      ⊕
                    </div>
                  ) : isCyberpunk && isEnter ? (
                    <div className="flex flex-col justify-between w-full h-full">
                      <span className="text-[10px] font-mono font-black text-white/90">ENTER</span>
                      <span className="text-[9px] font-mono font-bold text-red-200 truncate">
                        ∿∿∿∿∿
                      </span>
                    </div>
                  ) : isCyberpunk && isBackspace ? (
                    <div className="flex flex-col justify-between w-full h-full">
                      <span className="text-[10px] font-mono font-black text-cyan-100">BKSP</span>
                      <span className="text-[8px] font-mono font-bold text-cyan-200 truncate">
                        &lt;&lt;&lt;&lt;&lt;&lt;
                      </span>
                    </div>
                  ) : isCyberpunk && isSpacebar ? (
                    <div className="flex items-center justify-center w-full h-full text-[10px] font-mono font-black text-slate-900 tracking-widest">
                      SPACE
                    </div>
                  ) : isCyberpunk && isArrow ? (
                    <div className="flex items-center justify-center w-full h-full text-base font-black text-red-500">
                      {k.label}
                    </div>
                  ) : isCyberpunk && katakanaChar ? (
                    <div className="flex flex-col justify-between w-full h-full leading-none">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-black text-xs font-mono text-yellow-300">
                          {k.label}
                        </span>
                        {isModifiedFromDefault && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]"
                            title="Modified from factory default"
                          />
                        )}
                      </div>
                      <span className="font-bold text-[10px] font-mono text-yellow-500/90 self-end">
                        {katakanaChar}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col justify-between w-full h-full leading-none">
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-[11px] sm:text-xs font-mono truncate">
                          {k.label}
                        </span>
                        {isModifiedFromDefault && (
                          <span
                            className="w-1.5 h-1.5 rounded-full bg-[#10b981] shadow-[0_0_6px_#10b981]"
                            title="Modified from factory default"
                          />
                        )}
                      </div>
                      {cyberGlyph && isCyberpunk && (
                        <span className="text-[9px] font-mono text-cyan-400 truncate opacity-80">
                          {cyberGlyph}
                        </span>
                      )}
                      {isModifiedFromDefault && (
                        <div className="text-[10px] font-mono font-bold text-[#10b981] truncate w-full">
                          {codeLabel}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Key Remapping Drawer & Categorized Keycode Palette */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-[#0b0f19] border border-[#1e293b]">
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-[#06b6d4]/20 border border-[#06b6d4] text-[#06b6d4] font-mono font-bold text-sm">
              {selectedKeyDef.label}
            </div>
            <div>
              <div className="text-xs text-slate-300 font-semibold flex items-center gap-2">
                <span>Action:</span>
                <span className="text-[#10b981] font-mono font-bold">
                  {getKeycodeLabel(currentSelectedKeycode, viaProtocol)}
                </span>
                <span className="text-slate-500 font-mono text-[11px]">
                  (0x{currentSelectedKeycode.toString(16).toUpperCase().padStart(4, '0')})
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500">
                Switch: Row {selectedKeyDef.row}, Col {selectedKeyDef.col} · Layer {activeLayer}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {selectedKeyDef.isKnob && (
              <div className="flex items-center gap-1.5 mr-2">
                <span className="text-xs font-mono text-purple-300">Knob Action:</span>
                <button
                  type="button"
                  onClick={() => onSelectKeyId('r7c0')}
                  className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                    selectedKeyId === 'r7c0'
                      ? 'bg-[#8b5cf6] text-white font-bold'
                      : 'bg-[#131b2e] text-slate-300'
                  }`}
                >
                  CCW (Vol -)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectKeyId('r0c14')}
                  className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                    selectedKeyId === 'r0c14'
                      ? 'bg-[#8b5cf6] text-white font-bold'
                      : 'bg-[#131b2e] text-slate-300'
                  }`}
                >
                  Click (Mute)
                </button>
                <button
                  type="button"
                  onClick={() => onSelectKeyId('r7c1')}
                  className={`px-2 py-1 text-xs font-mono rounded cursor-pointer ${
                    selectedKeyId === 'r7c1'
                      ? 'bg-[#8b5cf6] text-white font-bold'
                      : 'bg-[#131b2e] text-slate-300'
                  }`}
                >
                  CW (Vol +)
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                const def =
                  defaultKeymap[activeLayer]?.[selectedKeyDef.row]?.[selectedKeyDef.col] ?? 0;
                void onAssignKeycode(def, selectedKeyDef.id);
              }}
              className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:text-white hover:border-[#06b6d4] transition-colors cursor-pointer"
            >
              Reset This Key
            </button>
          </div>
        </div>

        {/* Category Pills & Keycode Search Input */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                'Basic',
                'Alpha',
                'Number',
                'Function',
                'Navigation',
                'Modifier',
                'Media & Knob',
                'Layers',
                'Lighting & Hardware',
              ] as KeycodeItem['category'][]
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setActiveKeyCategory(cat);
                  setKeycodeSearchQuery('');
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                  activeKeyCategory === cat && !keycodeSearchQuery
                    ? 'bg-[#8b5cf6] text-white'
                    : 'bg-[#0b0f19] text-slate-400 border border-[#1e293b] hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keycodeSearchQuery}
              onChange={(e) => setKeycodeSearchQuery(e.target.value)}
              placeholder="Search keycodes (e.g. Mute, Vol, Calc, Play)..."
              className="w-full bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#06b6d4]"
            />
            {keycodeSearchQuery && (
              <button
                type="button"
                onClick={() => setKeycodeSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Keycode Items Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
          {KEYCODE_CATALOG.filter((item) => {
            if (keycodeSearchQuery) {
              const q = keycodeSearchQuery.toLowerCase();
              return (
                item.name.toLowerCase().includes(q) ||
                item.shortLabel.toLowerCase().includes(q) ||
                item.category.toLowerCase().includes(q)
              );
            }
            return item.category === activeKeyCategory;
          }).map((item) => {
            const isCurrent = currentSelectedKeycode === item.code;
            return (
              <button
                key={item.code}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', String(item.code));
                }}
                onClick={() => onAssignKeycode(item.code)}
                className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                  isCurrent
                    ? 'bg-[#10b981]/20 border-[#10b981] text-white'
                    : 'bg-[#0b0f19] border-[#1e293b] hover:border-[#06b6d4] text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-1">
                  <span className="text-xs font-mono font-bold text-[#06b6d4]">
                    {item.shortLabel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    0x{item.code.toString(16).toUpperCase().padStart(4, '0')}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 truncate">{item.name}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
