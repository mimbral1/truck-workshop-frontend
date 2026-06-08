import { Router } from 'express'
import { fleetHealthScoreController } from './fleet-health-score.controller.js'

export const fleetHealthScoreRouter = Router()

fleetHealthScoreRouter.get('/overview', fleetHealthScoreController.overview)
fleetHealthScoreRouter.post('/recalculate', fleetHealthScoreController.recalculate)
