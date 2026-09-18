/* Lecturas públicas: nunca enviar la sesión Google del visitante. */
window.DIN_REMOTE=(()=>{
 const pending=new Map();
 function request(params){
  const url=new URL(window.DIN_CONFIG.endpoint);
  if(url.protocol!=='https:'||url.hostname!=='script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname))return Promise.reject(Error('Servicio público sin configurar.'));
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  const key=url.href;if(pending.has(key))return pending.get(key);
  const task=(async()=>{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);
   try{
    const response=await fetch(url.href,{method:'GET',mode:'cors',credentials:'omit',redirect:'follow',cache:'no-store',referrerPolicy:'no-referrer',signal:controller.signal});
    if(!response.ok){const error=Error('El servicio público respondió con un error ('+response.status+').');error.retryable=response.status>=500||response.status===429;throw error;}
    let result;try{result=await response.json();}catch{throw Error('Google no devolvió los datos públicos esperados. Vuelve a intentar la consulta.');}
    if(!result||result.ok!==true)throw Error(result?.error||'Respuesta pública inválida.');
    return result;
   }catch(error){if(error.name==='AbortError'||error instanceof TypeError){const connection=Error('No se pudo verificar el servicio público. Pulsa Reintentar o Actualizar datos.');connection.retryable=true;throw connection;}throw error;}
   finally{clearTimeout(timer);}
  })();
  pending.set(key,task);task.then(()=>pending.delete(key),()=>pending.delete(key));return task;
 }
 return {request};
})();
