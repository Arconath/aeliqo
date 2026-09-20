const forbiddenAgent = await import('@aeliqo/agent/browser');

globalThis.__aeliqoT20Forbidden = {
  module: forbiddenAgent,
  connectAgent: forbiddenAgent.connectAgent,
};
