import { env } from '../../config/env.js'
import { MemoryResourceRepository } from './memory-resource-repository.js'
import { ResourceRepository } from './resource-repository.js'
import type { ResourceDefinition, ResourceRepositoryContract } from '../types/domain.js'

export function createRepository(resource: ResourceDefinition): ResourceRepositoryContract {
  return env.dataDriver === 'memory'
    ? new MemoryResourceRepository(resource)
    : new ResourceRepository(resource)
}
