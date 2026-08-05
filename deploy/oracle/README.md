# Oracle Cloud Always Free — central-relay

Стек: Postgres 16 + central-relay (админка на `/admin/`) + Caddy (HTTPS Let’s Encrypt).

## Требования

- VM Ampere A1 (ARM), Ubuntu 22.04/24.04
- DNS: `A` запись `api.kyoma.uk` → public IP инстанса
- Security List / NSG: ingress TCP 22, 80, 443
- Docker + Compose plugin

## Первый запуск на сервере

```bash
# из корня клона репозитория
cd deploy/oracle
cp .env.example .env
# отредактировать POSTGRES_PASSWORD, JWT_SECRET, DEFAULT_ADMIN_PASSWORD
nano .env

docker compose up -d --build
docker compose logs -f relay
```

Проверки:

- `https://api.kyoma.uk/health`
- `https://api.kyoma.uk/admin/` — логин из `.env`

## Обновление

```bash
cd /path/to/TshirtPrinterApp
git pull
cd deploy/oracle
docker compose up -d --build
```

## Operator на точке

После создания точки в админке:

```
CENTRAL_RELAY_URL=https://api.kyoma.uk
POINT_SYNC_ID=<id точки>
POINT_SYNC_TOKEN=<syncToken>
```

В админке для точки: режим QR-загрузки `relay`.
