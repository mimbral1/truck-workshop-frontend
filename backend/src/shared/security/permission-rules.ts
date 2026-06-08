import type { AuthenticatedUser } from '../types/domain.js'

interface PermissionRule {
  prefix: string
  read?: string | null
  write?: string | null
  create?: string | null
}

const readMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

const rules: PermissionRule[] = [
  { prefix: '/permissions', write: 'permissions.manage', read: 'permissions.manage' },
  { prefix: '/reports', write: 'reports.view', read: 'reports.view' },
  { prefix: '/dashboard', read: null },

  { prefix: '/cases', read: 'cases.view', create: 'cases.create', write: 'cases.close' },
  { prefix: '/workshop-cases', read: 'cases.view', create: 'cases.create', write: 'cases.close' },
  { prefix: '/diagnostics', read: 'cases.view', write: 'cases.diagnose' },
  { prefix: '/diagnostic-checklists', read: 'cases.view', write: 'cases.diagnose' },
  { prefix: '/checklists', read: 'cases.view', write: 'cases.diagnose' },
  { prefix: '/assignments', read: 'cases.view', write: 'cases.assign' },
  { prefix: '/approvals', read: 'cases.view', write: 'cases.escalate' },
  { prefix: '/labor', read: 'cases.view', write: 'cases.diagnose' },
  { prefix: '/schedule', read: 'cases.view', write: 'cases.assign' },

  { prefix: '/drivers', read: 'drivers.manage', write: 'drivers.manage' },
  { prefix: '/mechanics', read: 'cases.assign', write: 'cases.assign' },

  { prefix: '/warehouse', read: 'warehouse.manage', write: 'warehouse.manage' },
  { prefix: '/parts', read: 'warehouse.manage', write: 'warehouse.manage' },
  { prefix: '/purchase-orders', read: 'purchaseOrders.create', write: 'purchaseOrders.create' },
  { prefix: '/purchase-requests', read: 'purchaseOrders.create', write: 'purchaseOrders.create' },
  { prefix: '/suppliers', read: 'purchaseOrders.create', write: 'purchaseOrders.create' },

  { prefix: '/freight/requests', read: 'freight.requests.view', create: 'freight.requests.create', write: 'freight.requests.create' },
  { prefix: '/freight/quotes', read: 'freight.requests.view', create: 'freight.quotes.create', write: 'freight.quotes.send' },
  { prefix: '/freight/pricing', read: 'freight.quotes.create', write: 'freight.quotes.create' },
  { prefix: '/freight/assignments', read: 'freight.assignments.view', write: 'freight.assign' },

  { prefix: '/fleet/health-score', read: 'fleet.view', write: 'fleet.maintenance' },
  { prefix: '/fleet/health-scores', read: 'fleet.view', write: 'fleet.maintenance' },
  { prefix: '/fleet/trucks', read: 'fleet.view', write: 'fleet.manage' },
  { prefix: '/fleet', read: 'fleet.view', write: 'fleet.manage' },
  { prefix: '/trucks', read: 'fleet.view', write: 'fleet.manage' },
  { prefix: '/preventive-maintenance', read: 'fleet.maintenance', write: 'fleet.maintenance' },
  { prefix: '/truck-documents', read: 'fleet.documents', write: 'fleet.documents' },
  { prefix: '/fuel', read: 'fleet.fuel', write: 'fleet.fuel' },
  { prefix: '/truck-costs', read: 'fleet.costs', write: 'fleet.costs' },
  { prefix: '/incidents', read: 'fleet.incidents', write: 'fleet.incidents' },
  { prefix: '/telematics', read: 'fleet.telematics', write: 'fleet.telematics' },
  { prefix: '/tire-performance', read: 'fleet.maintenance', write: 'fleet.maintenance' },

  { prefix: '/communications', read: 'cases.view', write: 'cases.view' },
  { prefix: '/customers', read: 'freight.requests.view', write: 'freight.requests.create' },
  { prefix: '/maps', read: null, write: null },
  { prefix: '/notifications', read: null, write: null },
  { prefix: '/settings', read: null, write: null },
]

export function requiredPermissionForRequest(method: string, path: string): string | null {
  const normalizedPath = normalizePath(path)
  const actionPermission = workshopCaseActionPermission(method, normalizedPath)

  if (actionPermission) {
    return actionPermission
  }

  const rule = rules.find((item) => normalizedPath === item.prefix || normalizedPath.startsWith(`${item.prefix}/`))

  if (!rule) {
    return null
  }

  if (readMethods.has(String(method || '').toUpperCase())) {
    return rule.read ?? null
  }

  if (String(method || '').toUpperCase() === 'POST') {
    return rule.create ?? rule.write ?? null
  }

  return rule.write ?? null
}

function workshopCaseActionPermission(method: string, path: string): string | null {
  const normalizedMethod = String(method || '').toUpperCase()

  if (!['POST', 'PATCH', 'DELETE'].includes(normalizedMethod)) {
    return null
  }

  if (!/^\/(cases|workshop-cases)\//.test(path)) {
    return null
  }

  if (/\/assignments(?:\/|$)/.test(path)) {
    return 'cases.assign'
  }

  if (/\/escalations(?:\/|$)/.test(path)) {
    return 'cases.escalate'
  }

  if (/\/close(?:\/|$)/.test(path)) {
    return 'cases.close'
  }

  return null
}

export function hasPermission(user: AuthenticatedUser | undefined, permission: string | null): boolean {
  if (!permission) {
    return true
  }

  if (!user) {
    return false
  }

  if (user.role === 'ADMIN') {
    return true
  }

  const permissions = Array.isArray(user.permissions) ? user.permissions : []

  return permissions.includes('*') || permissions.includes(permission)
}

function normalizePath(path: string): string {
  const value = String(path || '').trim()

  if (!value || value === '/') {
    return '/'
  }

  return value.startsWith('/') ? value : `/${value}`
}
