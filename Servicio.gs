/** Endpoint público de solo lectura. Publica únicamente los dos horarios autorizados. */
function doGet(e) {
 const p=e && e.parameter || {},callback=p.callback||'';
 // Un callback arbitrario permitiría inyectar JavaScript.
 if(callback&&!/^dinRemote_[A-Za-z0-9_]{1,100}$/.test(callback))return ContentService.createTextOutput('{"ok":false,"error":"Callback inválido"}').setMimeType(ContentService.MimeType.JSON);
 let result;
 try {
  if(!['meta','pdf'].includes(p.action)||!['profesores','grupos'].includes(p.kind))throw Error('Consulta no permitida.');
  const c=CONFIG_DIN.horarios[p.kind],file=DriveApp.getFileById(c.id);
  if(file.getMimeType()!=='application/pdf')throw Error('El archivo configurado no es un PDF.');
  if(file.getSize()>CONFIG_DIN.maxBytes)throw Error('El horario supera 12 MB; reduce su tamaño antes de publicarlo.');
  const modified=file.getLastUpdated().toISOString();
  const version=c.id+':'+modified+':'+file.getSize()+':'+c.periodo;
  result={ok:true,version,modified,period:c.periodo};
  if(p.action==='pdf'){
   if(p.version!==version)throw Error('El horario cambió durante la consulta. Vuelve a buscar.');
   const blob=file.getBlob();
   if(file.getLastUpdated().toISOString()!==modified)throw Error('El horario está cambiando. Vuelve a buscar.');
   result.base64=Utilities.base64Encode(blob.getBytes());
  }
 } catch(error) {
  console.error(String(error));
  const known=/^(Consulta no permitida|El archivo configurado|El horario)/.test(error.message||'');
  result={ok:false,error:known?error.message:'No se pudo leer Drive. La coordinación debe revisar los permisos del archivo y el despliegue del servicio.'};
 }
 const json=JSON.stringify(result).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return ContentService.createTextOutput(callback?callback+'('+json+');':json).setMimeType(callback?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON);
}

function probarAcceso() {
 Object.keys(CONFIG_DIN.horarios).forEach(kind=>{
  const file=DriveApp.getFileById(CONFIG_DIN.horarios[kind].id);
  console.log(kind+': '+file.getName()+' · '+file.getSize()+' bytes · '+file.getLastUpdated());
 });
}
