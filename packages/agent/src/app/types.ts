import type { Diagnostic, Outcome, VersionRef } from '@aeliqo/core';
import type { AgentModelToolEndpoint, AgentToolTransport } from '../protocol/types.js';
import type { AgentJsonValue } from '../capabilities/types.js';
import type { ActionReceipt } from '@aeliqo/runtime/actions';
import type {
  AeliqoRuntime,
  RuntimeRenderInput,
  RuntimeRenderReceipt,
  RuntimeResourceContext,
} from '@aeliqo/runtime/app';

export interface AppRenderPort {
  render(input: RuntimeRenderInput): Promise<
    | RuntimeRenderReceipt
    | {
        readonly status: 'renderer-ready' | 'unsupported' | 'failed' | 'cancelled' | 'needs-input';
        readonly requestId: string;
        readonly regionId: string;
        readonly runtime: Extract<RuntimeRenderReceipt, { readonly status: 'committed' }>;
        readonly diagnostics: readonly Diagnostic[];
      }
  >;
}

export interface AppContextPort {
  /** Trusted discovery may expose multiple resources only when the paired render port can route them. */
  read(): Outcome<
    readonly (RuntimeResourceContext & {
      /** Host-registered custom compilers available to the paired render port. */
      readonly customIntents?: readonly { readonly ref: VersionRef; readonly inputSchema: AgentJsonValue }[];
      /** Host-registered patterns that the paired render port can resolve. */
      readonly patterns?: readonly {
        readonly ref: VersionRef;
        readonly intent: VersionRef;
        readonly outputs: readonly string[];
      }[];
      /** Host-owned time boundary that the paired render port applies to this resource. */
      readonly queryConstraint?: {
        readonly interpretation: string;
        readonly requiredFilter: AgentJsonValue;
        readonly supportedPeriod?: AgentJsonValue;
      };
    })[]
  >;
}

export interface AppToolEndpointOptions {
  readonly runtime: AeliqoRuntime;
  readonly regionId: string;
  readonly goalEpoch: string;
  readonly transport: AgentToolTransport;
  readonly expiresAt: number;
  readonly render?: AppRenderPort;
  readonly context?: AppContextPort;
  readonly now?: () => number;
  readonly maxPending?: number;
  readonly maxMilliseconds?: number;
  readonly maxInputBytes?: number;
  readonly maxOutputBytes?: number;
}

export interface AeliqoAppToolEndpoint extends AgentModelToolEndpoint {
  /** Trusted host UI path. This method is not advertised as an agent tool. */
  confirmAction(previewId: string, options?: { readonly signal?: AbortSignal }): Promise<Outcome<ActionReceipt>>;
}
