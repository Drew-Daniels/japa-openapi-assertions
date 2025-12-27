import { AssertionError } from 'node:assert'
import { fileURLToPath } from 'node:url'
import { buildValidatorsSync } from './schema_builder.js'
import { validateResponse, parseResponse } from './response_validator.js'
import { matchPath } from './path_matcher.js'
import { coverageTracker } from './coverage.js'
import type { CompiledValidators } from './types.js'

interface RegisterOptions {
  reportCoverage?: boolean
  exportCoverage?: boolean
}

/**
 * OpenAPI assertions for validating HTTP responses against OpenAPI specifications.
 *
 * This is a drop-in replacement for @japa/openapi-assertions with OpenAPI 3.1 support.
 */
export class OpenApiAssertions {
  /**
   * Compiled validators from registered specs.
   */
  private static validators: CompiledValidators | null = null

  /**
   * Flag indicating if specs have been registered.
   */
  private static hasRegistered: boolean = false

  /**
   * Coverage options.
   */
  private static coverageOptions: RegisterOptions = {}

  /**
   * Register OpenAPI specs to validate responses against.
   * This method is SYNCHRONOUS to match the original @japa/openapi-assertions API.
   *
   * @param schemaPathsOrURLs - Paths or URLs to OpenAPI spec files
   * @param options - Coverage reporting options
   */
  static registerSpecs(
    schemaPathsOrURLs: (string | URL)[],
    options: RegisterOptions = {},
  ): void {
    this.hasRegistered = true
    this.coverageOptions = options

    // Convert URLs to file paths
    const paths = schemaPathsOrURLs.map((p) =>
      p instanceof URL ? fileURLToPath(p) : p,
    )

    // Build validators synchronously
    const result = buildValidatorsSync(paths)
    this.validators = result.validators

    // Register coverage entries
    if (options.reportCoverage || options.exportCoverage) {
      coverageTracker.registerEndpoints(result.coverageEntries)
      coverageTracker.enableReporting(
        options.reportCoverage ?? false,
        options.exportCoverage ?? false,
      )
    }
  }

  /**
   * Reset the assertions state (useful for testing).
   */
  static reset(): void {
    this.validators = null
    this.hasRegistered = false
    this.coverageOptions = {}
  }

  /**
   * Get validators, throwing if not registered.
   */
  private static getValidators(): CompiledValidators {
    if (!this.validators) {
      throw new Error(
        'Cannot validate responses without defining API schemas. '
        + 'Please configure the plugin with schemas.',
      )
    }
    return this.validators
  }

  /**
   * Validate that a response matches the OpenAPI specification.
   * This method is SYNCHRONOUS to match the original @japa/openapi-assertions API.
   *
   * @param response - HTTP response object from axios, supertest, or Japa api-client
   * @throws AssertionError if the response does not match the spec
   */
  isValidResponse(response: unknown): void {
    if (!OpenApiAssertions.hasRegistered) {
      throw new Error(
        'Cannot validate responses without defining API schemas. '
        + 'Please configure the plugin with schemas.',
      )
    }

    const validators = OpenApiAssertions.getValidators()
    const result = validateResponse(response, validators)

    // Record coverage if enabled
    if (
      OpenApiAssertions.coverageOptions.reportCoverage
      || OpenApiAssertions.coverageOptions.exportCoverage
    ) {
      try {
        const parsed = parseResponse(response)
        const specPaths = Object.keys(validators)
        const pathMatch = matchPath(parsed.path, specPaths)

        if (pathMatch) {
          coverageTracker.recordCoverage(
            pathMatch.matched,
            parsed.method,
            String(parsed.status),
          )
        }
      } catch {
        // Ignore coverage tracking errors
      }
    }

    if (!result.valid) {
      const errorDetails = result.errors
        ?.map((e) => {
          let msg = e.path ? `${e.path}: ${e.message}` : e.message
          if (e.expected !== undefined) {
            msg += ` (expected: ${JSON.stringify(e.expected)})`
          }
          if (e.actual !== undefined) {
            msg += ` (actual: ${JSON.stringify(e.actual)})`
          }
          return msg
        })
        .join('\n  ')

      throw new AssertionError({
        message: `Response does not match API schema:\n  ${errorDetails}`,
        actual: result.errors,
        expected: 'valid response matching OpenAPI schema',
      })
    }
  }
}
