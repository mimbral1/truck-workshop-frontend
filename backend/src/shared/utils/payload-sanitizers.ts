import type { PlainRecord } from '../types/domain.js'

const DEFAULT_IMMUTABLE_FIELDS = ['createdAt', 'createdBy', 'id']

export function stripImmutableFields(payload: PlainRecord | null | undefined, extraFields: string[] = []): PlainRecord {
  const sanitizedPayload: PlainRecord = { ...(payload || {}) }

  for (const field of [...DEFAULT_IMMUTABLE_FIELDS, ...extraFields]) {
    delete sanitizedPayload[field]
  }

  return sanitizedPayload
}
