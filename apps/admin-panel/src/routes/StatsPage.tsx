import { useCallback, useEffect, useState } from "react";
import {
  Card,
  Col,
  Row,
  Statistic,
  Table,
  Select,
  DatePicker,
  Space,
  Switch,
  Tag,
  message,
  Typography,
} from "antd";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import dayjs, { type Dayjs } from "dayjs";
import type {
  PointDetail,
  StatsOrdersList,
  StatsSummary,
  OrderStatus,
} from "@tshirt/shared-types";
import { apiClient } from "../lib/apiClient.js";

const { RangePicker } = DatePicker;

const DAY_OPTIONS = [
  { value: 7, label: "7 дней" },
  { value: 14, label: "14 дней" },
  { value: 30, label: "30 дней" },
  { value: 90, label: "90 дней" },
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Новый",
  accepted: "В печати",
  printing: "Печатается",
  done: "Готово",
  cancelled: "Отменён",
};

const GARMENT_LABELS: Record<string, string> = {
  tshirt: "Футболка",
  sweatshirt: "Свитшот",
  cap: "Кепка",
  shopper: "Шоппер",
};

function formatTenge(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₸`;
}

function formatDateTime(iso: string): string {
  return dayjs(iso).format("DD.MM.YYYY HH:mm");
}

function toIsoDate(d: Dayjs): string {
  return d.format("YYYY-MM-DD");
}

const POLL_MS = 15_000;

export function StatsPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [orders, setOrders] = useState<StatsOrdersList | null>(null);
  const [points, setPoints] = useState<PointDetail[]>([]);
  const [days, setDays] = useState(14);
  const [pointId, setPointId] = useState<string | null>(null);
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [reprintsOnly, setReprintsOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | null>(null);
  const [ordersPage, setOrdersPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const pageSize = 50;

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (range) {
      params.set("from", toIsoDate(range[0]));
      params.set("to", toIsoDate(range[1]));
    } else {
      params.set("days", String(days));
    }
    if (pointId) params.set("pointId", pointId);
    return params;
  }, [days, pointId, range]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildQuery();
      const ordersParams = new URLSearchParams(params);
      ordersParams.set("limit", String(pageSize));
      ordersParams.set("offset", String((ordersPage - 1) * pageSize));
      if (reprintsOnly) ordersParams.set("reprintsOnly", "1");
      if (statusFilter) ordersParams.set("status", statusFilter);

      const [nextSummary, nextOrders] = await Promise.all([
        apiClient.get<StatsSummary>(`/stats/summary?${params}`),
        apiClient.get<StatsOrdersList>(`/stats/orders?${ordersParams}`),
      ]);
      setSummary(nextSummary);
      setOrders(nextOrders);
    } catch {
      message.error("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }, [buildQuery, ordersPage, reprintsOnly, statusFilter]);

  useEffect(() => {
    void apiClient
      .get<PointDetail[]>("/points")
      .then(setPoints)
      .catch(() => {
        /* points filter stays empty */
      });
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  return (
    <div>
      <Space wrap style={{ marginBottom: 16 }} size="middle">
        <Select
          allowClear
          placeholder="Все точки"
          style={{ width: 220 }}
          value={pointId ?? undefined}
          options={points.map((p) => ({ value: p.id, label: p.name }))}
          onChange={(value) => {
            setPointId(value ?? null);
            setOrdersPage(1);
          }}
        />
        <Select
          value={range ? undefined : days}
          options={DAY_OPTIONS}
          disabled={!!range}
          onChange={(value) => {
            setDays(value);
            setOrdersPage(1);
          }}
          style={{ width: 140 }}
        />
        <RangePicker
          value={range}
          onChange={(value) => {
            setRange(value && value[0] && value[1] ? [value[0], value[1]] : null);
            setOrdersPage(1);
          }}
          allowClear
          format="DD.MM.YYYY"
        />
        <Select
          allowClear
          placeholder="Статус"
          style={{ width: 160 }}
          value={statusFilter ?? undefined}
          options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
          onChange={(value) => {
            setStatusFilter((value as OrderStatus | undefined) ?? null);
            setOrdersPage(1);
          }}
        />
        <Space>
          <Switch
            checked={reprintsOnly}
            onChange={(checked) => {
              setReprintsOnly(checked);
              setOrdersPage(1);
            }}
          />
          <Typography.Text>Только повторные печати</Typography.Text>
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Заказов" value={summary?.totals.ordersCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Печатей" value={summary?.totals.printsCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Повторных печатей" value={summary?.totals.reprintsCount ?? 0} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="Выручка"
              value={summary?.totals.revenueTenge ?? 0}
              formatter={(value) => formatTenge(Number(value))}
            />
          </Card>
        </Col>
      </Row>

      <Card title="Заказы и печати по дням" loading={loading} style={{ marginBottom: 24 }}>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={summary?.daily ?? []}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" allowDecimals={false} />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip
              formatter={(value, name) =>
                name === "Выручка (₸)" ? formatTenge(Number(value)) : String(value)
              }
            />
            <Legend />
            <Bar yAxisId="left" dataKey="ordersCount" name="Заказы" fill="#1677ff" />
            <Bar yAxisId="left" dataKey="printsCount" name="Печати" fill="#52c41a" />
            <Bar yAxisId="right" dataKey="revenueTenge" name="Выручка (₸)" fill="#fa8c16" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Разбивка по точкам" style={{ marginBottom: 24 }}>
        <Table
          rowKey="pointId"
          loading={loading}
          dataSource={summary?.byPoint ?? []}
          pagination={false}
          columns={[
            { title: "Точка", dataIndex: "pointName" },
            { title: "Заказов", dataIndex: "ordersCount" },
            { title: "Печатей", dataIndex: "printsCount" },
            {
              title: "Выручка",
              dataIndex: "revenueTenge",
              render: (value: number) => formatTenge(value),
            },
          ]}
        />
      </Card>

      <Card title="Заказы (аудит кассы)">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={orders?.items ?? []}
          pagination={{
            current: ordersPage,
            pageSize,
            total: orders?.total ?? 0,
            onChange: setOrdersPage,
            showSizeChanger: false,
            showTotal: (total) => `Всего: ${total}`,
          }}
          columns={[
            {
              title: "Дата",
              dataIndex: "createdAt",
              render: (value: string) => formatDateTime(value),
              width: 150,
            },
            { title: "Точка", dataIndex: "pointName" },
            {
              title: "№ на точке",
              dataIndex: "pointOrderId",
              render: (value: number | null) => (value == null ? "—" : value),
              width: 100,
            },
            {
              title: "Изделие",
              dataIndex: "garmentType",
              render: (value: string) => GARMENT_LABELS[value] ?? value,
            },
            {
              title: "Статус",
              dataIndex: "status",
              render: (value: OrderStatus) => STATUS_LABELS[value] ?? value,
              width: 120,
            },
            {
              title: "Печатей",
              dataIndex: "printCount",
              width: 110,
              render: (value: number) =>
                value > 1 ? <Tag color="orange">{value} (повтор)</Tag> : <span>{value}</span>,
            },
            {
              title: "Цена",
              dataIndex: "price",
              render: (value: number) => formatTenge(value),
              width: 120,
            },
          ]}
        />
      </Card>
    </div>
  );
}
