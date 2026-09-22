/* Una visita por carga de página; contador agregado, no visitantes únicos. */
(()=>{
 const target=document.getElementById('visitCount');if(!target)return;
 window.DIN_REMOTE.request({action:'visits',record:'1'}).then(value=>{
  if(!Number.isSafeInteger(value.count)||value.count<0)return;
  target.textContent='Visitas: '+value.count.toLocaleString('es-MX');
  const since=new Date(value.since);target.title='Visitas desde '+(Number.isFinite(since.getTime())?since.toLocaleDateString('es-MX'):'la instalación')+'. No representa personas únicas.';
 }).catch(()=>{target.textContent='Visitas: —';});
})();
