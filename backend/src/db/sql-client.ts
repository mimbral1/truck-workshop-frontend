import tediousSql from 'mssql'
import { env } from '../config/env.js'

type SqlModule = typeof tediousSql

// El driver nativo `msnodesqlv8` (autenticacion Windows) requiere compilacion nativa
// y solo se necesita cuando SQL_AUTH_TYPE lo solicita. Se carga de forma diferida para
// no exigir el binario nativo cuando se usa el driver `tedious` o el repositorio en memoria.
async function resolveSqlClient(): Promise<SqlModule> {
  if (env.sql.driver === 'msnodesqlv8') {
    const module = await import('mssql/msnodesqlv8.js')
    return module.default as unknown as SqlModule
  }

  return tediousSql
}

export const sql: SqlModule = await resolveSqlClient()
