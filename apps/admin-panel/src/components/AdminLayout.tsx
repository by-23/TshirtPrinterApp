import { Layout, Menu, Button, Typography } from "antd";
import type { MenuProps } from "antd";
import { ShopOutlined, DollarOutlined, BarChartOutlined, LogoutOutlined, PictureOutlined } from "@ant-design/icons";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../lib/authStore.js";

const { Header, Sider, Content } = Layout;

const NAV_ITEMS: MenuProps["items"] = [
  { key: "/points", icon: <ShopOutlined />, label: "Точки" },
  { key: "/pricing", icon: <DollarOutlined />, label: "Цены" },
  { key: "/catalog", icon: <PictureOutlined />, label: "Каталог" },
  { key: "/stats", icon: <BarChartOutlined />, label: "Статистика" },
];

const NAV_KEYS = ["/points", "/pricing", "/catalog", "/stats"];

export function AdminLayout() {
  const token = useAuthStore((s) => s.token);
  const admin = useAuthStore((s) => s.admin);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const selectedKey = NAV_KEYS.find((key) => location.pathname.startsWith(key));

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider theme="dark" width={220}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 18, padding: "20px 16px" }}>
          T-Shirt Admin
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKey ? [selectedKey] : []}
          items={NAV_ITEMS}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 16,
            padding: "0 24px",
          }}
        >
          <Typography.Text>{admin?.login}</Typography.Text>
          <Button
            icon={<LogoutOutlined />}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Выйти
          </Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
