import { Router } from 'express'
import { createPart, deletePart, updatePart } from './part.controller.js'

export const partRouter = Router()

partRouter.post('/', createPart)
partRouter.patch('/:id', updatePart)
partRouter.delete('/:id', deletePart)
