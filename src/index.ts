import { Assert } from '@japa/assert'
import { OpenApiAssertions } from './openapi_assertions.js'
import type { PluginConfig } from './types.js'

// Re-export types and classes
export { OpenApiAssertions } from './openapi_assertions.js'
export type { PluginConfig } from './types.js'

// Augment @japa/assert to add our assertion method
declare module '@japa/assert' {
  interface Assert {
    isValidApiResponse(response: unknown): void
  }
}

/**
 * OpenAPI assertions plugin for Japa.
 *
 * This plugin validates HTTP responses against OpenAPI 3.0/3.1 specifications.
 * It's a drop-in replacement for @japa/openapi-assertions with full OpenAPI 3.1 support.
 *
 * @example
 * ```typescript
 * import { openapi } from '@drew-daniels/japa-openapi-assertions'
 *
 * export const plugins = [
 *   assert(),
 *   openapi({
 *     schemas: ['./openapi.json'],
 *     reportCoverage: true,
 *   }),
 *   apiClient(),
 * ]
 * ```
 *
 * @param options - Plugin configuration
 * @returns Japa plugin function
 */
export function openapi(options: PluginConfig) {
  // Register specs immediately (async loading happens in background)
  OpenApiAssertions.registerSpecs(options.schemas, {
    reportCoverage: options.reportCoverage,
    exportCoverage: options.exportCoverage,
  })

  // Return the Japa plugin function
  return function japaOpenapiPlugin() {
    // Register the assertion macro
    Assert.macro('isValidApiResponse', function (this: Assert, response: unknown) {
      return new OpenApiAssertions().isValidResponse(response)
    })
  }
}
