/* Capa interactiva sobre el mapa oficial aportado por la coordinación. */
(()=>{
 const areas=[
  {name:'NANO · H1',aliases:['NANO (H1)','NANO_H1','H1','NANO'],points:'645,896 763,845 791,905 672,959'},
  {name:'H · Ambiental',aliases:['AMBIENTAL (H)','AMBIENTAL_H','H'],points:'714,995 847,940 875,1004 742,1060'},
  {name:'I',aliases:['I'],points:'768,1137 906,1078 930,1134 791,1194'},
  {name:'F',aliases:['F'],points:'958,1270 1092,1217 1119,1277 989,1336'},
  {name:'G',aliases:['G'],points:'955,922 1088,866 1115,932 980,987'},
  {name:'CIC 4.0',aliases:['CIC','CIC 4.0'],points:'920,414 948,369 934,340 1034,298 1065,256 1106,269 1076,318 1090,345 1000,380 956,431'},
  {name:'PIDET',aliases:['PIDET'],points:'901,242 932,194 916,168 1025,123 1048,85 1090,96 1070,139 1090,172 984,215 939,260'},
  {name:'Laboratorio D',aliases:['D'],reference:true,points:'817,1430 961,1375 988,1435 842,1495'},
  {name:'Laboratorio E',aliases:['E'],reference:true,points:'1003,1392 1080,1360 1107,1422 1030,1454'}
 ];
 let selected=null,campusScale=1,previousFocus=null;
 const dialog=$('campusDialog');
 function buildingFor(area){if(!model)return null;return model.buildings.find(b=>area.aliases.some(a=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>norm(v)===norm(a))));}
 function draw(){
  $('campusCanvas').innerHTML='<svg viewBox="0 0 1408 1787" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Mapa del campus UTEQ"><image href="campus-uteq.jpg" width="1408" height="1787" preserveAspectRatio="none"/>'+areas.map((a,i)=>`<polygon class="campus-hotspot ${a.reference?'reference':''} ${selected===i?'selected':''}" points="${a.points}" role="button" tabindex="0" data-campus-area="${i}" aria-label="${esc(a.name)}, consultar edificio" aria-pressed="${selected===i}"><title>${esc(a.name)}</title></polygon>`).join('')+'</svg>';
  $('campusChoices').innerHTML=areas.map((a,i)=>`<button type="button" data-campus-area="${i}" aria-pressed="${selected===i}" class="${selected===i?'selected':''}">${esc(a.name)}</button>`).join('');
  $('campusCanvas').style.width=(campusScale*100)+'%';
 }
 function summary(index){
  selected=index;const area=areas[index],b=buildingFor(area);draw();
  if(!b){$('campusSummary').innerHTML=`<h3>${esc(area.name)}</h3><p>${area.reference?'Laboratorio para otras actividades de la división. No tiene asignaciones de grupos en esta consulta.':'Los datos de este edificio no están disponibles en la consulta actual.'}</p><p class="hint">${area.reference?'Sus plantas y aulas se podrán consultar cuando se incorporen al catálogo y se publiquen sus planos.':'Actualiza los datos para volver a consultar.'}</p>`;return;}
  const rooms=model.rooms.filter(r=>model.building(r.edificio)?.id_edificio===b.id_edificio),groups=model.groups.filter(g=>model.placements(g).some(p=>p.building.id_edificio===b.id_edificio)),plans=window.DIN_PLANOS.filter(p=>p.edificio===b.id_edificio);
  const floors=[...new Set([...rooms.map(r=>norm(r.planta).replace(/^planta /,'')),...plans.map(p=>norm(p.planta).replace(/^planta /,''))])].sort((a,b)=>(a==='baja'?-1:b==='baja'?1:a.localeCompare(b)));
  $('campusSummary').innerHTML=`<span class="eyebrow dark">${esc(model.period?.nombre||'Periodo no disponible')}</span><h3>${esc(area.name)}</h3><p>${groups.length} grupos · ${rooms.length} aulas registradas</p><p class="campus-groups">${groups.length?groups.map(g=>esc(g.grupo)).join(' · '):'Sin grupos asignados en la información disponible.'}</p><h4>Elige una planta</h4><div class="campus-floors">${floors.map(f=>`<button type="button" data-campus-floor="${esc(f)}">Planta ${esc(f)}</button>`).join('')||'<p>Plantas pendientes de captura.</p>'}</div><div id="campusFloorDetail"></div>`;
 }
 function floorDetail(floor){
  const b=buildingFor(areas[selected]);if(!b)return;
  const rooms=model.rooms.filter(r=>model.building(r.edificio)?.id_edificio===b.id_edificio&&norm(r.planta).replace(/^planta /,'')===floor),plan=window.DIN_PLANOS.find(p=>p.edificio===b.id_edificio&&norm(p.planta).replace(/^planta /,'')===floor);
  $('campusFloorDetail').innerHTML=`<h4>Planta ${esc(floor)}</h4>${plan?`<button type="button" class="primary" data-campus-plan="${esc(plan.id)}">Ver plano y salones ↗</button>`:'<p>Plano pendiente de configurar.</p>'}<ul class="campus-rooms">${rooms.map(r=>{const groups=model.groups.filter(g=>model.placements(g).some(p=>p.room.id_aula===r.id_aula));return `<li><strong>${esc(model.roomLabel(r))}</strong><span>${groups.length?groups.map(g=>esc(g.grupo)).join(', '):'Sin grupo asignado'}</span></li>`;}).join('')}</ul>`;
 }
 $('openCampus').onclick=()=>{previousFocus=document.activeElement;selected=null;campusScale=1;draw();$('campusSummary').innerHTML='<h3>Elige un edificio</h3><p>Consulta sus grupos y selecciona una planta para ver las aulas.</p>';dialog.showModal();};
 $('closeCampus').onclick=()=>dialog.close();dialog.addEventListener('close',()=>previousFocus?.focus());
 dialog.addEventListener('click',e=>{const a=e.target.closest('[data-campus-area]'),f=e.target.closest('[data-campus-floor]'),p=e.target.closest('[data-campus-plan]');if(a)summary(Number(a.dataset.campusArea));else if(f)floorDetail(f.dataset.campusFloor);else if(p){const plan=window.DIN_PLANOS.find(x=>x.id===p.dataset.campusPlan);if(plan){openMap(plan.edificio);currentMap=plan;$('floor').value=plan.id;drawMap();}}});
 $('campusCanvas').addEventListener('keydown',e=>{const a=e.target.closest('[data-campus-area]');if(a&&['Enter',' '].includes(e.key)){e.preventDefault();const index=Number(a.dataset.campusArea);summary(index);$('campusCanvas').querySelector(`[data-campus-area="${index}"]`)?.focus();}});
 function zoom(delta){campusScale=Math.max(1,Math.min(3,campusScale+delta));$('campusCanvas').style.width=(campusScale*100)+'%';}
 $('campusMore').onclick=()=>zoom(.5);$('campusLess').onclick=()=>zoom(-.5);$('campusFit').onclick=()=>{campusScale=1;zoom(0);};
 window.addEventListener('din-data',()=>{if(dialog.open&&selected!==null)summary(selected);});
})();
