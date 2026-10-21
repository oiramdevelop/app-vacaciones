#!/usr/bin/env sh
# Copia de seguridad diaria de PostgreSQL. Ejecutar en el servidor desde la carpeta del proyecto:
#   ./scripts/backup.sh
# Programada con cron (ver DEPLOY.md). Conserva los últimos KEEP_DAYS días en BACKUP_DIR.
set -eu

cd "$(dirname "$0")/.."
BACKUP_DIR="${BACKUP_DIR:-/var/backups/vacaciones}"
KEEP_DAYS="${KEEP_DAYS:-14}"

set -a
. ./.env.production
set +a

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
FILE="$BACKUP_DIR/vacaciones-$(date +%Y%m%d-%H%M%S).sql.gz"

docker compose -f docker-compose.prod.yml --env-file .env.production exec -T db \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner | gzip > "$FILE.tmp"
mv "$FILE.tmp" "$FILE"
chmod 600 "$FILE"

find "$BACKUP_DIR" -name 'vacaciones-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "Backup creado: $FILE"
