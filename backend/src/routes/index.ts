import { Router, type Express, type Request, type Response } from 'express'
import { allCrudResources, assignmentResource, workshopCaseResource } from '../config/resources.js'
import { authRouter } from '../modules/auth/auth.routes.js'
import { approvalRouter } from '../modules/approvals/approval.routes.js'
import { assignmentRouter } from '../modules/assignments/assignment.routes.js'
import { communicationIntegrationRouter } from '../modules/communications/communication-integration.routes.js'
import { dashboardRouter } from '../modules/dashboard/dashboard.routes.js'
import { customerRouter } from '../modules/customers/customer.routes.js'
import { diagnosticRouter } from '../modules/diagnostics/diagnostic.routes.js'
import { driverTripSheetRouter } from '../modules/driver-trip-sheets/driver-trip-sheet.routes.js'
import { fleetHealthScoreRouter } from '../modules/fleet/fleet-health-score.routes.js'
import { fuelPriceRouter } from '../modules/fuel-prices/fuel-price.routes.js'
import { freightAssignmentRouter } from '../modules/freight/freight-assignment.routes.js'
import { freightPricingRouter } from '../modules/freight/freight-pricing.routes.js'
import { mapsRouter } from '../modules/maps/maps.routes.js'
import { mechanicRouter } from '../modules/mechanics/mechanic.routes.js'
import { partRouter } from '../modules/parts/part.routes.js'
import { permissionsRoleRouter, permissionsUserRoleRouter } from '../modules/permissions/permissions.routes.js'
import { purchaseOrderRouter } from '../modules/purchase-orders/purchase-order.routes.js'
import { quoteRouter } from '../modules/quotes/quote.routes.js'
import { reportsRouter } from '../modules/reports/reports.routes.js'
import { scheduleRouter } from '../modules/schedule/schedule.routes.js'
import { supplierRouter } from '../modules/suppliers/supplier.routes.js'
import { tirePerformanceRouter } from '../modules/tire-performance/tire-performance.routes.js'
import { truckCostAnalyticsRouter } from '../modules/truck-costs/truck-cost-analytics.routes.js'
import { truckDocumentRouter } from '../modules/truck-documents/truck-document.routes.js'
import { warehouseLocationRouter } from '../modules/warehouse/warehouse-location.routes.js'
import { workshopCaseRouter } from '../modules/workshop-cases/workshop-case.routes.js'
import { createCrudRouter } from '../shared/http/crud-router.js'
import { env } from '../config/env.js'
import { authenticateRequest, authorizeRequest } from '../shared/middleware/authentication.js'
import { sendResponse } from '../shared/http/send-response.js'
import type { ResourceDefinition } from '../shared/types/domain.js'

const resourceRouteAliases: Record<string, string[]> = {
  'diagnostic-checklists': ['/checklists'],
  'fuel-records': ['/fuel'],
  'labor-tasks': ['/labor'],
  roles: ['/permissions'],
  'preventive-maintenance-plans': ['/preventive-maintenance'],
  'sla-configs': ['/sla'],
  'tire-lifecycles': ['/tire-performance'],
  'truck-health-scores': ['/fleet/health-score'],
}

export function registerRoutes(app: Express): void {
  const api = Router()

  api.get('/health', (_request: Request, response: Response) => {
    sendResponse(response, { data: { service: 'truck-workshop-api', status: 'ok' } })
  })

  api.use('/auth', authRouter)
  api.use(authenticateRequest)
  api.use(authorizeRequest)
  api.use('/approvals', approvalRouter)
  api.use('/communications', communicationIntegrationRouter)
  api.use('/customers', customerRouter)
  api.use('/dashboard', dashboardRouter)
  api.use('/diagnostics', diagnosticRouter)
  api.use('/driver-trip-sheets', driverTripSheetRouter)
  api.use('/fleet/health-scores', fleetHealthScoreRouter)
  api.use('/fuel/prices', fuelPriceRouter)
  api.use('/freight/assignments', freightAssignmentRouter)
  api.use('/freight/pricing', freightPricingRouter)
  api.use('/maps', mapsRouter)
  api.use('/mechanics', mechanicRouter)
  api.use('/parts', partRouter)
  api.use('/permissions/roles', permissionsRoleRouter)
  api.use('/permissions/user-roles', permissionsUserRoleRouter)
  api.use('/purchase-orders', purchaseOrderRouter)
  api.use('/quotes', quoteRouter)
  api.use('/reports', reportsRouter)
  api.use('/schedule', scheduleRouter)
  api.use('/suppliers', supplierRouter)
  api.use('/tire-performance', tirePerformanceRouter)
  api.use('/truck-costs', truckCostAnalyticsRouter)
  api.use('/truck-documents', truckDocumentRouter)
  api.use('/warehouse/locations', warehouseLocationRouter)
  api.use('/workshop-cases', workshopCaseRouter)
  api.use('/cases', workshopCaseRouter)
  api.use('/assignments', assignmentRouter)

  mountCrudResources(api)

  app.use(env.apiPrefix, api)
}

interface ResourceRouter {
  resource: ResourceDefinition
  router: Router
}

function mountCrudResources(api: Router): void {
  const resourceRouters: ResourceRouter[] = allCrudResources
    .filter((resource) => resource.name !== workshopCaseResource.name && resource.name !== assignmentResource.name)
    .map((resource) => ({
      resource,
      router: createCrudRouter(resource),
    }))
  const canonicalResourceRouters = [...resourceRouters].sort(
    (first, second) => routeSpecificity(second.resource.route) - routeSpecificity(first.resource.route),
  )
  const aliasResourceRouters = resourceRouters
    .flatMap(({ resource, router }) =>
      (resourceRouteAliases[resource.name] || []).map((alias) => ({
        alias,
        router,
      })),
    )
    .sort((first, second) => routeSpecificity(second.alias) - routeSpecificity(first.alias))

  canonicalResourceRouters.forEach(({ resource, router }) => {
    api.use(resource.route, router)
  })

  aliasResourceRouters.forEach(({ alias, router }) => {
    api.use(alias, router)
  })
}

function routeSpecificity(route: string): number {
  return route.split('/').filter(Boolean).length
}
