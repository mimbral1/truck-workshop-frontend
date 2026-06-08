import { Router } from 'express'
import { createQuote, deleteQuote, updateQuote } from './quote.controller.js'

export const quoteRouter = Router()

quoteRouter.post('/', createQuote)
quoteRouter.patch('/:id', updateQuote)
quoteRouter.delete('/:id', deleteQuote)
