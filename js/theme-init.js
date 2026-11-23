/* Se ejecuta en <head> antes del primer pintado: aplica el grimorio guardado
   (五 cinco hojas · 四 cuatro hojas · 三 tres hojas) y marca que JS está
   activo (los estilos de animación dependen de .js). */
(function () {
  var root = document.documentElement;
  var GRIMOIRES = ['cinco', 'cuatro', 'tres'];
  root.classList.add('js');
  try {
    // Limpia preferencias de diseños anteriores que ya no existen
    ['mm-faction', 'mm-theme-v2', 'mm-curse', 'mm-tech'].forEach(function (k) { localStorage.removeItem(k); });
    var saved = localStorage.getItem('mm-grimoire');
    root.setAttribute('data-grimoire', GRIMOIRES.indexOf(saved) > -1 ? saved : 'cinco');
  } catch (e) { /* almacenamiento no disponible */ }
})();
