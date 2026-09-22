/* Una visita por carga de página; contador agregado, no visitantes únicos. */
(()=>{
 const target=document.getElementById('visitCount');if(!target)return;
 window.DIN_REMOTE.request({action:'visits',record:'1'}).then(value=>{
  if(!Number.isSafeInteger(value.count)||value.count<0)return;
  target.textContent='Visitas totales: '+value.count.toLocaleString('es-MX')+' · Visitas del mes: '+(Number.isSafeInteger(value.monthCount)?value.monthCount.toLocaleString('es-MX'):'—');
  const since=new Date(value.since);target.title='Visitas desde '+(Number.isFinite(since.getTime())?since.toLocaleDateString('es-MX'):'la instalación')+'. Mes natural de Ciudad de México; registro mensual desde '+(value.monthSince?new Date(value.monthSince).toLocaleDateString('es-MX'):'su activación')+'. No representa personas únicas.';
 }).catch(()=>{target.textContent='Visitas totales: — · Visitas del mes: —';});
})();
