#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {qualifyT40Smoke} from './t40-smoke-lib.mjs';

const args = process.argv.slice(2);
const value = flag => { const index = args.indexOf(flag); return index === -1 ? undefined : args[index + 1]; };
const reportPath = value('--report');
const outputPath = value('--output');
if (!reportPath || !outputPath) throw new Error('Use --report FILE --output FILE');
const bytes = await readFile(resolve(reportPath));
const report = JSON.parse(bytes.toString('utf8'));
const qualification = {...qualifyT40Smoke(report), reportSha256: createHash('sha256').update(bytes).digest('hex')};
await writeFile(resolve(outputPath), JSON.stringify(qualification, null, 2) + '\n');
console.log(JSON.stringify(qualification, null, 2));
