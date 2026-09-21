'use strict';
const SHEET_ID=window.DIN_CONFIG.sheetId;
const SHEETS=['PERIODOS','GRUPOS','EDIFICIOS','AULAS','ASIGNACION_AULAS'];
const REQUIRED={PERIODOS:['id_periodo','nombre','activo'],GRUPOS:['id_grupo','grupo','periodo','tutor'],EDIFICIOS:['id_edificio','nombre','activo'],AULAS:['id_aula','edificio','planta','activo'],ASIGNACION_AULAS:['periodo','turno','activo']};
const {str,norm,esc,active}=DIN;
const $=id=>document.getElementById(id);
let sourceIssues=[];
let data=null, model=null, mode='groups', busy=false, currentMap=null, chosenRoom=null, scale=1, opener=null;
function loadLegacySheet(sheet){
 return new Promise((resolve,reject)=>{
  const name='din_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script');let done=false;
  const timer=setTimeout(()=>finish(Error('La pestaña '+sheet+' no respondió.')),20000);
  function finish(error,rows){if(done)return;done=true;clearTimeout(timer);script.remove();window[name]=()=>{};setTimeout(()=>delete window[name],60000);error?reject(error):resolve(rows);}
  window[name]=response=>{try{if(response.status==='error')throw Error('No se pudo leer '+sheet);const keys=response.table.cols.map(c=>norm(c.label));if(REQUIRED[sheet].some(k=>!keys.includes(k)))throw Error('Revisa los encabezados de '+sheet);if(sheet==='ASIGNACION_AULAS'&&!(['grupo','salon'].every(k=>keys.includes(k))||['id_grupo','id_aula'].every(k=>keys.includes(k))))throw Error('ASIGNACION_AULAS necesita grupo y salon (o las columnas antiguas de IDs).');finish(null,DIN.objects(response.table));}catch(e){finish(e);}};
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
 if(sourceIssues.length){$('status').className='status error';$('status').textContent=sourceIssues.join(' · ');}
 if(model.issues.length){$('status').className='status error';$('status').textContent+=' '+model.issues.join(' · ');}
 window.dispatchEvent(new CustomEvent('din-data',{detail:{groups:model.groups,period:model.period}}));render();if(['profesores','grupos'].includes(mode))DIN_SCHEDULE.mount(mode,$('horarios'));
}
async function start(){
 if(busy)return;busy=true;if(['profesores','grupos'].includes(mode))DIN_SCHEDULE.mount(mode,$('horarios'));$('refresh').disabled=true;$('period').disabled=true;$('connection').textContent='Conectando…';
 const selected=$('period').value;data=null;model=null;$('results').innerHTML=empty('Consultando la información','Un momento, estamos leyendo la base académica.');$('status').textContent='Actualizando datos…';$('count').textContent='';
 if($('mapDialog').open)$('mapDialog').close();
 try{
  const snapshot=await DIN_SOURCE.load(SHEETS,loadLegacySheet);data=snapshot.data;sourceIssues=snapshot.issues; window.DIN_PLANOS=snapshot.plans||window.DIN_PLANOS;
  const periods=data.PERIODOS.filter(p=>active(p.activo));$('period').innerHTML=periods.length?periods.map(p=>`<option value="${esc(p.id_periodo)}">${esc(p.nombre)}</option>`).join(''):'<option value="">Sin periodo activo</option>';
  if(periods.some(p=>str(p.id_periodo)===selected))$('period').value=selected;
  $('period').disabled=!periods.length;refreshModel($('period').value);$('connection').textContent=snapshot.issues.length?'Información parcial':'Datos actualizados';  window.dispatchEvent(new CustomEvent('din-data',{detail:{groups:model.groups,period:model.period}}));$('connection').title='Consultados: '+new Date().toLocaleString('es-MX');
 }catch(e){$('connection').textContent='Sin conexión';$('period').innerHTML='<option value="">Datos no disponibles</option>';$('statGroups').textContent=$('statBuildings').textContent=$('statPlans').textContent='—';$('status').className='status error';$('status').textContent=e.message+' Pulsa «Actualizar datos» para volver a intentarlo.';$('results').innerHTML=empty('No pudimos cargar la información','No se muestran ubicaciones guardadas para evitar datos desactualizados.');}
 finally{busy=false;$('refresh').disabled=false;}
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
const searches={groups:'',tutors:'',rooms:''};
function matchingGroups(query){return model.groups.filter(g=>(!$('career').value||g.ingenieria===$('career').value)&&query.split(' ').every(term=>norm([g.grupo,g.tutor,g.correo,g.ingenieria,g.salida_lateral,g.generacion].join(' ')).includes(term))).sort((a,b)=>str(a.grupo).localeCompare(str(b.grupo),'es',{numeric:true}));}
function render(){
 if(!model)return;
 const query=norm($('search').value);$('clear').hidden=!query;
 if(mode==='profesores'||mode==='grupos')return;
 $('resultTitle').textContent=mode==='groups'?'Grupos del periodo':mode==='tutors'?'Tutores y sus grupos':'Edificios División Industrial';
 if(mode==='rooms'){renderBuildings(query);return;}
 if(mode==='tutors'&&!query&&!$('career').value){$('count').textContent='';$('results').innerHTML=empty(mode==='tutors'?'Encuentra a tu tutor':'Tu grupo, tu tutor y tu aula','Busca por grupo, nombre, carrera o correo.');return;}
 const groups=matchingGroups(query);
 if(mode==='groups'){$('count').textContent=groups.length+' grupos';$('results').innerHTML=groups.length?'<div class="group-picker" aria-label="Selecciona tu grupo">'+groups.map(g=>`<button type="button" class="group-pick" data-group="${esc(g.id_grupo)}"><strong>${esc(g.grupo)}</strong><small>${esc(g.ingenieria||'Ver tutor y aula')}</small></button>`).join('')+'</div><div id="groupDetail" class="group-detail"></div>':empty('Sin coincidencias','Prueba otro código, nombre, carrera o correo.');return;}
 const names=[...new Set(groups.map(g=>norm(g.tutor)).filter(n=>n&&!['sin tutor','fusion'].includes(n)))];
 $('count').textContent=names.length+' tutores';
 $('results').innerHTML=names.length?names.map(name=>{
  const all=model.groups.filter(g=>norm(g.tutor)===name),emails=[...new Set(all.map(g=>str(g.correo)).filter(e=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e)))];
  return `<article class="group-card"><h3>${esc(all[0].tutor)}</h3><p>${emails.length?emails.map(e=>`<a href="mailto:${esc(e)}">${esc(e)}</a>`).join('<br>'):'Correo pendiente de captura'}</p><p class="hint">Todos sus grupos del periodo, incluidas otras carreras.</p><div class="tutor-groups">${all.map(g=>`<div><b>${esc(g.grupo)}</b><span>${esc(g.ingenieria)}</span>${model.placements(g).map(p=>`<small>${esc(p.building.nombre)} · ${esc(p.room.planta)} · ${esc(model.roomLabel(p.room))}</small>${mapButton(p.room)}`).join('')}</div>`).join('')}</div></article>`;
 }).join(''):empty('No encontramos tutores','Prueba otro nombre o correo.');
}
function renderBuildings(query){
 const plans=window.DIN_PLANOS.filter(p=>model.buildings.some(b=>b.id_edificio===p.edificio));
 const groupMatches=query?model.groups.filter(g=>norm(g.grupo).replace(/\s/g,'').includes(query.replace(/\s/g,''))):[];
 const selected=new Set(groupMatches.flatMap(g=>model.placements(g).map(p=>str(p.room.id_aula))));
 const rows=model.rooms.map(r=>({r,b:model.building(r.edificio),gs:model.groups.filter(g=>model.placements(g).some(p=>p.room===r))})).filter(({r,b,gs})=>!query||(groupMatches.length?selected.has(str(r.id_aula)):query.split(' ').every(t=>norm([b.nombre,b.nombre_completo,r.planta,model.roomLabel(r),...gs.map(g=>g.grupo)].join(' ')).includes(t)))).sort((a,b)=>[a.b.nombre,a.r.planta,model.roomLabel(a.r)].join(' ').localeCompare([b.b.nombre,b.r.planta,model.roomLabel(b.r)].join(' '),'es',{numeric:true}));
 const shown=query?plans.filter(p=>rows.some(({r})=>model.geometry(r)?.plan===p)):plans;
 $('count').textContent=shown.length+' planos · '+rows.length+' salones';
 const summary=`<div class="building-summary"><h3>Salones y grupos asignados</h3>${groupMatches.length&&!selected.size?'<p>Aula pendiente de asignación para el grupo consultado.</p>':''}${rows.length?`<div class="table-scroll" role="region" aria-label="Asignaciones por edificio" tabindex="0"><table><thead><tr><th scope="col">Edificio</th><th scope="col">Planta</th><th scope="col">Salón</th><th scope="col">Grupo asignado</th></tr></thead><tbody>${rows.map(({r,b,gs})=>`<tr><td>${esc(b.nombre)}</td><td>${esc(r.planta)}</td><td>${esc(model.roomLabel(r))}${mapButton(r,'Ubicar')}</td><td>${gs.length?gs.map(g=>esc(g.grupo)).join(', '):'Sin asignación'}</td></tr>`).join('')}</tbody></table></div>`:empty('Sin ubicaciones para esta consulta','Prueba otro grupo, edificio, planta o salón.')}</div>`;
 $('results').innerHTML=summary+shown.map(p=>{const b=model.building(p.edificio);return `<button class="plan-card" type="button" data-plan="${esc(p.id)}" data-focus-room="${esc(rows.find(({r})=>selected.has(str(r.id_aula))&&model.geometry(r)?.plan===p)?.r.id_aula||'')}"><h3>${esc(b.nombre_completo||b.nombre)}</h3><p>Planta ${esc(norm(p.planta))}</p>${miniPlan(p,selected)}<strong>Ampliar plano y consultar aulas ↗</strong></button>`;}).join('');
}
function setMode(value){
 if(Object.hasOwn(searches,mode))searches[mode]=$('search').value;
 mode=value;const schedule=['profesores','grupos'].includes(value);
 document.querySelectorAll('[data-mode]').forEach(b=>{const on=b.dataset.mode===value;b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});
 for(const id of ['academicSearch','academicHeading','results','hint'])$(id).hidden=schedule;
 $('horarios').hidden=!schedule;$('careerWrap').hidden=!['groups','tutors'].includes(value);
 if(schedule){DIN_SCHEDULE.mount(value,$('horarios'));return;}
 DIN_SCHEDULE.cancel();$('search').value=searches[value]||'';
 $('search').placeholder=value==='rooms'?'Busca grupo, edificio, planta o salón…':value==='tutors'?'Busca tutor, correo, grupo o carrera…':'Busca grupo, carrera, tutor o correo…';
 $('search').setAttribute('aria-label',$('search').placeholder);
 $('hint').textContent=value==='rooms'?'Todos los planos vigentes. Busca un grupo para resaltar su salón en amarillo.':'Selecciona tu grupo. También puedes filtrar por carrera o buscar sin acentos.';render();if(['profesores','grupos'].includes(mode))DIN_SCHEDULE.mount(mode,$('horarios'));
}
function miniPlan(p,selected=new Set()){
 const rooms=model.rooms.filter(r=>model.geometry(r)?.plan===p),spaces=[...p.spaces];
 rooms.forEach(r=>{const s=model.geometry(r).space;if(s.key.startsWith('custom-'))spaces.push(s);});
 return `<svg class="mini-plan" viewBox="0 0 ${p.width} ${p.height}" aria-hidden="true">${p.background?`<image href="${esc(p.background)}" width="${p.width}" height="${p.height}"/>`:""}${spaces.map(s=>{const rs=rooms.filter(r=>model.geometry(r)?.space.key===s.key),on=rs.some(r=>selected.has(str(r.id_aula)));return (s.points?`<polygon points="${s.points.map(x=>x.join(',')).join(' ')}"`:`<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"`)+` fill="${on?'#ffdf57':s.kind==='corridor'?'#f0f0f0':'#ddd'}" stroke="${on?'#806000':'#888'}" stroke-width="${on?3:1.5}"/>`+svgText(rs.length===1?model.roomLabel(rs[0]):s.label,s.x+s.w/2,s.y+s.h/2,s.w-6,p.width>1000?15:10);}).join('')}</svg>`;
}

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
 return `<text x="${x}" y="${y-(lines.length-1)*size*.58}" text-anchor="middle" dominant-baseline="middle" font-size="${size}" fill="#333" font-family="DM Sans,system-ui,sans-serif">${lines.map((l,i)=>`<tspan x="${x}" dy="${i?size*1.2:0}">${esc(l)}</tspan>`).join('')}</text>`;
}
function drawMap(){
 if(!currentMap){$('mapCanvas').innerHTML=empty('Plano pendiente','Aún no se configuró la geometría de este edificio.');$('roomButtons').innerHTML='';$('roomDetail').textContent='';return;}
 const rooms=planRooms(),spaces=[...currentMap.spaces];rooms.forEach(r=>{const g=model.geometry(r);if(g?.space.key.startsWith('custom-'))spaces.push(g.space);});
 const svg=spaces.map(s=>{
  const mapped=rooms.filter(r=>model.geometry(r)?.space.key===s.key),r=mapped.length===1?mapped[0]:null;const selected=r&&chosenRoom&&str(r.id_aula)===str(chosenRoom.id_aula);
  const fill=selected?'#ffdf57':currentMap.background?'#7ab9f34d':r?'#dedede':s.kind==='corridor'?'#eee':s.kind==='desk'?'#c7c7c7':'#e5e5e5';
  const shape=s.points?`<polygon class="shape" points="${s.points.map(p=>p.join(',')).join(' ')}"`:`<rect class="shape" x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" rx="2"`;
  const label=r?model.roomLabel(r):s.label;const size=currentMap.width>1000?16:s.w<55?9:12;
  let extra='';if(s.kind==='stairs'){for(let i=1;i<=7;i++)extra+=`<path d="M${s.x+5} ${s.y+25+i*(s.h-30)/8}h${s.w-10}" stroke="#aaa" stroke-width="1"/>`;}
  const body=shape+` fill="${fill}" stroke="${selected?'#947315':s.kind==='corridor'?'none':'#888'}" stroke-width="${selected?3:1.3}"/>`+extra+(label?svgText(label,s.x+s.w/2,s.y+(s.kind==='stairs'?12:s.h/2),s.w-8,size):'');
  return r?`<g class="map-room" role="button" tabindex="0" data-map-room="${esc(r.id_aula)}" aria-label="${esc(label)}${selected?', aula seleccionada':''}"><title>${esc(label)}</title>${body}</g>`:`<g>${body}</g>`;
 }).join('');
 $('mapCanvas').innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${currentMap.width} ${currentMap.height}" role="group" aria-label="Plano de ${esc($('mapTitle').textContent)}, planta ${esc(norm(currentMap.planta))}">${currentMap.background?`<image href="${esc(currentMap.background)}" width="${currentMap.width}" height="${currentMap.height}"/>`:""}${svg}</svg>`;
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
$('results').addEventListener('click',e=>{const gb=e.target.closest('[data-group]');if(gb){const g=model.groups.find(g=>str(g.id_grupo)===gb.dataset.group);if(g){DIN_SCHEDULE.cancel();$('groupDetail').innerHTML=groupCard(g)+`<div id="inlineGroupSchedule"></div><button class="primary" type="button" data-group-schedule="${esc(g.grupo)}">Ver horario de ${esc(g.grupo)}</button>`;$('groupDetail').scrollIntoView({block:'nearest'});}return;} const sb=e.target.closest('[data-group-schedule]');if(sb){DIN_SCHEDULE.mount('grupos',$('inlineGroupSchedule'),{inline:true});DIN_SCHEDULE.select('grupos',sb.dataset.groupSchedule);return;}const planButton=e.target.closest('[data-plan]');if(planButton){const p=window.DIN_PLANOS.find(p=>p.id===planButton.dataset.plan);openMap(p.edificio,planButton.dataset.focusRoom||null);currentMap=p;$('floor').value=p.id;drawMap();return;}const roomButton=e.target.closest('[data-room]'),buildingButton=e.target.closest('[data-building]');if(roomButton){const room=model.rooms.find(r=>str(r.id_aula)===roomButton.dataset.room);if(room)openMap(model.building(room.edificio).id_edificio,str(room.id_aula));}else if(buildingButton)openMap(buildingButton.dataset.building);});
$('mapDialog').addEventListener('click',e=>{const t=e.target.closest('[data-map-room]');if(t)selectMapRoom(t.dataset.mapRoom);});
$('mapCanvas').addEventListener('keydown',e=>{const t=e.target.closest('[data-map-room]');if(t&&['Enter',' '].includes(e.key)){e.preventDefault();selectMapRoom(t.dataset.mapRoom);}});
$('floor').addEventListener('change',()=>{currentMap=window.DIN_PLANOS.find(p=>p.id===$('floor').value);chosenRoom=null;scale=1;drawMap();$('mapScroll').scrollLeft=0;$('mapScroll').scrollTop=0;});
function setMapSize(){$('mapCanvas').style.width=Math.max($('mapScroll').clientWidth,window.innerWidth<=760?740:650)*scale+'px';}
function zoom(delta){scale=Math.max(1,Math.min(4,scale+delta));setMapSize();if(chosenRoom)focusRoom();}
$('zoomIn').onclick=()=>zoom(.5);$('zoomOut').onclick=()=>zoom(-.5);$('zoomReset').onclick=()=>{scale=1;zoom(0);};
$('closeMap').onclick=()=>$('mapDialog').close();$('mapDialog').addEventListener('close',()=>opener?.focus());
$('search').addEventListener('input',render);$('career').addEventListener('change',render);$('period').addEventListener('change',()=>refreshModel($('period').value));$('clear').onclick=()=>{$('search').value='';render();$('search').focus();};document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('refresh').onclick=start;
setMode('groups');start();

// Revalidación periódica; cada módulo informa su disponibilidad.
setInterval(()=>{if(!document.hidden)start();},300000);

