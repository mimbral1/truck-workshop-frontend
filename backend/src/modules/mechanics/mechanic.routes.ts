import { Router } from 'express'
import { mechanicController } from './mechanic.controller.js'

export const mechanicRouter = Router()

mechanicRouter.get('/', mechanicController.list)
mechanicRouter.get('/:id', mechanicController.get)
mechanicRouter.post('/', mechanicController.create)
mechanicRouter.patch('/:id', mechanicController.update)
mechanicRouter.delete('/:id', mechanicController.remove)
