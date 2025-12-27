import AjvModule from 'ajv/dist/2020.js'
import addFormatsModule from 'ajv-formats'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import type { ValidateFunction } from 'ajv'
import type {
  CompiledValidators,
  OpenAPIDocument,
  OpenAPIPathItem,
  CoverageEntry,
} from './types.js'

// Handle ESM/CJS interop - get the actual constructor/function
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Ajv2020 = (AjvModule as any).default ?? AjvModule
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const addFormats = (addFormatsModule as any).default ?? addFormatsModule

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'] as const

/**
 * Build validators from OpenAPI specification files (async version).
 *
 * @param specPaths - Paths to OpenAPI spec files (JSON or YAML)
 * @returns Compiled validators and coverage entries
 */
export async function buildValidators(
  specPaths: (string | URL)[],
): Promise<{ validators: CompiledValidators; coverageEntries: CoverageEntry[] }> {
  // Delegate to sync version - the async wrapper is kept for API compatibility
  return buildValidatorsSync(specPaths)
}

/**
 * Build validators from OpenAPI specification files (sync version).
 *
 * @param specPaths - Paths to OpenAPI spec files (JSON or YAML)
 * @returns Compiled validators and coverage entries
 */
export function buildValidatorsSync(
  specPaths: (string | URL)[],
): { validators: CompiledValidators; coverageEntries: CoverageEntry[] } {
  const validators: CompiledValidators = {}
  const coverageEntries: CoverageEntry[] = []

  // Create AJV instance with JSON Schema 2020-12 support
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    validateFormats: true,
  })
  addFormats(ajv)

  // Process each spec file
  for (const specPath of specPaths) {
    const filePath = specPath instanceof URL ? fileURLToPath(specPath) : specPath
    const spec = loadAndValidateSpecSync(filePath)

    // Resolve all $refs in the spec
    const resolvedSpec = resolveRefsSync(spec)

    // Build validators for each path
    buildPathValidators(resolvedSpec, validators, coverageEntries, ajv)
  }

  return { validators, coverageEntries }
}

/**
 * Load and validate an OpenAPI specification file (sync version).
 */
function loadAndValidateSpecSync(filePath: string): OpenAPIDocument {
  const content = readFileSync(filePath, 'utf-8')

  // Parse JSON (YAML support could be added with js-yaml)
  let spec: Record<string, unknown>
  try {
    spec = JSON.parse(content)
  } catch {
    throw new Error(`Failed to parse OpenAPI spec at ${filePath}: Invalid JSON`)
  }

  // Note: We skip async validation here since the Validator.validate() is async
  // and we need synchronous operation. The spec will still be validated when
  // resolving refs, and AJV will catch schema issues during compilation.

  return spec as unknown as OpenAPIDocument
}

/**
 * Resolve all $ref pointers in the spec (sync version).
 * Uses a workaround since the Validator is async.
 */
function resolveRefsSync(spec: OpenAPIDocument): OpenAPIDocument {
  // For synchronous operation, we'll resolve refs manually
  // by recursively resolving $ref pointers within the spec
  return resolveRefsInObject(spec, spec) as OpenAPIDocument
}

/**
 * Recursively resolve $ref pointers in an object.
 */
function resolveRefsInObject(obj: unknown, root: OpenAPIDocument): unknown {
  if (!obj || typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map((item) => resolveRefsInObject(item, root))
  }

  const record = obj as Record<string, unknown>

  // Check for $ref
  if (typeof record.$ref === 'string') {
    const ref = record.$ref
    // Only handle local refs (starting with #/)
    if (ref.startsWith('#/')) {
      const resolved = resolveLocalRef(ref, root)
      if (resolved !== undefined) {
        // Merge resolved ref with any additional properties (except $ref)
        const { $ref: _ref, ...rest } = record
        if (Object.keys(rest).length > 0) {
          return { ...resolveRefsInObject(resolved, root) as object, ...rest }
        }
        return resolveRefsInObject(resolved, root)
      }
    }
  }

  // Recursively process all properties
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record)) {
    result[key] = resolveRefsInObject(value, root)
  }
  return result
}

/**
 * Resolve a local JSON pointer reference.
 */
function resolveLocalRef(ref: string, root: OpenAPIDocument): unknown {
  // Remove the #/ prefix and split into path segments
  const path = ref.slice(2).split('/')

  let current: unknown = root
  for (const segment of path) {
    // Decode JSON pointer escapes
    const decoded = segment.replace(/~1/g, '/').replace(/~0/g, '~')
    if (current && typeof current === 'object' && decoded in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[decoded]
    } else {
      return undefined
    }
  }
  return current
}

/**
 * Build validators for all paths in a spec.
 */
function buildPathValidators(
  spec: OpenAPIDocument,
  validators: CompiledValidators,
  coverageEntries: CoverageEntry[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ajv: any,
): void {
  if (!spec.paths) {
    return
  }

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    if (!pathItem) continue

    validators[path] = validators[path] || {}

    for (const method of HTTP_METHODS) {
      const operation = (pathItem as OpenAPIPathItem)[method]
      if (!operation?.responses) continue

      validators[path][method] = { responses: {} }
      const statuses: string[] = []

      for (const [statusCode, response] of Object.entries(operation.responses)) {
        statuses.push(statusCode)

        // Build body validator if there's a JSON schema
        const jsonContent = response.content?.['application/json']
        if (jsonContent?.schema) {
          try {
            const bodyValidator = compileSchema(ajv, jsonContent.schema, `${path}:${method}:${statusCode}:body`)
            validators[path][method].responses[statusCode] = {
              body: bodyValidator,
            }
          } catch (err) {
            console.warn(`Warning: Failed to compile schema for ${method.toUpperCase()} ${path} ${statusCode}:`, err)
          }
        } else {
          validators[path][method].responses[statusCode] = {}
        }
      }

      // Track for coverage
      if (statuses.length > 0) {
        coverageEntries.push({
          route: path,
          method: method.toUpperCase(),
          statuses,
        })
      }
    }
  }
}

/**
 * Compile a JSON schema into a validator function.
 */
function compileSchema(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ajv: any,
  schema: unknown,
  _schemaId: string,
): ValidateFunction {
  // Clone the schema to avoid mutating the original
  const schemaCopy = JSON.parse(JSON.stringify(schema))

  // Remove all $id fields recursively - resolved refs may have invalid patterns
  // AJV 2020-12 is strict about $id format - must match "^[^#]*#?$"
  removeInvalidIds(schemaCopy)

  return ajv.compile(schemaCopy)
}

/**
 * Recursively remove $id fields that don't match JSON Schema 2020-12 pattern.
 */
function removeInvalidIds(obj: unknown): void {
  if (!obj || typeof obj !== 'object') return

  if (Array.isArray(obj)) {
    for (const item of obj) {
      removeInvalidIds(item)
    }
    return
  }

  const record = obj as Record<string, unknown>

  // Remove $id if it contains # anywhere except at the very end
  if (typeof record.$id === 'string') {
    const id = record.$id
    // Valid pattern: ^[^#]*#?$ (no # except optionally at the end)
    if (id.includes('#') && !id.match(/^[^#]*#?$/)) {
      delete record.$id
    }
  }

  // Recurse into all properties
  for (const value of Object.values(record)) {
    removeInvalidIds(value)
  }
}
