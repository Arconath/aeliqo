import * as ts from 'typescript/unstable/ast';
import {API} from 'typescript/unstable/sync';
import {join} from 'node:path';

export async function loadComponentSources(root){
 const classes=new Map();const api=new API({cwd:root});
 try{const config=join(root,'../tsconfig.json');const snapshot=api.updateSnapshot({openProjects:[config]});const project=snapshot.getProject(config);if(!project)throw Error('Component TypeScript project is unavailable.');
 for(const path of project.program.getSourceFileNames()){if(!path.startsWith(root+'/')||path.endsWith('.d.ts'))continue;const source=project.program.getSourceFile(path);if(!source)continue;for(const node of source.statements)if(ts.isClassDeclaration(node)&&node.name)classes.set(node.name.text,{node,source});}
 return classes;
 }finally{api.close();}
}
/** Read declarations without executing component constructors or runtime code. */
export function componentApi(classes,name){
 const lineage=[];let current=classes.get(name);const seen=new Set();
 while(current&&!seen.has(current)){seen.add(current);lineage.unshift(current);const parent=current.node.heritageClauses?.find(clause=>clause.token===ts.SyntaxKind.ExtendsKeyword)?.types[0]?.expression.getText(current.source);current=classes.get(parent);}
 const properties=new Map();const parts=new Set();const tokens=new Set();
 for(const {node,source}of lineage){
  for(const member of node.members){if(!ts.isPropertyDeclaration(member)||!member.name||member.modifiers?.some(modifier=>[ts.SyntaxKind.PrivateKeyword,ts.SyntaxKind.ProtectedKeyword,ts.SyntaxKind.StaticKeyword].includes(modifier.kind)))continue;const key=member.name.getText(source);if(key.startsWith('#')||!/^\w+$/.test(key))continue;const initial=member.initializer?.getText(source)??'undefined';properties.set(key,{name:key,type:member.type?.getText(source)??'inferred in public declaration',default:initial.length>120?'See source initializer':initial});}
  const text=node.getText(source);for(const match of text.matchAll(/\bpart="([a-z][a-z0-9 -]*)"/g))for(const part of match[1].split(' '))parts.add(part);
  // Tokens can live in shared styles in the same source module.
  for(const match of source.text.matchAll(/var\((--aeliqo-[a-z0-9-]+)/g))tokens.add(match[1]);
 }
 return{properties:[...properties.values()],parts:[...parts].sort(),tokens:[...tokens].sort()};
}
