import React, { useState, useRef, useEffect } from 'react';
import {
  Brush,
  Eraser,
  Trash2,
  Sparkles,
  Type,
  Film,
  Copy,
  FlipHorizontal,
  Play,
  Pause,
  Send,
  Layers,
  Grid,
  Sliders,
} from 'lucide-react';
import {
  LCD_WIDTH,
  LCD_HEIGHT,
  MAX_TOTAL_FRAMES,
  MIN_FRAME_DURATION_MS,
} from '../services/gmk87Hid';
import { quantizeImageDataToRGB565Preview } from '../utils/lcdGenerators';

interface TftScreenPainterAndTimelineProps {
  frames: ImageData[];
  onUpdateFrames: (nextFrames: ImageData[], statusMessage?: string) => void;
  onFlashFrames: (framesToFlash: ImageData[], label: string) => Promise<void>;
  frameDurationMs: number;
  onChangeFrameDurationMs: (ms: number) => void;
  useFloydSteinbergDither: boolean;
  onToggleDither: () => void;
  targetSlot: 0 | 1;
  onSelectSlot: (slot: 0 | 1) => void;
}

const PIXEL_SWATCHES = [
  '#06b6d4', // Primary Cyan
  '#8b5cf6', // Accent Purple
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#f43f5e', // Neon Rose
  '#3b82f6', // Electric Blue
  '#ec4899', // Synth Pink
  '#eab308', // Cyber Yellow
  '#ffffff', // Pure White
  '#94a3b8', // Steel Grey
  '#131b2e', // Card Navy
  '#000000', // True Black
];

const PIXEL_STAMPS: { id: string; label: string; draw: (ctx: CanvasRenderingContext2D, color: string) => void }[] = [
  {
    id: 'gmk87-badge',
    label: '⌨️ GMK87 PRO Badge',
    draw: (ctx, color) => {
      ctx.save();
      ctx.fillStyle = '#070b14';
      ctx.fillRect(50, 42, 140, 50);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(50, 42, 140, 50);
      ctx.fillStyle = color;
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillText('GMK87 // 87', 63, 68);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillText('240x135 RGB565 STUDIO', 64, 83);
      ctx.restore();
    },
  },
  {
    id: 'nerv-alert',
    label: '⚠️ MECHA ALERT HUD',
    draw: (ctx, color) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.strokeRect(8, 8, LCD_WIDTH - 16, LCD_HEIGHT - 16);
      ctx.fillStyle = color;
      for (let x = 12; x < LCD_WIDTH - 20; x += 18) {
        ctx.fillRect(x, 12, 10, 6);
        ctx.fillRect(x, LCD_HEIGHT - 18, 10, 6);
      }
      ctx.font = 'bold 20px "JetBrains Mono", monospace';
      ctx.fillText('EMERGENCY', 64, 68);
      ctx.font = 'bold 10px "JetBrains Mono", monospace';
      ctx.fillText('INTERNAL BATTERY // 1000Hz', 44, 88);
      ctx.restore();
    },
  },
  {
    id: 'cyber-grid',
    label: '🌅 Synth Horizon',
    draw: (ctx, color) => {
      ctx.save();
      // Sun
      const grad = ctx.createLinearGradient(0, 20, 0, 82);
      grad.addColorStop(0, '#f59e0b');
      grad.addColorStop(1, '#ec4899');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(120, 58, 28, 0, Math.PI * 2);
      ctx.fill();
      // Horizon lines
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      for (let y = 85; y < LCD_HEIGHT; y += 9) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(LCD_WIDTH, y);
        ctx.stroke();
      }
      for (let x = -60; x <= LCD_WIDTH + 60; x += 24) {
        ctx.beginPath();
        ctx.moveTo(120 + (x - 120) * 0.25, 85);
        ctx.lineTo(x, LCD_HEIGHT);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  {
    id: 'corner-reticle',
    label: '🎯 Tactical Reticle',
    draw: (ctx, color) => {
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      // Four corners
      const len = 18;
      // TL
      ctx.beginPath();
      ctx.moveTo(6, 6 + len);
      ctx.lineTo(6, 6);
      ctx.lineTo(6 + len, 6);
      ctx.stroke();
      // TR
      ctx.beginPath();
      ctx.moveTo(LCD_WIDTH - 6 - len, 6);
      ctx.lineTo(LCD_WIDTH - 6, 6);
      ctx.lineTo(LCD_WIDTH - 6, 6 + len);
      ctx.stroke();
      // BL
      ctx.beginPath();
      ctx.moveTo(6, LCD_HEIGHT - 6 - len);
      ctx.lineTo(6, LCD_HEIGHT - 6);
      ctx.lineTo(6 + len, LCD_HEIGHT - 6);
      ctx.stroke();
      // BR
      ctx.beginPath();
      ctx.moveTo(LCD_WIDTH - 6 - len, LCD_HEIGHT - 6);
      ctx.lineTo(LCD_WIDTH - 6, LCD_HEIGHT - 6);
      ctx.lineTo(LCD_WIDTH - 6, LCD_HEIGHT - 6 - len);
      ctx.stroke();
      ctx.restore();
    },
  },
];

function FrameThumbCanvas({
  frame,
  index,
  isSelected,
  onSelect,
}: {
  frame: ImageData;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.getContext('2d')?.putImageData(frame, 0, 0);
  }, [frame]);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative rounded-lg p-1 border text-left transition-all shrink-0 cursor-pointer ${
        isSelected
          ? 'bg-[#06b6d4]/20 border-2 border-[#06b6d4] shadow-md'
          : 'bg-[#0b0f19] border-[#1e293b] hover:border-slate-500'
      }`}
    >
      <canvas
        ref={ref}
        width={LCD_WIDTH}
        height={LCD_HEIGHT}
        className="w-[88px] h-[50px] rounded bg-black pixelated-canvas block"
      />
      <div className="flex items-center justify-between text-[9px] font-mono mt-1 px-0.5">
        <span className={isSelected ? 'text-[#06b6d4] font-bold' : 'text-slate-400'}>
          #{index + 1}
        </span>
        <span className="text-slate-500">64KB</span>
      </div>
    </button>
  );
}

export default function TftScreenPainterAndTimeline({
  frames,
  onUpdateFrames,
  onFlashFrames,
  frameDurationMs,
  onChangeFrameDurationMs,
  useFloydSteinbergDither,
  onToggleDither,
  targetSlot,
  onSelectSlot,
}: TftScreenPainterAndTimelineProps) {
  const [selectedFrameIdx, setSelectedFrameIdx] = useState<number>(0);
  const [isPlayingTimeline, setIsPlayingTimeline] = useState<boolean>(false);
  const [brushColor, setBrushColor] = useState<string>('#06b6d4');
  const [brushSize, setBrushSize] = useState<number>(3);
  const [toolMode, setToolMode] = useState<'brush' | 'eraser'>('brush');
  const [showPixelGrid, setShowPixelGrid] = useState<boolean>(false);
  const [stampText, setStampText] = useState<string>('GMK87 // CYBER');
  const [applyToAllFrames, setApplyToAllFrames] = useState<boolean>(false);

  const painterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  const safeIdx = frames.length > 0 ? Math.min(selectedFrameIdx, frames.length - 1) : 0;

  // Initialize painter canvas with active frame or dark cyberpunk backdrop
  useEffect(() => {
    const canvas = painterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (frames.length > 0 && frames[safeIdx]) {
      ctx.putImageData(frames[safeIdx], 0, 0);
    } else {
      ctx.fillStyle = '#070b14';
      ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.strokeRect(1, 1, LCD_WIDTH - 2, LCD_HEIGHT - 2);
      ctx.fillStyle = '#06b6d4';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText('GMK87 PIXEL CANVAS (240x135)', 22, 68);
    }
  }, [frames, safeIdx]);

  // Timeline playback preview loop (clamped to firmware minimum 60ms and paused while tab hidden)
  useEffect(() => {
    if (!isPlayingTimeline || frames.length <= 1) return;
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      setSelectedFrameIdx((prev) => (prev + 1) % frames.length);
    }, Math.max(MIN_FRAME_DURATION_MS, frameDurationMs));
    return () => clearInterval(timer);
  }, [isPlayingTimeline, frames.length, frameDurationMs]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = painterCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(LCD_WIDTH - 1, Math.floor(((e.clientX - rect.left) / rect.width) * LCD_WIDTH))
    );
    const y = Math.max(
      0,
      Math.min(LCD_HEIGHT - 1, Math.floor(((e.clientY - rect.top) / rect.height) * LCD_HEIGHT))
    );
    return { x, y };
  };

  const commitCanvasToFrames = (statusMsg?: string) => {
    const canvas = painterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);

    if (frames.length === 0) {
      onUpdateFrames([imgData], statusMsg || 'Created custom 240×135 frame in Pixel Studio.');
      setSelectedFrameIdx(0);
    } else {
      const next = frames.map((f, idx) => (idx === safeIdx ? imgData : f));
      onUpdateFrames(next, statusMsg);
    }
  };

  const handlePointerDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawingRef.current = true;
    const pos = getCanvasCoords(e);
    lastPosRef.current = pos;
    const ctx = painterCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = toolMode === 'eraser' ? '#070b14' : brushColor;
    ctx.fillRect(
      Math.round(pos.x - brushSize / 2),
      Math.round(pos.y - brushSize / 2),
      brushSize,
      brushSize
    );
  };

  const handlePointerMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const pos = getCanvasCoords(e);
    const ctx = painterCanvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = toolMode === 'eraser' ? '#070b14' : brushColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'square';
    ctx.beginPath();
    if (lastPosRef.current) {
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    } else {
      ctx.moveTo(pos.x, pos.y);
    }
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPosRef.current = pos;
  };

  const handlePointerUp = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPosRef.current = null;
    commitCanvasToFrames('Updated 240×135 frame in Pixel Painter.');
  };

  const handleApplyStamp = (stamp: (typeof PIXEL_STAMPS)[0]) => {
    if (applyToAllFrames && frames.length > 1) {
      const updated = frames.map((f) => {
        const off = document.createElement('canvas');
        off.width = LCD_WIDTH;
        off.height = LCD_HEIGHT;
        const octx = off.getContext('2d')!;
        octx.putImageData(f, 0, 0);
        stamp.draw(octx, brushColor);
        return octx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
      });
      onUpdateFrames(updated, `Stamped "${stamp.label}" across all ${updated.length} frames.`);
      return;
    }

    const canvas = painterCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    stamp.draw(ctx, brushColor);
    commitCanvasToFrames(`Stamped "${stamp.label}" onto frame #${safeIdx + 1}.`);
  };

  const handleStampTextBanner = () => {
    if (!stampText.trim()) return;
    const drawBanner = (ctx: CanvasRenderingContext2D) => {
      ctx.save();
      ctx.fillStyle = 'rgba(7, 11, 20, 0.86)';
      ctx.fillRect(0, LCD_HEIGHT - 26, LCD_WIDTH, 26);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, LCD_HEIGHT - 26);
      ctx.lineTo(LCD_WIDTH, LCD_HEIGHT - 26);
      ctx.stroke();
      ctx.fillStyle = brushColor;
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.fillText(stampText.trim().slice(0, 26), 10, LCD_HEIGHT - 9);
      ctx.restore();
    };

    if (applyToAllFrames && frames.length > 1) {
      const updated = frames.map((f) => {
        const off = document.createElement('canvas');
        off.width = LCD_WIDTH;
        off.height = LCD_HEIGHT;
        const octx = off.getContext('2d')!;
        octx.putImageData(f, 0, 0);
        drawBanner(octx);
        return octx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
      });
      onUpdateFrames(
        updated,
        `Stamped "${stampText}" banner onto all ${updated.length} animation frames.`
      );
      return;
    }

    const ctx = painterCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawBanner(ctx);
    commitCanvasToFrames(`Stamped "${stampText}" banner onto frame #${safeIdx + 1}.`);
  };

  const handleClearCanvas = () => {
    const ctx = painterCanvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);
    commitCanvasToFrames('Cleared 240×135 frame canvas.');
  };

  const handleDuplicateFrame = () => {
    if (frames.length === 0) {
      commitCanvasToFrames();
      return;
    }
    if (frames.length >= 36) return;
    const target = frames[safeIdx];
    const clone = new ImageData(new Uint8ClampedArray(target.data), target.width, target.height);
    const next = [...frames.slice(0, safeIdx + 1), clone, ...frames.slice(safeIdx + 1)];
    onUpdateFrames(next, `Duplicated frame #${safeIdx + 1} (${next.length}/36 frames).`);
    setSelectedFrameIdx(safeIdx + 1);
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) return;
    const next = frames.filter((_, idx) => idx !== safeIdx);
    onUpdateFrames(next, `Deleted frame #${safeIdx + 1} (${next.length} frames remaining).`);
    setSelectedFrameIdx(Math.max(0, safeIdx - 1));
  };

  const handleReverseFrames = () => {
    if (frames.length <= 1) return;
    const next = [...frames].reverse();
    onUpdateFrames(next, `Reversed playback order for ${next.length} frames.`);
  };

  const handleTrimEveryOtherFrame = () => {
    if (frames.length <= 2) return;
    const next = frames.filter((_, idx) => idx % 2 === 0);
    onUpdateFrames(
      next,
      `Decimated frame count from ${frames.length} → ${next.length} frames for faster USB flashing.`
    );
    setSelectedFrameIdx(0);
  };

  const totalFlashKb = Math.max(1, frames.length) * 64;

  return (
    <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-6">
      {/* Header & SPI Flash Budget Meter */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[#1e293b] pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Brush className="w-4 h-4 text-[#06b6d4]" />
            240×135 Pixel Art Painter & Multi-Frame SPI Flash Timeline
          </h2>
          <p className="text-xs text-slate-400">
            Draw custom pixel art, stamp HUD overlays across imported GIF frames, trim/reorder frames
            to fit the {MAX_TOTAL_FRAMES}-frame SPI flash budget (up to 36f in Slot 0, or up to 35f in
            Slot 1 with persistent Slot 0 prefix), and flash to Slot {targetSlot}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3.5 py-2 text-xs font-mono flex items-center gap-3">
            <span className="text-slate-400">SPI FLASH BUDGET:</span>
            <span
              className={`font-bold ${
                frames.length > 30 ? 'text-[#f59e0b]' : 'text-[#06b6d4]'
              }`}
            >
              {Math.max(1, frames.length)} / 36 Frames ({totalFlashKb} KB)
            </span>
          </div>

          <button
            type="button"
            onClick={onToggleDither}
            className={`px-3 py-2 text-xs font-mono rounded-lg border transition-colors cursor-pointer ${
              useFloydSteinbergDither
                ? 'bg-[#10b981]/15 border-[#10b981] text-[#10b981]'
                : 'bg-[#0b0f19] border-[#1e293b] text-slate-400'
            }`}
          >
            RGB565 Dither: {useFloydSteinbergDither ? 'FLOYD-STEINBERG' : 'RAW NEAREST'}
          </button>
        </div>
      </div>

      {/* Main 2-Column Studio: Left = Interactive 240x135 Pixel Canvas | Right = Brush, Stamps & Flash Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 6 Cols: Interactive 2x Zoomed 240x135 Canvas */}
        <div className="lg:col-span-6 bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-[#06b6d4] font-semibold">
              INTERACTIVE 240×135 RGB565 WORKSPACE (FRAME #{safeIdx + 1} OF{' '}
              {Math.max(1, frames.length)})
            </span>
            <button
              type="button"
              onClick={() => setShowPixelGrid((g) => !g)}
              className={`px-2 py-1 rounded text-[11px] border flex items-center gap-1 cursor-pointer ${
                showPixelGrid
                  ? 'bg-[#06b6d4]/20 border-[#06b6d4] text-[#06b6d4]'
                  : 'bg-[#131b2e] border-[#1e293b] text-slate-400'
              }`}
            >
              <Grid className="w-3 h-3" />
              Grid
            </button>
          </div>

          <div className="relative mx-auto w-full max-w-[480px] aspect-[16/9] rounded-lg overflow-hidden border-2 border-[#1e293b] shadow-inner bg-black">
            <canvas
              ref={painterCanvasRef}
              width={LCD_WIDTH}
              height={LCD_HEIGHT}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              className="w-full h-full pixelated-canvas cursor-crosshair block"
            />
            {showPixelGrid && (
              <div
                className="absolute inset-0 pointer-events-none opacity-25"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #06b6d4 1px, transparent 1px), linear-gradient(to bottom, #06b6d4 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setToolMode('brush')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                  toolMode === 'brush'
                    ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                    : 'bg-[#131b2e] text-slate-300 border-[#1e293b]'
                }`}
              >
                <Brush className="w-3.5 h-3.5" />
                Pixel Brush
              </button>
              <button
                type="button"
                onClick={() => setToolMode('eraser')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border flex items-center gap-1.5 cursor-pointer ${
                  toolMode === 'eraser'
                    ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                    : 'bg-[#131b2e] text-slate-300 border-[#1e293b]'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                Eraser
              </button>
              <button
                type="button"
                onClick={handleClearCanvas}
                className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:border-rose-500 hover:text-rose-300 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
              <span>SIZE: {brushSize}px</span>
              <input
                type="range"
                min={1}
                max={10}
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-24 accent-[#06b6d4]"
              />
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Swatches, HUD Stamps, Text Overlay & Direct Hardware Flash */}
        <div className="lg:col-span-6 space-y-4">
          {/* Color Swatches */}
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>NEON RGB565 PALETTE SWATCHES</span>
              <label className="flex items-center gap-1.5 cursor-pointer text-cyan-300">
                <span>Custom Hex:</span>
                <input
                  type="color"
                  value={brushColor}
                  onChange={(e) => {
                    setBrushColor(e.target.value);
                    setToolMode('brush');
                  }}
                  className="w-6 h-6 rounded border border-[#1e293b] bg-transparent cursor-pointer"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {PIXEL_SWATCHES.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  onClick={() => {
                    setBrushColor(hex);
                    setToolMode('brush');
                  }}
                  style={{ backgroundColor: hex }}
                  className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer ${
                    brushColor.toLowerCase() === hex.toLowerCase()
                      ? 'scale-110 ring-2 ring-white border-white'
                      : 'border-slate-700 hover:scale-105'
                  }`}
                  title={hex}
                />
              ))}
            </div>
          </div>

          {/* 1-Click Cyber Stamps & Text Callsign Overlay */}
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-mono text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#8b5cf6]" />
                1-CLICK 240×135 HARDWARE STAMPS & CALLSIGN BANNER
              </span>
              {frames.length > 1 && (
                <label className="flex items-center gap-1.5 text-[11px] font-mono text-[#10b981] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={applyToAllFrames}
                    onChange={(e) => setApplyToAllFrames(e.target.checked)}
                    className="accent-[#10b981]"
                  />
                  Stamp All {frames.length} Frames
                </label>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {PIXEL_STAMPS.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => handleApplyStamp(st)}
                  className="px-3 py-2 text-xs font-semibold rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] text-left transition-colors cursor-pointer"
                >
                  {st.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="relative flex-1">
                <Type className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  maxLength={24}
                  value={stampText}
                  onChange={(e) => setStampText(e.target.value)}
                  placeholder="Enter custom callsign banner..."
                  className="w-full bg-[#131b2e] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
                />
              </div>
              <button
                type="button"
                onClick={handleStampTextBanner}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#8b5cf6] text-white hover:bg-purple-500 transition-colors cursor-pointer whitespace-nowrap"
              >
                Stamp Banner
              </button>
            </div>
          </div>

          {/* Slot Target + Frame Speed + Direct Flash Button */}
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex rounded-lg bg-[#131b2e] p-1 border border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => onSelectSlot(0)}
                  className={`px-3 py-1 text-xs font-mono rounded-md cursor-pointer ${
                    targetSlot === 0
                      ? 'bg-[#06b6d4] text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Target: Slot 0
                </button>
                <button
                  type="button"
                  onClick={() => onSelectSlot(1)}
                  className={`px-3 py-1 text-xs font-mono rounded-md cursor-pointer ${
                    targetSlot === 1
                      ? 'bg-[#8b5cf6] text-white font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Target: Slot 1
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
                <Sliders className="w-3.5 h-3.5 text-[#06b6d4]" />
                <span>FRAME DELAY: {Math.max(MIN_FRAME_DURATION_MS, frameDurationMs)}ms</span>
                <input
                  type="range"
                  min={MIN_FRAME_DURATION_MS}
                  max={300}
                  step={5}
                  value={Math.max(MIN_FRAME_DURATION_MS, frameDurationMs)}
                  onChange={(e) =>
                    onChangeFrameDurationMs(Math.max(MIN_FRAME_DURATION_MS, Number(e.target.value)))
                  }
                  className="w-24 accent-[#06b6d4]"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (frames.length === 0) {
                  const canvas = painterCanvasRef.current;
                  const ctx = canvas?.getContext('2d');
                  if (!ctx) return;
                  const single = ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
                  onUpdateFrames([single]);
                  await onFlashFrames([single], 'Custom Pixel Canvas (1 Frame)');
                } else {
                  await onFlashFrames(
                    frames,
                    `Custom Studio Sequence (${frames.length} Frame${frames.length > 1 ? 's' : ''})`
                  );
                }
              }}
              className="w-full py-2.5 px-4 text-xs font-bold rounded-lg bg-gradient-to-r from-[#06b6d4] to-[#10b981] text-slate-950 hover:opacity-95 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              Flash {Math.max(1, frames.length)}-Frame Sequence ({totalFlashKb} KB) to GMK87 Slot{' '}
              {targetSlot}
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Multi-Frame Timeline Strip */}
      <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-300">
            <Film className="w-4 h-4 text-[#06b6d4]" />
            <span className="font-semibold">
              FRAME TIMELINE SCRUBBER ({frames.length} ACTIVE FRAME{frames.length === 1 ? '' : 'S'})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {frames.length > 1 && (
              <button
                type="button"
                onClick={() => setIsPlayingTimeline((p) => !p)}
                className="px-2.5 py-1 text-xs font-mono rounded bg-[#131b2e] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] flex items-center gap-1 cursor-pointer"
              >
                {isPlayingTimeline ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                {isPlayingTimeline ? 'Pause' : 'Play Strip'}
              </button>
            )}
            <button
              type="button"
              onClick={handleDuplicateFrame}
              disabled={frames.length >= 36}
              className="px-2.5 py-1 text-xs font-mono rounded bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              Clone Frame #{safeIdx + 1}
            </button>
            {frames.length > 2 && (
              <button
                type="button"
                onClick={handleTrimEveryOtherFrame}
                className="px-2.5 py-1 text-xs font-mono rounded bg-[#131b2e] border border-[#1e293b] text-[#10b981] hover:border-[#10b981] flex items-center gap-1 cursor-pointer"
              >
                <Layers className="w-3 h-3" />
                Halve Frames ({frames.length}→{Math.ceil(frames.length / 2)})
              </button>
            )}
            {frames.length > 1 && (
              <button
                type="button"
                onClick={handleReverseFrames}
                className="px-2.5 py-1 text-xs font-mono rounded bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:border-[#8b5cf6] flex items-center gap-1 cursor-pointer"
              >
                <FlipHorizontal className="w-3 h-3" />
                Reverse
              </button>
            )}
            {frames.length > 1 && (
              <button
                type="button"
                onClick={handleDeleteFrame}
                className="px-2.5 py-1 text-xs font-mono rounded bg-[#131b2e] border border-[#1e293b] text-rose-300 hover:border-rose-500 flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3 h-3" />
                Delete #{safeIdx + 1}
              </button>
            )}
          </div>
        </div>

        {frames.length === 0 ? (
          <div className="text-xs font-mono text-slate-500 py-3 text-center">
            No multi-frame sequence loaded yet — draw on the 240×135 canvas above, click any Web GIF
            / Pokémon sprite, or upload a local GIF to populate the frame timeline.
          </div>
        ) : (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
            {frames.map((frame, idx) => (
              <FrameThumbCanvas
                key={idx}
                frame={quantizeImageDataToRGB565Preview(frame, useFloydSteinbergDither)}
                index={idx}
                isSelected={idx === safeIdx}
                onSelect={() => {
                  setIsPlayingTimeline(false);
                  setSelectedFrameIdx(idx);
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
