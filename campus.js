/* Capa interactiva sobre el mapa oficial aportado por la coordinación. */
(()=>{
 const areas=[
  {id:'NANO_H1',key:'N',name:'Nano',label:{x:717,y:901,text:'Nano',width:130},aliases:['N','NANO (H1)','NANO_H1','H1','NANO'],points:'645,896 763,845 791,905 672,959'},
  {id:'AMBIENTAL_H',label:{"x":794,"y":1000,"text":"H","width":95},name:'H · Ambiental',aliases:['AMBIENTAL (H)','AMBIENTAL_H','H'],points:'714,995 847,940 875,1004 742,1060'},
  {id:'I',label:{"x":849,"y":1136,"text":"I","width":90},name:'I',aliases:['I'],points:'768,1137 906,1078 930,1134 791,1194'},
  {id:'F',label:{"x":1040,"y":1274,"text":"F","width":90},name:'F',aliases:['F'],points:'958,1270 1092,1217 1119,1277 989,1336'},
  {id:'G',label:{"x":1035,"y":926,"text":"G","width":90},name:'G',aliases:['G'],points:'955,922 1088,866 1115,932 980,987'},
  {id:'CIC',label:{"x":1014,"y":344,"text":"CIC 4.0","width":160},name:'CIC 4.0',aliases:['CIC','CIC 4.0'],points:'920,414 948,369 934,340 1034,298 1065,256 1106,269 1076,318 1090,345 1000,380 956,431'},
  {id:'PIDET',label:{"x":999,"y":168,"text":"PIDET","width":155},name:'PIDET',aliases:['PIDET'],points:'901,242 932,194 916,168 1025,123 1048,85 1090,96 1070,139 1090,172 984,215 939,260'},
  {id:'D',key:'7EE',name:'7EE',label:{x:902,y:1430,text:'7EE',width:115},aliases:['7EE','7E-E','Laboratorio 7E-E','D'],reference:true,points:'817,1430 961,1375 988,1435 842,1495'},
  {id:'E',key:'4EE',name:'4EE',label:{x:1060,y:1402,text:'4EE',width:103},aliases:['4EE','4E-E','Laboratorio 4E-E','E'],reference:true,points:'1003,1392 1080,1360 1107,1422 1030,1454'}
 ].sort((a,b)=>DIN.naturalOrder(a.name,b.name));
 let selected=null,campusScale=1,previousFocus=null;
 function includeCatalog(){for(const b of model?.buildings||[])if(!areas.some(a=>buildingFor(a)?.id_edificio===b.id_edificio))areas.push({id:b.id_edificio,name:DIN.buildingLabel(b),aliases:[],points:''});areas.sort((a,b)=>DIN.naturalOrder(a.name,b.name));}
 const dialog=$('campusDialog');
 function buildingFor(area){if(!model)return null;return model.buildings.find(b=>b.id_edificio===area.id)||model.buildings.find(b=>area.aliases.some(a=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>norm(v)===norm(a))));}
 function draw(){
  $('campusCanvas').innerHTML='<svg viewBox="0 0 1408 1787" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Mapa del campus UTEQ"><image href="campus-uteq.jpg" width="1408" height="1787" preserveAspectRatio="none"/>'+areas.map((a,i)=>!a.points?'':`<polygon class="campus-hotspot ${a.reference?'reference':''} ${selected===i?'selected':''}" points="${a.points}" role="button" tabindex="0" data-campus-area="${i}" aria-label="${esc(a.name)}, consultar edificio" aria-pressed="${selected===i}"><title>${esc(a.name)}</title></polygon>${a.label?`<g pointer-events="none" transform="translate(${a.label.x} ${a.label.y}) rotate(-23)"><rect x="${-a.label.width/2}" y="-22" width="${a.label.width}" height="44" rx="5" fill="#b93240"/><text text-anchor="middle" dominant-baseline="middle" fill="white" font-family="system-ui,sans-serif" font-size="28" font-weight="700">${a.label.text}</text></g>`:''}` ).join('')+'</svg>';
  $('campusChoices').innerHTML=areas.map((a,i)=>`<button type="button" data-campus-area="${i}" aria-pressed="${selected===i}" class="${selected===i?'selected':''}">${esc(a.name)}</button>`).join('');
  $('campusCanvas').style.width=(campusScale*100)+'%';filterCampus();
 }
 function filterCampus(){const q=norm($('campusQuery').value);let shown=0;areas.forEach((area,i)=>{const b=buildingFor(area),rooms=b&&model?model.rooms.filter(r=>model.building(r.edificio)?.id_edificio===b.id_edificio):[],groups=b&&model?model.groups.filter(g=>model.placements(g).some(p=>p.building.id_edificio===b.id_edificio)):[];const text=norm([area.name,area.key,...rooms.map(r=>model.roomLabel(r)),...groups.map(g=>g.grupo)].join(' '));const match=q.split(' ').every(t=>text.includes(t));const button=$('campusChoices').querySelector('[data-campus-area="'+i+'"]');if(button)button.hidden=!match;if(match)shown++;});$('campusChoices').setAttribute('aria-label',shown+' edificios encontrados');}
 $('campusQuery').oninput=filterCampus;
 function summary(index){
  selected=index;const area=areas[index],b=buildingFor(area);draw();
  if(!b){$('campusSummary').innerHTML=`<h3>${esc(area.name)}</h3><p>${area.reference?'Laboratorio para otras actividades de la división. No tiene asignaciones de grupos en esta consulta.':'Los datos de este edificio no están disponibles en la consulta actual.'}</p><p class="hint">${area.reference?'Sus plantas y aulas se podrán consultar cuando se incorporen al catálogo y se publiquen sus planos.':'Actualiza los datos para volver a consultar.'}</p>`;return;}
  const rooms=model.rooms.filter(r=>model.building(r.edificio)?.id_edificio===b.id_edificio),groups=model.groups.filter(g=>model.placements(g).some(p=>p.building.id_edificio===b.id_edificio)),plans=window.DIN_PLANOS.filter(p=>p.edificio===b.id_edificio);
  const floors=[...new Set([...rooms.map(r=>norm(r.planta).replace(/^planta /,'')),...plans.map(p=>norm(p.planta).replace(/^planta /,''))])].sort(DIN.floorOrder);
  $('campusSummary').innerHTML=`<span class="eyebrow dark">${esc(model.period?.nombre||'Periodo no disponible')}</span><h3>${esc(area.name)}</h3><p>${groups.length} grupos · ${rooms.length} aulas registradas</p><p class="campus-groups">${groups.length?groups.map(g=>esc(g.grupo)).join(' · '):'Sin grupos asignados en la información disponible.'}</p><h4>Elige una planta</h4><div class="campus-floors">${floors.map(f=>`<button type="button" data-campus-floor="${esc(f)}">Planta ${esc(f)}</button>`).join('')||'<p>Plantas pendientes de captura.</p>'}</div><div id="campusFloorDetail"></div>`;
 }
 function floorDetail(floor){
  const b=buildingFor(areas[selected]);if(!b)return;
  const rooms=model.rooms.filter(r=>model.building(r.edificio)?.id_edificio===b.id_edificio&&norm(r.planta).replace(/^planta /,'')===floor),plan=window.DIN_PLANOS.find(p=>p.edificio===b.id_edificio&&norm(p.planta).replace(/^planta /,'')===floor);
  $('campusFloorDetail').innerHTML=`<h4>Planta ${esc(floor)}</h4>${plan?`<button type="button" class="primary" data-campus-plan="${esc(plan.id)}">Ver plano y salones ↗</button>`:'<p>Plano pendiente de configurar.</p>'}<ul class="campus-rooms">${rooms.map(r=>{const groups=model.groups.filter(g=>model.placements(g).some(p=>p.room.id_aula===r.id_aula));return `<li><strong>${esc(model.roomLabel(r))}</strong><span>${groups.length?groups.map(g=>esc(g.grupo)).join(', '):'Sin grupo asignado'}</span></li>`;}).join('')}</ul>`;
 }
 $('openCampus').onclick=()=>{previousFocus=document.activeElement;selected=null;includeCatalog();campusScale=1;$('campusQuery').value='';draw();$('campusSummary').innerHTML='<h3>Elige un edificio</h3><p>Consulta sus grupos y selecciona una planta para ver las aulas.</p>';dialog.showModal();};
 window.DIN_CAMPUS={openBuilding(id){$('openCampus').click();const i=areas.findIndex(a=>buildingFor(a)?.id_edificio===id);if(i>=0)summary(i);}};
 $('closeCampus').onclick=()=>dialog.close();dialog.addEventListener('close',()=>previousFocus?.focus());
 dialog.addEventListener('click',e=>{const a=e.target.closest('[data-campus-area]'),f=e.target.closest('[data-campus-floor]'),p=e.target.closest('[data-campus-plan]');if(a)summary(Number(a.dataset.campusArea));else if(f)floorDetail(f.dataset.campusFloor);else if(p){const plan=window.DIN_PLANOS.find(x=>x.id===p.dataset.campusPlan);if(plan){openMap(plan.edificio);currentMap=plan;$('floor').value=plan.id;drawMap();}}});
 $('campusCanvas').addEventListener('keydown',e=>{const a=e.target.closest('[data-campus-area]');if(a&&['Enter',' '].includes(e.key)){e.preventDefault();const index=Number(a.dataset.campusArea);summary(index);$('campusCanvas').querySelector(`[data-campus-area="${index}"]`)?.focus();}});
 function zoom(delta){campusScale=Math.max(1,Math.min(3,campusScale+delta));$('campusCanvas').style.width=(campusScale*100)+'%';}
 $('campusMore').onclick=()=>zoom(.5);$('campusLess').onclick=()=>zoom(-.5);$('campusFit').onclick=()=>{campusScale=1;zoom(0);};
 window.addEventListener('din-data',()=>{if(dialog.open&&selected!==null)summary(selected);});
})();
