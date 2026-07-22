import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Popover,
  Segmented,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, EditOutlined, UploadOutlined } from "@ant-design/icons";
import type { CatalogManualDesign, CatalogManualPointStatus, GalleryCategory } from "@tshirt/shared-types";
import { apiClient, ApiError } from "../lib/apiClient.js";

const CATEGORY_LABELS: Record<GalleryCategory, string> = {
  memes: "Мемы",
  anime_movies: "Аниме",
  games: "Игры",
};
const CATEGORIES: GalleryCategory[] = ["memes", "anime_movies", "games"];

/** How many uploads run in parallel when an admin selects several files at once. */
const UPLOAD_CONCURRENCY = 3;

async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  async function next(): Promise<void> {
    const current = index++;
    if (current >= items.length) return;
    await worker(items[current]!);
    await next();
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => next()));
}

/** Renders a manual design's PNG via an authenticated blob fetch — an `<img src>` can't carry the admin's Bearer token itself. */
function ManualDesignThumbnail({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    apiClient
      .getBlob(`/catalog-manual/${id}/file`)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id]);

  return (
    <div
      style={{
        height: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fafafa",
        overflow: "hidden",
      }}
    >
      {src ? (
        <img src={src} alt="" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
      ) : (
        <Spin size="small" />
      )}
    </div>
  );
}

function pointStatusLabel(point: CatalogManualPointStatus): { text: string; color: string } {
  if (point.status === "applied") return { text: "Применено", color: "success" };
  if (point.status === "error") return { text: `Ошибка: ${point.lastError ?? "неизвестная"}`, color: "error" };
  if (!point.isOnline) return { text: "Не в сети — применит при подключении", color: "default" };
  return { text: "Ожидает применения", color: "warning" };
}

function SyncStatus({ design }: { design: CatalogManualDesign }) {
  if (design.totalPoints === 0) {
    return (
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Нет ни одной точки
      </Typography.Text>
    );
  }

  const lagging = design.points.filter((point) => point.status !== "applied");
  const allApplied = lagging.length === 0;

  return (
    <Space size={4}>
      <Typography.Text style={{ fontSize: 12 }} type={allApplied ? "success" : "secondary"}>
        {design.appliedCount}/{design.totalPoints} точек применили
      </Typography.Text>
      {!allApplied && (
        <Popover
          title="Отстающие точки"
          content={
            <List
              size="small"
              dataSource={lagging}
              style={{ maxWidth: 280 }}
              renderItem={(point) => {
                const { text, color } = pointStatusLabel(point);
                return (
                  <List.Item>
                    <Space direction="vertical" size={0}>
                      <Typography.Text strong>{point.pointName}</Typography.Text>
                      <Tag color={color}>{text}</Tag>
                    </Space>
                  </List.Item>
                );
              }}
            />
          }
        >
          <a>Кто отстаёт?</a>
        </Popover>
      )}
    </Space>
  );
}

export function CatalogPage() {
  const [category, setCategory] = useState<GalleryCategory>("memes");
  const [designs, setDesigns] = useState<CatalogManualDesign[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState<CatalogManualDesign | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState<GalleryCategory>("memes");
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      setDesigns(await apiClient.get<CatalogManualDesign[]>(`/catalog-manual?category=${category}`));
    } catch {
      message.error("Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  async function handleFilesSelected(files: FileList | null) {
    if (!files || files.length === 0) return;
    const pngFiles = Array.from(files).filter((file) => file.type === "image/png" || file.name.toLowerCase().endsWith(".png"));
    if (pngFiles.length === 0) {
      message.error("Принимаются только PNG-файлы");
      return;
    }

    setUploading(true);
    let succeeded = 0;
    let failed = 0;
    await runWithConcurrency(pngFiles, UPLOAD_CONCURRENCY, async (file) => {
      try {
        await apiClient.uploadFile<CatalogManualDesign>(`/catalog-manual?category=${category}`, file);
        succeeded += 1;
      } catch (err) {
        failed += 1;
        const detail = err instanceof ApiError ? err.message : "";
        message.error(`${file.name}: не удалось загрузить${detail ? ` (${detail})` : ""}`);
      }
    });
    setUploading(false);

    if (succeeded > 0) {
      message.success(`Загружено ${succeeded} из ${pngFiles.length}`);
    } else if (failed === 0) {
      return;
    }
    await load();
  }

  function openEdit(design: CatalogManualDesign) {
    setEditing(design);
    setEditTitle(design.title);
    setEditCategory(design.category);
  }

  async function handleSaveEdit() {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await apiClient.patch(`/catalog-manual/${editing.id}`, {
        title: editTitle.trim() || undefined,
        category: editCategory,
      });
      message.success("Сохранено");
      setEditing(null);
      await load();
    } catch {
      message.error("Ошибка сохранения");
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDelete(design: CatalogManualDesign) {
    setDeletingId(design.id);
    try {
      await apiClient.delete(`/catalog-manual/${design.id}`);
      setDesigns((prev) => prev.filter((item) => item.id !== design.id));
      message.success("Удалено");
    } catch {
      message.error("Ошибка удаления");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }} wrap>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Каталог
        </Typography.Title>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png"
            multiple
            style={{ display: "none" }}
            disabled={uploading}
            onChange={(event) => {
              void handleFilesSelected(event.target.files);
              event.target.value = "";
            }}
          />
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={uploading}
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? "Загрузка…" : "Загрузить PNG"}
          </Button>
        </div>
      </Space>

      <Typography.Paragraph type="secondary">
        Картинки, загруженные здесь, отправляются на все точки и отображаются в галерее киоска выше
        автоматически скачанных — уступая только тем, у которых больше отпечатков («сердечек»). Управлять
        ими (переименовывать, менять категорию, удалять) можно только отсюда — на точке они read-only.
      </Typography.Paragraph>

      <Segmented
        value={category}
        onChange={(value) => setCategory(value as GalleryCategory)}
        options={CATEGORIES.map((item) => ({ label: CATEGORY_LABELS[item], value: item }))}
        style={{ marginBottom: 16 }}
      />

      {loading ? (
        <Spin />
      ) : designs.length === 0 ? (
        <Empty description="В этой категории пока нет загруженных вручную картинок" />
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {designs.map((design) => (
            <Card
              key={design.id}
              size="small"
              cover={<ManualDesignThumbnail id={design.id} />}
              actions={[
                <EditOutlined key="edit" onClick={() => openEdit(design)} />,
                <DeleteOutlined key="delete" onClick={() => void handleDelete(design)} style={{ color: deletingId === design.id ? "#ccc" : undefined }} />,
              ]}
            >
              <Card.Meta
                title={design.title}
                description={<SyncStatus design={design} />}
              />
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="Редактировать картинку"
        open={editing !== null}
        onCancel={() => setEditing(null)}
        onOk={() => void handleSaveEdit()}
        okText="Сохранить"
        cancelText="Отмена"
        confirmLoading={savingEdit}
        destroyOnHidden
      >
        <Space direction="vertical" style={{ width: "100%" }} size="middle">
          <div>
            <Typography.Text>Название</Typography.Text>
            <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
          </div>
          <div>
            <Typography.Text>Категория</Typography.Text>
            <Select<GalleryCategory>
              style={{ width: "100%" }}
              value={editCategory}
              onChange={setEditCategory}
              options={CATEGORIES.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }))}
            />
          </div>
        </Space>
      </Modal>
    </div>
  );
}
