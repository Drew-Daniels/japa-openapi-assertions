import { writeFileSync } from 'node:fs'
import chalk from 'chalk'
import type { CoverageEntry } from './types.js'

interface CoverageRecord {
  route: string
  method: string
  status: string
}

/**
 * Tracks API endpoint coverage during test runs.
 */
export class CoverageTracker {
  private allEndpoints: CoverageRecord[] = []
  private covered: Set<string> = new Set()
  private reportOnExit: boolean = false
  private exportOnExit: boolean = false
  private exitHandlerRegistered: boolean = false

  /**
   * Register all endpoints from the OpenAPI spec for coverage tracking.
   */
  registerEndpoints(entries: CoverageEntry[]): void {
    for (const entry of entries) {
      for (const status of entry.statuses) {
        this.allEndpoints.push({
          route: entry.route,
          method: entry.method,
          status,
        })
      }
    }
  }

  /**
   * Record that an endpoint was covered during testing.
   */
  recordCoverage(route: string, method: string, status: string): void {
    const key = this.makeKey(route, method, status)
    this.covered.add(key)
  }

  /**
   * Get list of uncovered endpoints.
   */
  getUncovered(): CoverageRecord[] {
    return this.allEndpoints.filter(
      (e) => !this.covered.has(this.makeKey(e.route, e.method, e.status)),
    )
  }

  /**
   * Get coverage statistics.
   */
  getStats(): { total: number; covered: number; percentage: number } {
    const total = this.allEndpoints.length
    const covered = this.covered.size
    const percentage = total > 0 ? Math.round((covered / total) * 100) : 100

    return { total, covered, percentage }
  }

  /**
   * Enable reporting on process exit.
   */
  enableReporting(report: boolean, exportFile: boolean): void {
    this.reportOnExit = report
    this.exportOnExit = exportFile

    if ((report || exportFile) && !this.exitHandlerRegistered) {
      this.registerExitHandler()
    }
  }

  /**
   * Print coverage report to console.
   */
  report(): void {
    const uncovered = this.getUncovered()
    const stats = this.getStats()

    console.log('')
    console.log(chalk.bold('API Coverage Report'))
    console.log(chalk.dim('─'.repeat(50)))

    if (uncovered.length === 0) {
      console.log(chalk.green('✓ All endpoints covered!'))
    } else {
      console.log(chalk.yellow(`Uncovered endpoints (${uncovered.length}):`))
      console.log('')

      // Group by route for cleaner output
      const byRoute = new Map<string, CoverageRecord[]>()
      for (const endpoint of uncovered) {
        const existing = byRoute.get(endpoint.route) || []
        existing.push(endpoint)
        byRoute.set(endpoint.route, existing)
      }

      for (const [route, endpoints] of byRoute) {
        console.log(chalk.dim(`  ${route}`))
        for (const ep of endpoints) {
          console.log(`    ${chalk.cyan(ep.method.padEnd(7))} ${chalk.dim(ep.status)}`)
        }
      }
    }

    console.log('')
    console.log(chalk.dim('─'.repeat(50)))
    console.log(
      `Coverage: ${stats.covered}/${stats.total} endpoints `
      + `(${chalk.bold(stats.percentage + '%')})`,
    )
    console.log('')
  }

  /**
   * Export coverage data to JSON file.
   */
  export(filePath: string = 'coverage.json'): void {
    const uncovered = this.getUncovered()
    const data = uncovered.map((e) => ({
      route: e.route,
      method: e.method,
      statuses: e.status,
    }))

    writeFileSync(filePath, JSON.stringify(data, null, 2))
    console.log(chalk.dim(`Coverage data exported to ${filePath}`))
  }

  private makeKey(route: string, method: string, status: string): string {
    return `${method.toUpperCase()}:${route}:${status}`
  }

  private registerExitHandler(): void {
    this.exitHandlerRegistered = true

    process.on('beforeExit', () => {
      if (this.reportOnExit) {
        this.report()
      }
      if (this.exportOnExit) {
        this.export()
      }
    })
  }
}

// Singleton instance for global coverage tracking
export const coverageTracker = new CoverageTracker()
