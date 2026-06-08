import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse } from '../../shared/http/send-response.js'
import { FleetHealthScoreService } from './fleet-health-score.service.js'

const service = new FleetHealthScoreService()

export const fleetHealthScoreController = {
  overview: asyncHandler(async (_request, response) => {
    const overview = await service.getOverview()

    sendResponse(response, { data: overview })
  }),
  recalculate: asyncHandler(async (request, response) => {
    const body = (request.body ?? {}) as Record<string, unknown>
    const actorName = (body.updatedBy as string | undefined) || (body.actorName as string | undefined) || 'Sistema'
    const overview = await service.recalculate(actorName)

    sendResponse(response, { data: overview })
  }),
}
