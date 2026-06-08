import { Router } from 'express'
import { freightPricingController } from './freight-pricing.controller.js'

export const freightPricingRouter = Router()

freightPricingRouter.get('/settings/active', freightPricingController.activeSettings)
freightPricingRouter.patch('/settings/active', freightPricingController.updateActiveSettings)
freightPricingRouter.post('/calculate', freightPricingController.calculate)
