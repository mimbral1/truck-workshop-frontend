import { createApp } from './app.js'
import { env } from './config/env.js'
import { closePool } from './db/pool.js'
import { startFuelPriceScheduler } from './modules/fuel-prices/fuel-price.scheduler.js'

const app = createApp()
const stopFuelPriceScheduler = startFuelPriceScheduler()
let isShuttingDown = false

const server = app.listen(env.port, () => {
  console.log(`Truck Workshop API listening on http://localhost:${env.port}${env.apiPrefix}`)
})

async function shutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    return
  }

  isShuttingDown = true
  console.log(`${signal} received. Closing HTTP server and SQL pool.`)
  stopFuelPriceScheduler()

  try {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
    await closePool()
    process.exit(0)
  } catch (error) {
    console.error(error)
    process.exit(1)
  }
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
