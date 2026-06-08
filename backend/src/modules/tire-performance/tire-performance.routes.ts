import { Router } from 'express'
import {
  createTireLifecycle,
  deleteTireLifecycle,
  installTireLifecycle,
  intakeTireLifecycles,
  removeTireLifecycle,
  updateTireLifecycle,
} from './tire-performance.controller.js'

export const tirePerformanceRouter = Router()

tirePerformanceRouter.post('/tires', createTireLifecycle)
tirePerformanceRouter.post('/tires/intake', intakeTireLifecycles)
tirePerformanceRouter.post('/tires/:id/install', installTireLifecycle)
tirePerformanceRouter.post('/tires/:id/remove', removeTireLifecycle)
tirePerformanceRouter.patch('/tires/:id', updateTireLifecycle)
tirePerformanceRouter.delete('/tires/:id', deleteTireLifecycle)
