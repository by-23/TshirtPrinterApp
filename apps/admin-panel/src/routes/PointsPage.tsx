import { useEffect, useState } from "react";
import { Table, Button, Modal, Form, Input, Select, Badge, Space, message, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import type {
  CreatePointInput,
  PointCreatedResponse,
  PointDetail,
  UpdatePointInput,
} from "@tshirt/shared-types";
import { apiClient } from "../lib/apiClient.js";

type PointFormValues = CreatePointInput & Pick<UpdatePointInput, "status">;

export function PointsPage() {
  const [points, setPoints] = useState<PointDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PointDetail | null>(null);
  const [form] = Form.useForm<PointFormValues>();
  const [createdToken, setCreatedToken] = useState<{ id: string; syncToken: string } | null>(null);

  async function load() {
    setLoading(true);
    try {
      setPoints(await apiClient.get<PointDetail[]>("/points"));
    } catch {
      message.error("Не удалось загрузить точки");
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
    form.setFieldsValue({ uploadMode: "relay" });
    setModalOpen(true);
  }

  function openEdit(point: PointDetail) {
    setEditing(point);
    form.setFieldsValue({
      name: point.name,
      uploadMode: point.uploadMode,
      status: point.status,
      operatorLogin: point.operatorLogin,
      operatorPassword: "",
    });
    setModalOpen(true);
  }

  async function handleSubmit() {
    const values = await form.validateFields();
    try {
      if (editing) {
        const { operatorPassword, ...rest } = values;
        const payload: UpdatePointInput = operatorPassword ? { ...rest, operatorPassword } : rest;
        await apiClient.patch(`/points/${editing.id}`, payload);
        message.success("Точка обновлена");
      } else {
        const created = await apiClient.post<PointCreatedResponse>("/points", values);
        message.success("Точка создана");
        setCreatedToken({ id: created.id, syncToken: created.syncToken });
      }
      setModalOpen(false);
      await load();
    } catch {
      message.error("Ошибка сохранения точки");
    }
  }

  async function handleDelete(id: string) {
    try {
      await apiClient.delete(`/points/${id}`);
      message.success("Точка удалена");
      await load();
    } catch {
      message.error("Ошибка удаления точки");
    }
  }

  return (
    <div>
      <Space style={{ marginBottom: 16, width: "100%", justifyContent: "space-between" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          Точки
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Добавить точку
        </Button>
      </Space>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={points}
        columns={[
          {
            title: "Онлайн",
            dataIndex: "isOnline",
            render: (isOnline: boolean) =>
              isOnline ? (
                <Badge status="success" text="В сети" />
              ) : (
                <Badge status="default" text="Не в сети" />
              ),
          },
          { title: "Название", dataIndex: "name" },
          {
            title: "Статус",
            dataIndex: "status",
            render: (status: string) => (status === "open" ? "Открыта" : "Закрыта"),
          },
          {
            title: "QR-режим",
            dataIndex: "uploadMode",
            render: (mode: string) => (mode === "relay" ? "Relay" : "Own-WiFi"),
          },
          { title: "Логин оператора", dataIndex: "operatorLogin" },
          {
            title: "Действия",
            render: (_: unknown, record: PointDetail) => (
              <Space>
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
        title={editing ? "Редактировать точку" : "Новая точка"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => void handleSubmit()}
        okText="Сохранить"
        cancelText="Отмена"
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="Название" rules={[{ required: true, message: "Введите название" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="uploadMode" label="Режим QR-загрузки" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "relay", label: "Relay (через центр)" },
                { value: "wifi", label: "Own-WiFi" },
              ]}
            />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="Статус точки">
              <Select
                options={[
                  { value: "open", label: "Открыта" },
                  { value: "closed", label: "Закрыта" },
                ]}
              />
            </Form.Item>
          )}
          <Form.Item
            name="operatorLogin"
            label="Логин оператора"
            rules={[{ required: true, message: "Введите логин оператора" }]}
          >
            <Input />
          </Form.Item>
          <Form.Item
            name="operatorPassword"
            label={
              editing ? "Новый пароль оператора (оставьте пустым, чтобы не менять)" : "Пароль оператора"
            }
            rules={editing ? [] : [{ required: true, min: 6, message: "Минимум 6 символов" }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Точка создана"
        open={createdToken !== null}
        onOk={() => setCreatedToken(null)}
        onCancel={() => setCreatedToken(null)}
        okText="Понятно"
        cancelButtonProps={{ style: { display: "none" } }}
      >
        <Typography.Paragraph>
          Скопируйте эти значения в переменные окружения point-server (<code>POINT_SYNC_ID</code>,{" "}
          <code>POINT_SYNC_TOKEN</code>) — токен показывается только один раз.
        </Typography.Paragraph>
        <Typography.Paragraph copyable={{ text: createdToken?.id }}>
          POINT_SYNC_ID: {createdToken?.id}
        </Typography.Paragraph>
        <Typography.Paragraph copyable={{ text: createdToken?.syncToken }}>
          POINT_SYNC_TOKEN: {createdToken?.syncToken}
        </Typography.Paragraph>
      </Modal>
    </div>
  );
}
