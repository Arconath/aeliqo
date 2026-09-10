import type {InteractionPayload, ValidatedPresentation} from '@aeliqo/sdk-core';
import {html, nothing, type TemplateResult} from 'lit';
import {repeat} from 'lit/directives/repeat.js';
import type {AeliqoFoundationId} from '../foundation/manifest.js';
import type {AeliqoActionEvent, AeliqoLinkEvent} from '../foundation/events.js';

type Node=ValidatedPresentation['nodes'][number];
type Emit=(node:Node,port:string,payload:InteractionPayload)=>void;
const text=(value:unknown,fallback='')=>typeof value==='string'?value:fallback;
const bool=(value:unknown)=>value===true;
/** This dispatcher accepts only the values produced by the registered foundation resolver. */
export function renderFoundationNode(node:Node,child:(id:string)=>unknown,emit:Emit):TemplateResult|undefined {
  const v=node.config.values;
  const id=node.node.id;
  const children=()=>repeat(node.node.children,id=>id,child);
  const action=(event:AeliqoActionEvent)=>{
    event.preventDefault();
    emit(node,'action',{kind:'action-request',action:v.action as Extract<InteractionPayload,{kind:'action-request'}>['action'],input:v.actionInput as Extract<InteractionPayload,{kind:'action-request'}>['input']});
  };
  const navigate=(event:AeliqoLinkEvent)=>{
    // A registered new-tab destination keeps native browser behavior. The
    // ordinary semantic route is dispatched once through the host controller.
    if(event.detail.target==='_blank'||event.detail.modified===true)return;
    event.preventDefault();
    emit(node,'navigate',{kind:'navigate',route:v.route as Extract<InteractionPayload,{kind:'navigate'}>['route'],params:v.params as Extract<InteractionPayload,{kind:'navigate'}>['params']});
  };
  switch(node.manifest.id as AeliqoFoundationId){
    case 'foundation.button':return html`<aeliqo-button data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${text(v.text)} .variant=${v.variant??'solid'} .size=${v.size??'medium'} type="button" @aeliqo-action=${action}></aeliqo-button>`;
    case 'foundation.icon-button':return html`<aeliqo-icon-button data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${text(v.text)} .size=${v.size??'medium'} type="button" @aeliqo-action=${action}><span slot="icon" aria-hidden="true">⋯</span></aeliqo-icon-button>`;
    case 'foundation.link':return html`<aeliqo-link data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .label=${text(v.text)} .href=${text(v.href)} .target=${v.target??'_self'} @aeliqo-link=${navigate}></aeliqo-link>`;
    case 'foundation.text':return html`<aeliqo-text data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .text=${text(v.text)} .as=${v.as??'span'} .muted=${bool(v.muted)}></aeliqo-text>`;
    case 'foundation.heading':return html`<aeliqo-heading data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .text=${text(v.text)} .level=${v.level??2} .size=${v.size??'heading'}></aeliqo-heading>`;
    case 'foundation.badge':return html`<aeliqo-badge data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .text=${text(v.text)} .tone=${v.tone??'neutral'}></aeliqo-badge>`;
    case 'foundation.avatar':return html`<aeliqo-avatar data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .name=${text(v.name)} .src=${text(v.src)} .alt=${text(v.alt)} .size=${v.size??'medium'} .decorative=${bool(v.decorative)}></aeliqo-avatar>`;
    case 'foundation.separator':return html`<aeliqo-separator data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .orientation=${v.orientation??'horizontal'} .decorative=${v.decorative??true}></aeliqo-separator>`;
    case 'foundation.surface':return html`<aeliqo-surface data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .as=${v.as??'div'} .tone=${v.tone??'surface'} .label=${text(v.label)}>${children()}</aeliqo-surface>`;
    case 'foundation.stack':return html`<aeliqo-stack data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .direction=${v.direction??'column'} .gap=${v.gap??16} .align=${v.align??'stretch'} .justify=${v.justify??'start'} .wrap=${bool(v.wrap)}>${children()}</aeliqo-stack>`;
    case 'foundation.grid':return html`<aeliqo-grid data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .columns=${v.columns??2} .gap=${v.gap??16} .minItem=${v.minItem??'medium'}>${children()}</aeliqo-grid>`;
    case 'foundation.scroll-area':return html`<aeliqo-scroll-area data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .axis=${v.axis??'y'} .label=${text(v.label)}>${children()}</aeliqo-scroll-area>`;
    case 'foundation.split-pane':return html`<aeliqo-split-pane data-aeliqo-node-id=${id} data-aeliqo-theme="inherit" .orientation=${v.orientation??'horizontal'} .defaultPosition=${v.position??50} .min=${v.min??20} .max=${v.max??80} .step=${v.step??5}><div slot="start">${node.node.children[0]===undefined?nothing:child(node.node.children[0])}</div><div slot="end">${node.node.children[1]===undefined?nothing:child(node.node.children[1])}</div></aeliqo-split-pane>`;
    default:return undefined;
  }
}
