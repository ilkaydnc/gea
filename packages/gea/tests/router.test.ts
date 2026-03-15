import assert from 'node:assert/strict'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { JSDOM } from 'jsdom'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function installDom(url = 'http://localhost/') {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url })
  const raf = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number
  const caf = (id: number) => clearTimeout(id)
  dom.window.requestAnimationFrame = raf
  dom.window.cancelAnimationFrame = caf

  const prev = {
    window: globalThis.window,
    document: globalThis.document,
    HTMLElement: globalThis.HTMLElement,
    Node: globalThis.Node,
    NodeFilter: globalThis.NodeFilter,
    MutationObserver: globalThis.MutationObserver,
    Event: globalThis.Event,
    CustomEvent: globalThis.CustomEvent,
    requestAnimationFrame: globalThis.requestAnimationFrame,
    cancelAnimationFrame: globalThis.cancelAnimationFrame,
  }

  Object.assign(globalThis, {
    window: dom.window,
    document: dom.window.document,
    HTMLElement: dom.window.HTMLElement,
    Node: dom.window.Node,
    NodeFilter: dom.window.NodeFilter,
    MutationObserver: dom.window.MutationObserver,
    Event: dom.window.Event,
    CustomEvent: dom.window.CustomEvent,
    requestAnimationFrame: raf,
    cancelAnimationFrame: caf,
  })

  return () => {
    Object.assign(globalThis, prev)
    dom.window.close()
  }
}

async function flush() {
  await new Promise((r) => setTimeout(r, 0))
  await new Promise((r) => setTimeout(r, 0))
}

// ── matchRoute (pure function, no DOM needed) ──────────────────────

import { matchRoute } from '../src/lib/router'

describe('matchRoute', () => {
  it('matches root path', () => {
    const result = matchRoute('/', '/')
    assert.ok(result)
    assert.deepEqual(result.params, {})
    assert.equal(result.pattern, '/')
  })

  it('matches a static segment', () => {
    const result = matchRoute('/about', '/about')
    assert.ok(result)
    assert.deepEqual(result.params, {})
  })

  it('matches multi-segment static path', () => {
    const result = matchRoute('/docs/intro', '/docs/intro')
    assert.ok(result)
    assert.deepEqual(result.params, {})
  })

  it('returns null for non-matching static path', () => {
    assert.equal(matchRoute('/about', '/contact'), null)
  })

  it('returns null when segment counts differ (no wildcard)', () => {
    assert.equal(matchRoute('/a/b', '/a'), null)
    assert.equal(matchRoute('/a', '/a/b'), null)
  })

  it('extracts a single named param', () => {
    const result = matchRoute('/users/:id', '/users/42')
    assert.ok(result)
    assert.equal(result.params.id, '42')
  })

  it('extracts multiple named params', () => {
    const result = matchRoute('/users/:userId/posts/:postId', '/users/7/posts/99')
    assert.ok(result)
    assert.equal(result.params.userId, '7')
    assert.equal(result.params.postId, '99')
  })

  it('decodes URI-encoded param values', () => {
    const result = matchRoute('/search/:query', '/search/hello%20world')
    assert.ok(result)
    assert.equal(result.params.query, 'hello world')
  })

  it('returns null when param segment is missing', () => {
    assert.equal(matchRoute('/users/:id/posts', '/users/42'), null)
  })

  it('matches wildcard at the end', () => {
    const result = matchRoute('/files/*', '/files/docs/readme.md')
    assert.ok(result)
    assert.equal(result.params['*'], 'docs/readme.md')
  })

  it('wildcard matches empty rest', () => {
    const result = matchRoute('/files/*', '/files')
    assert.ok(result)
    assert.equal(result.params['*'], '')
  })

  it('wildcard with prefix params', () => {
    const result = matchRoute('/repo/:owner/*', '/repo/dashersw/src/index.ts')
    assert.ok(result)
    assert.equal(result.params.owner, 'dashersw')
    assert.equal(result.params['*'], 'src/index.ts')
  })

  it('returns null when wildcard prefix does not match', () => {
    assert.equal(matchRoute('/files/*', '/images/photo.png'), null)
  })
})

// ── Router (needs window/history) ──────────────────────────────────

describe('Router', () => {
  let restoreDom: () => void

  beforeEach(() => {
    restoreDom = installDom('http://localhost/initial')
  })

  afterEach(() => {
    restoreDom()
  })

  async function loadRouter() {
    const seed = `router-${Date.now()}-${Math.random()}`
    const mgr = await import(`../src/lib/base/component-manager?${seed}`)
    mgr.default.instance = undefined
    const mod = await import(`../src/lib/router?${seed}`)
    return { Router: mod.Router as typeof import('../src/lib/router').Router }
  }

  it('initializes state from window.location', async () => {
    const { Router } = await loadRouter()
    const r = new Router()
    assert.equal(r.path, '/initial')
  })

  it('navigate() updates state.path', async () => {
    const { Router } = await loadRouter()
    const r = new Router()
    r.navigate('/new-page')
    assert.equal(r.path, '/new-page')
  })

  it('replace() updates state without adding history entry', async () => {
    const { Router } = await loadRouter()
    const r = new Router()
    r.replace('/replaced')
    assert.equal(r.path, '/replaced')
  })

  it('navigate() with query and hash updates all state fields', async () => {
    const { Router } = await loadRouter()
    const r = new Router()
    r.navigate('/page?foo=bar#section')
    assert.equal(r.path, '/page')
    assert.equal(r.search, '?foo=bar')
    assert.equal(r.hash, '#section')
  })

  it('query getter parses search params', async () => {
    const { Router } = await loadRouter()
    const r = new Router()
    r.navigate('/search?q=hello&page=2')
    assert.equal(r.query.q, 'hello')
    assert.equal(r.query.page, '2')
  })

  it('navigate() triggers observer', async () => {
    const { Router } = await loadRouter()
    const r = new Router()
    const paths: string[] = []
    r.observe('path', (val) => {
      paths.push(val)
    })
    r.navigate('/observed')
    await flush()
    assert.equal(paths.length, 1)
    assert.equal(paths[0], '/observed')
  })
})

// ── Compile helpers (uses geaPlugin to compile .tsx at test time) ──

import { geaPlugin } from '../../vite-plugin-gea/index.ts'
import { transformSync } from 'esbuild'

async function compileJsxComponent(source: string, id: string, className: string, bindings: Record<string, unknown>) {
  const plugin = geaPlugin()
  const transform = typeof plugin.transform === 'function' ? plugin.transform : (plugin.transform as any)?.handler
  const result = await transform?.call({} as never, source, id)
  assert.ok(result)

  const geaCode = typeof result === 'string' ? result : result.code
  const { code } = transformSync(geaCode, { loader: 'ts', target: 'es2020' })
  const compiledSource = `${code
    .replace(/^import .*;$/gm, '')
    .replaceAll('import.meta.hot', 'undefined')
    .replaceAll('import.meta.url', '""')
    .replace(/export default class\s+/, 'class ')}
return ${className};`

  return new Function(...Object.keys(bindings), compiledSource)(...Object.values(bindings))
}

function readSource(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), 'utf8')
}

async function loadRuntimeModules(seed: string) {
  const { default: ComponentManager } = await import('../src/lib/base/component-manager')
  ComponentManager.instance = undefined
  const [compMod, routerMod] = await Promise.all([
    import(`../src/lib/base/component.tsx?${seed}`),
    import(`../src/lib/router?${seed}`),
  ])
  return {
    Component: compMod.default,
    Router: routerMod.Router,
    router: routerMod.router,
    matchRoute: routerMod.matchRoute,
  }
}

// ── RouterView (needs full DOM + gea plugin compilation) ───────────

describe('RouterView', () => {
  let restoreDom: () => void

  beforeEach(() => {
    restoreDom = installDom('http://localhost/')
  })

  afterEach(() => {
    restoreDom()
  })

  async function setupRouterView(seed: string) {
    const mods = await loadRuntimeModules(seed)
    const RouterView = await compileJsxComponent(
      readSource('../src/lib/router/router-view.tsx'),
      '/virtual/router-view.jsx',
      'RouterView',
      { Component: mods.Component, router: mods.router, matchRoute: mods.matchRoute },
    )
    return { ...mods, RouterView }
  }

  it('renders the matching route component on mount', async () => {
    const seed = `rv-${Date.now()}-mount`
    const { Component, RouterView } = await setupRouterView(seed)

    class Home extends Component {
      template() { return '<div class="home">Home Page</div>' as any }
    }

    const rv = new RouterView({
      routes: [{ path: '/', component: Home }],
    })
    rv.render(document.body)
    await flush()

    assert.ok(rv.el)
    assert.ok(rv.el!.querySelector('.home'))
  })

  it('passes matched params as props', async () => {
    const seed = `rv-${Date.now()}-params`
    const { Component, RouterView, router } = await setupRouterView(seed)

    let receivedProps: any = null
    class UserProfile extends Component {
      created(props: any) { receivedProps = props }
      template(props: any) { return `<div class="user">${props.id}</div>` as any }
    }

    router.navigate('/users/42')

    const rv = new RouterView({
      routes: [{ path: '/users/:id', component: UserProfile }],
    })
    rv.render(document.body)
    await flush()

    assert.ok(receivedProps)
    assert.equal(receivedProps.id, '42')
  })

  it('swaps component when path changes', async () => {
    const seed = `rv-${Date.now()}-swap`
    const { Component, RouterView, router } = await setupRouterView(seed)

    class Home extends Component {
      template() { return '<div class="home">Home</div>' as any }
    }
    class About extends Component {
      template() { return '<div class="about">About</div>' as any }
    }

    const rv = new RouterView({
      routes: [
        { path: '/', component: Home },
        { path: '/about', component: About },
      ],
    })
    rv.render(document.body)
    await flush()

    assert.ok(rv.el!.querySelector('.home'))
    assert.equal(rv.el!.querySelector('.about'), null)

    router.navigate('/about')
    await flush()

    assert.ok(rv.el!.querySelector('.about'))
    assert.equal(rv.el!.querySelector('.home'), null)
  })

  it('renders nothing when no route matches', async () => {
    const seed = `rv-${Date.now()}-nomatch`
    const { Component, RouterView, router } = await setupRouterView(seed)

    class Home extends Component {
      template() { return '<div class="home">Home</div>' as any }
    }

    router.navigate('/nonexistent')

    const rv = new RouterView({
      routes: [{ path: '/', component: Home }],
    })
    rv.render(document.body)
    await flush()

    assert.equal(rv.el!.children.length, 0)
  })

  it('disposes previous child on route change', async () => {
    const seed = `rv-${Date.now()}-dispose`
    const { Component, RouterView, router } = await setupRouterView(seed)

    let disposed = false
    class Home extends Component {
      template() { return '<div class="home">Home</div>' as any }
      dispose() { disposed = true; super.dispose() }
    }
    class About extends Component {
      template() { return '<div class="about">About</div>' as any }
    }

    const rv = new RouterView({
      routes: [
        { path: '/', component: Home },
        { path: '/about', component: About },
      ],
    })
    rv.render(document.body)
    await flush()

    assert.equal(disposed, false)
    router.navigate('/about')
    await flush()
    assert.equal(disposed, true)
  })
})

// ── Link (needs DOM + gea plugin compilation) ──────────────────────

describe('Link', () => {
  let restoreDom: () => void

  beforeEach(() => {
    restoreDom = installDom('http://localhost/')
  })

  afterEach(() => {
    restoreDom()
  })

  async function setupLink(seed: string) {
    const mods = await loadRuntimeModules(seed)
    const Link = await compileJsxComponent(
      readSource('../src/lib/router/link.tsx'),
      '/virtual/link.jsx',
      'Link',
      { Component: mods.Component, router: mods.router },
    )
    return { ...mods, Link }
  }

  it('renders an <a> tag with href and label', async () => {
    const seed = `link-${Date.now()}-render`
    const { Link } = await setupLink(seed)

    const link = new Link({ to: '/about', label: 'About' })
    link.render(document.body)
    await flush()

    const a = link.el
    assert.ok(a)
    assert.equal(a!.tagName, 'A')
    assert.equal(a!.getAttribute('href'), '/about')
    assert.equal(a!.textContent?.trim(), 'About')
  })

  it('click navigates via router instead of default', async () => {
    const seed = `link-${Date.now()}-click`
    const { Link, router } = await setupLink(seed)

    const link = new Link({ to: '/target', label: 'Go' })
    link.render(document.body)
    await flush()

    const event = new Event('click', { bubbles: true, cancelable: true })
    link.el!.dispatchEvent(event)
    await flush()

    assert.equal(router.path, '/target')
  })
})
