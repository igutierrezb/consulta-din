(function(root){
  'use strict';
  function str(v){return String(v==null?'':v).trim();}
  function norm(v){return str(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ');}
  function active(v){return v===true||['true','verdadero','1','si','sí'].indexOf(norm(v))>=0;}
  function esc(v){return str(v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function natural(a,b){return str(a).localeCompare(str(b),'es',{numeric:true,sensitivity:'base'});}
  function floorKey(v){var x=norm(v).replace(/^planta /,'');if(x==='baja')return '00';if(x==='alta')return '01';return '02-'+x;}
  function hasTutor(v){var x=norm(v);return !!x&&['sin tutor','sin tutora','sin asignar','no asignado','no asignada','pendiente','pendiente de asignacion','pendiente de captura','fusion','n/a','na','ninguno','ninguna','0','-','—'].indexOf(x)<0;}
  function model(snapshot,periodId){
    var data=snapshot&&snapshot.data||{},plans=snapshot&&snapshot.plans||[];
    var periods=(data.PERIODOS||[]).filter(function(p){return active(p.activo)&&!active(p.archivado);});
    var period=periods.find(function(p){return str(p.id_periodo)===str(periodId);})||periods[0]||null;
    var groups=(data.GRUPOS||[]).filter(function(g){return period&&str(g.periodo)===str(period.id_periodo)&&(!Object.prototype.hasOwnProperty.call(g,'activo')||active(g.activo));}).sort(function(a,b){return natural(a.grupo,b.grupo);});
    var buildings=(data.EDIFICIOS||[]).filter(function(b){return !Object.prototype.hasOwnProperty.call(b,'activo')||active(b.activo);}).sort(function(a,b){return natural(buildingLabel(a),buildingLabel(b));});
    function building(value){var k=norm(value),m=buildings.filter(function(b){return [b.id_edificio,b.nombre,b.nombre_completo].some(function(x){return norm(x)===k;});});return m.length===1?m[0]:null;}
    var rooms=(data.AULAS||[]).filter(function(r){return (!Object.prototype.hasOwnProperty.call(r,'activo')||active(r.activo))&&building(r.edificio);}).sort(function(a,b){return natural(buildingLabel(building(a.edificio)),buildingLabel(building(b.edificio)))||natural(floorKey(a.planta),floorKey(b.planta))||natural(roomLabel(a),roomLabel(b));});
    var assignments=(data.ASIGNACION_AULAS||[]).filter(function(a){return period&&str(a.periodo)===str(period.id_periodo)&&(!Object.prototype.hasOwnProperty.call(a,'activo')||active(a.activo));});
    function roomById(id){var m=rooms.filter(function(r){return str(r.id_aula)===str(id);});return m.length===1?m[0]:null;}
    function groupById(id){var m=groups.filter(function(g){return str(g.id_grupo)===str(id);});return m.length===1?m[0]:null;}
    function placements(g){return assignments.filter(function(a){return str(a.id_grupo)===str(g.id_grupo);}).map(function(a){var r=roomById(a.id_aula),b=r&&building(r.edificio);return r&&b?{assignment:a,room:r,building:b}:null;}).filter(Boolean);}
    function geometry(room){var b=building(room.edificio);if(!b)return null;var f=norm(room.planta).replace(/^planta /,'');var p=plans.find(function(x){return str(x.edificio)===str(b.id_edificio)&&norm(x.planta).replace(/^planta /,'')===f;});if(!p)return null;var key=str(room.posicion);var space=(p.spaces||[]).find(function(s){return str(s.roomId)===str(room.id_aula)||str(s.key)===key;});return space?{plan:p,space:space}:null;}
    function roomLabel(room){return str(room.nombre||room.salon||room.aula||room.id_aula);}
    function buildingLabel(b){return str(b&&(b.nombre_completo||b.nombre||b.id_edificio));}
    return {periods:periods,period:period,groups:groups,buildings:buildings,rooms:rooms,assignments:assignments,plans:plans,building:building,roomById:roomById,groupById:groupById,placements:placements,geometry:geometry,roomLabel:roomLabel,buildingLabel:buildingLabel};
  }
  root.DIN4={str:str,norm:norm,active:active,esc:esc,natural:natural,hasTutor:hasTutor,model:model};
})(window);
