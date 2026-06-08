# Truck Workshop

Actualizado: 2026-06-08

Truck Workshop es una plataforma operacional para taller, flota, fletes, inventario, compras, comunicaciones, incidencias, reporteria y administracion. El repositorio esta organizado como monorepo: la raiz coordina scripts, `frontend/` contiene la aplicacion React/Electron, `backend/` contiene la API Express, `api/` contiene el proxy serverless de Vercel y `docs/` contiene la documentacion tecnica.

## Lectura rapida

| Carpeta | Rol |
|---|---|
| `frontend/` | App React, TypeScript, Vite, React Router, Axios, CSS Modules, Lucide React y empaquetado Electron. |
| `backend/` | API Node/Express bajo `/api`, SQL Server o repositorio en memoria, CRUD declarativo y modulos con reglas de negocio. |
| `api/` | Funcion serverless `api/[...path].js` que en Vercel reenvia `/api/*` al backend publico (`BACKEND_URL`). |
| `docs/` | Documentacion separada por backend, frontend, calidad, UX operacional y despliegue. |
| `logs/` | Salidas locales de procesos de desarrollo. |
| `.runtime-logs/` | Logs temporales creados por ejecuciones locales. |

## Documentacion

Empieza por el indice general:

- [Indice de documentacion](docs/README.md)
- [Documentacion integral del proyecto](docs/project-architecture.md)
- [Mapa general del proyecto](docs/project-map.md)
- [Backend](docs/backend/README.md)
- [Catalogo backend de recursos y modulos](docs/backend/resources.md)
- [Frontend](docs/frontend/README.md)
- [Mapa frontend de modulos](docs/frontend/modules.md)
- [Calidad frontend/backend](docs/quality/README.md)
- [UX operacional](docs/ux/README.md)

Puentes historicos:

- [Estructura frontend](docs/frontend-structure.md)
- [Revision frontend/backend](docs/frontend-backend-quality-review.md)
- [Auditoria UX](docs/ux-platform-review.md)

## Stack

Frontend:

- React 19, TypeScript, Vite y React Router.
- Axios con cliente HTTP centralizado.
- CSS Modules mas tokens globales en `frontend/src/styles`.
- Lucide React para iconografia.
- Electron para preview, pack e instalador Windows.
- Vitest para pruebas unitarias del frontend.

Backend:

- Node.js con ES Modules, **TypeScript** (strict, NodeNext) y Express 5. Ejecucion con `tsx`, typecheck con `tsc`.
- SQL Server con `mssql` y soporte `msnodesqlv8` (carga diferida).
- Repositorio en memoria para demo local.
- CRUD generico desde `backend/src/config/resources.ts`.
- Modulos especializados para flujos como casos, diagnosticos, fletes, compras, comunicaciones, mapas, reportes y neumaticos.
- Pruebas unitarias con `node:test` (frontend con `vitest`).

## Instalacion

```bash
npm --prefix frontend install
npm --prefix backend install
```

## Desarrollo local

Solo frontend:

```bash
npm run dev
```

Fullstack demo con backend en memoria:

```bash
npm run dev:all
```

Por defecto, `dev:all` levanta:

- Backend: `http://localhost:4000/api`
- Frontend: `http://127.0.0.1:5181`

Credenciales de desarrollo:

```txt
admin@truckworkshop.cl
truckworkshop
```

## SQL Server local

Levantar SQL Server Developer con Docker:

```bash
npm run db:up
```

Crear tablas, migrar y cargar datos:

```bash
npm run backend:db:reset
```

Auditar estructura y datos:

```bash
npm run backend:db:audit
```

Apagar contenedor:

```bash
npm run db:down
```

## Variables de entorno

Frontend: copiar `frontend/.env.example` a `frontend/.env`.

```env
VITE_APP_NAME=Truck Workshop
VITE_API_BASE_URL=http://localhost:4000/api
VITE_ALLOW_MOCK_FALLBACK=true
```

Backend: copiar `backend/.env.example` a `backend/.env`.

Variables principales:

- `PORT=4000`
- `API_PREFIX=/api`
- `CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:5181,http://localhost:5181`
- `DATA_DRIVER=memory` para demo sin SQL Server.
- `DATA_DRIVER=sqlserver` para persistencia real.
- `SQL_SERVER`, `SQL_DATABASE`, `SQL_AUTH_TYPE`, `SQL_USER`, `SQL_PASSWORD`.
- `JWT_SECRET` obligatorio en produccion y `JWT_EXPIRES_IN=8h` para expiracion de sesion.
- `AUTH_REQUIRED=true` y `AUTH_ENFORCE_PERMISSIONS=true` para exigir JWT y permisos en backend.
- `AUTH_ALLOW_DEVELOPMENT_LOGIN=false` en produccion.
- `GOOGLE_MAPS_API_KEY` opcional; si falta, mapas usa OpenStreetMap/OSRM.
- `CNE_API_TOKEN` opcional; si falta, precios de combustible usan fallback configurado.

## Scripts principales

| Script | Uso |
|---|---|
| `npm run dev` | Levanta Vite desde `frontend/`. |
| `npm run dev:all` | Levanta backend memory y frontend juntos. |
| `npm run build` | Compila frontend. |
| `npm run preview` | Sirve el build frontend. |
| `npm run lint` | Ejecuta lint frontend. |
| `npm run typecheck` | Ejecuta typecheck frontend. |
| `npm run check` | Ejecuta lint, typecheck, tests (frontend + backend) y chequeo backend (incluye `tsc`, tests, seguridad, contrato y smoke). |
| `npm run backend:dev` | Levanta backend con nodemon. |
| `npm run backend:start` | Levanta backend en modo start. |
| `npm run backend:migrate` | Migra SQL Server desde el registry de recursos. |
| `npm run backend:seed` | Carga datos iniciales. |
| `npm run backend:seed:generate` | Regenera seed desde mocks frontend. |
| `npm run backend:db:reset` | Migra y carga seed. |
| `npm run backend:db:audit` | Audita DB esperada vs DB real. |
| `npm run db:up` | Levanta SQL Server Docker. |
| `npm run db:down` | Apaga SQL Server Docker. |

## Aplicacion de escritorio

```bash
npm run desktop:preview
npm run desktop:pack
npm run desktop:dist
```

- `desktop:preview`: compila frontend y abre Electron.
- `desktop:pack`: genera paquete portable en `frontend/release/win-unpacked`.
- `desktop:dist`: genera instalador Windows en `frontend/release/`.

## Modulos funcionales

| Area | Incluye |
|---|---|
| Inicio | Dashboard operativo global y foco de urgencias. |
| Operacion taller | Casos, agenda, diagnosticos, asignaciones, checklists, mecanicos, bahias, cotizaciones, aprobaciones y mano de obra. |
| Flota y logistica | Centro de flota, disponibilidad, health score, camiones, documentos, choferes, mantenimiento, neumaticos, checklists de viaje, telemetria, solicitudes, cotizaciones, asignacion y rentabilidad de fletes. |
| Clientes y comercial | Modulo de clientes, cartera, credito, riesgo, tarifas, operaciones, comunicaciones y rentabilidad. |
| Abastecimiento | Compras, inventario, reposicion sugerida, solicitudes, OC, recepcion, documentos, SKUs, stock, ubicaciones, compradores, proveedores, auditoria, calendario y reportes. |
| Finanzas y control | Costos por camion, combustible, reportes operativos y rendimiento de choferes. |
| Administracion | Permisos, atajos, comunicaciones, notificaciones e incidentes. |

## Rutas frontend clave

Todas las rutas viven en `frontend/src/config/routes.ts` y se montan en `frontend/src/router.tsx`. Consulta [rutas frontend](docs/frontend/routes.md) para el mapa completo.

Rutas principales:

- `/login`
- `/dashboard`
- `/cases`, `/cases/new`, `/cases/:caseId`
- `/diagnostics`, `/diagnostics/:caseId`
- `/freight/requests`, `/freight/quotes`, `/freight/assignments`
- `/fleet`, `/fleet/trucks`, `/fleet/availability`, `/fleet/health-score`
- `/customers`, `/customers/:customerId`
- `/warehouse`, `/warehouse?view=suggestions`, `/warehouse?view=calendar`, `/warehouse/stock`, `/warehouse/locations`
- `/incidents`, `/incidents/new`, `/incidents/:incidentId`
- `/reports`

## API backend

El backend expone `/api`. El contrato estandar devuelve `data` y `meta.requestId`; los errores devuelven `error.requestId`. Los recursos CRUD genericos aceptan:

```txt
GET    /api/<ruta>?page=1&limit=25&search=&sort=createdAt&order=desc
GET    /api/<ruta>/:id
POST   /api/<ruta>
PATCH  /api/<ruta>/:id
DELETE /api/<ruta>/:id
```

Consulta [API y recursos backend](docs/backend/api.md) para recursos, alias y rutas especializadas.

## Validacion antes de entregar cambios

```bash
npm run check
npm run build
```

Si el cambio toca base de datos:

```bash
npm run backend:db:audit
```

## Convenciones de trabajo

- Mantener endpoints, payloads y contratos backend estables.
- Agregar rutas nuevas en `routes.ts`, `router.tsx` y `app.config.ts` si aparecen en navegacion.
- Usar componentes compartidos antes de crear variantes nuevas.
- Guardar relaciones por ID y snapshots legibles cuando haga falta.
- Usar `RutInput` para campos RUT en frontend.
- Mantener secretos solo en `.env`.
- No editar manualmente `backend/scripts/seed-data.js`; se regenera desde mocks.
