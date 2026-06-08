import type { ConnectionPool, config as SqlServerConfig } from 'mssql'
import { env } from '../config/env.js'
import { sql } from './sql-client.js'

let poolPromise: Promise<ConnectionPool> | undefined

export function getPool(): Promise<ConnectionPool> {
  poolPromise ??= sql.connect(env.sql as unknown as SqlServerConfig)

  return poolPromise
}

export async function closePool(): Promise<void> {
  if (!poolPromise) {
    return
  }

  const pool = await poolPromise
  await pool.close()
  poolPromise = undefined
}

export { sql }
