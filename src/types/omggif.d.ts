declare module 'omggif' {
  export interface GifFrameInfo {
    x: number;
    y: number;
    width: number;
    height: number;
    has_local_palette: boolean;
    palette_offset: number;
    palette_size: number;
    data_offset: number;
    data_length: number;
    transparent_index: number | null;
    interlaced: boolean;
    delay: number;
    disposal: number;
  }

  export class GifReader {
    width: number;
    height: number;
    constructor(buf: Uint8Array);
    numFrames(): number;
    loopCount(): number;
    frameInfo(frameNum: number): GifFrameInfo;
    decodeAndBlitFrameRGBA(frameNum: number, pixels: Uint8Array | Uint8ClampedArray): void;
    decodeAndBlitFrameBGRA(frameNum: number, pixels: Uint8Array | Uint8ClampedArray): void;
  }
}
