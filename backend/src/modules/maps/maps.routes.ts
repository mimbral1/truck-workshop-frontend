import { Router } from 'express'
import { mapsController } from './maps.controller.js'

export const mapsRouter = Router()

mapsRouter.get('/places', mapsController.autocomplete)
mapsRouter.get('/places/:placeId', mapsController.placeDetails)
mapsRouter.post('/route', mapsController.route)
mapsRouter.get('/static-route', mapsController.staticRoute)
