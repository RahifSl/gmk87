import React, { useState, useRef, useEffect } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { LCD_WIDTH, LCD_HEIGHT, MAX_TOTAL_FRAMES } from '../services/gmk87Hid';
import { CURATED_POKEMON_SPRITES, getPokemonSpriteUrl } from '../data/gmk87KeymapData';
import {
  ProceduralAnimId,
  GifCategory,
  CURATED_GIF_LIBRARY,
  LcdCustomizationOptions,
  DEFAULT_LCD_CUSTOMIZATION,
  drawProceduralAnimationFrame,
} from '../utils/lcdGenerators';
import { WebGifItem, WEB_GIF_CATEGORIES } from '../data/studioPresets';
import TftScreenPainterAndTimeline from './TftScreenPainterAndTimeline';

/**
 * Visibility-gated 240x135 animated thumbnail canvas (animates ONLY while intersecting viewport & tab visible)
 */
function MiniLcdCardCanvas({
  animId,
  custom,
}: {
  animId: ProceduralAnimId;
  custom: LcdCustomizationOptions;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let frame = 0;
    let intersecting = typeof IntersectionObserver === 'undefined';
    let timer: ReturnType<typeof setInterval> | null = null;

    const draw = () => {
      if (typeof document !== 'undefined' && document.hidden) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawProceduralAnimationFrame(ctx, animId, frame, undefined, undefined, custom);
      frame++;
    };

    const syncTicker = () => {
      const shouldRun = intersecting && (typeof document === 'undefined' || !document.hidden);
      if (shouldRun && !timer) {
        draw();
        timer = setInterval(draw, 140);
      } else if (!shouldRun && timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    // Draw initial static frame synchronously once so off-screen cards already have thumbnail pixels
    draw();

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          intersecting = Boolean(entries[0]?.isIntersecting);
          syncTicker();
        },
        { threshold: 0.05 }
      );
      observer.observe(canvas);
    } else {
      syncTicker();
    }

    document.addEventListener('visibilitychange', syncTicker);
    return () => {
      if (timer) clearInterval(timer);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', syncTicker);
    };
  }, [animId, custom]);

  return (
    <canvas
      ref={canvasRef}
      width={LCD_WIDTH}
      height={LCD_HEIGHT}
      className="w-full aspect-[16/9] rounded-lg border border-[#1e293b] bg-black pixelated-canvas block"
    />
  );
}

export interface GifVaultTabProps {
  lcdCustom: LcdCustomizationOptions;
  onChangeLcdCustom: React.Dispatch<React.SetStateAction<LcdCustomizationOptions>>;
  targetSlot: 0 | 1;
  onSelectSlot: (slot: 0 | 1) => void;
  activePreviewAnim: ProceduralAnimId;
  customPreviewImageData: ImageData | null;
  customPreviewFrames: ImageData[];
  uploadedFrames: ImageData[];
  frameDurationMs: number;
  useFloydSteinbergDither: boolean;
  webGifQuery: string;
  onChangeWebGifQuery: (q: string) => void;
  webGifPage: number;
  webGifResults: WebGifItem[];
  webGifLoading: boolean;
  webGifError: string;
  flashingWebGifId: string | null;
  onSearchWebGifs: (queryOverride?: string, pageNum?: number, append?: boolean) => Promise<void>;
  onPreviewOrFlashWebGif: (item: WebGifItem, flash: boolean) => Promise<void>;
  onPinProceduralPreview: (animId: ProceduralAnimId, title: string) => void;
  onFlashProcedural: (animId: ProceduralAnimId, frameCount: number) => Promise<void>;
  onSelectPokemon: (
    id: number,
    name: string,
    typeLabel: string,
    accentColor: string,
    shiny: boolean,
    flashImmediately: boolean
  ) => Promise<void>;
  onImportGifUrl: (url: string, flash: boolean) => Promise<void>;
  onUpdateFrames: (nextFrames: ImageData[], msg?: string) => void;
  onFlashFrames: (framesToFlash: ImageData[], label: string) => Promise<void>;
  onChangeFrameDurationMs: (ms: number) => void;
  onToggleDither: () => void;
}

export default function GifVaultTab({
  lcdCustom,
  onChangeLcdCustom,
  targetSlot,
  onSelectSlot,
  activePreviewAnim,
  customPreviewImageData,
  customPreviewFrames,
  uploadedFrames,
  frameDurationMs,
  useFloydSteinbergDither,
  webGifQuery,
  onChangeWebGifQuery,
  webGifPage,
  webGifResults,
  webGifLoading,
  webGifError,
  flashingWebGifId,
  onSearchWebGifs,
  onPreviewOrFlashWebGif,
  onPinProceduralPreview,
  onFlashProcedural,
  onSelectPokemon,
  onImportGifUrl,
  onUpdateFrames,
  onFlashFrames,
  onChangeFrameDurationMs,
  onToggleDither,
}: GifVaultTabProps) {
  const [gifCategoryFilter, setGifCategoryFilter] = useState<GifCategory>('All');
  const [gifSearchQuery, setGifSearchQuery] = useState<string>('');
  const [pokemonSearchQuery, setPokemonSearchQuery] = useState<string>('');
  const [shinyPokemon, setShinyPokemon] = useState<boolean>(false);
  const [selectedPokemonId, setSelectedPokemonId] = useState<number | null>(null);
  const [customGifUrl, setCustomGifUrl] = useState<string>('');
  const [showInlinePainterInGifs, setShowInlinePainterInGifs] = useState<boolean>(false);

  const inlineFrames =
    customPreviewFrames.length > 0
      ? customPreviewFrames
      : customPreviewImageData
      ? [customPreviewImageData]
      : uploadedFrames;

  return (
    <div className="space-y-6">
      {/* Top Bar: 240×135 Keyboard Screen Customizer Studio */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-white">
              🎛️ 240×135 Keyboard Screen Customizer (Applied Live to All GIFs & Sprites)
            </h2>
            <p className="text-xs text-slate-400">
              Customize any animation specifically for the GMK87 TFT screen: add a live split-screen
              digital clock, custom callsign tag, CRT scanlines, or GameBoy palette before flashing.
            </p>
          </div>
          <button
            onClick={() => onChangeLcdCustom(DEFAULT_LCD_CUSTOMIZATION)}
            className="px-3 py-1.5 text-xs font-mono rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-400 hover:text-white cursor-pointer"
          >
            Reset Screen Filters
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
            <label className="block text-[11px] font-mono text-slate-400">
              SCREEN HUD / CLOCK OVERLAY
            </label>
            <select
              value={lcdCustom.overlayMode}
              onChange={(e) =>
                onChangeLcdCustom((prev) => ({
                  ...prev,
                  overlayMode: e.target.value as LcdCustomizationOptions['overlayMode'],
                }))
              }
              className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
            >
              <option value="default">Default Animation HUD</option>
              <option value="split-clock">⏱️ Split Clock + GIF (Left Clock + Right Anim)</option>
              <option value="top-tag">🏷️ Top Custom Callsign Banner</option>
              <option value="clean">🖼️ Clean Cinema (Hide HUD Text)</option>
            </select>
          </div>

          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
            <label className="block text-[11px] font-mono text-slate-400">
              CUSTOM SCREEN CALLSIGN TEXT
            </label>
            <input
              type="text"
              maxLength={24}
              value={lcdCustom.customTagText}
              onChange={(e) =>
                onChangeLcdCustom((prev) => ({ ...prev, customTagText: e.target.value }))
              }
              placeholder="GMK87 // PRO"
              className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-[#06b6d4]"
            />
          </div>

          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
            <label className="block text-[11px] font-mono text-slate-400">
              TFT DISPLAY SHADER / PALETTE
            </label>
            <select
              value={lcdCustom.colorFilter}
              onChange={(e) =>
                onChangeLcdCustom((prev) => ({
                  ...prev,
                  colorFilter: e.target.value as LcdCustomizationOptions['colorFilter'],
                }))
              }
              className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
            >
              <option value="none">True 16-Bit RGB565 Color</option>
              <option value="crt-scanlines">📺 Retro CRT Scanline Grille</option>
              <option value="gameboy">🕹️ 1989 GameBoy DMG 4-Shade Green</option>
              <option value="cyber-tint">💎 Night-Vision Cyber Cyan Tint</option>
            </select>
          </div>

          <div className="bg-[#0b0f19] border border-[#1e293b] rounded-lg p-3 space-y-1.5">
            <label className="block text-[11px] font-mono text-slate-400">
              POKÉMON 240×135 FRAMING STYLE
            </label>
            <select
              value={lcdCustom.pokemonLayout}
              onChange={(e) =>
                onChangeLcdCustom((prev) => ({
                  ...prev,
                  pokemonLayout: e.target.value as LcdCustomizationOptions['pokemonLayout'],
                }))
              }
              className="w-full bg-[#131b2e] border border-[#1e293b] rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4]"
            >
              <option value="pokedex-hud">Pokédex Battle Arena + HP Bar</option>
              <option value="fullscreen-cinema">Full-Screen Centered Cinema</option>
              <option value="split-clock-sprite">⏱️ Split Digital Clock + Sprite</option>
              <option value="wanted-bounty">Wanted Bounty Poster Card</option>
            </select>
          </div>
        </div>
      </div>

      {/* Endless Live Web GIF Search Across All Categories */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              🌐 Endless Web GIF Search (All Categories — Anime, Cyberpunk, Gaming, Sci-Fi & More)
            </h2>
            <p className="text-xs text-slate-400">
              Search millions of animated GIFs across any category, decode up to {MAX_TOTAL_FRAMES}{' '}
              composite frames in real time, and preview or flash directly to GMK87 Slot {targetSlot}
              .
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void onSearchWebGifs(webGifQuery, 0, false);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={webGifQuery}
                onChange={(e) => onChangeWebGifQuery(e.target.value)}
                placeholder="Search any GIF (cyberpunk, anime, matrix, cats)..."
                className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-full sm:w-72"
              />
            </div>
            <button
              type="submit"
              disabled={webGifLoading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer whitespace-nowrap"
            >
              {webGifLoading ? 'Searching...' : 'Search GIFs'}
            </button>
          </form>
        </div>

        {/* 13 Quick Category Discovery Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {WEB_GIF_CATEGORIES.map((cat) => {
            const active = webGifQuery.trim().toLowerCase() === cat.query.toLowerCase();
            return (
              <button
                key={cat.label}
                type="button"
                onClick={() => {
                  onChangeWebGifQuery(cat.query);
                  void onSearchWebGifs(cat.query, 0, false);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                    : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#8b5cf6]/60'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {webGifError && (
          <div className="rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/40 px-4 py-3 text-xs text-[#f59e0b] font-mono flex items-center justify-between gap-3">
            <span>{webGifError}</span>
            <button
              type="button"
              onClick={() => onSearchWebGifs(webGifQuery, 0, false)}
              className="px-3 py-1 rounded bg-[#f59e0b] text-slate-950 font-semibold cursor-pointer shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {webGifResults.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {webGifResults.map((item) => {
                const isBusy = flashingWebGifId === item.id;
                return (
                  <div
                    key={item.id}
                    className="rounded-xl p-3 bg-[#0b0f19] border border-[#1e293b] hover:border-[#06b6d4]/70 transition-colors flex flex-col justify-between gap-2.5"
                  >
                    <div className="space-y-2">
                      <div className="w-full aspect-[16/9] rounded-lg border border-[#1e293b] bg-black overflow-hidden flex items-center justify-center">
                        <img
                          src={item.url}
                          alt={item.title}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            if (!el.dataset.proxied) {
                              el.dataset.proxied = '1';
                              el.src = `/api/proxy-gif?url=${encodeURIComponent(item.url)}`;
                            } else if (!el.dataset.previewTried && item.preview) {
                              el.dataset.previewTried = '1';
                              el.src = item.preview;
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span className="text-[#8b5cf6] truncate max-w-[140px]">{item.source}</span>
                        <span>
                          {item.width}×{item.height}
                        </span>
                      </div>
                      <h3 className="text-xs font-semibold text-white truncate">{item.title}</h3>
                    </div>

                    <div className="flex items-center gap-2 pt-0.5">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onPreviewOrFlashWebGif(item, false)}
                        className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isBusy ? 'Decoding...' : 'Monitor'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => onPreviewOrFlashWebGif(item, true)}
                        className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        {isBusy ? 'Wait...' : `Flash Slot ${targetSlot}`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-center pt-2">
              <button
                type="button"
                disabled={webGifLoading}
                onClick={() => onSearchWebGifs(webGifQuery, webGifPage + 1, true)}
                className="px-5 py-2.5 text-xs font-mono font-semibold rounded-lg bg-[#0b0f19] border border-[#06b6d4]/50 text-[#06b6d4] hover:bg-[#06b6d4]/10 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {webGifLoading
                  ? 'Loading More GIFs...'
                  : `Load More GIFs · Showing ${webGifResults.length}`}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Section 1: 33 Widescreen 240×135 Animations */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">
              🌐 Widescreen 240×135 Keyboard Animation Vault ({CURATED_GIF_LIBRARY.length}{' '}
              Custom-Engineered Scenes)
            </h2>
            <p className="text-xs text-slate-400">
              Every animation below is native 240×135 (16:9), viewport-visibility gated in your
              browser, and flashes to Slot {targetSlot} in 1 click.
            </p>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={gifSearchQuery}
              onChange={(e) => setGifSearchQuery(e.target.value)}
              placeholder="Search animations (e.g. Pac-Man, AE86, NERV, Cat)..."
              className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-full sm:w-72"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              'All',
              'Memes & Pets',
              'Retro Arcade',
              'Anime & Mecha',
              'JDM & Racing',
              'Lo-Fi & Sci-Fi',
              'Hardware HUDs',
            ] as GifCategory[]
          ).map((cat) => {
            const count =
              cat === 'All'
                ? CURATED_GIF_LIBRARY.length
                : CURATED_GIF_LIBRARY.filter((g) => g.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setGifCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                  gifCategoryFilter === cat
                    ? 'bg-[#06b6d4] text-slate-950 border-[#06b6d4]'
                    : 'bg-[#0b0f19] text-slate-300 border-[#1e293b] hover:border-[#06b6d4]/60'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {CURATED_GIF_LIBRARY.filter((item) => {
            const matchesCat = gifCategoryFilter === 'All' || item.category === gifCategoryFilter;
            const q = gifSearchQuery.toLowerCase();
            const matchesSearch =
              !q ||
              item.title.toLowerCase().includes(q) ||
              item.subtitle.toLowerCase().includes(q) ||
              item.category.toLowerCase().includes(q);
            return matchesCat && matchesSearch;
          }).map((preset) => {
            const isPreviewing =
              !customPreviewImageData &&
              customPreviewFrames.length === 0 &&
              activePreviewAnim === preset.id;
            return (
              <div
                key={preset.id}
                className={`rounded-xl p-3.5 bg-[#0b0f19] border transition-colors flex flex-col justify-between gap-3 ${
                  isPreviewing ? 'border-2 border-[#06b6d4]' : 'border-[#1e293b]'
                }`}
              >
                <div className="space-y-2">
                  <MiniLcdCardCanvas animId={preset.id} custom={lcdCustom} />

                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-0.5">
                    <span style={{ color: preset.badgeColor }}>{preset.category}</span>
                    <span>
                      {preset.frames}f · {(preset.frames * 64).toFixed(0)}KB
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-white">{preset.title}</h3>
                  <p className="text-[11px] text-slate-400 leading-snug">{preset.subtitle}</p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={() => onPinProceduralPreview(preset.id, preset.title)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#131b2e] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] transition-colors cursor-pointer"
                  >
                    Monitor
                  </button>
                  <button
                    onClick={() => onFlashProcedural(preset.id, preset.frames)}
                    className="flex-1 py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 transition-colors cursor-pointer"
                  >
                    Flash Slot {targetSlot}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 2: 32 Curated Pokémon Animated Showdown Sprites */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-white">
              ⚡ 32 Animated Pokémon Showdown Battle Sprites (Custom 240×135 Framing)
            </h2>
            <p className="text-xs text-slate-400">
              Choose between Pokédex Battle HUD, Full-Screen Cinema, Split Clock + Sprite, or Wanted
              Bounty Poster in the customizer above, then click View or Flash.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={pokemonSearchQuery}
                onChange={(e) => setPokemonSearchQuery(e.target.value)}
                placeholder="Find Pokémon (e.g. Rayquaza, Umbreon, Mew)..."
                className="bg-[#0b0f19] border border-[#1e293b] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#06b6d4] w-56"
              />
            </div>

            <button
              onClick={() => setShinyPokemon((s) => !s)}
              className={`px-3.5 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors cursor-pointer flex items-center gap-1.5 ${
                shinyPokemon
                  ? 'bg-[#f59e0b]/20 border-[#f59e0b] text-[#f59e0b]'
                  : 'bg-[#0b0f19] border-[#1e293b] text-slate-300 hover:border-[#f59e0b]'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {shinyPokemon ? '★ Shiny Mode: ON' : 'Toggle ★ Shiny'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {CURATED_POKEMON_SPRITES.filter((p) => {
            const q = pokemonSearchQuery.toLowerCase();
            return (
              !q ||
              p.name.toLowerCase().includes(q) ||
              p.type.toLowerCase().includes(q) ||
              String(p.id).includes(q)
            );
          }).map((poke) => {
            const spriteUrl = getPokemonSpriteUrl(poke.id, shinyPokemon);
            const isSelected = selectedPokemonId === poke.id;
            return (
              <div
                key={poke.id}
                className={`rounded-xl p-3 bg-[#0b0f19] border flex flex-col items-center justify-between gap-2 transition-colors ${
                  isSelected ? 'border-[#06b6d4]' : 'border-[#1e293b]'
                }`}
              >
                <div className="w-full flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>#{String(poke.id).padStart(3, '0')}</span>
                  <span style={{ color: poke.accentColor }}>
                    {shinyPokemon ? '★ SHINY' : poke.type.split(' ')[0]}
                  </span>
                </div>

                <div className="h-14 flex items-center justify-center">
                  <img
                    src={spriteUrl}
                    alt={poke.name}
                    referrerPolicy="no-referrer"
                    className="max-h-13 max-w-13 object-contain pixelated-canvas"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>

                <div className="text-xs font-bold text-white text-center">{poke.name}</div>

                <div className="w-full flex items-center gap-1 pt-1">
                  <button
                    onClick={() => {
                      setSelectedPokemonId(poke.id);
                      void onSelectPokemon(
                        poke.id,
                        poke.name,
                        poke.type,
                        poke.accentColor,
                        shinyPokemon,
                        false
                      );
                    }}
                    className="flex-1 py-1 text-[10px] font-mono rounded bg-[#131b2e] border border-[#1e293b] text-slate-300 hover:border-[#06b6d4] cursor-pointer"
                  >
                    View
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPokemonId(poke.id);
                      void onSelectPokemon(
                        poke.id,
                        poke.name,
                        poke.type,
                        poke.accentColor,
                        shinyPokemon,
                        true
                      );
                    }}
                    className="flex-1 py-1 text-[10px] font-mono font-semibold rounded bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer"
                  >
                    Flash
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 3: Direct Web GIF / Image URL Importer & Quick Web Presets */}
      <div className="bg-[#131b2e] border border-[#1e293b] rounded-xl p-6 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-white">
            🔗 Direct Web GIF / Sprite URL Importer (Auto-Framed to 240×135 + Custom Overlays)
          </h2>
          <p className="text-xs text-slate-400">
            Paste any direct GIF, PNG, or WebP URL from the web (or click a quick-load web sprite
            preset below). Automatically applies your Split-Clock, Gamer Tag, or CRT Scanline
            settings!
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400">QUICK WEB URLS:</span>
          {[
            {
              label: '⚡ Shiny Rayquaza GIF',
              url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/384.gif',
            },
            {
              label: '🔥 Shiny Charizard GIF',
              url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/6.gif',
            },
            {
              label: '👻 Gengar Battle GIF',
              url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/94.gif',
            },
            {
              label: '🌙 Shiny Umbreon GIF',
              url: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/shiny/197.gif',
            },
          ].map((preset) => (
            <button
              key={preset.label}
              onClick={() => {
                setCustomGifUrl(preset.url);
                void onImportGifUrl(preset.url, false);
              }}
              className="px-2.5 py-1 text-xs font-mono rounded bg-[#0b0f19] border border-[#1e293b] text-cyan-300 hover:border-[#06b6d4] cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={customGifUrl}
            onChange={(e) => setCustomGifUrl(e.target.value)}
            placeholder="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif"
            className="flex-1 bg-[#0b0f19] border border-[#1e293b] rounded-lg px-3.5 py-2 text-xs font-mono text-white focus:outline-none focus:border-[#06b6d4]"
          />
          <button
            onClick={() => onImportGifUrl(customGifUrl, false)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#0b0f19] border border-[#1e293b] text-slate-200 hover:border-[#06b6d4] cursor-pointer whitespace-nowrap"
          >
            Preview 240×135
          </button>
          <button
            onClick={() => onImportGifUrl(customGifUrl, true)}
            className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#06b6d4] text-slate-950 hover:bg-cyan-400 cursor-pointer whitespace-nowrap"
          >
            Flash URL to Slot {targetSlot}
          </button>
          <button
            type="button"
            onClick={() => setShowInlinePainterInGifs((v) => !v)}
            className={`px-4 py-2 text-xs font-semibold rounded-lg border cursor-pointer whitespace-nowrap ${
              showInlinePainterInGifs
                ? 'bg-[#8b5cf6] text-white border-[#8b5cf6]'
                : 'bg-[#0b0f19] border-[#8b5cf6]/60 text-purple-300 hover:border-[#8b5cf6]'
            }`}
          >
            {showInlinePainterInGifs
              ? 'Hide Pixel Painter & Frame Timeline'
              : '🖌️ Open Pixel Painter & Frame Timeline'}
          </button>
        </div>
      </div>

      {showInlinePainterInGifs && (
        <TftScreenPainterAndTimeline
          frames={inlineFrames}
          onUpdateFrames={onUpdateFrames}
          onFlashFrames={onFlashFrames}
          frameDurationMs={frameDurationMs}
          onChangeFrameDurationMs={onChangeFrameDurationMs}
          useFloydSteinbergDither={useFloydSteinbergDither}
          onToggleDither={onToggleDither}
          targetSlot={targetSlot}
          onSelectSlot={onSelectSlot}
        />
      )}
    </div>
  );
}
