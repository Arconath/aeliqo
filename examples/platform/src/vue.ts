import './csp-bootstrap.js';
import { createApp, h, ref, type App, type VNode } from 'vue';
import { AeliqoInputEvent, registerAeliqoElements } from '@aeliqo/web';

registerAeliqoElements();

const VueFixture = {
  setup(): () => VNode {
    const value = ref('Vue');
    const onInput = (event: Event): void => {
      if (event instanceof AeliqoInputEvent) {
        value.value = event.detail.value;
      }
    };

    return () =>
      h('main', [
        h('h1', 'Vue platform fixture'),
        h('p', { id: 'vue-value', role: 'status' }, value.value),
        h('form', { id: 'vue-form' }, [
          h('aeliqo-input', {
            label: 'Vue name',
            value: value.value,
            name: 'person',
            'onAeliqo-input': onInput,
          }),
          h('button', { type: 'submit' }, 'Submit'),
        ]),
        h('aeliqo-table', {
          caption: 'People',
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'role', label: 'Role' },
          ],
          rows: [
            { name: 'Ada', role: 'Engineer' },
            { name: 'Grace', role: 'Researcher' },
          ],
        }),
        h('aeliqo-chart', {
          title: 'Weekly activity',
          summary: 'A small, accessible trend example.',
          unit: 'events',
          points: [
            { label: 'Mon', value: 3 },
            { label: 'Tue', value: 5 },
            { label: 'Wed', value: 4 },
          ],
        }),
      ]);
  },
};

const root = document.querySelector<HTMLDivElement>('#vue-root');
if (root === null) {
  throw new Error('The Vue platform fixture root is missing.');
}
const app: App<Element> = createApp(VueFixture);
app.mount(root);
