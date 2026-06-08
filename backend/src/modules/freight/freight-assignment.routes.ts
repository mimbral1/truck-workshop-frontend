import { Router } from 'express'
import {
  createFreightAssignment,
  deleteFreightAssignment,
  updateFreightAssignment,
} from './freight-assignment.controller.js'

export const freightAssignmentRouter = Router()

freightAssignmentRouter.post('/', createFreightAssignment)
freightAssignmentRouter.patch('/:id', updateFreightAssignment)
freightAssignmentRouter.delete('/:id', deleteFreightAssignment)
