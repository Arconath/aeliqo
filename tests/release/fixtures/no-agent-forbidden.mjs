import * as forbiddenAgent from '@aeliqo/agent/browser';

globalThis.__aeliqoT20Forbidden = {
  module: forbiddenAgent,
  connectAgent: forbiddenAgent.connectAgent,
};
