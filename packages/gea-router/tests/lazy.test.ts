import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveLazy } from '../src/lazy'

describe('resolveLazy', () => {
  it('resolves default export', async () => {
    const Component = class MyComponent {}
    const loader = () => Promise.resolve({ default: Component })
    const result = await resolveLazy(loader)
    assert.equal(result, Component)
  })

  it('resolves direct export (no default)', async () => {
    const Component = class MyComponent {}
    const loader = () => Promise.resolve(Component)
    const result = await resolveLazy(loader)
    assert.equal(result, Component)
  })

  it('throws on import failure', async () => {
    const loader = () => Promise.reject(new Error('chunk failed'))
    await assert.rejects(() => resolveLazy(loader, 0), {
      message: 'chunk failed',
    })
  })

  it('retries on failure then succeeds', async () => {
    let calls = 0
    const Component = class MyComponent {}
    const loader = () => {
      calls++
      if (calls < 3) return Promise.reject(new Error('network error'))
      return Promise.resolve({ default: Component })
    }
    const result = await resolveLazy(loader, 3, 0)
    assert.equal(result, Component)
    assert.equal(calls, 3)
  })
})
