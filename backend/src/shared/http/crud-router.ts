import { Router } from 'express'
import { createRepository } from '../data/repository-factory.js'
import { ResourceService } from '../data/resource-service.js'
import { createCrudController } from './crud-controller.js'
import type { ResourceDefinition } from '../types/domain.js'

export function createCrudRouter(resource: ResourceDefinition): Router {
  const router = Router()
  const repository = createRepository(resource)
  const service = new ResourceService(repository)
  const controller = createCrudController(service)

  router.get('/', controller.list)
  router.get('/:id', controller.get)
  router.post('/', controller.create)
  router.patch('/:id', controller.update)
  router.delete('/:id', controller.remove)

  return router
}
