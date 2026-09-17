/* Lee Drive mediante el servicio de solo lectura y dibuja únicamente el resultado elegido. */
window.DIN_SCHEDULE=(()=>{
 'use strict';
 const {norm,esc}=DIN,cache=new Map(),queries={profesores:'',grupos:''};
 let serial=0,kind='',host=null,libPromise=null;
 function rpc(action,type,version=''){
  return new Promise((resolve,reject)=>{
   let url;try{url=new URL(window.DIN_CONFIG.endpoint);if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname))throw Error();}catch{reject(Error('Los horarios todavía no están conectados. La administración debe configurar el servicio de Drive.'));return;}
   const cb='dinRemote_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script');let done=false;
   const timer=setTimeout(()=>end(Error('El servicio de horarios no respondió. Revisa la conexión e intenta de nuevo.')),45000);
   function end(error,value){if(done)return;done=true;clearTimeout(timer);script.remove();window[cb]=()=>{};setTimeout(()=>delete window[cb],60000);error?reject(error):resolve(value);}
   window[cb]=r=>r?.ok?end(null,r):end(Error(r?.error||'No se pudo leer el horario remoto.'));
   script.onerror=()=>end(Error('No se pudo conectar con Drive. Intenta de nuevo o informa a la coordinación.'));
   Object.entries({action,kind:type,version,callback:cb,_:Date.now()}).forEach(([k,v])=>url.searchParams.set(k,v));script.src=url.href;document.head.appendChild(script);
  });
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
 async function documentFor(type,notice){
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
 function mount(type,element){
  const token=++serial;kind=type;host=element;
  host.innerHTML=`<div class="schedule-panel"><h3>${type==='profesores'?'Horarios de maestros':'Horarios por grupo'}</h3><form id="scheduleForm"><label for="scheduleQuery">${type==='profesores'?'Nombre del maestro':'Código del grupo'}</label><div class="schedule-search"><input id="scheduleQuery" type="search" required maxlength="120" autocomplete="off" placeholder="${type==='profesores'?'Por ejemplo: Abel Martínez':'Por ejemplo: LIMA002'}" value="${esc(queries[type])}"><button class="primary" type="submit">Buscar horario</button></div></form><p id="scheduleStatus" role="status">Consultando disponibilidad en Drive…</p><div id="scheduleMatches"></div><div id="schedulePage"></div></div>`;
  host.querySelector('form').onsubmit=e=>{e.preventDefault();queries[type]=host.querySelector('input').value;search(type,queries[type]);};
  host.querySelector('input').oninput=()=>{++serial;queries[type]=host.querySelector('input').value;host.querySelector('#scheduleMatches').replaceChildren();host.querySelector('#schedulePage').replaceChildren();host.querySelector('#scheduleStatus').textContent='Pulsa Buscar horario para consultar Drive.';};
  rpc('meta',type).then(meta=>{if(token===serial)host.querySelector('#scheduleStatus').textContent='Disponible · Periodo '+meta.period+' · Actualizado en Drive: '+new Date(meta.modified).toLocaleString('es-MX');}).catch(e=>{if(token===serial)host.querySelector('#scheduleStatus').textContent=e.message;});
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
    const names=[...new Set(matches.map(p=>p.name))];
    notice(names.length?names.length+' coincidencia(s) · Periodo '+entry.period+' · Fuente verificada en Drive.':'No se encontró un horario con ese nombre o grupo.');
    if(names.length===1){await show(entry,matches,token);return;}
    const container=host.querySelector('#scheduleMatches');
    names.forEach(name=>{const b=document.createElement('button');b.type='button';b.className='schedule-choice';b.textContent=name;b.onclick=()=>search(type,name);container.append(b);});
   }catch(e){notice(e.message||'No se pudo consultar el horario. Intenta nuevamente.');}
  });
 }
 async function show(entry,pages,token){
  const target=host.querySelector('#schedulePage');target.replaceChildren();
  for(const match of pages){
   if(token!==serial)return;
   const section=document.createElement('section');section.className='selected-schedule';
   section.innerHTML=`<h4>${esc(match.name)}</h4><p>Horario correspondiente · Página ${match.page} · Usa los controles para ampliar.</p><div class="schedule-zoom"><button type="button" data-zoom="minus" aria-label="Reducir horario">−</button><button type="button" data-zoom="fit">Ajustar</button><button type="button" data-zoom="plus" aria-label="Ampliar horario">+</button></div><div class="pdf-scroll" tabindex="0" role="region" aria-label="Horario de ${esc(match.name)}"><canvas role="img" aria-label="Horario de ${esc(match.name)}. Transcripción disponible debajo."></canvas></div><details><summary>Texto del horario (orden extraído del documento)</summary><pre>${esc(match.text)}</pre></details>`;
   target.append(section);const page=await entry.pdf.getPage(match.page),canvas=section.querySelector('canvas'),scroller=section.querySelector('.pdf-scroll');let zoom=1,rendering=null;
   async function draw(){
    if(rendering){rendering.cancel();try{await rendering.promise;}catch{}}
    const viewport=page.getViewport({scale:1}),width=Math.max(280,scroller.clientWidth-2)*zoom,ratio=Math.min(window.devicePixelRatio||1,2),view=page.getViewport({scale:width/viewport.width});
    canvas.width=Math.ceil(view.width*ratio);canvas.height=Math.ceil(view.height*ratio);canvas.style.width=view.width+'px';canvas.style.height=view.height+'px';
    rendering=page.render({canvasContext:canvas.getContext('2d'),viewport:view,transform:ratio===1?null:[ratio,0,0,ratio,0,0]});
    try{await rendering.promise;}catch(e){if(e.name!=='RenderingCancelledException')throw e;}
   }
   section.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{zoom=b.dataset.zoom==='fit'?1:Math.max(1,Math.min(3,zoom+(b.dataset.zoom==='plus'?.5:-.5)));draw().catch(()=>{if(token===serial)host.querySelector('#scheduleStatus').textContent='No se pudo dibujar el horario. Vuelve a buscar.';});});
   await draw();
  }
 }
 return {mount,cancel:()=>{++serial;},identify};
})();

