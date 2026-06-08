import { Router } from 'express'
import { planScheduleEvent } from './schedule.controller.js'

export const scheduleRouter = Router()

scheduleRouter.post('/events', planScheduleEvent)
