/* ==========================================================================
   Efecto "escribiendo en el editor" al hacer scroll.

   - [data-type]        → el texto se escribe carácter a carácter con un cursor.
   - [data-type="code"] → igual, pero resalta la línea actual (.ln) como VS Code.
   - [data-type-tags]   → sus .tag aparecen una a una, como autocompletado.

   Se repite cada vez: cuando un bloque sale por completo de la pantalla se
   "borra", y al volver a entrar se escribe de nuevo.

   El texto nunca se quita del DOM: lo que falta por escribir queda en un span
   transparente (.tw-rest). Así no hay saltos de layout y los lectores de
   pantalla leen el contenido completo.
   ========================================================================== */
(function () {
  'use strict';

  var GROUP = '.project, .stack-card, .editor, .bento__item';
  var ABORT = {};

  function textNodes(root) {
    var out = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        return /\S/.test(n.data) || n.parentNode.closest('.ln') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) out.push(walker.currentNode);
    return out;
  }

  /* Divide cada nodo de texto en [escrito][resto transparente] */
  function prepare(el) {
    return textNodes(el).map(function (node) {
      var full = node.data;
      var typed = document.createTextNode('');
      var rest = document.createElement('span');
      rest.className = 'tw-rest';
      rest.textContent = full;
      node.parentNode.replaceChild(rest, node);
      rest.parentNode.insertBefore(typed, rest);
      return { full: full, typed: typed, rest: rest };
    });
  }

  function wait(ms, alive) {
    return new Promise(function (resolve, reject) {
      setTimeout(function () { alive() ? resolve() : reject(ABORT); }, ms);
    });
  }

  function typeElement(el, caret, alive) {
    var isCode = el.getAttribute('data-type') === 'code';
    var parts = el._twParts;
    var total = parts.reduce(function (n, p) { return n + p.full.length; }, 0);
    // Velocidad: el código se escribe más lento; los párrafos largos, más rápido
    var perChar = isCode ? 20 : Math.max(8, Math.min(45, 1100 / Math.max(total, 1)));

    return parts.reduce(function (chain, part) {
      return chain.then(function () {
        part.rest.parentNode.insertBefore(caret, part.rest);
        if (isCode) {
          var line = part.rest.closest('.ln');
          el.querySelectorAll('.ln.is-current').forEach(function (l) { if (l !== line) l.classList.remove('is-current'); });
          if (line) line.classList.add('is-current');
        }
        return new Promise(function (resolve, reject) {
          var i = 0, last = performance.now(), acc = 0;
          function step(now) {
            if (!alive()) return reject(ABORT);
            acc += now - last; last = now;
            var n = Math.floor(acc / perChar);
            if (n > 0) {
              acc -= n * perChar;
              i = Math.min(part.full.length, i + n);
              part.typed.data = part.full.slice(0, i);
              part.rest.textContent = part.full.slice(i);
            }
            if (i < part.full.length) requestAnimationFrame(step);
            else resolve();
          }
          if (!part.full.length) resolve(); else requestAnimationFrame(step);
        });
      });
    }, Promise.resolve()).then(function () {
      if (isCode) return wait(300, alive).then(function () {
        el.querySelectorAll('.ln.is-current').forEach(function (l) { l.classList.remove('is-current'); });
      });
    });
  }

  function revealTags(box, alive) {
    var tags = [].slice.call(box.querySelectorAll('.tag'));
    return tags.reduce(function (chain, tag) {
      return chain.then(function () { tag.classList.add('is-typed'); return wait(60, alive); });
    }, Promise.resolve());
  }

  /* Deja el bloque "sin escribir" para la próxima vez que entre en pantalla */
  function reset(group) {
    group._twRun = (group._twRun || 0) + 1;
    group._twState = 'idle';
    if (group._twCaret) group._twCaret.remove();
    group._twItems.forEach(function (item) {
      if (item.hasAttribute('data-type-tags')) {
        item.querySelectorAll('.tag').forEach(function (t) { t.classList.remove('is-typed'); });
      } else {
        item._twParts.forEach(function (p) { p.typed.data = ''; p.rest.textContent = p.full; });
        item.querySelectorAll('.ln.is-current').forEach(function (l) { l.classList.remove('is-current'); });
      }
    });
  }

  function runGroup(group) {
    var token = group._twRun = (group._twRun || 0) + 1;
    var alive = function () { return group._twRun === token; };
    group._twState = 'running';

    var caret = group._twCaret || (group._twCaret = document.createElement('span'));
    caret.className = 'tw-caret';
    caret.setAttribute('aria-hidden', 'true');

    var items = group._twItems;
    items.reduce(function (chain, item) {
      return chain.then(function () {
        return item.hasAttribute('data-type-tags') ? revealTags(item, alive) : typeElement(item, caret, alive);
      });
    }, wait(200, alive)).then(function () {
      group._twState = 'done';
      // El cursor queda parpadeando al final del último texto escrito
      var lastTyped = items.filter(function (n) { return n.hasAttribute('data-type'); }).pop();
      if (lastTyped) {
        var lines = lastTyped.querySelectorAll('.ln');
        (lines.length ? lines[lines.length - 1] : lastTyped).appendChild(caret);
      }
      return wait(2400, alive).then(function () { caret.remove(); });
    }).catch(function (err) {
      if (err !== ABORT) throw err;
    });
  }

  function init() {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-type-tags] .tag').forEach(function (t) { t.classList.add('is-typed'); });
      return;
    }

    var groups = [];
    document.querySelectorAll('[data-type], [data-type-tags]').forEach(function (el) {
      if (el.hasAttribute('data-type')) el._twParts = prepare(el);
      var g = el.closest(GROUP) || el;
      if (groups.indexOf(g) === -1) { groups.push(g); g._twItems = []; g._twState = 'idle'; }
      g._twItems.push(el);
    });

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var g = e.target;
        if (e.intersectionRatio >= 0.35 && g._twState === 'idle') runGroup(g);
        else if (!e.isIntersecting && g._twState !== 'idle') reset(g);
      });
    }, { threshold: [0, 0.35] });

    groups.forEach(function (g) { io.observe(g); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
