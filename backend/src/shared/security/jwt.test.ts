import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signJwt, verifyJwt } from './jwt.js'

const secret = 'unit-test-secret-256'

test('signJwt/verifyJwt roundtrip preserves claims', () => {
  const token = signJwt({ sub: 'user-1', role: 'ADMIN' }, { expiresInSeconds: 60, secret })
  const payload = verifyJwt(token, { secret })

  assert.equal(payload.sub, 'user-1')
  assert.equal(payload.role, 'ADMIN')
  assert.ok(payload.exp && payload.iat && payload.exp > payload.iat)
})

test('verifyJwt rejects an expired token', () => {
  const token = signJwt({ sub: 'user-1' }, { expiresInSeconds: -10, secret })
  assert.throws(() => verifyJwt(token, { secret }), /Sesion expirada/)
})

test('verifyJwt rejects a tampered signature', () => {
  const token = signJwt({ sub: 'user-1' }, { expiresInSeconds: 60, secret })
  const tampered = `${token.slice(0, -2)}xy`
  assert.throws(() => verifyJwt(tampered, { secret }), /Token invalido/)
})

test('verifyJwt rejects a token signed with another secret', () => {
  const token = signJwt({ sub: 'user-1' }, { expiresInSeconds: 60, secret })
  assert.throws(() => verifyJwt(token, { secret: 'a-different-secret-256' }), /Token invalido/)
})

test('signJwt requires a secret of at least 16 characters', () => {
  assert.throws(() => signJwt({ sub: 'user-1' }, { expiresInSeconds: 60, secret: 'short' }), /al menos 16/)
})
