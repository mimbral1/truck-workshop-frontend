import { env } from '../../config/env.js'
import { fuelPriceService } from './fuel-price.service.js'

export function startFuelPriceScheduler(): () => void {
  if (env.nodeEnv === 'test') {
    return () => {}
  }

  const intervalMs = env.cne.syncIntervalMinutes * 60_000

  const run = (): void => {
    fuelPriceService.syncIfDue()
      .then((result) => {
        if (!result?.skipped) {
          console.log(`CNE fuel prices synced: ${result.total} records.`)
        }
      })
      .catch((error: unknown) => {
        console.warn(`CNE fuel price sync skipped: ${(error as Error).message}`)
      })
  }

  run()
  const handle: NodeJS.Timeout = setInterval(run, intervalMs)

  return () => clearInterval(handle)
}
