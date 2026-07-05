export const env = {
  PORT: Number(process.env.PORT ?? 4000),
  DATABASE_PATH: process.env.DATABASE_PATH ?? "./data/point.db",
};
