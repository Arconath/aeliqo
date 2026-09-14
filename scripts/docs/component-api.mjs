import * as ts from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';
import { join, relative, resolve } from 'node:path';

const SIZING_PROPERTIES = [
  'min-inline-size',
  'max-inline-size',
  'inline-size',
  'min-block-size',
  'max-block-size',
  'block-size',
  'width',
  'height',
  'overflow',
  'overflow-x',
  'overflow-y',
  'grid-template-columns',
  'grid-auto-flow',
  'flex-wrap',
  'aspect-ratio',
];
const WORKLOAD_PROPERTY =
  /^(?:max[A-Z]|pageSize$|virtualized$|virtualStart$|virtualCount$|overscan$|windowSize$|capacity$|budget$)/u;
const BOUND_CONSTANT = /(?:^|_)(?:MAX|LIMIT|CAPACITY|BUDGET)(?:_|$)/u;
const compact = (value) => value.replace(/\s+/g, ' ').trim();
const identifierPattern = (name) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'u');

function visit(node, callback) {
  callback(node);
  node.forEachChild((child) => visit(child, callback));
}

function templateText(template) {
  if (ts.isNoSubstitutionTemplateLiteral(template)) return template.text;
  if (!ts.isTemplateExpression(template)) return '';
  let result = template.head.text;
  for (const span of template.templateSpans) result += ' [runtime value] ' + span.literal.text;
  return result;
}

function classCss(node, source) {
  const styles = [];
  visit(node, (current) => {
    if (ts.isTaggedTemplateExpression(current) && current.tag.getText(source) === 'css')
      styles.push(templateText(current.template));
  });
  return styles.join('\n');
}

function importedNames(statement) {
  const names = [];
  const clause = statement.importClause;
  if (!clause) return names;
  if (clause.name) names.push(clause.name.text);
  const bindings = clause.namedBindings;
  if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
  if (bindings && ts.isNamedImports(bindings)) for (const element of bindings.elements) names.push(element.name.text);
  return names;
}

function sourceConstants(source) {
  const constants = new Map();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer)
        constants.set(declaration.name.text, declaration.initializer);
    }
  }
  return constants;
}

function numericValue(node, constants, seen = new Set()) {
  if (ts.isNumericLiteral(node)) return Number(node.text.replaceAll('_', ''));
  if (ts.isPrefixUnaryExpression(node)) {
    const value = numericValue(node.operand, constants, seen);
    if (value === undefined) return undefined;
    if (node.operator === ts.SyntaxKind.MinusToken) return -value;
    if (node.operator === ts.SyntaxKind.PlusToken) return value;
    return undefined;
  }
  if (ts.isIdentifier(node)) {
    if (seen.has(node.text)) return undefined;
    const declaration = constants.get(node.text);
    if (!declaration) return undefined;
    return numericValue(declaration, constants, new Set([...seen, node.text]));
  }
  if (ts.isParenthesizedExpression(node)) return numericValue(node.expression, constants, seen);
  if (ts.isBinaryExpression(node)) {
    const left = numericValue(node.left, constants, seen);
    const right = numericValue(node.right, constants, seen);
    if (left === undefined || right === undefined) return undefined;
    if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return left + right;
    if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) return left - right;
    if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return left * right;
    if (node.operatorToken.kind === ts.SyntaxKind.SlashToken && right !== 0) return left / right;
  }
  return undefined;
}

function boundSentences(node, source) {
  const result = [];
  const text = node.getText(source);
  const constants = sourceConstants(source);
  for (const [name, initializer] of constants) {
    if (!BOUND_CONSTANT.test(name) || !identifierPattern(name).test(text)) continue;
    const value = numericValue(initializer, constants);
    if (value !== undefined && Number.isFinite(value))
      result.push(`The source-defined \`${name}\` limit is ${value.toLocaleString('en-US')}.`);
  }
  return result;
}

/** Load public component classes plus the repository root used for stable source paths. */
export async function loadComponentSources(root) {
  const classes = new Map();
  const api = new API({ cwd: root });
  const repositoryRoot = resolve(root, '../../..');
  try {
    const config = join(root, '../tsconfig.json');
    const snapshot = api.updateSnapshot({ openProjects: [config] });
    const project = snapshot.getProject(config);
    if (!project) throw Error('Component TypeScript project is unavailable.');
    for (const path of project.program.getSourceFileNames()) {
      if (!path.startsWith(root + '/') || path.endsWith('.d.ts')) continue;
      const source = project.program.getSourceFile(path);
      if (!source) continue;
      for (const node of source.statements)
        if (ts.isClassDeclaration(node) && node.name)
          classes.set(node.name.text, { node, source, path, repositoryRoot });
    }
    return classes;
  } finally {
    api.close();
  }
}

/** Read declarations and conservative source metadata without executing component code. */
export function componentApi(classes, name) {
  const lineage = [];
  let current = classes.get(name);
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    lineage.unshift(current);
    const parent = current.node.heritageClauses
      ?.find((clause) => clause.token === ts.SyntaxKind.ExtendsKeyword)
      ?.types[0]?.expression.getText(current.source);
    current = classes.get(parent);
  }
  const properties = new Map();
  const parts = new Set();
  const tokens = new Set();
  const dependencies = new Set();
  const semantics = new Set();
  const sizing = new Set();
  const bounds = new Set();
  const sourceFiles = new Set();
  let version = 'not declared';
  for (const { node, source, repositoryRoot } of lineage) {
    sourceFiles.add(relative(repositoryRoot, source.fileName).replaceAll('\\', '/'));
    const text = node.getText(source);
    const cssText = classCss(node, source);
    for (const statement of source.statements) {
      if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
      const names = importedNames(statement);
      if (names.some((imported) => identifierPattern(imported).test(text)))
        dependencies.add(statement.moduleSpecifier.text);
    }
    for (const member of node.members) {
      if (
        !ts.isPropertyDeclaration(member) ||
        !member.name ||
        member.modifiers?.some((modifier) =>
          [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.StaticKeyword].includes(
            modifier.kind,
          ),
        )
      )
        continue;
      const key = member.name.getText(source);
      if (key.startsWith('#') || !/^[\w]+$/.test(key)) continue;
      const initial = member.initializer?.getText(source) ?? 'undefined';
      properties.set(key, {
        name: key,
        type: member.type?.getText(source) ?? 'inferred in public declaration',
        default: initial.length > 120 ? 'See source initializer' : initial,
      });
    }
    for (const match of text.matchAll(/\bpart="([a-z][a-z0-9 -]*)"/g))
      for (const part of match[1].split(' ')) parts.add(part);
    for (const match of cssText.matchAll(/var\((--aeliqo-[a-z0-9-]+)/g)) tokens.add(match[1]);
    for (const match of text.matchAll(/\b(aria-[a-z-]+|role)\s*=/g)) semantics.add(match[1]);
    for (const match of text.matchAll(
      /<(button|input|select|textarea|form|a|table|caption|thead|tbody|tr|th|td|ul|ol|li|dl|dt|dd|section|header|nav|dialog|progress|output)\b/gi,
    ))
      semantics.add(match[1].toLowerCase());
    const sizingPattern = new RegExp(`(?:^|[;{])\\s*(${SIZING_PROPERTIES.join('|')})\\s*:`, 'giu');
    for (const match of cssText.matchAll(sizingPattern)) sizing.add(match[1].toLowerCase());
    for (const sentence of boundSentences(node, source)) bounds.add(sentence);
    const versionMatch = text.match(/static\s+readonly\s+aeliqoVersion\s*=\s*["']([^"']+)["']/);
    if (versionMatch) version = versionMatch[1];
  }
  const workload = [...properties.values()]
    .filter((property) => WORKLOAD_PROPERTY.test(property.name))
    .map((property) =>
      property.default === 'undefined'
        ? `\`${property.name}\``
        : `\`${property.name}\` (default ${compact(property.default)})`,
    );
  if (workload.length) bounds.add(`Public workload controls: ${workload.join(', ')}.`);
  return {
    properties: [...properties.values()],
    parts: [...parts].sort(),
    tokens: [...tokens].sort(),
    dependencies: [...dependencies].sort(),
    semantics: [...semantics].sort(),
    sizing: [...sizing].sort(),
    bounds: [...bounds].sort(),
    sourceFiles: [...sourceFiles].sort(),
    version,
  };
}
