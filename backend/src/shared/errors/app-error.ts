/** Error de negocio con codigo HTTP y detalle estructurado opcional. */
export class AppError extends Error {
  readonly statusCode: number
  readonly details: unknown

  constructor(message: string, statusCode = 500, details: unknown = undefined) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.details = details
  }
}
