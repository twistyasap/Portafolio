/* ==========================================================================
   Matias Moya — Portafolio · Interacciones
   Dirección de arte: Black Clover · grimorios, círculos mágicos y maná
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return [].slice.call((ctx || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  var GRIMOIRES = ['cinco', 'cuatro', 'tres'];
  var THEME_COLOR = { cinco: '#080807', cuatro: '#0D0404', tres: '#F6EFE0' };

  /* ── Selector de grimorio: 五 cinco · 四 cuatro · 三 tres hojas ─────────── */
  function initGrimoireSwitch() {
    var box = $('#grim-switch');
    if (!box) return;
    var btns = $$('.grim-switch__btn', box);
    var mark = $('.grim-switch__mark', box);
    var cast = $('#spellcast');
    var heroTag = $('.hero__grim');
    var meta = $('meta[name="theme-color"]');
    var castTimer = 0;

    function checked() { return btns.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; })[0] || btns[0]; }

    function moveMark(btn) {
      if (!mark) return;
      mark.style.transform = 'translateX(' + (btn.offsetLeft - mark.offsetLeft) + 'px)';
    }

    /* Conjuro a pantalla completa: página que se da vuelta + círculo mágico */
    function spellcast() {
      if (!cast || reducedMotion) return;
      cast.classList.remove('is-on');
      void cast.offsetWidth;
      cast.classList.add('is-on');
      clearTimeout(castTimer);
      castTimer = setTimeout(function () { cast.classList.remove('is-on'); }, 1400);
    }

    function replayTag() {
      if (!heroTag || reducedMotion) return;
      heroTag.style.animation = 'none';
      void heroTag.offsetWidth;
      heroTag.style.animation = '';
    }

    function apply(name, btn, announce) {
      root.setAttribute('data-grimoire', name);
      try { localStorage.setItem('mm-grimoire', name); } catch (e) { /* sin almacenamiento */ }
      if (meta && THEME_COLOR[name]) meta.setAttribute('content', THEME_COLOR[name]);
      btns.forEach(function (b) {
        var on = b === btn;
        b.setAttribute('aria-checked', on ? 'true' : 'false');
        b.tabIndex = on ? 0 : -1;
      });
      moveMark(btn);
      if (announce) {
        spellcast();
        replayTag();
        document.dispatchEvent(new CustomEvent('grimoirechange', { detail: { grimoire: name } }));
      }
    }

    btns.forEach(function (btn, idx) {
      btn.addEventListener('click', function () {
        if (btn.getAttribute('aria-checked') === 'true') return;
        apply(btn.getAttribute('data-grimoire'), btn, true);
      });
      btn.addEventListener('keydown', function (e) {
        var next = null;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = btns[(idx + 1) % btns.length];
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = btns[(idx - 1 + btns.length) % btns.length];
        if (!next) return;
        e.preventDefault();
        apply(next.getAttribute('data-grimoire'), next, true);
        next.focus();
      });
    });

    /* Sincroniza con lo que dejó theme-init.js */
    var current = root.getAttribute('data-grimoire');
    if (GRIMOIRES.indexOf(current) === -1) current = 'cinco';
    var active = btns.filter(function (b) { return b.getAttribute('data-grimoire') === current; })[0] || btns[0];
    apply(current, active, false);

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveMark(checked()); });
    window.addEventListener('resize', function () { moveMark(checked()); });
  }

  /* ── Grimorio interactivo (sección Perfil) ─────────────────────────────── */
  function initGrimoire() {
    var g = $('#grimoire');
    if (!g) return;
    var cover = $('#grimoire-open', g);
    var closeBtn = $('#grimoire-close', g);
    var tabs = $$('.grimoire__chapter', g);
    var spells = $$('.spell', g);
    var flip = $('.grimoire__flip', g);
    var front = $('.grimoire__flip-front', g);
    var folio = $('#grimoire-folio', g);
    var rightPage = $('.grimoire__page--right', g);
    var narrow = window.matchMedia('(max-width: 760px)');
    var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    var current = 0, busy = false, openTimer = 0;

    if (!cover || !tabs.length || !spells.length) return;

    // Índice de cada conjuro para escalonar su aparición
    spells.forEach(function (s) {
      $$('.spell__list li', s).forEach(function (li, i) { li.style.setProperty('--li', i); });
    });

    /* La afinidad sube de 0 al valor final, como maná que se carga */
    function countUp(spell) {
      var el = $('[data-meter]', spell);
      if (!el) return;
      var end = +el.getAttribute('data-meter');
      if (reducedMotion) { el.textContent = end; return; }
      var t0 = performance.now(), delay = 350, dur = 1100;
      el.textContent = '0';
      (function tick(now) {
        var p = Math.min(1, Math.max(0, (now - t0 - delay) / dur));
        el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    }

    function show(i, animate) {
      spells.forEach(function (s, k) {
        var on = k === i;
        s.hidden = !on;
        s.classList.remove('is-entering');
        if (on && animate && !reducedMotion) {
          void s.offsetWidth;
          s.classList.add('is-entering');
          countUp(s);
        }
      });
      tabs.forEach(function (t, k) {
        var on = k === i;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
      });
      if (folio) folio.textContent = ROMAN[i] + ' / ' + ROMAN[spells.length - 1];
      current = i;
    }

    /* Copia estática de un hechizo para pintarla en la hoja que gira */
    function paint(spell) {
      if (!front) return;
      front.textContent = '';
      var clone = spell.cloneNode(true);
      clone.removeAttribute('id');
      clone.removeAttribute('role');
      clone.removeAttribute('tabindex');
      clone.removeAttribute('aria-labelledby');
      clone.hidden = false;
      clone.classList.remove('is-entering');
      clone.setAttribute('aria-hidden', 'true');
      front.appendChild(clone);
    }

    function go(i, focusTab) {
      var n = spells.length;
      i = (i + n) % n;
      if (i === current || busy) return;
      var forward = i > current;
      if (focusTab) tabs[i].focus({ preventScroll: true });

      if (reducedMotion || narrow.matches || !flip) { show(i, true); return; }

      busy = true;
      flip.classList.remove('is-next', 'is-prev');
      void flip.offsetWidth;

      if (forward) {
        // La hoja lleva el hechizo viejo y se levanta: debajo ya está el nuevo
        paint(spells[current]);
        show(i, true);
        flip.classList.add('is-next');
      } else {
        // La hoja vuelve desde la izquierda trayendo el hechizo anterior
        paint(spells[i]);
        flip.classList.add('is-prev');
      }
      setTimeout(function () {
        if (!forward) show(i, false);
        flip.classList.remove('is-next', 'is-prev');
        if (front) front.textContent = '';
        busy = false;
      }, 720);
    }

    function open() {
      if (g.classList.contains('is-open')) return;
      g.classList.add('is-open');
      cover.setAttribute('aria-expanded', 'true');
      if (!reducedMotion) {
        g.classList.remove('is-opening');
        void g.offsetWidth;
        g.classList.add('is-opening');
        clearTimeout(openTimer);
        openTimer = setTimeout(function () { g.classList.remove('is-opening'); }, 1900);
      }
      setTimeout(function () {
        show(current, true);
        tabs[current].focus({ preventScroll: true });
      }, reducedMotion ? 0 : 520);
    }

    function close() {
      g.classList.remove('is-open', 'is-opening');
      cover.setAttribute('aria-expanded', 'false');
      cover.focus({ preventScroll: true });
    }

    cover.addEventListener('click', open);
    if (closeBtn) closeBtn.addEventListener('click', close);

    tabs.forEach(function (t, k) {
      t.addEventListener('click', function () { go(k, false); });
    });
    $$('.grimoire__arrow', g).forEach(function (a) {
      a.addEventListener('click', function () { go(current + (+a.getAttribute('data-dir')), false); });
    });

    // Teclado: flechas pasan de página, Escape cierra
    g.addEventListener('keydown', function (e) {
      if (!g.classList.contains('is-open')) return;
      var onTab = tabs.indexOf(document.activeElement) > -1;
      if (e.key === 'ArrowRight' || (onTab && e.key === 'ArrowDown')) { e.preventDefault(); go(current + 1, onTab); }
      else if (e.key === 'ArrowLeft' || (onTab && e.key === 'ArrowUp')) { e.preventDefault(); go(current - 1, onTab); }
      else if (onTab && e.key === 'Home') { e.preventDefault(); go(0, true); }
      else if (onTab && e.key === 'End') { e.preventDefault(); go(spells.length - 1, true); }
      else if (e.key === 'Escape') { close(); }
    });

    // Táctil: deslizar sobre la página derecha
    if (rightPage) {
      var sx = 0, sy = 0;
      rightPage.addEventListener('touchstart', function (e) {
        sx = e.touches[0].clientX; sy = e.touches[0].clientY;
      }, { passive: true });
      rightPage.addEventListener('touchend', function (e) {
        var dx = e.changedTouches[0].clientX - sx, dy = e.changedTouches[0].clientY - sy;
        if (Math.abs(dx) > 44 && Math.abs(dx) > Math.abs(dy) * 1.4) go(current + (dx < 0 ? 1 : -1), false);
      }, { passive: true });
    }

    show(0, false);
  }

  /* ── Título del hero: separa letras para la invocación ─────────────────── */
  function splitHeroTitle() {
    var title = $('[data-split]');
    if (!title) return;
    title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
    var i = 0;
    $$('.hero__line', title).forEach(function (line) {
      var text = line.textContent.trim();
      line.textContent = '';
      line.setAttribute('aria-hidden', 'true');
      text.split('').forEach(function (ch) {
        var span = document.createElement('span');
        span.className = 'ch';
        span.style.setProperty('--i', i++);
        span.textContent = ch;
        line.appendChild(span);
      });
    });
  }

  /* ── Ticker: duplica el contenido para un loop continuo ────────────────── */
  function initTicker() {
    var track = $('.ticker__track');
    if (!track) return;
    track.innerHTML += track.innerHTML;
  }

  /* ── Hero: hora local de Santiago en vivo ──────────────────────────────── */
  function initClock() {
    var el = $('#local-time');
    if (!el || !window.Intl) return;
    var fmt = new Intl.DateTimeFormat('es-CL', {
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'America/Santiago'
    });
    function tick() {
      var now = new Date();
      el.textContent = fmt.format(now) + ' CLT';
      el.setAttribute('datetime', now.toISOString());
    }
    tick();
    setInterval(tick, 1000);
  }

  /* ── Hero: rotador de texto que escribe y borra ────────────────────────── */
  function initRoleRotator() {
    var el = $('#role-rotator');
    if (!el || reducedMotion) return;
    var words = el.getAttribute('data-words').split('|');
    var w = 0;
    var i = words[0].length;
    var deleting = true;

    function tick() {
      if (deleting) {
        i--;
        el.textContent = words[w].slice(0, i);
        if (i <= 0) { deleting = false; w = (w + 1) % words.length; }
        return setTimeout(tick, 40);
      }
      i++;
      el.textContent = words[w].slice(0, i);
      if (i >= words[w].length) { deleting = true; return setTimeout(tick, 2200); }
      setTimeout(tick, 75);
    }
    setTimeout(tick, 2600);
  }

  /* ── Experiencia: pestañas accesibles con indicador animado ────────────── */
  function initTabs() {
    $$('[data-tabs]').forEach(function (box) {
      var list = $('[role="tablist"]', box);
      var tabs = $$('[role="tab"]', box);
      if (!list || !tabs.length) return;

      var indicator = document.createElement('span');
      indicator.className = 'xp__indicator';
      indicator.setAttribute('aria-hidden', 'true');
      list.appendChild(indicator);

      function isRow() { return getComputedStyle(list).flexDirection === 'row'; }
      function selected() { return tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0]; }

      function moveIndicator(tab) {
        if (isRow()) {
          indicator.style.cssText = 'left:' + tab.offsetLeft + 'px;width:' + tab.offsetWidth + 'px';
        } else {
          indicator.style.cssText = 'top:' + tab.offsetTop + 'px;height:' + tab.offsetHeight + 'px';
        }
      }

      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls'));
          if (!panel) return;
          panel.hidden = !on;
          if (on) {
            panel.classList.remove('is-entering');
            void panel.offsetWidth; // reinicia la animación de entrada
            panel.classList.add('is-entering');
          }
        });
        moveIndicator(tab);
        if (focus) tab.focus();
        if (isRow()) list.scrollTo({ left: tab.offsetLeft - 16, behavior: reducedMotion ? 'auto' : 'smooth' });
      }

      tabs.forEach(function (tab, idx) {
        tab.addEventListener('click', function () { select(tab, false); });
        tab.addEventListener('keydown', function (e) {
          var next = null;
          if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length];
          if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length];
          if (e.key === 'Home') next = tabs[0];
          if (e.key === 'End') next = tabs[tabs.length - 1];
          if (next) { e.preventDefault(); select(next, true); }
        });
      });

      moveIndicator(selected());
      var rz = 0;
      window.addEventListener('resize', function () {
        if (rz) return;
        rz = requestAnimationFrame(function () { rz = 0; moveIndicator(selected()); });
      });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveIndicator(selected()); });
    });
  }

  /* ── Aparición al hacer scroll ─────────────────────────────────────────── */
  function initReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window) || reducedMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    items.forEach(function (el) {
      var siblings = $$(':scope > .reveal', el.parentElement);
      el.style.setProperty('--d', (siblings.indexOf(el) % 5) * 0.08 + 's');
    });
    // Los títulos se revelan con clip-path: nunca serían "visibles" para el
    // observer, así que se observa el eyebrow previo.
    var proxies = new Map();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        (proxies.get(e.target) || []).forEach(function (el) { el.classList.add('is-in'); });
        io.unobserve(e.target);
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) {
      var proxy = el.matches('.section-title') && el.previousElementSibling;
      if (proxy) {
        proxies.set(proxy, (proxies.get(proxy) || []).concat(el));
        io.observe(proxy);
      } else {
        io.observe(el);
      }
    });
  }

  /* ── Contadores animados (stats del hero) ──────────────────────────────── */
  function initCounters() {
    var nums = $$('[data-count]');
    if (reducedMotion || !nums.length || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        var el = e.target;
        var end = +el.getAttribute('data-count');
        var pad = +el.getAttribute('data-pad') || 0;
        var from = end > 1000 ? end - 30 : 0;
        var t0 = performance.now(), dur = 1400;
        (function tick(now) {
          var p = Math.min(1, (now - t0) / dur);
          var v = Math.round(from + (end - from) * (1 - Math.pow(1 - p, 3)));
          el.textContent = pad ? String(v).padStart(pad, '0') : v;
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ── Hechizos: un panel abierto a la vez (mouse, foco o toque) ─────────── */
  function initServices() {
    var items = $$('.service');
    if (!items.length) return;
    function open(item) {
      items.forEach(function (s) { s.classList.toggle('is-open', s === item); });
    }
    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () { open(item); });
      item.addEventListener('focus', function () { open(item); });
      item.addEventListener('click', function () { open(item); });
    });
    open(items[0]);
  }

  /* ── Proceso: la línea de maná avanza con el scroll ────────────────────── */
  function initProcess() {
    var process = $('#process');
    if (!process) return;
    var steps = $$('.process__step', process);
    var ticking = false;

    function update() {
      ticking = false;
      var r = process.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.85 - r.top) / (r.height + vh * 0.45);
      p = Math.max(0, Math.min(1, p));
      process.style.setProperty('--progress', p.toFixed(3));
      steps.forEach(function (s, i) {
        s.classList.toggle('is-active', p >= i / steps.length + 0.02);
      });
    }

    if (reducedMotion) {
      process.style.setProperty('--progress', '1');
      steps.forEach(function (s) { s.classList.add('is-active'); });
      return;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  /* ── Scroll: medidor de maná, botón arriba, nav activo ─────────────────── */
  function initScroll() {
    var progress = $('#progress');
    var toTop = $('#to-top');
    var sections = $$('main section[id]');
    var links = $$('.nav__links a');
    var ticking = false;

    function update() {
      ticking = false;
      var vh = window.innerHeight;
      var max = root.scrollHeight - vh;
      var y = window.scrollY;
      var current = '';
      sections.forEach(function (s) {
        if (s.getBoundingClientRect().top < vh * 0.5) current = s.id;
      });

      if (progress) progress.style.transform = 'scaleX(' + (max > 0 ? y / max : 0) + ')';
      if (toTop) toTop.classList.toggle('is-visible', y > 500);
      links.forEach(function (a) {
        var active = a.getAttribute('href') === '#' + current;
        a.classList.toggle('is-active', active);
        if (active) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    }

    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();

    if (toTop) toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reducedMotion ? 'auto' : 'smooth' });
    });
  }

  /* ── Efectos de puntero (solo mouse y sin movimiento reducido) ─────────── */
  function initPointerFx() {
    if (!finePointer || reducedMotion) return;

    function perFrame(fn) {
      var pending = null, id = 0;
      return function (e) {
        pending = e;
        if (id) return;
        id = requestAnimationFrame(function () { id = 0; fn(pending); });
      };
    }
    var rectCache = new WeakMap();
    function rectOf(el) {
      var r = rectCache.get(el);
      if (!r) { r = el.getBoundingClientRect(); rectCache.set(el, r); }
      return r;
    }
    function clearRects() { rectCache = new WeakMap(); }
    window.addEventListener('scroll', clearRects, { passive: true });
    window.addEventListener('resize', clearRects);

    // Aura de maná que sigue al cursor
    var aura = $('.aura');
    if (aura) {
      window.addEventListener('mousemove', perFrame(function (e) {
        aura.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
      }), { passive: true });
    }

    // Brillo dentro de las tarjetas
    $$('.glass').forEach(function (g) {
      g.addEventListener('mousemove', perFrame(function (e) {
        var r = rectOf(g);
        g.style.setProperty('--gx', (e.clientX - r.left) + 'px');
        g.style.setProperty('--gy', (e.clientY - r.top) + 'px');
      }), { passive: true });
    });

    // Inclinación 3D de los proyectos
    $$('[data-tilt]').forEach(function (card) {
      var leaving = false;
      card.addEventListener('mouseenter', function () { leaving = false; rectCache.delete(card); });
      card.addEventListener('mousemove', perFrame(function (e) {
        if (leaving) return;
        var r = rectOf(card);
        var x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        card.style.transform = 'rotateY(' + (x - 0.5) * 10 + 'deg) rotateX(' + (0.5 - y) * 8 + 'deg) translateY(-6px)';
        card.style.setProperty('--gx', x * 100 + '%');
        card.style.setProperty('--gy', y * 100 + '%');
      }), { passive: true });
      card.addEventListener('mouseleave', function () { leaving = true; card.style.transform = ''; });
    });

    // Inclinación del editor
    var editor = $('#editor');
    if (editor) {
      var wrap = editor.parentElement;
      var edLeaving = false;
      wrap.addEventListener('mouseenter', function () { edLeaving = false; rectCache.delete(editor); });
      wrap.addEventListener('mousemove', perFrame(function (e) {
        if (edLeaving) return;
        var r = rectOf(editor);
        var x = (e.clientX - r.left) / r.width - 0.5, y = 0.5 - (e.clientY - r.top) / r.height;
        editor.style.transform = 'perspective(900px) rotateY(' + x * 6 + 'deg) rotateX(' + y * 4 + 'deg)';
      }), { passive: true });
      wrap.addEventListener('mouseleave', function () { edLeaving = true; editor.style.transform = ''; });
    }

    // Botones magnéticos
    $$('[data-magnetic]').forEach(function (b) {
      var r = null;
      b.addEventListener('mouseenter', function () { b.style.transform = ''; r = b.getBoundingClientRect(); });
      b.addEventListener('mousemove', perFrame(function (e) {
        if (!r) return;
        b.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * 0.25 + 'px,' + (e.clientY - r.top - r.height / 2) * 0.35 + 'px)';
      }), { passive: true });
      b.addEventListener('mouseleave', function () { r = null; b.style.transform = ''; });
    });
  }

  /* ── Pausa las animaciones CSS de las secciones fuera de pantalla ──────── */
  function initOffscreenPause() {
    if (!('IntersectionObserver' in window)) return;
    var blocks = $$('main > section, main > .ticker');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-paused', !e.isIntersecting); });
    }, { rootMargin: '150px 0px' });
    blocks.forEach(function (b) { io.observe(b); });
  }

  /* ── Destello de maná al pulsar ────────────────────────────────────────── */
  function initBurst() {
    if (reducedMotion) return;
    $$('.btn, .to-top, .icon-btn, .grim-switch__btn, .grimoire__arrow').forEach(function (b) {
      b.addEventListener('click', function (e) {
        var r = b.getBoundingClientRect();
        var s = Math.max(r.width, r.height) / 2;
        var dot = document.createElement('span');
        dot.className = 'burst';
        dot.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' +
          (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
        b.appendChild(dot);
        setTimeout(function () { dot.remove(); }, 640);
      });
    });
  }

  /* ── Formulario de contacto (EmailJS) ──────────────────────────────────── */
  var EMAILJS = {
    publicKey: '0277TApkwNr7f0AMh',
    serviceId: 'service_3zmax82',
    templateId: 'template_vqgcofc'
  };

  function initForm() {
    var form = $('#contact-form');
    if (!form) return;
    var btn = $('#form-submit');
    var label = $('span', btn);
    var feedback = $('#form-feedback');

    if (window.emailjs) window.emailjs.init({ publicKey: EMAILJS.publicKey });

    function show(type, msg) {
      feedback.hidden = false;
      feedback.className = 'form__feedback ' + (type === 'ok' ? 'is-ok' : 'is-err');
      feedback.textContent = msg;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (!form.checkValidity()) {
        show('err', 'Completa tu nombre y el mensaje antes de enviar.');
        var invalid = $(':invalid', form);
        if (invalid) invalid.focus();
        return;
      }
      if (!window.emailjs) {
        show('err', 'No se pudo cargar el servicio de correo. Escríbeme por WhatsApp.');
        return;
      }

      btn.disabled = true;
      label.textContent = 'Enviando...';
      feedback.hidden = true;

      var data = new FormData(form);
      window.emailjs.send(EMAILJS.serviceId, EMAILJS.templateId, {
        nombre: String(data.get('nombre') || '').trim(),
        whatsapp: String(data.get('whatsapp') || '').trim(),
        asunto: String(data.get('asunto') || '').trim(),
        mensaje: String(data.get('mensaje') || '').trim()
      }).then(function () {
        show('ok', '✓ Mensaje enviado. Te respondo pronto.');
        form.reset();
        label.textContent = '✓ Enviado';
      }).catch(function () {
        show('err', '✗ Error al enviar. Escríbeme directo por WhatsApp.');
        btn.disabled = false;
        label.textContent = 'Enviar mensaje';
      });
    });
  }

  /* ── 404: muestra la ruta que no existe ────────────────────────────────── */
  function initNotFound() {
    var el = $('#nf-path');
    if (!el) return;
    var path = location.pathname + location.search;
    try { path = decodeURI(path); } catch (e) { /* URL mal codificada: se muestra tal cual */ }
    el.textContent = path;
    el.title = path;
  }

  /* ── Init ──────────────────────────────────────────────────────────────── */
  function init() {
    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    initGrimoireSwitch();
    initGrimoire();
    splitHeroTitle();
    initTicker();
    initRoleRotator();
    initClock();
    initTabs();
    initReveal();
    initCounters();
    initServices();
    initProcess();
    initScroll();
    initPointerFx();
    initOffscreenPause();
    initBurst();
    initForm();
    initNotFound();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
