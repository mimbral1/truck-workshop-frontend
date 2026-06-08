import { Router } from 'express'
import { getDashboardSummary } from './dashboard.controller.js'

export const dashboardRouter = Router()

dashboardRouter.get('/summary', getDashboardSummary)
