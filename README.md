# Gestión de vacaciones

Aplicación web para que los empleados soliciten y consulten sus vacaciones y los administradores las gestionen.

**Stack:** Next.js 16 (App Router) · TypeScript estricto · Tailwind CSS 4 · componentes estilo shadcn/ui · PostgreSQL 17 · Prisma 7 ·
Auth.js v5 (beta, credenciales + JWT) · Zod · React Hook Form · Recharts · date-fns · Vitest.

## Puesta en marcha (desarrollo)

Requisitos: Node 20+ y Docker.

```bash
npm install
cp .env.example .env        # rellena AUTH_SECRET (ver abajo); .env nunca se sube al repo
npm run db:up               # PostgreSQL en Docker (puerto 5433 por defecto)
npm run db:migrate          # aplica migraciones y genera el cliente Prisma
npm run db:seed             # 1 admin, 8 empleados, solicitudes y saldos ficticios (BORRA usuarios y solicitudes)
npm run dev                 # http://localhost:3000
```

`AUTH_SECRET`: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`.
Si el puerto 5433 está ocupado, cambia `POSTGRES_PORT` y `DATABASE_URL` en `.env`.

**Usuarios de desarrollo** (contraseña = `SEED_PASSWORD` de tu `.env`): `admin@ejemplo.test`, `lucia.fernandez@ejemplo.test`,
`javier.soto@ejemplo.test`… El seed se niega a ejecutarse con `NODE_ENV=production`.

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` / `build` / `start` | Desarrollo, build y servidor de producción |
| `npm run typecheck` · `npm run lint` | Tipos y ESLint |
| `npm test` | Tests unitarios (dominio y reglas de acceso; sin BD) |
| `npm run test:int` | Tests de integración contra una BD PostgreSQL **aislada** (`<db>_test`, se crea y migra sola) |
| `npm run check` | Todo lo anterior (lo que ejecuta la CI) |
| `npm run db:up` / `db:down` | Arranca / detiene PostgreSQL de desarrollo |
| `npm run db:migrate` · `db:deploy` | Migraciones en desarrollo · en producción |
| `npm run admin:create` | Crea un administrador (ver *Despliegue*) |

Los tests de integración vacían todas las tablas de su BD, por eso **se niegan a ejecutarse** si el nombre de la base no termina en `_test`.
Puedes fijarla con `TEST_DATABASE_URL`.

## Estructura

```
prisma/            schema.prisma, migraciones (con restricciones SQL), seed.ts, create-admin.ts
src/app/           rutas: (employee)/ · admin/ · login · api/health · manifest/iconos (PWA)
src/features/      por dominio: auth, vacations (domain/ = reglas puras), admin, calendar, navigation
src/server/        sólo servidor: db, auth (sesión, contraseñas, limitador), vacations, admin (servicios)
src/components/    ui/ (primitivas) y layout/
tests/             utilidades de los tests de integración
public/            sw.js (service worker mínimo) y offline.html
```

## Modelo de datos y garantías

- **Saldo = libro mayor** (`LedgerEntry`): asignación, ajuste, consumo y devolución. No hay un contador mutable en `User`.
  El índice único `(requestId, type, year)` impide descontar o devolver dos veces.
- **Fechas de calendario** (`@db.Date` / `yyyy-MM-dd`), sin hora ni zona horaria. "Hoy" se calcula en `APP_TIMEZONE`.
- **No solapamiento también en BD**: restricción `EXCLUDE` (btree_gist) sobre solicitudes `PENDING`/`APPROVED` del mismo empleado,
  más `CHECK` de fechas.
- **Concurrencia**: solicitar, aprobar, rechazar, cancelar y ajustar bloquean al empleado (`SELECT … FOR UPDATE`) y cambian de estado con
  `updateMany … WHERE status = …`. Hay tests que lanzan peticiones simultáneas y comprobamos que fallan sin el bloqueo.
- **Políticas versionadas** (`effectiveFrom`); cada solicitud guarda un `policySnapshot` con las reglas y el reparto de días por año,
  así que cambiar la política no altera lo histórico.
- **Auditoría** de todo cambio relevante en `AuditLog` (`/admin/historial`).

## Reglas de negocio

- Saldo disponible = asignado + ajustes − disfrutado − comprometido (aprobado futuro) − pendiente.
- Un periodo que cruza fin de año consume del saldo de cada año por separado.
- Con "solicitar días futuros" desactivado, un periodo no puede llegar a un año posterior al actual.
- Si la política no requiere aprobación, las solicitudes válidas nacen aprobadas.
- Aprobar exige que el saldo del empleado no esté en negativo; cancelar una aprobada (admin, antes de que termine) devuelve los días.
- Medios días **no** soportados (saldos enteros). Una única lista de festivos (el campo `region` existe para ampliarlo).

## Seguridad

- Contraseñas con bcrypt (coste 12); login con mensaje genérico y tiempo de respuesta uniforme.
- Limitador de intentos **en PostgreSQL** (5 fallos / 15 min por email; válido con varias instancias).
  Compromiso conocido: permite bloquear temporalmente la cuenta de alguien cuyo email se conoce; complétalo con un límite por IP en el proxy.
- Autorización en dos capas: `src/proxy.ts` (redirección rápida) y `requireUser`/`requireRole`/`assertRole` (`src/server/auth/session.ts`),
  que releen usuario, rol y estado **de la BD** en cada petición (un JWT manipulado o de un usuario desactivado no concede nada).
  **Toda página, acción o servicio nuevo debe llamar a una de ellas.** Cada servicio de administración vuelve a comprobar el rol.
- Cabeceras: `nosniff`, `X-Frame-Options`, HSTS (producción) y una CSP **parcial** (`frame-ancestors`, `base-uri`, `form-action`, `object-src`).
  No hay CSP de scripts/estilos con nonce: requiere validarla en navegador antes de activarla.
- `npm audit` marca 4 avisos altos en `prisma` (CLI) → `mysql2`/`deepmerge-ts`. Son herramientas de desarrollo, no están en la imagen de
  producción (comprobado en `.next/standalone`) y esta app no usa MySQL.

## PWA (instalable)

`/manifest.webmanifest`, iconos generados (`/pwa-icon/*`, `icon`, `apple-icon`) y un service worker mínimo (`public/sw.js`) que sólo muestra
`offline.html` si falla una navegación. **No cachea páginas ni datos** (son datos personales y los saldos deben venir siempre del servidor).
Requiere HTTPS en producción. Android/Chrome/Edge: icono "Instalar"; iPhone: Compartir → Añadir a pantalla de inicio.
Para una app de tienda (Capacitor) o de escritorio (Tauri/Electron) habría que envolver esta misma URL; la app necesita servidor y BD propios.

## Despliegue (Docker, un servidor)

Guía paso a paso para `vacaciones.floramarket.es` en **[DEPLOY.md](DEPLOY.md)**: VPS, DNS, Caddy con HTTPS automático, primer admin,
copias de seguridad (`scripts/backup.sh`) y actualizaciones.

- Sólo Caddy publica puertos (80/443); la app y la BD quedan en la red interna de Docker.
- `/api/health` responde 200 si la app llega a la BD (healthcheck del contenedor y de tu balanceador).
- Imagen verificada: build multi-etapa, usuario no root, ~315 MB. Para un hosting sin Docker hace falta Node 20+ **y PostgreSQL**;
  el servidor es `node .next/standalone/server.js` tras `npm run build` (copiando `public` y `.next/static`).

## CI

`.github/workflows/ci.yml`: typecheck, lint, tests unitarios, tests de integración (con un servicio PostgreSQL) y build.
