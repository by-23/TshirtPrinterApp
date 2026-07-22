import { useEffect, useState } from "react";
import { Form, InputNumber, Button, Card, Select, Space, message, Typography, Empty } from "antd";
import {
  GARMENT_FABRICS,
  GARMENT_SIZES,
  garmentTypeSchema,
  printSizeSchema,
  type PartialPriceConfig,
  type PointDetail,
  type PriceConfig,
} from "@tshirt/shared-types";
import { apiClient, ApiError } from "../lib/apiClient.js";

const GARMENT_TYPE_LABELS: Record<string, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};
const FABRIC_LABELS: Record<string, string> = { cotton: "Хлопок", premium: "Премиум" };
const PRINT_SIZE_LABELS: Record<string, string> = {
  small: "Маленький",
  medium: "Средний",
  large: "Большой",
};

const GARMENT_TYPES = garmentTypeSchema.options;
const PRINT_SIZES = printSizeSchema.options;

function PriceConfigFields({ optional }: { optional?: boolean }) {
  const rules = optional ? [] : [{ required: true, message: "Укажите цену" }];
  return (
    <>
      <Typography.Title level={5}>Базовая цена</Typography.Title>
      <Space wrap size="large">
        {GARMENT_TYPES.map((type) => (
          <Form.Item
            key={type}
            name={["basePriceTenge", type]}
            label={GARMENT_TYPE_LABELS[type] ?? type}
            rules={rules}
          >
            <InputNumber min={0} step={100} addonAfter="₸" />
          </Form.Item>
        ))}
      </Space>

      <Typography.Title level={5}>Наценка за ткань</Typography.Title>
      <Space wrap size="large">
        {GARMENT_FABRICS.map((fabric) => (
          <Form.Item
            key={fabric}
            name={["fabricSurchargeTenge", fabric]}
            label={FABRIC_LABELS[fabric] ?? fabric}
            rules={rules}
          >
            <InputNumber min={0} step={100} addonAfter="₸" />
          </Form.Item>
        ))}
      </Space>

      <Typography.Title level={5}>Наценка за размер</Typography.Title>
      <Space wrap size="large">
        {GARMENT_SIZES.map((size) => (
          <Form.Item key={size} name={["sizeSurchargeTenge", size]} label={size} rules={rules}>
            <InputNumber min={0} step={100} addonAfter="₸" />
          </Form.Item>
        ))}
      </Space>

      <Typography.Title level={5}>Наценка за размер принта</Typography.Title>
      <Space wrap size="large">
        {PRINT_SIZES.map((size) => (
          <Form.Item
            key={size}
            name={["printSizeSurchargeTenge", size]}
            label={PRINT_SIZE_LABELS[size] ?? size}
            rules={rules}
          >
            <InputNumber min={0} step={100} addonAfter="₸" />
          </Form.Item>
        ))}
      </Space>
    </>
  );
}

/** Drops empty/undefined entries so the PUT only sends fields the admin actually filled in. */
function cleanPartialConfig(values: PartialPriceConfig): PartialPriceConfig {
  const result: Record<string, Record<string, number>> = {};
  for (const [mapKey, map] of Object.entries(values)) {
    if (!map) continue;
    const cleanedMap: Record<string, number> = {};
    for (const [key, value] of Object.entries(map as Record<string, number | null | undefined>)) {
      if (typeof value === "number") {
        cleanedMap[key] = value;
      }
    }
    if (Object.keys(cleanedMap).length > 0) {
      result[mapKey] = cleanedMap;
    }
  }
  return result as PartialPriceConfig;
}

export function PricingPage() {
  const [globalForm] = Form.useForm<PriceConfig>();
  const [overrideForm] = Form.useForm<PartialPriceConfig>();
  const [points, setPoints] = useState<PointDetail[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>(undefined);
  const [hasOverride, setHasOverride] = useState(false);
  const [loadingGlobal, setLoadingGlobal] = useState(false);
  const [loadingOverride, setLoadingOverride] = useState(false);

  useEffect(() => {
    void loadGlobal();
    apiClient
      .get<PointDetail[]>("/points")
      .then(setPoints)
      .catch(() => message.error("Не удалось загрузить точки"));
  }, []);

  async function loadGlobal() {
    setLoadingGlobal(true);
    try {
      const config = await apiClient.get<PriceConfig>("/pricing/global");
      globalForm.setFieldsValue(config);
    } catch {
      message.error("Не удалось загрузить глобальные цены");
    } finally {
      setLoadingGlobal(false);
    }
  }

  async function saveGlobal() {
    const values = await globalForm.validateFields();
    try {
      await apiClient.put("/pricing/global", values);
      message.success("Глобальные цены сохранены");
    } catch {
      message.error("Ошибка сохранения цен");
    }
  }

  async function loadOverride(pointId: string) {
    setSelectedPointId(pointId);
    overrideForm.resetFields();
    setLoadingOverride(true);
    try {
      const override = await apiClient.get<{ pointId: string; config: PartialPriceConfig }>(
        `/pricing/overrides/${pointId}`,
      );
      overrideForm.setFieldsValue(override.config);
      setHasOverride(true);
    } catch (err) {
      setHasOverride(false);
      if (!(err instanceof ApiError && err.status === 404)) {
        message.error("Не удалось загрузить override");
      }
    } finally {
      setLoadingOverride(false);
    }
  }

  async function saveOverride() {
    if (!selectedPointId) return;
    const values = overrideForm.getFieldsValue();
    try {
      await apiClient.put(`/pricing/overrides/${selectedPointId}`, cleanPartialConfig(values));
      message.success("Override сохранён");
      setHasOverride(true);
    } catch {
      message.error("Ошибка сохранения override");
    }
  }

  async function deleteOverride() {
    if (!selectedPointId) return;
    try {
      await apiClient.delete(`/pricing/overrides/${selectedPointId}`);
      message.success("Override удалён — точка снова использует глобальные цены");
      overrideForm.resetFields();
      setHasOverride(false);
    } catch {
      message.error("Ошибка удаления override");
    }
  }

  return (
    <div>
      <Card title="Глобальные цены" loading={loadingGlobal} style={{ marginBottom: 24 }}>
        <Form form={globalForm} layout="vertical">
          <PriceConfigFields />
        </Form>
        <Button type="primary" onClick={() => void saveGlobal()}>
          Сохранить глобальные цены
        </Button>
      </Card>

      <Card title="Override цен для точки">
        <Select
          placeholder="Выберите точку"
          style={{ width: 320, marginBottom: 16 }}
          options={points.map((p) => ({ value: p.id, label: p.name }))}
          onChange={(value: string) => void loadOverride(value)}
          value={selectedPointId}
        />
        {selectedPointId ? (
          <>
            <Typography.Paragraph type="secondary">
              Заполните только те поля, которые должны отличаться от глобальных цен для этой точки.
              Пустое поле — цена наследуется из глобального конфига.
            </Typography.Paragraph>
            <Form form={overrideForm} layout="vertical">
              <PriceConfigFields optional />
            </Form>
            <Space>
              <Button type="primary" loading={loadingOverride} onClick={() => void saveOverride()}>
                Сохранить override
              </Button>
              {hasOverride && (
                <Button danger onClick={() => void deleteOverride()}>
                  Удалить override
                </Button>
              )}
            </Space>
          </>
        ) : (
          <Empty description="Выберите точку, чтобы настроить override цен" />
        )}
      </Card>
    </div>
  );
}
