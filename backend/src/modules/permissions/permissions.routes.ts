import { Router } from 'express'
import { roleController, userRoleController } from './permissions.controller.js'

export const permissionsRoleRouter = Router()
export const permissionsUserRoleRouter = Router()

permissionsRoleRouter.get('/', roleController.list)
permissionsRoleRouter.get('/:id', roleController.get)
permissionsRoleRouter.post('/', roleController.create)
permissionsRoleRouter.patch('/:id', roleController.update)
permissionsRoleRouter.delete('/:id', roleController.remove)

permissionsUserRoleRouter.get('/', userRoleController.list)
permissionsUserRoleRouter.get('/:id', userRoleController.get)
permissionsUserRoleRouter.post('/', userRoleController.create)
permissionsUserRoleRouter.patch('/:id', userRoleController.update)
permissionsUserRoleRouter.delete('/:id', userRoleController.remove)
