/**
 * Tipos de dominio compartidos por toda la capa de datos generica y los modulos.
 * Reflejan los contratos que ya existian en JavaScript, ahora explicitos.
 */

/** Diccionario plano de valores arbitrarios provenientes de la base o del cliente. */
export type PlainRecord = Record<string, unknown>

/** Definicion declarativa de un recurso CRUD (fuente: `config/resources.js`). */
export interface ResourceDefinition {
  /** Nombre logico usado por scripts, repositorios y logs. */
  name: string
  /** Ruta relativa montada bajo el prefijo de la API. */
  route: string
  /** Tabla SQL Server asociada. */
  table: string
  /** Campos publicos camelCase aceptados por la API. */
  fields: string[]
  /** Campos serializados/deserializados como JSON. */
  jsonFields?: string[]
  /** Campos usados por la busqueda textual (`search`/`query`). */
  searchableFields?: string[]
  /** Campos que aceptan filtros directos por query string. */
  filterFields?: string[]
  /** Campos permitidos para ordenar listados. */
  sortFields?: string[]
  /** Campo de orden por defecto. */
  defaultSort?: string
  /** Mapeo explicito campo camelCase -> columna SQL. */
  fieldMap?: Record<string, string>
}

/** Recurso normalizado con sus colecciones siempre definidas. */
export interface NormalizedResource extends ResourceDefinition {
  jsonFields: string[]
  searchableFields: string[]
  filterFields: string[]
  sortFields: string[]
  defaultSort: string
}

/** Opciones de consulta admitidas por los listados CRUD. */
export interface ListQuery {
  page?: string | number
  limit?: string | number
  sort?: string
  order?: string
  search?: string
  query?: string
  [filter: string]: string | number | undefined
}

/** Metadatos de paginacion devueltos en `meta`. */
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

/** Resultado paginado estandar de un listado. */
export interface PaginatedResult<T = PlainRecord> {
  data: T[]
  meta: PaginationMeta
}

/** Contrato de repositorio (SQL Server o memoria) sobre un recurso. */
export interface ResourceRepositoryContract<T extends PlainRecord = PlainRecord> {
  resource: NormalizedResource
  fields: string[]
  findAll(query?: ListQuery): Promise<PaginatedResult<T>>
  findById(id: string): Promise<T | null>
  create(payload: PlainRecord): Promise<T | null>
  update(id: string, payload: PlainRecord): Promise<T | null>
  remove(id: string): Promise<T>
  upsertMany(records: PlainRecord[]): Promise<Array<T | null>>
  countBy(filters?: Record<string, unknown>): Promise<number>
}

/** Usuario autenticado derivado del JWT y expuesto en `request.user`. */
export interface AuthenticatedUser {
  id?: string
  name?: string
  email?: string
  role?: string
  roleName?: string
  permissions: string[]
}

/** Carga util (claims) de un JWT emitido por el backend. */
export interface JwtPayload {
  sub?: string
  email?: string
  name?: string
  role?: string
  roleName?: string
  permissions?: string[]
  exp?: number
  iat?: number
  jti?: string
  [claim: string]: unknown
}
