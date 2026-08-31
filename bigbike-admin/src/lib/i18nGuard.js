import { parse } from '@babel/parser'

const SOURCE_EXTENSIONS = /\.(?:js|jsx|ts|tsx)$/
const TRANSLATION_KEY_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*(?:[._][A-Za-z0-9_*-]+)+$/

function unique(values) {
  return [...new Set(values)]
}

export function collectLocaleKeys(value, prefix = '') {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return prefix ? [prefix] : []
  }

  return Object.entries(value).flatMap(([key, child]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key
    return collectLocaleKeys(child, fullKey)
  })
}

export function compareLocaleKeys(vi, en) {
  const viKeys = new Set(collectLocaleKeys(vi))
  const enKeys = new Set(collectLocaleKeys(en))
  return {
    viKeys,
    enKeys,
    missingInVi: [...enKeys].filter((key) => !viKeys.has(key)),
    missingInEn: [...viKeys].filter((key) => !enKeys.has(key)),
  }
}

function unwrap(node) {
  if (!node) return node
  if (
    node.type === 'TSAsExpression' ||
    node.type === 'TSTypeAssertion' ||
    node.type === 'TypeCastExpression'
  ) {
    return unwrap(node.expression)
  }
  return node
}

function propertyName(node) {
  const value = unwrap(node)
  if (!value) return null
  if (value.type === 'Identifier' && !value.computed) return value.name
  if (value.type === 'StringLiteral' || value.type === 'NumericLiteral') return String(value.value)
  return null
}

function objectPropertyName(node) {
  if (!node || node.type !== 'ObjectProperty' || node.computed) return null
  return propertyName(node.key)
}

function isTranslationCall(node) {
  const callee = unwrap(node?.callee)
  return Boolean(
    callee &&
    ((callee.type === 'Identifier' && callee.name === 't') ||
      ((callee.type === 'MemberExpression' || callee.type === 'OptionalMemberExpression') &&
        !callee.computed &&
        propertyName(callee.property) === 't')),
  )
}

function getDefaultValue(call) {
  const options = unwrap(call.arguments?.[1])
  if (!options) return null
  if (options.type === 'StringLiteral' || options.type === 'TemplateLiteral') return options
  if (options.type !== 'ObjectExpression') return options
  const property = options.properties.find((item) => {
    if (item.type !== 'ObjectProperty' || item.computed) return false
    return objectPropertyName(item) === 'defaultValue'
  })
  return property ? unwrap(property.value) : null
}

function walkAst(root, visit) {
  if (!root || typeof root !== 'object') return
  const seen = new WeakSet()
  const stack = [root]
  while (stack.length) {
    const node = stack.pop()
    if (!node || typeof node !== 'object' || seen.has(node)) continue
    seen.add(node)
    visit(node)
    for (const [key, value] of Object.entries(node)) {
      if (
        key === 'loc' ||
        key === 'start' ||
        key === 'end' ||
        key === 'comments' ||
        key === 'tokens'
      )
        continue
      if (Array.isArray(value)) {
        value
          .slice()
          .reverse()
          .forEach((child) => stack.push(child))
      } else if (value && typeof value === 'object' && value.type) {
        stack.push(value)
      }
    }
  }
}

function parseSource(source) {
  return parse(source.code, {
    sourceType: 'module',
    plugins: [
      'jsx',
      'typescript',
      'decorators-legacy',
      'classProperties',
      'objectRestSpread',
      'optionalChaining',
      'topLevelAwait',
    ],
  })
}

function result(patterns = [], opaque = false) {
  return { patterns: unique(patterns.filter(Boolean)), opaque }
}

function combineResults(results) {
  return result(
    results.flatMap((item) => item.patterns),
    results.some((item) => item.opaque),
  )
}

function combineParts(left, right) {
  const patterns = []
  if (left.patterns.length && right.patterns.length) {
    for (const leftPattern of left.patterns) {
      for (const rightPattern of right.patterns) patterns.push(`${leftPattern}${rightPattern}`)
    }
  } else if (left.patterns.length && right.opaque) {
    patterns.push(...left.patterns.map((pattern) => `${pattern}*`))
  } else if (left.opaque && right.patterns.length) {
    patterns.push(...right.patterns.map((pattern) => `*${pattern}`))
  }
  return result(patterns, left.opaque || right.opaque)
}

function isPotentialTranslationKey(value) {
  return typeof value === 'string' && TRANSLATION_KEY_PATTERN.test(value)
}

function templatePattern(node) {
  let pattern = ''
  node.quasis.forEach((quasi, index) => {
    pattern += quasi.value.raw
    if (index < node.expressions.length) pattern += '*'
  })
  return pattern
}

function collectReturnExpressions(functionNode) {
  const body = functionNode.body
  if (!body) return []
  if (body.type !== 'BlockStatement') return [body]
  const returns = []
  walkAst(body, (node) => {
    if (node.type === 'ReturnStatement' && node.argument) returns.push(node.argument)
  })
  return returns
}

function collectPropertyNodes(node, wantedName, output) {
  const value = unwrap(node)
  if (!value) return
  if (value.type === 'ObjectExpression') {
    value.properties.forEach((property) => {
      const name = objectPropertyName(property)
      if (name && (wantedName === null || name === wantedName)) output.push(property.value)
      if (property.type === 'ObjectProperty')
        collectPropertyNodes(property.value, wantedName, output)
    })
  } else if (value.type === 'ArrayExpression') {
    value.elements.forEach((element) => collectPropertyNodes(element, wantedName, output))
  }
}

function collectObjectValueNodes(node, output) {
  const value = unwrap(node)
  if (!value) return
  if (value.type === 'ObjectExpression') {
    value.properties.forEach((property) => {
      if (property.type === 'ObjectProperty') {
        output.push(property.value)
        collectObjectValueNodes(property.value, output)
      }
    })
  } else if (value.type === 'ArrayExpression') {
    value.elements.forEach((element) => collectObjectValueNodes(element, output))
  }
}

function buildResolutionIndex(astSources) {
  const declarations = new Map()
  const propertyValues = new Map()

  function add(map, key, value) {
    if (!key) return
    const values = map.get(key) || []
    values.push(value)
    map.set(key, values)
  }

  astSources.forEach(({ ast }) => {
    walkAst(ast, (node) => {
      if (node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.init) {
        add(declarations, node.id.name, node.init)
      }
      if (node.type === 'FunctionDeclaration' && node.id) add(declarations, node.id.name, node)
      if (node.type === 'ObjectProperty') {
        const name = objectPropertyName(node)
        if (name === 'key' || /Key$/.test(name || '')) add(propertyValues, name, node.value)
      }
    })
  })

  function resolve(node, seen = new Set()) {
    const value = unwrap(node)
    if (!value) return result([], true)
    if (seen.has(value) || (value.type === 'Identifier' && seen.has(value.name)))
      return result([], true)
    const nextSeen = new Set(seen)
    nextSeen.add(value)
    if (value.type === 'Identifier') nextSeen.add(value.name)

    if (value.type === 'StringLiteral') return result([value.value])
    if (value.type === 'TemplateLiteral') {
      return value.expressions.length
        ? result([templatePattern(value)])
        : result([value.quasis[0].value.raw])
    }
    if (value.type === 'ConditionalExpression') {
      return combineResults([
        resolve(value.consequent, nextSeen),
        resolve(value.alternate, nextSeen),
      ])
    }
    if (value.type === 'LogicalExpression') {
      return combineResults([resolve(value.left, nextSeen), resolve(value.right, nextSeen)])
    }
    if (value.type === 'BinaryExpression' && value.operator === '+') {
      return combineParts(resolve(value.left, nextSeen), resolve(value.right, nextSeen))
    }
    if (value.type === 'Identifier') {
      const candidates = declarations.get(value.name) || []
      if (!candidates.length) return result([], true)
      const resolved = combineResults(
        candidates.map((candidate) => {
          if (
            candidate.type === 'FunctionDeclaration' ||
            candidate.type === 'ArrowFunctionExpression' ||
            candidate.type === 'FunctionExpression'
          ) {
            return combineResults(
              collectReturnExpressions(candidate).map((item) => resolve(item, nextSeen)),
            )
          }
          return resolve(candidate, nextSeen)
        }),
      )
      return result(
        resolved.patterns.filter((pattern) =>
          isPotentialTranslationKey(pattern.replaceAll('*', 'x')),
        ),
        resolved.opaque,
      )
    }
    if (value.type === 'MemberExpression' || value.type === 'OptionalMemberExpression') {
      const staticProperty = !value.computed ? propertyName(value.property) : null
      const propertyNodes = []
      const object = unwrap(value.object)
      if (object?.type === 'Identifier') {
        for (const initializer of declarations.get(object.name) || []) {
          if (staticProperty) collectPropertyNodes(initializer, staticProperty, propertyNodes)
          else collectObjectValueNodes(initializer, propertyNodes)
        }
      }
      if (staticProperty && propertyNodes.length === 0 && staticProperty !== 'key') {
        propertyNodes.push(...(propertyValues.get(staticProperty) || []))
      }
      const resolved = propertyNodes.flatMap((item) => {
        const candidate = resolve(item, nextSeen)
        return candidate.patterns
          .filter((pattern) => isPotentialTranslationKey(pattern.replaceAll('*', 'x')))
          .map((pattern) => result([pattern], candidate.opaque))
      })
      if (resolved.length) return combineResults(resolved)
      return result([], true)
    }
    if (value.type === 'CallExpression' && value.callee.type === 'Identifier') {
      const candidates = declarations.get(value.callee.name) || []
      const functions = candidates.filter(
        (candidate) =>
          candidate.type === 'FunctionDeclaration' ||
          candidate.type === 'ArrowFunctionExpression' ||
          candidate.type === 'FunctionExpression',
      )
      if (functions.length) {
        return combineResults(
          functions.flatMap((fn) =>
            collectReturnExpressions(fn).map((item) => resolve(item, nextSeen)),
          ),
        )
      }
    }
    return result([], true)
  }

  return { resolve }
}

function isRawRuntimeFallback(node) {
  const value = unwrap(node)
  if (!value) return false
  if (value.type === 'StringLiteral' || value.type === 'TemplateLiteral') return false
  if (value.type === 'CallExpression') return !isTranslationCall(value)
  if (value.type === 'Identifier') {
    return new Set([
      'action',
      'actorType',
      'code',
      'gap',
      'homepageBlock',
      'issue',
      'key',
      'publishStatus',
      'reason',
      'resourceType',
      's',
      'segment',
      'status',
      'stockState',
      'type',
      'value',
    ]).has(value.name)
  }
  if (value.type === 'MemberExpression' || value.type === 'OptionalMemberExpression') {
    return new Set([
      'action',
      'actionType',
      'actorType',
      'code',
      'gap',
      'homepageBlock',
      'issue',
      'key',
      'publishStatus',
      'reason',
      'resourceType',
      's',
      'segment',
      'status',
      'stockState',
      'type',
      'value',
    ]).has(propertyName(value.property))
  }
  if (value.type === 'LogicalExpression')
    return isRawRuntimeFallback(value.left) || isRawRuntimeFallback(value.right)
  if (value.type === 'ConditionalExpression')
    return isRawRuntimeFallback(value.consequent) || isRawRuntimeFallback(value.alternate)
  if (value.type === 'BinaryExpression')
    return isRawRuntimeFallback(value.left) || isRawRuntimeFallback(value.right)
  return false
}

function wildcardRegex(pattern) {
  const escaped = pattern.replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
  return new RegExp(`^${escaped.replaceAll('*', '.*')}$`)
}

function missingPatterns(patterns, keys) {
  return patterns.filter((pattern) => ![...keys].some((key) => wildcardRegex(pattern).test(key)))
}

function error(type, source, node, details) {
  return {
    type,
    file: source.path,
    line: node?.loc?.start?.line || 1,
    column: node?.loc?.start?.column || 0,
    ...details,
  }
}

export function analyzeI18n({ vi, en, sourceFiles = [] }) {
  const localeComparison = compareLocaleKeys(vi, en)
  const errors = []
  localeComparison.missingInEn.forEach((key) => errors.push({ type: 'locale-missing-in-en', key }))
  localeComparison.missingInVi.forEach((key) => errors.push({ type: 'locale-missing-in-vi', key }))

  const astSources = []
  for (const source of sourceFiles) {
    if (!SOURCE_EXTENSIONS.test(source.path)) continue
    try {
      astSources.push({ ...source, ast: parseSource(source) })
    } catch (parseError) {
      errors.push({ type: 'source-parse-error', file: source.path, message: parseError.message })
    }
  }

  const resolver = buildResolutionIndex(astSources)
  let callCount = 0
  let staticCallCount = 0
  let dynamicCallCount = 0

  astSources.forEach((source) => {
    walkAst(source.ast, (node) => {
      if (node.type !== 'CallExpression' || !isTranslationCall(node) || !node.arguments.length)
        return
      callCount += 1
      const keyArgument = unwrap(node.arguments[0])
      const isStaticArgument =
        keyArgument.type === 'StringLiteral' ||
        (keyArgument.type === 'TemplateLiteral' && keyArgument.expressions.length === 0)
      if (isStaticArgument) staticCallCount += 1
      else dynamicCallCount += 1

      const keyResult = resolver.resolve(keyArgument)
      const patterns = unique(keyResult.patterns)
      const missingInVi = missingPatterns(patterns, localeComparison.viKeys)
      const missingInEn = missingPatterns(patterns, localeComparison.enKeys)
      missingInVi.forEach((key) =>
        errors.push(error('source-key-missing-in-vi', source, node, { key })),
      )
      missingInEn.forEach((key) =>
        errors.push(error('source-key-missing-in-en', source, node, { key })),
      )

      const defaultValue = getDefaultValue(node)
      if (!patterns.length && !defaultValue) {
        errors.push(
          error('source-key-unresolved', source, node, {
            expression: source.code.slice(keyArgument.start, keyArgument.end),
          }),
        )
      }
      if (!isStaticArgument && defaultValue && isRawRuntimeFallback(defaultValue)) {
        errors.push(
          error('raw-runtime-fallback', source, node, {
            expression: source.code.slice(defaultValue.start, defaultValue.end),
            keyExpression: source.code.slice(keyArgument.start, keyArgument.end),
          }),
        )
      }
    })
  })

  return {
    ...localeComparison,
    errors,
    stats: { sourceFiles: astSources.length, callCount, staticCallCount, dynamicCallCount },
  }
}
