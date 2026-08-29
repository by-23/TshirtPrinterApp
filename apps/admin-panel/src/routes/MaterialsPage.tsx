import { useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Card, Checkbox, ColorPicker, Empty, Input, Select, Space, Typography, message } from "antd";
import {
  CATALOG_LABEL_MAX_LENGTH,
  DEFAULT_GARMENT_AVAILABILITY,
  DEFAULT_GARMENT_CATALOG,
  GARMENT_COLORS,
  GARMENT_FABRICS,
  GARMENT_SIZES,
  SIZE_LABEL_MAX_LENGTH,
  garmentTypeSchema,
  withGarmentAvailabilityDefaults,
  withGarmentCatalogDefaults,
  type GarmentAvailabilityConfig,
  type GarmentCatalogConfig,
  type GarmentFabric,
  type GarmentSize,
  type GarmentType,
  type PointDetail,
} from "@tshirt/shared-types";
import { apiClient, ApiError } from "../lib/apiClient.js";

const TYPE_FALLBACK: Record<GarmentType, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};

const FABRIC_FALLBACK: Record<GarmentFabric, string> = {
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

function CatalogFieldRow({ children }: { children: ReactNode }) {
  return (
    <Space wrap size={[12, 12]} align="center">
      {children}
    </Space>
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
  const [catalog, setCatalog] = useState<GarmentCatalogConfig>(DEFAULT_GARMENT_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogSaving, setCatalogSaving] = useState(false);

  useEffect(() => {
    apiClient
      .get<PointDetail[]>("/points")
      .then(setPoints)
      .catch(() => message.error("Не удалось загрузить точки"));
    apiClient
      .get<GarmentCatalogConfig>("/garment-catalog")
      .then((next) => setCatalog(withGarmentCatalogDefaults(next)))
      .catch(() => message.error("Не удалось загрузить каталог названий"))
      .finally(() => setCatalogLoading(false));
  }, []);

  async function saveCatalog() {
    setCatalogSaving(true);
    try {
      const saved = await apiClient.put<GarmentCatalogConfig>("/garment-catalog", catalog);
      setCatalog(withGarmentCatalogDefaults(saved));
      message.success("Названия и цвета отправлены на все точки");
    } catch {
      message.error("Не удалось сохранить каталог");
    } finally {
      setCatalogSaving(false);
    }
  }

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

  function setTypeLabel(type: GarmentType, label: string) {
    setCatalog((prev) => ({
      ...prev,
      types: {
        ...prev.types,
        [type]: { ...prev.types[type]!, label: label.slice(0, CATALOG_LABEL_MAX_LENGTH) },
      },
    }));
  }

  function setTypeEnabled(type: GarmentType, enabled: boolean) {
    setCatalog((prev) => ({
      ...prev,
      types: { ...prev.types, [type]: { ...prev.types[type]!, enabled } },
    }));
  }

  function setColorLabel(colorId: string, label: string) {
    setCatalog((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [colorId]: { ...prev.colors[colorId]!, label: label.slice(0, CATALOG_LABEL_MAX_LENGTH) },
      },
    }));
  }

  function setColorEnabled(colorId: string, enabled: boolean) {
    setCatalog((prev) => ({
      ...prev,
      colors: { ...prev.colors, [colorId]: { ...prev.colors[colorId]!, enabled } },
    }));
  }

  function setColorHex(colorId: string, hex: string) {
    setCatalog((prev) => ({
      ...prev,
      colors: { ...prev.colors, [colorId]: { ...prev.colors[colorId]!, hex } },
    }));
  }

  function setSizeLabel(size: GarmentSize, label: string) {
    setCatalog((prev) => ({
      ...prev,
      sizes: {
        ...prev.sizes,
        [size]: { ...prev.sizes[size]!, label: label.slice(0, SIZE_LABEL_MAX_LENGTH) },
      },
    }));
  }

  function setSizeEnabled(size: GarmentSize, enabled: boolean) {
    setCatalog((prev) => ({
      ...prev,
      sizes: { ...prev.sizes, [size]: { ...prev.sizes[size]!, enabled } },
    }));
  }

  function setFabricLabel(fabric: GarmentFabric, label: string) {
    setCatalog((prev) => ({
      ...prev,
      fabrics: {
        ...prev.fabrics,
        [fabric]: { ...prev.fabrics[fabric]!, label: label.slice(0, CATALOG_LABEL_MAX_LENGTH) },
      },
    }));
  }

  function setFabricEnabled(fabric: GarmentFabric, enabled: boolean) {
    setCatalog((prev) => ({
      ...prev,
      fabrics: { ...prev.fabrics, [fabric]: { ...prev.fabrics[fabric]!, enabled } },
    }));
  }

  return (
    <div>
      <Card title="Названия и цвета каталога" loading={catalogLoading} style={{ marginBottom: 24 }}>
        <Typography.Paragraph type="secondary">
          Эти названия и цвета общие для всех точек: после сохранения они появятся у оператора и в
          киоске. Снимите галочку — пункт останется на экране киоска, но станет тусклым и нажать
          на него будет нельзя. Внутренние коды заказов не меняются.
        </Typography.Paragraph>

        <ToggleGrid title="Тип изделия">
          {garmentTypeSchema.options.map((type) => (
            <CatalogFieldRow key={type}>
              <Checkbox
                checked={catalog.types[type]?.enabled !== false}
                onChange={(event) => setTypeEnabled(type, event.target.checked)}
              />
              <Input
                value={catalog.types[type]?.label ?? TYPE_FALLBACK[type]}
                maxLength={CATALOG_LABEL_MAX_LENGTH}
                showCount
                onChange={(event) => setTypeLabel(type, event.target.value)}
                style={{
                  width: 180,
                  opacity: catalog.types[type]?.enabled === false ? 0.45 : 1,
                }}
              />
            </CatalogFieldRow>
          ))}
        </ToggleGrid>

        <ToggleGrid title="Цвета">
          {GARMENT_COLORS.map((color) => (
            <CatalogFieldRow key={color.id}>
              <Checkbox
                checked={catalog.colors[color.id]?.enabled !== false}
                onChange={(event) => setColorEnabled(color.id, event.target.checked)}
              />
              <ColorPicker
                value={catalog.colors[color.id]?.hex ?? color.hex}
                disabledAlpha
                onChange={(value) => {
                  const hex = value.toHexString();
                  if (/^#[0-9A-Fa-f]{6}$/i.test(hex)) setColorHex(color.id, hex);
                }}
              />
              <Input
                value={catalog.colors[color.id]?.label ?? color.id}
                maxLength={CATALOG_LABEL_MAX_LENGTH}
                showCount
                onChange={(event) => setColorLabel(color.id, event.target.value)}
                style={{
                  width: 180,
                  opacity: catalog.colors[color.id]?.enabled === false ? 0.45 : 1,
                }}
              />
            </CatalogFieldRow>
          ))}
        </ToggleGrid>

        <ToggleGrid title="Размеры">
          {GARMENT_SIZES.map((size) => (
            <CatalogFieldRow key={size}>
              <Checkbox
                checked={catalog.sizes[size]?.enabled !== false}
                onChange={(event) => setSizeEnabled(size, event.target.checked)}
              />
              <Input
                value={catalog.sizes[size]?.label ?? size}
                maxLength={SIZE_LABEL_MAX_LENGTH}
                showCount
                onChange={(event) => setSizeLabel(size, event.target.value)}
                style={{
                  width: 120,
                  opacity: catalog.sizes[size]?.enabled === false ? 0.45 : 1,
                }}
              />
            </CatalogFieldRow>
          ))}
        </ToggleGrid>

        <ToggleGrid title="Материалы">
          {GARMENT_FABRICS.map((fabric) => (
            <CatalogFieldRow key={fabric}>
              <Checkbox
                checked={catalog.fabrics[fabric]?.enabled !== false}
                onChange={(event) => setFabricEnabled(fabric, event.target.checked)}
              />
              <Input
                value={catalog.fabrics[fabric]?.label ?? FABRIC_FALLBACK[fabric]}
                maxLength={CATALOG_LABEL_MAX_LENGTH}
                showCount
                onChange={(event) => setFabricLabel(fabric, event.target.value)}
                style={{
                  width: 180,
                  opacity: catalog.fabrics[fabric]?.enabled === false ? 0.45 : 1,
                }}
              />
            </CatalogFieldRow>
          ))}
        </ToggleGrid>

        <Button type="primary" loading={catalogSaving} onClick={() => void saveCatalog()}>
          Сохранить каталог
        </Button>
      </Card>

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
                  {catalog.types[type]?.label ?? TYPE_FALLBACK[type]}
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
                      backgroundColor: catalog.colors[color.id]?.hex ?? color.hex,
                      border: "1px solid #d9d9d9",
                      marginRight: 6,
                      verticalAlign: "middle",
                    }}
                  />
                  {catalog.colors[color.id]?.label ?? color.id}
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
                  {catalog.sizes[size]?.label ?? size}
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
                  {catalog.fabrics[fabric]?.label ?? FABRIC_FALLBACK[fabric]}
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
