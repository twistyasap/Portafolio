/* ==========================================================================
   Matias Moya — Portafolio · Interacciones generales
   ========================================================================== */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return [].slice.call((ctx || document).querySelectorAll(sel)); };
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;

  /* ── Tema ─────────────────────────────────────────────────────────────── */
  function initTheme() {
    var btn = $('#theme-toggle');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('mm-theme-v2', next); } catch (e) { /* sin almacenamiento */ }
    });
  }

  /* ── Título del hero: separa letras para la animación ─────────────────── */
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

  /* ── Ticker: duplica el contenido para un loop continuo ───────────────── */
  function initTicker() {
    var track = $('.ticker__track');
    if (!track) return;
    track.innerHTML += track.innerHTML;
  }

  /* ── Hero: rotador de texto que escribe y borra (estilo terminal) ─────── */
  /* ── Hero: hora local de Santiago en vivo ─────────────────────────────── */
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

  /* ── Experiencia: pestañas accesibles con indicador animado ───────────── */
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
      // Las fuentes cambian el tamaño de las pestañas al cargar
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveIndicator(selected()); });
    });
  }

  /* ── Aparición al hacer scroll ────────────────────────────────────────── */
  function initReveal() {
    var items = $$('.reveal');
    if (!('IntersectionObserver' in window) || reducedMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    // Retraso escalonado entre hermanos
    items.forEach(function (el) {
      var siblings = $$(':scope > .reveal', el.parentElement);
      el.style.setProperty('--d', (siblings.indexOf(el) % 5) * 0.08 + 's');
    });
    // Los títulos usan clip-path para descubrirse, y el observer lo toma en
    // cuenta (nunca serían "visibles"); por eso se observa el eyebrow previo.
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

  /* ── Contadores animados (stats del hero) ─────────────────────────────── */
  /* ── Servicios: un panel abierto a la vez (mouse, foco o toque) ───────── */
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

  /* ── Proceso: la línea avanza según cuánto has bajado en la sección ───── */
  function initProcess() {
    var process = $('#process');
    if (!process) return;
    var steps = $$('.process__step', process);
    var ticking = false;

    function update() {
      ticking = false;
      var r = process.getBoundingClientRect();
      var vh = window.innerHeight;
      // 0 cuando el bloque entra por abajo, 1 cuando su final pasa el 40% de la pantalla
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

  function initCounters() {
    var nums = $$('[data-count]');
    if (reducedMotion || !nums.length) return;
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

  /* ── Scroll: barra de progreso, botón arriba, nav activo ──────────────── */
  function initScroll() {
    var progress = $('#progress');
    var toTop = $('#to-top');
    var sections = $$('main section[id]');
    var links = $$('.nav__links a');
    var ticking = false;

    function update() {
      ticking = false;
      // Primero todas las lecturas de layout, después las escrituras
      // (intercalarlas fuerza un recálculo de layout síncrono)
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

  /* ── Efectos de puntero (solo mouse y sin movimiento reducido) ────────── */
  function initPointerFx() {
    if (!finePointer || reducedMotion) return;

    // Ejecuta fn como máximo una vez por frame con el último evento recibido
    function perFrame(fn) {
      var pending = null, id = 0;
      return function (e) {
        pending = e;
        if (id) return;
        id = requestAnimationFrame(function () { id = 0; fn(pending); });
      };
    }
    // Guarda el rect al entrar (y lo invalida al hacer scroll/resize) para no
    // forzar un layout con getBoundingClientRect en cada mousemove
    var rectCache = new WeakMap();
    function rectOf(el) {
      var r = rectCache.get(el);
      if (!r) { r = el.getBoundingClientRect(); rectCache.set(el, r); }
      return r;
    }
    function clearRects() { rectCache = new WeakMap(); }
    window.addEventListener('scroll', clearRects, { passive: true });
    window.addEventListener('resize', clearRects);

    // Spotlight que sigue al cursor: se mueve con transform (compositor),
    // sin tocar variables CSS en :root (eso recalculaba estilos de toda la página)
    var spot = $('.spotlight');
    if (spot) {
      window.addEventListener('mousemove', perFrame(function (e) {
        spot.style.transform = 'translate3d(' + e.clientX + 'px,' + e.clientY + 'px,0)';
      }), { passive: true });
    }

    // Brillo dentro de tarjetas glass
    $$('.glass').forEach(function (g) {
      g.addEventListener('mousemove', perFrame(function (e) {
        var r = rectOf(g);
        g.style.setProperty('--gx', (e.clientX - r.left) + 'px');
        g.style.setProperty('--gy', (e.clientY - r.top) + 'px');
      }), { passive: true });
    });

    // Inclinación 3D de proyectos
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

    // Botones magnéticos (el rect se toma al entrar: el botón se mueve con
    // transform y medirlo en cada evento lo haría "perseguirse" a sí mismo)
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

  /* ── Pausa las animaciones CSS de las secciones que no están en pantalla ─ */
  function initOffscreenPause() {
    if (!('IntersectionObserver' in window)) return;
    var blocks = $$('main > section, main > .ticker');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { e.target.classList.toggle('is-paused', !e.isIntersecting); });
    }, { rootMargin: '150px 0px' });
    blocks.forEach(function (b) { io.observe(b); });
  }

  /* ── Ripple en botones ────────────────────────────────────────────────── */
  function initRipple() {
    if (reducedMotion) return;
    $$('.btn, .to-top').forEach(function (b) {
      b.addEventListener('click', function (e) {
        var r = b.getBoundingClientRect();
        var s = Math.max(r.width, r.height) / 2;
        var dot = document.createElement('span');
        dot.className = 'ripple';
        dot.style.cssText = 'width:' + s + 'px;height:' + s + 'px;left:' + (e.clientX - r.left - s / 2) + 'px;top:' + (e.clientY - r.top - s / 2) + 'px';
        b.appendChild(dot);
        setTimeout(function () { dot.remove(); }, 600);
      });
    });
  }

  /* ── Formulario de contacto (EmailJS) ─────────────────────────────────── */
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

  /* ── Init ─────────────────────────────────────────────────────────────── */
  function init() {
    var year = $('#year');
    if (year) year.textContent = new Date().getFullYear();

    initTheme();
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
    initRipple();
    initForm();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
