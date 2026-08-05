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
| Киоск + оператор (UI) | `apps/kiosk-operator-app` | 5173 | React-app, роуты `/kiosk` и `/operator` |
| Point-server | `apps/point-server` | 4000 | Fastify + SQLite на ПК оператора |
| Operator desktop | `apps/point-desktop` | — | Electron EXE: point-server + панель оператора |
| Kiosk desktop | `apps/kiosk-desktop` | — | Тонкий Electron EXE: киоск по LAN |
| Central-relay | `apps/central-relay` | 4100 | Fastify + PostgreSQL, облачный сервис |
| Admin-panel | `apps/admin-panel` | 5174 | React + Ant Design, управление точками/ценами/статистикой |

## Быстрый старт

```bash
pnpm install
```

### Два ПК (рекомендуется)

```
ПК оператора  →  Tshirt Printer Operator  (сервер + панель)
ПК киоска     →  Tshirt Printer Kiosk     (тонкий клиент по LAN)
```

1. На ПК оператора установите Operator EXE и запустите.
2. В панели оператора откройте **Киоск** — скопируйте URL (или IP).
3. В брандмауэре Windows на ПК оператора разрешите входящий TCP-порт **4000**.
4. На ПК киоска установите Kiosk EXE, введите IP оператора и подключитесь.

Оба ПК должны быть в одной локальной сети. Сервер и база данных только на ПК оператора — на киоске второй сервер не запускайте.

Переопределить LAN-адрес для QR/киоска: переменная `TSHIRT_PUBLIC_LAN_HOST` (например `192.168.1.10` или `192.168.1.10:4000`) перед запуском Operator.

### Windows-приложения (сборка)

Сборка установщиков Operator и Kiosk:

```bat
build-windows-app.bat
```

Готовые файлы:

- `apps/point-desktop/release/` — **Tshirt Printer Operator** (установщик + zip)
- `apps/kiosk-desktop/release/` — **Tshirt Printer Kiosk** (установщик + zip)

Docker и Chrome не нужны. Первый запуск portable может занять 20–40 секунд (распаковка).

### Релиз через Chrome на одном ПК (legacy)

```bat
start-release.bat
```

Поднимает сервисы и открывает два безрамочных окна Chrome (`--kiosk`) на одной машине:

- киоск — `/kiosk?native=1`
- оператор — `/operator?native=1`

Для двух отдельных ПК используйте Operator + Kiosk EXE выше. Остановка: `stop-release.bat`.

### Киоск + оператор (точка, dev)

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
