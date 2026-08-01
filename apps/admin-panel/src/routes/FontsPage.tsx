import { useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { DeleteOutlined, FontSizeOutlined, UploadOutlined } from "@ant-design/icons";
import type { AdminFont, FontKind } from "@tshirt/shared-types";
import { apiClient, ApiError } from "../lib/apiClient.js";

const KIND_LABELS: Record<FontKind, string> = {
  system: "Системный",
  local: "Встроенный",
  google: "Google",
  custom: "Загруженный",
};

const KIND_COLORS: Record<FontKind, string> = {
  system: "default",
  local: "blue",
  google: "purple",
  custom: "green",
};

export function FontsPage() {
  const [fonts, setFonts] = useState<AdminFont[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadFamily, setUploadFamily] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      setFonts(await apiClient.get<AdminFont[]>("/fonts"));
    } catch {
      message.error("Не удалось загрузить шрифты");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleToggle(font: AdminFont, enabled: boolean) {
    setTogglingId(font.id);
    try {
      const updated = await apiClient.patch<AdminFont>(`/fonts/${font.id}`, { enabled });
      setFonts((prev) => prev.map((row) => (row.id === font.id ? updated : row)));
      message.success(enabled ? "Шрифт включён — точки обновятся" : "Шрифт выключен — точки обновятся");
    } catch {
      message.error("Не удалось изменить шрифт");
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(font: AdminFont) {
    Modal.confirm({
      title: `Удалить «${font.label}»?`,
      content: "Шрифт исчезнет на всех точках после синхронизации.",
      okText: "Удалить",
      okType: "danger",
      cancelText: "Отмена",
      onOk: async () => {
        setDeletingId(font.id);
        try {
          await apiClient.delete(`/fonts/${font.id}`);
          setFonts((prev) => prev.filter((row) => row.id !== font.id));
          message.success("Шрифт удалён");
        } catch {
          message.error("Не удалось удалить шрифт");
        } finally {
          setDeletingId(null);
        }
      },
    });
  }

  async function handleUpload() {
    if (!selectedFile) {
      message.error("Выберите файл шрифта");
      return;
    }
    const label = uploadLabel.trim() || selectedFile.name.replace(/\.[^./]+$/, "");
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("label", label);
      if (uploadFamily.trim()) {
        formData.append("familyName", uploadFamily.trim());
      }
      await apiClient.uploadForm<AdminFont>("/fonts", formData);
      message.success("Шрифт загружен — точки обновятся");
      setUploadOpen(false);
      setUploadLabel("");
      setUploadFamily("");
      setSelectedFile(null);
      await load();
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : "";
      message.error(`Не удалось загрузить${detail ? `: ${detail}` : ""}`);
    } finally {
      setUploading(false);
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>
            Шрифты
          </Typography.Title>
          <Typography.Text type="secondary">
            Встроенные шрифты редактора можно выключить. Новые — загрузить файлом (TTF/OTF/WOFF) —
            синхронизируются со всеми точками.
          </Typography.Text>
        </div>
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>
          Добавить шрифт
        </Button>
      </div>

      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={fonts}
          locale={{ emptyText: <Empty description="Нет шрифтов" /> }}
          pagination={false}
          columns={[
            {
              title: "Название",
              dataIndex: "label",
              render: (label: string, row: AdminFont) => (
                <Space>
                  <FontSizeOutlined />
                  <span style={{ fontFamily: row.family }}>{label}</span>
                </Space>
              ),
            },
            {
              title: "Тип",
              dataIndex: "kind",
              width: 140,
              render: (kind: FontKind) => <Tag color={KIND_COLORS[kind]}>{KIND_LABELS[kind]}</Tag>,
            },
            {
              title: "CSS family",
              dataIndex: "family",
              ellipsis: true,
              render: (family: string) => (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {family}
                </Typography.Text>
              ),
            },
            {
              title: "Включён",
              dataIndex: "enabled",
              width: 120,
              render: (enabled: boolean, row: AdminFont) => (
                <Switch
                  checked={enabled}
                  loading={togglingId === row.id}
                  onChange={(checked) => void handleToggle(row, checked)}
                />
              ),
            },
            {
              title: "",
              key: "actions",
              width: 80,
              render: (_: unknown, row: AdminFont) =>
                row.deletable ? (
                  <Button
                    danger
                    type="text"
                    icon={<DeleteOutlined />}
                    loading={deletingId === row.id}
                    onClick={() => handleDelete(row)}
                  />
                ) : null,
            },
          ]}
        />
      </Card>

      <Modal
        title="Добавить шрифт"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => void handleUpload()}
        confirmLoading={uploading}
        okText="Загрузить"
        cancelText="Отмена"
        destroyOnClose
      >
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <div>
            <Typography.Text>Файл (TTF, OTF, WOFF, WOFF2)</Typography.Text>
            <div style={{ marginTop: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setSelectedFile(file);
                  if (file && !uploadLabel.trim()) {
                    setUploadLabel(file.name.replace(/\.[^./]+$/, ""));
                  }
                }}
              />
            </div>
          </div>
          <div>
            <Typography.Text>Название</Typography.Text>
            <Input
              value={uploadLabel}
              onChange={(event) => setUploadLabel(event.target.value)}
              placeholder="Например, Montserrat Bold"
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Typography.Text type="secondary">Имя семейства CSS (необязательно)</Typography.Text>
            <Input
              value={uploadFamily}
              onChange={(event) => setUploadFamily(event.target.value)}
              placeholder="По умолчанию = название"
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>
    </Space>
  );
}
