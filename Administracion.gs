/** Administración autenticada. Los helpers privados no se pueden invocar con google.script.run. */
const DIN_TABLES_={PERIODOS:['id_periodo','nombre','activo'],GRUPOS:['id_grupo','grupo','periodo','tutor'],EDIFICIOS:['id_edificio','nombre','activo'],AULAS:['id_aula','edificio','planta','activo'],ASIGNACION_AULAS:['periodo','turno','activo']};
/** Ejecutar una sola vez desde el editor con la cuenta responsable del proyecto. */
function prepararAdministracion(){
 const email=Session.getActiveUser().getEmail().toLowerCase();
 if(email!=='ivan.gutierrez@uteq.edu.mx')throw Error('Solo la cuenta responsable puede iniciar la administración.');
 const p=PropertiesService.getScriptProperties();
 if(!p.getProperty('DIN_ADMINS'))p.setProperty('DIN_ADMINS',email);
 if(!p.getProperty('DIN_FOLDER'))p.setProperty('DIN_FOLDER',DriveApp.createFolder('Consulta DIN · Versiones y horarios').getId());
 console.log('Administración preparada. Carpeta privada creada; las hojas originales no se modificaron.');
}
function adminIdentity_(){
 const email=Session.getActiveUser().getEmail().toLowerCase();
 if(email!=='ivan.gutierrez@uteq.edu.mx')throw Error('Acceso denegado. La administración es exclusiva de ivan.gutierrez@uteq.edu.mx.');return email;
}
function jsonFile_(id){return JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());}
function props_(){return PropertiesService.getScriptProperties();}
function release_(){const id=props_().getProperty('DIN_RELEASE');return id?jsonFile_(id):null;}
function seed_(){
 const book=SpreadsheetApp.openById(CONFIG_DIN.sheetId),data={};Object.keys(DIN_TABLES_).forEach(k=>data[k]=filas_(book,k).map(r=>Object.fromEntries(Object.entries(r).filter(([key])=>key))));
 const schedules={};Object.keys(CONFIG_DIN.horarios).forEach(k=>{const c=CONFIG_DIN.horarios[k];schedules[c.periodo]=schedules[c.periodo]||{};schedules[c.periodo][k]={...c};});
 return {data,schedules,plans:[],revision:'initial',active:data.PERIODOS.find(p=>normalizar_(p.activo)==='true')?.id_periodo||''};
}
function draft_(){const id=props_().getProperty('DIN_DRAFT');return id?jsonFile_(id):release_()||seed_();}
function storeState_(state,label){
 const folderId=props_().getProperty('DIN_FOLDER');if(!folderId)throw Error('Configura DIN_FOLDER una vez con una carpeta privada de Drive.');
 state.revision=Utilities.getUuid();state.updated=new Date().toISOString();
 return DriveApp.getFolderById(folderId).createFile('DIN-'+label+'-'+state.revision+'.json',JSON.stringify(state),'application/json').getId();
}
function validateRows_(table,rows){
 if(!Object.hasOwn(DIN_TABLES_,table)||!Array.isArray(rows)||rows.length>10000)throw Error('Tabla inválida o más de 10 000 filas.');
 const errors=[],seen=new Set(),id={PERIODOS:'id_periodo',GRUPOS:'id_grupo',EDIFICIOS:'id_edificio',AULAS:'id_aula'}[table];
 rows.forEach((r,i)=>{
  if(!r||typeof r!=='object'||Array.isArray(r)){errors.push('Fila '+(i+2)+': registro inválido');return;}
  DIN_TABLES_[table].forEach(k=>{if(!Object.hasOwn(r,k)||(k!=='tutor'&&!String(r[k]??'').trim()))errors.push('Fila '+(i+2)+': falta '+k);});
  Object.entries(r).forEach(([k,v])=>{if(!/^[a-z][a-z0-9_]{0,49}$/.test(k)||typeof v==='object'||String(v??'').length>4000)errors.push('Fila '+(i+2)+': columna o valor inválido '+k);});
  if(Object.hasOwn(r,'activo')&&!['true','false','verdadero','falso','1','0','si','no'].includes(normalizar_(r.activo)))errors.push('Fila '+(i+2)+': activo debe ser TRUE o FALSE');
  if(id){const key=(table==='GRUPOS'?r.periodo+':':'')+r[id];if(seen.has(key))errors.push('Fila '+(i+2)+': identificador duplicado '+key);seen.add(key);}
  if(table==='ASIGNACION_AULAS'&&!(String(r.id_aula||'').trim()||String(r.salon||'').trim()))errors.push('Fila '+(i+2)+': completa salon o id_aula; grupo vacío significa sin asignación');
 });return errors;
}
function validateState_(s){
 const errors=[];Object.keys(DIN_TABLES_).forEach(t=>errors.push(...validateRows_(t,s.data[t]||[])));
 const active=v=>['true','verdadero','1','si'].includes(normalizar_(v));
 if(!s.data.PERIODOS.some(p=>p.id_periodo===s.active))errors.push('Selecciona un periodo existente.');
 const gs=s.data.GRUPOS.filter(g=>g.periodo===s.active&&(!Object.hasOwn(g,'activo')||active(g.activo)));
 if(!gs.length)errors.push('El periodo necesita grupos activos.');
 const codes=new Set();gs.forEach(g=>{if(codes.has(normalizar_(g.grupo)))errors.push('Código de grupo duplicado: '+g.grupo);codes.add(normalizar_(g.grupo));});
 s.data.AULAS.filter(r=>active(r.activo)).forEach(r=>{if(s.data.EDIFICIOS.filter(b=>active(b.activo)&&[b.id_edificio,b.nombre,b.nombre_completo].some(v=>v&&normalizar_(v)===normalizar_(r.edificio))).length!==1)errors.push('Edificio inexistente o ambiguo para '+r.id_aula);});
 s.data.ASIGNACION_AULAS.filter(a=>a.periodo===s.active&&active(a.activo)).forEach((a,i)=>{
  const groups=gs.filter(g=>a.grupo?normalizar_(g.grupo)===normalizar_(a.grupo):g.id_grupo===a.id_grupo);
  const rooms=s.data.AULAS.filter(r=>active(r.activo)&&(a.salon?normalizar_(r.nombre)===normalizar_(a.salon):r.id_aula===a.id_aula)&&(!a.planta||normalizar_(r.planta).replace(/^planta /,'')===normalizar_(a.planta).replace(/^planta /,''))&&(!a.edificio||s.data.EDIFICIOS.some(b=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>v&&normalizar_(v)===normalizar_(a.edificio))&&[b.id_edificio,b.nombre,b.nombre_completo].includes(r.edificio))));
  if(((a.grupo||a.id_grupo)&&groups.length!==1)||rooms.length!==1)errors.push('Asignación '+(i+1)+': grupo o aula inexistente/ambiguo.');
 });
 ['profesores','grupos'].forEach(k=>{if(!s.schedules[s.active]?.[k]?.id)errors.push('Falta horario de '+k+' para '+s.active);});
 if(s.directories?.[s.active]){try{if(s.directories[s.active].pdfVersion!==teacherVersion_(s,s.active).version)errors.push('El PDF de profesores cambió. Abre el directorio, verifica las coincidencias y guárdalo antes de publicar.');}catch(e){errors.push(e.message);}}
 return errors;
}
function validatePlan_(p){
 if(!p||!p.id||!p.edificio||!p.planta||![p.width,p.height].every(v=>Number.isFinite(v)&&v>0&&v<=10000)||!Array.isArray(p.spaces)||p.spaces.length>500)throw Error('Croquis inválido.');
 const seen=new Set();p.spaces.forEach(s=>{if(!s.key||seen.has(s.key)||![s.x,s.y,s.w,s.h].every(Number.isFinite)||s.x<0||s.y<0||s.w<=0||s.h<=0||s.x+s.w>p.width||s.y+s.h>p.height)throw Error('Aula fuera del croquis o clave duplicada.');seen.add(s.key);if(s.points&&(!Array.isArray(s.points)||s.points.length<3||s.points.some(q=>!Array.isArray(q)||q.length!==2||!q.every(Number.isFinite)||q[0]<0||q[1]<0||q[0]>p.width||q[1]>p.height)))throw Error('Polígono inválido.');});
 if(p.background&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p.background))throw Error('Imagen de croquis inválida.');
 if(JSON.stringify(p).length>3000000)throw Error('Reduce el croquis a menos de 2 MB.');
}
/** Una fila por grupo/asignación. Los catálogos se combinan sin borrar planos ni aulas existentes. */
function unifiedImport_(state,rows,period,catalogOnly){
 if(!Array.isArray(rows)||!rows.length||rows.length>10000)throw Error('Carga entre 1 y 10 000 filas.');
 if(!state.data.PERIODOS.some(p=>p.id_periodo===period))throw Error('Primero crea o selecciona el periodo.');
 const data=JSON.parse(JSON.stringify(state.data)),errors=[],seen={EDIFICIOS:new Map(),AULAS:new Map(),GRUPOS:new Map()},assignments=new Map();
 const text=v=>String(v??'').trim(),key=v=>normalizar_(v),floor=v=>text(v).replace(/^planta\s+/i,'').toUpperCase();
 const slug=v=>key(v).replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').toUpperCase();
 function find(table,id,match,line){const a=data[table].filter(r=>id?key(r[{EDIFICIOS:'id_edificio',AULAS:'id_aula',GRUPOS:'id_grupo'}[table]])===key(id)&& (table!=='GRUPOS'||r.periodo===period):match(r));if(a.length>1)throw Error('Fila '+line+': hay varias coincidencias en '+table+'. Indica su código interno.');return a[0];}
 function put(table,record,id,line){
  const prior=seen[table].get(record[id]);
  if(prior){for(const k of Object.keys(record)){if(text(record[k])&&text(prior.record[k])&&key(record[k])!==key(prior.record[k]))errors.push('Filas '+prior.line+' y '+line+': '+record[id]+' tiene valores distintos en '+k+'. Corrige la vista previa.');else if(text(record[k]))prior.record[k]=record[k];}return prior.record;}
  seen[table].set(record[id],{record,line});return record;
 }
 rows.forEach((input,i)=>{const line=i+2;try{
  if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Fila '+line+': registro inválido.');
  const r={};for(const [k,v] of Object.entries(input)){if(typeof v==='object'||text(v).length>4000)throw Error('Fila '+line+': valor inválido en '+k);r[k]=text(v);}
  if(r.periodo&&r.periodo!==period)throw Error('Fila '+line+': el periodo debe ser '+period+'.');
  if(!r.grupo&&!r.edificio&&!r.id_edificio)throw Error('Fila '+line+': escribe un grupo o un edificio.');
  let b,room,g;
  if(r.edificio||r.id_edificio){
   const old=find('EDIFICIOS',r.id_edificio,b=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>v&&key(v)===key(r.edificio)),line);
   const id=old?.id_edificio||r.id_edificio||'ED-'+slug(r.edificio);
   if(!old&&!r.edificio)throw Error('Fila '+line+': falta el nombre del edificio.');
   const buildingName=old&&[old.id_edificio,old.nombre_completo].some(v=>v&&key(v)===key(r.edificio))?old.nombre:r.edificio||old.nombre;
   b=put('EDIFICIOS',{id_edificio:id,nombre:buildingName,...(r.nombre_edificio_completo?{nombre_completo:r.nombre_edificio_completo}:{}),activo:'TRUE'},'id_edificio',line);
   if(r.aula||r.id_aula){
    if(!r.planta)throw Error('Fila '+line+': indica la planta del aula (BAJA, ALTA, NIVEL 2…).');
    const oldRoom=find('AULAS',r.id_aula,a=>[old?.id_edificio,old?.nombre,old?.nombre_completo,b.id_edificio,b.nombre].filter(Boolean).some(v=>key(v)===key(a.edificio))&&floor(a.planta)===floor(r.planta)&&key(a.nombre||a.id_aula)===key(r.aula),line);
    if(oldRoom&&(![old?.id_edificio,old?.nombre,old?.nombre_completo,b.id_edificio,b.nombre].filter(Boolean).some(v=>key(v)===key(oldRoom.edificio))||floor(oldRoom.planta)!==floor(r.planta)))throw Error('Fila '+line+': el código de aula pertenece a otro edificio o planta. Usa otro código para el aula nueva.');
    if(!oldRoom&&!r.aula)throw Error('Fila '+line+': falta el nombre del aula.');
    room={id_aula:oldRoom?.id_aula||r.id_aula||b.id_edificio+'-'+slug(r.planta)+'-'+slug(r.aula),nombre:r.aula||oldRoom.nombre,edificio:oldRoom?.edificio||b.id_edificio,planta:floor(r.planta),activo:'TRUE'};
    ['capacidad','observaciones'].forEach(k=>{if(r[k])room[k]=r[k];});if(r.tipo_aula)room.tipo=r.tipo_aula;
    if(r.capacidad&&(!/^\d+$/.test(r.capacidad)||Number(r.capacidad)<1))throw Error('Fila '+line+': capacidad debe ser un número entero de personas mayor que cero.');
    room=put('AULAS',room,'id_aula',line);
   }
  }else if(r.aula||r.id_aula||r.planta)throw Error('Fila '+line+': indica el edificio de esa aula o planta.');
  if(r.grupo&&!catalogOnly){
   const old=find('GRUPOS',r.id_grupo,g=>g.periodo===period&&key(g.grupo)===key(r.grupo),line);
   g={id_grupo:old?.id_grupo||r.id_grupo||period+'-'+slug(r.grupo),grupo:r.grupo,periodo:period,tutor:r.tutor||'',activo:'TRUE'};
   ['correo','ingenieria','cuatrimestre','generacion','salida_lateral'].forEach(k=>{if(r[k])g[k]=r[k];});
   g=put('GRUPOS',g,'id_grupo',line);
   if(room){if(!r.turno)throw Error('Fila '+line+': indica el turno de la asignación (Matutino o Vespertino).');const a={periodo:period,id_grupo:g.id_grupo,id_aula:room.id_aula,turno:r.turno,activo:'TRUE'};assignments.set([a.id_grupo,a.id_aula,key(a.turno)].join('|'),a);}
  }
 }catch(e){errors.push(e.message);}});
 for(const table of ['EDIFICIOS','AULAS']){const id=table==='EDIFICIOS'?'id_edificio':'id_aula';for(const {record} of seen[table].values()){const old=data[table].find(r=>r[id]===record[id]);if(old)Object.assign(old,record);else data[table].push(record);}}
 const groups=[...seen.GRUPOS.values()].map(v=>v.record);
 if(!catalogOnly){
  if(!groups.length)errors.push('La hoja no contiene grupos. Para agregar solo edificios o aulas utiliza los formularios de Catálogo.');
  data.GRUPOS=data.GRUPOS.filter(r=>r.periodo!==period).concat(groups);
  data.ASIGNACION_AULAS=data.ASIGNACION_AULAS.filter(r=>r.periodo!==period).concat([...assignments.values()]);
 }
 for(const t of ['EDIFICIOS','AULAS','GRUPOS','ASIGNACION_AULAS'])errors.push(...validateRows_(t,data[t]));
 const names=new Set();data.GRUPOS.filter(g=>g.periodo===period).forEach(g=>{if(names.has(key(g.grupo)))errors.push('Grupo repetido con códigos internos distintos: '+g.grupo);names.add(key(g.grupo));});
 return {data,errors,counts:{grupos:groups.length,edificios:seen.EDIFICIOS.size,aulas:seen.AULAS.size,asignaciones:assignments.size},pending:groups.filter(g=>![...assignments.values()].some(a=>a.id_grupo===g.id_grupo)).length};
}
function adminAction(request){
 const email=adminIdentity_(),r=request||{},lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  let s=draft_();
  if(r.action==='read')return {state:s,email,errors:validateState_(s)};
  if(r.revision!==s.revision)throw Error('Otra sesión modificó el borrador. Recarga antes de continuar.');
  if(r.action==='validate')return {errors:validateState_(s)};
  if(r.action==='teacherPdf'){const p=teacherVersion_(s,s.active);if(p.file.getSize()>CONFIG_DIN.maxBytes)throw Error('El PDF supera el tamaño permitido.');return {period:s.active,version:p.version,base64:Utilities.base64Encode(p.file.getBlob().getBytes())};}
  if(['previewClassroom','moveClassroom'].includes(r.action)){
   const change=classroomChange_(s,r);if(r.action==='previewClassroom')return change;
   if(change.displaced.length&&!r.confirmDisplaced)throw Error('Confirma que revisaste los grupos que dejarán esta aula.');s.data.ASIGNACION_AULAS=change.rows;
   s.editedBy=email;props_().setProperty('DIN_DRAFT',storeState_(s,'borrador'));return {state:s,email,errors:validateState_(s),pending:change.pending};
  }
  if(r.action==='directory'){
   const current=teacherVersion_(s,s.active);if(r.pdfVersion!==current.version)throw Error('Cambió el PDF de profesores. Vuelve a verificar las coincidencias.');
   const rows=validateDirectory_(r.rows,r.names);s.directories=s.directories||{};s.directories[s.active]={rows,pdfVersion:current.version};
   s.editedBy=email;props_().setProperty('DIN_DRAFT',storeState_(s,'borrador'));return {state:s,email,errors:validateState_(s)};
  }
  if(['previewUnified','importUnified','catalogEntry'].includes(r.action)){
   const result=unifiedImport_(s,r.rows,r.period||s.active,r.action==='catalogEntry');
   if(r.action==='previewUnified')return result;
   if(result.errors.length)throw Error(result.errors.slice(0,20).join('\n'));
   s.data=result.data;
  }else if(r.action==='import'){
   if(['EDIFICIOS','AULAS'].includes(r.table))r.rows=compactCatalog_(r.table,r.rows);
   const errors=validateRows_(r.table,r.rows);if(errors.length)throw Error(errors.slice(0,15).join('\n'));
   // Replace only the selected period for period-scoped tables.
   if(['GRUPOS','ASIGNACION_AULAS'].includes(r.table)){
    if(!s.data.PERIODOS.some(p=>p.id_periodo===r.period)||r.rows.some(row=>row.periodo!==r.period))throw Error('Todas las filas deben corresponder al periodo seleccionado.');
    s.data[r.table]=s.data[r.table].filter(row=>row.periodo!==r.period).concat(r.rows);
   }else if(r.merge){const id=r.table==='EDIFICIOS'?'id_edificio':'id_aula';r.rows.forEach(row=>{const old=s.data[r.table].find(x=>x[id]===row[id]);if(old)Object.assign(old,row);else s.data[r.table].push(row);});}else s.data[r.table]=r.rows;
  }else if(r.action==='period'){
   if(!/^[A-Za-z0-9_-]{1,40}$/.test(r.id)||!String(r.name||'').trim())throw Error('Completa código y nombre del periodo.');
   const p=s.data.PERIODOS.find(p=>p.id_periodo===r.id);if(p)p.nombre=r.name;else s.data.PERIODOS.push({id_periodo:r.id,nombre:r.name,activo:'FALSE'});s.active=r.id;
  }else if(r.action==='active'){
   if(!s.data.PERIODOS.some(p=>p.id_periodo===r.period))throw Error('Periodo inexistente.');s.active=r.period;
  }else if(r.action==='pdf'){
   if(!['profesores','grupos'].includes(r.kind)||!s.data.PERIODOS.some(p=>p.id_periodo===r.period))throw Error('Tipo o periodo inválido.');
   if(typeof r.base64!=='string'||r.base64.length>17000000)throw Error('PDF demasiado grande.');const bytes=Utilities.base64Decode(r.base64);
   if(bytes.length>CONFIG_DIN.maxBytes||String.fromCharCode(...bytes.slice(0,5))!=='%PDF-')throw Error('Selecciona un PDF válido de hasta 12 MB.');
   const folder=DriveApp.getFolderById(props_().getProperty('DIN_FOLDER'));
   const file=folder.createFile(Utilities.newBlob(bytes,'application/pdf','DIN-'+r.period+'-'+r.kind+'.pdf'));
   s.schedules[r.period]=s.schedules[r.period]||{};s.schedules[r.period][r.kind]={id:file.getId(),periodo:r.period};
  }else if(r.action==='plan'){
   validatePlan_(r.plan);if(!s.data.EDIFICIOS.some(b=>b.id_edificio===r.plan.edificio))throw Error('Edificio inexistente.');
   const other=s.plans.find(p=>p.id!==r.plan.id&&p.edificio===r.plan.edificio&&p.planta===r.plan.planta);if(other)throw Error('Ya existe otro plano para ese edificio y planta. Edita '+other.id);
   r.plan.spaces.filter(z=>z.roomId).forEach(z=>{const room=s.data.AULAS.find(a=>a.id_aula===z.roomId),b=s.data.EDIFICIOS.find(b=>b.id_edificio===r.plan.edificio);if(!room||![b.id_edificio,b.nombre,b.nombre_completo].includes(room.edificio)||normalizar_(room.planta).replace(/^planta /,'').toUpperCase()!==r.plan.planta)throw Error('El aula no corresponde al edificio y planta.');room.posicion=z.key;});
   s.plans=s.plans.filter(p=>p.id!==r.plan.id);s.plans.push(r.plan);
  }else if(r.action==='publish'){
   const errors=validateState_(s);if(errors.length)throw Error(errors.slice(0,20).join('\n'));
   ['profesores','grupos'].forEach(k=>{const f=DriveApp.getFileById(s.schedules[s.active][k].id);if(f.getMimeType()!=='application/pdf'||f.getSize()>CONFIG_DIN.maxBytes)throw Error('PDF inválido: '+k);});
   s.data.PERIODOS.forEach(p=>p.activo=p.id_periodo===s.active?'TRUE':'FALSE');s.publishedBy=email;
   const id=storeState_(s,'publicado'),old=props_().getProperty('DIN_RELEASE');
   if(old)props_().setProperty('DIN_PREVIOUS',old);
   // A single pointer publishes the complete snapshot atomically.
   props_().setProperty('DIN_RELEASE',id);props_().setProperty('DIN_DRAFT',id);return {state:s,email,errors:[],published:true};
  }else if(r.action==='rollback'){
   const previous=props_().getProperty('DIN_PREVIOUS');if(!previous)throw Error('No hay publicación anterior.');
   const old=props_().getProperty('DIN_RELEASE');props_().setProperty('DIN_RELEASE',previous);props_().setProperty('DIN_PREVIOUS',old);props_().setProperty('DIN_DRAFT',previous);s=jsonFile_(previous);return {state:s,email,errors:validateState_(s)};
  }else throw Error('Operación no permitida.');
  s.editedBy=email;props_().setProperty('DIN_DRAFT',storeState_(s,'borrador'));return {state:s,email,errors:validateState_(s)};
 }finally{lock.releaseLock();}
}
function compactCatalog_(table,rows){
 if(!Array.isArray(rows)||rows.length>10000)throw Error('Catálogo inválido.');
 const id=table==='EDIFICIOS'?'id_edificio':'id_aula',seen=new Map();
 rows.forEach((r,i)=>{const old=seen.get(r[id]);if(!old){seen.set(r[id],{row:{...r},line:i+2});return;}Object.entries(r).forEach(([k,v])=>{if(String(v??'').trim()&&String(old.row[k]??'').trim()&&normalizar_(v)!==normalizar_(old.row[k]))throw Error('Filas '+old.line+' y '+(i+2)+': '+r[id]+' tiene valores distintos en '+k+'. Corrige esas celdas en la vista previa.');if(String(v??'').trim())old.row[k]=v;});});return [...seen.values()].map(x=>x.row);
}

/** Cambia un aula solo en el periodo y turno elegidos; siempre previsualiza los desplazados. */
function classroomChange_(s,r){
 const on=v=>['true','verdadero','1','si'].includes(normalizar_(v)),same=(a,b)=>normalizar_(a)===normalizar_(b);
 const groups=s.data.GRUPOS.filter(g=>g.periodo===s.active&&(!Object.hasOwn(g,'activo')||on(g.activo)));
 const group=groups.find(g=>g.id_grupo===r.groupId),room=s.data.AULAS.find(a=>a.id_aula===r.roomId&&on(a.activo));
 if(!group||!room||!String(r.turn||'').trim())throw Error('Selecciona un grupo, un aula activa y el turno.');
 const building=s.data.EDIFICIOS.find(b=>on(b.activo)&&[b.id_edificio,b.nombre,b.nombre_completo].some(v=>v&&same(v,room.edificio)));
 if(!building)throw Error('El aula no pertenece a un edificio activo.');
 const groupFor=a=>groups.find(g=>a.id_grupo?g.id_grupo===a.id_grupo:a.grupo&&same(g.grupo,a.grupo));
 const inScope=a=>a.periodo===s.active&&on(a.activo)&&same(a.turno,r.turn);
 const isTarget=a=>{
  if(a.id_aula)return a.id_aula===room.id_aula;
  const matches=s.data.AULAS.filter(candidate=>on(candidate.activo)&&a.salon&&same(a.salon,candidate.nombre)&&(!a.planta||same(String(a.planta).replace(/^planta /i,''),String(candidate.planta).replace(/^planta /i,'')))&&(!a.edificio||s.data.EDIFICIOS.some(b=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>v&&same(v,a.edificio))&&[b.id_edificio,b.nombre,b.nombre_completo].some(v=>v&&same(v,candidate.edificio)))));
  if(matches.some(x=>x.id_aula===room.id_aula)&&matches.length!==1)throw Error('Una asignación anterior no identifica claramente el edificio y la planta. Corrígela en Excel y datos antes de mover este grupo.');
  return matches.length===1&&matches[0].id_aula===room.id_aula;
 };
 const removed=s.data.ASIGNACION_AULAS.filter(a=>inScope(a)&&(groupFor(a)?.id_grupo===group.id_grupo||isTarget(a)));
 const displaced=[...new Map(removed.map(groupFor).filter(g=>g&&g.id_grupo!==group.id_grupo).map(g=>[g.id_grupo,g])).values()];
 const rows=s.data.ASIGNACION_AULAS.filter(a=>!removed.includes(a)).concat([{periodo:s.active,id_grupo:group.id_grupo,id_aula:room.id_aula,turno:String(r.turn).trim(),activo:'TRUE'}]);
 const pending=groups.filter(g=>!rows.some(a=>a.periodo===s.active&&on(a.activo)&&groupFor(a)?.id_grupo===g.id_grupo));
 return {rows,group:group.grupo,room:(building.nombre+' · '+room.planta+' · '+(room.nombre||room.id_aula)),displaced:displaced.map(g=>({id:g.id_grupo,name:g.grupo})),pending:pending.map(g=>g.grupo)};
}
function teacherVersion_(s,period){
 const id=s.schedules[period]?.profesores?.id;if(!id)throw Error('Primero carga el PDF de horarios de profesores de este periodo.');
 const file=DriveApp.getFileById(id);return {file,version:id+':'+file.getLastUpdated().toISOString()+':'+file.getSize()+':'+period};
}
function validateDirectory_(rows,names){
 if(!Array.isArray(rows)||!rows.length||rows.length>1000||!Array.isArray(names)||!names.length||names.length>300)throw Error('Directorio o índice de profesores inválido.');
 const available=new Set(names.map(normalizar_)),seen=new Set(),fields=['nombre','nombre_pdf','nombre_tutor','categoria','correo','horario_laboral'];
 return rows.map((r,i)=>{const out={};fields.forEach(k=>{const v=r[k]??'';if(typeof v!=='string'||v.length>4000)throw Error('Fila '+(i+2)+': dato inválido en '+k);out[k]=v.trim();});
  if(!out.nombre)throw Error('Fila '+(i+2)+': falta el nombre del profesor.');
  const key=normalizar_(out.nombre_pdf);if(!available.has(key))throw Error('Fila '+(i+2)+': selecciona el nombre que aparece en el PDF de profesores.');
  if(seen.has(key))throw Error('Fila '+(i+2)+': el profesor del PDF ya está vinculado a otra fila.');seen.add(key);
  if(out.correo&&!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(out.correo))throw Error('Fila '+(i+2)+': correo inválido.');return out;
 });
}
