import { useEffect, useRef, useState } from "react";
import type { AdsVideo } from "@tshirt/shared-types";
import {
  deleteAdsVideo,
  fetchAdsVideosAdmin,
  reorderAdsVideos,
  resolveDesignImageUrl,
  updateAdsVideo,
  uploadAdsVideo,
} from "../../lib/pointServer.js";
import {
  ChevronDown,
  ChevronLeft,
  FilmIcon,
  Plus,
  SpinnerIcon,
  Trash2,
  Upload,
} from "../../components/icons.js";

const CARD_CLASS = "flex flex-col gap-4 rounded-xl p-5";
const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };
const PRIMARY_BTN =
  "rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-full px-3 py-1.5 text-xs font-semibold text-white transition-opacity disabled:opacity-50";
const SECONDARY_BTN_STYLE = {
  backgroundColor: "var(--operator-page-bg)",
  border: "1px solid var(--operator-card-border)",
};

/**
 * Operator «Реклама» panel — upload / enable / reorder / delete attract-loop
 * videos stored on the point (`data/ads-videos/`). The kiosk polls
 * `GET /ads/videos` and plays enabled rows after idle timeout.
 */
export function AdsVideosPanel() {
  const [videos, setVideos] = useState<AdsVideo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAdsVideosAdmin()
      .then((rows) => {
        if (!cancelled) setVideos(rows);
      })
      .catch(() => {
        if (!cancelled) setNote("Не удалось загрузить список видео");
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function showNote(message: string) {
    setNote(message);
    window.setTimeout(() => setNote(null), 3000);
  }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploaded: AdsVideo[] = [];
      for (const file of Array.from(files)) {
        uploaded.push(await uploadAdsVideo(file));
      }
      setVideos((prev) => [...prev, ...uploaded]);
      showNote(uploaded.length === 1 ? "Видео загружено" : `Загружено: ${uploaded.length}`);
    } catch {
      showNote("Не удалось загрузить видео");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleToggleEnabled(video: AdsVideo, enabled: boolean) {
    try {
      const updated = await updateAdsVideo(video.id, { enabled });
      setVideos((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch {
      showNote("Не удалось изменить статус");
    }
  }

  async function handleRename(video: AdsVideo, title: string) {
    const trimmed = title.trim();
    if (!trimmed || trimmed === video.title) return;
    try {
      const updated = await updateAdsVideo(video.id, { title: trimmed });
      setVideos((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
    } catch {
      showNote("Не удалось переименовать");
    }
  }

  async function handleMove(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= videos.length) return;
    const next = [...videos];
    const a = next[index];
    const b = next[nextIndex];
    if (!a || !b) return;
    next[index] = b;
    next[nextIndex] = a;
    setVideos(next);
    try {
      const reordered = await reorderAdsVideos(next.map((row) => row.id));
      setVideos(reordered);
    } catch {
      showNote("Не удалось изменить порядок");
      // Reload to resync with server.
      try {
        setVideos(await fetchAdsVideosAdmin());
      } catch {
        // fail-open
      }
    }
  }

  async function handleDelete(video: AdsVideo) {
    if (!window.confirm(`Удалить «${video.title}»?`)) return;
    try {
      await deleteAdsVideo(video.id);
      setVideos((prev) => prev.filter((row) => row.id !== video.id));
    } catch {
      showNote("Не удалось удалить");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className={CARD_CLASS} style={CARD_STYLE}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FilmIcon className="h-6 w-6 text-white" />
            <div className="flex flex-col">
              <h2 className="text-lg font-bold text-white">Реклама на киоске</h2>
              <p className="text-sm" style={LABEL_STYLE}>
                Видеозаставки при простое. Крутятся по кругу, пока кто-то не коснётся экрана.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className={`flex items-center gap-2 ${PRIMARY_BTN}`}
            style={{ backgroundColor: "#ff2d95" }}
          >
            {uploading ? <SpinnerIcon className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {uploading ? "Загрузка…" : "Добавить видео"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/webm,video/ogg,.mp4,.webm,.ogg"
            multiple
            className="hidden"
            onChange={(event) => void handleUpload(event.target.files)}
          />
        </div>
        {note ? (
          <p className="text-sm" style={LABEL_STYLE}>
            {note}
          </p>
        ) : null}
      </div>

      {!loaded ? (
        <div className="flex items-center gap-2 text-sm" style={LABEL_STYLE}>
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          Загрузка…
        </div>
      ) : videos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-3 rounded-xl px-6 py-16 text-center"
          style={CARD_STYLE}
        >
          <Upload className="h-10 w-10" style={LABEL_STYLE} />
          <p className="text-base font-semibold text-white">Пока нет видео</p>
          <p className="max-w-md text-sm" style={LABEL_STYLE}>
            Нажмите «Добавить видео» и выберите mp4 / webm / ogg. Можно загрузить несколько файлов сразу.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {videos.map((video, index) => (
            <AdsVideoRow
              key={video.id}
              video={video}
              isFirst={index === 0}
              isLast={index === videos.length - 1}
              onToggleEnabled={(enabled) => void handleToggleEnabled(video, enabled)}
              onRename={(title) => void handleRename(video, title)}
              onMoveUp={() => void handleMove(index, -1)}
              onMoveDown={() => void handleMove(index, 1)}
              onDelete={() => void handleDelete(video)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function AdsVideoRow({
  video,
  isFirst,
  isLast,
  onToggleEnabled,
  onRename,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  video: AdsVideo;
  isFirst: boolean;
  isLast: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  onRename: (title: string) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [titleDraft, setTitleDraft] = useState(video.title);
  const src = resolveDesignImageUrl(video.fileUrl);

  useEffect(() => {
    setTitleDraft(video.title);
  }, [video.title]);

  return (
    <li className="flex flex-wrap items-center gap-4 rounded-xl p-4" style={CARD_STYLE}>
      <video
        src={src}
        className="h-24 w-40 flex-shrink-0 rounded-lg object-cover"
        style={{ border: "1px solid var(--operator-card-border)", backgroundColor: "#000" }}
        muted
        playsInline
        preload="metadata"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <input
          value={titleDraft}
          onChange={(event) => setTitleDraft(event.target.value)}
          onBlur={() => onRename(titleDraft)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
          }}
          className="rounded-lg px-3 py-2 text-sm font-semibold text-white outline-none"
          style={{ backgroundColor: "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" }}
        />
        <span className="truncate text-xs" style={LABEL_STYLE}>
          {video.enabled ? "В плейлисте киоска" : "Выключено — не показывается"}
        </span>
      </div>
      <label className="flex items-center gap-2 text-xs text-white">
        <input type="checkbox" checked={video.enabled} onChange={(event) => onToggleEnabled(event.target.checked)} />
        Включено
      </label>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={isFirst}
          title="Выше"
          className={SECONDARY_BTN}
          style={SECONDARY_BTN_STYLE}
        >
          <ChevronLeft className="h-4 w-4 rotate-90" />
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={isLast}
          title="Ниже"
          className={SECONDARY_BTN}
          style={SECONDARY_BTN_STYLE}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className={`flex items-center gap-1 ${SECONDARY_BTN}`}
        style={SECONDARY_BTN_STYLE}
      >
        <Trash2 className="h-3.5 w-3.5" />
        Удалить
      </button>
    </li>
  );
}
