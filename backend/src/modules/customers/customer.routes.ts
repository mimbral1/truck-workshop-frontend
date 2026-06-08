import { Router } from 'express'
import { customerController } from './customer.controller.js'

export const customerRouter = Router()

customerRouter.get('/', customerController.list)
customerRouter.get('/:id/credit', customerController.getCreditSummary)
customerRouter.get('/:id', customerController.get)
customerRouter.post('/', customerController.create)
customerRouter.patch('/:id', customerController.update)
customerRouter.delete('/:id', customerController.remove)
