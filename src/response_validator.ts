import type {
  CompiledValidators,
  ParsedResponse,
  ValidationResult,
  ValidationError,
} from './types.js'
import { matchPath } from './path_matcher.js'

/**
 * Validate an HTTP response against compiled OpenAPI validators.
 */
export function validateResponse(
  response: unknown,
  validators: CompiledValidators,
): ValidationResult {
  // Parse the response from various HTTP client formats
  const parsed = parseResponse(response)

  // Find matching path in spec
  const specPaths = Object.keys(validators)
  const pathMatch = matchPath(parsed.path, specPaths)

  if (!pathMatch) {
    return {
      valid: false,
      errors: [{
        path: '',
        message: `No matching path found in OpenAPI spec for ${parsed.method} ${parsed.path}`,
        actual: parsed.path,
        expected: specPaths,
      }],
    }
  }

  const method = parsed.method.toLowerCase()
  const statusCode = String(parsed.status)

  // Get validators for this path/method
  const pathValidators = validators[pathMatch.matched]?.[method]

  if (!pathValidators) {
    return {
      valid: false,
      errors: [{
        path: '',
        message: `No ${parsed.method} operation defined for ${pathMatch.matched}`,
        actual: method,
      }],
    }
  }

  // Get validator for this status code
  // Try exact match first, then 'default', then 2XX/4XX/5XX patterns
  const responseValidator = pathValidators.responses[statusCode]
    || pathValidators.responses['default']
    || pathValidators.responses[`${statusCode[0]}XX`]

  if (!responseValidator) {
    return {
      valid: false,
      errors: [{
        path: '',
        message: `No response schema defined for ${parsed.method} ${pathMatch.matched} with status ${statusCode}`,
        actual: statusCode,
        expected: Object.keys(pathValidators.responses),
      }],
    }
  }

  // Validate response body if there's a body validator
  if (responseValidator.body) {
    const valid = responseValidator.body(parsed.body)

    if (!valid && responseValidator.body.errors) {
      const errors: ValidationError[] = responseValidator.body.errors.map((err) => ({
        path: err.instancePath || '',
        message: err.message || 'Validation failed',
        keyword: err.keyword,
        expected: err.params,
        actual: getValueAtPath(parsed.body, err.instancePath || ''),
      }))

      return { valid: false, errors }
    }
  }

  return { valid: true }
}

/**
 * Parse response from various HTTP client formats.
 */
export function parseResponse(response: unknown): ParsedResponse {
  if (!response || typeof response !== 'object') {
    throw new Error('Invalid response: expected an object')
  }

  const res = response as Record<string, unknown>

  // Japa @japa/api-client format
  // The response object itself has the properties we need
  if ('response' in res && res.response && typeof res.response === 'object') {
    // This is the ApiResponse wrapper, unwrap it
    return parseResponse(res.response)
  }

  // Japa api-client direct response (has .request and .body())
  if ('request' in res && 'statusCode' in res) {
    const request = res.request as Record<string, unknown>
    return {
      method: String(request.method || 'GET').toUpperCase(),
      path: extractPath(request.url as string | undefined || '/'),
      status: Number(res.statusCode) || 0,
      headers: normalizeHeaders(res.headers as Record<string, unknown> || {}),
      body: typeof res.body === 'function' ? (res.body as () => unknown)() : res.body,
    }
  }

  // Axios format (has .data, .config, .status)
  if ('data' in res && 'config' in res && 'status' in res) {
    const config = res.config as Record<string, unknown>
    return {
      method: String(config.method || 'GET').toUpperCase(),
      path: extractPath(config.url as string | undefined || '/'),
      status: Number(res.status) || 0,
      headers: normalizeHeaders(res.headers as Record<string, unknown> || {}),
      body: res.data,
    }
  }

  // Supertest format (has .body, .req, .statusCode)
  if ('body' in res && 'req' in res && 'statusCode' in res) {
    const req = res.req as Record<string, unknown>
    return {
      method: String(req.method || 'GET').toUpperCase(),
      path: extractPath(req.path as string | undefined || '/'),
      status: Number(res.statusCode) || 0,
      headers: normalizeHeaders(res.headers as Record<string, unknown> || {}),
      body: res.body,
    }
  }

  // Generic format - try to extract what we can
  if ('status' in res || 'statusCode' in res) {
    return {
      method: String(res.method || 'GET').toUpperCase(),
      path: extractPath(res.url as string | undefined || res.path as string | undefined || '/'),
      status: Number(res.status || res.statusCode) || 0,
      headers: normalizeHeaders(res.headers as Record<string, unknown> || {}),
      body: res.body ?? res.data ?? null,
    }
  }

  throw new Error('Unknown response format: could not extract method, path, status, or body')
}

/**
 * Extract path from a URL string.
 */
function extractPath(url: string): string {
  try {
    // If it's a full URL, parse it
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const parsed = new URL(url)
      return parsed.pathname
    }
    // Otherwise, split on query string
    return url.split('?')[0]
  } catch {
    return url.split('?')[0]
  }
}

/**
 * Normalize headers to lowercase keys with string values.
 */
function normalizeHeaders(headers: Record<string, unknown>): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    result[key.toLowerCase()] = String(value)
  }
  return result
}

/**
 * Get value at a JSON path.
 */
function getValueAtPath(obj: unknown, path: string): unknown {
  if (!path || path === '') return obj
  if (!obj || typeof obj !== 'object') return undefined

  const parts = path.split('/').filter(Boolean)
  let current: unknown = obj

  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }

  return current
}
