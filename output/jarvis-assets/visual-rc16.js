/* J.A.R.V.I.S. RC16 — safe SVG depth decorators. No data, dimensions or paint values are changed. */
(function(){'use strict';
  var NS='http://www.w3.org/2000/svg', DEFS='jarvisRc16Defs';
  function defsFor(svg){
    if(!svg||svg.querySelector('#'+DEFS)) return;
    var defs=document.createElementNS(NS,'defs'); defs.id=DEFS;
    defs.innerHTML='<filter id="jarvisRc16SoftShadow" x="-30%" y="-30%" width="160%" height="170%"><feDropShadow dx="1.2" dy="2.4" stdDeviation="1.35" flood-color="#000000" flood-opacity=".30"/><feDropShadow dx="-.55" dy="-.7" stdDeviation=".45" flood-color="#ffffff" flood-opacity=".25"/></filter><filter id="jarvisRc16CurveShadow" x="-20%" y="-30%" width="140%" height="170%"><feDropShadow dx="1" dy="2" stdDeviation="1.1" flood-color="#000000" flood-opacity=".34"/><feDropShadow dx="-.45" dy="-.65" stdDeviation=".35" flood-color="#ffffff" flood-opacity=".22"/></filter>';
    svg.insertBefore(defs,svg.firstChild);
  }
  function decorate(root){
    (root||document).querySelectorAll('.calorie-chart-wrap svg,.j22-weight-chart,.flow-chart svg,.jd-ring-svg').forEach(defsFor);
  }
  function start(){
    decorate(document);
    new MutationObserver(function(list){list.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1) decorate(n);});});}).observe(document.documentElement,{childList:true,subtree:true});
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
}());
