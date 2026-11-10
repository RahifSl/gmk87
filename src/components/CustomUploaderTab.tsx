import React, { useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { LCD_WIDTH, LCD_HEIGHT, MAX_TOTAL_FRAMES } from '../services/gmk87Hid';
import { quantizeImageDataToRGB565Preview } from '../utils/lcdGenerators';
import TftScreenPainterAndTimeline from './TftScreenPainterAndTimeline';

export interface CustomUploaderTabProps {
  uploadedFileName: string;
  uploadedSourceInfo: string;
  uploadedFrames: ImageData[];
  customPreviewFrames: ImageData[];
  customPreviewImageData: ImageData | null;
  targetSlot: 0 | 1;
  frameDurationMs: number;
  useFloydSteinbergDither: boolean;
  onSelectSlot: (slot: 0 | 1) => void;
  onToggleDither: () => void;
  onChangeFrameDurationMs: (ms: number) => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  onUpdateFrames: (nextFrames: ImageData[], msg?: string) => void;
  onFlashFrames: (framesToFlash: ImageData[], label: string) => Promise<void>;
  onStatusLog: (msg: string) => void;
}

export default function CustomUploaderTab({
  uploadedFileName,
  uploadedSourceInfo,
  uploadedFrames,
  customPreviewFrames,
  customPreviewImageData,
  targetSlot,
  frameDurationMs,
  useFloydSteinbergDither,
  onSelectSlot,
  onToggleDither,
  onChangeFrameDurationMs,
  onFileUpload,
  onUpdateFrames,
  onFlashFrames,
  onStatusLog,
}: CustomUploaderTabProps) {
  const uploaderPreviewRef = useRef<HTMLCanvasElement | null>(null);

  // Animate uploaded multi-frame GIF / re-quantize on Floyd-Steinberg toggle (paused while tab hidden)
  useEffect(() => {
    const activeList =
      uploadedFrames.length > 0
        ? uploadedFrames
        : customPreviewFrames.length > 0
        ? customPreviewFrames
        : customPreviewImageData
        ? [customPreviewImageData]
        : [];
    if (activeList.length === 0) return;

    let idx = 0;
    const renderUploaderFrame = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const canvas = uploaderPreviewRef.current;
      if (!canvas) return;
      const frame = activeList[idx % activeList.length];
      const quantized = quantizeImageDataToRGB565Preview(frame, useFloydSteinbergDither);
      canvas.getContext('2d')?.putImageData(quantized, 0, 0);
      idx++;
    };

    renderUploaderFrame();
    if (activeList.length === 1) return;
    const timer = setInterval(renderUploaderFrame, Math.max(60, frameDurationMs));
    return () => clearInterval(timer);
  }, [
    uploadedFrames,
    customPreviewFrames,
    customPreviewImageData,
    useFloydSteinbergDither,
    frameDurationMs,
  ]);

  const activeTimelineFrames =
    uploadedFrames.length > 0
      ? uploadedFrames
      : customPreviewFrames.length > 0
      ? customPreviewFrames
      : customPreviewImageData
      ? [customPreviewImageData]
      : [];

  return (
    <div className="space-y-6">
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">
              Custom PNG / JPG / GIF Hardware Uploader (240×135 Letterbox & RGB565 Quantizer)
            </h2>
            <p className="text-xs text-slate-400">
              Automatically scales and centers any local image onto 240×135, decodes up to{' '}
              {MAX_TOTAL_FRAMES} animated GIF frames, applies Floyd-Steinberg dithering, and opens
              in the Pixel Painter & Timeline below.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
          <label className="border-2 border-dashed border-[#1e293b] hover:border-[#06b6d4] rounded-xl p-8 bg-[#0b0f19] flex flex-col items-center justify-center text-center cursor-pointer transition-colors">
            <Upload className="w-8 h-8 text-[#06b6d4] mb-3" />
            <span className="text-sm font-semibold text-white">
              Click to choose a PNG, JPG, WebP, or Animated GIF file
            </span>
            <span className="text-xs text-slate-400 mt-1">
              {uploadedFileName
                ? `${uploadedFileName}${uploadedSourceInfo ? ` · ${uploadedSourceInfo}` : ''}`
                : 'Auto-letterboxed to 240×135 · Multi-Frame GIF & Big-Endian RGB565 (65,536B padded)'}
            </span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              onChange={onFileUpload}
              className="hidden"
            />
          </label>

          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-xl p-5 flex flex-col sm:flex-row items-center gap-5">
            <div className="shrink-0">
              <div className="text-[10px] font-mono text-slate-400 mb-1">
                QUANTIZED RGB565 PREVIEW
              </div>
              <canvas
                ref={uploaderPreviewRef}
                width={LCD_WIDTH}
                height={LCD_HEIGHT}
                className="w-[240px] h-[135px] bg-black border border-[#1e293b] rounded pixelated-canvas"
              />
            </div>

            <div className="space-y-3 w-full">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectSlot(0)}
                  className={`flex-1 py-1.5 text-xs font-mono rounded-lg border cursor-pointer ${
                    targetSlot === 0
                      ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4] font-bold'
                      : 'bg-[#131b2e] text-slate-300 border-[#1e293b]'
                  }`}
                >
                  Slot 0
                </button>
                <button
                  onClick={() => onSelectSlot(1)}
                  className={`flex-1 py-1.5 text-xs font-mono rounded-lg border cursor-pointer ${
                    targetSlot === 1
                      ? 'bg-[#8b5cf6] text-white border-[#8b5cf6] font-bold'
                      : 'bg-[#131b2e] text-slate-300 border-[#1e293b]'
                  }`}
                >
                  Slot 1
                </button>
              </div>

              <button
                onClick={async () => {
                  if (activeTimelineFrames.length === 0) {
                    onStatusLog('Select an image/GIF file first, or paint a custom frame below.');
                    return;
                  }
                  await onFlashFrames(
                    activeTimelineFrames,
                    `Custom Upload (${activeTimelineFrames.length} frame(s))`
                  );
                }}
                className="w-full py-2.5 px-4 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
              >
                Flash{' '}
                {uploadedFrames.length > 1
                  ? `${uploadedFrames.length}-Frame GIF`
                  : 'Custom Frame'}{' '}
                to Slot {targetSlot}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Integrated 240x135 Pixel Art Painter & Multi-Frame SPI Timeline Editor */}
      <TftScreenPainterAndTimeline
        frames={activeTimelineFrames}
        onUpdateFrames={onUpdateFrames}
        onFlashFrames={onFlashFrames}
        frameDurationMs={frameDurationMs}
        onChangeFrameDurationMs={onChangeFrameDurationMs}
        useFloydSteinbergDither={useFloydSteinbergDither}
        onToggleDither={onToggleDither}
        targetSlot={targetSlot}
        onSelectSlot={onSelectSlot}
      />
    </div>
  );
}
