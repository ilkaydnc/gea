import * as fs from 'fs'
import * as path from 'path'

export interface ComponentInfo {
  name: string
  tagName: string
  description?: string
  props?: string[]
  filePath?: string
}

export class ComponentDiscovery {
  private components: Map<string, ComponentInfo> = new Map()

  scanWorkspace(): void {
    // This would be called with workspace folders from LSP
    // For now, we'll discover components on-demand from open files
  }

  discoverComponentsInFile(text: string, uri: string): ComponentInfo[] {
    const components: ComponentInfo[] = []
    const filePath = uri.startsWith('file://') ? uri.substring(7) : uri

    const discovered = new Map<string, ComponentInfo>()
    this.discoverClassComponents(text, filePath, discovered)
    this.discoverFunctionComponents(text, filePath, discovered)

    components.push(...discovered.values())

    return components
  }

  addComponents(components: ComponentInfo[]): void {
    for (const comp of components) {
      // Store by tagName (kebab-case)
      this.components.set(comp.tagName, comp)
      // Store by lowercase name
      this.components.set(comp.name.toLowerCase(), comp)
      // Store by exact name (PascalCase)
      this.components.set(comp.name, comp)
    }
  }

  getAllComponents(): ComponentInfo[] {
    // Use a Set to avoid duplicates (same component stored under multiple keys)
    const uniqueComponents = new Map<string, ComponentInfo>()
    for (const comp of this.components.values()) {
      uniqueComponents.set(comp.name, comp)
    }
    return Array.from(uniqueComponents.values())
  }

  getComponent(tagName: string): ComponentInfo | undefined {
    return (
      this.components.get(tagName) ||
      this.components.get(tagName.toLowerCase()) ||
      this.components.get(this.toPascalCase(tagName))
    )
  }

  discoverImportedComponents(text: string, currentUri: string): ComponentInfo[] {
    const components: ComponentInfo[] = []
    let filePath = currentUri.startsWith('file://') ? currentUri.substring(7) : currentUri
    if (filePath.startsWith('/') && process.platform !== 'win32') {
      // Unix path, no transform needed
    } else if (filePath.match(/^\/[A-Z]:/i)) {
      filePath = filePath.substring(1)
    }
    const dir = path.dirname(filePath)

    const defaultImportRegex = /import\s+(\w+)\s+from\s+['"]([^'"]+)['"]/g
    let match

    while ((match = defaultImportRegex.exec(text)) !== null) {
      const importPath = match[2]

      if (!importPath || (!importPath.startsWith('.') && !importPath.startsWith('/'))) {
        continue
      }

      try {
        const resolvedPath = this.resolveImportPath(dir, importPath)

        if (!resolvedPath || !fs.existsSync(resolvedPath)) {
          continue
        }

        const importedText = fs.readFileSync(resolvedPath, 'utf-8')
        const importedComponents = this.discoverComponentsInFile(importedText, `file://${resolvedPath}`)

        if (importedComponents.length > 0) {
          components.push(...importedComponents)
        }
      } catch (error) {
        if (error instanceof Error) {
          if (!error.message.includes('ENOENT')) {
            console.error(`Error discovering components from ${importPath}:`, error.message)
          }
        }
        continue
      }
    }

    return components
  }

  private toPascalCase(str: string): string {
    return str
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('')
  }

  private discoverClassComponents(text: string, filePath: string, discovered: Map<string, ComponentInfo>): void {
    const classRegex = /export\s+(default\s+)?class\s+(\w+)\s+extends\s+Component\b/g
    let match: RegExpExecArray | null

    while ((match = classRegex.exec(text)) !== null) {
      const className = match[2]
      const classStart = match.index
      const classBody = text.slice(classStart)
      const props = this.extractTemplateProps(classBody)
      const description = this.extractDescription(text, className)

      this.addDiscoveredComponent(discovered, {
        name: className,
        tagName: this.toTagName(className),
        description,
        props,
        filePath,
      })
    }
  }

  private discoverFunctionComponents(text: string, filePath: string, discovered: Map<string, ComponentInfo>): void {
    const functionRegex = /export\s+(default\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g
    let match: RegExpExecArray | null

    while ((match = functionRegex.exec(text)) !== null) {
      const name = match[2]
      const params = match[3]
      const functionStart = match.index
      const functionBody = text.slice(functionStart)
      const description = this.extractDescription(text, name)
      const props = this.extractFunctionProps(params, functionBody)

      this.addDiscoveredComponent(discovered, {
        name,
        tagName: this.toTagName(name),
        description,
        props,
        filePath,
      })
    }
  }

  private addDiscoveredComponent(discovered: Map<string, ComponentInfo>, component: ComponentInfo): void {
    discovered.set(component.name, {
      ...component,
      props: component.props?.length ? component.props : undefined,
    })
  }

  private toTagName(name: string): string {
    return name
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase()
  }

  private extractTemplateProps(classBody: string): string[] {
    const templateParamRegex = /template\s*\(\s*([^)]*)\)/m
    const match = classBody.match(templateParamRegex)
    if (!match) return []

    return this.extractPropsFromParameter(match[1], classBody)
  }

  private extractFunctionProps(params: string, functionBody: string): string[] {
    const directProps = this.extractPropsFromParameter(params, functionBody)
    if (directProps.length > 0) {
      return directProps
    }

    const trimmedParams = params.trim()
    if (!trimmedParams || !/^[A-Za-z_$][\w$]*$/.test(trimmedParams)) {
      return []
    }

    return this.extractPropsDestructuredFromIdentifier(functionBody, trimmedParams)
  }

  private extractPropsFromParameter(paramSource: string, functionBody: string): string[] {
    const trimmed = paramSource.trim()
    if (!trimmed) return []

    if (trimmed.startsWith('{')) {
      return this.extractObjectPatternProps(trimmed)
    }

    if (/^[A-Za-z_$][\w$]*$/.test(trimmed)) {
      return this.extractPropsDestructuredFromIdentifier(functionBody, trimmed)
    }

    return []
  }

  private extractPropsDestructuredFromIdentifier(functionBody: string, identifier: string): string[] {
    const destructureRegex = new RegExp(`const\\s*\\{([\\s\\S]*?)\\}\\s*=\\s*${identifier}\\s*[;\\n]`, 'm')
    const match = functionBody.match(destructureRegex)
    if (!match) return []

    return this.extractObjectPatternProps(`{${match[1]}}`)
  }

  private extractObjectPatternProps(patternSource: string): string[] {
    const normalized = patternSource.trim()
    if (!normalized.startsWith('{') || !normalized.endsWith('}')) {
      return []
    }

    const inner = normalized.slice(1, -1)
    const segments = this.splitTopLevel(inner)
    const props: string[] = []

    for (const segment of segments) {
      const candidate = segment.trim()
      if (!candidate || candidate.startsWith('...')) {
        continue
      }

      const name = this.extractPropName(candidate)
      if (name && !props.includes(name)) {
        props.push(name)
      }
    }

    return props
  }

  private splitTopLevel(source: string): string[] {
    const segments: string[] = []
    let current = ''
    let braceDepth = 0
    let bracketDepth = 0
    let parenDepth = 0
    let quote: '"' | "'" | '`' | null = null

    for (let i = 0; i < source.length; i++) {
      const char = source[i]
      const prev = source[i - 1]

      if (quote) {
        current += char
        if (char === quote && prev !== '\\') {
          quote = null
        }
        continue
      }

      if (char === '"' || char === "'" || char === '`') {
        quote = char
        current += char
        continue
      }

      if (char === '{') braceDepth++
      if (char === '}') braceDepth--
      if (char === '[') bracketDepth++
      if (char === ']') bracketDepth--
      if (char === '(') parenDepth++
      if (char === ')') parenDepth--

      if (char === ',' && braceDepth === 0 && bracketDepth === 0 && parenDepth === 0) {
        segments.push(current)
        current = ''
        continue
      }

      current += char
    }

    if (current.trim()) {
      segments.push(current)
    }

    return segments
  }

  private extractPropName(segment: string): string | null {
    const cleaned = segment.trim()
    if (!cleaned) return null

    const withoutDefault = cleaned.split('=').shift()?.trim() ?? cleaned
    const namePart = withoutDefault.split(':').shift()?.trim() ?? withoutDefault
    const match = namePart.match(/^[A-Za-z_$][\w$]*/)
    return match ? match[0] : null
  }

  private resolveImportPath(dir: string, importPath: string): string | null {
    if (importPath.startsWith('/')) {
      return importPath
    }

    const resolvedBase = path.resolve(dir, importPath)
    const candidates = [
      resolvedBase,
      `${resolvedBase}.js`,
      `${resolvedBase}.jsx`,
      `${resolvedBase}.ts`,
      `${resolvedBase}.tsx`,
      path.join(resolvedBase, 'index.js'),
      path.join(resolvedBase, 'index.jsx'),
      path.join(resolvedBase, 'index.ts'),
      path.join(resolvedBase, 'index.tsx'),
    ]

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate
      }
    }

    return null
  }

  private extractDescription(text: string, className: string): string | undefined {
    // Look for JSDoc comment before the class
    const classIndex = text.indexOf(`class ${className}`)
    if (classIndex === -1) return undefined

    // Look backwards for JSDoc
    const beforeClass = text.substring(Math.max(0, classIndex - 500), classIndex)
    const jsdocMatch = beforeClass.match(/\*\s*([^\n]+)/)

    if (jsdocMatch) {
      return jsdocMatch[1].trim()
    }

    return undefined
  }
}
