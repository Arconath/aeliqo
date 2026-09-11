export const MIGRATION_URL = 'https://github.com/Arconath/aeliqo/blob/main/docs/migration-0.1.0.md';

export const LEGACY_LINEAGES = Object.freeze([
  {
    name: '@aeliqo/core',
    version: '0.2.0',
    replacement: '@aeliqo/core@0.1.0',
    reason: 'Legacy Aeliqo 0.2 preview',
  },
  {
    name: '@aeliqo/react',
    version: '0.2.0',
    replacement: '@aeliqo/react@0.1.0',
    reason: 'Legacy Aeliqo 0.2 preview',
  },
  {
    name: '@aeliqo/mcp',
    version: '0.2.0',
    replacement: '@aeliqo/agent@0.1.0 subpath @aeliqo/agent/mcp',
    reason: 'Legacy Aeliqo 0.2 preview',
  },
  {
    name: '@aeliqo/byok',
    version: '0.2.0',
    replacement: '@aeliqo/agent@0.1.0 model subpaths',
    reason: 'Legacy Aeliqo 0.2 preview',
  },
  {
    name: '@aeliqo/webmcp-experimental',
    version: '0.2.0',
    replacement: '@aeliqo/agent@0.1.0 subpath @aeliqo/agent/webmcp',
    reason: 'Legacy Aeliqo 0.2 preview',
  },
  {
    name: '@aeliqo/sdk-core',
    version: '0.1.0-rc.1',
    replacement: '@aeliqo/core@0.1.0',
    reason: 'Accidental sdk-prefixed prerelease',
  },
]);

export function legacyDeprecationMessage(lineage) {
  if (!LEGACY_LINEAGES.includes(lineage)) throw new Error('Legacy lineage is not allowlisted');
  return `${lineage.reason}; incompatible with the supported 0.1 package identity. Migrate to ${lineage.replacement}. ${MIGRATION_URL}`;
}

export function classifyExactPackage(status, payload, name, version, expectedIntegrity) {
  if (status === 404) return { state: 'absent' };
  if (status !== 200) throw new Error(`Registry returned HTTP ${status} for ${name}@${version}`);
  if (payload?.name !== name || payload?.version !== version) {
    throw new Error(`Registry returned the wrong identity for ${name}@${version}`);
  }
  const integrity = payload?.dist?.integrity ?? null;
  if (expectedIntegrity && integrity !== expectedIntegrity) {
    throw new Error(`${name}@${version} exists with bytes that differ from the verified candidate`);
  }
  return {
    state: 'visible',
    deprecated: typeof payload.deprecated === 'string' ? payload.deprecated : null,
    integrity,
  };
}
