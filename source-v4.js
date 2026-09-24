(function(root){
  'use strict';
  var CACHE_KEY='din:v4:snapshot';
  var SOFT_TTL=10*60*1000; // 10 min: rápido en uso normal, pero no oculta cambios demasiado tiempo.
  function cached(){try{var x=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');return x&&x.payload?x:null;}catch(e){return null;}}
  function store(payload){try{localStorage.setItem(CACHE_KEY,JSON.stringify({at:Date.now(),payload:payload}));}catch(e){}}
  function gvizUrl(callback,force){
    var id=root.DIN_CONFIG&&root.DIN_CONFIG.sheetId;if(!id)throw Error('Falta la configuración de la base académica.');
    var u='https://docs.google.com/spreadsheets/d/'+encodeURIComponent(id)+'/gviz/tq?sheet=PUBLIC_SNAPSHOT&headers=1&tqx=responseHandler:'+callback;
    // La URL normal queda estable para aprovechar cachés intermedias. Solo el botón Actualizar fuerza una URL nueva.
    if(force)u+='&_='+Date.now();
    return u;
  }
  function fromGviz(response){
    if(!response||response.status==='error'||!response.table)throw Error('La publicación académica no respondió.');
    var cols=response.table.cols.map(function(c){return String(c.label||'').trim().toLowerCase();});
    var rows=(response.table.rows||[]).map(function(r){var o={};cols.forEach(function(k,i){var c=r.c[i];o[k]=c?(c.f!=null?c.f:c.v):'';});return o;});
    var active=rows.filter(function(r){return String(r.active).toLowerCase()==='true'||String(r.active)==='1';});
    if(!active.length)throw Error('No existe una publicación académica vigente.');
    // Si una escritura quedó interrumpida y aparecen dos revisiones activas, solo aceptar una revisión completa.
    var byRev={};active.forEach(function(r){var rev=String(r.revision||'');if(!byRev[rev])byRev[rev]=[];byRev[rev].push(r);});
    var candidates=Object.keys(byRev).map(function(rev){var a=byRev[rev].slice().sort(function(x,y){return Number(x.part)-Number(y.part);});var total=Number(a[0]&&a[0].total||0),updated=String(a[0]&&a[0].updated||'');return {rev:rev,rows:a,total:total,updated:updated,complete:!!total&&a.length===total&&a.every(function(r,i){return Number(r.part)===i+1&&Number(r.total)===total;})};}).filter(function(x){return x.complete;});
    if(!candidates.length)throw Error('La publicación académica está incompleta.');
    candidates.sort(function(a,b){return String(a.updated).localeCompare(String(b.updated));});
    var chosen=candidates[candidates.length-1],text=chosen.rows.map(function(r){return String(r.chunk||'');}).join(''),payload=JSON.parse(text);
    if(!payload||payload.api!==4)throw Error('Versión académica no compatible.');
    if(payload.revision&&String(payload.revision)!==chosen.rev)throw Error('La revisión publicada no coincide con su índice.');
    return payload;
  }
  function loadSheet(force){return new Promise(function(resolve,reject){var name='din4_'+Date.now()+'_'+Math.random().toString(36).slice(2),script=document.createElement('script'),done=false,timer=setTimeout(function(){finish(Error('La publicación tardó demasiado en responder.'));},12000);function finish(err,val){if(done)return;done=true;clearTimeout(timer);try{script.remove();}catch(e){}try{delete root[name];}catch(e){root[name]=null;}err?reject(err):resolve(val);}root[name]=function(r){try{finish(null,fromGviz(r));}catch(e){finish(e);}};script.onerror=function(){finish(Error('No se pudo consultar la publicación académica.'));};script.src=gvizUrl(name,force);document.head.appendChild(script);});}
  function fallbackApi(force){return new Promise(function(resolve,reject){try{var url=new URL(root.DIN_CONFIG.endpoint);url.searchParams.set('action','snapshot4');if(force)url.searchParams.set('_',Date.now());fetch(url.href,{credentials:'omit',cache:force?'no-store':'default'}).then(function(r){if(!r.ok)throw Error('Servicio alterno no disponible.');return r.json();}).then(function(x){if(!x||!x.ok||!x.snapshot||x.snapshot.api!==4)throw Error(x&&x.error||'Respuesta alterna inválida.');resolve(x.snapshot);}).catch(reject);}catch(e){reject(e);}});}
  async function load(force){
    var old=cached();
    if(!force&&old&&Date.now()-old.at<SOFT_TTL)return {snapshot:old.payload,stale:false,source:'cache'};
    try{var p=await loadSheet(!!force);store(p);return {snapshot:p,stale:false,source:'sheet'};}
    catch(first){try{var f=await fallbackApi(!!force);store(f);return {snapshot:f,stale:false,source:'api'};}catch(second){if(old)return {snapshot:old.payload,stale:true,source:'cache',warning:'Sin conexión para verificar la última publicación. Se muestra la copia confirmada más reciente guardada en este dispositivo.'};throw first;}}
  }
  root.DIN_SOURCE4={load:load};
})(window);
