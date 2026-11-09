import { GifReader } from 'omggif';
import { LCD_WIDTH, LCD_HEIGHT } from '../services/gmk87Hid';
import { applyLcdCustomOverlays, LcdCustomizationOptions } from './lcdGenerators';

const MAX_SAMPLED_GIF_FRAMES = 16;

function sampleFrameIndices(totalFrames: number, maxFrames: number): number[] {
  if (totalFrames <= maxFrames) {
    return Array.from({ length: totalFrames }, (_, i) => i);
  }
  const indices: number[] = [];
  for (let i = 0; i < maxFrames; i++) {
    indices.push(Math.round((i * (totalFrames - 1)) / (maxFrames - 1)));
  }
  return indices;
}

function renderSourceToLcdFrame(
  source: CanvasImageSource,
  srcWidth: number,
  srcHeight: number,
  custom?: LcdCustomizationOptions
): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = LCD_WIDTH;
  canvas.height = LCD_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, LCD_WIDTH, LCD_HEIGHT);

  const availX = custom?.overlayMode === 'split-clock' ? 88 : 0;
  const availW = LCD_WIDTH - availX;
  
  // Fit dimensions with zero stretching and zero empty space:
  // Math.max ensures image covers the entire 240x135 canvas while preserving natural aspect ratio
  const scale = Math.max(availW / Math.max(1, srcWidth), LCD_HEIGHT / Math.max(1, srcHeight));
  const dw = Math.max(1, Math.round(srcWidth * scale));
  const dh = Math.max(1, Math.round(srcHeight * scale));
  const dx = availX + Math.round((availW - dw) / 2);
  const dy = Math.round((LCD_HEIGHT - dh) / 2);

  ctx.drawImage(source, dx, dy, dw, dh);
  applyLcdCustomOverlays(ctx, custom);
  return ctx.getImageData(0, 0, LCD_WIDTH, LCD_HEIGHT);
}

function sniffImageMimeType(bytes: Uint8Array, mimeTypeHint: string): { mime: string; isGif: boolean } {
  const isGif =
    bytes.length >= 6 &&
    bytes[0] === 0x47 && // 'G'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46; // 'F'
  if (isGif) {
    return { mime: 'image/gif', isGif: true };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', isGif: false };
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: 'image/png', isGif: false };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', isGif: false };
  }
  const cleanedHint = mimeTypeHint.split(';')[0].trim().toLowerCase();
  return { mime: cleanedHint || 'image/png', isGif: cleanedHint === 'image/gif' };
}

/**
 * Decodes an animated GIF/WebP/APNG or static PNG/JPG/WebP ArrayBuffer into 1..16 sampled 240x135 LCD ImageData frames.
 */
export async function decodeImageOrGifBuffer(
  buffer: ArrayBuffer,
  mimeTypeHint = '',
  custom?: LcdCustomizationOptions
): Promise<{ frames: ImageData[]; isGif: boolean; sourceFrameCount: number }> {
  const bytes = new Uint8Array(buffer);
  const { mime: detectedMime, isGif: isGifSignature } = sniffImageMimeType(bytes, mimeTypeHint);

  // 1. Prefer native Chromium WebCodecs ImageDecoder (supports all GIF89a disposals/extensions & animated WebP/APNG)
  const ImageDecoderCtor = (globalThis as any).ImageDecoder;
  if (typeof ImageDecoderCtor === 'function') {
    try {
      const supported =
        typeof ImageDecoderCtor.isTypeSupported === 'function'
          ? await ImageDecoderCtor.isTypeSupported(detectedMime)
          : true;
      if (supported) {
        const decoder = new ImageDecoderCtor({
          data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
          type: detectedMime,
          preferAnimation: true,
        });
        try {
          await Promise.all([
            decoder.tracks.ready,
            decoder.completed?.catch(() => undefined),
          ]);
          const track = decoder.tracks.selectedTrack;
          const totalRaw = Math.max(1, Number(track?.frameCount) || 1);
          const targetIndices = sampleFrameIndices(totalRaw, MAX_SAMPLED_GIF_FRAMES);
          const sampledFrames: ImageData[] = [];

          for (const idx of targetIndices) {
            const res = await decoder.decode({ frameIndex: idx });
            const vf = res?.image;
            if (!vf) continue;
            try {
              const w = vf.displayWidth || vf.codedWidth || LCD_WIDTH;
              const h = vf.displayHeight || vf.codedHeight || LCD_HEIGHT;
              sampledFrames.push(renderSourceToLcdFrame(vf as CanvasImageSource, w, h, custom));
            } finally {
              vf.close?.();
            }
          }

          if (sampledFrames.length > 0) {
            return {
              frames: sampledFrames,
              isGif: isGifSignature || totalRaw > 1,
              sourceFrameCount: totalRaw,
            };
          }
        } finally {
          decoder.close?.();
        }
      }
    } catch (err) {
      console.warn('WebCodecs ImageDecoder fallback triggered:', err);
    }
  }

  // 2. Fallback to pure-JS omggif for animated GIFs in environments without ImageDecoder
  if (isGifSignature) {
    try {
      const reader = new GifReader(bytes);
      const totalRaw = reader.numFrames();
      if (totalRaw > 0) {
        const gW = reader.width;
        const gH = reader.height;
        const targetIndices = new Set(sampleFrameIndices(totalRaw, MAX_SAMPLED_GIF_FRAMES));

        const compCanvas = document.createElement('canvas');
        compCanvas.width = gW;
        compCanvas.height = gH;
        const compCtx = compCanvas.getContext('2d')!;

        const rawPixels = new Uint8ClampedArray(gW * gH * 4);
        const sampledFrames: ImageData[] = [];

        let previousPixels: Uint8ClampedArray | null = null;

        for (let f = 0; f < totalRaw; f++) {
          const info = reader.frameInfo(f);
          if (info.disposal === 3) {
            previousPixels = new Uint8ClampedArray(rawPixels);
          }

          reader.decodeAndBlitFrameRGBA(f, rawPixels);

          if (targetIndices.has(f)) {
            const frameImgData = new ImageData(new Uint8ClampedArray(rawPixels), gW, gH);
            compCtx.putImageData(frameImgData, 0, 0);
            sampledFrames.push(renderSourceToLcdFrame(compCanvas, gW, gH, custom));
          }

          // Dispose frame region per GIF spec before next frame
          if (info.disposal === 2) {
            const startY = Math.max(0, info.y);
            const endY = Math.min(gH, info.y + info.height);
            const startX = Math.max(0, info.x);
            const endX = Math.min(gW, info.x + info.width);
            for (let y = startY; y < endY; y++) {
              for (let x = startX; x < endX; x++) {
                const p = (y * gW + x) * 4;
                rawPixels[p] = 0;
                rawPixels[p + 1] = 0;
                rawPixels[p + 2] = 0;
                rawPixels[p + 3] = 0;
              }
            }
          } else if (info.disposal === 3 && previousPixels) {
            rawPixels.set(previousPixels);
            previousPixels = null;
          }
        }

        if (sampledFrames.length > 0) {
          return { frames: sampledFrames, isGif: true, sourceFrameCount: totalRaw };
        }
      }
    } catch (err) {
      console.warn('omggif decode fallback triggered:', err);
    }
  }

  // 3. Fallback for static PNG / JPG / WebP / single-frame decode via Blob URL
  const blob = new Blob([bytes], { type: detectedMime });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = objectUrl;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Browser could not decode image binary'));
    });
    const frame = renderSourceToLcdFrame(img, img.naturalWidth, img.naturalHeight, custom);
    return { frames: [frame], isGif: isGifSignature, sourceFrameCount: 1 };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Fetches an external GIF/image URL through our CORS-free local proxy when available,
 * falling back to direct fetch if served purely statically.
 */
export async function fetchAndDecodeExternalGif(
  targetUrl: string,
  custom?: LcdCustomizationOptions
): Promise<{ frames: ImageData[]; isGif: boolean; sourceFrameCount: number }> {
  const proxyUrl = `/api/proxy-gif?url=${encodeURIComponent(targetUrl)}`;
  let resp = await fetch(proxyUrl).catch(() => null);
  if (!resp || !resp.ok) {
    resp = await fetch(targetUrl);
  }
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} while downloading GIF`);
  }
  const contentType = resp.headers.get('content-type') || '';
  const buf = await resp.arrayBuffer();
  return decodeImageOrGifBuffer(buf, contentType, custom);
}
