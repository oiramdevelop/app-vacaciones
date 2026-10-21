# Despliegue en vacaciones.floramarket.es

La web de floramarket.es sigue en su hosting compartido. La app de vacaciones va en un **VPS aparte** y sólo se añade
un registro DNS para el subdominio.

```
empleado ──https──▶ vacaciones.floramarket.es ──DNS A──▶ VPS: Caddy (HTTPS) ──▶ app (Next.js) ──▶ PostgreSQL
```

## 1. Contratar el VPS

Cualquier VPS Linux con 2 GB de RAM sirve (p. ej. Hetzner CX22 o IONOS VPS S, ~4–6 €/mes).
Sistema: **Ubuntu 24.04**. Al crearlo, añade tu clave SSH. Apunta la **IP pública**.

## 2. DNS del subdominio

En el panel donde se gestiona el DNS de floramarket.es (normalmente el del hosting o el registrador) crea:

| Tipo | Nombre | Valor | TTL |
| --- | --- | --- | --- |
| A | `vacaciones` | IP del VPS | 3600 |

No toques los registros de `floramarket.es` ni `www`. Comprueba con `nslookup vacaciones.floramarket.es` que devuelve la IP.

## 3. Preparar el servidor (una vez)

```bash
ssh root@IP_DEL_VPS
apt update && apt upgrade -y
curl -fsSL https://get.docker.com | sh
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

## 4. Subir el código y configurar

```bash
git clone <URL-del-repo-privado> /opt/vacaciones     # o copia la carpeta con scp/rsync
cd /opt/vacaciones
cp .env.production.example .env.production
nano .env.production       # rellena POSTGRES_PASSWORD, AUTH_SECRET (openssl rand -base64 32) y ACME_EMAIL
chmod 600 .env.production
```

## 5. Arrancar

```bash
C="docker compose -f docker-compose.prod.yml --env-file .env.production"
$C up -d db
$C --profile tools run --rm migrate                      # crea las tablas
$C --profile tools run --rm \
  -e ADMIN_EMAIL=tu@floramarket.es -e ADMIN_NAME="Tu Nombre" -e ADMIN_PASSWORD='una-contraseña-larga' \
  migrate npx tsx prisma/create-admin.ts                 # primer administrador
$C up -d --build app caddy
```

Abre https://vacaciones.floramarket.es (el certificado tarda unos segundos la primera vez).
**No ejecutes el seed en producción**: carga datos ficticios y borra usuarios.

Después, desde la app: Configuración → política y festivos; Empleados → altas con su empresa (Floramarket / Galacticblum).

## 6. Copias de seguridad

```bash
chmod +x scripts/backup.sh
./scripts/backup.sh                                       # prueba manual
crontab -e
# 30 3 * * * cd /opt/vacaciones && ./scripts/backup.sh >> /var/log/vacaciones-backup.log 2>&1
```

Las copias quedan en `/var/backups/vacaciones` (14 días). **Cópialas también fuera del VPS** (Storage Box, Drive con rclone…):
si el servidor se pierde, se pierden con él.

Restaurar sobre una base **vacía** (prueba al menos una vez, p. ej. en otro servidor):

```bash
gunzip -c /var/backups/vacaciones/vacaciones-FECHA.sql.gz | $C exec -T db psql -U vacaciones -d vacaciones
```

## Actualizar a una versión nueva

```bash
cd /opt/vacaciones && git pull
$C --profile tools run --rm --build migrate               # aplica migraciones nuevas (si las hay)
$C up -d --build app
```

## Comprobaciones

- `curl https://vacaciones.floramarket.es/api/health` → `{"status":"ok"}`
- Logs: `$C logs -f app` · `$C logs -f caddy`
