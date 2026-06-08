import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  buildPaginationMeta,
  compareValues,
  parsePaginationOptions,
  parseSortOrder,
} from './query-options.js'

test('parsePaginationOptions applies defaults', () => {
  assert.deepEqual(parsePaginationOptions({}), { page: 1, limit: DEFAULT_PAGE_SIZE, offset: 0 })
})

test('parsePaginationOptions computes offset from page and limit', () => {
  assert.deepEqual(parsePaginationOptions({ page: '3', limit: '10' }), { page: 3, limit: 10, offset: 20 })
})

test('parsePaginationOptions clamps limit and page to safe bounds', () => {
  assert.equal(parsePaginationOptions({ limit: '500' }).limit, MAX_PAGE_SIZE)
  assert.equal(parsePaginationOptions({ limit: '0' }).limit, 1)
  assert.equal(parsePaginationOptions({ page: '-5' }).page, 1)
})

test('parseSortOrder normalises to asc/desc', () => {
  assert.equal(parseSortOrder('asc'), 'asc')
  assert.equal(parseSortOrder('ASC'), 'asc')
  assert.equal(parseSortOrder('desc'), 'desc')
  assert.equal(parseSortOrder('whatever'), 'desc')
  assert.equal(parseSortOrder(undefined), 'desc')
})

test('buildPaginationMeta computes totalPages', () => {
  assert.deepEqual(buildPaginationMeta({ limit: 10, page: 1, total: 25 }), {
    limit: 10,
    page: 1,
    total: 25,
    totalPages: 3,
  })
})

test('compareValues orders values with null/undefined last', () => {
  assert.equal(compareValues(1, 2) < 0, true)
  assert.equal(compareValues(2, 1) > 0, true)
  assert.equal(compareValues(1, 1), 0)
  assert.equal(compareValues(null, 1), 1)
  assert.equal(compareValues(1, null), -1)
})
