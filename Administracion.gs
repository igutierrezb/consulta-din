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
 const allowed=(PropertiesService.getScriptProperties().getProperty('DIN_ADMINS')||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!email||!allowed.includes(email))throw Error('Acceso denegado. Entra con una cuenta autorizada en el despliegue administrativo.');return email;
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
 return errors;
}
function validatePlan_(p){
 if(!p||!p.id||!p.edificio||!p.planta||![p.width,p.height].every(v=>Number.isFinite(v)&&v>0&&v<=10000)||!Array.isArray(p.spaces)||p.spaces.length>500)throw Error('Croquis inválido.');
 const seen=new Set();p.spaces.forEach(s=>{if(!s.key||seen.has(s.key)||![s.x,s.y,s.w,s.h].every(Number.isFinite)||s.x<0||s.y<0||s.w<=0||s.h<=0||s.x+s.w>p.width||s.y+s.h>p.height)throw Error('Aula fuera del croquis o clave duplicada.');seen.add(s.key);if(s.points&&(!Array.isArray(s.points)||s.points.length<3||s.points.some(q=>!Array.isArray(q)||q.length!==2||!q.every(Number.isFinite)||q[0]<0||q[1]<0||q[0]>p.width||q[1]>p.height)))throw Error('Polígono inválido.');});
 if(p.background&&!/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(p.background))throw Error('Imagen de croquis inválida.');
 if(JSON.stringify(p).length>3000000)throw Error('Reduce el croquis a menos de 2 MB.');
}
function adminAction(request){
 const email=adminIdentity_(),r=request||{},lock=LockService.getScriptLock();lock.waitLock(30000);
 try{
  let s=draft_();
  if(r.action==='read')return {state:s,email,errors:validateState_(s)};
  if(r.revision!==s.revision)throw Error('Otra sesión modificó el borrador. Recarga antes de continuar.');
  if(r.action==='validate')return {errors:validateState_(s)};
  if(r.action==='import'){
   const errors=validateRows_(r.table,r.rows);if(errors.length)throw Error(errors.slice(0,15).join('\n'));
   // Replace only the selected period for period-scoped tables.
   if(['GRUPOS','ASIGNACION_AULAS'].includes(r.table)){
    if(!s.data.PERIODOS.some(p=>p.id_periodo===r.period)||r.rows.some(row=>row.periodo!==r.period))throw Error('Todas las filas deben corresponder al periodo seleccionado.');
    s.data[r.table]=s.data[r.table].filter(row=>row.periodo!==r.period).concat(r.rows);
   }else s.data[r.table]=r.rows;
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
