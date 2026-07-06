export const env = {
  PORT: Number(process.env.PORT ?? 4100),
  DATABASE_URL:
    process.env.DATABASE_URL ?? "postgres://tshirt:tshirt@localhost:5432/tshirt_central",
  JWT_SECRET: process.env.JWT_SECRET ?? "dev-insecure-secret-change-me",
  UPLOADS_DIR: process.env.UPLOADS_DIR ?? "./data/uploads",
  // Dev-only fallback credentials for `db:seed` — override via env before any real deployment.
  DEFAULT_ADMIN_LOGIN: process.env.DEFAULT_ADMIN_LOGIN ?? "admin",
  DEFAULT_ADMIN_PASSWORD: process.env.DEFAULT_ADMIN_PASSWORD ?? "admin123",
};
