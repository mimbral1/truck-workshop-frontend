import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse } from '../../shared/http/send-response.js'
import { MapsService } from './maps.service.js'

const service = new MapsService()

export const mapsController = {
  autocomplete: asyncHandler(async (request, response) => {
    const suggestions = await service.autocomplete(request.query.query || request.query.q, request.query.sessionToken)

    sendResponse(response, { data: suggestions })
  }),

  placeDetails: asyncHandler(async (request, response) => {
    const place = await service.placeDetails(request.params.placeId)

    sendResponse(response, { data: place })
  }),

  route: asyncHandler(async (request, response) => {
    const route = await service.route(request.body)

    sendResponse(response, { data: route })
  }),

  staticRoute: asyncHandler(async (request, response) => {
    const map = await service.staticRoute(request.query as Record<string, unknown>)

    response.type(map.contentType).send(map.buffer)
  }),
}
