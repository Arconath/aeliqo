import {registerAeliqoElements, type AeliqoTableElement} from '@aeliqo/web';

registerAeliqoElements();
const target = document.querySelector<HTMLElement>('#app');
if (target === null) throw new Error('The app target is missing.');

const table = document.createElement('aeliqo-table') as AeliqoTableElement;
table.caption = 'People';
table.columns = [
  {key: 'name', label: 'Name'},
  {key: 'team', label: 'Team'},
];
table.rows = [
  {id: 'p-1', name: 'Ada Chen', team: 'Design'},
  {id: 'p-2', name: 'Sam Rivera', team: 'Engineering'},
];
target.append(table);
