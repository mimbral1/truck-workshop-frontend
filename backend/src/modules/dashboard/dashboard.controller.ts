import { createRepository } from '../../shared/data/repository-factory.js'
import { asyncHandler } from '../../shared/http/async-handler.js'
import { sendResponse } from '../../shared/http/send-response.js'
import { assignmentResource, workshopCaseResource } from '../../config/resources.js'

const casesRepository = createRepository(workshopCaseResource)
const assignmentsRepository = createRepository(assignmentResource)

export const getDashboardSummary = asyncHandler(async (_request, response) => {
  const [totalCases, criticalCases, breachedCases, atRiskCases, openAssignments] = await Promise.all([
    casesRepository.countBy(),
    casesRepository.countBy({ priority: 'critical' }),
    casesRepository.countBy({ slaStatus: 'BREACHED' }),
    casesRepository.countBy({ slaStatus: 'AT_RISK' }),
    assignmentsRepository.countBy({ status: 'active' }),
  ])

  sendResponse(response, {
    data: {
      assignments: {
        active: openAssignments,
      },
      cases: {
        critical: criticalCases,
        slaAtRisk: atRiskCases,
        slaBreached: breachedCases,
        total: totalCases,
      },
    },
  })
})
