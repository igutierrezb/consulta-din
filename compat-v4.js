(function(){
  try{
    var dialogOk=!!(window.HTMLDialogElement&&HTMLDialogElement.prototype&&HTMLDialogElement.prototype.showModal);
    var elementOk=!!(window.Element&&Element.prototype&&Element.prototype.closest&&Element.prototype.replaceChildren&&document.documentElement.classList);
    var arrayOk=!!(Array.from&&Array.prototype.find);
    var objectOk=!!Object.assign;
    var ok=!!(window.Promise&&window.Map&&window.Set&&window.URL&&window.CustomEvent&&window.fetch&&document.querySelector&&window.JSON&&String.prototype.normalize&&arrayOk&&objectOk&&dialogOk&&elementOk);
    try{ok=ok&&!!(new Function('var x={a:{b:1}};return x?.a?.b===1'))();}catch(e){ok=false;}
    if(!ok&&!/lite-v4\.html$/i.test(location.pathname)){
      var base=location.pathname.replace(/[^\/]*$/,'');location.replace(base+'lite-v4.html'+location.search+location.hash);
    }
  }catch(e){try{location.replace('lite-v4.html'+location.search+location.hash);}catch(ignore){}}
})();
