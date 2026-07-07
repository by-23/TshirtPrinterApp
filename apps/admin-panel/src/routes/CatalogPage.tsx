import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, Switch, Space, message, Typography, Upload } from "antd";
import { PlusOutlined, UploadOutlined } from "@ant-design/icons";
import { designCategorySchema, type CreateDesignInput, type Design } from "@tshirt/shared-types";
import { apiClient } from "../lib/apiClient.js";

const CATEGORY_LABELS: Record<string, string> = {
  memes: "Мемы",
  anime_movies: "Аниме",
  games: "Игры",
  text: "Надписи",
  custom: "Свой дизайн",
  ai_style: "ИИ-стиль",
};

const CATEGORY_OPTIONS = designCategorySchema.options.map((value) => ({
  value,
  label: CATEGORY_LABELS[value] ?? value,
}));

export function CatalogPage() {
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Design | null>(null);
  const [form] = Form.useForm<CreateDesignInput>();

  async function load() {
    setLoading(true);
    try {
      setDesigns(await apiClient.get<Design[]>("/catalog/designs"));
    } catch {
      message.error("Не удалось загрузить каталог");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ isFeatured: false });
    setModalOpen(true);
  }

  function openEdit(design: Design) {
    setEditing(design);
    form.setFieldsValue({
      category: design.category,
      title: design.title,
      isFeatured: design.isFeatured,
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    try {
      if (editing) {
        await apiClient.patch<Design>(`/catalog/designs/${editing.id}`, values);
        message.success("Дизайн обновлён");
      } else {
        await apiClient.post<Design>("/catalog/designs", values);
        message.success("Дизайн добавлен");
      }
      setModalOpen(false);
      await load();
    } catch {
      message.error("Ошибка сохранения дизайна");
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/catalog/designs/${id}`);
      message.success("Дизайн удалён");
      await load();
    } catch {
      message.error("Ошибка удаления дизайна");
    }
  }

  async function handleUpload(designId: string, file: File) {
    try {
      await apiClient.uploadFile<Design>(`/catalog/designs/${designId}/image`, file);
      message.success("Картинка загружена");
      await load();
    } catch {
      message.error("Ошибка загрузки картинки");
    }
  }

  async function toggleFeatured(design: Design, isFeatured: boolean) {
    try {
      await apiClient.patch<Design>(`/catalog/designs/${design.id}`, { isFeatured });
      await load();
    } catch {
      message.error("Ошибка обновления");
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Мастер-каталог
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Добавить дизайн
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={designs}
        columns={[
          {
            title: "Превью",
            dataIndex: "imageUrl",
            render: (url: string) =>
              url ? (
                <img
                  src={url}
                  alt=""
                  style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }}
                />
              ) : (
                <div
                  style={{ width: 48, height: 48, background: "#f0f0f0", borderRadius: 4 }}
                  aria-hidden
                />
              ),
          },
          {
            title: "Категория",
            dataIndex: "category",
            render: (category: string) => CATEGORY_LABELS[category] ?? category,
          },
          { title: "Название", dataIndex: "title" },
          {
            title: "Витрина",
            dataIndex: "isFeatured",
            render: (value: boolean, record: Design) => (
              <Switch checked={value} onChange={(checked) => void toggleFeatured(record, checked)} />
            ),
          },
          {
            title: "Действия",
            render: (_: unknown, record: Design) => (
              <Space>
                <Upload
                  showUploadList={false}
                  beforeUpload={(file) => {
                    void handleUpload(record.id, file);
                    return false;
                  }}
                >
                  <Button size="small" icon={<UploadOutlined />}>
                    Картинка
                  </Button>
                </Upload>
                <Button size="small" onClick={() => openEdit(record)}>
                  Изменить
                </Button>
                <Button size="small" danger onClick={() => void handleDelete(record.id)}>
                  Удалить
                </Button>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? "Редактировать дизайн" : "Новый дизайн"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="category" label="Категория" rules={[{ required: true }]}>
            <Select options={CATEGORY_OPTIONS} />
          </Form.Item>
          <Form.Item name="title" label="Название" rules={[{ required: true, message: "Введите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="isFeatured" label="Показывать в баннере «Популярные»" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
