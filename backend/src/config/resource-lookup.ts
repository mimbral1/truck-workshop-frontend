import { allCrudResources } from './resources.js'
import type { ResourceDefinition } from '../shared/types/domain.js'

export function resourceByName(name: string): ResourceDefinition {
  const resource = allCrudResources.find((item) => item.name === name)

  if (!resource) {
    throw new Error(`Resource ${name} no configurado`)
  }

  return resource
}
