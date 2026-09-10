import './csp-bootstrap.js';
import {registerAeliqoElements, AeliqoInputEvent} from '@aeliqo/sdk-web';
import type {AeliqoInputElement, AeliqoTableElement, AeliqoChartElement} from '@aeliqo/sdk-web';
import {aeliqoStandaloneThemeStyles, aeliqoLocaleAttributes, createAeliqoLocaleContext} from '@aeliqo/sdk-web/styles';

const stylesheet = document.createElement('style');
stylesheet.nonce = 't02nonce';
stylesheet.textContent = aeliqoStandaloneThemeStyles.cssText;
document.head.append(stylesheet);
registerAeliqoElements();
const root = document.querySelector<HTMLElement>('#design-root')!;
const team = document.querySelector<AeliqoInputElement>('#team')!;
const people = document.querySelector<AeliqoTableElement>('#people')!;
const empty = document.querySelector<AeliqoTableElement>('#empty')!;
const activity = document.querySelector<AeliqoChartElement>('#activity')!;
const locale = document.querySelector<HTMLSelectElement>('#locale')!;
document.querySelector<HTMLSelectElement>('#theme')!.addEventListener('change', event => {
  root.dataset.aeliqoTheme = (event.currentTarget as HTMLSelectElement).value;
});
team.addEventListener('aeliqo-input', event => {
  if (!(event instanceof AeliqoInputEvent)) return;
  team.value = event.detail.value;
  document.querySelector('#draft-status')!.textContent = `Draft: ${event.detail.value}`;
});
document.querySelector('form')!.addEventListener('submit', event => event.preventDefault());

function renderLocale() {
  const attributes = aeliqoLocaleAttributes(createAeliqoLocaleContext(locale.value));
  for (const [name, value] of Object.entries(attributes)) root.setAttribute(name, value);
  const arabic = attributes.dir === 'rtl';
  document.querySelector('#page-title')!.textContent = arabic ? 'نظرة عامة على الفريق' : 'Team overview';
  document.querySelector('#intro')!.textContent = arabic ? 'بيانات تجريبية لعرض أعضاء الفريق ونشاطهم الأسبوعي.' : 'A small working view of people and their weekly activity.';
  document.querySelector('#details-title')!.textContent = arabic ? 'تفاصيل الفريق' : 'Team details';
  document.querySelector('#people-title')!.textContent = arabic ? 'أعضاء الفريق' : 'People';
  document.querySelector('#activity-title')!.textContent = arabic ? 'النشاط الأسبوعي' : 'Weekly activity';
  document.querySelector('#empty-title')!.textContent = arabic ? 'المهام القادمة' : 'Upcoming assignments';
  team.label = arabic ? 'الاسم الكامل للفريق المسؤول عن البحث والتطوير' : 'Team name';
  team.hint = arabic ? 'تبقى التغييرات محلية في هذا المثال التجريبي.' : 'Changes stay in this local fixture.';
  people.columns = [{key: 'name', label: arabic ? 'الاسم' : 'Name'}, {key: 'role', label: arabic ? 'الدور' : 'Role'}, {key: 'location', label: arabic ? 'الموقع' : 'Location'}];
  people.rows = [{name: 'Ada', role: arabic ? 'مهندسة' : 'Engineer', location: 'Jakarta'}, {name: 'Grace', role: arabic ? 'باحثة' : 'Researcher', location: 'London'}, {name: 'Katherine', role: arabic ? 'محللة' : 'Analyst', location: 'New York'}];
  empty.columns = people.columns;
  empty.emptyLabel = arabic ? 'لا توجد مهام قادمة.' : 'No upcoming assignments.';
  activity.title = arabic ? 'النشاط خلال خمسة أيام' : 'Activity across five days';
  activity.summary = arabic ? 'قيم تجريبية فقط.' : 'Illustrative values only.';
  activity.unit = 'events';
  activity.scope = 'Synthetic fixture · one week';
  activity.points = [{label: 'Mon', value: 3}, {label: 'Tue', value: 5}, {label: 'Wed', value: 4}, {label: 'Thu', value: 7}, {label: 'Fri', value: 6}];
}
locale.addEventListener('change', renderLocale);
renderLocale();
