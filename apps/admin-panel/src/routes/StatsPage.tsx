import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Table, Select, message } from "antd";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { StatsSummary } from "@tshirt/shared-types";
import { apiClient } from "../lib/apiClient.js";

const DAY_OPTIONS = [
  { value: 7, label: "7 дней" },
  { value: 14, label: "14 дней" },
  { value: 30, label: "30 дней" },
];

function formatTenge(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₸`;
}

export function StatsPage() {
  const [summary, setSummary] = useState<StatsSummary | null>(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void load(days);
  }, [days]);

  async function load(value: number) {
    setLoading(true);
    try {
      setSummary(await apiClient.get<StatsSummary>(`/stats/summary?days=${value}`));
    } catch {
      message.error("Не удалось загрузить статистику");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Заказов за период" value={summary?.totals.ordersCount ?? 0} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Выручка за период"
              value={summary?.totals.revenueTenge ?? 0}
              formatter={(value) => formatTenge(Number(value))}
            />
          </Card>
        </Col>
        <Col span={6} style={{ display: "flex", alignItems: "center" }}>
          <Select value={days} options={DAY_OPTIONS} onChange={setDays} style={{ width: "100%" }} />
        </Col>
      </Row>

      <Card title="Заказы и выручка по дням" loading={loading} style={{ marginBottom: 24 }}>
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
            <Bar yAxisId="left" dataKey="ordersCount" name="Заказы" fill="#8c54ff" />
            <Bar yAxisId="right" dataKey="revenueTenge" name="Выручка (₸)" fill="#ff5ea8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card title="Разбивка по точкам">
        <Table
          rowKey="pointId"
          loading={loading}
          dataSource={summary?.byPoint ?? []}
          columns={[
            { title: "Точка", dataIndex: "pointName" },
            { title: "Заказов", dataIndex: "ordersCount" },
            {
              title: "Выручка",
              dataIndex: "revenueTenge",
              render: (value: number) => formatTenge(value),
            },
          ]}
        />
      </Card>
    </div>
  );
}
