import { registerAeliqoElements } from '@aeliqo/web/register';

registerAeliqoElements();

const status = document.querySelector<HTMLElement>('#island-status');
if (status !== null) status.textContent = 'Island hydrated.';
