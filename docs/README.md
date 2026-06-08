# Documentacion Truck Workshop

Actualizado: 2026-06-08

Esta carpeta documenta el proyecto completo por capas. La idea es que puedas entrar por el tema que necesitas sin leer un documento gigante.

## Indice principal

| Area | Documento | Contenido |
|---|---|---|
| Proyecto | [README raiz](../README.md) | Arranque, scripts, stack, modulos y reglas generales. |
| Proyecto | [Documentacion integral](project-architecture.md) | Arquitectura completa frontend/backend, rutas, recursos, seguridad, scripts, integraciones y checklists. |
| Proyecto | [Mapa general](project-map.md) | Arquitectura monorepo, contratos, flujos y donde tocar segun el cambio. |
| Backend | [Backend](backend/README.md) | Arquitectura, configuracion, API, recursos y operaciones. |
| Frontend | [Frontend](frontend/README.md) | Arquitectura, rutas, layout, datos, features y mantenimiento. |
| Calidad | [Calidad](quality/README.md) | Estado tecnico, riesgos, checklist y matriz frontend/backend. |
| UX | [UX operacional](ux/README.md) | Principios de experiencia operacional y patrones visuales. |
| Despliegue | [Despliegue en Vercel](deployment-vercel.md) | Proxy serverless `api/[...path].js`, variables y backend publico. |

## Lectura recomendada por rol

| Rol | Leer primero |
|---|---|
| Desarrollo frontend | `project-architecture.md`, `project-map.md`, `frontend/overview.md`, `frontend/modules.md`, `frontend/routes.md`, `frontend/data-layout.md`, `frontend/maintenance.md`. |
| Desarrollo backend | `project-architecture.md`, `project-map.md`, `backend/overview.md`, `backend/setup.md`, `backend/api.md`, `backend/resources.md`, `backend/operations.md`. |
| QA o soporte | `quality/module-matrix.md`, `backend/api.md`, `frontend/routes.md`. |
| Producto/UX | `ux/platform-review.md`, `frontend/features.md`, `quality/practices-checklist.md`. |
| DevOps/local setup | `README.md` raiz, `backend/setup.md`, `frontend/maintenance.md`. |

## Documentos puente

Estos archivos se mantienen para compatibilidad con enlaces anteriores y redirigen a la documentacion nueva:

- [frontend-structure.md](frontend-structure.md)
- [frontend-backend-quality-review.md](frontend-backend-quality-review.md)
- [ux-platform-review.md](ux-platform-review.md)

## Estado del proyecto documentado

- Frontend dentro de `frontend/`.
- Backend dentro de `backend/`.
- Menu lateral frontend organizado por Inicio, Operacion taller, Flota y logistica, Clientes y comercial, Abastecimiento, Finanzas y control, y Administracion.
- Headers y barra de contexto derivan breadcrumbs y contexto desde la misma taxonomia de navegacion.
- Topbar con busqueda global, atajos y notificaciones.
- API backend bajo `/api`, con `X-Request-Id`, `data`, `meta` y errores estandarizados.
- SQL Server opcional para persistencia; modo `DATA_DRIVER=memory` para demo local.
- App instalable/desktop con Electron.
