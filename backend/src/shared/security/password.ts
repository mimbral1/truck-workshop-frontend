import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto'

const ALGORITHM = 'pbkdf2-sha256'
const DIGEST = 'sha256'
const KEY_LENGTH = 32
const DEFAULT_ITERATIONS = 210000
const MIN_ITERATIONS = 100000

interface HashOptions {
  salt?: string
  iterations?: number
}

export function hashPassword(password: string, options: HashOptions = {}): string {
  const normalizedPassword = String(password || '')
  const iterations = Math.max(Number(options.iterations || DEFAULT_ITERATIONS), MIN_ITERATIONS)
  const salt = options.salt || randomBytes(16).toString('base64url')
  const hash = pbkdf2Sync(normalizedPassword, salt, iterations, KEY_LENGTH, DIGEST).toString('base64url')

  return `${ALGORITHM}$${iterations}$${salt}$${hash}`
}

export function verifyPassword(password: string, storedHash: unknown): boolean {
  if (!isPasswordHash(storedHash)) {
    return false
  }

  const [, iterationsValue, salt, expectedHash] = storedHash.split('$')
  const iterations = Number(iterationsValue)

  if (!Number.isInteger(iterations) || iterations < MIN_ITERATIONS) {
    return false
  }

  const actualHash = pbkdf2Sync(String(password || ''), salt, iterations, KEY_LENGTH, DIGEST).toString('base64url')
  const actual = Buffer.from(actualHash)
  const expected = Buffer.from(expectedHash)

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function isPasswordHash(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(`${ALGORITHM}$`) && value.split('$').length === 4
}
