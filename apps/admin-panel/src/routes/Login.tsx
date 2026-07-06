import { useState } from "react";
import { Form, Input, Button, Card, Typography, Alert } from "antd";
import { Navigate, useNavigate } from "react-router-dom";
import type { AdminLoginInput, AuthResponse } from "@tshirt/shared-types";
import { apiClient } from "../lib/apiClient.js";
import { useAuthStore } from "../lib/authStore.js";

export function Login() {
  const token = useAuthStore((s) => s.token);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (token) {
    return <Navigate to="/points" replace />;
  }

  async function handleSubmit(values: AdminLoginInput) {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.post<AuthResponse>("/auth/login", values);
      login(response.token, response.admin);
      navigate("/points");
    } catch {
      setError("Неверный логин или пароль");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 360 }}>
        <Typography.Title level={3} style={{ textAlign: "center" }}>
          T-Shirt Printer Admin
        </Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}
        <Form layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          <Form.Item name="login" label="Логин" rules={[{ required: true, message: "Введите логин" }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item
            name="password"
            label="Пароль"
            rules={[{ required: true, message: "Введите пароль" }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              Войти
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
