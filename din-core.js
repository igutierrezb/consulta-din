(function(root){
'use strict';
function str(v){return String(v==null?'':v).trim();}
function norm(v){return str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');}
function active(v){return v===true||['true','verdadero','1','si','sí'].indexOf(norm(v))>=0;}
function esc(v){return str(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function natural(a,b){return str(a).localeCompare(str(b),'es',{numeric:true,sensitivity:'base'});}
function compact(v){return norm(v).replace(/[^a-z0-9]/g,'');}
function slug(v){return norm(v).replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase();}
function floorRank(v){var x=norm(v).replace(/^planta /,'');if(x==='baja'||x==='pb')return '00';if(x==='alta'||x==='pa')return '01';var m=x.match(/(?:nivel|piso)\s*(\d+)/);return m?'02-'+String(Number(m[1])).padStart(3,'0'):'03-'+x;}
function hasTutor(v){var x=norm(v);return !!x&&['sin tutor','sin tutora','sin asignar','no asignado','no asignada','pendiente','pendiente de asignacion','pendiente de captura','fusion','fusión','n/a','na','ninguno','ninguna','0','-','—'].indexOf(x)<0;}
function tokenBag(v){return norm(v).split(' ').filter(Boolean).sort().join('|');}
function heuristicSurnameFirst(name){
  var value=str(name).replace(/\s+/g,' ');if(!value)return '';
  if(value.indexOf(',')>=0){var c=value.split(',');return (str(c[0])+' '+str(c.slice(1).join(' '))).trim();}
  var w=value.split(' ').filter(Boolean);if(w.length<3)return w.length===2?w[1]+' '+w[0]:value;
  var connectors={de:1,del:1,la:1,las:1,los:1,y:1};
  var maternal=w.length-1;while(maternal>1&&connectors[norm(w[maternal-1])])maternal--;
  var paternal=maternal-1;while(paternal>0&&connectors[norm(w[paternal-1])])paternal--;
  if(paternal<=0)return value;
  return w.slice(paternal).join(' ')+' '+w.slice(0,paternal).join(' ');
}
function teacherDisplay(source,snapshot){
  var raw=str(source),period=snapshot&&snapshot.active||'';
  var aliases=snapshot&&snapshot.teacherAliases&&snapshot.teacherAliases[period]||[];
  var a=aliases.find(function(x){return norm(x.sourceName)===norm(raw);});if(a&&a.publicName)raw=a.publicName;
  var directory=snapshot&&snapshot.directories&&snapshot.directories[period]&&snapshot.directories[period].rows||snapshot&&snapshot.directory||[];
  var d=directory.find(function(x){return norm(x.nombre_pdf||x.sourceName||'')===norm(raw)||norm(x.nombre||'')===norm(raw);});
  if(d){
    if(d.apellido_paterno||d.apellido_materno||d.nombres)return [d.apellido_paterno,d.apellido_materno,d.nombres].map(str).filter(Boolean).join(' ');
    if(d.nombre_ordenado)return str(d.nombre_ordenado);
    if(d.nombre)return str(d.nombre);
  }
  var groups=snapshot&&snapshot.data&&snapshot.data.GRUPOS||[],bag=tokenBag(raw),matches=[];
  groups.forEach(function(g){if(hasTutor(g.tutor)&&tokenBag(g.tutor)===bag)matches.push(str(g.tutor));});
  matches=Array.from(new Set(matches));if(matches.length===1)return matches[0];
  return heuristicSurnameFirst(raw);
}
function model(snapshot,periodId,plans){
  snapshot=snapshot||{};var data=snapshot.data||{};plans=Array.isArray(plans)?plans:(snapshot.plans||[]);
  var periods=(data.PERIODOS||[]).filter(function(p){return !Object.prototype.hasOwnProperty.call(p,'archivado')||!active(p.archivado);});
  var period=periods.find(function(p){return str(p.id_periodo)===str(periodId);})||periods.find(function(p){return str(p.id_periodo)===str(snapshot.active);})||periods[0]||null;
  var groups=(data.GRUPOS||[]).filter(function(g){return period&&str(g.periodo)===str(period.id_periodo)&&(!Object.prototype.hasOwnProperty.call(g,'activo')||active(g.activo));}).sort(function(a,b){return natural(a.grupo,b.grupo);});
  var buildings=(data.EDIFICIOS||[]).filter(function(b){return !Object.prototype.hasOwnProperty.call(b,'activo')||active(b.activo);}).sort(function(a,b){return natural(buildingLabel(a),buildingLabel(b));});
  function building(value){var k=compact(value);var found=buildings.filter(function(b){return [b.id_edificio,b.nombre,b.nombre_completo].some(function(x){return compact(x)===k;});});return found.length===1?found[0]:null;}
  var rooms=(data.AULAS||[]).filter(function(r){return (!Object.prototype.hasOwnProperty.call(r,'activo')||active(r.activo))&&building(r.edificio);}).sort(function(a,b){return natural(buildingLabel(building(a.edificio)),buildingLabel(building(b.edificio)))||natural(floorRank(a.planta),floorRank(b.planta))||natural(roomLabel(a),roomLabel(b));});
  var assignments=(data.ASIGNACION_AULAS||[]).filter(function(a){return period&&str(a.periodo)===str(period.id_periodo)&&(!Object.prototype.hasOwnProperty.call(a,'activo')||active(a.activo));});
  function roomById(id){var x=rooms.filter(function(r){return str(r.id_aula)===str(id);});return x.length===1?x[0]:null;}
  function groupById(id){var x=groups.filter(function(g){return str(g.id_grupo)===str(id);});return x.length===1?x[0]:null;}
  function placements(g){return assignments.filter(function(a){return str(a.id_grupo)===str(g.id_grupo)||(!a.id_grupo&&norm(a.grupo)===norm(g.grupo));}).map(function(a){var r=roomById(a.id_aula);if(!r&&a.salon){var candidates=rooms.filter(function(x){var b=building(x.edificio);return norm(roomLabel(x))===norm(a.salon)&&(!a.planta||norm(x.planta)===norm(a.planta))&&(!a.edificio||b&&[b.id_edificio,b.nombre,b.nombre_completo].some(function(v){return compact(v)===compact(a.edificio);}));});if(candidates.length===1)r=candidates[0];}var b=r&&building(r.edificio);return r&&b?{assignment:a,room:r,building:b}:null;}).filter(Boolean);}
  function roomLabel(room){return str(room&& (room.nombre||room.salon||room.aula||room.id_aula));}
  function buildingLabel(b){return str(b&&(b.nombre_completo||b.nombre||b.id_edificio));}
  function geometry(room){
    var b=building(room.edificio);if(!b)return null;var floor=norm(room.planta).replace(/^planta /,'');
    var p=plans.find(function(x){return str(x.edificio)===str(b.id_edificio)&&norm(x.planta).replace(/^planta /,'')===floor;});if(!p)return null;
    var id=str(room.id_aula),tail=id.split('-').pop(),label=roomLabel(room),keys=[room.posicion,id,tail,label,slug(label),slug(tail)].filter(Boolean).map(compact);
    var spaces=(p.spaces||[]).filter(function(s){var vals=[s.roomId,s.key,s.label].filter(Boolean).map(compact);return vals.some(function(v){return keys.indexOf(v)>=0;});});
    if(spaces.length===1)return {plan:p,space:spaces[0]};
    var roomSpaces=(p.spaces||[]).filter(function(s){return s.kind==='room';});var lk=compact(label);spaces=roomSpaces.filter(function(s){return compact(s.key)===lk||compact(s.label)===lk;});
    return spaces.length===1?{plan:p,space:spaces[0]}:null;
  }
  return {periods:periods,period:period,groups:groups,buildings:buildings,rooms:rooms,assignments:assignments,plans:plans,building:building,roomById:roomById,groupById:groupById,placements:placements,geometry:geometry,roomLabel:roomLabel,buildingLabel:buildingLabel};
}
root.DIN27={str:str,norm:norm,active:active,esc:esc,natural:natural,compact:compact,slug:slug,floorRank:floorRank,hasTutor:hasTutor,teacherDisplay:teacherDisplay,model:model};
})(window);
