import { css } from 'lit';
import { aeliqoFoundationThemeStyles } from '../../foundation/base.js';

export const aeliqoHierarchyStyles = [
  ...aeliqoFoundationThemeStyles,
  css`
    :host {
      display: block;
      min-inline-size: 0;
      inline-size: 100%;
      max-inline-size: 100%;
      color: var(--aeliqo-color-text, #111827);
    }
    .sr-only {
      position: absolute;
      inline-size: 1px;
      block-size: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
      border: 0;
    }
    figure {
      margin: 0;
    }
    figcaption,
    [part='scope'],
    p,
    caption,
    th,
    td {
      overflow-wrap: anywhere;
      unicode-bidi: plaintext;
    }
    [part='viewport'] {
      direction: ltr;
      overflow: auto;
      max-inline-size: 100%;
      border: 1px solid var(--aeliqo-color-border, #cbd5e1);
      border-radius: var(--aeliqo-radius-small, 0.375rem);
    }
    svg {
      display: block;
      max-inline-size: 100%;
      min-inline-size: min(20rem, 100%);
    }
    svg text {
      font: inherit;
      fill: currentColor;
      pointer-events: none;
    }
    svg .tree-label {
      fill: #111827;
    }
    svg .treemap-label {
      fill: var(--aeliqo-color-on-accent, #fff);
    }
    [part='node'],
    [part='edge'] {
      cursor: pointer;
    }
    [part='node']:focus-visible,
    [part='edge']:focus-visible {
      outline: 3px solid var(--aeliqo-color-focus, #4338ca);
      outline-offset: 2px;
    }
    [part='node'][aria-pressed='true'] {
      stroke: var(--aeliqo-color-focus, #4338ca);
      stroke-width: 3;
    }
    [part='edge'][aria-pressed='true'] {
      stroke: var(--aeliqo-color-focus, #4338ca);
      stroke-width: 3;
    }
    [part='data'] {
      overflow: auto;
      margin-block-start: 1rem;
    }
    button {
      background: var(--aeliqo-color-surface, #f8fafc);
      border: var(--aeliqo-control-border-width, 0.0625rem) solid var(--aeliqo-color-border, #64748b);
      color: var(--aeliqo-color-text, #111827);
      font: inherit;
      min-block-size: 2.75rem;
      min-inline-size: 2.75rem;
    }
    table {
      border-collapse: collapse;
      inline-size: 100%;
    }
    th,
    td {
      text-align: start;
      padding: 0.5rem;
      border-block-end: 1px solid var(--aeliqo-color-border, #cbd5e1);
      vertical-align: top;
    }
    [aria-selected='true'] {
      background: color-mix(in srgb, var(--aeliqo-color-accent, #4338ca) 12%, transparent);
    }
    [part='scope'] {
      color: var(--aeliqo-color-muted, #4b5563);
    }
    @media (max-width: 30rem) {
      [part='data'] {
        overflow: visible;
      }
      table {
        display: block;
        inline-size: 100%;
        min-inline-size: 0;
      }
      caption {
        display: block;
        margin-block: 0.75rem;
        text-align: start;
      }
      thead {
        block-size: 1px;
        clip: rect(0 0 0 0);
        clip-path: inset(50%);
        inline-size: 1px;
        overflow: hidden;
        position: absolute;
        white-space: nowrap;
      }
      tbody {
        display: grid;
        gap: 0.75rem;
      }
      tr {
        border-block-end: 1px solid var(--aeliqo-color-border, #cbd5e1);
        display: block;
        padding-block: 0.25rem;
      }
      td {
        border: 0;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: minmax(4.75rem, 0.7fr) minmax(0, 1.3fr);
        padding: 0.25rem;
      }
      td::before {
        content: attr(data-label);
        font-weight: 600;
        overflow-wrap: anywhere;
      }
      td > button {
        justify-self: start;
      }
    }
    @media (forced-colors: active) {
      button {
        background: Canvas;
        color: CanvasText;
      }
      svg path,
      svg line,
      svg rect,
      svg circle {
        stroke: CanvasText;
        fill: Canvas;
      }
    }
  `,
];
