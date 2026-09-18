function onOpen(){SpreadsheetApp.getUi().createMenu('DIN').addItem('Preparar migración sin modificar el original','prepararMigracion').addItem('Actualizar listas de asignación','prepararListas').addToUi();}
function normalizar_(v){return String(v||'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');}
function filas_(book,name){
 const sheet=book.getSheetByName(name);if(!sheet)throw Error('Falta la pestaña '+name);
 const values=sheet.getDataRange().getDisplayValues(),keys=values.shift().map(normalizar_);
 return values.map(row=>Object.fromEntries(keys.map((k,i)=>[k,row[i]]))).filter(row=>Object.values(row).some(Boolean));
}
function prepararListas(){
 adminIdentity_();
 const book=SpreadsheetApp.openById(CONFIG_DIN.sheetId),active=v=>['true','verdadero','1','si'].includes(normalizar_(v));
 const groups=filas_(book,'GRUPOS'),rooms=filas_(book,'AULAS').filter(r=>active(r.activo)),buildings=filas_(book,'EDIFICIOS').filter(b=>active(b.activo)),periods=filas_(book,'PERIODOS').filter(p=>active(p.activo));
 if(rooms.some(r=>!r.nombre))throw Error('Completa primero AULAS.nombre usando AULAS_NOMBRES.csv. Ninguna fila activa debe quedar sin nombre.');
 const values=[['grupo','salon','edificio','planta','periodo','turno','activo']];
 const lists=[groups.filter(g=>periods.some(p=>p.id_periodo===g.periodo)&&(!Object.hasOwn(g,'activo')||active(g.activo))).map(g=>g.grupo),rooms.map(r=>r.nombre),buildings.map(b=>b.nombre),rooms.map(r=>r.planta),periods.map(p=>p.id_periodo),['MATUTINO'],['TRUE','FALSE']].map(a=>[...new Set(a.filter(Boolean))].sort());
 for(let i=0;i<Math.max(...lists.map(a=>a.length));i++)values.push(lists.map(a=>a[i]||''));
 const catalog=book.getSheetByName('DIN_LISTAS')||book.insertSheet('DIN_LISTAS');catalog.clearContents();catalog.getRange(1,1,values.length,7).setNumberFormat('@').setValues(values);catalog.setFrozenRows(1);catalog.autoResizeColumns(1,7);
 const target=book.getSheetByName('ASIGNACION_AULAS')||book.insertSheet('ASIGNACION_AULAS');
 if(!target.getLastRow())target.getRange(1,1,1,7).setValues([['periodo','grupo','edificio','planta','salon','turno','activo']]);
 const headers=target.getRange(1,1,1,target.getLastColumn()).getDisplayValues()[0].map(normalizar_);
 if(!['grupo','salon'].every(h=>headers.includes(h)))throw Error('Migra ASIGNACION_AULAS a las columnas humanas de la plantilla. No se modificaron tus filas.');
 values[0].forEach((key,i)=>{const col=headers.indexOf(key)+1;if(col&&lists[i].length)target.getRange(2,col,Math.max(1,target.getMaxRows()-1),1).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(catalog.getRange(2,i+1,lists[i].length,1),true).setAllowInvalid(false).setHelpText('Selecciona un valor de DIN_LISTAS. Para nombres de salón repetidos, indica edificio y planta.').build());});
 SpreadsheetApp.getUi().alert('Listas listas. Selecciona grupo, edificio, planta y salón. La web informa códigos inexistentes o combinaciones ambiguas por número de fila.');
}

/** Crea una hoja nueva; nunca reemplaza ASIGNACION_AULAS. Conserva filas vacías como pendientes. */
function prepararMigracion(){
 adminIdentity_();
 const book=SpreadsheetApp.openById(CONFIG_DIN.sheetId),rooms=filas_(book,'AULAS'),groups=filas_(book,'GRUPOS'),buildings=filas_(book,'EDIFICIOS'),original=filas_(book,'ASIGNACION_AULAS');
 if(rooms.some(r=>!r.nombre))throw Error('Primero completa AULAS.nombre. Consulta la guía y AULAS_NOMBRES.csv.');
 const out=[['periodo','grupo','edificio','planta','salon','turno','activo','revision']];
 original.forEach(a=>{
  if(Object.hasOwn(a,'grupo')){out.push([a.periodo,a.grupo,a.edificio,a.planta,a.salon,a.turno,a.activo,'Ya usa nombres']);return;}
  const rs=rooms.filter(r=>r.id_aula===a.id_aula),gs=groups.filter(g=>g.id_grupo===a.id_grupo&&g.periodo===a.periodo),r=rs.length===1?rs[0]:null;
  const bs=r?buildings.filter(b=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>normalizar_(v)===normalizar_(r.edificio))):[];
  const pending=!a.id_grupo,valid=r&&bs.length===1&&(pending||gs.length===1);
  out.push([a.periodo,gs.length===1?gs[0].grupo:'',bs.length===1?bs[0].nombre:'',r?r.planta:'',r?r.nombre:'',a.turno,pending?'FALSE':a.activo,valid?(pending?'Sin grupo: selecciona uno y activa TRUE':'Verificado'):'REVISAR: IDs inexistentes o ambiguos en el original']);
 });
 const name='ASIGNACION_NUEVA_'+Utilities.formatDate(new Date(),Session.getScriptTimeZone(),'yyyyMMdd_HHmmss');
 const target=book.insertSheet(name);target.getRange(1,1,out.length,8).setNumberFormat('@').setValues(out);target.setFrozenRows(1);target.autoResizeColumns(1,8);
 SpreadsheetApp.getUi().alert('Creada '+name+'. Revisa la columna revision. Después renombra la original como respaldo y esta nueva hoja como ASIGNACION_AULAS. Las filas sin grupo quedan inactivas hasta capturar uno.');
}
