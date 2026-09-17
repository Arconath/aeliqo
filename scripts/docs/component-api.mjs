import * as ts from 'typescript/unstable/ast';
import { API } from 'typescript/unstable/sync';
import { dirname, join, relative, resolve } from 'node:path';

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

function cssFromNode(node, source) {
  const styles = [];
  visit(node, (current) => {
    if (ts.isTaggedTemplateExpression(current) && current.tag.getText(source) === 'css')
      styles.push(templateText(current.template));
  });
  return styles.join('\n');
}

function sourceForImport(program, source, specifier) {
  if (!specifier.startsWith('.')) return undefined;
  const path = resolve(dirname(source.fileName), specifier.replace(/\.js$/u, '.ts'));
  return program.getSourceFile(path);
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

function localStyleImports(node, source, program) {
  const declaration = node.members.find(
    (member) => ts.isPropertyDeclaration(member) && member.name.getText(source) === 'styles',
  );
  if (!declaration || !ts.isPropertyDeclaration(declaration) || !declaration.initializer) return [];
  const names = new Set();
  visit(declaration.initializer, (current) => {
    if (ts.isIdentifier(current)) names.add(current.text);
  });
  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    if (!/(?:^|[-/])styles?\.js$/u.test(statement.moduleSpecifier.text)) return [];
    if (!importedNames(statement).some((name) => names.has(name))) return [];
    const imported = sourceForImport(program, source, statement.moduleSpecifier.text);
    return imported === undefined ? [] : [imported];
  });
}

function componentCss(node, source, program) {
  const imported = localStyleImports(node, source, program);
  return [cssFromNode(node, source), ...imported.map((item) => cssFromNode(item, item))].join('\n');
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

function unaryNumericValue(node, constants, seen) {
  const value = numericValue(node.operand, constants, seen);
  if (value === undefined) return undefined;
  if (node.operator === ts.SyntaxKind.MinusToken) return -value;
  if (node.operator === ts.SyntaxKind.PlusToken) return value;
  return undefined;
}

function identifierNumericValue(node, constants, seen) {
  if (seen.has(node.text)) return undefined;
  const declaration = constants.get(node.text);
  if (!declaration) return undefined;
  return numericValue(declaration, constants, new Set([...seen, node.text]));
}

function binaryNumericValue(node, constants, seen) {
  const left = numericValue(node.left, constants, seen);
  const right = numericValue(node.right, constants, seen);
  if (left === undefined || right === undefined) return undefined;
  if (node.operatorToken.kind === ts.SyntaxKind.PlusToken) return left + right;
  if (node.operatorToken.kind === ts.SyntaxKind.MinusToken) return left - right;
  if (node.operatorToken.kind === ts.SyntaxKind.AsteriskToken) return left * right;
  if (node.operatorToken.kind === ts.SyntaxKind.SlashToken && right !== 0) return left / right;
  return undefined;
}

function numericValue(node, constants, seen = new Set()) {
  if (ts.isNumericLiteral(node)) return Number(node.text.replaceAll('_', ''));
  if (ts.isPrefixUnaryExpression(node)) return unaryNumericValue(node, constants, seen);
  if (ts.isIdentifier(node)) return identifierNumericValue(node, constants, seen);
  if (ts.isParenthesizedExpression(node)) return numericValue(node.expression, constants, seen);
  if (ts.isBinaryExpression(node)) return binaryNumericValue(node, constants, seen);
  return undefined;
}

function importedBoundConstants(source, program, text) {
  return source.statements.flatMap((statement) => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return [];
    if (!statement.importClause?.namedBindings || !ts.isNamedImports(statement.importClause.namedBindings)) return [];
    const imported = sourceForImport(program, source, statement.moduleSpecifier.text);
    if (!imported) return [];
    const constants = sourceConstants(imported);
    return statement.importClause.namedBindings.elements.flatMap((specifier) => {
      const localName = specifier.name.text;
      const name = specifier.propertyName?.text ?? localName;
      const initializer = constants.get(name);
      if (!BOUND_CONSTANT.test(name) || !identifierPattern(localName).test(text) || !initializer) return [];
      return [{ name, initializer, constants }];
    });
  });
}

function describeBound({ name, initializer, constants }) {
  const value = numericValue(initializer, constants);
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `The source-defined \`${name}\` limit is ${value.toLocaleString('en-US')}.`;
}

function boundSentences(node, source, program) {
  const text = node.getText(source);
  const constants = sourceConstants(source);
  const local = [...constants]
    .filter(([name]) => BOUND_CONSTANT.test(name) && identifierPattern(name).test(text))
    .map(([name, initializer]) => ({ name, initializer, constants }));
  const imported = importedBoundConstants(source, program, text);
  return [...local, ...imported].map(describeBound).filter(Boolean);
}

function reexportedModules(source, program) {
  return source.statements.flatMap((statement) => {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      return [];
    if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) return [];
    const imported = sourceForImport(program, source, statement.moduleSpecifier.text);
    return imported === undefined ? [] : [{ imported, exports: statement.exportClause.elements }];
  });
}

function exportedBound(specifier, constants) {
  const name = specifier.propertyName?.text ?? specifier.name.text;
  const initializer = constants.get(name);
  if (!BOUND_CONSTANT.test(name) || !initializer) return undefined;
  const value = numericValue(initializer, constants);
  if (value === undefined || !Number.isFinite(value)) return undefined;
  return `The source-defined \`${name}\` limit is ${value.toLocaleString('en-US')}.`;
}

function exportedBounds(source, program) {
  return reexportedModules(source, program).flatMap(({ imported, exports }) => {
    const constants = sourceConstants(imported);
    return exports.map((specifier) => exportedBound(specifier, constants)).filter(Boolean);
  });
}

function collectSourceClasses(classes, program, root, repositoryRoot) {
  for (const path of program.getSourceFileNames()) {
    if (!path.startsWith(root + '/') || path.endsWith('.d.ts')) continue;
    const source = program.getSourceFile(path);
    if (source) collectClassesFromSource(classes, source, repositoryRoot, program);
  }
}

function collectClassesFromSource(classes, source, repositoryRoot, program) {
  const sourceBounds = exportedBounds(source, program);
  for (const node of source.statements) {
    if (!ts.isClassDeclaration(node) || !node.name) continue;
    classes.set(node.name.text, {
      node,
      source,
      repositoryRoot,
      cssText: componentCss(node, source, program),
      bounds: [...boundSentences(node, source, program), ...sourceBounds],
    });
  }
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
    collectSourceClasses(classes, project.program, root, repositoryRoot);
    return classes;
  } finally {
    api.close();
  }
}

function classLineage(classes, name) {
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
  return lineage;
}

function createComponentMetadata() {
  return {
    properties: new Map(),
    parts: new Set(),
    tokens: new Set(),
    dependencies: new Set(),
    semantics: new Set(),
    sizing: new Set(),
    bounds: new Set(),
    sourceFiles: new Set(),
  };
}

function collectDependencies(metadata, source, text) {
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const names = importedNames(statement);
    if (names.some((imported) => identifierPattern(imported).test(text)))
      metadata.dependencies.add(statement.moduleSpecifier.text);
  }
}

function isPublicPropertyMember(member) {
  if (!ts.isPropertyDeclaration(member) || !member.name) return false;
  return !member.modifiers?.some((modifier) =>
    [ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.StaticKeyword].includes(modifier.kind),
  );
}

function collectProperties(metadata, node, source) {
  for (const member of node.members) {
    if (!isPublicPropertyMember(member)) continue;
    const key = member.name.getText(source);
    if (key.startsWith('#') || !/^[\w]+$/.test(key)) continue;
    const initial = member.initializer?.getText(source) ?? 'undefined';
    metadata.properties.set(key, {
      name: key,
      type: member.type?.getText(source) ?? 'inferred in public declaration',
      default: initial.length > 120 ? 'See source initializer' : initial,
    });
  }
}

function collectTemplateFacts(metadata, text, cssText) {
  for (const match of text.matchAll(/\bpart="([a-z][a-z0-9 -]*)"/g))
    for (const part of match[1].split(' ')) metadata.parts.add(part);
  for (const match of cssText.matchAll(/var\((--aeliqo-[a-z0-9-]+)/g)) metadata.tokens.add(match[1]);
}

function collectSemantics(metadata, text) {
  for (const match of text.matchAll(/\b(aria-[a-z-]+|role)\s*=/g)) metadata.semantics.add(match[1]);
  for (const match of text.matchAll(
    /<(button|input|select|textarea|form|a|table|caption|thead|tbody|tr|th|td|ul|ol|li|dl|dt|dd|section|header|nav|dialog|progress|output)\b/gi,
  ))
    metadata.semantics.add(match[1].toLowerCase());
}

function collectSizing(metadata, cssText) {
  const sizingPattern = new RegExp(`(?:^|[;{])\\s*(${SIZING_PROPERTIES.join('|')})\\s*:`, 'giu');
  for (const match of cssText.matchAll(sizingPattern)) metadata.sizing.add(match[1].toLowerCase());
}

function collectClassMetadata(metadata, item) {
  const { node, source, repositoryRoot, cssText } = item;
  metadata.sourceFiles.add(relative(repositoryRoot, source.fileName).replaceAll('\\', '/'));
  const text = node.getText(source);
  collectDependencies(metadata, source, text);
  collectProperties(metadata, node, source);
  collectTemplateFacts(metadata, text, cssText);
  collectSemantics(metadata, text);
  collectSizing(metadata, cssText);
  for (const sentence of item.bounds) metadata.bounds.add(sentence);
}

function addWorkloadBounds(metadata) {
  const workload = [...metadata.properties.values()]
    .filter((property) => WORKLOAD_PROPERTY.test(property.name))
    .map((property) =>
      property.default === 'undefined'
        ? `\`${property.name}\``
        : `\`${property.name}\` (default ${compact(property.default)})`,
    );
  if (workload.length) metadata.bounds.add(`Public workload controls: ${workload.join(', ')}.`);
}

function sortedComponentMetadata(metadata) {
  return {
    properties: [...metadata.properties.values()],
    parts: [...metadata.parts].sort(),
    tokens: [...metadata.tokens].sort(),
    dependencies: [...metadata.dependencies].sort(),
    semantics: [...metadata.semantics].sort(),
    sizing: [...metadata.sizing].sort(),
    bounds: [...metadata.bounds].sort(),
    sourceFiles: [...metadata.sourceFiles].sort(),
  };
}

/** Read declarations and conservative source metadata without executing component code. */
export function componentApi(classes, name) {
  const metadata = createComponentMetadata();
  for (const item of classLineage(classes, name)) collectClassMetadata(metadata, item);
  addWorkloadBounds(metadata);
  return sortedComponentMetadata(metadata);
}
