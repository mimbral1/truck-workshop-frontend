import { Router } from 'express'
import { createSupplier, deleteSupplier, updateSupplier } from './supplier.controller.js'

export const supplierRouter = Router()

supplierRouter.post('/', createSupplier)
supplierRouter.patch('/:id', updateSupplier)
supplierRouter.delete('/:id', deleteSupplier)
