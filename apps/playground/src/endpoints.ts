// Local companion endpoints may be selected explicitly for isolated sessions.
// Only loopback ports are configurable: arbitrary remote destinations are not.
function portParameter(name: string, fallback: number): number {
  const value = new URLSearchParams(window.location.search).get(name);
  if (value === null) return fallback;
  if (!/^\d{1,5}$/.test(value) || Number(value) < 1 || Number(value) > 65535)
    throw new Error(`Invalid local endpoint port: ${name}`);
  return Number(value);
}

const fragment = new URLSearchParams(window.location.hash.slice(1));
const pairingToken = fragment.get("aeliqoPairToken") ?? undefined;
if (pairingToken) {
  fragment.delete("aeliqoPairToken");
  const remaining = fragment.toString();
  history.replaceState(null, "", `${location.pathname}${location.search}${remaining ? `#${remaining}` : ""}`);
}
const rendererId = crypto.randomUUID();

export const playgroundEndpoints = {
  pairingToken,
  rendererId,
  bridgeUrl: `ws://127.0.0.1:${portParameter("aeliqoBridgePort", 4318)}`,
  companionUrl: `http://127.0.0.1:${portParameter("aeliqoCompanionPort", 4319)}`,
};
