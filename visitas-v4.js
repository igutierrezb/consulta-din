/* Contador agregado no crítico: se difiere para no competir con la consulta académica. */
(function(){
  'use strict';
  var target=document.getElementById('visitCount');
  if(!target||!window.DIN_CONFIG||!window.DIN_CONFIG.endpoint||!window.fetch)return;
  var delay=8000+Math.floor(Math.random()*52000); // distribuye picos entre 8 y 60 s
  setTimeout(function(){
    try{
      var url=new URL(window.DIN_CONFIG.endpoint);
      url.searchParams.set('action','visits');url.searchParams.set('record','1');
      var controller=window.AbortController?new AbortController():null;
      var timer=controller?setTimeout(function(){controller.abort();},8000):null;
      fetch(url.href,{method:'GET',mode:'cors',credentials:'omit',cache:'no-store',signal:controller?controller.signal:void 0})
        .then(function(r){if(!r.ok)throw Error('contador');return r.json();})
        .then(function(v){
          if(typeof v.count!=='number')return;
          target.textContent='Visitas totales: '+v.count.toLocaleString('es-MX')+' · Mes: '+(typeof v.monthCount==='number'?v.monthCount.toLocaleString('es-MX'):'—');
        }).catch(function(){target.textContent='Visitas: —';})
        .then(function(){if(timer)clearTimeout(timer);});
    }catch(e){target.textContent='Visitas: —';}
  },delay);
})();
