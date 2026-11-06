/* Se ejecuta en <head> antes del primer pintado: aplica el tema guardado
   y marca que JS está activo (los estilos de animación dependen de .js). */
(function () {
  var root = document.documentElement;
  root.classList.add('js');
  try {
    // El tema claro es el principal. Solo se cambia si el visitante eligió
    // el oscuro con el botón. (Clave v2: se ignora lo guardado con la paleta anterior.)
    var saved = localStorage.getItem('mm-theme-v2');
    root.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
  } catch (e) { /* almacenamiento no disponible */ }
})();
