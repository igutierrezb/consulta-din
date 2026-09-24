(function(root){
  'use strict';
  var DIN=root.DIN4,host=null,snapshot=null,model=null,queries={profesores:'',grupos:'',salones:''};
  function periodId(){return root.DIN_APP4&&root.DIN_APP4.periodId?root.DIN_APP4.periodId():'';}
  function scheduleFor(kind){
    var p=periodId(),current=snapshot&&snapshot.schedules&&snapshot.schedules[p]&&snapshot.schedules[p][kind]||null;
    if(current&&current.optimized&&Array.isArray(current.pages)&&current.pages.length)return current;
    var legacy=root.DIN_LEGACY_SCHEDULES4&&root.DIN_LEGACY_SCHEDULES4[p]&&root.DIN_LEGACY_SCHEDULES4[p][kind]||null;
    return legacy||current;
  }
  function aliasesFor(period){return snapshot&&snapshot.teacherAliases&&snapshot.teacherAliases[period]||[];}
  function aliasByPublic(period,name){var n=DIN.norm(name);return aliasesFor(period).find(function(a){return DIN.norm(a.publicName)===n;})||null;}
  function aliasBySource(period,name){var n=DIN.norm(name);return aliasesFor(period).find(function(a){return DIN.norm(a.sourceName)===n;})||null;}
  function surnameFirst(name){
    var value=DIN.str(name).replace(/\s+/g,' ');if(!value)return '';
    if(value.indexOf(',')>=0){var parts=value.split(',');return (DIN.str(parts[0])+' '+DIN.str(parts.slice(1).join(' '))).trim();}
    var words=value.split(' ').filter(Boolean);if(words.length===1)return value;if(words.length===2)return words[1]+' '+words[0];
    var connectors={de:1,del:1,la:1,las:1,los:1,y:1},maternalStart=words.length-1;
    while(maternalStart>1&&connectors[DIN.norm(words[maternalStart-1])])maternalStart--;
    var paternalStart=maternalStart-1;while(paternalStart>0&&connectors[DIN.norm(words[paternalStart-1])])paternalStart--;
    return words.slice(paternalStart).join(' ')+' '+words.slice(0,paternalStart).join(' ');
  }
  function displayLabel(kind,page,period){
    if(kind!=='profesores')return page.label;
    var a=aliasBySource(period,page.label),raw=a&&a.publicName||page.label;
    return surnameFirst(raw);
  }
  function list(kind){var s=scheduleFor(kind);if(!s||!Array.isArray(s.pages))return [];var period=s.periodo||periodId();return s.pages.map(function(p){return {page:p,label:p.label,display:displayLabel(kind,p,period)};});}
  function title(kind){return kind==='profesores'?'Horarios de maestros':kind==='grupos'?'Horarios por grupo':'Horarios de salones';}
  function example(kind){return kind==='profesores'?'Apellido, nombre o parte del nombre':kind==='grupos'?'Código del grupo':'Edificio, planta o salón';}
  function fetchPrivateImage(kind,label){
    return new Promise(function(resolve,reject){
      try{
        var u=new URL(root.DIN_CONFIG.endpoint);u.searchParams.set('action','schedule4');u.searchParams.set('kind',kind);u.searchParams.set('label',label);u.searchParams.set('image','1');
        fetch(u.href,{credentials:'omit',cache:'default'}).then(function(r){if(!r.ok)throw Error('Servicio de respaldo no disponible.');return r.json();}).then(function(x){if(!x||!x.ok||!x.dataUrl)throw Error(x&&x.error||'Imagen no disponible.');resolve(x.dataUrl);}).catch(reject);
      }catch(e){reject(e);}
    });
  }
  function clearResult(){if(!host)return;var a=host.querySelector('#scheduleMatches'),b=host.querySelector('#schedulePage');if(a)a.replaceChildren();if(b)b.replaceChildren();}
  function status(text){if(host){var el=host.querySelector('#scheduleStatus');if(el)el.textContent=text;}}
  function mount(kind,element,options){
    host=element;options=options||{};var q=queries[kind]||'',s=scheduleFor(kind);host.hidden=false;
    host.innerHTML='<div class="schedule-panel"><h3>'+DIN.esc(title(kind))+'</h3><form id="scheduleForm"><label class="sr-only" for="scheduleQuery">'+DIN.esc(example(kind))+'</label><div class="schedule-search"><input id="scheduleQuery" type="search" autocomplete="off" maxlength="140" placeholder="'+DIN.esc(example(kind))+'" value="'+DIN.esc(q)+'"><button class="primary" type="submit">Buscar</button></div></form><p id="scheduleStatus" class="hint" aria-live="polite"></p><div id="scheduleSuggestions" class="schedule-suggestions" aria-label="Opciones de horario"></div><div id="scheduleMatches"></div><div id="schedulePage"></div></div>';
    var input=host.querySelector('#scheduleQuery');
    input.oninput=function(){queries[kind]=input.value;if(kind==='salones')renderRoomDirectory();else renderSuggestions(kind);clearResult();};
    host.querySelector('form').onsubmit=function(e){e.preventDefault();if(kind==='salones')renderRoomDirectory(true);else search(kind,input.value);};
    if(kind==='salones'){renderRoomDirectory();return;}
    if(!s){status('Todavía no se ha publicado este horario para el periodo vigente.');return;}
    if(!s.optimized||!Array.isArray(s.pages)||!s.pages.length){status('Este horario todavía utiliza el formato anterior.');if(s.pdfUrl){var a=document.createElement('a');a.className='primary';a.href=s.pdfUrl;a.target='_blank';a.rel='noopener';a.textContent='Abrir PDF vigente ↗';host.querySelector('#schedulePage').appendChild(a);}return;}
    status('Selecciona una opción o escribe para buscar. Solo se descargará el horario elegido.');renderSuggestions(kind);if(options.inline&&q)search(kind,q);
  }
  function renderSuggestions(kind){
    if(!host)return;var input=host.querySelector('#scheduleQuery'),q=DIN.norm(input.value),terms=q.split(' ').filter(Boolean),items=list(kind).filter(function(x){var target=DIN.norm(x.display+' '+x.label);return terms.every(function(t){return target.indexOf(t)>=0;});}).sort(function(a,b){return DIN.natural(a.display,b.display);});
    var box=host.querySelector('#scheduleSuggestions');box.replaceChildren();items.slice(0,120).forEach(function(x){var b=document.createElement('button');b.type='button';b.className='schedule-chip';b.textContent=x.display;b.onclick=function(){input.value=x.display;queries[kind]=x.display;show(kind,x.page);};box.appendChild(b);});
    if(items.length>120){var p=document.createElement('p');p.className='hint';p.textContent='Hay muchas opciones. Escribe algunas letras para reducir la lista.';box.appendChild(p);}
  }
  function compact(v){return DIN.norm(v).replace(/[^a-z0-9]/g,'');}
  function schedulePageForRoom(room){
    var s=scheduleFor('salones');if(!s||!Array.isArray(s.pages)||!s.pages.length)return null;
    var b=model&&model.building(room.edificio),label=model?model.roomLabel(room):DIN.str(room.nombre||room.salon||room.id_aula),keys=[room.id_aula,room.posicion,label];
    if(b)keys.push(model.buildingLabel(b)+' '+label,(b.nombre||b.id_edificio)+' '+label,room.planta+' '+label);
    var set=new Set(keys.filter(Boolean).map(compact));
    var exact=s.pages.filter(function(p){return set.has(compact(p.label));});if(exact.length===1)return exact[0];
    var lk=compact(label);var looser=s.pages.filter(function(p){var pk=compact(p.label);return pk===lk||(lk.length>2&&pk.slice(-lk.length)===lk);});return looser.length===1?looser[0]:null;
  }
  function roomGroups(room){if(!model)return [];return model.groups.filter(function(g){return model.placements(g).some(function(p){return p.room.id_aula===room.id_aula;});});}
  function floorOrder(v){var x=DIN.norm(v).replace(/^planta /,'');if(x==='baja'||x==='pb')return '00';if(x==='alta'||x==='pa')return '01';var m=x.match(/(?:nivel|piso)\s*(\d+)/);return m?'02-'+String(Number(m[1])).padStart(3,'0'):'03-'+x;}
  function renderRoomDirectory(focusFirst){
    if(!host)return;var input=host.querySelector('#scheduleQuery'),q=DIN.norm(input&&input.value||''),terms=q.split(' ').filter(Boolean),rooms=model&&Array.isArray(model.rooms)?model.rooms.slice():[];
    var filtered=rooms.filter(function(room){var b=model.building(room.edificio),text=DIN.norm([room.id_aula,model.roomLabel(room),room.planta,b&&model.buildingLabel(b),b&&b.nombre].join(' '));return terms.every(function(t){return text.indexOf(t)>=0;});});
    filtered.sort(function(a,b){var ba=model.building(a.edificio),bb=model.building(b.edificio);return DIN.natural(model.buildingLabel(ba),model.buildingLabel(bb))||DIN.natural(floorOrder(a.planta),floorOrder(b.planta))||DIN.natural(model.roomLabel(a),model.roomLabel(b));});
    var groups=new Map();filtered.forEach(function(room){var b=model.building(room.edificio),bk=b?b.id_edificio:'__',bl=b?model.buildingLabel(b):'Edificio sin identificar',floor=DIN.str(room.planta)||'Planta no indicada',k=bk+'||'+floor;if(!groups.has(k))groups.set(k,{building:bl,floor:floor,rooms:[]});groups.get(k).rooms.push(room);});
    var box=host.querySelector('#scheduleSuggestions');box.replaceChildren();box.className='room-schedule-directory';
    Array.from(groups.values()).forEach(function(group){var section=document.createElement('section');section.className='room-schedule-group';var head=document.createElement('div');head.className='room-schedule-head';head.innerHTML='<h4>'+DIN.esc(group.building)+'</h4><span>Planta '+DIN.esc(group.floor)+'</span>';section.appendChild(head);var grid=document.createElement('div');grid.className='room-schedule-grid';group.rooms.forEach(function(room){var page=schedulePageForRoom(room),btn=document.createElement('button');btn.type='button';btn.className='room-schedule-item '+(page?'available':'pending');var assigned=roomGroups(room);btn.innerHTML='<strong>'+DIN.esc(model.roomLabel(room))+'</strong><small>'+DIN.esc(room.id_aula)+'</small><span>'+(page?'Horario disponible':'Sin horario publicado')+'</span>'+(assigned.length?'<em>'+DIN.esc(assigned.map(function(g){return g.grupo;}).join(', '))+'</em>':'');btn.onclick=function(){input.value=model.roomLabel(room);queries.salones=input.value;if(page)show('salones',page);else showRoomPending(room);};grid.appendChild(btn);});section.appendChild(grid);box.appendChild(section);});
    var s=scheduleFor('salones'),available=filtered.filter(function(r){return !!schedulePageForRoom(r);}).length;status(filtered.length+' salones mostrados'+(q?' para esta búsqueda':'')+'. '+available+' con horario de ocupación publicado.'+(s?'':' El periodo todavía no tiene PDF de salones; aun así se muestra todo el catálogo de aulas.'));
    if(!filtered.length){box.innerHTML='<div class="empty"><strong>Sin coincidencias</strong><span>Prueba otro edificio, planta o salón.</span></div>';}
    if(focusFirst&&filtered.length===1){var page=schedulePageForRoom(filtered[0]);if(page)show('salones',page);else showRoomPending(filtered[0]);}
  }
  function showRoomPending(room){
    clearResult();var b=model.building(room.edificio),gs=roomGroups(room),section=document.createElement('section');section.className='selected-schedule';section.innerHTML='<h4>'+DIN.esc(model.roomLabel(room))+'</h4><p class="hint">'+DIN.esc(model.buildingLabel(b))+' · Planta '+DIN.esc(room.planta)+'</p><div class="schedule-notice"><strong>Horario de ocupación pendiente</strong><br>El salón existe en el catálogo y puede localizarse en el campus, pero todavía no se ha publicado una página de horario para este salón.</div><p class="hint">'+(gs.length?'Grupos asignados actualmente: '+DIN.esc(gs.map(function(g){return g.grupo;}).join(', ')):'Sin grupos asignados actualmente.')+'</p>';
    var p=document.createElement('p'),btn=document.createElement('button');btn.type='button';btn.className='soft-button';btn.textContent='Ubicar salón en croquis ↗';btn.onclick=function(){root.DIN_APP4&&root.DIN_APP4.openRoom(room.id_aula);};p.appendChild(btn);section.appendChild(p);host.querySelector('#schedulePage').appendChild(section);status('Salón localizado. Su horario de ocupación todavía no está publicado.');
  }
  function search(kind,q){
    q=DIN.norm(q);if(!q){status('Escribe un nombre, grupo o salón.');return;}var items=list(kind),compactQ=q.replace(/\s/g,''),exact=items.filter(function(x){return DIN.norm(x.display).replace(/\s/g,'')===compactQ||DIN.norm(x.label).replace(/\s/g,'')===compactQ;}),terms=q.split(' ').filter(Boolean),matches=exact.length?exact:items.filter(function(x){var t=DIN.norm(x.display+' '+x.label);return terms.every(function(term){return t.indexOf(term)>=0;});});
    clearResult();if(matches.length===1){show(kind,matches[0].page);return;}status(matches.length?matches.length+' coincidencias. Elige una.':'No se encontró un horario con ese criterio.');var box=host.querySelector('#scheduleMatches');matches.slice(0,120).forEach(function(x){var b=document.createElement('button');b.type='button';b.className='schedule-choice';b.textContent=x.display;b.onclick=function(){show(kind,x.page);};box.appendChild(b);});
  }
  function show(kind,page){
    clearResult();var s=scheduleFor(kind),period=s.periodo||periodId(),display=displayLabel(kind,page,period),section=document.createElement('section');section.className='selected-schedule';var warning='';
    if(kind==='profesores'){var alias=aliasBySource(period,page.label)||aliasByPublic(period,page.label);if(alias&&DIN.norm(alias.publicName)!==DIN.norm(alias.sourceName)){warning='<div class="schedule-notice"><strong>Aviso de sustitución</strong><br>Horario vigente asignado a <b>'+DIN.esc(surnameFirst(alias.publicName))+'</b>. El documento fuente fue emitido originalmente a nombre de <b>'+DIN.esc(surnameFirst(alias.sourceName))+'</b>.'+(alias.note?' '+DIN.esc(alias.note):'')+'</div>';}}
    section.innerHTML='<h4>'+DIN.esc(display)+'</h4>'+warning+'<p class="hint">Periodo '+DIN.esc(period)+' · página '+DIN.esc(page.page||'')+'.</p>';
    var wrap=document.createElement('div');wrap.className='schedule-image-wrap';var loading=document.createElement('p');loading.className='hint';loading.textContent='Cargando horario…';wrap.appendChild(loading);var img=document.createElement('img');img.className='schedule-image';img.loading='eager';img.decoding='async';img.alt='Horario de '+display;wrap.appendChild(img);section.appendChild(wrap);
    img.onload=function(){loading.remove();};
    img.onerror=function(){loading.textContent='No se pudo cargar la imagen del horario. Usa el PDF fuente si está disponible.';img.remove();status('La imagen del horario no respondió.');};
    if(page.url)img.src=page.url;
    else fetchPrivateImage(kind,page.label).then(function(dataUrl){img.src=dataUrl;}).catch(function(){loading.textContent='La imagen optimizada requiere conexión al servicio de respaldo y no pudo recuperarse.';img.remove();});
    if(s.pdfUrl){var p=document.createElement('p'),a=document.createElement('a');a.className='soft-button schedule-pdf-link';a.href=s.pdfUrl;a.target='_blank';a.rel='noopener';a.textContent='Abrir PDF fuente ↗';p.appendChild(a);section.appendChild(p);}host.querySelector('#schedulePage').appendChild(section);status('Horario listo. Solo se solicitó el resultado seleccionado.');try{section.scrollIntoView({behavior:window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'nearest'});}catch(e){section.scrollIntoView();}
  }
  function count(kind){var s=scheduleFor(kind);return s&&Array.isArray(s.pages)?s.pages.length:0;}
  function setSnapshot(s){snapshot=s;}
  function setContext(s,m){snapshot=s;model=m;}
  root.DIN_SCHEDULE4={setSnapshot:setSnapshot,setContext:setContext,mount:mount,count:count,surnameFirst:surnameFirst,findRoomPage:schedulePageForRoom};
})(window);
