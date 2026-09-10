import {html} from 'lit';
import {renderAeliqo} from '@aeliqo/sdk-web/server';
import {HydrateAeliqo} from './hydrate';

export const dynamic = 'force-dynamic';
export default async function Page() {
  const markup = await renderAeliqo(html`<form><aeliqo-input label="Next person" name="person" value="Ada"></aeliqo-input></form>`);
  return <main><h1>Aeliqo in Next.js</h1><div id="aeliqo-server-proof" dangerouslySetInnerHTML={{__html: markup}} /><HydrateAeliqo /></main>;
}
