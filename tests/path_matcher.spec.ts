import { describe, it } from 'node:test'
import assert from 'node:assert'
import { matchPath } from '../src/path_matcher.js'

describe('matchPath', () => {
  const specPaths = [
    '/pets',
    '/pets/{petId}',
    '/users/{userId}/pets',
    '/users/{userId}/pets/{petId}',
    '/stores/{storeId}',
  ]

  describe('exact matches', () => {
    it('should match exact paths', () => {
      const result = matchPath('/pets', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/pets')
      assert.deepStrictEqual(result.params, {})
    })
  })

  describe('parameterized paths', () => {
    it('should match single parameter paths', () => {
      const result = matchPath('/pets/123', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/pets/{petId}')
      assert.deepStrictEqual(result.params, { petId: '123' })
    })

    it('should match multiple parameter paths', () => {
      const result = matchPath('/users/456/pets/789', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/users/{userId}/pets/{petId}')
      assert.deepStrictEqual(result.params, { userId: '456', petId: '789' })
    })

    it('should match paths with string parameters', () => {
      const result = matchPath('/stores/main-store', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/stores/{storeId}')
      assert.deepStrictEqual(result.params, { storeId: 'main-store' })
    })
  })

  describe('query string handling', () => {
    it('should strip query strings before matching', () => {
      const result = matchPath('/pets?limit=10&offset=0', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/pets')
    })

    it('should strip query strings from parameterized paths', () => {
      const result = matchPath('/pets/123?include=owner', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/pets/{petId}')
      assert.deepStrictEqual(result.params, { petId: '123' })
    })
  })

  describe('trailing slash handling', () => {
    it('should handle trailing slash on request path', () => {
      const result = matchPath('/pets/', specPaths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/pets')
    })
  })

  describe('no match', () => {
    it('should return null for unknown paths', () => {
      const result = matchPath('/unknown', specPaths)
      assert.strictEqual(result, null)
    })

    it('should return null for partial matches', () => {
      const result = matchPath('/pet', specPaths)
      assert.strictEqual(result, null)
    })

    it('should return null for paths with extra segments', () => {
      const result = matchPath('/pets/123/extra', specPaths)
      assert.strictEqual(result, null)
    })
  })

  describe('priority', () => {
    it('should prefer exact matches over parameterized', () => {
      const paths = ['/users/{id}', '/users/me']
      const result = matchPath('/users/me', paths)
      assert.ok(result)
      assert.strictEqual(result.matched, '/users/me')
    })
  })
})
