/* ==========================================================================
   Maná — fondo animado en <canvas>.

   Una sola máquina de partículas que cambia de comportamiento según el
   grimorio activo (atributo data-grimoire en <html>):

   · 五 cinco hojas  → motas de antimagia que suben + tajos de espada
                       antimagia + grietas rojas de demonio.
   · 四 cuatro hojas → brasas de fuego carmesí que suben rápido + andanadas
                       de llamaradas (Leones Carmesí).
   · 三 tres hojas   → polvo dorado que asciende + círculos mágicos que se
                       trazan en el aire y disparan un rayo de luz.

   Los colores se leen de las variables CSS, así que el canvas se repinta
   solo al cambiar de grimorio. Se pausa con la pestaña oculta y queda
   estático si el visitante pidió menos movimiento.
   ========================================================================== */
(function () {
  'use strict';

  var canvas = document.getElementById('mana');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d', { alpha: true });
  var root = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TAU = Math.PI * 2;

  var W = 0, H = 0, DPR = 1;
  var motes = [];
  var fx = [];
  var pal = null;
  var grim = 'cinco';
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var scroll = 0;
  var last = 0, raf = 0, running = false;
  var nextA = 2200, nextB = 5000;

  /* ── Utilidades ────────────────────────────────────────────────────────── */
  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function rgbVar(name, fallback) {
    var raw = getComputedStyle(root).getPropertyValue(name).trim();
    var parts = raw.split(',').map(function (n) { return parseInt(n, 10); });
    if (parts.length === 3 && parts.every(function (n) { return !isNaN(n); })) return parts;
    return fallback;
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  function readPalette() {
    grim = root.getAttribute('data-grimoire') || 'cinco';
    pal = {
      ac: rgbVar('--ac-rgb', [168, 85, 247]),
      ac2: rgbVar('--ac2-rgb', [226, 200, 255]),
      cold: rgbVar('--cold-rgb', [255, 59, 107]),
      white: grim === 'tres' ? [255, 246, 220] : [244, 240, 252],
      light: grim === 'tres'
    };
  }

  /* ── Tamaño ────────────────────────────────────────────────────────────── */
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    seed();
  }

  /* ── Motas ─────────────────────────────────────────────────────────────── */
  function moteCount() {
    var base = clamp(Math.round(W * H / 16000), 40, 130);
    return reduced ? Math.round(base * 0.5) : base;
  }

  function newMote(spread) {
    var m = {
      x: rand(-40, W + 40),
      y: spread ? rand(-40, H + 40) : rand(H + 10, H + H * 0.4),
      r: 0, vx: 0, vy: 0, a: 0, ph: rand(0, TAU), sw: rand(.3, 1.1),
      c: null, trail: 0, leaf: false, rot: rand(0, TAU), vr: rand(-2, 2)
    };
    if (grim === 'cuatro') {                   /* fuego carmesí: brasas rápidas */
      m.r = rand(.6, 2.6);
      m.vx = rand(-14, 14);
      m.vy = -rand(34, 96);
      m.a = rand(.35, .9);
      m.c = Math.random() < .4 ? pal.cold : (Math.random() < .5 ? pal.ac2 : pal.ac);
      m.trail = rand(8, 24);
    } else if (grim === 'tres') {              /* polvo dorado lento */
      m.r = rand(.7, 2.6);
      m.vx = rand(-6, 6);
      m.vy = -rand(10, 34);
      m.a = rand(.3, .85);
      m.c = Math.random() < .38 ? pal.cold : (Math.random() < .5 ? pal.ac2 : pal.ac);
    } else {                                   /* antimagia: brasas que suben */
      m.r = rand(.6, 2.4);
      m.vx = rand(-9, 9);
      m.vy = -rand(16, 52);
      m.a = rand(.25, .85);
      m.c = Math.random() < .16 ? pal.cold : (Math.random() < .35 ? pal.white : pal.ac);
      m.trail = rand(5, 18);
    }
    return m;
  }

  function seed() {
    var n = moteCount();
    motes = [];
    for (var i = 0; i < n; i++) motes.push(newMote(true));
  }

  function recycle(m) {
    var fresh = newMote(false);
    for (var k in fresh) if (Object.prototype.hasOwnProperty.call(fresh, k)) m[k] = fresh[k];
  }

  /* ── Efectos ───────────────────────────────────────────────────────────── */
  function spawnSlash() {
    var ltr = Math.random() < .5;
    fx.push({
      type: 'slash', t: 0, dur: rand(850, 1200),
      x: ltr ? -W * .2 : W * 1.2, y: rand(H * .1, H * .8),
      dir: ltr ? 1 : -1,
      len: rand(W * .5, W * .85), arc: rand(.2, .4), w: rand(4, 10)
    });
  }

  function spawnCrack() {
    var x = rand(W * .1, W * .9), y = rand(H * .1, H * .9);
    var pts = [{ x: x, y: y }];
    var ang = rand(-Math.PI, Math.PI);
    for (var i = 0; i < 7; i++) {
      ang += rand(-.9, .9);
      var step = rand(28, 80);
      x += Math.cos(ang) * step; y += Math.sin(ang) * step;
      pts.push({ x: x, y: y });
    }
    fx.push({ type: 'crack', t: 0, dur: 2400, pts: pts });
  }

  function spawnVolley() {
    var n = rand(3, 7) | 0;
    var y0 = rand(H * .1, H * .8);
    for (var i = 0; i < n; i++) {
      fx.push({
        type: 'arrow', t: -i * 90, dur: rand(620, 900),
        x: -W * .12, y: y0 + i * rand(18, 40) - n * 15,
        vx: rand(W * 1.4, W * 2), vy: rand(-H * .25, H * .25),
        len: rand(90, 190), w: rand(1.2, 2.6)
      });
    }
  }

  function spawnSpell() {
    fx.push({
      type: 'spell', t: 0, dur: 2300,
      x: rand(W * .12, W * .88), y: rand(H * .18, H * .78),
      r: rand(36, 70), dir: Math.random() < .5 ? 1 : -1, spin: rand(-1, 1)
    });
  }

  /* ── Dibujo de efectos ─────────────────────────────────────────────────── */
  function drawSlash(f) {
    var p = f.t / f.dur;
    var head = clamp(p * 1.45, 0, 1);
    var alpha = p < .2 ? p / .2 : 1 - (p - .2) / .8;
    if (alpha <= 0) return;
    var x0 = f.x + f.dir * f.len * (head - .55), y0 = f.y;
    var dx = f.dir * f.len, sag = f.len * f.arc;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.lineCap = 'round';
    ctx.shadowColor = rgba(pal.ac, .9);
    ctx.shadowBlur = 40;
    ctx.strokeStyle = rgba(pal.ac, .4);
    ctx.lineWidth = f.w * 6;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + dx * .5, y0 + sag, x0 + dx, y0 + sag * .18);
    ctx.stroke();
    /* núcleo negro de antimagia */
    ctx.globalCompositeOperation = 'source-over';
    ctx.shadowBlur = 12;
    ctx.shadowColor = rgba(pal.cold, .9);
    ctx.strokeStyle = 'rgba(4,2,8,.92)';
    ctx.lineWidth = f.w;
    ctx.stroke();
    ctx.restore();
  }

  function drawCrack(f) {
    var p = f.t / f.dur;
    var grow = clamp(p / .4, 0, 1);
    var alpha = p < .4 ? 1 : 1 - (p - .4) / .6;
    if (alpha <= 0) return;
    var n = Math.max(2, Math.ceil(f.pts.length * grow));
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.shadowColor = rgba(pal.cold, .9);
    ctx.shadowBlur = 30;
    ctx.strokeStyle = rgba(pal.cold, .75);
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(f.pts[0].x, f.pts[0].y);
    for (var i = 1; i < n; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
    ctx.stroke();
    ctx.shadowBlur = 8;
    ctx.strokeStyle = 'rgba(6,3,10,.95)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawArrow(f) {
    if (f.t < 0) return;
    var p = f.t / f.dur;
    var alpha = p < .12 ? p / .12 : 1 - (p - .12) / .88;
    if (alpha <= 0) return;
    var x = f.x + f.vx * (f.t / 1000), y = f.y + f.vy * (f.t / 1000);
    var m = Math.hypot(f.vx, f.vy) || 1, ux = f.vx / m, uy = f.vy / m;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.lineCap = 'round';
    ctx.shadowColor = rgba(pal.ac, 1);
    ctx.shadowBlur = 22;
    ctx.strokeStyle = rgba(pal.ac, .85);
    ctx.lineWidth = f.w * 3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ux * f.len, y - uy * f.len); ctx.stroke();
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255,255,255,.95)';
    ctx.lineWidth = f.w;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ux * f.len * .7, y - uy * f.len * .7); ctx.stroke();
    ctx.restore();
  }

  /* Círculo mágico que se traza, gira y dispara un rayo de luz */
  function drawSpell(f) {
    var p = f.t / f.dur;
    var draw = clamp(p / .35, 0, 1);
    var alpha = p < .7 ? 1 : 1 - (p - .7) / .3;
    var rot = f.t / 1000 * f.spin;
    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.translate(f.x, f.y);
    ctx.rotate(rot);
    ctx.lineCap = 'round';
    ctx.shadowColor = rgba(pal.ac, .9);
    ctx.shadowBlur = 18;
    ctx.strokeStyle = rgba(pal.ac, .85);

    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, f.r, 0, TAU * draw); ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, f.r * .72, 0, -TAU * draw, true); ctx.stroke();

    /* triángulo inscrito (tres hojas) */
    if (draw > .4) {
      ctx.globalAlpha = clamp(alpha * (draw - .4) / .6, 0, 1);
      ctx.beginPath();
      for (var i = 0; i <= 3; i++) {
        var a = -Math.PI / 2 + i * TAU / 3;
        var px = Math.cos(a) * f.r * .72, py = Math.sin(a) * f.r * .72;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
      /* marcas de runa */
      for (var j = 0; j < 12; j++) {
        var b = j * TAU / 12;
        ctx.beginPath();
        ctx.moveTo(Math.cos(b) * f.r * 1.08, Math.sin(b) * f.r * 1.08);
        ctx.lineTo(Math.cos(b) * f.r * 1.2, Math.sin(b) * f.r * 1.2);
        ctx.stroke();
      }
    }
    ctx.restore();

    /* rayo de luz */
    if (p > .45 && p < .95) {
      var bp = (p - .45) / .5;
      var len = W * 1.3 * Math.min(1, bp * 2.4);
      ctx.save();
      ctx.globalAlpha = clamp(1 - bp, 0, 1);
      ctx.lineCap = 'round';
      ctx.shadowColor = rgba(pal.ac, 1);
      ctx.shadowBlur = 40;
      ctx.strokeStyle = rgba(pal.ac2, .55);
      ctx.lineWidth = f.r * .6;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x + f.dir * len, f.y - len * .08); ctx.stroke();
      ctx.shadowBlur = 14;
      ctx.strokeStyle = rgba(pal.white, .95);
      ctx.lineWidth = f.r * .16;
      ctx.stroke();
      ctx.restore();
    }
  }

  /* ── Bucle ─────────────────────────────────────────────────────────────── */
  function frame(now) {
    raf = 0;
    if (!running) return;
    var dt = Math.min(now - (last || now), 50);
    last = now;
    step(dt);
    raf = requestAnimationFrame(frame);
  }

  function step(dt) {
    var sec = dt / 1000;
    mouse.x += (mouse.tx - mouse.x) * .06;
    mouse.y += (mouse.ty - mouse.y) * .06;

    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = pal.light ? 'source-over' : 'lighter';

    var px = mouse.x * 26, py = mouse.y * 18 - scroll * .06;

    for (var i = 0; i < motes.length; i++) {
      var m = motes[i];
      m.ph += sec * m.sw;
      m.rot += sec * m.vr;
      m.x += (m.vx + Math.sin(m.ph) * 9) * sec;
      m.y += (m.vy + (m.leaf ? Math.cos(m.ph * 1.7) * 24 : 0)) * sec;

      if (m.y < -70 || m.y > H + 70 || m.x < -90 || m.x > W + 90) { recycle(m); continue; }

      var x = m.x + px, y = m.y + py;
      var tw = .75 + Math.sin(m.ph * 2.2) * .25;

      if (m.leaf) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(m.rot);
        ctx.fillStyle = rgba(m.c, m.a * tw * .8);
        ctx.beginPath();
        ctx.ellipse(0, 0, m.r, m.r * .55, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
        continue;
      }
      if (m.trail) {
        ctx.strokeStyle = rgba(m.c, m.a * tw * .35);
        ctx.lineWidth = m.r * .9;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - m.vx * .006 * m.trail, y - m.vy * .006 * m.trail);
        ctx.stroke();
      }
      ctx.fillStyle = rgba(m.c, m.a * tw);
      ctx.beginPath();
      ctx.arc(x, y, m.r, 0, TAU);
      ctx.fill();

      if (m.r > 1.8) {
        var g = ctx.createRadialGradient(x, y, 0, x, y, m.r * 7);
        g.addColorStop(0, rgba(m.c, m.a * .3));
        g.addColorStop(1, rgba(m.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, m.r * 7, 0, TAU); ctx.fill();
      }
    }

    /* programación de efectos por grimorio */
    if (!reduced) {
      nextA -= dt; nextB -= dt;
      if (grim === 'cinco') {
        if (nextA <= 0) { spawnSlash(); nextA = rand(3800, 6600); }
        if (nextB <= 0) { spawnCrack(); nextB = rand(6500, 11000); }
      } else if (grim === 'cuatro') {
        if (nextA <= 0) { spawnVolley(); nextA = rand(2600, 4800); }
        nextB = Math.max(nextB, 0);
      } else {
        if (nextA <= 0) { spawnSpell(); nextA = rand(4200, 7200); }
        nextB = Math.max(nextB, 0);
      }
    }

    for (var j = fx.length - 1; j >= 0; j--) {
      var f = fx[j];
      f.t += dt;
      if (f.t > f.dur) { fx.splice(j, 1); continue; }
      if (f.type === 'slash') drawSlash(f);
      else if (f.type === 'crack') drawCrack(f);
      else if (f.type === 'arrow') drawArrow(f);
      else if (f.type === 'spell') drawSpell(f);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function start() {
    if (running || reduced) return;
    running = true; last = 0;
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  /* ── Eventos ───────────────────────────────────────────────────────────── */
  function onMove(e) {
    mouse.tx = (e.clientX / window.innerWidth - .5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - .5) * 2;
  }

  function reset() {
    readPalette();
    fx = [];
    nextA = 900; nextB = 2600;
    seed();
    if (reduced) step(16);
  }

  function init() {
    readPalette();
    resize();

    var rz = 0;
    window.addEventListener('resize', function () {
      if (rz) return;
      rz = setTimeout(function () { rz = 0; resize(); }, 180);
    });
    if (window.matchMedia('(pointer: fine)').matches) {
      window.addEventListener('mousemove', onMove, { passive: true });
    }
    window.addEventListener('scroll', function () { scroll = window.scrollY; }, { passive: true });
    document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });

    /* El grimorio puede cambiar en cualquier momento: repinta la paleta */
    new MutationObserver(reset).observe(root, { attributes: true, attributeFilter: ['data-grimoire'] });

    if (reduced) { step(16); return; }
    start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
