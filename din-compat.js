(function(){'use strict';
if(!String.prototype.normalize){String.prototype.normalize=function(){return String(this);};}
if(!Element.prototype.closest){Element.prototype.closest=function(s){var e=this;while(e&&e.nodeType===1){if(e.matches(s))return e;e=e.parentElement;}return null;};}
if(!window.Promise){document.documentElement.className+=' legacy-no-promise';}
})();
