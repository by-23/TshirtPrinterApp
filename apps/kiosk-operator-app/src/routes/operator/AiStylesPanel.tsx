import { useEffect, useState } from "react";
import { AI_LOCAL_ENGINE_KEYS, type AiStyleAdmin, type CreateAiStyleInput } from "@tshirt/shared-types";
import {
  createAiStyle,
  deleteAiStyle,
  fetchAiStylesAdmin,
  regenerateAiStylePreview,
  resolveDesignImageUrl,
  updateAiStyle,
} from "../../lib/pointServer.js";
import { Pencil, Plus, RotateCw, Sparkles, SpinnerIcon, Trash2 } from "../../components/icons.js";

const FIELD_LABEL_CLASS = "flex flex-col gap-1 text-sm";
const FIELD_INPUT_CLASS = "rounded-lg px-3 py-2 text-white outline-none";
const CARD_CLASS = "flex flex-col gap-4 rounded-xl p-5";
const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const INPUT_STYLE = { backgroundColor: "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };

const ENGINE_LABELS: Record<string, string> = {
  "animegan:hayao": "AnimeGAN — Хаяо (Гибли)",
  "animegan:shinkai": "AnimeGAN — Синкай",
  "animegan:paprika": "AnimeGAN — Паприка (яркое)",
  "animegan:facepaint": "AnimeGAN — портрет",
  "fast-neural-style:mosaic": "Fast Neural Style — мозаика",
  "fast-neural-style:candy": "Fast Neural Style — конфетти",
  "fast-neural-style:rain-princess": "Fast Neural Style — дождливая принцесса",
  "fast-neural-style:udnie": "Fast Neural Style — удни",
  "fast-neural-style:pointilism": "Fast Neural Style — пуантилизм",
  "filter:noir": "Фильтр — нуар",
  "filter:sepia": "Фильтр — сепия",
  "filter:popArt": "Фильтр — поп-арт/комикс",
  "filter:pencilSketch": "Фильтр — карандашный скетч",
};

interface EditableFields {
  label: string;
  description: string;
  promptTemplate: string;
  engineKey: string;
  sortOrder: string;
}

function toEditableFields(style: AiStyleAdmin): EditableFields {
  return {
    label: style.label,
    description: style.description,
    promptTemplate: style.promptTemplate,
    engineKey: style.engineKey,
    sortOrder: String(style.sortOrder),
  };
}

/** One style row — preview + summary, expandable into a full edit form. */
function AiStyleRow({
  style,
  onChanged,
  onDeleted,
}: {
  style: AiStyleAdmin;
  onChanged: (updated: AiStyleAdmin) => void;
  onDeleted: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<EditableFields>(() => toEditableFields(style));
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);

  useEffect(() => {
    if (!expanded) setFields(toEditableFields(style));
  }, [style, expanded]);

  async function handleToggleEnabled(enabled: boolean) {
    setTogglingEnabled(true);
    try {
      onChanged(await updateAiStyle(style.id, { enabled }));
    } catch {
      // fail-open: checkbox snaps back on next list refresh
    } finally {
      setTogglingEnabled(false);
    }
  }

  async function handleSave() {
    const sortOrder = Number(fields.sortOrder);
    setSaving(true);
    setSavedNote(null);
    try {
      const updated = await updateAiStyle(style.id, {
        label: fields.label.trim(),
        description: fields.description.trim(),
        promptTemplate: fields.promptTemplate.trim(),
        engineKey: fields.engineKey,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
      });
      onChanged(updated);
      setSavedNote("Сохранено");
    } catch {
      setSavedNote("Не удалось сохранить");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  async function handleRegeneratePreview() {
    setRegenerating(true);
    try {
      await regenerateAiStylePreview(style.id);
      setPreviewNonce((n) => n + 1);
    } catch {
      // fail-open: preview just stays as-is
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить стиль «${style.label}»?`)) return;
    try {
      await deleteAiStyle(style.id);
      onDeleted(style.id);
    } catch {
      // fail-open: row stays in the list on failure
    }
  }

  const previewSrc = `${resolveDesignImageUrl(style.previewUrl)}${previewNonce ? `?v=${previewNonce}` : ""}`;

  return (
    <div className="flex flex-col gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--operator-page-bg)" }}>
      <div className="flex flex-wrap items-center gap-3">
        <img
          src={previewSrc}
          alt=""
          className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
          style={{ border: "1px solid var(--operator-card-border)" }}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold text-white">{style.label}</span>
          <span className="truncate text-xs" style={LABEL_STYLE}>
            {style.description}
          </span>
          <span className="truncate text-xs" style={LABEL_STYLE}>
            {ENGINE_LABELS[style.engineKey] ?? style.engineKey} · key: {style.key}
          </span>
        </div>
        <label className="flex items-center gap-2 text-xs text-white">
          <input
            type="checkbox"
            checked={style.enabled}
            disabled={togglingEnabled}
            onChange={(event) => void handleToggleEnabled(event.target.checked)}
          />
          Включён
        </label>
        <button
          type="button"
          onClick={() => void handleRegeneratePreview()}
          disabled={regenerating}
          title="Обновить превью"
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          style={{ border: "1px solid var(--operator-card-border)" }}
        >
          {regenerating ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          Превью
        </button>
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          style={{ border: "1px solid var(--operator-card-border)" }}
        >
          <Pencil className="h-3.5 w-3.5" />
          {expanded ? "Скрыть" : "Изменить"}
        </button>
        <button
          type="button"
          onClick={() => void handleDelete()}
          className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white opacity-80 transition-opacity hover:opacity-100"
          style={{ border: "1px solid var(--operator-card-border)" }}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-3 border-t pt-3" style={{ borderColor: "var(--operator-card-border)" }}>
          <div className="grid grid-cols-2 gap-3">
            <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
              Название
              <input
                type="text"
                value={fields.label}
                onChange={(event) => setFields((prev) => ({ ...prev, label: event.target.value }))}
                className={FIELD_INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </label>
            <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
              Описание (подпись на карточке)
              <input
                type="text"
                value={fields.description}
                onChange={(event) => setFields((prev) => ({ ...prev, description: event.target.value }))}
                className={FIELD_INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </label>
          </div>

          <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
            Промпт для Pollinations (облачная стилизация, на английском)
            <textarea
              value={fields.promptTemplate}
              onChange={(event) => setFields((prev) => ({ ...prev, promptTemplate: event.target.value }))}
              rows={3}
              className={`${FIELD_INPUT_CLASS} resize-y font-mono text-xs`}
              style={INPUT_STYLE}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
              Локальный движок (офлайн-фолбэк)
              <select
                value={fields.engineKey}
                onChange={(event) => setFields((prev) => ({ ...prev, engineKey: event.target.value }))}
                className={FIELD_INPUT_CLASS}
                style={INPUT_STYLE}
              >
                {AI_LOCAL_ENGINE_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {ENGINE_LABELS[key] ?? key}
                  </option>
                ))}
              </select>
            </label>
            <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
              Порядок сортировки
              <input
                type="number"
                value={fields.sortOrder}
                onChange={(event) => setFields((prev) => ({ ...prev, sortOrder: event.target.value }))}
                className={FIELD_INPUT_CLASS}
                style={INPUT_STYLE}
              />
            </label>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
              style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
            >
              {saving ? "Сохранение…" : "Сохранить"}
            </button>
            {savedNote && (
              <span className="text-xs" style={LABEL_STYLE}>
                {savedNote}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline form for creating a brand-new style — collapsed behind "Добавить стиль" until needed. */
function CreateAiStyleForm({ onCreated, onCancel }: { onCreated: (style: AiStyleAdmin) => void; onCancel: () => void }) {
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState("");
  const [engineKey, setEngineKey] = useState<string>(AI_LOCAL_ENGINE_KEYS[0]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    const trimmedKey = key.trim();
    if (!/^[a-z0-9_]+$/.test(trimmedKey)) {
      setError("Ключ: только строчные латинские буквы, цифры и подчёркивания");
      return;
    }
    if (!label.trim() || !description.trim() || !promptTemplate.trim()) {
      setError("Заполните название, описание и промпт");
      return;
    }
    setCreating(true);
    setError(null);
    const input: CreateAiStyleInput = {
      key: trimmedKey,
      label: label.trim(),
      description: description.trim(),
      promptTemplate: promptTemplate.trim(),
      engineKey,
    };
    try {
      onCreated(await createAiStyle(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать стиль");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg px-4 py-3" style={{ backgroundColor: "var(--operator-page-bg)" }}>
      <div className="grid grid-cols-2 gap-3">
        <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
          Ключ (латиница, напр. cyberpunk)
          <input
            type="text"
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </label>
        <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
          Название
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
          />
        </label>
      </div>
      <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
        Описание (подпись на карточке)
        <input
          type="text"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          className={FIELD_INPUT_CLASS}
          style={INPUT_STYLE}
        />
      </label>
      <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
        Промпт для Pollinations (на английском)
        <textarea
          value={promptTemplate}
          onChange={(event) => setPromptTemplate(event.target.value)}
          rows={3}
          className={`${FIELD_INPUT_CLASS} resize-y font-mono text-xs`}
          style={INPUT_STYLE}
        />
      </label>
      <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
        Локальный движок (офлайн-фолбэк)
        <select
          value={engineKey}
          onChange={(event) => setEngineKey(event.target.value)}
          className={FIELD_INPUT_CLASS}
          style={INPUT_STYLE}
        >
          {AI_LOCAL_ENGINE_KEYS.map((k) => (
            <option key={k} value={k}>
              {ENGINE_LABELS[k] ?? k}
            </option>
          ))}
        </select>
      </label>
      {error && <span className="text-xs text-red-400">{error}</span>}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleCreate()}
          disabled={creating}
          className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white transition-opacity disabled:opacity-50"
          style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
        >
          {creating ? "Создание…" : "Создать стиль"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold text-white"
          style={{ border: "1px solid var(--operator-card-border)" }}
        >
          Отмена
        </button>
      </div>
    </div>
  );
}

/**
 * Sidebar's "ИИ-стили" item — full CRUD over the `ai_styles` catalog:
 * per-style prompt (cloud, Pollinations) + local engine (offline fallback),
 * enable toggle, sort order and on-demand preview regeneration. Mirrors the
 * "Дизайны" tab's card/form conventions (`DesignsPanel.tsx`).
 */
export function AiStylesPanel() {
  const [styles, setStyles] = useState<AiStyleAdmin[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchAiStylesAdmin()
      .then(setStyles)
      .catch(() => setLoadError(true));
  }, []);

  function handleChanged(updated: AiStyleAdmin) {
    setStyles((prev) => prev?.map((style) => (style.id === updated.id ? updated : style)) ?? prev);
  }

  function handleDeleted(id: number) {
    setStyles((prev) => prev?.filter((style) => style.id !== id) ?? prev);
  }

  function handleCreated(created: AiStyleAdmin) {
    setStyles((prev) => (prev ? [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder) : [created]));
    setCreating(false);
  }

  return (
    <div
      className="app-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
      style={{ padding: "var(--operator-designs-padding-y) var(--operator-designs-padding-x)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-extrabold text-white" style={{ fontSize: "var(--operator-designs-title-size)" }}>
          <Sparkles className="h-6 w-6" />
          ИИ-стили
        </h2>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-semibold text-white"
          style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
        >
          <Plus className="h-4 w-4" />
          Добавить стиль
        </button>
      </div>

      <p className="mb-4 max-w-2xl text-sm" style={LABEL_STYLE}>
        Каждый стиль стилизует фото через Pollinations (промпт, нужен интернет), а если это не удаётся — точка
        автоматически переключается на локальную офлайн-модель (движок). Превью — реальный рендер локального движка на
        тестовом фото.
      </p>

      <div className={CARD_CLASS} style={CARD_STYLE}>
        {creating && <CreateAiStyleForm onCreated={handleCreated} onCancel={() => setCreating(false)} />}

        {loadError && <p className="text-sm text-red-400">Не удалось загрузить список стилей</p>}

        {!styles && !loadError && (
          <div className="flex items-center gap-2 text-sm" style={LABEL_STYLE}>
            <SpinnerIcon className="h-4 w-4 animate-spin" />
            Загрузка…
          </div>
        )}

        {styles?.length === 0 && !creating && (
          <p className="text-sm" style={LABEL_STYLE}>
            Стилей пока нет — нажмите «Добавить стиль».
          </p>
        )}

        {styles
          ?.slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((style) => (
            <AiStyleRow key={style.id} style={style} onChanged={handleChanged} onDeleted={handleDeleted} />
          ))}
      </div>
    </div>
  );
}
