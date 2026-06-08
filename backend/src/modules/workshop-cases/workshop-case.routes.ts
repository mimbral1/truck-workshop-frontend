import { Router } from 'express'
import {
  assignWorkshopCase,
  closeWorkshopCase,
  createWorkshopCase,
  deleteWorkshopCase,
  escalateWorkshopCase,
  getWorkshopCase,
  listEscalations,
  listWorkshopCases,
  updateWorkshopCase,
} from './workshop-case.controller.js'

export const workshopCaseRouter = Router()

workshopCaseRouter.get('/', listWorkshopCases)
workshopCaseRouter.post('/', createWorkshopCase)
workshopCaseRouter.get('/:id', getWorkshopCase)
workshopCaseRouter.patch('/:id', updateWorkshopCase)
workshopCaseRouter.delete('/:id', deleteWorkshopCase)
workshopCaseRouter.get('/:id/escalations', listEscalations)
workshopCaseRouter.post('/:id/escalations', escalateWorkshopCase)
workshopCaseRouter.post('/:id/assignments', assignWorkshopCase)
workshopCaseRouter.post('/:id/close', closeWorkshopCase)
