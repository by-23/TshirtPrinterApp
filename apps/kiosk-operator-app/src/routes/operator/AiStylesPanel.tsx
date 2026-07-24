import { useEffect, useRef, useState } from "react";
import {
  AI_LOCAL_ENGINE_KEYS,
  type AiConfig,
  type AiStyleAdmin,
  type AiStyleTier,
  type CreateAiStyleInput,
} from "@tshirt/shared-types";
import {
  createAiStyle,
  deleteAiStyle,
  fetchAiConfig,
  fetchAiStylesAdmin,
  regenerateAiStylePreview,
  resolveDesignImageUrl,
  testGeminiApiKey,
  testOpenAIApiKey,
  updateAiConfig,
  updateAiStyle,
  uploadAiStylePreview,
} from "../../lib/pointServer.js";
import { Pencil, Plus, RotateCw, Sparkles, SpinnerIcon, Trash2 } from "../../components/icons.js";

const FIELD_LABEL_CLASS = "flex flex-col gap-1 text-sm";
const FIELD_INPUT_CLASS = "rounded-lg px-3 py-2 text-white outline-none";
const CARD_CLASS = "flex flex-col gap-4 rounded-xl p-5";
const CARD_STYLE = { backgroundColor: "var(--operator-card-bg)", border: "1px solid var(--operator-card-border)" };
const INPUT_STYLE = { backgroundColor: "var(--operator-page-bg)", border: "1px solid var(--operator-card-border)" };
const LABEL_STYLE = { color: "var(--operator-text-muted)" };
const PRIMARY_BTN =
  "rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50";
const SECONDARY_BTN =
  "rounded-full px-4 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50";
const SECONDARY_BTN_STYLE = {
  backgroundColor: "var(--operator-page-bg)",
  border: "1px solid var(--operator-card-border)",
};

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

function maskKey(value: string | null | undefined, configured: boolean, envLabel: string): string {
  if (value != null && value.length > 0) {
    return "•".repeat(Math.min(value.length, 24));
  }
  if (configured) return envLabel;
  return "Не задан";
}

/** ChatGPT / Gemini API keys — same edit/mask/test pattern as Giphy in DesignsPanel. */
function AiApiKeysCard() {
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [openaiDraft, setOpenaiDraft] = useState("");
  const [geminiDraft, setGeminiDraft] = useState("");
  const [openaiEditing, setOpenaiEditing] = useState(false);
  const [geminiEditing, setGeminiEditing] = useState(false);
  const [savingField, setSavingField] = useState<"openai" | "gemini" | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [openaiTest, setOpenaiTest] = useState<KeyTestState>({ status: "idle" });
  const [geminiTest, setGeminiTest] = useState<KeyTestState>({ status: "idle" });

  useEffect(() => {
    fetchAiConfig()
      .then((data) => {
        setConfig(data);
        setOpenaiDraft(data.openaiApiKey ?? "");
        setGeminiDraft(data.geminiApiKey ?? "");
      })
      .catch(() => setLoadError(true));
  }, []);

  async function saveKey(field: "openai" | "gemini") {
    setSavingField(field);
    setNote(null);
    if (field === "openai") setOpenaiTest({ status: "idle" });
    else setGeminiTest({ status: "idle" });
    try {
      const updated = await updateAiConfig(
        field === "openai"
          ? { openaiApiKey: openaiDraft.trim() || null }
          : { geminiApiKey: geminiDraft.trim() || null },
      );
      setConfig(updated);
      setOpenaiDraft(updated.openaiApiKey ?? "");
      setGeminiDraft(updated.geminiApiKey ?? "");
      if (field === "openai") setOpenaiEditing(false);
      else setGeminiEditing(false);
      setNote("Сохранено");
    } catch {
      setNote("Не удалось сохранить");
    } finally {
      setSavingField(null);
      setTimeout(() => setNote(null), 3000);
    }
  }

  async function testKey(field: "openai" | "gemini") {
    const setTest = field === "openai" ? setOpenaiTest : setGeminiTest;
    const editing = field === "openai" ? openaiEditing : geminiEditing;
    const draft = field === "openai" ? openaiDraft : geminiDraft;
    setTest({ status: "checking" });
    setNote(null);
    try {
      const result =
        field === "openai"
          ? await testOpenAIApiKey(editing ? draft : undefined)
          : await testGeminiApiKey(editing ? draft : undefined);
      if (result.ok) {
        setTest({ status: "success" });
      } else {
        setTest({ status: "error", message: result.error ?? "Ключ отклонён" });
      }
    } catch (error) {
      setTest({
        status: "error",
        message: error instanceof Error ? error.message : "Не удалось выполнить проверку",
      });
    }
  }

  if (loadError) {
    return (
      <div className={`${CARD_CLASS} mb-4`} style={CARD_STYLE}>
        <p className="text-sm text-red-400">Не удалось загрузить API-ключи ИИ</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={`${CARD_CLASS} mb-4`} style={CARD_STYLE}>
        <div className="flex items-center gap-2 text-sm" style={LABEL_STYLE}>
          <SpinnerIcon className="h-4 w-4 animate-spin" />
          Загрузка ключей…
        </div>
      </div>
    );
  }

  const canTestOpenai = openaiEditing ? openaiDraft.trim().length > 0 : config.openaiKeyConfigured;
  const canTestGemini = geminiEditing ? geminiDraft.trim().length > 0 : config.geminiKeyConfigured;

  return (
    <div className={`${CARD_CLASS} mb-4`} style={CARD_STYLE}>
      <span className="font-bold text-white">API-ключи премиум-обработки</span>
      <p className="text-xs" style={LABEL_STYLE}>
        Ключи из панели имеют приоритет над переменными OPENAI_API_KEY / GEMINI_API_KEY в .env точки. Без ключа
        соответствующий провайдер скрыт на киоске. «Проверить» не тратит токены генерации картинок.
      </p>

      <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
        ChatGPT (OpenAI)
        {openaiEditing ? (
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
            placeholder="sk-..."
            value={openaiDraft}
            onChange={(event) => {
              setOpenaiDraft(event.target.value);
              setOpenaiTest({ status: "idle" });
            }}
          />
        ) : (
          <div className={`${FIELD_INPUT_CLASS} text-white`} style={{ ...INPUT_STYLE, cursor: "default" }}>
            {maskKey(config.openaiApiKey, config.openaiKeyConfigured, "Задан в .env (скрыт)")}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {!openaiEditing ? (
            <button
              type="button"
              onClick={() => {
                setOpenaiEditing(true);
                setOpenaiTest({ status: "idle" });
              }}
              className={SECONDARY_BTN}
              style={SECONDARY_BTN_STYLE}
            >
              Изменить
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void saveKey("openai")}
                disabled={savingField === "openai"}
                className={PRIMARY_BTN}
                style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
              >
                {savingField === "openai" ? "Сохранение…" : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setOpenaiDraft(config.openaiApiKey ?? "");
                  setOpenaiEditing(false);
                  setOpenaiTest({ status: "idle" });
                }}
                disabled={savingField === "openai"}
                className={SECONDARY_BTN}
                style={SECONDARY_BTN_STYLE}
              >
                Отмена
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void testKey("openai")}
            disabled={!canTestOpenai || openaiTest.status === "checking" || savingField === "openai"}
            className={SECONDARY_BTN}
            style={SECONDARY_BTN_STYLE}
            title={canTestOpenai ? undefined : "Сначала введите или сохраните ключ"}
          >
            {openaiTest.status === "checking" ? (
              <span className="inline-flex items-center gap-1.5">
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                Проверка…
              </span>
            ) : (
              "Проверить"
            )}
          </button>
          {openaiTest.status === "success" ? <span className="text-xs text-emerald-400">Ключ рабочий</span> : null}
          {openaiTest.status === "error" ? <span className="text-xs text-red-400">{openaiTest.message}</span> : null}
        </div>
      </label>

      <label className={FIELD_LABEL_CLASS} style={LABEL_STYLE}>
        Gemini (Google)
        {geminiEditing ? (
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            className={FIELD_INPUT_CLASS}
            style={INPUT_STYLE}
            placeholder="AIza..."
            value={geminiDraft}
            onChange={(event) => {
              setGeminiDraft(event.target.value);
              setGeminiTest({ status: "idle" });
            }}
          />
        ) : (
          <div className={`${FIELD_INPUT_CLASS} text-white`} style={{ ...INPUT_STYLE, cursor: "default" }}>
            {maskKey(config.geminiApiKey, config.geminiKeyConfigured, "Задан в .env (скрыт)")}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {!geminiEditing ? (
            <button
              type="button"
              onClick={() => {
                setGeminiEditing(true);
                setGeminiTest({ status: "idle" });
              }}
              className={SECONDARY_BTN}
              style={SECONDARY_BTN_STYLE}
            >
              Изменить
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void saveKey("gemini")}
                disabled={savingField === "gemini"}
                className={PRIMARY_BTN}
                style={{ backgroundColor: "var(--brand-primary, #ec4899)" }}
              >
                {savingField === "gemini" ? "Сохранение…" : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setGeminiDraft(config.geminiApiKey ?? "");
                  setGeminiEditing(false);
                  setGeminiTest({ status: "idle" });
                }}
                disabled={savingField === "gemini"}
                className={SECONDARY_BTN}
                style={SECONDARY_BTN_STYLE}
              >
                Отмена
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => void testKey("gemini")}
            disabled={!canTestGemini || geminiTest.status === "checking" || savingField === "gemini"}
            className={SECONDARY_BTN}
            style={SECONDARY_BTN_STYLE}
            title={canTestGemini ? undefined : "Сначала введите или сохраните ключ"}
          >
            {geminiTest.status === "checking" ? (
              <span className="inline-flex items-center gap-1.5">
                <SpinnerIcon className="h-3.5 w-3.5 animate-spin" />
                Проверка…
              </span>
            ) : (
              "Проверить"
            )}
          </button>
          {geminiTest.status === "success" ? <span className="text-xs text-emerald-400">Ключ рабочий</span> : null}
          {geminiTest.status === "error" ? <span className="text-xs text-red-400">{geminiTest.message}</span> : null}
        </div>
      </label>

      {note ? (
        <span className="text-xs" style={LABEL_STYLE}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

type KeyTestState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "success" }
  | { status: "error"; message: string };

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
    engineKey: style.engineKey || AI_LOCAL_ENGINE_KEYS[0],
    sortOrder: String(style.sortOrder),
  };
}

function AiStyleRow({
  style,
  onChanged,
  onDeleted,
}: {
  style: AiStyleAdmin;
  onChanged: (updated: AiStyleAdmin) => void;
  onDeleted: (id: number) => void;
}) {
  const isPremium = style.tier === "premium";
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<EditableFields>(() => toEditableFields(style));
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingEnabled, setTogglingEnabled] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [previewNonce, setPreviewNonce] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!expanded) setFields(toEditableFields(style));
  }, [style, expanded]);

  async function handleToggleEnabled(enabled: boolean) {
    setTogglingEnabled(true);
    try {
      onChanged(await updateAiStyle(style.id, { enabled }));
    } catch {
      // fail-open
    } finally {
      setTogglingEnabled(false);
    }
  }

  async function handleSave() {
    const sortOrder = Number(fields.sortOrder);
    setSaving(true);
    setSavedNote(null);
    try {
      const patch: Parameters<typeof updateAiStyle>[1] = {
        label: fields.label.trim(),
        description: fields.description.trim(),
        promptTemplate: fields.promptTemplate.trim(),
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : undefined,
      };
      if (!isPremium) {
        patch.engineKey = fields.engineKey;
      }
      const updated = await updateAiStyle(style.id, patch);
      onChanged(updated);
      setSavedNote("Сохранено");
    } catch {
      setSavedNote("Не удалось сохранить");
    } finally {
      setSaving(false);
      setTimeout(() => setSavedNote(null), 3000);
    }
  }

  async function handleRegeneratePreview(provider?: "chatgpt" | "gemini") {
    setRegenerating(true);
    try {
      await regenerateAiStylePreview(style.id, provider);
      setPreviewNonce((n) => n + 1);
    } catch {
      setSavedNote("Не удалось обновить превью");
      setTimeout(() => setSavedNote(null), 3000);
    } finally {
      setRegenerating(false);
    }
  }

  async function handleUploadPreview(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      await uploadAiStylePreview(style.id, file);
      setPreviewNonce((n) => n + 1);
    } catch {
      setSavedNote("Не удалось загрузить превью");
      setTimeout(() => setSavedNote(null), 3000);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Удалить стиль «${style.label}»?`)) return;
    try {
      await deleteAiStyle(style.id);
      onDeleted(style.id);
    } catch {
      // fail-open
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
            {isPremium
              ? `Премиум · ChatGPT / Gemini · key: ${style.key}`
              : `${ENGINE_LABELS[style.engineKey] ?? style.engineKey} · key: ${style.key}`}
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
        {isPremium ? (
          <>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ border: "1px solid var(--operator-card-border)" }}
            >
              {uploading ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : null}
              Загрузить превью
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void handleUploadPreview(event.target.files?.[0])}
            />
            <button
              type="button"
              onClick={() => void handleRegeneratePreview("chatgpt")}
              disabled={regenerating}
              title="Сгенерировать превью через ChatGPT (платно)"
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ border: "1px solid var(--operator-card-border)" }}
            >
              {regenerating ? <SpinnerIcon className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              ChatGPT
            </button>
            <button
              type="button"
              onClick={() => void handleRegeneratePreview("gemini")}
              disabled={regenerating}
              title="Сгенерировать превью через Gemini (платно)"
              className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              style={{ border: "1px solid var(--operator-card-border)" }}
            >
              Gemini
            </button>
          </>
        ) : (
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
        )}
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
            {isPremium
              ? "Промпт для ChatGPT / Gemini (на английском)"
              : "Промпт для Pollinations (облачная стилизация, на английском)"}
            <textarea
              value={fields.promptTemplate}
              onChange={(event) => setFields((prev) => ({ ...prev, promptTemplate: event.target.value }))}
              rows={3}
              className={`${FIELD_INPUT_CLASS} resize-y font-mono text-xs`}
              style={INPUT_STYLE}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            {!isPremium ? (
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
            ) : (
              <div />
            )}
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

function CreateAiStyleForm({
  tier,
  onCreated,
  onCancel,
}: {
  tier: AiStyleTier;
  onCreated: (style: AiStyleAdmin) => void;
  onCancel: () => void;
}) {
  const isPremium = tier === "premium";
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
      tier,
      ...(isPremium ? {} : { engineKey }),
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
          Ключ (латиница, напр. {isPremium ? "premium_vaporwave" : "cyberpunk"})
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
        {isPremium ? "Промпт для ChatGPT / Gemini (на английском)" : "Промпт для Pollinations (на английском)"}
        <textarea
          value={promptTemplate}
          onChange={(event) => setPromptTemplate(event.target.value)}
          rows={3}
          className={`${FIELD_INPUT_CLASS} resize-y font-mono text-xs`}
          style={INPUT_STYLE}
        />
      </label>
      {!isPremium && (
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
      )}
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
 * Sidebar's "ИИ-стили" — CRUD for standard (Pollinations/local) and premium
 * (ChatGPT/Gemini) style catalogs.
 */
export function AiStylesPanel() {
  const [tier, setTier] = useState<AiStyleTier>("standard");
  const [styles, setStyles] = useState<AiStyleAdmin[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setStyles(null);
    setLoadError(false);
    setCreating(false);
    fetchAiStylesAdmin(tier)
      .then(setStyles)
      .catch(() => setLoadError(true));
  }, [tier]);

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
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

      <div className="mb-4 flex gap-2">
        {(
          [
            { id: "standard" as const, label: "Обычные" },
            { id: "premium" as const, label: "Премиум (ChatGPT / Gemini)" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTier(tab.id)}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white"
            style={{
              backgroundColor: tier === tab.id ? "var(--brand-primary, #ec4899)" : "transparent",
              border: "1px solid var(--operator-card-border)",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <AiApiKeysCard />

      <p className="mb-4 max-w-2xl text-sm" style={LABEL_STYLE}>
        {tier === "standard"
          ? "Обычные стили: Pollinations (промпт) с офлайн-фолбэком на локальный движок. Превью рендерится локально."
          : "Премиум-стили для ChatGPT и Gemini — отдельный каталог с более сильной стилизацией. Превью можно загрузить вручную или сгенерировать через API (платно)."}
      </p>

      <div className={CARD_CLASS} style={CARD_STYLE}>
        {creating && <CreateAiStyleForm tier={tier} onCreated={handleCreated} onCancel={() => setCreating(false)} />}

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
