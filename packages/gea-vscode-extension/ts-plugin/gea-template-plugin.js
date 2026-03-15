/* Gea JSX TS plugin: suppress TS6133 for imports used as JSX tags,
 * and suppress JSX errors in Gea component bodies.
 *
 * This plugin scans source files for component-like tags,
 * then filters out the TypeScript 'unused local' diagnostic (6133) for default
 * imports whose names match those tags (case-insensitive, kebab→Pascal supported).
 * It also suppresses JSX validation errors (like TS2657) that occur inside
 * class `template()` methods and function components that return Gea JSX.
 */

function create(info) {
  // Log via TypeScript server's logger - this appears in VS Code's TypeScript output panel
  let logger = null
  try {
    if (info && info.project && info.project.projectService) {
      logger = info.project.projectService.logger
      if (logger) {
        logger.info('[gea-template-plugin] ✓ Plugin loaded')
      }
    }
  } catch {
    // Ignore logging issues - plugin should continue working
  }

  // Verify we have the required info
  if (!info || !info.typescript || !info.languageService) {
    // Return a no-op proxy if we don't have what we need
    return info && info.languageService ? info.languageService : {}
  }

  const ts = info.typescript
  const languageService = info.languageService

  const originalGetSemanticDiagnostics = languageService.getSemanticDiagnostics.bind(languageService)
  const originalGetSyntacticDiagnostics =
    languageService.getSyntacticDiagnostics && languageService.getSyntacticDiagnostics.bind(languageService)

  function toPascalFromKebab(name) {
    if (!name.includes('-')) return name
    return name
      .split('-')
      .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ''))
      .join('')
  }

  function collectTagNamesFromText(text) {
    // Heuristic: collect tag names inside any backtick template or the whole file.
    // We keep it simple and over-approximate: any <Tag or <tag is a candidate.
    const tags = new Set()
    const tagRegex = /<\s*\/?\s*([A-Za-z][\w-]*)/g
    let m
    while ((m = tagRegex.exec(text)) !== null) {
      const raw = m[1]
      tags.add(raw)
      tags.add(raw.toLowerCase())
      if (raw.includes('-')) {
        tags.add(toPascalFromKebab(raw))
      } else {
        // Also add PascalCase variation
        tags.add(raw[0].toUpperCase() + raw.slice(1))
      }
    }
    return tags
  }

  function collectDefaultImports(sourceFile) {
    const imports = []
    function visit(node) {
      if (ts.isImportDeclaration(node) && node.importClause && node.importClause.name) {
        const name = node.importClause.name.text
        const start = node.getStart(sourceFile)
        const end = node.getEnd()
        // Only add if we have valid positions
        if (typeof start === 'number' && typeof end === 'number' && !isNaN(start) && !isNaN(end)) {
          imports.push({
            name,
            start,
            end,
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sourceFile)
    return imports
  }

  function functionBodyContainsJSX(body, sourceFile) {
    if (!body) return false

    const text = body.getText(sourceFile)
    return text.includes('<') && text.includes('>')
  }

  function findRelevantJSXSpans(sourceFile) {
    const spans = []

    function visit(node) {
      if (ts.isMethodDeclaration(node)) {
        const name = node.name
        if (name && ts.isIdentifier(name) && name.text === 'template') {
          const body = node.body
          if (body) {
            const start = body.getStart(sourceFile)
            const end = body.getEnd()
            if (typeof start === 'number' && typeof end === 'number' && !isNaN(start) && !isNaN(end)) {
              spans.push({ start, end })
              try {
                if (logger) {
                  logger.info(`[gea-template-plugin] Found template() method body at ${start}-${end}`)
                }
              } catch {
                /* logger may throw */
              }
            }
          }
        }
      }

      if (
        (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) &&
        functionBodyContainsJSX(node.body, sourceFile)
      ) {
        const body = node.body
        const start = body.getStart(sourceFile)
        const end = body.getEnd()
        if (typeof start === 'number' && typeof end === 'number' && !isNaN(start) && !isNaN(end)) {
          spans.push({ start, end })
          try {
            if (logger) {
              logger.info(`[gea-template-plugin] Found JSX function body at ${start}-${end}`)
            }
          } catch {
            /* logger may throw */
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return spans
  }

  function isInRelevantSpan(diagStart, spans) {
    if (typeof diagStart !== 'number' || !Number.isFinite(diagStart)) {
      return false
    }
    for (const span of spans) {
      if (
        span &&
        typeof span.start === 'number' &&
        typeof span.end === 'number' &&
        Number.isFinite(span.start) &&
        Number.isFinite(span.end) &&
        span.start >= 0 &&
        span.end >= 0 &&
        diagStart >= span.start &&
        diagStart < span.end
      ) {
        return true
      }
    }
    return false
  }

  function isJSXError(diag) {
    if (!diag || !diag.code) return false

    // Common JSX error codes
    const jsxErrorCodes = [
      2657, // JSX expressions must have one parent element
      17004, // JSX element implicitly has type 'any'
      2604, // JSX element type does not have any construct or call signatures
      2605, // JSX element type is not a constructor function type
      2606, // JSX element type is not a constructor function type
      2607, // JSX element class does not support attributes
      2608, // JSX element class does not support children
      2609, // JSX element type does not support attributes
      2610, // JSX element type does not support children
      2611, // JSX element type does not support attributes or children
    ]

    const code = typeof diag.code === 'string' ? parseInt(diag.code) : diag.code
    if (jsxErrorCodes.includes(code)) {
      return true
    }

    // Also check error message for JSX-related text
    const message = diag.messageText
    if (typeof message === 'string') {
      const lowerMessage = message.toLowerCase()
      if (
        lowerMessage.includes('jsx') ||
        lowerMessage.includes('jsx expressions must have one parent') ||
        lowerMessage.includes('jsx element')
      ) {
        return true
      }
    } else if (message && typeof message === 'object' && 'messageText' in message) {
      const messageText = String(message.messageText).toLowerCase()
      if (
        messageText.includes('jsx') ||
        messageText.includes('jsx expressions must have one parent') ||
        messageText.includes('jsx element')
      ) {
        return true
      }
    }

    return false
  }

  function filterDiagnostics(diags, fileName) {
    if (!Array.isArray(diags)) {
      return diags
    }

    try {
      const program = languageService.getProgram && languageService.getProgram()
      const sourceFile = program && program.getSourceFile(fileName)
      if (!sourceFile) return diags

      const fileText = sourceFile.getFullText()
      if (fileText.indexOf('<') === -1) return diags

      const tagNames = collectTagNamesFromText(fileText)
      const defaultImports = collectDefaultImports(sourceFile)
      const jsxSpans = findRelevantJSXSpans(sourceFile)

      // If no JSX spans and no imports to check, return early
      if (tagNames.size === 0 && defaultImports.length === 0 && jsxSpans.length === 0) {
        return diags
      }

      try {
        if (logger) {
          logger.info(
            `[gea-template-plugin] Default imports in ${fileName}: ${defaultImports
              .map((imp) => `${imp.name}@${imp.start}-${imp.end}`)
              .join(', ')}`,
          )
        }
      } catch {
        /* logger may throw */
      }

      const usedImportSpans = []
      for (const imp of defaultImports) {
        const lower = imp.name.toLowerCase()
        const pascal = toPascalFromKebab(lower)
        if (
          tagNames.has(imp.name) ||
          tagNames.has(lower) ||
          tagNames.has(imp.name[0].toUpperCase() + imp.name.slice(1)) ||
          tagNames.has(pascal) ||
          tagNames.has(pascal.toLowerCase())
        ) {
          usedImportSpans.push({ start: imp.start, end: imp.end, name: imp.name })
        }
      }

      try {
        if (logger) {
          logger.info(
            `[gea-template-plugin] Used import spans in ${fileName}: ${usedImportSpans
              .map((span) => `${span.name}@${span.start}-${span.end}`)
              .join(', ')}`,
          )
        }
      } catch {
        /* logger may throw */
      }

      const result = []
      for (const diag of diags) {
        let shouldSuppress = false

        // Suppress unused import warnings (TS6133) for imports used in templates
        if (diag && diag.code === 6133 && typeof diag.start === 'number' && Number.isFinite(diag.start)) {
          for (const span of usedImportSpans) {
            if (
              span &&
              typeof span.start === 'number' &&
              typeof span.end === 'number' &&
              Number.isFinite(span.start) &&
              Number.isFinite(span.end) &&
              span.start >= 0 &&
              span.end >= 0 &&
              diag.start >= span.start &&
              diag.start < span.end
            ) {
              shouldSuppress = true
              try {
                if (logger) {
                  logger.info(`[gea-template-plugin] Suppressed TS6133 for ${span.name} in ${fileName}`)
                }
              } catch {
                /* logger may throw */
              }
              break
            }
          }
        }

        // Suppress JSX errors in Gea component bodies.
        if (!shouldSuppress && isJSXError(diag)) {
          const inRelevantSpan = isInRelevantSpan(diag.start, jsxSpans)
          if (inRelevantSpan || jsxSpans.length > 0) {
            shouldSuppress = true
            try {
              if (logger) {
                if (inRelevantSpan) {
                  logger.info(
                    `[gea-template-plugin] Suppressed JSX error (code ${diag.code}) at position ${diag.start} in Gea JSX body in ${fileName}`,
                  )
                } else {
                  logger.info(
                    `[gea-template-plugin] Suppressed JSX error (code ${diag.code}) at position ${diag.start} (Gea JSX body exists in file) in ${fileName}`,
                  )
                }
              }
            } catch {
              /* logger may throw */
            }
          } else {
            try {
              if (logger) {
                logger.info(
                  `[gea-template-plugin] JSX error (code ${diag.code}) at position ${
                    diag.start
                  } NOT suppressed. JSX spans: ${jsxSpans.map((s) => `${s.start}-${s.end}`).join(', ')}`,
                )
              }
            } catch {
              /* logger may throw */
            }
          }
        }

        if (shouldSuppress) {
          continue
        }

        if (diag && diag.code === 6133) {
          try {
            if (logger) {
              logger.info(`[gea-template-plugin] Keeping TS6133 at ${diag.start ?? 'unknown'}`)
            }
          } catch {
            /* logger may throw */
          }
        }
        result.push(diag)
      }

      return result
    } catch {
      return diags
    }
  }

  function getSemanticDiagnostics(fileName) {
    const diags = originalGetSemanticDiagnostics(fileName)
    return filterDiagnostics(diags, fileName)
  }

  function getSyntacticDiagnostics(fileName) {
    if (!originalGetSyntacticDiagnostics) {
      return languageService.getSyntacticDiagnostics(fileName)
    }
    const diags = originalGetSyntacticDiagnostics(fileName)
    return filterDiagnostics(diags, fileName)
  }

  // Create a proxy around the language service
  const proxy = Object.create(null)
  for (const k of Object.keys(languageService)) {
    proxy[k] = languageService[k]
  }
  proxy.getSemanticDiagnostics = getSemanticDiagnostics
  if (originalGetSyntacticDiagnostics) {
    proxy.getSyntacticDiagnostics = getSyntacticDiagnostics
  }
  return proxy
}

module.exports = { create }
