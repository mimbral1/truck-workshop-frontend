import { Router } from 'express'
import { createTruckDocument, deleteTruckDocument, updateTruckDocument } from './truck-document.controller.js'

export const truckDocumentRouter = Router()

truckDocumentRouter.post('/', createTruckDocument)
truckDocumentRouter.patch('/:id', updateTruckDocument)
truckDocumentRouter.delete('/:id', deleteTruckDocument)
