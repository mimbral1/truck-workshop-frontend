import { Router } from 'express'
import { truckCostAnalyticsController } from './truck-cost-analytics.controller.js'

export const truckCostAnalyticsRouter = Router()

truckCostAnalyticsRouter.get('/analytics', truckCostAnalyticsController.analytics)
