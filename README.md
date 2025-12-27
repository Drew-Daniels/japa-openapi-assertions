# @drew-daniels/japa-openapi-assertions

OpenAPI 3.1 assertions plugin for [Japa](https://japa.dev) test framework. Validate your API responses against OpenAPI specifications with full OpenAPI 3.1 support.

## Why This Fork?

This package is a fork of [`@japa/openapi-assertions`](https://japa.dev/docs/plugins/openapi-assertions) created to add **OpenAPI 3.1 support**. The original package uses [`api-contract-validator`](https://github.com/PayU/api-contract-validator) under the hood, which only supports OpenAPI 3.0.

OpenAPI 3.1 introduced significant changes that break compatibility with OpenAPI 3.0 tooling. This fork replaces the underlying validation engine with [AJV](https://ajv.js.org/) configured for [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html), providing native support for OpenAPI 3.1 specifications.

## OpenAPI 3.0 vs 3.1: Key Differences

OpenAPI 3.1 aligns fully with JSON Schema Draft 2020-12, which introduced several breaking changes from the modified JSON Schema subset used in OpenAPI 3.0:

### Nullable Types

The `nullable` keyword was removed. Use JSON Schema type arrays instead:

```yaml
# OpenAPI 3.0
type: string
nullable: true

# OpenAPI 3.1
type: ["string", "null"]
```

### Exclusive Min/Max

Boolean modifiers changed to numeric values:

```yaml
# OpenAPI 3.0
minimum: 0
exclusiveMinimum: true

# OpenAPI 3.1
exclusiveMinimum: 0
```

### $ref Behavior

OpenAPI 3.1 allows sibling keywords alongside `$ref`, eliminating the need for `allOf` workarounds:

```yaml
# OpenAPI 3.0 (workaround required)
allOf:
  - $ref: '#/components/schemas/Pet'
  - description: A pet with extra info

# OpenAPI 3.1 (direct usage)
$ref: '#/components/schemas/Pet'
description: A pet with extra info
```

### Examples

The `example` keyword is deprecated in favor of `examples` (array format):

```yaml
# OpenAPI 3.0
example: "Fluffy"

# OpenAPI 3.1
examples:
  - "Fluffy"
  - "Buddy"
```

For a complete list of changes, see the [OpenAPI Initiative migration guide](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0).

## Backward Compatibility

**This package is designed for OpenAPI 3.1 specifications.** It may work with some OpenAPI 3.0 specs, but compatibility is not guaranteed due to the fundamental differences in how schemas are validated:

| Feature | OpenAPI 3.0 Spec | This Package |
|---------|------------------|--------------|
| `nullable: true` | Supported in 3.0 | Not supported - use `type: ["string", "null"]` |
| `type: ["string", "null"]` | Not valid in 3.0 | Fully supported |
| `exclusiveMinimum: true` | Supported in 3.0 | Not supported - use numeric value |
| `$ref` with siblings | Not valid in 3.0 | Fully supported |

If you need OpenAPI 3.0 support, use the original [`@japa/openapi-assertions`](https://www.npmjs.com/package/@japa/openapi-assertions) package.

## Installation

```bash
npm install @drew-daniels/japa-openapi-assertions
```

### Peer Dependencies

This plugin requires:
- `@japa/assert` ^4.0.0
- `@japa/runner` ^3.0.0 || ^4.0.0 || ^5.0.0

```bash
npm install @japa/assert @japa/runner
```

## Setup

Configure the plugin in your Japa configuration file:

```typescript
// tests/bootstrap.ts
import { assert } from '@japa/assert'
import { apiClient } from '@japa/api-client'
import { openapi } from '@drew-daniels/japa-openapi-assertions'

export const plugins = [
  assert(),
  openapi({
    schemas: [new URL('../openapi.json', import.meta.url)],
    reportCoverage: true,
  }),
  apiClient(),
]
```

## Usage

Use the `isValidApiResponse` assertion method to validate responses against your OpenAPI specification:

```typescript
import { test } from '@japa/runner'

test.group('Pets API', () => {
  test('list all pets', async ({ client, assert }) => {
    const response = await client.get('/pets')

    response.assertStatus(200)
    assert.isValidApiResponse(response)
  })

  test('get a single pet', async ({ client, assert }) => {
    const response = await client.get('/pets/123')

    response.assertStatus(200)
    assert.isValidApiResponse(response)
  })

  test('create a pet', async ({ client, assert }) => {
    const response = await client
      .post('/pets')
      .json({ name: 'Fluffy', tag: 'cat' })

    response.assertStatus(201)
    assert.isValidApiResponse(response)
  })
})
```

### Validation Behavior

The plugin validates:

- **Path matching**: Ensures the request path exists in your OpenAPI spec (supports parameterized paths like `/pets/{petId}`)
- **HTTP method**: Validates the method is defined for the matched path
- **Status code**: Checks that a response schema exists for the returned status
- **Response body**: Validates the response body against the JSON schema defined in your spec

If validation fails, a detailed `AssertionError` is thrown with information about what didn't match.

## Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `schemas` | `(string \| URL)[]` | **Required.** Paths to OpenAPI specification files (JSON format) |
| `reportCoverage` | `boolean` | Print coverage report to console on process exit |
| `exportCoverage` | `boolean` | Export coverage data to `coverage.json` on process exit |

### Coverage Reporting

Enable coverage tracking to see which API endpoints have been tested:

```typescript
openapi({
  schemas: ['./openapi.json'],
  reportCoverage: true,
  exportCoverage: true,
})
```

The coverage report shows:
- Total endpoints defined in your spec
- Number of endpoints tested
- List of untested endpoints
- Coverage percentage

## Supported HTTP Clients

The plugin automatically detects and parses responses from popular HTTP client libraries:

| Library | Support |
|---------|---------|
| [@japa/api-client](https://japa.dev/docs/plugins/api-client) | Full support |
| [Axios](https://axios-http.com/) | Full support |
| [Supertest](https://github.com/ladjs/supertest) | Full support |

### Response Format Detection

The plugin inspects the response object to determine which format to use:

- **Japa api-client**: Detected by `request` and `statusCode` properties
- **Axios**: Detected by `data`, `config`, and `status` properties
- **Supertest**: Detected by `body`, `req`, and `statusCode` properties

## Requirements

- Node.js >= 20.6.0
- OpenAPI 3.1.x specification in JSON format

## Technical Details

This package uses:
- [AJV](https://ajv.js.org/) with JSON Schema 2020-12 support for schema validation
- [ajv-formats](https://github.com/ajv-validator/ajv-formats) for format validation (email, uri, date-time, etc.)
- [@seriousme/openapi-schema-validator](https://github.com/seriousme/openapi-schema-validator) for OpenAPI document validation

All `$ref` pointers are resolved locally before validation, supporting references like `$ref: '#/components/schemas/Pet'`.

## License

MIT

## Contributing

Issues and pull requests are welcome at [github.com/drew-daniels/japa-openapi-assertions](https://github.com/drew-daniels/japa-openapi-assertions).

## Credits

This package is a fork of the original [@japa/openapi-assertions](https://japa.dev/docs/plugins/openapi-assertions) by the Japa team.

## Further Reading

- [OpenAPI 3.1 Migration Guide](https://www.openapis.org/blog/2021/02/16/migrating-from-openapi-3-0-to-3-1-0)
- [Upgrading from OpenAPI 3.0 to 3.1](https://learn.openapis.org/upgrading/v3.0-to-v3.1.html)
- [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12/json-schema-core.html)
- [Japa Testing Framework](https://japa.dev/)
