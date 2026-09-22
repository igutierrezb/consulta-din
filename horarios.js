/* Lee Drive mediante el servicio de solo lectura y dibuja únicamente el resultado elegido. */
window.DIN_SCHEDULE=(()=>{
 'use strict';
 const {norm,esc}=DIN,cache=new Map(),pending=new Map(),queries={profesores:'',grupos:''};
 let serial=0,kind='',host=null,libPromise=null,academic={groups:[],period:null}; window.addEventListener('din-data',e=>{academic=e.detail;for(const entry of cache.values()){delete entry.directoryPromise;delete entry.directoryData;}});
 function request(action,type,version=''){return window.DIN_REMOTE.request({action,kind:type,version});}
 function rpc(action,type,version=''){
  const key=JSON.stringify([action,type,version]);
  if(pending.has(key))return pending.get(key);
  const task=(async()=>{for(let attempt=0;;attempt++){try{return await request(action,type,version);}catch(error){if(!error.retryable||attempt>=2)throw error;await new Promise(resolve=>setTimeout(resolve,1000*(attempt+1)));}}})();
  pending.set(key,task);task.then(()=>pending.delete(key),()=>pending.delete(key));return task;
 }
 async function library(){
  if(!libPromise)libPromise=import('./vendor/pdfjs/pdf.mjs').then(lib=>{lib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/pdf.worker.mjs',document.baseURI).href;return lib;}).catch(e=>{libPromise=null;throw Error('No se pudo cargar el visor. Actualiza la página o utiliza un navegador actualizado.');});return libPromise;
 }
 function identify(items,type){
  const text=items.map(i=>(i.str||'')+(i.hasEOL?'\n':' ')).join('');
  const lines=text.split('\n').map(s=>s.trim()).filter(Boolean);
  if(type==='profesores'){
   const names=lines.map(l=>l.match(/^Profesor(?:a)?\s+(.+)$/i)?.[1]).filter(Boolean);
   return names.length===1?names[0].trim():null;
  }
  // Solo el encabezado de grupo: nunca códigos que aparezcan dentro de las materias.
  const anchor=lines.findIndex(l=>norm(l)==='division industrial');
  const candidate=anchor>=0?lines[anchor+1]:null;
  return candidate&&/^[A-Z]{2,10}\s*\d{2,6}$/i.test(candidate)?candidate.replace(/\s/g,'').toUpperCase():null;
 }
 const loadingDocuments=new Map();
 function documentFor(type,notice){if(loadingDocuments.has(type))return loadingDocuments.get(type);const task=loadDocument(type,notice);loadingDocuments.set(type,task);task.then(()=>loadingDocuments.delete(type),()=>loadingDocuments.delete(type));return task;}
 async function loadDocument(type,notice){
  const meta=await rpc('meta',type);const selected=document.getElementById('period')?.value;if(selected&&selected!=='Datos no disponibles'&&selected!=='Cargando periodos…'&&selected!==meta.period)throw Error('Drive contiene el periodo '+meta.period+'. Selecciona ese periodo para consultar sus horarios.');const old=cache.get(type);
  if(old?.version===meta.version)return old;
  if(old){cache.delete(type);await old.pdf.loadingTask.destroy();}
  notice('Recuperando la versión actual de Drive…');
  const result=await rpc('pdf',type,meta.version);
  if(result.version!==meta.version)throw Error('El documento cambió durante la consulta. Vuelve a buscar.');
  const bytes=Uint8Array.from(atob(result.base64),c=>c.charCodeAt(0)),lib=await library();
  const pdf=await lib.getDocument({data:bytes,isEvalSupported:false,enableXfa:false,standardFontDataUrl:new URL('./vendor/pdfjs/standard_fonts/',document.baseURI).href,wasmUrl:new URL('./vendor/pdfjs/wasm/',document.baseURI).href}).promise;
  try{
   if(pdf.numPages>300)throw Error('El documento supera el límite de 300 páginas. Contacta a la coordinación.');
   const pages=[];
   for(let n=1;n<=pdf.numPages;n++){
    notice('Buscando en la versión actual… '+n+' / '+pdf.numPages);
    const page=await pdf.getPage(n),text=await page.getTextContent(),name=identify(text.items,type);
    if(!name)throw Error('No se puede identificar el encabezado de la página '+n+'. El PDF puede ser escaneado o tener un formato distinto. La coordinación debe revisar el documento.');
    pages.push({name,page:n,text:text.items.map(i=>(i.str||'')+(i.hasEOL?'\n':' ')).join('')});page.cleanup();
   }
   const entry={version:meta.version,modified:meta.modified,period:meta.period,pdf,pages};cache.set(type,entry);return entry;
  }catch(e){await pdf.loadingTask.destroy();throw e;}
 }
 function mount(type,element,options={}){
  if(options.reset)queries[type]='';const token=++serial;kind=type;host=element;
  host.innerHTML=`<div class="schedule-panel"><h3>${type==='profesores'?'Horarios de maestros':'Horarios por grupo'}</h3><form id="scheduleForm"><label for="scheduleQuery">${type==='profesores'?'Nombre del maestro':'Código del grupo'}</label><div class="schedule-search"><input id="scheduleQuery" type="search" required maxlength="120" autocomplete="off" placeholder="${type==='profesores'?'Por ejemplo: Abel Martínez':'Por ejemplo: LIMA002'}" value="${esc(queries[type])}"><button class="primary" type="submit">Buscar horario</button></div></form><p id="scheduleStatus" role="status">Consultando disponibilidad en Drive…</p><div id="scheduleSuggestions" aria-label="Sugerencias"></div><div id="scheduleMatches"></div><div id="schedulePage"></div></div>`;
  host.querySelector('form').onsubmit=e=>{e.preventDefault();queries[type]=host.querySelector('input').value;search(type,queries[type]);};
  host.querySelector('input').oninput=()=>{++serial;queries[type]=host.querySelector('input').value;host.querySelector('#scheduleMatches').replaceChildren();host.querySelector('#schedulePage').replaceChildren();suggest(type);};
  suggest(type);if(options.inline){host.querySelector('form').hidden=true;host.querySelector('#scheduleSuggestions').hidden=true;}
  if(type==='profesores'){
   const mountedHost=host;
   queue=queue.catch(()=>{}).then(async()=>{if(host!==mountedHost||kind!==type)return;try{await documentFor(type,s=>{if(host===mountedHost&&kind===type)host.querySelector('#scheduleStatus').textContent=s;});if(host===mountedHost&&kind===type){suggest(type);host.querySelector('#scheduleStatus').textContent='Selecciona un profesor o escribe parte de su nombre. ♟ identifica a los tutores.';const entry=cache.get(type);directoryFor(entry).then(()=>{if(host===mountedHost&&kind===type)suggest(type);}).catch(()=>{});}}catch(e){if(host===mountedHost&&kind===type)host.querySelector('#scheduleStatus').textContent=e.message;}});
  }
  const retry=document.createElement('button');retry.type='button';retry.textContent='Reintentar';retry.className='schedule-choice';retry.onclick=()=>{const query=host.querySelector('#scheduleQuery').value;if(query.trim())search(type,query);else mount(type,element);};host.querySelector('#scheduleStatus').after(retry);
  if(type!=='profesores')rpc('meta',type).then(meta=>{if(token===serial)host.querySelector('#scheduleStatus').textContent='Disponible · Periodo '+meta.period+' · Actualizado en Drive: '+new Date(meta.modified).toLocaleString('es-MX');}).catch(e=>{if(token===serial)host.querySelector('#scheduleStatus').textContent=e.message;});
 }

 // Reuse one directory read for the teacher list and the selected profile.
 function directoryFor(entry){if(!entry.directoryPromise)entry.directoryPromise=window.DIN_REMOTE.request({action:'directory'}).then(d=>{if(d.period===entry.period&&d.pdfVersion===entry.version&&Array.isArray(d.rows))entry.directoryData=d;return d;}).catch(e=>{delete entry.directoryPromise;throw e;});return entry.directoryPromise;}
 function tutorGroups(entry,name){
  if(!entry||academic.period?.id_periodo!==entry.period)return [];
  const key=v=>norm(v).split(' ').filter(Boolean).sort().join(' '),matches=(entry.directoryData?.rows||[]).filter(r=>norm(r.nombre_pdf)===norm(name)),record=matches.length===1?matches[0]:null;
  const uniqueNames=[...new Set(entry.pages.map(p=>p.name))].filter(n=>key(n)===key(name));
  const aliases=record?[name,record.nombre,record.nombre_tutor].filter(Boolean):uniqueNames.length===1?[name]:[];
  const keys=new Set(aliases.map(key));return academic.groups.filter(g=>DIN.hasTutor(g.tutor)&&keys.has(key(g.tutor)));
 }

 // PDF: nombres primero. Directorio y tutorías: apellidos primero.
 // Solo cambia la etiqueta; la búsqueda conserva el encabezado original del PDF.
 function teacherLabel(entry,name){
  const rows=(entry?.directoryData?.rows||[]).filter(r=>norm(r.nombre_pdf)===norm(name));
  if(rows.length===1&&rows[0].nombre)return rows[0].nombre;
  const groups=tutorGroups(entry,name);if(groups.length)return groups[0].tutor;
  const words=String(name).trim().split(/\s+/);if(words.length<3)return name;
  const particles=new Set(['de','del','la','las','los','da','das','do','dos','van','von']);
  const surname=()=>{const part=[words.pop()];while(words.length>1&&particles.has(norm(words[words.length-1])))part.unshift(words.pop());return part.join(' ');};
  const maternal=surname(),paternal=surname();return [paternal,maternal,words.join(' ')].filter(Boolean).join(' ');
 }
 function tutorBadge(button,entry,name){const groups=tutorGroups(entry,name);if(!groups.length)return;const badge=document.createElement('span');badge.textContent='♟';badge.className='teacher-tutor-icon';badge.setAttribute('aria-hidden','true');button.append(badge);button.title='Tutor de '+groups.map(g=>g.grupo).join(', ');button.setAttribute('aria-label',teacherLabel(entry,name)+', tutor');}

 function suggest(type){
  const input=host.querySelector('#scheduleQuery'),q=norm(input.value),entry=cache.get(type),selected=document.getElementById('period')?.value;
  const names=type==='grupos'?academic.groups.map(g=>g.grupo):(entry&&(!selected||entry.period===selected)?entry.pages.map(p=>p.name):[]);
  const unique=[...new Set(names)].filter(n=>q.split(' ').every(t=>norm(n).includes(t))).sort((a,b)=>DIN.naturalOrder(type==='profesores'?teacherLabel(entry,a):a,type==='profesores'?teacherLabel(entry,b):b));
  const container=host.querySelector('#scheduleSuggestions');container.className=type==='grupos'?'schedule-suggestions group-picker':'schedule-suggestions';container.replaceChildren();
  unique.forEach(name=>{const b=document.createElement('button');b.type='button';b.className='schedule-chip';b.textContent=type==='profesores'?teacherLabel(entry,name):name;if(type==='grupos'){const g=academic.groups.find(g=>g.grupo===name);if(g){b.className='group-pick '+DIN.groupTone(g,academic.groups);b.innerHTML=DIN.groupTile(g,academic.groups);}}else tutorBadge(b,entry,name);b.onclick=()=>{input.value=name;queries[type]=name;search(type,name);};container.append(b);});
 }
 // Una sola extracción a la vez; consultas anteriores nunca sustituyen la vista vigente.
 let queue=Promise.resolve();
 function search(type,query){
  const token=++serial,q=norm(query);const notice=s=>{if(token===serial)host.querySelector('#scheduleStatus').textContent=s;};
  host.querySelector('#scheduleMatches').replaceChildren();host.querySelector('#schedulePage').replaceChildren();
  if(!q){notice('Escribe un nombre o código de grupo.');return;}
  notice('Comprobando la versión de Drive…');
  queue=queue.catch(()=>{}).then(async()=>{
   if(token!==serial)return;
   try{
    const entry=await documentFor(type,notice);if(token!==serial)return;
    const exact=entry.pages.filter(p=>norm(p.name).replace(/\s/g,'')===q.replace(/\s/g,''));
    const matches=exact.length?exact:entry.pages.filter(p=>q.split(' ').every(t=>norm(p.name).includes(t)));
    const names=[...new Set(matches.map(p=>p.name))].sort((a,b)=>DIN.naturalOrder(type==='profesores'?teacherLabel(entry,a):a,type==='profesores'?teacherLabel(entry,b):b));
    notice(names.length?names.length+' coincidencia(s) · Periodo '+entry.period+' · Fuente verificada en Drive.':'No se encontró un horario con ese nombre o grupo.');
    if(names.length===1){await show(entry,matches,token);return;}
    const container=host.querySelector('#scheduleMatches');
    names.forEach(name=>{const b=document.createElement('button');b.type='button';b.className='schedule-choice';b.textContent=type==='profesores'?teacherLabel(entry,name):name;if(type==='grupos'){const g=academic.groups.find(g=>g.grupo===name);if(g){b.className='group-pick '+DIN.groupTone(g,academic.groups);b.innerHTML=DIN.groupTile(g,academic.groups);}}else tutorBadge(b,entry,name);b.onclick=()=>search(type,name);container.append(b);});
   }catch(e){notice(e.message||'No se pudo consultar el horario. Intenta nuevamente.');}
  });
 }
 async function show(entry,pages,token){
  const target=host.querySelector('#schedulePage');target.replaceChildren();
  if(kind==='profesores'){const profile=document.createElement('div');target.append(profile);teacherProfile(entry,pages[0].name,profile,token);}
  for(const match of pages){
   if(token!==serial)return;
   const section=document.createElement('section');section.className='selected-schedule';
   section.innerHTML=`<h4>${esc(match.name)}</h4><p>Horario correspondiente · Página ${match.page} · Usa los controles para ampliar.</p><div class="schedule-zoom"><button type="button" data-zoom="minus" aria-label="Reducir horario">−</button><button type="button" data-zoom="fit">Ajustar</button><button type="button" data-zoom="plus" aria-label="Ampliar horario">+</button><button type="button" data-fullscreen>Pantalla completa</button></div><div class="pdf-scroll" tabindex="0" role="region" aria-label="Horario de ${esc(match.name)}"><canvas role="img" aria-label="Horario de ${esc(match.name)}. Transcripción disponible debajo."></canvas></div><details><summary>Texto del horario (orden extraído del documento)</summary><pre>${esc(match.text)}</pre></details>`;
   if(kind==='grupos'){const locate=document.createElement('button');locate.type='button';locate.className='campus-link schedule-locate';locate.textContent='Localiza el edificio y tu salón en el mapa';locate.onclick=()=>window.DIN_LOCATE_GROUP?.(match.name);section.querySelector('h4').after(locate);}target.append(section);const page=await entry.pdf.getPage(match.page),canvas=section.querySelector('canvas'),scroller=section.querySelector('.pdf-scroll');let zoom=1,rendering=null;
   async function draw(){
    if(rendering){rendering.cancel();try{await rendering.promise;}catch{}}
    const viewport=page.getViewport({scale:1}),width=Math.max(280,scroller.clientWidth-2)*zoom,ratio=Math.min(window.devicePixelRatio||1,2),view=page.getViewport({scale:width/viewport.width});
    canvas.width=Math.ceil(view.width*ratio);canvas.height=Math.ceil(view.height*ratio);canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';
    rendering=page.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
    try{await rendering.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;}
   }
   section.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{zoom=b.dataset.zoom==='fit'?1:Math.max(1,Math.min(3,zoom+(b.dataset.zoom==='plus'?.5:-.5)));draw().catch(()=>{if(token===serial)host.querySelector('#scheduleStatus').textContent='No se pudo dibujar el horario. Vuelve a buscar.';});});
   section.querySelector('[data-fullscreen]').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(section.requestFullscreen)await section.requestFullscreen();else section.classList.toggle('schedule-expanded');await draw();}catch{section.classList.toggle('schedule-expanded');await draw();}};
   await draw();
  }
 }
 function dinWorkTime_(value){
 const v=String(value??'').trim();if(!v)return '';
 if(/^0?\.\d+$/.test(v)){const minutes=Math.round(Number(v)*1440);if(minutes>=0&&minutes<1440)return String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');}
 const m=v.toLowerCase().replace(/[.\s]/g,'').match(/^(\d{1,2}):(\d{2})(?::00)?(am|pm)?$/);if(!m)throw Error('Usa horas como 07:00 o 15:00.');let h=Number(m[1]),min=Number(m[2]);if(min>59||h>23||(m[3]&&(h<1||h>12)))throw Error('Hora fuera de rango.');if(m[3])h=h%12+(m[3]==='pm'?12:0);return String(h).padStart(2,'0')+':'+m[2];
}

 function workHoursHtml(record){const days=['Lunes','Martes','Miércoles','Jueves','Viernes'];const any=days.some((_,i)=>record?.['ent'+(i+1)]||record?.['sal'+(i+1)]);if(!any)return esc(record?.horario_laboral||'Pendiente de captura en el directorio');const display=v=>{const t=dinWorkTime_(v),[h,m]=t.split(':').map(Number);return (h%12||12)+':'+String(m).padStart(2,'0')+(h<12?' a. m.':' p. m.');};return '<dl class="work-hours">'+days.map((day,i)=>{const a=record['ent'+(i+1)],b=record['sal'+(i+1)];let text='Sin horario registrado';try{if(a&&b)text='Entra a las '+display(a)+' · Sale a las '+display(b);}catch{text='Horario pendiente de revisar';}return '<div><dt>'+day+'</dt><dd>'+esc(text)+'</dd></div>';}).join('')+'</dl>';}
 async function teacherProfile(entry,name,target,token){
  target.className='teacher-profile';target.textContent='Consultando directorio del profesor…';
  let record=null,warning='';
  try{const d=await directoryFor(entry);if(token!==serial)return;if(d.period===entry.period&&d.pdfVersion===entry.version){const matches=d.rows.filter(r=>norm(r.nombre_pdf)===norm(name));if(matches.length===1)record=matches[0];warning=d.warning||'';}else warning='El directorio no corresponde al PDF vigente.';}catch{warning='No se pudo consultar el directorio. El horario de clases se muestra por separado.';}
  if(token!==serial)return;
  const groups=tutorGroups(entry,name);
  const email=record?.correo||groups.map(g=>g.correo).find(v=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v||''));
  target.innerHTML=`<h4>${esc(record?.nombre||name)}</h4><p><strong>Categoría:</strong> ${esc(record?.categoria||'Pendiente de captura')}</p>${groups.length?`<p class="tutor-badge">Tutor de ${groups.map(g=>esc(g.grupo)).join(', ')}</p>`:''}<p><strong>Correo:</strong> ${email?`<a href="mailto:${esc(email)}">${esc(email)}</a>`:'Pendiente de captura'}</p><div><strong>Horario laboral:</strong>${workHoursHtml(record)}</div>${warning?`<p role="status">${esc(warning)}</p>`:''}<h4>Horario de clases</h4>`;
 }

 return {countTeachers:async()=>{const entry=await documentFor('profesores',()=>{});return new Set(entry.pages.map(p=>norm(p.name))).size;},mount,select:(type,name)=>{queries[type]=name;host.querySelector('#scheduleQuery').value=name;search(type,name);},cancel:()=>{++serial;},identify};
})();

