import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hashPassword, isPasswordHash, verifyPassword } from './password.js'

test('hashPassword produces a verifiable pbkdf2 hash', () => {
  const hash = hashPassword('truckworkshop')

  assert.ok(isPasswordHash(hash))
  assert.ok(hash.startsWith('pbkdf2-sha256$'))
  assert.equal(verifyPassword('truckworkshop', hash), true)
})

test('verifyPassword rejects an incorrect password', () => {
  const hash = hashPassword('truckworkshop')
  assert.equal(verifyPassword('wrong-password', hash), false)
})

test('hashPassword uses a random salt (distinct hashes for same input)', () => {
  assert.notEqual(hashPassword('same'), hashPassword('same'))
})

test('isPasswordHash and verifyPassword reject malformed hashes', () => {
  assert.equal(isPasswordHash('not-a-hash'), false)
  assert.equal(verifyPassword('x', 'not-a-hash'), false)
  assert.equal(verifyPassword('x', undefined), false)
})
