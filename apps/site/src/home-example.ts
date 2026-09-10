import {AeliqoRecordListElement} from '@aeliqo/sdk-web/record-list';

/** Mount into an empty host element. All supplied records are synthetic. */
export function mountPeopleExample(container:HTMLElement){
 if(!customElements.get('aeliqo-record-list'))customElements.define('aeliqo-record-list',AeliqoRecordListElement);
 const rows=[{id:'ada',name:'Ada Chen',team:'Design',location:'Jakarta'},{id:'sam',name:'Sam Rivera',team:'Engineering',location:'Lisbon'},{id:'iman',name:'Iman Putra',team:'Engineering',location:'Bandung'},{id:'lee',name:'Lee Morgan',team:'Operations',location:'London'}];
 const list=new AeliqoRecordListElement();list.columns=[{key:'name',label:'Name'},{key:'team',label:'Team'},{key:'location',label:'Location'}];list.identity=['id'];list.entity='person';container.append(list);
 function filter(team='all'){const selected=rows.filter(row=>team==='all'||row.team===team);list.rows=selected;list.scope={label:team==='all'?'All synthetic people':`${team} · synthetic people`,kind:'filtered',loaded:selected.length,filteredTotal:selected.length};return selected.length;}
 filter();return{filter,dispose(){list.remove();}};
}
