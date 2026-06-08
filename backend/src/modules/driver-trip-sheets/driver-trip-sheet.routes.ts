import { Router } from 'express'
import { driverTripSheetController } from './driver-trip-sheet.controller.js'

export const driverTripSheetRouter = Router()

driverTripSheetRouter.get('/', driverTripSheetController.list)
driverTripSheetRouter.post('/preview', driverTripSheetController.preview)
driverTripSheetRouter.get('/:id', driverTripSheetController.get)
driverTripSheetRouter.post('/', driverTripSheetController.create)
driverTripSheetRouter.patch('/:id', driverTripSheetController.update)
driverTripSheetRouter.delete('/:id', driverTripSheetController.remove)
