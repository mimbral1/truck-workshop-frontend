import { Router } from 'express'
import { createAssignment, listAssignments } from './assignment.controller.js'

export const assignmentRouter = Router()

assignmentRouter.get('/', listAssignments)
assignmentRouter.post('/', createAssignment)
