import { Router } from 'express'
import {
  createDiagnostic,
  deleteDiagnostic,
  updateDiagnostic,
} from './diagnostic.controller.js'

export const diagnosticRouter = Router()

diagnosticRouter.post('/', createDiagnostic)
diagnosticRouter.patch('/:id', updateDiagnostic)
diagnosticRouter.delete('/:id', deleteDiagnostic)
