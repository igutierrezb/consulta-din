'use strict';
const SHEET_ID=window.DIN_CONFIG.sheetId;
const SHEETS=['PERIODOS','GRUPOS','EDIFICIOS','AULAS','ASIGNACION_AULAS'];
const REQUIRED={PERIODOS:['id_periodo','nombre','activo'],GRUPOS:['id_grupo','grupo','periodo','tutor'],EDIFICIOS:['id_edificio','nombre','activo'],AULAS:['id_aula','edificio','planta','activo'],ASIGNACION_AULAS:['id_asignacion','periodo','id_aula','id_grupo','turno','activo']};
const {str,norm,esc,active}=DIN;
const $=id=>document.getElementById(id);
let data=null, model=null, mode='groups', busy=false, currentMap=null, chosenRoom=null, scale=1, opener=null;
function loadSheet(sheet){
 return new Promise((resolve,reject)=>{
  const name='din_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script');let done=false;
  const timer=setTimeout(()=>finish(Error('La pestaña '+sheet+' no respondió.')),20000);
  function finish(error,rows){if(done)return;done=true;clearTimeout(timer);script.remove();window[name]=()=>{};setTimeout(()=>delete window[name],60000);error?reject(error):resolve(rows);}
  window[name]=response=>{try{if(response.status==='error')throw Error('No se pudo leer '+sheet);const keys=response.table.cols.map(c=>norm(c.label));if(REQUIRED[sheet].some(k=>!keys.includes(k)))throw Error('Revisa los encabezados de '+sheet);finish(null,DIN.objects(response.table));}catch(e){finish(e);}};
  script.onerror=()=>finish(Error('No se pudo conectar con '+sheet));
  script.src=`https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?sheet=${encodeURIComponent(sheet)}&headers=1&tqx=responseHandler:${name}&_=${Date.now()}`;
  document.head.appendChild(script);
 });
}
function empty(title,detail){return `<div class="empty"><strong>${esc(title)}</strong>${esc(detail)}</div>`;}
function buildModel(id){model=DIN.model(data,id,window.DIN_PLANOS);}
function refreshModel(id){
 buildModel(id);$('statGroups').textContent=model.groups.length;$('statBuildings').textContent=model.buildings.length;$('statPlans').textContent=window.DIN_PLANOS.filter(p=>model.buildings.some(b=>b.id_edificio===p.edificio)).length;
 const career=$('career').value;$('career').innerHTML='<option value="">Todas las carreras</option>'+[...new Set(model.groups.map(g=>str(g.ingenieria)).filter(Boolean))].sort().map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join('');if([...$('career').options].some(o=>o.value===career))$('career').value=career;
 $('status').className='status';
 $('status').textContent=!model.period?'No hay un periodo activo para consultar grupos.':!model.assignments.some(a=>active(a.activo))?'Las asignaciones de aulas de este periodo están pendientes de captura. Puedes consultar grupos, tutores y los planos de los edificios.':'';
 render();renderSchedules();
}
async function start(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('period').disabled=true;$('connection').textContent='Conectando…';
 const selected=$('period').value;data=null;model=null;$('results').innerHTML=empty('Consultando la información','Un momento, estamos leyendo la base académica.');$('status').textContent='Actualizando datos…';$('count').textContent='';
 if($('mapDialog').open)$('mapDialog').close();
 try{
  const rows=await Promise.all(SHEETS.map(loadSheet));data=Object.fromEntries(SHEETS.map((s,i)=>[s,rows[i]]));
  const periods=data.PERIODOS.filter(p=>active(p.activo));$('period').innerHTML=periods.length?periods.map(p=>`<option value="${esc(p.id_periodo)}">${esc(p.nombre)}</option>`).join(''):'<option value="">Sin periodo activo</option>';
  if(periods.some(p=>str(p.id_periodo)===selected))$('period').value=selected;
  $('period').disabled=!periods.length;refreshModel($('period').value);$('connection').textContent='Datos actualizados';$('connection').title='Consultados: '+new Date().toLocaleString('es-MX');
 }catch(e){$('connection').textContent='Sin conexión';$('period').innerHTML='<option value="">Datos no disponibles</option>';$('statGroups').textContent=$('statBuildings').textContent=$('statPlans').textContent='—';$('status').className='status error';$('status').textContent=e.message+' Pulsa «Actualizar datos» para volver a intentarlo.';$('results').innerHTML=empty('No pudimos cargar la información','No se muestran ubicaciones guardadas para evitar datos desactualizados.');}
 finally{busy=false;$('refresh').disabled=false;if(!model)renderSchedules();}
}
function groupCard(g){
 const placements=model.placements(g),email=str(g.correo),validEmail=/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email);
 const initials=str(g.tutor).split(/\s+/).slice(0,2).map(w=>w[0]).join('');
 return `<article class="group-card"><div class="card-top"><h3 class="code">${esc(g.grupo)}</h3><span class="badge">${g.cuatrimestre?esc(g.cuatrimestre)+'º cuatrimestre':'Grupo'}</span></div><p class="career">${esc(g.ingenieria)}${g.salida_lateral?' · '+esc(g.salida_lateral):''}</p><div class="person"><span class="avatar" aria-hidden="true">${esc(initials||'—')}</span><div><small>TUTOR / TUTORA</small><strong>${esc(g.tutor||'Pendiente de asignación')}</strong></div></div><div class="fields"><div class="field"><small>GENERACIÓN</small>${esc(g.generacion||'—')}</div><div class="field"><small>CORREO</small>${validEmail?`<a href="mailto:${esc(email)}">${esc(email)}</a>`:'Correo pendiente de captura'}</div></div>${placements.length?placements.map(p=>`<div class="placement"><div class="placement-head"><div><strong>${esc(p.building.nombre_completo||p.building.nombre)}</strong><p>Planta ${esc(norm(p.room.planta).replace(/^planta /,''))} · ${esc(model.roomLabel(p.room))}</p></div><span class="turn">${esc(p.assignment.turno||'Sin turno registrado')}</span></div>${mapButton(p.room,'Ubicar mi aula')} </div>`).join(''):'<p class="pending">Aula pendiente de asignación para este periodo.</p>'}</article>`;
}
function mapButton(room,label='Ver en el plano'){
 const geo=model.geometry(room);return geo?`<button class="map-button" type="button" data-room="${esc(room.id_aula)}">${label}<span aria-hidden="true">↗</span></button>`:'<p class="pending">Ubicación registrada; plano pendiente de configurar.</p>';
}
function roomCard(r){return `<article class="room-result"><h3>${esc(model.roomLabel(r))}</h3><p>${esc(model.building(r.edificio).nombre_completo||r.edificio)} · Planta ${esc(norm(r.planta))}<br>${r.capacidad?'Capacidad: '+esc(r.capacidad)+' personas':''}${r.observaciones?'<br>'+esc(r.observaciones):''}</p>${mapButton(r)}</article>`;}
function render(){
 if(!model)return;const query=norm($('search').value);$('clear').hidden=!query;$('resultTitle').textContent=mode==='groups'?'Grupos del periodo':query?'Aulas encontradas':'Explora los edificios';
 if(mode==='groups'){
  if(!query&&!$('career').value){$('count').textContent='';$('results').innerHTML=empty('Tu grupo, tu tutor y tu aula','Escribe un grupo, nombre, carrera o correo para comenzar.');return;}
  const groups=model.groups.filter(g=>(!$('career').value||g.ingenieria===$('career').value)&&query.split(' ').every(term=>norm([g.grupo,g.tutor,g.correo,g.ingenieria,g.salida_lateral,g.generacion].join(' ')).includes(term))).sort((a,b)=>str(a.grupo).localeCompare(str(b.grupo),'es',{numeric:true}));
  $('count').textContent=groups.length+' '+(groups.length===1?'grupo':'grupos');$('results').innerHTML=groups.length?groups.map(groupCard).join(''):empty('No encontramos grupos',model.period?'Prueba con otro código, tutor o carrera.':'No hay un periodo activo.');
 }else if(query){
  const rooms=model.rooms.filter(r=>query.split(' ').every(term=>norm([r.id_aula,r.edificio,model.building(r.edificio).nombre_completo,r.planta,model.roomLabel(r),r.tipo,r.observaciones].join(' ')).includes(term)));
  $('count').textContent=rooms.length+' aulas';$('results').innerHTML=rooms.length?rooms.map(roomCard).join(''):empty('No encontramos aulas','Prueba con un edificio, planta o salón.');
 }else{
  $('count').textContent=model.buildings.length+' edificios';const buildingMarkup=model.buildings.map(b=>{const plans=window.DIN_PLANOS.filter(p=>p.edificio===b.id_edificio);return `<button class="building-card" type="button" data-building="${esc(b.id_edificio)}"><span class="building-symbol">${esc(b.nombre==='NANO (H1)'?'H1':b.nombre==='AMBIENTAL (H)'?'H':b.nombre)}</span><span><strong>${esc(b.nombre)}</strong><small>${plans.length?plans.map(p=>'Planta '+norm(p.planta)).join(' · '):'Plano pendiente'}</small></span><span class="arrow" aria-hidden="true">↗</span></button>`;}).join('')||empty('No hay edificios activos','La División Industrial actualizará la disponibilidad.');
  const occupied=new Set(model.groups.flatMap(g=>model.placements(g).map(p=>model.geometry(p.room)?.plan.id)).filter(Boolean));
  const ordered=window.DIN_PLANOS.filter(p=>occupied.has(p.id)).sort((a,b)=>a.id.localeCompare(b.id,'es',{numeric:true}));
  $('count').textContent=ordered.length+' planos con grupos';
  $('results').innerHTML=(ordered.length?ordered.map(p=>{const b=model.buildings.find(b=>b.id_edificio===p.edificio);const n=model.groups.filter(g=>model.placements(g).some(a=>model.geometry(a.room)?.plan.id===p.id)).length;return `<button class="plan-card" type="button" data-plan="${esc(p.id)}"><h3>${esc(b.nombre_completo||b.nombre)}</h3><p>Planta ${esc(norm(p.planta))} · ${n} grupos</p>${miniPlan(p)}<strong>Explorar plano ↗</strong></button>`;}).join(''):'<p class="plan-empty">Aún no hay planos con grupos asignados en este periodo. Puedes explorar todos los edificios disponibles abajo.</p>')+`<details class="all-buildings" ${ordered.length?'':'open'}><summary>Todos los edificios activos (${model.buildings.length})</summary><div class="building-grid">${buildingMarkup}</div></details>`;
 }
}
function setMode(value){mode=value;$('groupsTab').classList.toggle('active',value==='groups');$('roomsTab').classList.toggle('active',value==='rooms');$('groupsTab').setAttribute('aria-pressed',String(value==='groups'));$('roomsTab').setAttribute('aria-pressed',String(value==='rooms'));$('careerWrap').hidden=value!=='groups';$('search').value='';$('search').placeholder=value==='groups'?'Busca por grupo, tutor, carrera o correo…':'Busca un edificio, planta o salón…';$('search').setAttribute('aria-label',value==='groups'?'Buscar grupo, tutor, carrera o correo':'Buscar edificio, planta o salón');$('hint').textContent=value==='groups'?'Escribe el código completo de tu grupo o una parte del nombre de tu tutor.':'Selecciona un edificio para explorar sus plantas y sus aulas.';render();}
function miniPlan(p){return `<svg class="mini-plan" viewBox="0 0 ${p.width} ${p.height}" aria-hidden="true">${p.spaces.map(s=>(s.points?`<polygon points="${s.points.map(x=>x.join(',')).join(' ')}"`:`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"`)+` fill="${s.kind==='room'?'#d8e1ed':s.kind==='corridor'?'#f1f4f8':'#e7ebf0'}" stroke="#8a99ac" stroke-width="1.5"/>`).join('')}</svg>`;}
function renderSchedules(){
 $('horarios').innerHTML=Object.entries(window.DIN_CONFIG.horarios).map(([kind,c])=>{
  const index=window.DIN_HORARIOS?.[kind],valid=index&&index.periodo===str(model?.period?.id_periodo)&&index.periodo===c.periodo&&index.driveId===c.driveId&&index.archivo===c.archivo;
  return `<article class="schedule"><span class="eyebrow">DIVISIÓN INDUSTRIAL · TURNO MATUTINO</span><h2>${esc(c.titulo)}</h2><p>${valid?`${index.totalPaginas} ${kind==='profesores'?'profesores':'grupos'} · Copia local del periodo ${esc(index.periodo)} · Documento: ${esc(index.fechaDocumento.replace('aSc Horarios','').trim())}`:'Índice no disponible para el periodo seleccionado. Consulta el archivo original en Drive.'}</p>${valid?`<label class="sr-only" for="schedule-${kind}">Buscar horario ${kind==='profesores'?'por nombre de profesor':'por grupo'}</label><input id="schedule-${kind}" type="search" data-schedule="${kind}" placeholder="${kind==='profesores'?'Nombre del profesor…':'Código del grupo…'}"><div class="schedule-results" id="schedule-results-${kind}" aria-live="polite"></div>`:''}<div class="schedule-links"><a target="_blank" rel="noopener" href="https://drive.google.com/file/d/${encodeURIComponent(c.driveId)}/view">Abrir original en Drive ↗</a>${valid?`<a target="_blank" rel="noopener" href="${esc(c.archivo)}">Abrir PDF local ↗</a>`:''}</div><p class="schedule-note">${valid?'La búsqueda corresponde a esta copia. En algunos móviles, abre el PDF y ve al número de página indicado.':'El archivo de Drive puede corresponder a otro periodo; verifica su fecha.'}</p></article>`;
 }).join('');
}
function searchSchedule(input){const kind=input.dataset.schedule,c=window.DIN_CONFIG.horarios[kind],index=window.DIN_HORARIOS?.[kind],q=norm(input.value);if(!index)return;const matches=index.paginas.filter(p=>q.split(' ').every(t=>norm(p.nombre).includes(t)));$('schedule-results-'+kind).innerHTML=!q?'':!matches.length?'<p>No hay coincidencias en esta copia del horario.</p>':matches.map(p=>`<a class="schedule-result" href="${esc(c.archivo)}#page=${p.pagina}" target="_blank" rel="noopener"><b>${esc(p.nombre)}</b><small>Abrir horario · Página ${p.pagina} de ${index.totalPaginas} ↗</small></a>`).join('');}
function openMap(buildingId,roomId){
 if(!model)return;const room=roomId?model.rooms.find(r=>str(r.id_aula)===roomId):null;const geo=room?model.geometry(room):null;
 const plans=window.DIN_PLANOS.filter(p=>p.edificio===buildingId);const b=model.buildings.find(b=>b.id_edificio===buildingId);if(!b)return;
 currentMap=geo?.plan||plans[0]||null;chosenRoom=room;scale=1;opener=document.activeElement;$('mapTitle').textContent=b.nombre_completo||b.nombre;
 $('mapSubtitle').textContent=model.period?'Consulta de '+model.period.nombre+' · Planos esquemáticos, sin escala.':'Planos esquemáticos, sin escala.';
 $('floor').innerHTML=plans.map(p=>`<option value="${esc(p.id)}">Planta ${esc(norm(p.planta))}</option>`).join('');$('floor').disabled=!plans.length;if(currentMap)$('floor').value=currentMap.id;
 drawMap();$('mapDialog').showModal();zoom(0);$('mapScroll').scrollLeft=0;$('mapScroll').scrollTop=0;
 if(chosenRoom)focusRoom();
}
function planRooms(){return model.rooms.filter(r=>model.geometry(r)?.plan.id===currentMap?.id);}
function svgText(text,x,y,width,size=13){
 const max=Math.max(3,Math.floor(width/(size*.53))),words=str(text).split(/\s+/),lines=[];let line='';
 for(const word of words){if((line+' '+word).trim().length>max&&line){lines.push(line);line=word;}else line=(line+' '+word).trim();}if(line)lines.push(line);
 return `<text x="${x}" y="${y-(lines.length-1)*size*.58}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" fill="#243b56" font-family="DM Sans,system-ui,sans-serif">${lines.map((l,i)=>`<tspan x="${x}" dy="${i?size*1.2:0}">${esc(l)}</tspan>`).join('')}</text>`;
}
function drawMap(){
 if(!currentMap){$('mapCanvas').innerHTML=empty('Plano pendiente','Aún no se configuró la geometría de este edificio.');$('roomButtons').innerHTML='';$('roomDetail').textContent='';return;}
 const rooms=planRooms(),spaces=[...currentMap.spaces];rooms.forEach(r=>{const g=model.geometry(r);if(g?.space.key.startsWith('custom-'))spaces.push(g.space);});
 const svg=spaces.map(s=>{
  const mapped=rooms.filter(r=>model.geometry(r)?.space.key===s.key),r=mapped.length===1?mapped[0]:null;const selected=r&&chosenRoom&&str(r.id_aula)===str(chosenRoom.id_aula);
  const fill=selected?'#ffdf57':r?'#dbe0e6':s.kind==='corridor'?'#edf0f3':s.kind==='desk'?'#c1c7cf':'#e2e5e9';
  const shape=s.points?`<polygon class="shape" points="${s.points.map(p=>p.join(',')).join(' ')}"`:`<rect class="shape" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="2"`;
  const label=r?model.roomLabel(r):s.label;const size=currentMap.width>1000?16:s.w<55?9:12;
  let extra='';if(s.kind==='stairs'){for(let i=1;i<=7;i++)extra+=`<path d="M${s.x+5} ${s.y+25+i*(s.h-30)/8}h${s.w-10}" stroke="#a5b2a4" stroke-width="1"/>`;}
  const body=shape+` fill="${fill}" stroke="${selected?'#947315':s.kind==='corridor'?'none':'#798391'}" stroke-width="${selected?3:1.3}"/>`+extra+(label?svgText(label,s.x+s.w/2,s.y+(s.kind==='stairs'?12:s.h/2),s.w-8,size):'');
  return r?`<g class="map-room" role="button" tabindex="0" data-map-room="${esc(r.id_aula)}" aria-label="${esc(label)}${selected?', aula seleccionada':''}"><title>${esc(label)}</title>${body}</g>`:`<g>${body}</g>`;
 }).join('');
 $('mapCanvas').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${currentMap.width} ${currentMap.height}" role="group" aria-label="Plano de ${esc($('mapTitle').textContent)}, planta ${esc(norm(currentMap.planta))}">${svg}</svg>`;
 setMapSize();$('roomButtons').innerHTML=rooms.map(r=>`<button type="button" data-map-room="${esc(r.id_aula)}" class="${chosenRoom&&r.id_aula===chosenRoom.id_aula?'selected':''}">${esc(model.roomLabel(r))}</button>`).join('');
 drawRoomDetail();
}
function drawRoomDetail(){
 if(!chosenRoom){$('roomDetail').innerHTML='Selecciona un aula en el plano o en la lista inferior.';return;}
 const groups=model.groups.flatMap(g=>model.placements(g).filter(p=>p.room.id_aula===chosenRoom.id_aula).map(p=>({g,p})));
 $('roomDetail').innerHTML=`<h3>${esc(model.roomLabel(chosenRoom))}</h3><div>${esc(model.building(chosenRoom.edificio).nombre_completo||chosenRoom.edificio)} · Planta ${esc(norm(chosenRoom.planta))}${chosenRoom.capacidad?' · '+esc(chosenRoom.capacidad)+' personas':''}</div>${groups.length?groups.map(({g,p})=>`<div><b>${esc(g.grupo)}</b> · ${esc(p.assignment.turno||'Sin turno registrado')} · ${esc(g.tutor||'Tutor pendiente')}</div>`).join(''):'<div>Sin grupos asignados en este periodo.</div>'}${chosenRoom.observaciones?'<div>'+esc(chosenRoom.observaciones)+'</div>':''}`;
}
function focusRoom(){const g=chosenRoom&&model.geometry(chosenRoom);if(!g)return;const container=$('mapScroll'),canvas=$('mapCanvas');const ratio=canvas.getBoundingClientRect().width/currentMap.width;container.scrollLeft=(g.space.x+g.space.w/2)*ratio-container.clientWidth/2;container.scrollTop=(g.space.y+g.space.h/2)*ratio-container.clientHeight/2;}
function selectMapRoom(id){chosenRoom=planRooms().find(r=>str(r.id_aula)===id)||null;const keyboard=document.activeElement?.hasAttribute('data-map-room');drawMap();focusRoom();if(keyboard)[...$('mapCanvas').querySelectorAll('[data-map-room]')].find(e=>e.dataset.mapRoom===id)?.focus({preventScroll:true});}
$('results').addEventListener('click',e=>{const planButton=e.target.closest('[data-plan]');if(planButton){const p=window.DIN_PLANOS.find(p=>p.id===planButton.dataset.plan);openMap(p.edificio);currentMap=p;chosenRoom=null;$('floor').value=p.id;drawMap();return;}const roomButton=e.target.closest('[data-room]'),buildingButton=e.target.closest('[data-building]');if(roomButton){const room=model.rooms.find(r=>str(r.id_aula)===roomButton.dataset.room);if(room)openMap(model.building(room.edificio).id_edificio,str(room.id_aula));}else if(buildingButton)openMap(buildingButton.dataset.building);});
$('mapDialog').addEventListener('click',e=>{const t=e.target.closest('[data-map-room]');if(t)selectMapRoom(t.dataset.mapRoom);});
$('mapCanvas').addEventListener('keydown',e=>{const t=e.target.closest('[data-map-room]');if(t&&['Enter',' '].includes(e.key)){e.preventDefault();selectMapRoom(t.dataset.mapRoom);}});
$('floor').addEventListener('change',()=>{currentMap=window.DIN_PLANOS.find(p=>p.id===$('floor').value);chosenRoom=null;scale=1;drawMap();$('mapScroll').scrollLeft=0;$('mapScroll').scrollTop=0;});
function setMapSize(){$('mapCanvas').style.width=Math.max($('mapScroll').clientWidth,window.innerWidth<=760?740:650)*scale+'px';}
function zoom(delta){scale=Math.max(1,Math.min(4,scale+delta));setMapSize();if(chosenRoom)focusRoom();}
$('zoomIn').onclick=()=>zoom(.5);$('zoomOut').onclick=()=>zoom(-.5);$('zoomReset').onclick=()=>{scale=1;zoom(0);};
$('closeMap').onclick=()=>$('mapDialog').close();$('mapDialog').addEventListener('close',()=>opener?.focus());
$('search').addEventListener('input',render);$('career').addEventListener('change',render);$('period').addEventListener('change',()=>refreshModel($('period').value));$('clear').onclick=()=>{$('search').value='';render();$('search').focus();};$('groupsTab').onclick=()=>setMode('groups');$('roomsTab').onclick=()=>setMode('rooms');$('refresh').onclick=start;
start();
$('horarios').addEventListener('input',e=>{if(e.target.matches('[data-schedule]'))searchSchedule(e.target);});
// Refresh the full snapshot together; failures clear old locations instead of preserving them.
setInterval(()=>{if(!document.hidden)start();},300000);
