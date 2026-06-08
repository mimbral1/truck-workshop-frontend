import { Router } from 'express'
import {
  getFinanceReport,
  getFleetReport,
  getDriverPerformanceReport,
  getDriverTripSheetsReport,
  getDocumentExpirationsReport,
  getInventoryReport,
  getReportsOverview,
  getTireReport,
  getWorkshopReport,
} from './reports.controller.js'

export const reportsRouter = Router()

reportsRouter.get('/', getReportsOverview)
reportsRouter.get('/summary', getReportsOverview)
reportsRouter.get('/workshop', getWorkshopReport)
reportsRouter.get('/fleet', getFleetReport)
reportsRouter.get('/finance', getFinanceReport)
reportsRouter.get('/driver-performance', getDriverPerformanceReport)
reportsRouter.get('/driver-trip-sheets', getDriverTripSheetsReport)
reportsRouter.get('/document-expirations', getDocumentExpirationsReport)
reportsRouter.get('/inventory', getInventoryReport)
reportsRouter.get('/tires', getTireReport)
