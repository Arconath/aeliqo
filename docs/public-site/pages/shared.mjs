import { routeById } from '../routes.mjs';
import { RELEASE_VERSION } from '../../../scripts/release/metadata.mjs';

export const escape = (value) =>
  String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const code = (label, value) =>
  `<figure class="doc-code"><figcaption>${escape(label)}</figcaption><pre tabindex="0"><code>${escape(value)}</code></pre></figure>`;

export const source = (label, path) =>
  `<aeliqo-source data-label="${escape(label)}" data-path="${escape(path)}"></aeliqo-source>`;

export const project = (scenario) => `<aeliqo-project data-scenario="${escape(scenario)}"></aeliqo-project>`;

export const note = (title, body, tone = 'note') =>
  `<aside class="doc-callout" data-tone="${escape(tone)}"><strong>${escape(title)}</strong><p>${body}</p></aside>`;

export const checklist = (items) =>
  `<div class="doc-checklist"><ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul></div>`;

export const cards = (items) =>
  `<div class="decision-grid">${items.map(({ title, body, href, label = 'Read guide' }) => `<article><h3>${title}</h3><p>${body}</p>${href === undefined ? '' : `<a href="${href}">${label} →</a>`}</article>`).join('')}</div>`;

export const next = (items) =>
  `<nav class="doc-next" aria-label="Continue reading"><p>Continue reading</p>${items.map(({ href, title, description }) => `<a href="${href}"><span>${title}</span><small>${description}</small><b aria-hidden="true">→</b></a>`).join('')}</nav>`;

export function definePage(id, input) {
  const route = routeById(id);
  return Object.freeze({ id, path: route.path, section: route.group, ...input });
}

export const install = code(
  'Terminal',
  `npm install --save-exact \\
  @aeliqo/core@${RELEASE_VERSION} \\
  @aeliqo/runtime@${RELEASE_VERSION} \\
  @aeliqo/web@${RELEASE_VERSION}`,
);
