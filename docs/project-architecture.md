# Truck Workshop - documentacion integral del proyecto

Actualizado: 2026-06-08

Este documento es la referencia tecnica amplia del proyecto completo. Resume como se organiza el monorepo, como se conectan frontend y backend, que modulos existen, que rutas y recursos son canonicos, que scripts operan la plataforma y que reglas debe seguir el equipo para mantener el sistema consistente.

## 1. Proposito del sistema

Truck Workshop es una plataforma operacional para administrar taller, flota, fletes, clientes, abastecimiento, inventario, comunicaciones, costos, incidencias, reporteria y seguridad. El objetivo del producto no es solo registrar datos: debe permitir operar el dia a dia, detectar bloqueos, tomar decisiones rapidas y mantener trazabilidad entre entidades.

La plataforma conecta procesos como:

- Ingreso de un caso de taller.
- Diagnostico, asignacion, repuestos, cotizacion, aprobacion y cierre.
- Control de flota, disponibilidad, documentos, mantencion y telemetria.
- Solicitud, cotizacion, asignacion, seguimiento y rentabilidad de fletes.
- Gestion de clientes como torre de control logistica y comercial.
- Reposicion, ordenes de compra, recepcion, stock y proveedores.
- Costos, combustible, reportes, permisos, notificaciones y comunicaciones.

## 2. Estructura del monorepo

| Ruta | Responsabilidad | Comentarios |
|---|---|---|
| `README.md` | Guia rapida del proyecto. | Incluye stack, comandos, credenciales demo y enlaces. |
| `package.json` | Scripts raiz. | Redirige comandos a `frontend/` o `backend/`. |
| `docker-compose.yml` | SQL Server local. | Contenedor `mcr.microsoft.com/mssql/server:2022-latest`. |
| `frontend/` | Aplicacion React/Electron. | Vite, TypeScript, React Router, Axios, CSS Modules. |
| `backend/` | API Express. | Monolito modular con SQL Server o repositorio en memoria. |
| `api/` | Funcion serverless de Vercel. | `api/[...path].js`: reverse proxy de `/api/*` hacia el backend publico (`BACKEND_URL`). |
| `docs/` | Documentacion tecnica. | Arquitectura, frontend, backend, calidad, UX y despliegue. |
| `logs/` | Logs locales persistentes. | No es fuente de producto. |
| `.runtime-logs/` | Logs temporales. | Regenerables. |
| `tmp/` | Archivos temporales. | No guardar fuente canonica. |

## 3. Stack principal

### Frontend

- React 19.
- TypeScript.
- Vite.
- React Router 7.
- Axios.
- CSS Modules.
- Lucide React.
- Electron para empaquetado desktop Windows.

### Backend

- Node.js con ES Modules.
- Express 5.
- SQL Server via `mssql`.
- Soporte `msnodesqlv8` para autenticacion Windows.
- `helmet`, CORS propio y `morgan`.
- JWT con expiracion configurable.
- PBKDF2 para hashes de password.
- CRUD declarativo desde `backend/src/config/resources.js`.
- Repositorio SQL Server o repositorio en memoria.

## 4. Arranque local

Instalar dependencias:

```bash
npm --prefix frontend install
npm --prefix backend install
```

Solo frontend:

```bash
npm run dev
```

Fullstack demo:

```bash
npm run dev:all
```

SQL Server local:

```bash
npm run db:up
npm run backend:db:reset
npm run backend:db:audit
```

Validacion general:

```bash
npm run check
npm run build
```

## 5. Variables de entorno

### Frontend

Archivo recomendado: `frontend/.env`.

```env
VITE_APP_NAME=Truck Workshop
VITE_API_BASE_URL=http://localhost:4000/api
VITE_ALLOW_MOCK_FALLBACK=true
```

Notas:

- `VITE_API_BASE_URL` debe apuntar al prefijo API real.
- `VITE_ALLOW_MOCK_FALLBACK=true` permite navegar con fallback mock cuando la API falla.
- En produccion conviene dejar `VITE_ALLOW_MOCK_FALLBACK=false`.

### Backend

Archivo recomendado: `backend/.env`. El backend tambien intenta cargar `.env` de la raiz.

Variables operativas principales:

| Variable | Uso |
|---|---|
| `NODE_ENV` | Ambiente de ejecucion. |
| `PORT` | Puerto HTTP, por defecto `4000`. |
| `API_PREFIX` | Prefijo API, por defecto `/api`. |
| `CORS_ORIGIN` | Origenes permitidos en produccion. |
| `DATA_DRIVER` | `memory` o `sqlserver`. |
| `SQL_SERVER`, `SQL_DATABASE`, `SQL_AUTH_TYPE` | Conexion SQL Server. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Firma y expiracion JWT. |
| `AUTH_REQUIRED` | Exige token en rutas privadas. |
| `AUTH_ENFORCE_PERMISSIONS` | Activa validacion de permisos. |
| `AUTH_ALLOW_DEVELOPMENT_LOGIN` | Habilita login demo. |
| `GOOGLE_MAPS_API_KEY` | Habilita Google Maps. |
| `CNE_API_TOKEN` | Habilita sync CNE/Energia Abierta. |

Credenciales demo por defecto:

```text
admin@truckworkshop.cl
truckworkshop
```

## 6. Arquitectura frontend

### 6.1 Estructura real

```text
frontend/src/
  main.tsx
  App.tsx
  router.tsx
  config/
    app.config.ts
    env.ts
    routes.ts
  features/
    <modulo>/
      pages/
      components/
      services/
      hooks/
      types/
      mocks/
      constants/
      utils/
  mocks/
  shared/
    components/
    hooks/
    layout/
    navigation/
    services/
    shortcuts/
    types/
    utils/
  styles/
    globals.css
    layout.css
    reset.css
    variables.css
```

### 6.2 Entrypoints

| Archivo | Rol |
|---|---|
| `frontend/src/main.tsx` | Monta React y estilos globales. |
| `frontend/src/App.tsx` | Entrega `RouterProvider`. |
| `frontend/src/router.tsx` | Lazy imports, rutas publicas, rutas privadas y fallback de carga. |
| `frontend/src/config/routes.ts` | Fuente unica de paths. |
| `frontend/src/config/app.config.ts` | Taxonomia de navegacion del sidebar y contexto. |
| `frontend/src/config/env.ts` | Variables `VITE_*`. |

### 6.3 Shell operacional

`MainLayout` compone la experiencia privada de la plataforma:

| Pieza | Archivo | Rol |
|---|---|---|
| Sidebar | `shared/layout/Sidebar` | Navegacion principal por dominios operativos. |
| Topbar | `shared/layout/Topbar` | Busqueda global, atajos, notificaciones y ayuda. |
| ContextBar | `shared/layout/ContextBar` | Contexto del modulo actual y accesos relacionados. |
| PageContainer | `shared/layout/PageContainer` | Contenedor base de cada vista. |
| PageHeader | `shared/components/PageHeader` | Breadcrumbs, titulo, estado, acciones y hints de atajos. |
| KeyboardShortcutsHelp | `shared/shortcuts/KeyboardShortcutsHelp.tsx` | Ayuda de teclado. |

### 6.4 Navegacion actual

La navegacion visible no se deriva automaticamente de todas las rutas. Se declara en `frontend/src/config/app.config.ts` para organizar el producto por dominios operativos.

Grupos actuales:

| Grupo | Proposito | Items padre |
|---|---|---|
| Inicio | Vista ejecutiva y foco operacional global. | Dashboard operativo. |
| Operacion taller | Casos, agenda, mecanicos y capacidad del taller. | Taller. |
| Flota y logistica | Activos, disponibilidad, viajes, fletes y trafico. | Flota, Logistica. |
| Clientes y comercial | Clientes, cartera, tarifas, riesgo y rentabilidad. | Clientes. |
| Abastecimiento | Compras, inventario, proveedores y auditoria. | Compras y abastecimiento. |
| Finanzas y control | Costos, combustible y reporterias de gestion. | Finanzas. |
| Administracion | Permisos, preferencias, comunicaciones e incidentes. | Configuracion. |

Reglas:

- `routes.ts` define rutas enrutables.
- `router.tsx` monta paginas lazy.
- `app.config.ts` define que rutas aparecen en sidebar y en contexto.
- `showInSidebar=false` oculta flujos secundarios sin romper la ruta.
- `navigationContext.ts` resuelve breadcrumbs y vistas relacionadas desde la navegacion global.
- `entityRoutes.ts` y `operationalSearch.ts` conectan entidades relevantes con rutas de detalle o busqueda.

### 6.5 Rutas frontend por area

| Area | Rutas principales |
|---|---|
| Auth | `/login` |
| Portal publico fletes | `/portal/freight/request`, `/portal/freight/requests`, `/portal/freight/history`, `/portal/freight/tracking/:trackingNumber` |
| Inicio | `/`, `/dashboard` |
| Casos taller | `/cases`, `/cases/new`, `/cases/:caseId`, `/cases/:caseId/assign`, `/cases/:caseId/escalate`, `/cases/:caseId/close` |
| Agenda taller | `/schedule`, `/bays` |
| Diagnostico y reparacion | `/diagnostics`, `/diagnostics/:caseId`, `/repair-solutions/:caseId`, `/checklists`, `/labor`, `/approvals` |
| Equipo taller | `/assignments`, `/mechanics`, `/mechanics/specialties`, `/mechanics/:mechanicId` |
| Camiones taller legacy | `/trucks`, `/trucks/new`, `/trucks/:truckId` |
| Flota operacional | `/fleet`, `/fleet/trucks`, `/fleet/trucks/:truckId`, `/fleet/availability`, `/fleet/health-score` |
| Choferes | `/drivers`, `/drivers/new`, `/drivers/:driverId` |
| Documentos y costos | `/truck-documents`, `/truck-documents/:documentId`, `/truck-costs`, `/truck-costs/:truckId` |
| Combustible | `/fuel`, `/fuel/new`, `/fuel/report` |
| Neumaticos | `/tire-performance`, `/tire-performance/intake`, `/tire-performance/install`, `/tire-performance/remove`, `/tire-performance/comparison` |
| Checklists viaje | `/trip-checklists`, `/trip-checklists/departure`, `/trip-checklists/arrival` |
| Telematica | `/telematics` |
| Clientes | `/customers`, `/customers/:customerId` |
| Fletes | `/freight/requests`, `/freight/requests/new`, `/freight/requests/:requestId`, `/freight/quotes`, `/freight/quotes/:quoteId`, `/freight/assignments`, `/freight/driver-trip-sheets`, `/freight-profitability` |
| Portal cliente interno | `/freight/client-portal`, `/freight/client-portal/requests`, `/freight/client-portal/history`, `/freight/client-portal/tracking/:trackingNumber` |
| Abastecimiento | `/warehouse`, `/warehouse/stock`, `/warehouse/locations`, `/warehouse/managers`, `/warehouse/report`, `/parts`, `/parts/:partId` |
| Compras | `/purchase-orders`, `/purchase-orders/new`, `/purchase-orders/:purchaseOrderId`, `/suppliers`, `/suppliers/new`, `/suppliers/:supplierId` |
| Incidencias y control | `/incidents`, `/incidents/new`, `/incidents/:incidentId`, `/communications`, `/notifications` |
| Reportes | `/reports`, `/reports/driver-performance` |
| Administracion | `/permissions`, `/settings/shortcuts` |
| Preventivo | `/preventive-maintenance`, `/preventive-maintenance/new`, `/preventive-maintenance/:planId` |

### 6.6 Features frontend

El proyecto contiene estas carpetas en `frontend/src/features`:

| Area | Features | Objetivo |
|---|---|---|
| Inicio | `dashboard` | KPIs, urgencias y accesos operacionales. |
| Taller | `workshop-cases`, `diagnostics`, `diagnostic-checklists`, `repair-solutions`, `assignments`, `schedule`, `workshop-bays`, `mechanics`, `quotes`, `approvals`, `labor`, `sla`, `escalation` | Ciclo completo de caso de taller. |
| Clientes y fletes | `customers`, `freight`, `driver-trip-sheets`, `freight-profitability`, `maps` | Cliente 360, solicitud, cotizacion, ruta, asignacion, seguimiento y margen. |
| Flota | `fleet`, `trucks`, `drivers`, `truck-documents`, `preventive-maintenance`, `tire-performance`, `trip-checklists`, `telematics` | Activos, salud, disponibilidad, documentos, viajes y mantencion. |
| Abastecimiento | `warehouse`, `parts`, `purchase-orders`, `suppliers` | Compras, inventario, SKUs, ubicaciones, proveedores y auditoria operacional. |
| Finanzas | `truck-costs`, `fuel`, `reports` | Costos, combustible, reporteria y rendimiento. |
| Control | `incidents`, `communications`, `notifications`, `permissions`, `settings` | Incidencias, mensajeria, alertas, permisos y atajos. |
| Auth | `auth` | Login y proteccion de rutas. |

### 6.7 Inventario tecnico de features

| Feature | Pages | Components | Services | Hooks | Types | Mocks | Constants | Utils |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| approvals | 1 | 4 | 1 | 0 | 1 | 1 | 0 | 1 |
| assignments | 1 | 4 | 1 | 0 | 1 | 0 | 0 | 0 |
| auth | 1 | 2 | 1 | 1 | 1 | 0 | 0 | 0 |
| communications | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 2 |
| customers | 2 | 13 | 1 | 0 | 1 | 1 | 1 | 3 |
| dashboard | 1 | 5 | 1 | 0 | 1 | 0 | 0 | 0 |
| diagnostic-checklists | 1 | 2 | 0 | 0 | 1 | 1 | 0 | 0 |
| diagnostics | 1 | 4 | 1 | 1 | 1 | 0 | 0 | 0 |
| drivers | 3 | 5 | 1 | 0 | 1 | 2 | 1 | 1 |
| driver-trip-sheets | 1 | 4 | 1 | 0 | 1 | 1 | 1 | 0 |
| escalation | 0 | 4 | 0 | 0 | 1 | 1 | 1 | 0 |
| fleet | 5 | 8 | 1 | 0 | 1 | 1 | 1 | 0 |
| freight | 7 | 25 | 2 | 0 | 1 | 1 | 3 | 1 |
| freight-profitability | 1 | 5 | 0 | 0 | 1 | 1 | 1 | 0 |
| fuel | 3 | 7 | 1 | 1 | 1 | 1 | 1 | 1 |
| incidents | 3 | 6 | 0 | 0 | 1 | 1 | 1 | 0 |
| labor | 1 | 3 | 0 | 0 | 1 | 1 | 0 | 0 |
| maps | 0 | 2 | 1 | 0 | 1 | 0 | 0 | 0 |
| mechanics | 3 | 9 | 1 | 0 | 1 | 1 | 0 | 1 |
| notifications | 1 | 1 | 1 | 0 | 1 | 1 | 0 | 1 |
| parts | 2 | 5 | 1 | 0 | 1 | 0 | 0 | 0 |
| permissions | 1 | 5 | 1 | 0 | 1 | 1 | 0 | 0 |
| preventive-maintenance | 3 | 7 | 0 | 0 | 1 | 1 | 1 | 1 |
| purchase-orders | 3 | 6 | 1 | 0 | 1 | 1 | 0 | 0 |
| quotes | 2 | 5 | 1 | 0 | 1 | 1 | 0 | 0 |
| repair-solutions | 1 | 4 | 1 | 0 | 1 | 0 | 0 | 0 |
| reports | 2 | 6 | 2 | 0 | 1 | 0 | 0 | 0 |
| schedule | 1 | 12 | 1 | 0 | 1 | 1 | 0 | 1 |
| settings | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| sla | 0 | 4 | 0 | 0 | 1 | 1 | 0 | 0 |
| suppliers | 3 | 3 | 1 | 0 | 1 | 1 | 0 | 0 |
| telematics | 1 | 5 | 0 | 0 | 1 | 1 | 1 | 1 |
| tire-performance | 5 | 15 | 1 | 0 | 1 | 1 | 1 | 1 |
| trip-checklists | 3 | 5 | 0 | 0 | 1 | 1 | 1 | 0 |
| truck-costs | 2 | 9 | 1 | 0 | 1 | 1 | 1 | 0 |
| truck-documents | 2 | 5 | 1 | 0 | 1 | 1 | 1 | 0 |
| trucks | 3 | 4 | 1 | 0 | 1 | 0 | 1 | 1 |
| warehouse | 5 | 26 | 4 | 0 | 2 | 2 | 0 | 0 |
| workshop-bays | 1 | 3 | 0 | 0 | 1 | 1 | 0 | 0 |
| workshop-cases | 3 | 23 | 1 | 2 | 1 | 0 | 2 | 1 |

### 6.8 Capa de datos frontend

| Archivo | Rol |
|---|---|
| `shared/services/httpClient.ts` | Axios con `baseURL`, timeout, `Authorization`, `X-Request-Id`, `X-User-Id` y `X-User-Name`. |
| `shared/services/resourceApi.ts` | CRUD generico: listar, detalle, crear, actualizar y eliminar. |
| `shared/services/apiErrorHandler.ts` | Normaliza errores Axios/JS. |
| `shared/services/sessionUser.ts` | Obtiene sesion/actor para UI y auditoria. |
| `shared/hooks/useResourceList.ts` | Lista recursos y usa fallback mock controlado si falla. |
| `shared/hooks/useResourceItem.ts` | Carga detalle y usa fallback mock controlado si falla. |
| `shared/hooks/useAsyncAction.ts` | Estado de acciones asincronas. |
| `shared/hooks/useDebounce.ts` | Busquedas/filtros con retraso. |
| `shared/hooks/usePagination.ts` | Estado de paginacion. |
| `shared/hooks/useSearch.ts` | Busqueda local reutilizable. |
| `shared/hooks/useSelection.ts` | Seleccion multiple. |
| `shared/hooks/useModal.ts` | Apertura/cierre de modales. |

Regla operativa:

- Lectura CRUD simple: `useResourceList`, `useResourceItem`, `resourceApi`.
- Escrituras o reglas de negocio: `features/<modulo>/services`.
- UI de dominio: `features/<modulo>/components`.
- UI transversal: `shared/components`.
- Mocks: solo fallback demo o datos para pantallas preparadas, no fuente productiva.

### 6.9 Componentes compartidos

| Componente | Uso recomendado |
|---|---|
| `Badge` | Estados, prioridades, severidades y etiquetas. |
| `Button` | Acciones primarias/secundarias/ghost/danger/icon-only. |
| `Card` | Marco de item o panel cuando aporta estructura. |
| `CommandPalette` | Navegacion y acciones rapidas. |
| `ConfirmModal` | Confirmaciones de acciones criticas. |
| `DataTable` y `Table` | Listados operacionales con estados, paginacion o acciones. |
| `DrawerPanel` | Detalle contextual lateral. |
| `EmptyState`, `ErrorState`, `LoadingState` | Estados visuales estandar. |
| `EntityLink` | Navegacion contextual a entidades. |
| `FilterBar` | Busqueda, filtros y chips compactos. |
| `FormSection` | Agrupacion de formularios. |
| `Input`, `Select`, `Textarea`, `RutInput` | Campos base. |
| `MetricCard` | KPI reutilizable. |
| `Modal` | Dialogo base. |
| `OperationalFocusBar` | Foco operacional y proximas acciones. |
| `PageHeader`, `SectionHeader` | Headers consistentes de pagina/seccion. |
| `RouteNotFound` | Fallback de ruta inexistente. |

## 7. Arquitectura backend

### 7.1 Estructura real

```text
backend/
  .env.example
  package.json
  scripts/
    audit-database.js
    audit-frontend-contract.js
    check-security.js
    check-syntax.js
    frontend-mock-seed.source.ts
    generate-seed-data.js
    migrate.js
    seed.js
    seed-data.js
    smoke-api.js
  src/
    app.js
    server.js
    config/
      env.js
      resource-lookup.js
      resources.js
    db/
      column-type-inference.js
      pool.js
      schema-builder.js
      sql-client.js
    modules/
      <dominio>/
        *.routes.js
        *.controller.js
        *.service.js
    routes/
      index.js
    shared/
      data/
      errors/
      http/
      middleware/
      security/
      utils/
```

### 7.2 Ciclo de request

```text
Cliente React/Electron
  httpClient.ts
    Authorization + X-Request-Id + actor headers
      Express app.js
        helmet + requestContext + CORS + parsers + morgan
          routes/index.js
            /health y /auth publicos
            authenticateRequest
            authorizeRequest
            routers especializados
            CRUD generico por resources.js
              ResourceService
                MemoryResourceRepository o ResourceRepository SQL
                  sendResponse / errorHandler
```

### 7.3 Contrato HTTP

Respuesta simple:

```json
{
  "data": {},
  "meta": {
    "requestId": "uuid"
  }
}
```

Respuesta paginada:

```json
{
  "data": [],
  "meta": {
    "limit": 25,
    "page": 1,
    "requestId": "uuid",
    "total": 0,
    "totalPages": 1
  }
}
```

Error:

```json
{
  "error": {
    "details": {},
    "message": "Descripcion del error",
    "path": "/api/recurso",
    "requestId": "uuid",
    "statusCode": 400
  }
}
```

### 7.4 CRUD generico

El registry `backend/src/config/resources.js` define entidades con:

- `name`
- `route`
- `table`
- `fields`
- `jsonFields`
- `searchableFields`
- `filterFields`
- `sortFields`

Cada recurso generico expone:

```text
GET    /api/<ruta>?page=1&limit=25&search=&sort=createdAt&order=desc
GET    /api/<ruta>/:id
POST   /api/<ruta>
PATCH  /api/<ruta>/:id
DELETE /api/<ruta>/:id
```

El mismo registry alimenta:

- CRUD generico.
- Migraciones.
- Seed.
- Auditoria de base de datos.
- Auditoria frontend/backend.

### 7.5 Recursos backend por dominio

#### Taller

| Recurso | Ruta | Tabla | Uso |
|---|---|---|---|
| `workshop-cases` | `/workshop-cases` | `workshop_cases` | Caso principal de taller. |
| `assignments` | `/assignments` | `assignments` | Asignacion de mecanicos. |
| `escalation-events` | `/escalations` | `escalation_events` | Historial de escalamiento. |
| `approvals` | `/approvals` | `approvals` | Aprobaciones transversales. |
| `diagnostic-checklists` | `/diagnostic-checklists` | `diagnostic_checklists` | Plantillas tecnicas. |
| `diagnostics` | `/diagnostics` | `diagnostics` | Diagnosticos de caso. |
| `sla-configs` | `/sla/configs` | `sla_configs` | Reglas SLA. |
| `labor-tasks` | `/labor/tasks` | `labor_tasks` | Mano de obra. |
| `repair-solutions` | `/repair-solutions` | `repair_solutions` | Soluciones tecnicas. |
| `schedule-events` | `/schedule/events` | `schedule_events` | Agenda. |
| `waiting-queue` | `/schedule/waiting-queue` | `waiting_queue` | Cola de espera. |
| `workshop-bays` | `/bays` | `workshop_bays` | Bahias/estaciones. |
| `quotes` | `/quotes` | `quotes` | Cotizaciones de taller. |
| `mechanics` | `/mechanics` | `mechanics` | Equipo tecnico. |
| `mechanic-specialties` | `/mechanic-specialties` | `mechanic_specialties` | Especialidades. |

#### Clientes, fletes y rutas

| Recurso | Ruta | Tabla | Uso |
|---|---|---|---|
| `customers` | `/customers` | `customers` | Cliente, credito, riesgo, preferencias y tarifas. |
| `freight-requests` | `/freight/requests` | `freight_requests` | Solicitudes de flete. |
| `freight-quotes` | `/freight/quotes` | `freight_quotes` | Cotizaciones de flete. |
| `freight-pricing-settings` | `/freight/pricing-settings` | `freight_pricing_settings` | Configuracion de pricing. |
| `freight-assignments` | `/freight/assignments` | `freight_assignments` | Asignacion camion/chofer. |
| `driver-trip-sheets` | `/driver-trip-sheets` | `driver_trip_sheets` | Planilla de viaje y gastos. |
| `freight-profitability` | `/freight-profitability` | `freight_profitability` | Margen por flete. |

#### Flota, choferes y viajes

| Recurso | Ruta | Tabla | Uso |
|---|---|---|---|
| `drivers` | `/drivers` | `drivers` | Choferes. |
| `driver-documents` | `/driver-documents` | `driver_documents` | Documentos de chofer. |
| `driver-fines` | `/driver-fines` | `driver_fines` | Multas/incidentes de chofer. |
| `trucks` | `/trucks` | `trucks` | Maestro simple/taller. |
| `fleet-trucks` | `/fleet/trucks` | `fleet_trucks` | Maestro operacional de flota. |
| `fleet-availability` | `/fleet/availability` | `fleet_availability` | Disponibilidad. |
| `truck-health-scores` | `/fleet/health-scores` | `truck_health_scores` | Score de salud. |
| `truck-timeline-events` | `/fleet/timeline-events` | `truck_timeline_events` | Timeline de flota. |
| `preventive-maintenance-plans` | `/preventive-maintenance/plans` | `preventive_maintenance_plans` | Planes preventivos. |
| `truck-documents` | `/truck-documents` | `truck_documents` | Documentos de camion. |
| `telematics` | `/telematics` | `truck_telemetry` | Telemetria/GPS. |
| `departure-checklists` | `/trip-checklists/departures` | `trip_departure_checklists` | Checklist salida. |
| `arrival-checklists` | `/trip-checklists/arrivals` | `trip_arrival_checklists` | Checklist llegada. |
| `tire-lifecycles` | `/tire-performance/tires` | `tire_lifecycles` | Ciclo de vida neumaticos. |

#### Abastecimiento, inventario y proveedores

| Recurso | Ruta | Tabla | Uso |
|---|---|---|---|
| `parts` | `/parts` | `parts` | Catalogo SKU/repuestos. |
| `warehouse-locations` | `/warehouse/locations` | `warehouse_locations` | Ubicaciones fisicas. |
| `warehouse-stock` | `/warehouse/stock` | `warehouse_stock` | Stock por SKU/ubicacion. |
| `warehouse-managers` | `/warehouse/managers` | `warehouse_managers` | Responsables de bodega/compra. |
| `warehouse-movements` | `/warehouse/movements` | `warehouse_movements` | Movimientos de stock. |
| `purchase-orders` | `/purchase-orders` | `purchase_orders` | Ordenes de compra. |
| `purchase-requests` | `/purchase-requests` | `purchase_requests` | Solicitudes de compra. |
| `suppliers` | `/suppliers` | `suppliers` | Proveedores. |

#### Finanzas, control y administracion

| Recurso | Ruta | Tabla | Uso |
|---|---|---|---|
| `truck-costs` | `/truck-costs` | `truck_costs` | Costos por camion. |
| `truck-cost-summaries` | `/truck-costs/summaries` | `truck_cost_summaries` | Resumen financiero por camion. |
| `fuel-records` | `/fuel/records` | `fuel_records` | Cargas de combustible. |
| `fuel-price-snapshots` | `/fuel/prices/cache` | `fuel_price_snapshots` | Cache precio combustible. |
| `incidents` | `/incidents` | `incidents` | Incidencias. |
| `notifications` | `/notifications` | `notifications` | Notificaciones. |
| `alert-subscriptions` | `/notifications/subscriptions` | `alert_subscriptions` | Preferencias de alertas. |
| `communication-profiles` | `/communications/profiles` | `communication_profiles` | Perfiles de comunicacion. |
| `communication-provider-configs` | `/communications/provider-configs` | `communication_provider_configs` | Configuracion WhatsApp/Outlook. |
| `communication-conversations` | `/communications/conversations` | `communication_conversations` | Conversaciones. |
| `communication-messages` | `/communications/messages` | `communication_messages` | Mensajes. |
| `communication-quote-links` | `/communications/quote-links` | `communication_quote_links` | Enlaces conversacion-cotizacion. |
| `roles` | `/permissions/roles` | `roles` | Roles. |
| `user-role-assignments` | `/permissions/user-roles` | `user_role_assignments` | Usuarios/roles. |
| `shortcut-preferences` | `/settings/shortcuts` | `shortcut_preferences` | Preferencias de atajos. |

### 7.6 Alias de compatibilidad

| Alias | Recurso real |
|---|---|
| `/api/cases` | `/api/workshop-cases` |
| `/api/checklists` | `/api/diagnostic-checklists` |
| `/api/fuel` | `/api/fuel/records` |
| `/api/labor` | `/api/labor/tasks` |
| `/api/permissions` | `/api/permissions/roles` |
| `/api/preventive-maintenance` | `/api/preventive-maintenance/plans` |
| `/api/sla` | `/api/sla/configs` |
| `/api/tire-performance` | `/api/tire-performance/tires` |
| `/api/fleet/health-score` | `/api/fleet/health-scores` |

### 7.7 Routers especializados

| Modulo | Base API | Endpoints destacados |
|---|---|---|
| `auth` | `/api/auth` | `POST /login` |
| `dashboard` | `/api/dashboard` | `GET /summary` |
| `workshop-cases` | `/api/workshop-cases`, `/api/cases` | CRUD, `GET/POST /:id/escalations`, `POST /:id/assignments`, `POST /:id/close` |
| `assignments` | `/api/assignments` | `GET /`, `POST /` |
| `approvals` | `/api/approvals` | `PATCH /:id`, `POST /:id/approve`, `POST /:id/reject` |
| `diagnostics` | `/api/diagnostics` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `customers` | `/api/customers` | CRUD y `GET /:id/credit` |
| `communications` | `/api/communications` | Provider configs, `POST /send`, WhatsApp webhooks |
| `driver-trip-sheets` | `/api/driver-trip-sheets` | CRUD y `POST /preview` |
| `fleet` | `/api/fleet/health-scores` | `GET /overview`, `POST /recalculate` |
| `freight/pricing` | `/api/freight/pricing` | `GET/PATCH /settings/active`, `POST /calculate` |
| `freight/assignments` | `/api/freight/assignments` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `fuel-prices` | `/api/fuel/prices` | `GET /current`, `GET /history`, `POST /sync` |
| `maps` | `/api/maps` | `GET /places`, `GET /places/:placeId`, `POST /route`, `GET /static-route` |
| `mechanics` | `/api/mechanics` | CRUD especializado |
| `parts` | `/api/parts` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `permissions` | `/api/permissions/roles`, `/api/permissions/user-roles` | CRUD roles y usuarios |
| `purchase-orders` | `/api/purchase-orders` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `quotes` | `/api/quotes` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `reports` | `/api/reports` | `/summary`, `/workshop`, `/fleet`, `/finance`, `/driver-performance`, `/driver-trip-sheets`, `/document-expirations`, `/inventory`, `/tires` |
| `schedule` | `/api/schedule` | `POST /events` |
| `suppliers` | `/api/suppliers` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `tire-performance` | `/api/tire-performance` | `POST /tires`, `POST /tires/intake`, `POST /tires/:id/install`, `POST /tires/:id/remove`, `PATCH/DELETE /tires/:id` |
| `truck-costs` | `/api/truck-costs` | `GET /analytics` |
| `truck-documents` | `/api/truck-documents` | `POST /`, `PATCH /:id`, `DELETE /:id` |
| `warehouse` | `/api/warehouse/locations` | `POST /`, `PATCH /:id`, `DELETE /:id` |

### 7.8 Seguridad y permisos

Rutas publicas:

- `GET /api/health`
- `/api/auth/*`

Resto de API:

1. Pasa por `authenticateRequest`.
2. Si `AUTH_REQUIRED=true`, exige JWT.
3. Pasa por `authorizeRequest`.
4. Si `AUTH_ENFORCE_PERMISSIONS=true`, aplica reglas de `shared/security/permission-rules.js`.

Permisos destacados:

| Dominio | Permisos usados |
|---|---|
| Casos | `cases.view`, `cases.create`, `cases.assign`, `cases.diagnose`, `cases.escalate`, `cases.close` |
| Flota | `fleet.view`, `fleet.manage`, `fleet.maintenance`, `fleet.documents`, `fleet.fuel`, `fleet.costs`, `fleet.incidents`, `fleet.telematics` |
| Compras | `warehouse.manage`, `purchaseOrders.create` |
| Fletes | `freight.requests.view`, `freight.requests.create`, `freight.quotes.create`, `freight.quotes.send`, `freight.assignments.view`, `freight.assign` |
| Reportes | `reports.view` |
| Administracion | `permissions.manage` |

## 8. Contrato frontend/backend

La conexion se basa en estos puntos:

1. `VITE_API_BASE_URL` apunta al `API_PREFIX` del backend.
2. `httpClient.ts` adjunta JWT si existe sesion.
3. `httpClient.ts` genera `X-Request-Id`.
4. `sessionUser.ts` adjunta actor para auditoria.
5. El backend responde siempre con `data/meta` o `error`.
6. Los CRUD simples usan rutas declaradas en `resources.js`.
7. Los flujos con efectos de negocio usan routers especializados.
8. `backend/scripts/audit-frontend-contract.js` verifica que endpoints consumidos por frontend tengan ruta backend.

Ultima validacion conocida del contrato:

```text
Frontend/backend contract OK. 56 frontend endpoints covered by 77 backend routes.
```

## 9. Integraciones externas

| Integracion | Backend | Fallback |
|---|---|---|
| Google Maps | `maps` usa Places, Routes y Static Maps si hay `GOOGLE_MAPS_API_KEY`. | OpenStreetMap/Nominatim y OSRM. |
| CNE/Energia Abierta | `fuel-prices` usa `CNE_API_TOKEN`, cache y scheduler. | Precio diesel fallback configurado. |
| WhatsApp Cloud | `communications` via provider configs. | Modo simulado si no hay credenciales activas. |
| Microsoft Graph/Outlook | `communications` via provider configs. | Modo simulado si no hay credenciales activas. |

## 10. Scripts de calidad y operacion

| Script raiz | Que ejecuta |
|---|---|
| `npm run dev` | Vite frontend. |
| `npm run dev:all` | Fullstack local con backend y frontend. |
| `npm run build` | Build frontend. |
| `npm run lint` | ESLint frontend. |
| `npm run typecheck` | TypeScript frontend. |
| `npm run check` | Lint, typecheck y check backend. |
| `npm run backend:check` | Syntax, security, contract y smoke backend. |
| `npm run backend:migrate` | Migra SQL Server desde resources. |
| `npm run backend:seed` | Carga seed. |
| `npm run backend:seed:generate` | Regenera seed desde mocks frontend. |
| `npm run backend:db:reset` | Migra y carga seed desde mocks. |
| `npm run backend:db:audit` | Audita DB real vs recursos. |
| `npm run db:up` | Levanta SQL Server Docker. |
| `npm run db:down` | Apaga Docker. |

## 11. Como agregar una nueva pantalla frontend

1. Crear tipos en `features/<modulo>/types`.
2. Crear servicio si escribe datos o usa endpoint especializado.
3. Crear mocks solo si la vista debe tener fallback demo.
4. Crear componentes locales en `components`.
5. Crear page en `pages`.
6. Agregar path en `config/routes.ts`.
7. Agregar lazy import y route en `router.tsx`.
8. Agregar item en `app.config.ts` si debe aparecer en sidebar/contexto.
9. Usar `PageHeader`, `SectionHeader`, `FilterBar`, `Table`, `EmptyState`, `ErrorState`, `LoadingState`.
10. Ejecutar `npm run check` y `npm run build`.

## 12. Como agregar un recurso backend CRUD

1. Agregar entrada en `backend/src/config/resources.js`.
2. Definir `fields`, `jsonFields`, `searchableFields`, `filterFields` y `sortFields`.
3. Agregar seed/mocks si debe navegarse en demo.
4. Ejecutar `npm run backend:seed:generate` si cambian mocks.
5. Ejecutar `npm run backend:migrate`.
6. Ejecutar `npm run backend:db:audit`.
7. Consumir desde frontend via `resourceApi` o hook compartido.
8. Actualizar documentacion si cambia superficie API.

## 13. Como agregar un modulo especializado backend

1. Crear `backend/src/modules/<modulo>`.
2. Crear `*.routes.js`.
3. Crear `*.controller.js`.
4. Crear `*.service.js`.
5. Reutilizar `createRepository(resource)` cuando trabaje sobre recursos existentes.
6. Usar `AppError` para errores controlados.
7. Mantener `sendResponse`.
8. Validar relaciones entre entidades.
9. Registrar actor si hay auditoria.
10. Montar router en `backend/src/routes/index.js`.
11. Agregar permisos en `permission-rules.js` si corresponde.
12. Ejecutar `npm run backend:check`.

## 14. Reglas de clean code del proyecto

### Frontend

- No hacer llamadas HTTP dentro de componentes puramente visuales.
- No duplicar tablas, filtros, headers o estados si existe componente compartido.
- No dejar logica de negocio compleja dentro del JSX.
- Mantener `routes.ts`, `router.tsx` y `app.config.ts` sincronizados.
- Mantener mocks fuera de JSX.
- Usar tipos por dominio.
- Usar `RutInput` para RUT.
- Mantener acciones criticas visibles y acciones destructivas separadas.
- Mantener headers compactos y con contexto.

### Backend

- No exponer secretos en seeds ni frontend.
- Usar consultas parametrizadas.
- Mantener `data/meta` y `error` como contrato.
- Usar `AppError` para errores esperados.
- Usar repositorios compartidos para CRUD.
- Usar servicios especializados para transiciones de estado o efectos cruzados.
- Mantener `resources.js` como fuente canonica de tablas CRUD.
- Ejecutar auditorias cuando cambian recursos o SQL.

## 15. Riesgos y pendientes documentados

| Riesgo | Estado | Recomendacion |
|---|---|---|
| Algunos modulos frontend siguen usando mocks para analiticas avanzadas. | Controlado por `VITE_ALLOW_MOCK_FALLBACK`. | Mover datos a endpoints resumidos cuando backend los entregue. |
| Permisos frontend no ocultan toda accion por rol. | Backend puede validar si se activa `AUTH_ENFORCE_PERMISSIONS`. | Sincronizar permisos en UI cuando exista matriz completa. |
| Compras y abastecimiento tiene vistas avanzadas con adapters/mock. | Preparado para backend real. | Crear endpoints agregados para sugerencias, auditoria, calendario y document control. |
| Cliente 360 cruza mucha informacion operacional. | Funciona como torre de control con mocks/adapters. | Consolidar endpoints de cliente operacional para performance. |
| Algunas rutas secundarias estan ocultas en sidebar. | Intencional. | Mantener `showInSidebar=false` y navegar desde acciones contextuales. |
| Los docs dependen de cambios de `routes.ts`, `app.config.ts` y `resources.js`. | Manual. | Actualizar docs junto a cambios de arquitectura. |

## 16. Despliegue

El frontend se publica en Vercel y el backend Express se despliega aparte en una URL publica HTTPS con acceso a SQL Server.

### Proxy serverless

`api/[...path].js` (con copia en `frontend/api/[...path].js`) es una funcion serverless de Vercel que actua como reverse proxy:

- Resuelve el backend desde `BACKEND_URL` o `API_BASE_URL` y normaliza la URL para que termine en `/api`.
- Reenvia metodo, headers y body al backend, filtrando headers hop-by-hop.
- Devuelve `502` con mensaje accionable si falta `BACKEND_URL` o el backend no responde.

Asi el navegador siempre llama a `/api` del mismo origen y Vercel hace el salto al backend real, evitando CORS y dependencias de `localhost`.

### Variables en Vercel

```env
BACKEND_URL=https://URL-PUBLICA-DEL-BACKEND/api
VITE_ALLOW_MOCK_FALLBACK=false
```

`VITE_API_BASE_URL` puede omitirse; si falta, el frontend usa `/api`. Los errores del cliente HTTP se normalizan en `frontend/src/shared/services/apiErrorHandler.ts`.

El detalle completo vive en [despliegue en Vercel](deployment-vercel.md).

## 17. Checklist antes de entregar cambios

Cambios frontend:

```bash
npm --prefix frontend run lint
npm --prefix frontend run typecheck
npm --prefix frontend run build
```

Cambios backend o contrato:

```bash
npm --prefix backend run check
```

Cambios SQL/recursos:

```bash
npm run backend:db:audit
```

Validacion completa:

```bash
npm run check
npm run build
```
