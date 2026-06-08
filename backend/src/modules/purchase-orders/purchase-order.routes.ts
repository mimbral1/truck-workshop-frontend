import { Router } from 'express'
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  updatePurchaseOrder,
} from './purchase-order.controller.js'

export const purchaseOrderRouter = Router()

purchaseOrderRouter.post('/', createPurchaseOrder)
purchaseOrderRouter.patch('/:id', updatePurchaseOrder)
purchaseOrderRouter.delete('/:id', deletePurchaseOrder)
