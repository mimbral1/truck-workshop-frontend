import { createHmac, timingSafeEqual } from 'node:crypto'
import { AppError } from '../errors/app-error.js'
import type { JwtPayload } from '../types/domain.js'

const HEADER = { alg: 'HS256', typ: 'JWT' } as const

interface SignOptions {
  expiresInSeconds: number
  secret: string
}

interface VerifyOptions {
  secret: string
}

export function signJwt(payload: JwtPayload, { expiresInSeconds, secret }: SignOptions): string {
  assertSecret(secret)

  const now = Math.floor(Date.now() / 1000)
  const normalizedPayload: JwtPayload = {
    ...payload,
    exp: now + expiresInSeconds,
    iat: now,
  }
  const encodedHeader = base64UrlEncodeJson(HEADER)
  const encodedPayload = base64UrlEncodeJson(normalizedPayload)
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret)

  return `${encodedHeader}.${encodedPayload}.${signature}`
}

export function verifyJwt(token: string, { secret }: VerifyOptions): JwtPayload {
  assertSecret(secret)

  const parts = String(token || '').split('.')

  if (parts.length !== 3) {
    throw new AppError('Token invalido', 401)
  }

  const [encodedHeader, encodedPayload, signature] = parts
  const expectedSignature = sign(`${encodedHeader}.${encodedPayload}`, secret)

  if (!safeEquals(signature, expectedSignature)) {
    throw new AppError('Token invalido', 401)
  }

  const header = parseBase64UrlJson(encodedHeader)
  const payload = parseBase64UrlJson(encodedPayload)

  if (header.alg !== HEADER.alg || header.typ !== HEADER.typ) {
    throw new AppError('Token invalido', 401)
  }

  const now = Math.floor(Date.now() / 1000)

  if (Number(payload.exp || 0) <= now) {
    throw new AppError('Sesion expirada', 401)
  }

  return payload
}

function assertSecret(secret: string): void {
  if (!secret || String(secret).length < 16) {
    throw new AppError('JWT_SECRET debe tener al menos 16 caracteres', 500)
  }
}

function base64UrlEncodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function parseBase64UrlJson(value: string): JwtPayload {
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as JwtPayload
  } catch {
    throw new AppError('Token invalido', 401)
  }
}

function sign(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function safeEquals(first: string, second: string): boolean {
  const firstBuffer = Buffer.from(first)
  const secondBuffer = Buffer.from(second)

  return firstBuffer.length === secondBuffer.length && timingSafeEqual(firstBuffer, secondBuffer)
}
