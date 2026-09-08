// @ts-nocheck
// This fixture intentionally uses a runtime module edge.
export async function loadUntrustedModule() {
  return import('./untrusted-module.js');
}
