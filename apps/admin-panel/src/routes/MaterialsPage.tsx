import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Card, Checkbox, Empty, Select, Space, Typography, message } from "antd";
import {
  DEFAULT_GARMENT_AVAILABILITY,
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  garmentTypeSchema,
  withGarmentAvailabilityDefaults,
  type GarmentAvailabilityConfig,
  type GarmentFabric,
  type GarmentSize,
  type GarmentType,
  type PointDetail,
} from "@tshirt/shared-types";
import { apiClient, ApiError } from "../lib/apiClient.js";

const TYPE_LABELS: Record<GarmentType, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};

const COLOR_LABELS: Record<string, string> = {
  white: "Белый",
  black: "Чёрный",
  gray: "Серый",
  cream: "Кремовый",
  pink: "Розовый",
  lightBlue: "Голубой",
  green: "Зелёный",
  yellow: "Жёлтый",
  red: "Красный",
  darkGreen: "Тёмно-зелёный",
  purple: "Фиолетовый",
  navy: "Тёмно-синий",
};

const FABRIC_LABELS: Record<GarmentFabric, string> = {
  cotton: "Хлопок",
  premium: "Премиум",
};

function ToggleGrid({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={{ marginBottom: 24 }}>
      <Typography.Title level={5}>{title}</Typography.Title>
      <Space wrap size={[12, 12]}>
        {children}
      </Space>
    </div>
  );
}

/**
 * Per-point garment availability override. Saving creates/updates a central
 * override that pushes to the point and locks the local operator «Материалы»
 * panel until the override is deleted.
 */
export function MaterialsPage() {
  const [points, setPoints] = useState<PointDetail[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | undefined>(undefined);
  const [availability, setAvailability] = useState<GarmentAvailabilityConfig>(DEFAULT_GARMENT_AVAILABILITY);
  const [hasOverride, setHasOverride] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<PointDetail[]>("/points")
      .then(setPoints)
      .catch(() => message.error("Не удалось загрузить точки"));
  }, []);

  async function loadOverride(pointId: string) {
    setSelectedPointId(pointId);
    setLoading(true);
    try {
      const override = await apiClient.get<{ pointId: string; availability: GarmentAvailabilityConfig }>(
        `/garment-availability/overrides/${pointId}`,
      );
      setAvailability(withGarmentAvailabilityDefaults(override.availability));
      setHasOverride(true);
    } catch (err) {
      setAvailability(DEFAULT_GARMENT_AVAILABILITY);
      setHasOverride(false);
      if (!(err instanceof ApiError && err.status === 404)) {
        message.error("Не удалось загрузить override материалов");
      }
    } finally {
      setLoading(false);
    }
  }

  async function saveOverride() {
    if (!selectedPointId) return;
    setSaving(true);
    try {
      await apiClient.put(`/garment-availability/overrides/${selectedPointId}`, availability);
      message.success("Override сохранён — точка перезаписана и локальные правки заблокированы");
      setHasOverride(true);
    } catch {
      message.error("Ошибка сохранения override");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOverride() {
    if (!selectedPointId) return;
    setSaving(true);
    try {
      await apiClient.delete(`/garment-availability/overrides/${selectedPointId}`);
      message.success("Override снят — оператор снова может менять материалы на точке");
      setHasOverride(false);
      setAvailability(DEFAULT_GARMENT_AVAILABILITY);
    } catch {
      message.error("Ошибка удаления override");
    } finally {
      setSaving(false);
    }
  }

  function setType(type: GarmentType, enabled: boolean) {
    setAvailability((prev) => ({ ...prev, types: { ...prev.types, [type]: enabled } }));
  }

  function setColor(colorId: string, enabled: boolean) {
    setAvailability((prev) => ({ ...prev, colors: { ...prev.colors, [colorId]: enabled } }));
  }

  function setSize(size: GarmentSize, enabled: boolean) {
    setAvailability((prev) => ({ ...prev, sizes: { ...prev.sizes, [size]: enabled } }));
  }

  function setFabric(fabric: GarmentFabric, enabled: boolean) {
    setAvailability((prev) => ({ ...prev, fabrics: { ...prev.fabrics, [fabric]: enabled } }));
  }

  return (
    <div>
      <Card title="Материалы по точкам" loading={loading}>
        <Typography.Paragraph type="secondary">
          Пока override активен, настройки из админки перезаписывают локальные на точке и блокируют
          панель «Материалы» у оператора. Чтобы вернуть управление точке — удалите override.
        </Typography.Paragraph>

        <Select
          placeholder="Выберите точку"
          style={{ width: 320, marginBottom: 16 }}
          options={points.map((point) => ({ value: point.id, label: point.name }))}
          onChange={(value: string) => void loadOverride(value)}
          value={selectedPointId}
        />

        {selectedPointId ? (
          <>
            {hasOverride ? (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="Override активен"
                description="Локальные изменения материалов на этой точке заблокированы."
              />
            ) : (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Override не задан"
                description="Точка управляет материалами локально. Сохраните override, чтобы перехватить управление."
              />
            )}

            <ToggleGrid title="Тип изделия">
              {garmentTypeSchema.options.map((type) => (
                <Checkbox
                  key={type}
                  checked={availability.types[type] !== false}
                  onChange={(event) => setType(type, event.target.checked)}
                >
                  {TYPE_LABELS[type]}
                </Checkbox>
              ))}
            </ToggleGrid>

            <ToggleGrid title="Цвета">
              {GARMENT_COLORS.map((color) => (
                <Checkbox
                  key={color.id}
                  checked={availability.colors[color.id] !== false}
                  onChange={(event) => setColor(color.id, event.target.checked)}
                >
                  <span
                    style={{
                      display: "inline-block",
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      backgroundColor: color.hex,
                      border: "1px solid #d9d9d9",
                      marginRight: 6,
                      verticalAlign: "middle",
                    }}
                  />
                  {COLOR_LABELS[color.id] ?? color.id}
                </Checkbox>
              ))}
            </ToggleGrid>

            <ToggleGrid title="Размеры">
              {GARMENT_SIZES.map((size) => (
                <Checkbox
                  key={size}
                  checked={availability.sizes[size] !== false}
                  onChange={(event) => setSize(size, event.target.checked)}
                >
                  {size}
                </Checkbox>
              ))}
            </ToggleGrid>

            <ToggleGrid title="Материалы">
              {GARMENT_FABRICS.map((fabric) => (
                <Checkbox
                  key={fabric}
                  checked={availability.fabrics[fabric] !== false}
                  onChange={(event) => setFabric(fabric, event.target.checked)}
                >
                  {FABRIC_LABELS[fabric]}
                </Checkbox>
              ))}
            </ToggleGrid>

            <Space>
              <Button type="primary" loading={saving} onClick={() => void saveOverride()}>
                {hasOverride ? "Обновить override" : "Включить override"}
              </Button>
              {hasOverride ? (
                <Button danger loading={saving} onClick={() => void deleteOverride()}>
                  Снять override
                </Button>
              ) : null}
              <Button
                onClick={() => setAvailability(DEFAULT_GARMENT_AVAILABILITY)}
                disabled={saving}
              >
                Все включить
              </Button>
            </Space>
          </>
        ) : (
          <Empty description="Выберите точку, чтобы настроить материалы" />
        )}
      </Card>
    </div>
  );
}
