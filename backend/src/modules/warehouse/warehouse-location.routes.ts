import { Router } from 'express'
import {
  createWarehouseLocation,
  deleteWarehouseLocation,
  updateWarehouseLocation,
} from './warehouse-location.controller.js'

export const warehouseLocationRouter = Router()

warehouseLocationRouter.post('/', createWarehouseLocation)
warehouseLocationRouter.patch('/:id', updateWarehouseLocation)
warehouseLocationRouter.delete('/:id', deleteWarehouseLocation)
