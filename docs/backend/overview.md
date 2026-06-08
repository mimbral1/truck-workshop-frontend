# Backend - arquitectura

Actualizado: 2026-06-08

Backend monolitico modular en **TypeScript** para Truck Workshop. Expone una API Express bajo `/api`, puede trabajar contra SQL Server o contra un repositorio en memoria para demo local, y reutiliza un registry declarativo de recursos para generar CRUD, migraciones, seed y auditoria de base de datos.

Todo `src/**` esta en TypeScript (`.ts`). El codigo se ejecuta con `tsx` (dev/scripts) y se valida con `tsc --noEmit`; los `scripts/` de tooling siguen en JS y corren via `tsx`. Los specifiers de import usan extension `.js` por compatibilidad NodeNext (resuelven al `.ts` hermano).

## Stack

- Node.js con ES Modules y **TypeScript** (strict, `module`/`moduleResolution` NodeNext).
- Ejecucion con `tsx`; typecheck con `tsc`.
- Express 5.
- SQL Server con `mssql`. El driver nativo `msnodesqlv8` (autenticacion Windows) se carga de forma diferida.
- `helmet`, `cors` y `morgan`.
- Repositorio SQL generico con consultas parametrizadas.
- Repositorio en memoria para desarrollo sin SQL Server.
- Migracion propia desde `src/config/resources.ts`.
- Seeds generados desde mocks del frontend.
- Sistema de tipos en `src/shared/types/domain.ts` y augmentacion de Express en `src/types/express.d.ts`.
- Pruebas unitarias con `node:test` (`npm test`, incluidas en `npm run check`).

## Arranque

```text
src/server.ts
  crea la app con createApp()
  inicia scheduler de precios de combustible
  escucha en env.port
  cierra scheduler y pool SQL en SIGINT/SIGTERM

src/app.ts
  registra helmet, CORS, parsers y morgan
  registra requestContext para X-Request-Id
  monta rutas con registerRoutes(app)
  aplica notFoundHandler
  aplica errorHandler
```

## Estructura

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

## Capas

| Capa | Responsabilidad |
|---|---|
| `config` | Entorno, recursos CRUD y lookup de recursos. |
| `db` | Conexion SQL, inferencia de tipos y construccion de schema. |
| `routes` | Montaje central de routers. |
| `shared/http` | Routers/controladores CRUD, response helpers y actor de request. |
| `shared/data` | Repositorios SQL/memory y servicios CRUD. |
| `shared/middleware` | Request context, errores y 404. |
| `modules` | Flujos con reglas propias. |
| `scripts` | Migracion, seed, auditoria y chequeo de sintaxis. |

## Request ID

`requestContext` crea o propaga `X-Request-Id`.

- Respuestas exitosas: `meta.requestId`.
- Errores controlados/no controlados: `error.requestId`.
- Frontend envia `X-Request-Id` desde `httpClient.ts`.

Esto permite correlacionar fallas entre navegador, API y logs.

## CRUD declarativo

`resources.js` describe:

- `name`: nombre logico.
- `route`: ruta API.
- `table`: tabla SQL.
- `fields`: campos camelCase expuestos.
- `jsonFields`: campos serializados como JSON.
- `searchableFields`: busqueda textual.
- `filterFields`: filtros aceptados.
- `sortFields`: ordenamientos recomendados.

El mismo registry alimenta:

- CRUD generico.
- Migracion.
- Seed.
- Auditoria.

## Modulos especializados

Se usan cuando hay reglas de negocio, transiciones o integraciones. Ejemplos:

- `workshop-cases`: creacion, asignacion, escalamiento y cierre.
- `diagnostics`: diagnostico vinculado a caso y avance de flujo.
- `freight`: pricing y asignacion de camion/chofer.
- `communications`: WhatsApp/Outlook y webhooks.
- `maps`: Google Maps o fallback OSM/OSRM.
- `reports`: reporteria agregada.
- `truck-documents`: vencimientos, disponibilidad, timeline y health score.
- `tire-performance`: ciclo de vida de neumaticos.
- `fuel-prices`: precio diesel actual, historico, sync y scheduler CNE.

## Seguridad

- `GET /api/health` y `/api/auth/*` son publicos.
- El resto de rutas pasa por `authenticateRequest`.
- `AUTH_REQUIRED=true` exige JWT valido.
- `AUTH_ENFORCE_PERMISSIONS=true` activa reglas de `shared/security/permission-rules.js`.
- El usuario `ADMIN` y el permiso `*` actuan como bypass controlado de permisos.
