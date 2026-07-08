import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Canvas } from "fabric";
import type { StickerResult } from "@tshirt/shared-types";
import { fetchTrendingStickers, searchStickers, selectSticker } from "../../lib/pointServer.js";
import { addImageFromUrl } from "../canvasImage.js";
import { SearchIcon, SpinnerIcon } from "../../components/icons.js";

export interface StickerPickerProps {
  canvas: Canvas | null;
}

const SEARCH_DEBOUNCE_MS = 400;

/**
 * "Стикеры" toolbar tool — live Giphy Stickers search (decision: no
 * category tabs, search-only + a trending default grid), proxied through
 * point-server so the API key stays server-side (see
 * `modules/stickers/routes.ts`). Picking a sticker downloads + caches it as
 * a PNG on the point and adds it to the canvas like any other image.
 */
export function StickerPicker({ canvas }: StickerPickerProps) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<StickerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyConfigured, setKeyConfigured] = useState(true);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const request = search ? searchStickers(search) : fetchTrendingStickers();
    request
      .then((result) => {
        if (requestIdRef.current !== requestId) return;
        setItems(result.items);
        setKeyConfigured(result.keyConfigured);
      })
      .catch(() => {
        if (requestIdRef.current !== requestId) return;
        setItems([]);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
  }, [search]);

  async function handlePick(sticker: StickerResult) {
    if (!canvas || placingId) return;
    setPlacingId(sticker.giphyId);
    try {
      const url = await selectSticker(sticker.giphyId, sticker.previewUrl);
      await addImageFromUrl(canvas, url);
    } catch {
      // Fail-open — leave the picker open so the customer can try another sticker.
    } finally {
      setPlacingId(null);
    }
  }

  return (
    <div className="editor-tool-panel max-h-[70vh]">
      <h4 className="editor-tool-title">{t("editor.toolbar.stickers")}</h4>

      <div className="editor-tool-search flex flex-shrink-0 items-center gap-2 rounded-full bg-ink-800">
        <SearchIcon className="editor-tool-search-icon flex-shrink-0 text-ink-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder={t("editor.toolbar.stickersList.searchPlaceholder")}
          className="w-full bg-transparent text-white focus:outline-none"
        />
      </div>

      <div className="editor-tool-sticker-grid min-h-0 flex-1 overflow-y-auto">
        {!keyConfigured ? (
          <p className="editor-tool-caption p-2 text-center text-ink-300">{t("editor.toolbar.stickersList.noApiKey")}</p>
        ) : loading ? (
          <div className="flex h-32 items-center justify-center">
            <SpinnerIcon className="h-8 w-8 animate-spin text-ink-400" />
          </div>
        ) : items.length === 0 ? (
          <p className="editor-tool-caption p-2 text-center text-ink-300">
            {search ? t("gallery.noResults") : t("editor.toolbar.stickersList.trendingEmpty")}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {items.map((sticker) => (
              <button
                key={sticker.giphyId}
                type="button"
                onClick={() => void handlePick(sticker)}
                disabled={placingId !== null}
                aria-label={sticker.title}
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-ink-800 p-2 transition-transform hover:scale-105 hover:bg-ink-700 disabled:opacity-50"
              >
                <img src={sticker.previewUrl} alt={sticker.title} className="h-full w-full object-contain" />
                {placingId === sticker.giphyId && (
                  <span className="absolute inset-0 flex items-center justify-center bg-ink-950/70">
                    <SpinnerIcon className="h-7 w-7 animate-spin text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
