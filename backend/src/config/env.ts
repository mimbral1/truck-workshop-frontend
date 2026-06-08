import { config } from 'dotenv'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const configDir = dirname(fileURLToPath(import.meta.url))

config({ path: resolve(configDir, '../../../.env'), quiet: true })
config({ path: resolve(configDir, '../../.env'), quiet: true })

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback
  }

  return ['true', '1', 'yes', 'y'].includes(String(value).toLowerCase())
}

function parseList(value: string | undefined, fallback: string[]): string[] {
  if (!value) {
    return fallback
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value)

  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDurationSeconds(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const match = String(value).trim().match(/^(\d+)([smhd])?$/i)

  if (!match) {
    return fallback
  }

  const amount = Number(match[1])
  const unit = String(match[2] || 's').toLowerCase()
  const multiplier = unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1

  return amount * multiplier
}

/** Configuracion de conexion a SQL Server. Las llaves varian segun el tipo de autenticacion. */
export interface SqlConfig {
  server: string
  database: string
  options: Record<string, unknown>
  pool: { idleTimeoutMillis: number; max: number; min: number }
  port?: number
  driver?: string
  user?: string
  password?: string
  authentication?: {
    type: string
    options: { domain: string; password: string; userName: string }
  }
}

function buildSqlConfig(): SqlConfig {
  const authType = String(process.env.SQL_AUTH_TYPE || 'sql').toLowerCase()
  const options: Record<string, unknown> = {
    encrypt: parseBoolean(process.env.SQL_ENCRYPT, false),
    trustServerCertificate: parseBoolean(process.env.SQL_TRUST_SERVER_CERTIFICATE, true),
  }
  const baseConfig: SqlConfig = {
    database: process.env.SQL_DATABASE || 'TruckWorkshop',
    options,
    pool: {
      idleTimeoutMillis: 30000,
      max: 10,
      min: 0,
    },
    server: process.env.SQL_SERVER || 'localhost',
  }

  if (process.env.SQL_PORT) {
    baseConfig.port = Number(process.env.SQL_PORT)
  } else if (!['trusted', 'windows-trusted'].includes(authType)) {
    baseConfig.port = 1433
  }

  if (['trusted', 'windows-trusted'].includes(authType)) {
    return {
      ...baseConfig,
      driver: 'msnodesqlv8',
      options: {
        ...options,
        trustedConnection: true,
      },
    }
  }

  if (['ntlm', 'windows', 'integrated'].includes(authType)) {
    return {
      ...baseConfig,
      authentication: {
        options: {
          domain: process.env.SQL_DOMAIN || process.env.USERDOMAIN || '',
          password: process.env.SQL_PASSWORD || '',
          userName: process.env.SQL_USER || process.env.USERNAME || '',
        },
        type: 'ntlm',
      },
    }
  }

  return {
    ...baseConfig,
    password: process.env.SQL_PASSWORD || '',
    user: process.env.SQL_USER || 'sa',
  }
}

const nodeEnv = process.env.NODE_ENV || 'development'
const jwtSecret = process.env.JWT_SECRET || 'development-only-secret'

if (nodeEnv === 'production' && jwtSecret === 'development-only-secret') {
  throw new Error('JWT_SECRET es obligatorio en produccion')
}

export const env = {
  apiPrefix: process.env.API_PREFIX || '/api',
  auth: {
    allowDevelopmentLogin: parseBoolean(process.env.AUTH_ALLOW_DEVELOPMENT_LOGIN, nodeEnv !== 'production'),
    devLoginEmail: process.env.DEV_LOGIN_EMAIL || 'admin@truckworkshop.cl',
    devLoginPasswordHash: process.env.DEV_LOGIN_PASSWORD_HASH || '',
    enforcePermissions: parseBoolean(process.env.AUTH_ENFORCE_PERMISSIONS, nodeEnv === 'production'),
    jwtExpiresInSeconds: Math.max(60, parseDurationSeconds(process.env.JWT_EXPIRES_IN, 8 * 60 * 60)),
    requireAuth: parseBoolean(process.env.AUTH_REQUIRED, nodeEnv === 'production'),
  },
  cne: {
    apiToken: process.env.CNE_API_TOKEN || process.env.ENERGIA_ABIERTA_API_TOKEN || '',
    baseUrl: process.env.CNE_API_BASE_URL || 'https://api.cne.cl',
    defaultFuelType: process.env.CNE_DEFAULT_FUEL_TYPE || 'DIESEL',
    defaultRegionCode: process.env.CNE_DEFAULT_REGION_CODE || '13',
    fallbackDieselPricePerLiter: Math.max(0, parseNumber(process.env.CNE_FALLBACK_DIESEL_PRICE_PER_LITER, 1050)),
    fuelPricesPath: process.env.CNE_FUEL_PRICES_PATH || '/api/ea/precio/combustibleliquido',
    requestTimeoutMs: Math.max(1000, parseNumber(process.env.CNE_REQUEST_TIMEOUT_MS, 12000)),
    syncIntervalMinutes: Math.max(1, parseNumber(process.env.CNE_SYNC_INTERVAL_MINUTES, 15)),
  },
  corsOrigins: parseList(process.env.CORS_ORIGIN, [
    'http://127.0.0.1:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5174',
    'http://localhost:5174',
    'http://127.0.0.1:5175',
    'http://localhost:5175',
    'http://127.0.0.1:5176',
    'http://localhost:5176',
    'http://127.0.0.1:5177',
    'http://localhost:5177',
    'http://127.0.0.1:5178',
    'http://localhost:5178',
    'http://127.0.0.1:5181',
    'http://localhost:5181',
    'http://127.0.0.1:5183',
    'http://localhost:5183',
  ]),
  dataDriver: process.env.DATA_DRIVER || 'sqlserver',
  googleMaps: {
    apiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    country: process.env.GOOGLE_MAPS_COUNTRY || 'cl',
    language: process.env.GOOGLE_MAPS_LANGUAGE || 'es-419',
    regionCode: process.env.GOOGLE_MAPS_REGION_CODE || 'CL',
  },
  openMaps: {
    nominatimUrl: process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org',
    osrmUrl: process.env.OSRM_BASE_URL || 'https://router.project-osrm.org',
    userAgent: process.env.MAPS_USER_AGENT || 'truck-workshop-api/1.0',
  },
  jwtSecret,
  nodeEnv,
  port: Number(process.env.PORT || 4000),
  sql: buildSqlConfig(),
} as const
