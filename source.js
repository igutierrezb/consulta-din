/* Fuentes independientes. La caché nunca convierte ubicaciones antiguas en vigentes. */
window.DIN_SOURCE=(()=>{
 const config=window.DIN_CONFIG, ttl=24*60*60*1000,basePlans=window.DIN_PLANOS;
 function rpc(params){return new Promise((resolve,reject)=>{
  const url=new URL(config.endpoint),name='dinRemote_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script');
  let done=false;const timer=setTimeout(()=>end(Error('El servicio no respondió.')),12000);
  function end(error,value){if(done)return;done=true;clearTimeout(timer);script.remove();window[name]=()=>{};setTimeout(()=>delete window[name],60000);error?reject(error):resolve(value);}
  window[name]=r=>r?.ok?end(null,r):end(Error(r?.error||'Respuesta inválida.'));
  script.onerror=()=>end(Error('Sin conexión con el servicio.'));
  Object.entries({...params,callback:name}).forEach(([k,v])=>url.searchParams.set(k,v));script.src=url.href;document.head.append(script);
 });}
 function key(sheet,rev){return 'din:v2:'+config.sheetId+':'+rev+':'+sheet;}
 function stored(sheet,rev){try{const v=JSON.parse(localStorage.getItem(key(sheet,rev)));return v&&Date.now()-v.at<ttl&&Array.isArray(v.rows)?v:null;}catch{return null;}}
 async function load(sheets,legacy){
  let manifest,knownLegacy=false;try{manifest=await rpc({action:'manifest'});if(manifest.api!==2)manifest=null;}catch(e){knownLegacy=/^Consulta no permitida/.test(e.message);}
  // Once migrated, a service outage must not resurrect the pre-migration sheet.
  let migrated=false;try{migrated=localStorage.getItem('din:migrated:'+config.sheetId)==='yes';if(manifest){localStorage.setItem('din:migrated:'+config.sheetId,'yes');}}catch{}
  let lastRevision;try{lastRevision=localStorage.getItem('din:revision:'+config.sheetId);if(manifest)localStorage.setItem('din:revision:'+config.sheetId,manifest.revision);}catch{}
  const revision=manifest?.revision||(migrated?lastRevision:'legacy')||'legacy',issues=[],stale=new Set();
  if(!manifest&&!knownLegacy){stale.add('Servicio');issues.push('No se pudo verificar la versión académica vigente. Los datos de referencia no confirman ubicaciones actuales.');}
  const results=await Promise.allSettled(sheets.map(async sheet=>{
   try{
    if(!manifest&&migrated)throw Error('Servicio académico temporalmente no disponible');
    const rows=manifest?(await rpc({action:'data',sheet,revision})).rows:await legacy(sheet);
    if(!Array.isArray(rows)||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw Error('Datos inválidos');
    try{localStorage.setItem(key(sheet,revision),JSON.stringify({at:Date.now(),rows}));}catch{}
    return rows;
   }catch(e){stale.add(sheet);const old=stored(sheet,revision);issues.push(sheet+': '+e.message+(old?' · Copia del '+new Date(old.at).toLocaleString('es-MX'):' · Sin datos disponibles'));return old?.rows||[];}
  }));
  const data=Object.fromEntries(sheets.map((s,i)=>[s,results[i].status==='fulfilled'?results[i].value:[]]));
  if(stale.size){data.ASIGNACION_AULAS=[];issues.push('Ubicaciones de grupos suspendidas hasta verificar todas sus fuentes; puedes consultar los demás módulos.');}
  let plans=basePlans; if(manifest)try{const r=await rpc({action:'plans',revision});plans=basePlans.filter(p=>!r.plans.some(q=>q.id===p.id||(q.edificio===p.edificio&&q.planta===p.planta))).concat(r.plans);}catch{issues.push('Croquis: no se pudieron comprobar las actualizaciones.');plans=[];}
  else if(migrated){plans=[];issues.push('Croquis: sin conexión para verificar la versión vigente.');}
  return {data,plans,issues};
 }
 return {load,rpc};
})();
