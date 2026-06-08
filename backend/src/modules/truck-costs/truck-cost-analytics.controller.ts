import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse } from '../../shared/http/send-response.js'
import { TruckCostAnalyticsService } from './truck-cost-analytics.service.js'

const service = new TruckCostAnalyticsService()

export const truckCostAnalyticsController = {
  analytics: asyncHandler(async (request, response) => {
    const analytics = await service.getAnalytics(request.query as Record<string, unknown>)

    sendResponse(response, { data: analytics })
  }),
}
