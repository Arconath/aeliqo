export const MIGRATION_URL = 'https://github.com/Arconath/aeliqo/blob/main/docs/migration-0.1.0.md';

export const LEGACY_LINEAGES = Object.freeze([
  {
    name: '@aeliqo/core',
    version: '0.2.0',
    replacement: '@aeliqo/sdk-core@0.1.0',
  },
  {
    name: '@aeliqo/react',
    version: '0.2.0',
    replacement: '@aeliqo/sdk-react@0.1.0',
  },
  {
    name: '@aeliqo/mcp',
    version: '0.2.0',
    replacement: '@aeliqo/sdk-agent@0.1.0 subpath @aeliqo/sdk-agent/mcp',
  },
  {
    name: '@aeliqo/byok',
    version: '0.2.0',
    replacement: '@aeliqo/sdk-agent@0.1.0 model subpaths',
  },
  {
    name: '@aeliqo/webmcp-experimental',
    version: '0.2.0',
    replacement: '@aeliqo/sdk-agent@0.1.0 subpath @aeliqo/sdk-agent/webmcp',
  },
]);

export function legacyDeprecationMessage(lineage) {
  if (!LEGACY_LINEAGES.includes(lineage)) throw new Error('Legacy lineage is not allowlisted');
  return `Legacy Aeliqo 0.2 lineage; incompatible with the 0.1 rewrite. Migrate to ${lineage.replacement}. ${MIGRATION_URL}`;
}

export function classifyExactPackage(status, payload, name, version, expectedIntegrity) {
  if (status === 404) return {state: 'absent'};
  if (status !== 200) throw new Error(`Registry returned HTTP ${status} for ${name}@${version}`);
  if (payload?.name !== name || payload?.version !== version) {
    throw new Error(`Registry returned the wrong identity for ${name}@${version}`);
  }
  const integrity = payload?.dist?.integrity ?? null;
  if (expectedIntegrity && integrity !== expectedIntegrity) {
    throw new Error(`${name}@${version} exists with bytes that differ from the verified candidate`);
  }
  return {state: 'visible', deprecated: typeof payload.deprecated === 'string' ? payload.deprecated : null, integrity};
}
