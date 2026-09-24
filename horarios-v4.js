(function(root){
  'use strict';
  var DIN=root.DIN4,host=null,snapshot=null,queries={profesores:'',grupos:'',salones:''};
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
  function displayLabel(kind,page,period){if(kind!=='profesores')return page.label;var a=aliasBySource(period,page.label);return a&&a.publicName||page.label;}
  function list(kind){var s=scheduleFor(kind);if(!s||!Array.isArray(s.pages))return [];var period=s.periodo||periodId();return s.pages.map(function(p){return {page:p,label:p.label,display:displayLabel(kind,p,period)};});}
  function title(kind){return kind==='profesores'?'Horarios de maestros':kind==='grupos'?'Horarios por grupo':'Horarios de salones';}
  function example(kind){return kind==='profesores'?'Nombre del maestro':kind==='grupos'?'Código del grupo':'Nombre o código del salón';}
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
    var input=host.querySelector('#scheduleQuery');input.oninput=function(){queries[kind]=input.value;renderSuggestions(kind);clearResult();};host.querySelector('form').onsubmit=function(e){e.preventDefault();search(kind,input.value);};
    if(!s){status('Todavía no se ha publicado este horario para el periodo vigente.');return;}
    if(!s.optimized||!Array.isArray(s.pages)||!s.pages.length){status('Este horario todavía utiliza el formato anterior.');if(s.pdfUrl){var a=document.createElement('a');a.className='primary';a.href=s.pdfUrl;a.target='_blank';a.rel='noopener';a.textContent='Abrir PDF vigente ↗';host.querySelector('#schedulePage').appendChild(a);}return;}
    status('Selecciona una opción o escribe para buscar. Solo se descargará el horario elegido.');renderSuggestions(kind);if(options.inline&&q)search(kind,q);
  }
  function renderSuggestions(kind){
    if(!host)return;var input=host.querySelector('#scheduleQuery'),q=DIN.norm(input.value),terms=q.split(' ').filter(Boolean),items=list(kind).filter(function(x){var target=DIN.norm(x.display+' '+x.label);return terms.every(function(t){return target.indexOf(t)>=0;});}).sort(function(a,b){return DIN.natural(a.display,b.display);});
    var box=host.querySelector('#scheduleSuggestions');box.replaceChildren();items.slice(0,120).forEach(function(x){var b=document.createElement('button');b.type='button';b.className='schedule-chip';b.textContent=x.display;b.onclick=function(){input.value=x.display;queries[kind]=x.display;show(kind,x.page);};box.appendChild(b);});
    if(items.length>120){var p=document.createElement('p');p.className='hint';p.textContent='Hay muchas opciones. Escribe algunas letras para reducir la lista.';box.appendChild(p);}
  }
  function search(kind,q){
    q=DIN.norm(q);if(!q){status('Escribe un nombre, grupo o salón.');return;}var items=list(kind),compact=q.replace(/\s/g,''),exact=items.filter(function(x){return DIN.norm(x.display).replace(/\s/g,'')===compact||DIN.norm(x.label).replace(/\s/g,'')===compact;}),terms=q.split(' ').filter(Boolean),matches=exact.length?exact:items.filter(function(x){var t=DIN.norm(x.display+' '+x.label);return terms.every(function(term){return t.indexOf(term)>=0;});});
    clearResult();if(matches.length===1){show(kind,matches[0].page);return;}status(matches.length?matches.length+' coincidencias. Elige una.':'No se encontró un horario con ese criterio.');var box=host.querySelector('#scheduleMatches');matches.slice(0,120).forEach(function(x){var b=document.createElement('button');b.type='button';b.className='schedule-choice';b.textContent=x.display;b.onclick=function(){show(kind,x.page);};box.appendChild(b);});
  }
  function show(kind,page){
    clearResult();var s=scheduleFor(kind),period=s.periodo||periodId(),display=displayLabel(kind,page,period),section=document.createElement('section');section.className='selected-schedule';var warning='';
    if(kind==='profesores'){var alias=aliasBySource(period,page.label)||aliasByPublic(period,display);if(alias&&DIN.norm(alias.publicName)!==DIN.norm(alias.sourceName)){warning='<div class="schedule-notice"><strong>Aviso de sustitución</strong><br>Horario vigente asignado a <b>'+DIN.esc(alias.publicName)+'</b>. El documento fuente fue emitido originalmente a nombre de <b>'+DIN.esc(alias.sourceName)+'</b>.'+(alias.note?' '+DIN.esc(alias.note):'')+'</div>';}}
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
  root.DIN_SCHEDULE4={setSnapshot:setSnapshot,mount:mount,count:count};
})(window);
