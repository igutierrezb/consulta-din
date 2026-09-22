/* Motor de datos independiente de la interfaz. No contiene asignaciones de grupos. */
(function(root){
 'use strict';
 const str=v=>String(v??'').trim();
 const norm=v=>str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');
 const active=v=>v===true||['true','verdadero','1','si'].includes(norm(v));
 const esc=v=>str(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const unique=(rows,key,value)=>{const found=rows.filter(r=>str(r[key])===str(value));return found.length===1?found[0]:null;};
 function objects(table){
  if(!table||!Array.isArray(table.cols)||!Array.isArray(table.rows))throw Error('Respuesta de datos inválida');
  const keys=table.cols.map(c=>norm(c.label));
  return table.rows.map(row=>Object.fromEntries(keys.map((k,i)=>{const c=row.c[i];return [k,c?(c.f??c.v??''):''];}))).filter(r=>Object.values(r).some(v=>str(v)));
 }
 function model(data,periodId,plans=[]){
  const periods=(data.PERIODOS||[]).filter(p=>active(p.activo));
  const period=unique(periods,'id_periodo',periodId);
  const allGroups=(data.GRUPOS||[]).filter(g=>period&&str(g.periodo)===str(period.id_periodo));
  const groups=allGroups.filter(g=>!Object.hasOwn(g,'activo')||active(g.activo));
  const buildings=(data.EDIFICIOS||[]).filter(b=>active(b.activo));
  function building(code){const matches=(data.EDIFICIOS||[]).filter(b=>[b.id_edificio,b.nombre,b.nombre_completo].some(v=>norm(v)===norm(code)));return matches.length===1&&active(matches[0].activo)?matches[0]:null;}
  const allRooms=data.AULAS||[];
  const rooms=allRooms.filter(r=>active(r.activo)&&building(r.edificio)&&unique(allRooms,'id_aula',r.id_aula));
  const issues=[];
  const same=(a,b)=>norm(a).replace(/\s/g,'')===norm(b).replace(/\s/g,'');
  const floor=v=>norm(v).replace(/^planta /,'');
  const assignments=(data.ASIGNACION_AULAS||[]).flatMap((a,i)=>{
   if(!period||str(a.periodo)!==str(period.id_periodo)||!active(a.activo))return [];
   const fail=message=>{issues.push('ASIGNACION_AULAS, fila '+(i+2)+': '+message);return [];};
   const byName=Object.hasOwn(a,'grupo')||Object.hasOwn(a,'salon');
   if(!byName)return [a]; // Compatibilidad con la hoja anterior durante la migración.
   if(!str(a.grupo)||!str(a.salon))return fail('Completa grupo y salón.');
   const gs=groups.filter(g=>same(g.grupo,a.grupo));
   if(gs.length!==1)return fail('Grupo «'+str(a.grupo)+'» '+(gs.length?'ambiguo; hay códigos duplicados.':'inexistente o inactivo en el periodo.'));
   const rs=rooms.filter(r=>same(roomLabel(r),a.salon)&&(!str(a.edificio)||building(a.edificio)===building(r.edificio))&&(!str(a.planta)||floor(a.planta)===floor(r.planta)));
   if(rs.length!==1)return fail('Salón «'+str(a.salon)+'» '+(rs.length?'ambiguo; indica edificio y planta.':'inexistente o inactivo; revisa edificio, planta y nombre.'));
   return [{...a,id_grupo:gs[0].id_grupo,id_aula:rs[0].id_aula}];
  });
  function placements(g){
   if(!period||!str(g.id_grupo)||unique(allGroups,'id_grupo',g.id_grupo)!==g)return [];
   return assignments.filter(a=>active(a.activo)&&str(a.id_grupo)===str(g.id_grupo)).flatMap(a=>{const room=unique(rooms,'id_aula',a.id_aula);return room?[{assignment:a,room,building:building(room.edificio)}]:[];});
  }
  function geometry(room){
   const b=building(room.edificio);if(!b)return null;
   const floor=norm(room.planta).replace(/^planta /,'').toUpperCase();
   const plan=plans.find(p=>p.edificio===b.id_edificio&&p.planta===floor);if(!plan)return null;
   const key=str(room.posicion)||str(room.id_aula).replace(plan.id+'-','');
   // A position may name an existing shape, or explicitly define a new rectangle/polygon.
   if(key.startsWith('{')){
    try{const s=JSON.parse(key);const vals=['x','y','w','h'].map(k=>s[k]);if(vals.some(v=>typeof v!=='number'||!Number.isFinite(v))||s.w<=0||s.h<=0||s.x<0||s.y<0||s.x+s.w>plan.width||s.y+s.h>plan.height)return null;
     if(s.points&&(!Array.isArray(s.points)||s.points.length<3||s.points.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>typeof v!=='number'||!Number.isFinite(v))||p[0]<0||p[1]<0||p[0]>plan.width||p[1]>plan.height)))return null;
     return {plan,space:{...s,key:'custom-'+str(room.id_aula),label:str(s.label)||roomLabel(room),kind:'room'}};
    }catch{return null;}
   }
   const spaces=plan.spaces.filter(s=>s.key===key);return spaces.length===1?{plan,space:spaces[0]}:null;
  }
  function roomLabel(room){
   if(str(room.nombre))return str(room.nombre);
   const id=str(room.id_aula);const b=building(room.edificio);const p=plans.find(p=>p.edificio===b?.id_edificio&&norm(p.planta)===norm(room.planta).replace(/^planta /,''));const s=p?.spaces.find(s=>s.key===(str(room.posicion)||id.slice(p.id.length+1)));
   return s?.label||(str(room.salon)?'Salón '+str(room.salon):id.split('-').slice(2).join(' ').replaceAll('_',' '))||str(room.tipo)||'Aula';
  }
  return {periods,period,groups,buildings,rooms,assignments,issues,building,placements,geometry,roomLabel};
 }
 function hasAssignedTutor(value){const name=String(value??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');return !!name&&!['sin tutor','sin tutora','sin asignar','no asignado','no asignada','pendiente','pendiente de asignacion','pendiente de captura','fusion','n/a','na','ninguno','ninguna','0','-','—'].includes(name);}
 const api={hasTutor:hasAssignedTutor,str,norm,active,esc,unique,objects,model};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DIN=api;
})(typeof window==='undefined'?this:window);
