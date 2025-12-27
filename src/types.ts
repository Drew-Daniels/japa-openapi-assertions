import type { ValidateFunction } from 'ajv'

/**
 * Plugin configuration options
 */
export interface PluginConfig {
  /**
   * Paths to OpenAPI specification files (JSON or YAML)
   */
  schemas: (string | URL)[]

  /**
   * Print coverage report to console on process exit
   */
  reportCoverage?: boolean

  /**
   * Export coverage data to coverage.json on process exit
   */
  exportCoverage?: boolean
}

/**
 * Compiled validators for a single response
 */
export interface ResponseValidators {
  body?: ValidateFunction
  headers?: ValidateFunction
}

/**
 * Compiled validators organized by path, method, and status code
 */
export interface CompiledValidators {
  [path: string]: {
    [method: string]: {
      responses: {
        [statusCode: string]: ResponseValidators
      }
    }
  }
}

/**
 * Parsed response data from various HTTP client formats
 */
export interface ParsedResponse {
  method: string
  path: string
  status: number
  headers: Record<string, string>
  body: unknown
}

/**
 * Validation error details
 */
export interface ValidationError {
  path: string
  message: string
  keyword?: string
  expected?: unknown
  actual?: unknown
}

/**
 * Result of validating a response
 */
export interface ValidationResult {
  valid: boolean
  errors?: ValidationError[]
}

/**
 * Path matching result
 */
export interface PathMatchResult {
  matched: string
  params: Record<string, string>
}

/**
 * Coverage entry for a single endpoint
 */
export interface CoverageEntry {
  route: string
  method: string
  statuses: string[]
}

/**
 * OpenAPI document types (simplified)
 */
export interface OpenAPIDocument {
  openapi: string
  info: {
    title: string
    version: string
  }
  paths?: {
    [path: string]: OpenAPIPathItem
  }
  components?: {
    schemas?: Record<string, unknown>
  }
}

export interface OpenAPIPathItem {
  get?: OpenAPIOperation
  post?: OpenAPIOperation
  put?: OpenAPIOperation
  patch?: OpenAPIOperation
  delete?: OpenAPIOperation
  options?: OpenAPIOperation
  head?: OpenAPIOperation
  trace?: OpenAPIOperation
  parameters?: unknown[]
}

export interface OpenAPIOperation {
  operationId?: string
  summary?: string
  description?: string
  responses?: {
    [statusCode: string]: OpenAPIResponse
  }
  requestBody?: unknown
  parameters?: unknown[]
}

export interface OpenAPIResponse {
  description?: string
  content?: {
    [mediaType: string]: {
      schema?: unknown
    }
  }
  headers?: Record<string, unknown>
}
