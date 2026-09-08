import type {PresentationNode,PresentationRegistry,PresentationContext,PresentationStateMappingManifest} from './types.js';
import {versionKey} from './registry.js';
/** Exact local capability intersection; no mapping is inferred from similar shapes. */
export function stateMappingFor(from:PresentationNode,to:PresentationNode,registry:PresentationRegistry,context:PresentationContext,kind:'transfer'|'archive'):PresentationStateMappingManifest|undefined {
 return registry.stateMappings?.find(mapping=>mapping.kind===kind&&mapping.fromRole===from.role&&mapping.toRole===to.role
  &&versionKey(mapping.from)===versionKey(from.representation)&&versionKey(mapping.to)===versionKey(to.representation)
  &&context.stateMappingCapabilities?.some(ref=>versionKey(ref)===versionKey(mapping.ref)));
}
