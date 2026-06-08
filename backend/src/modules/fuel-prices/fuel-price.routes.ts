import { Router } from 'express'
import { fuelPriceController } from './fuel-price.controller.js'

export const fuelPriceRouter = Router()

fuelPriceRouter.get('/current', fuelPriceController.current)
fuelPriceRouter.get('/history', fuelPriceController.history)
fuelPriceRouter.post('/sync', fuelPriceController.sync)
