# TshirtPrinterApp

Приложение для принта на футболках: киоск самообслуживания, панель оператора и облачная админка.

## Документация

- [План реализации](docs/PLAN.md) — архитектура, стек и этапы разработки

## Стек (план)

- **Frontend:** React 18, TypeScript, Vite, TailwindCSS
- **Backend точки:** Node.js, Fastify, SQLite
- **Центральный сервер:** Node.js, Fastify, PostgreSQL
- **Монорепозиторий:** pnpm workspaces + Turborepo

## Приложения

| Приложение | Путь | Порт (dev) | Описание |
|---|---|---|---|
| Киоск + оператор | `apps/kiosk-operator-app` | 5173 | React-app, роуты `/kiosk` и `/operator` |
| Point-server | `apps/point-server` | 4000 | Fastify + SQLite, работает на мини-ПК точки |
| Central-relay | `apps/central-relay` | 4100 | Fastify + PostgreSQL, облачный сервис |
| Admin-panel | `apps/admin-panel` | 5174 | React + Ant Design, управление точками/ценами/статистикой |

## Быстрый старт

```bash
pnpm install
```

### Киоск + оператор (точка)

```bash
pnpm --filter @tshirt/kiosk-operator-app dev   # http://localhost:5173
```

Киоск и оператор ходят в **point-server** (`http://localhost:4000`). Без него галерея дизайнов и заказы не работают.

### Point-server (точка)

```bash
pnpm --filter @tshirt/point-server db:migrate
pnpm --filter @tshirt/point-server db:seed
pnpm --filter @tshirt/point-server dev   # http://localhost:4000
```

Скопируйте `apps/point-server/.env.example` → `.env` и заполните `POINT_SYNC_ID` / `POINT_SYNC_TOKEN` (см. ниже), чтобы точка отображалась «В сети» в админке.

### Central-relay + admin-panel (облако)

1. Поднять локальный PostgreSQL:

   ```bash
   docker compose up -d
   ```

2. Применить миграции и засеять дефолтного админа/демо-точку:

   ```bash
   pnpm --filter @tshirt/central-relay db:generate
   pnpm --filter @tshirt/central-relay db:migrate
   pnpm --filter @tshirt/central-relay db:seed
   ```

   Сид выводит в консоль логин/пароль дефолтного админа (`admin` / `admin123` по умолчанию — переопределяется переменными `DEFAULT_ADMIN_LOGIN`/`DEFAULT_ADMIN_PASSWORD`) и `syncToken` демо-точки.

3. Запустить сервисы:

   ```bash
   pnpm --filter @tshirt/central-relay dev   # http://localhost:4100
   pnpm --filter @tshirt/admin-panel dev     # http://localhost:5174
   ```

4. Чтобы point-server подключился к central-relay по WebSocket, задать перед запуском:

   ```bash
   CENTRAL_RELAY_URL=http://localhost:4100
   POINT_SYNC_ID=<id из ответа POST /points>
   POINT_SYNC_TOKEN=<syncToken из ответа POST /points>
   ```

   Без этих переменных точка работает полностью автономно (fail-open).
