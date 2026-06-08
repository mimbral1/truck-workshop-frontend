import { test } from 'node:test'
import assert from 'node:assert/strict'
import { hasPermission, requiredPermissionForRequest } from './permission-rules.js'

test('requiredPermissionForRequest maps read/create/write per prefix', () => {
  assert.equal(requiredPermissionForRequest('GET', '/cases'), 'cases.view')
  assert.equal(requiredPermissionForRequest('POST', '/cases'), 'cases.create')
  assert.equal(requiredPermissionForRequest('DELETE', '/cases/123'), 'cases.close')
  assert.equal(requiredPermissionForRequest('GET', '/reports/summary'), 'reports.view')
})

test('requiredPermissionForRequest resolves workshop-case sub-actions', () => {
  assert.equal(requiredPermissionForRequest('POST', '/workshop-cases/1/assignments'), 'cases.assign')
  assert.equal(requiredPermissionForRequest('POST', '/workshop-cases/1/escalations'), 'cases.escalate')
  assert.equal(requiredPermissionForRequest('POST', '/workshop-cases/1/close'), 'cases.close')
})

test('requiredPermissionForRequest returns null for open utility routes', () => {
  assert.equal(requiredPermissionForRequest('GET', '/maps/places'), null)
  assert.equal(requiredPermissionForRequest('GET', '/dashboard/summary'), null)
  assert.equal(requiredPermissionForRequest('GET', '/unknown-route'), null)
})

test('hasPermission honours ADMIN, wildcard and explicit grants', () => {
  assert.equal(hasPermission({ role: 'ADMIN', permissions: [] }, 'cases.view'), true)
  assert.equal(hasPermission({ permissions: ['*'] }, 'cases.view'), true)
  assert.equal(hasPermission({ permissions: ['cases.view'] }, 'cases.view'), true)
  assert.equal(hasPermission({ permissions: ['cases.view'] }, 'cases.close'), false)
  assert.equal(hasPermission(undefined, 'cases.view'), false)
  assert.equal(hasPermission(undefined, null), true)
})
