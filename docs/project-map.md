# Truck Workshop - mapa general del proyecto

Actualizado: 2026-06-08

Este documento es la puerta de entrada tecnica al monorepo. Resume que hay en cada carpeta, como se conectan frontend y backend, y que archivos se deben tocar cuando aparece un modulo nuevo o cambia un flujo de negocio.

Para la lectura mas completa del sistema, revisar tambien [documentacion integral del proyecto](project-architecture.md).

## Estructura raiz

| Ruta | Contenido | Notas |
|---|---|---|
| `README.md` | Resumen ejecutivo, scripts y enlaces de documentacion. | Buen punto de partida para instalacion y comandos. |
| `package.json` | Scripts raiz para frontend, backend, DB y desktop. | Coordina comandos con `--prefix`. |
| `docker-compose.yml` | SQL Server Developer local. | Usado por `npm run db:up` y `npm run db:down`. |
| `frontend/` | Aplicacion React, Vite, TypeScript y Electron. | Contiene rutas, features, mocks, UI compartida y build desktop. |
| `backend/` | API Express, SQL Server/memory, CRUD declarativo y modulos especializados. | Expone `/api`. |
| `api/` | Funcion serverless de Vercel `api/[...path].js`. | Reverse proxy que reenvia `/api/*` al backend publico segun `BACKEND_URL`. Ver [despliegue en Vercel](deployment-vercel.md). |
| `docs/` | Documentacion tecnica por area. | Este indice se mantiene como referencia del equipo. |
| `logs/` | Logs locales persistentes. | No forma parte del producto. |
| `.runtime-logs/` | Logs temporales de ejecuciones. | Puede regenerarse localmente. |
| `tmp/` | Archivos temporales. | No debe contener fuente canonica. |

## Arquitectura en una vista

```text
Usuario
  navegador o Electron
    frontend React
      router.tsx + MainLayout
      features/<modulo>
      shared/services/httpClient.ts
        HTTP /api + JWT + X-Request-Id
          backend Express
            routes/index.js
            middleware auth/permisos/contexto
            modulos especializados
            CRUD generico por resources.js
              repositorio memory o SQL Server
                tablas generadas por migrate.js
```

## Flujo de desarrollo local

| Necesidad | Comando | Resultado |
|---|---|---|
| Solo frontend | `npm run dev` | Vite sirve la app. |
| Fullstack demo | `npm run dev:all` | Backend memory y frontend juntos. |
| Backend con hot reload | `npm run backend:dev` | API Express con nodemon. |
| Build frontend | `npm run build` | Genera `frontend/dist`. |
| Validacion general | `npm run check` | Lint/typecheck frontend y check backend. |
| Levantar SQL local | `npm run db:up` | Contenedor SQL Server. |
| Migrar y cargar seed | `npm run backend:db:reset` | Crea estructura y datos iniciales. |
| Auditar DB | `npm run backend:db:audit` | Revisa tablas, columnas, indices y datos. |
| Preview desktop | `npm run desktop:preview` | Compila frontend y abre Electron. |

## Contratos transversales

| Contrato | Fuente | Consumidores |
|---|---|---|
| Paths frontend | `frontend/src/config/routes.ts` | `router.tsx`, `app.config.ts`, links y navegacion. |
| Taxonomia de sidebar | `frontend/src/config/app.config.ts` | `Sidebar`, `ContextBar`, busqueda y accesos relacionados. |
| Contexto de navegacion | `frontend/src/shared/navigation/navigationContext.ts` | `PageHeader`, `ContextBar` y breadcrumbs operacionales. |
| Cliente HTTP | `frontend/src/shared/services/httpClient.ts` | Servicios de features y `resourceApi.ts`. |
| CRUD frontend | `frontend/src/shared/services/resourceApi.ts` | Hooks `useResourceList` y `useResourceItem`. |
| Recursos backend | `backend/src/config/resources.js` | CRUD generico, migracion, seed y auditoria. |
| Montaje API | `backend/src/routes/index.js` | Express, auth, alias y routers especializados. |
| Configuracion runtime | `backend/src/config/env.js`, `frontend/src/config/env.ts` | API, CORS, auth, mapas, combustible y base URL. |
| Seed demo | `backend/scripts/frontend-mock-seed.source.ts`, `backend/scripts/seed-data.js` | Datos iniciales memory/SQL. |

## Areas funcionales

| Area | Frontend | Backend | Objetivo |
|---|---|---|---|
| Auth y permisos | `auth`, `permissions`, `settings` | `auth`, `permissions`, `shortcut-preferences` | Login, roles, permisos y atajos. |
| Dashboard | `dashboard` | `dashboard`, `reports` | Vista ejecutiva de estado operacional. |
| Taller | `workshop-cases`, `diagnostics`, `diagnostic-checklists`, `repair-solutions`, `assignments`, `schedule`, `workshop-bays`, `mechanics`, `quotes`, `approvals`, `labor`, `sla` | Modulos equivalentes y CRUD asociado | Caso de taller desde ingreso hasta cierre. |
| Clientes y fletes | `customers`, `freight`, `driver-trip-sheets`, `freight-profitability`, `maps` | `customers`, `freight`, `driver-trip-sheets`, `freight-profitability`, `maps` | Cliente 360, cartera, credito, torre de control logistica, solicitud, cotizacion, ruta, asignacion y margen. |
| Flota | `fleet`, `trucks`, `drivers`, `truck-documents`, `preventive-maintenance`, `tire-performance`, `trip-checklists`, `telematics` | Recursos de flota, documentos, choferes, neumaticos y telemetria | Disponibilidad, activos, vencimientos, salud y viajes. |
| Compras e inventario | `warehouse`, `parts`, `purchase-orders`, `suppliers` | `warehouse`, `parts`, `purchase-orders`, `suppliers`, `purchase-requests` | Decision de compra, stock, SKUs, ubicaciones, solicitudes, OC, recepcion, auditoria, calendario y proveedores. |
| Finanzas | `truck-costs`, `fuel`, `reports` | `truck-costs`, `fuel-prices`, `reports` | Costos, combustible, analitica y reporteria. |
| Control operacional | `communications`, `notifications`, `incidents`, `reports` | `communications`, `notifications`, `incidents`, `reports` | Mensajeria, alertas, incidentes y trazabilidad. |

## Flujo frontend-backend

1. La pagina de feature llama un servicio propio o `resourceApi`.
2. `httpClient.ts` agrega `baseURL`, `Authorization`, `X-Request-Id`, `X-User-Id` y `X-User-Name`.
3. El backend valida auth si `AUTH_REQUIRED=true`.
4. `routes/index.js` decide si la ruta va a un modulo especializado o al CRUD generico.
5. El servicio backend usa repositorio memory o SQL Server segun `DATA_DRIVER`.
6. La respuesta vuelve como `{ data, meta }`; los errores vuelven como `{ error }`.
7. Los hooks frontend pueden mostrar fallback mock si el backend falla y `VITE_ALLOW_MOCK_FALLBACK=true`.

## Donde tocar segun el cambio

| Cambio | Archivos principales |
|---|---|
| Nueva ruta visible | `frontend/src/config/routes.ts`, `frontend/src/router.tsx`, `frontend/src/config/app.config.ts`. |
| Nueva pantalla | `frontend/src/features/<modulo>/pages`, componentes locales, servicio si escribe datos. |
| Nuevo CRUD backend | `backend/src/config/resources.js`, seed/mocks si necesita demo, docs de API. |
| Flujo con reglas de negocio | `backend/src/modules/<modulo>`, `backend/src/routes/index.js`, servicio frontend. |
| Cambio de navegacion/sidebar | `frontend/src/config/app.config.ts`, `Sidebar`, `ContextBar`, docs frontend. |
| Cambio de datos demo | Mocks frontend y luego `npm run backend:seed:generate`. |
| Cambio SQL | `resources.js`, `npm run backend:migrate`, `npm run backend:db:audit`. |
| Cambio de permisos | `backend/src/shared/middleware/permission-rules.js`, `permissions`, seeds de roles. |
| Nueva integracion externa | Config en `env.js`, modulo backend, servicio frontend, `.env.example`. |

## Reglas de mantenimiento

- Mantener `routes.ts`, `router.tsx` y `app.config.ts` sincronizados.
- Si cambia la navegacion visible, revisar `navigationContext.ts`, `ContextBar`, `PageHeader` y la documentacion de rutas.
- Preferir `shared/components` y `shared/hooks` antes de duplicar UI o carga de datos.
- Usar modulos especializados cuando existan transiciones, validaciones cruzadas o efectos en varias tablas.
- Mantener los mocks como fallback de desarrollo, no como fuente unica de verdad.
- Regenerar `backend/scripts/seed-data.js` desde mocks cuando cambian datos demo.
- Ejecutar `npm run check` y `npm run build` antes de cerrar cambios frontend.
- Ejecutar `npm run backend:db:audit` cuando cambia la estructura de recursos o SQL.
