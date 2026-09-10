import * as ts from 'typescript/unstable/ast';
import {API} from 'typescript/unstable/sync';
import {join,relative} from 'node:path';

export async function loadComponentSources(root){
 const classes=new Map();const api=new API({cwd:root});
 try{const config=join(root,'../tsconfig.json');const snapshot=api.updateSnapshot({openProjects:[config]});const project=snapshot.getProject(config);if(!project)throw Error('Component TypeScript project is unavailable.');
 for(const path of project.program.getSourceFileNames()){if(!path.startsWith(root+'/')||path.endsWith('.d.ts'))continue;const source=project.program.getSourceFile(path);if(!source)continue;for(const node of source.statements)if(ts.isClassDeclaration(node)&&node.name)classes.set(node.name.text,{node,source,path});}
 return classes;
 }finally{api.close();}
}

const compact=value=>value.replace(/\s+/g,' ').trim();

/** Read declarations and conservative source metadata without executing component code. */
export function componentApi(classes,name){
 const lineage=[];let current=classes.get(name);const seen=new Set();
 while(current&&!seen.has(current)){seen.add(current);lineage.unshift(current);const parent=current.node.heritageClauses?.find(clause=>clause.token===ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression.getText(current.source);current=classes.get(parent);}
 const properties=new Map();const parts=new Set();const tokens=new Set();const dependencies=new Set();const semantics=new Set();const sizing=new Set();const bounds=new Set();const sourceFiles=new Set();let version='not declared';
 for(const {node,source}of lineage){
  sourceFiles.add(relative(process.cwd(),source.fileName).replaceAll('\\','/'));
  for(const statement of source.statements)if(ts.isImportDeclaration(statement)&&ts.isStringLiteral(statement.moduleSpecifier))dependencies.add(statement.moduleSpecifier.text);
  for(const member of node.members){if(!ts.isPropertyDeclaration(member)||!member.name||member.modifiers?.some(modifier=>[ts.SyntaxKind.PrivateKeyword,ts.SyntaxKind.ProtectedKeyword,ts.SyntaxKind.StaticKeyword].includes(modifier.kind)))continue;const key=member.name.getText(source);if(key.startsWith('#')||!/^[\w]+$/.test(key))continue;const initial=member.initializer?.getText(source)??'undefined';properties.set(key,{name:key,type:member.type?.getText(source)??'inferred in public declaration',default:initial.length>120?'See source initializer':initial});}
  const text=node.getText(source);for(const match of text.matchAll(/\bpart="([a-z][a-z0-9 -]*)"/g))for(const part of match[1].split(' '))parts.add(part);
  for(const match of source.text.matchAll(/var\((--aeliqo-[a-z0-9-]+)/g))tokens.add(match[1]);
  for(const match of text.matchAll(/\b(aria-[a-z-]+|role)\s*=/g))semantics.add(match[1]);
  for(const match of text.matchAll(/<(button|input|select|textarea|form|a|table|caption|thead|tbody|tr|th|td|ul|ol|li|dl|dt|dd|section|header|nav|dialog|progress|output)\b/gi))semantics.add(match[1].toLowerCase());
  for(const match of source.text.matchAll(/\b(?:min-inline-size|max-inline-size|inline-size|min-block-size|max-block-size|block-size|width|height|overflow(?:-x|-y)?|grid-template-columns|grid-auto-flow|flex-wrap|aspect-ratio)\s*:\s*([^;}`]+)/g))sizing.add(compact(match[0]));
  for(const match of source.text.matchAll(/\b(?:MAX_[A-Z_]+|max(?:Rows|Marks|Items)|(?:slice|limit|window|bounded|capacity|budget|virtual)\b[^;,.{}]*)/g))bounds.add(compact(match[0]).slice(0,140));
  const versionMatch=source.text.match(/static\s+readonly\s+aeliqoVersion\s*=\s*["']([^"']+)["']/);if(versionMatch)version=versionMatch[1];
 }
 return{properties:[...properties.values()],parts:[...parts].sort(),tokens:[...tokens].sort(),dependencies:[...dependencies].sort(),semantics:[...semantics].sort(),sizing:[...sizing].sort(),bounds:[...bounds].sort(),sourceFiles:[...sourceFiles].sort(),version};
}
