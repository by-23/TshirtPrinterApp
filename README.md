# TshirtPrinterApp

Киоск самообслуживания и панель оператора для печати на одежде. На точке — свой сервер и база; в облаке — синхронизация, админка и загрузка фото по QR.

Изделия: футболка, свитшот, кепка, шоппер. Языки киоска: русский, казахский, английский, китайский. Печать — DTF (плёнка A3/A3+, файл 300 DPI под RIP).

## Как устроено

```
ПК киоска ──локальная сеть──► ПК оператора ──интернет──► облако
  тонкое окно                     сервер точки              api.kyoma.uk
  только экран                    панель оператора          админка, QR, цены
                                  своя база SQLite
```

Сервер и база живут **только на ПК оператора**. Киоск к ним подключается по локальной сети. Без интернета точка работает по последним данным; недоступны облачная синхронизация, загрузка фото через центр и сетевая ИИ-стилизация.

**Облако уже развёрнуто.** Локальные Postgres, облачный сервис и админка для обычной работы не нужны.

| Что | Адрес |
|---|---|
| Облачный сервис | https://api.kyoma.uk |
| Админка | https://api.kyoma.uk/admin/ |
| Проверка | https://api.kyoma.uk/health |

## Приложения

| Приложение | Путь | Порт | Назначение |
|---|---|---|---|
| Киоск и оператор (интерфейс) | `apps/kiosk-operator-app` | 5173 (dev) | Экраны `/kiosk` и `/operator` |
| Сервер точки | `apps/point-server` | 4000 | Заказы, каталог, печать, ИИ, своя база SQLite |
| Окно оператора | `apps/point-desktop` | — | Установщик Windows: сервер точки + панель |
| Окно киоска | `apps/kiosk-desktop` | — | Тонкий клиент Windows: киоск по локальной сети |
| Облачный сервис | `apps/central-relay` | 4100 (локально) | Синхронизация, QR-загрузка, админка |
| Админка | `apps/admin-panel` | 5174 (локально) | Точки, цены, изделия, статистика |

Общие пакеты: `packages/shared-types`, `packages/shared-pricing`, `packages/i18n`, `packages/ui-kit`.

## Что нужно для разработки

- Windows
- Node.js 22 или новее (лучше 24)
- [pnpm](https://pnpm.io/installation)
- Доступ в интернет до `api.kyoma.uk`

```bat
pnpm install
```

## Локальный запуск (обычный режим)

Поднимает **только точку**: сервер + интерфейс киоска и оператора. Облако — боевое.

1. В [админке](https://api.kyoma.uk/admin/) откройте точку и скопируйте идентификатор и токен синхронизации.
2. Скопируйте `apps/point-server/.env.example` → `apps/point-server/.env` и заполните:

   ```
   CENTRAL_RELAY_URL=https://api.kyoma.uk
   POINT_SYNC_ID=<id точки>
   POINT_SYNC_TOKEN=<syncToken>
   ```

3. Запустите:

   ```bat
   start-dev.bat
   ```

Скрипт ставит зависимости, применяет миграции точки, поднимает сервисы в фоне.

| Экран | Адрес |
|---|---|
| Киоск | http://localhost:5173/kiosk |
| Оператор | http://localhost:5173/operator |
| Сервер точки | http://localhost:4000 |

Остановка: `stop-dev.bat`. Боевое облако не гасится.

Журналы: `logs\point-server.log`, `logs\kiosk.log`. Адреса ещё раз пишутся в `dev-urls.txt`.

Без `POINT_SYNC_ID` / `POINT_SYNC_TOKEN` точка работает автономно: заказы и каталог на месте, в админке она «не в сети», QR через центр не ходит.

## Точка на двух компьютерах

```
ПК оператора  →  Tshirt Printer Operator
ПК киоска     →  Tshirt Printer Kiosk
```

1. На ПК оператора установите Operator и запустите.
2. В панели откройте **Киоск** — скопируйте адрес.
3. В брандмауэре Windows на ПК оператора разрешите входящий TCP **4000**.
4. На ПК киоска установите Kiosk, введите IP оператора и подключитесь.

Оба компьютера — в одной локальной сети. Второй сервер на киоске не запускайте.

Если киоск или QR на телефоне видят не тот адрес, перед запуском Operator задайте LAN-адрес, например `192.168.1.10` или `192.168.1.10:4000`:

- окно оператора — `TSHIRT_PUBLIC_LAN_HOST`
- сервер точки (режим «свой Wi‑Fi») — `PUBLIC_LAN_HOST` в `apps/point-server/.env`

## Сборка установщиков Windows

```bat
build-windows-app.bat
```

В установщик оператора попадает `apps/point-server/.env` (облако `https://api.kyoma.uk`). Нужны Node.js и pnpm; скрипт сам скачивает встроенный Node для пакета.

Готово:

- `apps/point-desktop/release/` — **Tshirt Printer Operator** (`TshirtPrinterOperator-Setup-*.exe`)
- `apps/kiosk-desktop/release/` — **Tshirt Printer Kiosk** (`TshirtPrinterKiosk-Setup-*.exe`)

Docker и браузер не нужны. Первый запуск распакованной сборки может занять 20–40 секунд.

### Обновления уже установленных окон

Автообновление с GitHub Releases (`by-23/TshirtPrinterApp`):

```bat
publish-windows-update.bat
```

Отдельно интерфейс или сервер точки (модули, без переустановки окна):

```bat
publish-ui.bat
publish-server.bat
```

Нужен [GitHub CLI](https://cli.github.com/) (`gh`), вход в тот же репозиторий. Подпись установщика (по желанию): `CSC_LINK` и `CSC_KEY_PASSWORD`.

## Один компьютер, два окна в браузере

Если установщиков нет, на одной машине:

```bat
start-release.bat
```

Поднимает сервисы и открывает два безрамочных окна (Chrome или Edge): киоск `/kiosk?native=1` и оператор `/operator?native=1`. На двух мониторах раскладку можно задать в `displays.json` (образец — `displays.json.example`). Остановка: `stop-release.bat`.

Для постоянной точки лучше Operator + Kiosk, не браузер.

## Загрузка фото по QR

В админке у точки два режима:

| Режим | Куда грузит телефон | Что настроить |
|---|---|---|
| Через центр (`relay`) | облако, затем на точку | точка в сети, в облаке задан публичный адрес (`PUBLIC_BASE_URL`) |
| Свой Wi‑Fi (`wifi`) | сразу на сервер точки в локальной сети | `PUBLIC_LAN_HOST` = LAN IP точки, например `192.168.1.13:4000` |

Телефон и киоск должны доставать указанный адрес. `localhost` в QR для телефона не подходит.

## Переменные сервера точки

Файл: `apps/point-server/.env` (шаблон — `.env.example`).

| Переменная | Зачем |
|---|---|
| `CENTRAL_RELAY_URL` | Облако. Для обычной работы: `https://api.kyoma.uk` |
| `POINT_SYNC_ID` / `POINT_SYNC_TOKEN` | Учётные данные точки из админки |
| `PUBLIC_LAN_HOST` | Хост:порт в QR, если загрузка идёт по своему Wi‑Fi |
| `GIPHY_API_KEY` | Запасной ключ Giphy для каталога (если не задан в панели оператора) |
| `POLLINATIONS_API_TOKEN` | Обычная ИИ-стилизация |
| `OPENAI_API_KEY` / `GEMINI_API_KEY` | Платные стили на киоске; без ключа провайдер скрыт |
| `DATA_DIR` | Корень данных. На Windows по умолчанию `%LOCALAPPDATA%\TshirtPrinter\data` |
| `BACKUP_ENABLED` / `BACKUP_KEEP_DAYS` / `BACKUP_DIR` | Ежедневные копии (по умолчанию включены, хранятся год) |

## Данные и копии

На Windows данные точки: `%LOCALAPPDATA%\TshirtPrinter\data`  
Копии: `%LOCALAPPDATA%\TshirtPrinter\backups`

Ручная копия точки и локального облака (если оно запущено):

```bat
Backup-TshirtPrinter.bat
```

Ежедневное задание: `scripts/install-daily-backup-task.ps1`.

## Ручной запуск по частям

Если не хотите `start-dev.bat`:

```bat
pnpm --filter @tshirt/point-server db:migrate
pnpm --filter @tshirt/point-server db:seed
pnpm --filter @tshirt/point-server dev
pnpm --filter @tshirt/kiosk-operator-app dev
```

Киоск и оператор ходят на `http://localhost:4000`. Без сервера точки галерея и заказы не работают.

## Локальная копия облака

Только чтобы править сам облачный сервис. Для киоска, оператора и синхронизации точки используйте боевое облако.

1. Docker Desktop должен быть запущен.

   ```bat
   docker compose up -d
   ```

2. Миграции и демо-данные:

   ```bat
   pnpm --filter @tshirt/central-relay db:migrate
   pnpm --filter @tshirt/central-relay db:seed
   ```

   В консоли: вход админа (по умолчанию `admin` / `admin123`, можно задать `DEFAULT_ADMIN_LOGIN` / `DEFAULT_ADMIN_PASSWORD`) и токен демо-точки.

3. Сервисы:

   ```bat
   pnpm --filter @tshirt/central-relay dev
   pnpm --filter @tshirt/admin-panel dev
   ```

   Локально: сервис `http://localhost:4100`, админка `http://localhost:5174`.

Не переключайте боевую точку на `http://localhost:4100`, если не собираетесь отлаживать синхронизацию с этой копией. Иначе она отвяжется от `api.kyoma.uk`.

Остановка копии: погасите процессы облачного сервиса и админки, затем `docker compose stop`.

## Деплой боевого облака

Oracle Always Free: Postgres 16 + облачный сервис + админка на `/admin/` + HTTPS.

Инструкция: [deploy/oracle/README.md](deploy/oracle/README.md).

Кратко: DNS `api.kyoma.uk` → IP машины, порты 22/80/443, `deploy/oracle/.env` из `.env.example`, `docker compose up -d --build`.

## Стек

- Интерфейс: React 18, TypeScript, Vite, Tailwind, Zustand, Fabric.js
- Сервер точки: Node.js, Fastify, SQLite, Drizzle
- Облако: Node.js, Fastify, PostgreSQL, Drizzle
- Окна Windows: Electron
- Монорепозиторий: pnpm workspaces + Turborepo

