/** Consulta pública académica y contador agregado de visitas, sin identificar visitantes. */
function doGet(e) {
 const p=e && e.parameter || {},callback=p.callback||'';
 if(p.action==='admin'){
  try{adminIdentity_();return HtmlService.createHtmlOutputFromFile('AdminPanel').setTitle('Administración DIN').addMetaTag('viewport','width=device-width, initial-scale=1');}
  catch(error){return HtmlService.createHtmlOutput('<h1>Acceso restringido</h1><p>Entra con una cuenta autorizada en el despliegue administrativo.</p>');}
 }
 // Un callback arbitrario permitiría inyectar JavaScript.
 if(callback&&!/^dinRemote_[A-Za-z0-9_]{1,100}$/.test(callback))return ContentService.createTextOutput('{"ok":false,"error":"Callback inválido"}').setMimeType(ContentService.MimeType.JSON);
 let result;
 try {
  if(p.action==='visits')return directoryResponse_(visits_(p.record==='1'));
  if(p.action==='directory'){
   const s=release_();if(!s)return directoryResponse_({ok:true,rows:[],period:null});
   const d=s.directories?.[s.active];const current=teacherVersion_(s,s.active);
   return directoryResponse_({ok:true,period:s.active,pdfVersion:current.version,rows:d?.pdfVersion===current.version?d.rows:[],warning:d&&d.pdfVersion!==current.version?'Directorio pendiente de verificar con el PDF vigente.':''});
  }
  if(['manifest','data','plans'].includes(p.action))return publicAcademic_(p,callback);
  if(!['meta','pdf'].includes(p.action)||!['profesores','grupos'].includes(p.kind))throw Error('Consulta no permitida.');
  const release=release_();
  const c=release?release.schedules[release.active]?.[p.kind]:CONFIG_DIN.horarios[p.kind];
  if(!c)throw Error('El horario no está publicado para este periodo.');
  const file=DriveApp.getFileById(c.id);
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
  const academic=['manifest','data','plans'].includes(p.action);
  result={ok:false,error:known?error.message:academic?'No se pudo leer el módulo académico solicitado. Actualiza la consulta; si persiste, informa a la coordinación.':'No se pudo leer Drive. La coordinación debe revisar los permisos del archivo y el despliegue del servicio.'};
 }
 const json=JSON.stringify(result).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return ContentService.createTextOutput(callback?callback+'('+json+');':json).setMimeType(callback?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON);
}

function publicAcademic_(p,callback){
 const state=release_(),revision=state?.revision||'sheets';let result={ok:true};
 if(p.action==='manifest')result={ok:true,api:2,revision,active:state?.active||null,updated:state?.updated||null};
 else{
  if(p.revision!==revision)throw Error('El horario o los datos cambiaron. Actualiza la consulta.');
  if(p.action==='plans')result.plans=state?.plans||[];
  else{
   if(!Object.hasOwn(DIN_TABLES_,p.sheet))throw Error('Consulta no permitida.');
   const rows=state?state.data[p.sheet]:filas_(SpreadsheetApp.openById(CONFIG_DIN.sheetId),p.sheet);
   // Public fields only: additional spreadsheet columns are never exposed.
   const fields={PERIODOS:['id_periodo','nombre','activo'],GRUPOS:['id_grupo','grupo','periodo','tutor','activo','correo','ingenieria','salida_lateral','cuatrimestre','generacion'],EDIFICIOS:['id_edificio','nombre','nombre_completo','activo'],AULAS:['id_aula','nombre','salon','edificio','planta','activo','posicion','tipo','capacidad','observaciones'],ASIGNACION_AULAS:['periodo','turno','activo','grupo','salon','edificio','planta','id_grupo','id_aula']};
   result.rows=rows.filter(r=>!state||!['GRUPOS','ASIGNACION_AULAS'].includes(p.sheet)||r.periodo===state.active).map(r=>Object.fromEntries(fields[p.sheet].filter(k=>Object.hasOwn(r,k)).map(k=>[k,r[k]])));
  }
 }
 const json=JSON.stringify(result).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 return ContentService.createTextOutput(callback?callback+'('+json+');':json).setMimeType(callback?ContentService.MimeType.JAVASCRIPT:ContentService.MimeType.JSON);
}

function probarAcceso() {
 adminIdentity_();
 Object.keys(CONFIG_DIN.horarios).forEach(kind=>{
  const file=DriveApp.getFileById(CONFIG_DIN.horarios[kind].id);
  console.log(kind+': '+file.getName()+' · '+file.getSize()+' bytes · '+file.getLastUpdated());
 });
}

function directoryResponse_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}

/** Contador agregado desde su instalación. No guarda IP, cuenta ni identificadores de visitante. */
function visits_(record){
 const lock=LockService.getScriptLock();lock.waitLock(3000);
 try{const p=PropertiesService.getScriptProperties(),raw=p.getProperty('DIN_VISITS'),value=raw?JSON.parse(raw):{count:0,since:new Date().toISOString()};
  if(!Number.isSafeInteger(value.count)||value.count<0)throw Error('Contador temporalmente no disponible.');
  if(record&&value.count<Number.MAX_SAFE_INTEGER){value.count++;p.setProperty('DIN_VISITS',JSON.stringify(value));}
  return {ok:true,count:value.count,since:value.since};
 }finally{lock.releaseLock();}
}
