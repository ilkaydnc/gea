import {
  CompletionItem,
  CompletionItemKind,
  createConnection,
  Diagnostic,
  DiagnosticSeverity,
  DidChangeConfigurationNotification,
  Hover,
  InitializeParams,
  InitializeResult,
  MarkupKind,
  ProposedFeatures,
  Range,
  TextDocumentPositionParams,
  TextDocumentSyncKind,
  TextDocuments,
} from 'vscode-languageserver/node'
import { TextDocument } from 'vscode-languageserver-textdocument'
import { ComponentDiscovery, type ComponentInfo } from './component-discovery'

interface LanguageServerSettings {
  languageServer?: {
    enable?: boolean
  }
}

interface OpenTagContext {
  start: number
  end: number
  source: string
  sourceBeforeCursor: string
  tagName: string
}

const connection = createConnection(ProposedFeatures.all)
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument)

let hasConfigurationCapability = false
let hasWorkspaceFolderCapability = false

const componentDiscovery = new ComponentDiscovery()

const BUILTIN_COMPONENTS: ComponentInfo[] = [
  { name: 'view', tagName: 'view', description: 'Base view component' },
  { name: 'sidebar', tagName: 'sidebar', description: 'Sidebar navigation component' },
  { name: 'tab-view', tagName: 'tab-view', description: 'Tab view component' },
  { name: 'navbar', tagName: 'navbar', description: 'Navigation bar component' },
  { name: 'pull-to-refresh', tagName: 'pull-to-refresh', description: 'Pull to refresh component' },
  { name: 'infinite-scroll', tagName: 'infinite-scroll', description: 'Infinite scroll component' },
]

const EVENT_TYPES = [
  'blur',
  'change',
  'click',
  'dblclick',
  'focus',
  'input',
  'keydown',
  'keypress',
  'keyup',
  'mousedown',
  'mousemove',
  'mouseout',
  'mouseover',
  'mouseup',
  'scroll',
  'submit',
  'touchend',
  'touchmove',
  'touchstart',
]

const COMMON_COMPONENT_PROPS = ['key', 'class', 'className', 'style', 'id']

const HTML_ELEMENTS = new Set([
  'a',
  'article',
  'aside',
  'blockquote',
  'br',
  'button',
  'code',
  'dd',
  'div',
  'dl',
  'dt',
  'em',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'img',
  'input',
  'label',
  'li',
  'main',
  'nav',
  'ol',
  'option',
  'p',
  'pre',
  'section',
  'select',
  'span',
  'strong',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])

connection.onInitialize((params: InitializeParams) => {
  const capabilities = params.capabilities

  hasConfigurationCapability = !!capabilities.workspace?.configuration
  hasWorkspaceFolderCapability = !!capabilities.workspace?.workspaceFolders

  const result: InitializeResult = {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: false,
        triggerCharacters: ['<', ' '],
      },
      hoverProvider: true,
    },
  }

  if (hasWorkspaceFolderCapability) {
    result.capabilities.workspace = {
      workspaceFolders: {
        supported: true,
      },
    }
  }

  return result
})

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(DidChangeConfigurationNotification.type, undefined)
  }

  if (hasWorkspaceFolderCapability) {
    connection.workspace.onDidChangeWorkspaceFolders(() => {
      componentDiscovery.scanWorkspace()
    })
  }

  componentDiscovery.scanWorkspace()
})

const documentSettings: Map<string, Thenable<LanguageServerSettings>> = new Map()

connection.onDidChangeConfiguration(() => {
  if (hasConfigurationCapability) {
    documentSettings.clear()
  }
  componentDiscovery.scanWorkspace()
})

function getDocumentSettings(resource: string): Thenable<LanguageServerSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve({})
  }

  let result = documentSettings.get(resource)
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: 'gea',
    }) as Thenable<LanguageServerSettings>
    documentSettings.set(resource, result)
  }

  return result
}

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri)
})

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri)
  if (settings.languageServer?.enable === false) {
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] })
    return
  }

  const text = textDocument.getText()
  const components = getAllComponents(text, textDocument.uri)
  const diagnostics: Diagnostic[] = []

  for (const tag of findJSXTags(text)) {
    if (!shouldValidateTag(tag.name)) {
      continue
    }

    const component = findComponent(components, tag.name)
    if (!component) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: Range.create(textDocument.positionAt(tag.start), textDocument.positionAt(tag.end)),
        message: `Unknown component: ${tag.name}`,
        source: 'gea',
      })
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics })
}

function getAllComponents(text: string, uri: string): ComponentInfo[] {
  const fileComponents = componentDiscovery.discoverComponentsInFile(text, uri)
  componentDiscovery.addComponents(fileComponents)

  const importedComponents = componentDiscovery.discoverImportedComponents(text, uri)
  componentDiscovery.addComponents(importedComponents)

  const unique = new Map<string, ComponentInfo>()
  for (const component of [
    ...BUILTIN_COMPONENTS,
    ...componentDiscovery.getAllComponents(),
    ...fileComponents,
    ...importedComponents,
  ]) {
    unique.set(component.name, component)
  }

  return Array.from(unique.values())
}

function shouldValidateTag(tagName: string): boolean {
  if (HTML_ELEMENTS.has(tagName.toLowerCase())) {
    return false
  }

  return /^[A-Z]/.test(tagName) || tagName.includes('-')
}

function findJSXTags(text: string): Array<{ name: string; start: number; end: number }> {
  const tags: Array<{ name: string; start: number; end: number }> = []
  const tagRegex = /<(?!\/)([A-Za-z][\w-]*)\b/g
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(text)) !== null) {
    tags.push({
      name: match[1],
      start: match.index + 1,
      end: match.index + 1 + match[1].length,
    })
  }

  return tags
}

function findComponent(components: ComponentInfo[], tagName: string): ComponentInfo | undefined {
  const lowerName = tagName.toLowerCase()
  return components.find(
    (component) =>
      component.name === tagName || component.name.toLowerCase() === lowerName || component.tagName === lowerName,
  )
}

function getOpenTagContext(text: string, offset: number): OpenTagContext | null {
  const tagStart = text.lastIndexOf('<', offset)
  if (tagStart === -1) {
    return null
  }

  const lastClose = text.lastIndexOf('>', offset)
  if (lastClose > tagStart) {
    return null
  }

  const tagEnd = findTagEnd(text, tagStart)
  if (tagEnd === -1 || offset > tagEnd) {
    return null
  }

  const source = text.slice(tagStart, tagEnd + 1)
  if (source.startsWith('</') || source.startsWith('<!')) {
    return null
  }

  const tagMatch = source.match(/^<([A-Za-z][\w-]*)/)
  if (!tagMatch) {
    return null
  }

  return {
    start: tagStart,
    end: tagEnd,
    source,
    sourceBeforeCursor: text.slice(tagStart, offset),
    tagName: tagMatch[1],
  }
}

function findTagEnd(text: string, start: number): number {
  let quote: '"' | "'" | '`' | null = null
  let braceDepth = 0

  for (let i = start; i < text.length; i++) {
    const char = text[i]
    const prev = text[i - 1]

    if (quote) {
      if (char === quote && prev !== '\\') {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') {
      braceDepth++
      continue
    }

    if (char === '}') {
      braceDepth = Math.max(0, braceDepth - 1)
      continue
    }

    if (char === '>' && braceDepth === 0) {
      return i
    }
  }

  return -1
}

function isComponentNameCompletion(context: OpenTagContext): boolean {
  return /^<[A-Za-z][\w-]*$/.test(context.sourceBeforeCursor.trim())
}

function getAttributeQuery(context: OpenTagContext): string | null {
  const fragment = context.sourceBeforeCursor.replace(/^<[A-Za-z][\w-]*/, '')
  if (!fragment.trim()) {
    return ''
  }

  let quote: '"' | "'" | '`' | null = null
  let braceDepth = 0

  for (let i = 0; i < fragment.length; i++) {
    const char = fragment[i]
    const prev = fragment[i - 1]

    if (quote) {
      if (char === quote && prev !== '\\') {
        quote = null
      }
      continue
    }

    if (char === '"' || char === "'" || char === '`') {
      quote = char
      continue
    }

    if (char === '{') braceDepth++
    if (char === '}') braceDepth = Math.max(0, braceDepth - 1)
  }

  if (quote || braceDepth > 0) {
    return null
  }

  const attrMatch = fragment.match(/(?:^|\s)([A-Za-z][\w-]*)?$/)
  return attrMatch ? (attrMatch[1] ?? '') : null
}

function buildComponentCompletion(component: ComponentInfo): CompletionItem[] {
  const labels = new Set<string>([component.name, component.tagName])
  const items: CompletionItem[] = []

  for (const label of labels) {
    items.push({
      label,
      kind: CompletionItemKind.Class,
      detail: component.description || `Gea component: ${component.name}`,
      documentation: buildComponentDocumentation(component),
    })
  }

  return items
}

function buildComponentDocumentation(component: ComponentInfo): string {
  const propLines = component.props?.length ? `\n\nProps: ${component.props.join(', ')}` : ''
  const description = component.description || 'Gea component'
  return `${description}${propLines}`
}

function buildPropCompletion(propName: string, component: ComponentInfo): CompletionItem {
  return {
    label: propName,
    kind: CompletionItemKind.Property,
    detail: `${component.name} prop`,
    documentation: `Prop from ${component.name}`,
  }
}

function buildEventCompletion(eventName: string): CompletionItem {
  return {
    label: eventName,
    kind: CompletionItemKind.Event,
    detail: 'Gea JSX event',
    documentation: `Attach a ${eventName} handler in Gea JSX`,
  }
}

connection.onCompletion((params: TextDocumentPositionParams): CompletionItem[] => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return []
  }

  const text = document.getText()
  const offset = document.offsetAt(params.position)
  const context = getOpenTagContext(text, offset)
  if (!context) {
    return []
  }

  const components = getAllComponents(text, document.uri)
  if (isComponentNameCompletion(context)) {
    return components.flatMap(buildComponentCompletion)
  }

  const attrQuery = getAttributeQuery(context)
  if (attrQuery === null) {
    return []
  }

  const results: CompletionItem[] = []
  const component = findComponent(components, context.tagName)

  if (component) {
    const seenProps = new Set<string>()
    for (const propName of [...COMMON_COMPONENT_PROPS, ...(component.props ?? [])]) {
      if (!seenProps.has(propName) && propName.startsWith(attrQuery)) {
        seenProps.add(propName)
        results.push(buildPropCompletion(propName, component))
      }
    }
  }

  for (const eventName of EVENT_TYPES) {
    if (eventName.startsWith(attrQuery)) {
      results.push(buildEventCompletion(eventName))
    }
  }

  return results
})

connection.onRequest('textDocument/diagnostic', () => {
  return { items: [] }
})

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const document = documents.get(params.textDocument.uri)
  if (!document) {
    return null
  }

  const text = document.getText()
  const offset = document.offsetAt(params.position)
  const context = getOpenTagContext(text, offset)
  if (!context) {
    return null
  }

  const components = getAllComponents(text, document.uri)
  const tagNameStart = context.start + 1
  const tagNameEnd = tagNameStart + context.tagName.length

  if (offset >= tagNameStart && offset <= tagNameEnd) {
    const component = findComponent(components, context.tagName)
    if (!component) {
      return null
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: `**${component.name}**\n\n${buildComponentDocumentation(component)}`,
      },
    }
  }

  const attrRegex = /([A-Za-z][\w-]*)\s*=/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(context.source)) !== null) {
    const attrName = match[1]
    const attrStart = context.start + match.index
    const attrEnd = attrStart + attrName.length

    if (offset < attrStart || offset > attrEnd) {
      continue
    }

    if (EVENT_TYPES.includes(attrName)) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${attrName}**\n\nGea JSX event handler.`,
        },
      }
    }

    const component = findComponent(components, context.tagName)
    if (component && (component.props?.includes(attrName) || COMMON_COMPONENT_PROPS.includes(attrName))) {
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${attrName}**\n\nProp on \`${component.name}\`.`,
        },
      }
    }
  }

  return null
})

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document)
})

documents.onDidOpen((change) => {
  validateTextDocument(change.document)
})

documents.listen(connection)
connection.listen()
