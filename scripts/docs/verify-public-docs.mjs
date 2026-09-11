#!/usr/bin/env node
import {resolve} from 'node:path';
import {readVerifiedPublicDocs} from './public-docs-contract.mjs';

const manifestPath = resolve(process.cwd(), process.argv[2] ?? 'artifacts/public-docs/0.1.0/manifest.json');
const {artifact, manifest} = await readVerifiedPublicDocs(manifestPath);
process.stdout.write(`${JSON.stringify({manifest: manifestPath, docsVersion: artifact.docsVersion, pages: artifact.pages.length, components: artifact.pages.filter(page => page.component !== undefined).length, sha256: manifest.artifact.sha256, sourceRevision: artifact.source.revision})}\n`);
