import { describe, it, before, after } from 'node:test'
import assert from 'node:assert'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { OpenApiAssertions } from '../src/openapi_assertions.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const fixturesPath = join(__dirname, 'fixtures')

describe('OpenApiAssertions', () => {
  before(() => {
    OpenApiAssertions.reset()
  })

  after(() => {
    OpenApiAssertions.reset()
  })

  describe('registerSpecs', () => {
    it('should register specs without error', () => {
      OpenApiAssertions.reset()
      const specPath = join(fixturesPath, 'petstore-3.1.json')

      assert.doesNotThrow(() => {
        OpenApiAssertions.registerSpecs([specPath])
      })
    })
  })

  describe('isValidResponse', () => {
    before(() => {
      OpenApiAssertions.reset()
      const specPath = join(fixturesPath, 'petstore-3.1.json')
      OpenApiAssertions.registerSpecs([specPath])
    })

    it('should validate a correct response', () => {
      const assertions = new OpenApiAssertions()

      // Mock a response in Japa api-client format
      const response = {
        request: {
          method: 'GET',
          url: '/pets',
        },
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: () => [
          { id: 1, name: 'Fluffy', tag: null, status: 'available' },
          { id: 2, name: 'Buddy', status: 'pending' },
        ],
      }

      assert.doesNotThrow(() => assertions.isValidResponse(response))
    })

    it('should validate a response with path parameters', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'GET',
          url: '/pets/123',
        },
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: () => ({ id: 123, name: 'Fluffy', tag: 'cat' }),
      }

      assert.doesNotThrow(() => assertions.isValidResponse(response))
    })

    it('should reject an invalid response body', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'GET',
          url: '/pets',
        },
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: () => [
          { id: 'not-a-number', name: 'Fluffy' }, // id should be integer
        ],
      }

      assert.throws(
        () => assertions.isValidResponse(response),
        (err: Error) => {
          assert.ok(err.message.includes('does not match API schema'))
          return true
        },
      )
    })

    it('should reject response missing required fields', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'GET',
          url: '/pets/1',
        },
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: () => ({ id: 1 }), // missing required 'name' field
      }

      assert.throws(
        () => assertions.isValidResponse(response),
        (err: Error) => {
          assert.ok(err.message.includes('does not match API schema'))
          return true
        },
      )
    })

    it('should reject unknown path', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'GET',
          url: '/unknown',
        },
        statusCode: 200,
        headers: {},
        body: () => ({}),
      }

      assert.throws(
        () => assertions.isValidResponse(response),
        (err: Error) => {
          assert.ok(err.message.includes('No matching path'))
          return true
        },
      )
    })

    it('should reject unknown method', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'PATCH',
          url: '/pets',
        },
        statusCode: 200,
        headers: {},
        body: () => ({}),
      }

      assert.throws(
        () => assertions.isValidResponse(response),
        (err: Error) => {
          assert.ok(err.message.includes('No PATCH operation defined'))
          return true
        },
      )
    })

    it('should reject unknown status code', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'GET',
          url: '/pets',
        },
        statusCode: 418, // Not defined in spec
        headers: {},
        body: () => ({}),
      }

      assert.throws(
        () => assertions.isValidResponse(response),
        (err: Error) => {
          assert.ok(err.message.includes('No response schema defined'))
          return true
        },
      )
    })

    it('should validate nullable fields (OpenAPI 3.1 feature)', () => {
      const assertions = new OpenApiAssertions()

      const response = {
        request: {
          method: 'GET',
          url: '/pets/1',
        },
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: () => ({ id: 1, name: 'Fluffy', tag: null }), // tag is nullable
      }

      assert.doesNotThrow(() => assertions.isValidResponse(response))
    })
  })

  describe('without registered specs', () => {
    before(() => {
      OpenApiAssertions.reset()
    })

    it('should throw when validating without registered specs', () => {
      const assertions = new OpenApiAssertions()

      assert.throws(
        () => assertions.isValidResponse({}),
        (err: Error) => {
          assert.ok(err.message.includes('without defining API schemas'))
          return true
        },
      )
    })
  })
})
