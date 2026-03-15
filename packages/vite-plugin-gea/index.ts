import type { Plugin } from 'vite'
import { parseSource } from './parse.ts'
import { injectHMR } from './hmr.ts'
import { transformComponentFile, transformNonComponentJSX } from './transform-component.ts'
import { convertFunctionalToClass } from './transform-functional.ts'
import { createRequire } from 'module'
import { dirname, relative, resolve } from 'node:path'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const pluginDir = dirname(fileURLToPath(import.meta.url))
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default

const RECONCILE_ID = 'virtual:gea-reconcile'
const RESOLVED_RECONCILE_ID = '\0' + RECONCILE_ID

const HMR_RUNTIME_ID = 'virtual:gea-hmr'
const RESOLVED_HMR_RUNTIME_ID = '\0' + HMR_RUNTIME_ID

const RECONCILE_SOURCE = `
function getKey(el) {
  if (el.__geaItem) return String(el.__geaItem.id);
  return el.getAttribute('key');
}
export function reconcile(oldC, newC) {
  var oldMap = new Map();
  var arr = Array.from(oldC.children);
  for (var i = 0; i < arr.length; i++) {
    var k = getKey(arr[i]);
    if (k) oldMap.set(k, arr[i]);
  }
  var newArr = Array.from(newC.children);
  var seen = new Set();
  var prev = null;
  for (var j = 0; j < newArr.length; j++) {
    var nk = getKey(newArr[j]);
    if (!nk) continue;
    seen.add(nk);
    var existing = oldMap.get(nk);
    if (existing) {
      if (existing.innerHTML !== newArr[j].innerHTML) {
        existing.innerHTML = newArr[j].innerHTML;
      }
      var newEl = newArr[j];
      for (var a = 0; a < newEl.attributes.length; a++) {
        var at = newEl.attributes[a];
        if (at.name !== 'key' && existing.getAttribute(at.name) !== at.value) {
          existing.setAttribute(at.name, at.value);
        }
      }
      if (prev ? existing.previousElementSibling !== prev : existing !== oldC.firstElementChild) {
        if (prev) prev.after(existing); else oldC.prepend(existing);
      }
      prev = existing;
    } else {
      if (prev) prev.after(newArr[j]); else oldC.prepend(newArr[j]);
      prev = newArr[j];
    }
  }
  oldMap.forEach(function(el, key) {
    if (!seen.has(key)) el.remove();
  });
}
`

const HMR_RUNTIME_SOURCE = `
var hot = import.meta.hot;
var componentInstances = hot && hot.data && hot.data.componentInstances || new Map();
if (hot) hot.data.componentInstances = componentInstances;
var hmrGlobal = globalThis.__geaHMRGlobal || (globalThis.__geaHMRGlobal = {
  componentModules: new Map(),
  componentProxies: new Map(),
});
var componentModules = hmrGlobal.componentModules;
var componentProxies = hmrGlobal.componentProxies;

function normalizeModuleUrl(moduleUrl) {
  try {
    var url = new URL(moduleUrl, import.meta.url);
    url.search = '';
    url.hash = '';
    return url.href;
  } catch(e) {
    return String(moduleUrl || '').replace(/[?#].*$/, '');
  }
}

function getLatestComponentClass(moduleUrl, fallbackComponent) {
  var latestModule = componentModules.get(normalizeModuleUrl(moduleUrl));
  return latestModule && latestModule.default || latestModule || fallbackComponent;
}

export function registerHotModule(moduleUrl, moduleExports) {
  if (!moduleExports) return moduleExports;
  componentModules.set(normalizeModuleUrl(moduleUrl), moduleExports);
  return moduleExports;
}

export function createHotComponentProxy(moduleUrl, initialComponent) {
  var normalizedUrl = normalizeModuleUrl(moduleUrl);
  if (!componentModules.has(normalizedUrl) && initialComponent) {
    componentModules.set(normalizedUrl, { default: initialComponent });
  }
  if (!componentProxies.has(normalizedUrl)) {
    var target = function GeaHotComponentProxy() {};
    var proxy = new Proxy(target, {
      construct: function(_target, args, newTarget) {
        var ComponentClass = getLatestComponentClass(normalizedUrl, initialComponent);
        if (typeof ComponentClass !== 'function') {
          throw new Error('[gea HMR] No component class available for ' + normalizedUrl);
        }
        return Reflect.construct(ComponentClass, args, newTarget === proxy ? ComponentClass : newTarget);
      },
      get: function(_target, prop, receiver) {
        var ComponentClass = getLatestComponentClass(normalizedUrl, initialComponent);
        if (!ComponentClass) return undefined;
        if (prop === 'prototype') return ComponentClass.prototype;
        return Reflect.get(ComponentClass, prop, receiver);
      },
      set: function(_target, prop, value, receiver) {
        var ComponentClass = getLatestComponentClass(normalizedUrl, initialComponent);
        if (!ComponentClass) return false;
        return Reflect.set(ComponentClass, prop, value, receiver);
      },
      has: function(_target, prop) {
        var ComponentClass = getLatestComponentClass(normalizedUrl, initialComponent);
        return !!ComponentClass && prop in ComponentClass;
      },
      ownKeys: function() {
        var ComponentClass = getLatestComponentClass(normalizedUrl, initialComponent);
        return ComponentClass ? Reflect.ownKeys(ComponentClass) : [];
      },
      getOwnPropertyDescriptor: function(_target, prop) {
        var ComponentClass = getLatestComponentClass(normalizedUrl, initialComponent);
        return ComponentClass ? Object.getOwnPropertyDescriptor(ComponentClass, prop) : undefined;
      }
    });
    componentProxies.set(normalizedUrl, proxy);
  }
  return componentProxies.get(normalizedUrl);
}

export function registerComponentInstance(className, instance) {
  if (!componentInstances.has(className)) {
    componentInstances.set(className, new Set());
  }
  componentInstances.get(className).add(instance);
}

export function unregisterComponentInstance(className, instance) {
  var instances = componentInstances.get(className);
  if (instances) {
    instances.delete(instance);
    if (instances.size === 0) {
      componentInstances.delete(className);
    }
  }
}

function reRenderComponent(instance) {
  if (!instance || !instance.element_) return;
  var parent = instance.element_.parentElement;
  if (!parent) return;
  var index = Array.prototype.indexOf.call(parent.children, instance.element_);
  var props = Object.assign({}, instance.props);
  var __stateSnapshot = {};
  var __ownKeys = Object.getOwnPropertyNames(instance);
  for (var __ki = 0; __ki < __ownKeys.length; __ki++) {
    var __k = __ownKeys[__ki];
    if (__k.charAt(0) === '_' || __k === 'props' || __k === 'element_' || __k === 'rendered_' || __k === 'id') continue;
    try { __stateSnapshot[__k] = instance[__k]; } catch(e) {}
  }
  instance.rendered_ = false;
  if (instance.cleanupBindings_) instance.cleanupBindings_();
  if (instance.teardownSelfListeners_) instance.teardownSelfListeners_();
  if (instance.__cleanupCompiledDirectEvents) instance.__cleanupCompiledDirectEvents();
  if (instance.__childComponents && instance.__childComponents.length) {
    instance.__childComponents.forEach(function(child) { if (child && child.dispose) child.dispose(); });
    instance.__childComponents = [];
  }
  if (instance.element_ && instance.element_.parentNode) {
    instance.element_.parentNode.removeChild(instance.element_);
  }
  instance.element_ = null;
  instance.props = props;
  var __restoreKeys = Object.getOwnPropertyNames(__stateSnapshot);
  for (var __ri = 0; __ri < __restoreKeys.length; __ri++) {
    try { instance[__restoreKeys[__ri]] = __stateSnapshot[__restoreKeys[__ri]]; } catch(e) {}
  }
  if (!instance.__bindings) instance.__bindings = [];
  if (!instance.__bindingRemovers) instance.__bindingRemovers = [];
  if (!instance.__selfListeners) instance.__selfListeners = [];
  if (!instance.__childComponents) instance.__childComponents = [];
  instance.render(parent, index);
}

export function handleComponentUpdate(moduleId, newModule) {
  var ComponentClass = newModule.default || newModule;
  if (!ComponentClass || typeof ComponentClass !== 'function') return false;
  var className = ComponentClass.name;
  if (!className) return false;
  var instances = componentInstances.get(className);
  if (!instances || instances.size === 0) return false;
  var newProto = ComponentClass.prototype;
  var instancesArray = Array.from(instances);
  instancesArray.forEach(function(instance) {
    try {
      Object.getOwnPropertyNames(newProto).forEach(function(name) {
        if (name === 'constructor') return;
        var descriptor = Object.getOwnPropertyDescriptor(newProto, name);
        if (!descriptor) return;
        try {
          if (typeof descriptor.value === 'function') {
            instance[name] = descriptor.value.bind(instance);
          } else {
            Object.defineProperty(instance, name, descriptor);
          }
        } catch(e) {}
      });
      try {
        var currentProto = Object.getPrototypeOf(instance);
        if (currentProto !== newProto && currentProto !== Object.prototype) {
          Object.setPrototypeOf(instance, newProto);
        }
      } catch(e) {}
      reRenderComponent(instance);
    } catch(error) {
      console.error('[gea HMR] Error updating ' + className + ':', error);
      if (hot && hot.invalidate) hot.invalidate();
    }
  });
  return true;
}
`

export function geaPlugin(): Plugin {
  const storeModules = new Set<string>()

  const resolveImportPath = (importer: string, source: string): string | null => {
    const base = resolve(dirname(importer), source)
    const candidates = [
      base,
      `${base}.js`,
      `${base}.jsx`,
      `${base}.ts`,
      `${base}.tsx`,
      resolve(base, 'index.js'),
      resolve(base, 'index.jsx'),
      resolve(base, 'index.ts'),
      resolve(base, 'index.tsx'),
    ]

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate
    }

    return null
  }

  const isStoreModule = (filePath: string): boolean => {
    if (storeModules.has(filePath)) return true
    if (!existsSync(filePath)) return false
    try {
      const source = readFileSync(filePath, 'utf8')
      const matchesStore = source.includes('extends Store') || source.includes('new Store(')
      if (matchesStore) storeModules.add(filePath)
      return matchesStore
    } catch {
      return false
    }
  }

  const envPath = existsSync(resolve(pluginDir, 'gea-env.d.ts'))
    ? resolve(pluginDir, 'gea-env.d.ts')
    : resolve(pluginDir, '..', 'gea-env.d.ts')

  return {
    name: 'gea-plugin',
    enforce: 'pre',
    config(config) {
      if (!existsSync(envPath)) return
      const cwd = process.cwd()
      const roots = [cwd, config.root ? resolve(cwd, config.root, '..') : cwd].map((p) => resolve(p))
      for (const projectRoot of [...new Set(roots)]) {
        const tsconfigPath = resolve(projectRoot, 'tsconfig.json')
        if (!existsSync(tsconfigPath)) continue
        const envRelative = relative(resolve(projectRoot), envPath).replace(/\\/g, '/')
        if (envRelative.startsWith('/') || !envRelative) continue
        try {
          const tsconfig = JSON.parse(readFileSync(tsconfigPath, 'utf8'))
          const include = (tsconfig.include as string[] | undefined) || []
          if (include.some((p: string) => p.includes('gea-env.d.ts'))) break
          tsconfig.include = [...include, envRelative]
          writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2))
        } catch {
          /* ignore */
        }
        break
      }
    },
    resolveId(id) {
      if (id === RECONCILE_ID) return RESOLVED_RECONCILE_ID
      if (id === HMR_RUNTIME_ID) return RESOLVED_HMR_RUNTIME_ID
    },
    load(id) {
      if (id === RESOLVED_RECONCILE_ID) return RECONCILE_SOURCE
      if (id === RESOLVED_HMR_RUNTIME_ID) return HMR_RUNTIME_SOURCE
    },
    transform(code, id) {
      const cleanId = id.split('?')[0]
      if (!cleanId.match(/\.(js|jsx|ts|tsx)$/) || cleanId.includes('node_modules')) return null

      if (code.includes('extends Store') || code.includes('new Store(')) {
        storeModules.add(cleanId)
      }

      const hasAngleBrackets = code.includes('<') && code.includes('>')

      if (!hasAngleBrackets) return null

      try {
        const parsed = parseSource(code)
        if (!parsed) return null
        const { functionalComponentInfo, hasJSX } = parsed
        let { ast, componentClassName, imports } = parsed

        if (!hasJSX) return null

        if (functionalComponentInfo) {
          convertFunctionalToClass(ast, functionalComponentInfo, imports)
          componentClassName = functionalComponentInfo.name
          const freshCode = generate(ast, { retainLines: true }).code
          const freshParsed = parseSource(freshCode)
          if (freshParsed) {
            ast = freshParsed.ast
            imports = freshParsed.imports
          }
        }

        let transformed = false
        const componentImportSet = new Set<string>()
        const componentImportsUsedAsTags = new Set<string>()
        let isDefaultExport = false

        imports.forEach((source) => {
          if (!source.startsWith('.')) return
          componentImportSet.add(source)
        })
        const componentImports = Array.from(componentImportSet)

        const storeImports = new Map<string, string>()
        traverse(ast, {
          ExportDefaultDeclaration() {
            isDefaultExport = true
          },
          ImportDeclaration(path) {
            const source = path.node.source.value
            if (!source.startsWith('.')) return
            const resolvedImport = resolveImportPath(cleanId, source)
            path.node.specifiers.forEach(
              (spec: { type: string; imported?: { name?: string }; local: { name: string } }) => {
                if (spec.type === 'ImportDefaultSpecifier') {
                  if (resolvedImport && !isStoreModule(resolvedImport)) return
                  storeImports.set(spec.local.name, source)
                }
              },
            )
          },
        })

        if (hasJSX) {
          const originalAST = parseSource(code)!.ast
          if (componentClassName) {
            transformed = transformComponentFile(
              ast,
              imports,
              storeImports,
              componentClassName,
              cleanId,
              originalAST,
              componentImportsUsedAsTags,
            )
          } else {
            transformed = transformNonComponentJSX(ast, imports)
          }
        }

        const hmrAdded = injectHMR(
          ast,
          componentClassName,
          componentImports,
          componentImportsUsedAsTags,
          isDefaultExport,
          HMR_RUNTIME_ID,
        )
        if (hmrAdded) transformed = true

        if (!transformed) return null
        const output = generate(ast, { sourceMaps: true, sourceFileName: cleanId }, code)
        return { code: output.code, map: output.map }
      } catch (error: any) {
        if (error?.__geaCompileError) {
          throw error
        }
        console.warn(`[gea-plugin] Failed to transform ${cleanId}:`, error.message)
        return null
      }
    },
  }
}
