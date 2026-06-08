# Despliegue Frontend En Vercel

Actualizado: 2026-06-08

El frontend no debe llamar a `http://localhost:4000/api` en produccion. En Vercel, `localhost` es el navegador o la funcion serverless, no el backend local del desarrollador. Por eso el repositorio incluye un proxy serverless que reenvia `/api/*` al backend publico.

## Proxy serverless `api/[...path].js`

El archivo `api/[...path].js` en la raiz (y su copia en `frontend/api/[...path].js`) es una funcion serverless de Vercel que actua como reverse proxy entre el frontend desplegado y el backend Express publico.

Comportamiento:

- Resuelve el backend desde `BACKEND_URL` o, como alias, `API_BASE_URL`. Normaliza la URL y garantiza que termine en `/api`.
- Si no hay backend configurado responde `502` con `BACKEND_URL no configurado en Vercel`.
- Reconstruye la URL destino con el path capturado (`[...path]`) y conserva el query string (descartando el parametro interno `path`).
- Reenvia metodo, headers y body. Filtra headers hop-by-hop (`connection`, `content-length`, `transfer-encoding`, `host`, etc.) tanto en la peticion como en la respuesta.
- Para metodos distintos de `GET`/`HEAD` serializa el body (string, Buffer o JSON).
- Si el backend no responde devuelve `502` con `No se pudo conectar con el backend publico` y el detalle del error de red.

Asi el navegador siempre habla con el mismo origen (`/api`) y Vercel hace el salto al backend real, evitando problemas de CORS y de `localhost`.

## Variables En Vercel

Configurar en el proyecto frontend de Vercel:

```env
BACKEND_URL=https://URL-PUBLICA-DEL-BACKEND/api
VITE_ALLOW_MOCK_FALLBACK=false
```

- `BACKEND_URL`: URL publica HTTPS del backend. Si no termina en `/api`, el proxy lo agrega.
- `VITE_ALLOW_MOCK_FALLBACK=false`: desactiva el fallback a mocks en produccion para no enmascarar fallas reales del backend.
- `VITE_API_BASE_URL` puede omitirse. Si se omite, el frontend usa `/api` y el proxy serverless reenvia al backend definido por `BACKEND_URL`.

## Prueba Rapida

Antes de probar login, esta URL debe responder desde el navegador:

```txt
https://truck-workshop-frontend.vercel.app/api/health
```

- Si responde `BACKEND_URL no configurado en Vercel`, falta la variable `BACKEND_URL`.
- Si responde `No se pudo conectar con el backend publico`, la URL del backend no existe, no es publica o el backend esta caido.

Los mensajes de error del cliente HTTP se normalizan en `frontend/src/shared/services/apiErrorHandler.ts`, que distingue fallas de red, problemas de configuracion de despliegue y errores del backend para mostrar mensajes accionables.

## Backend

El backend debe estar desplegado en una URL publica HTTPS y debe tener acceso a una base de datos valida. `SQL_SERVER=.\CATA` solo funciona en el computador local.

Si el frontend llama directo al backend sin proxy, agregar los dominios Vercel al backend:

```env
CORS_ORIGIN=https://truck-workshop-frontend.vercel.app,https://truck-workshop-frontend-dgt6dvpg8-yoni1999s-projects-dd0bbbdd.vercel.app
```
