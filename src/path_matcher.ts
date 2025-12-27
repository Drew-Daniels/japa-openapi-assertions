import type { PathMatchResult } from './types.js'

/**
 * Match a request path against OpenAPI path definitions.
 *
 * Handles path parameters (e.g., /pets/{petId} matches /pets/123)
 * and scores matches by specificity (exact segments preferred over parameters).
 */
export function matchPath(
  requestPath: string,
  specPaths: string[],
): PathMatchResult | null {
  // Clean the request path: remove query string and trailing slash
  const cleanPath = requestPath.split('?')[0].replace(/\/$/, '') || '/'

  const matches: Array<{ specPath: string; params: Record<string, string>; score: number }> = []

  for (const specPath of specPaths) {
    const result = tryMatch(cleanPath, specPath)
    if (result) {
      matches.push(result)
    }
  }

  if (matches.length === 0) {
    return null
  }

  // Sort by score (higher = more specific = fewer parameters)
  matches.sort((a, b) => b.score - a.score)

  return {
    matched: matches[0].specPath,
    params: matches[0].params,
  }
}

/**
 * Try to match a request path against a single spec path.
 * Returns match result with score, or null if no match.
 */
function tryMatch(
  requestPath: string,
  specPath: string,
): { specPath: string; params: Record<string, string>; score: number } | null {
  const requestSegments = requestPath.split('/').filter(Boolean)
  const specSegments = specPath.split('/').filter(Boolean)

  // Must have same number of segments
  if (requestSegments.length !== specSegments.length) {
    return null
  }

  const params: Record<string, string> = {}
  let score = 0

  for (let i = 0; i < specSegments.length; i++) {
    const specSegment = specSegments[i]
    const requestSegment = requestSegments[i]

    // Check if it's a path parameter
    const paramMatch = specSegment.match(/^\{(\w+)\}$/)

    if (paramMatch) {
      // It's a parameter - extract the value
      params[paramMatch[1]] = requestSegment
      // Parameters score lower than exact matches
      score += 1
    } else if (specSegment === requestSegment) {
      // Exact match - higher score
      score += 10
    } else {
      // No match
      return null
    }
  }

  return { specPath, params, score }
}

/**
 * Get the base path from a server URL.
 * E.g., "http://localhost:3333/api/v1" -> "/api/v1"
 */
export function extractBasePath(serverUrl: string): string {
  try {
    const url = new URL(serverUrl)
    return url.pathname.replace(/\/$/, '') || '/'
  } catch {
    // If it's not a valid URL, assume it's already a path
    return serverUrl.replace(/\/$/, '') || '/'
  }
}

/**
 * Normalize a path by removing base path prefix if present.
 */
export function removeBasePath(requestPath: string, basePath: string): string {
  if (basePath === '/' || basePath === '') {
    return requestPath
  }

  if (requestPath.startsWith(basePath)) {
    const remaining = requestPath.slice(basePath.length)
    return remaining.startsWith('/') ? remaining : `/${remaining}`
  }

  return requestPath
}
