/* ==========================================================================
   Planeta de fondo en <canvas> (proyección ortográfica) + cielo estrellado.
   Usa window.WORLD_DOTS (js/world-dots.js) y los colores del tema (CSS vars).

   - En el hero el planeta está a la derecha del texto; al bajar se agranda,
     se desplaza hacia la esquina inferior y se atenúa para no tapar el contenido.
   - Gira solo, acelera con el scroll y se inclina siguiendo al mouse.
   - Estrellas con parpadeo, parallax y estrellas fugaces ocasionales.
   - Se pausa con la pestaña oculta; con movimiento reducido queda estático.
   ========================================================================== */
(function () {
  'use strict';

  var DEG = Math.PI / 180;
  var HOME = { lat: -33.45, lon: -70.66 }; // Santiago, Chile

  function hexToRgb(hex) {
    var h = hex.trim().replace('#', '');
    if (h.length === 3) h = h.replace(/./g, '$&$&');
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function smooth(t) { return t * t * (3 - 2 * t); }

  function readPalette() {
    var s = getComputedStyle(document.documentElement);
    var light = document.documentElement.getAttribute('data-theme') === 'light';
    return {
      y: hexToRgb(s.getPropertyValue('--y') || '#38BDF8'),
      pale: hexToRgb(s.getPropertyValue('--y2') || '#7DD3FC'),
      ember: hexToRgb(s.getPropertyValue('--ember') || '#2563EB'),
      star: light ? [20, 20, 20] : [240, 244, 230],
      light: light
    };
  }

  function init() {
    var canvas = document.getElementById('globe');
    var data = window.WORLD_DOTS;
    if (!canvas || !data || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Vectores unitarios de cada punto de tierra
    var count = data.length / 2;
    var px = new Float32Array(count), py = new Float32Array(count), pz = new Float32Array(count);
    for (var i = 0; i < count; i++) {
      var la = data[i * 2] * DEG, lo = data[i * 2 + 1] * DEG;
      px[i] = Math.cos(la) * Math.sin(lo);
      py[i] = Math.sin(la);
      pz[i] = Math.cos(la) * Math.cos(lo);
    }
    // Buffers reutilizables para agrupar los puntos frontales por opacidad
    var BUCKETS = 10;
    var bucketLen = new Int32Array(BUCKETS);
    var bucketPts = new Float32Array(BUCKETS * count * 3);

    var W = 0, H = 0, dpr = 1;
    var stars = [], shooting = null, nextShoot = 120;
    var palette = readPalette();

    // Estado animado: se interpola hacia "target" en cada frame
    var cur = { cx: 0, cy: 0, R: 0, alpha: 1 };
    var target = { cx: 0, cy: 0, R: 0, alpha: 1 };
    var rotY = -HOME.lon * DEG + 0.5;   // empieza mostrando Sudamérica
    var tilt = 18 * DEG, tiltTarget = tilt;
    var spin = 0.0018, scrollBoost = 0, lastScroll = window.scrollY;
    var mouseX = 0;
    var raf = 0, t = 0;

    function buildStars() {
      var n = Math.round(clamp(W * H / 7000, 60, 260));
      stars = [];
      for (var k = 0; k < n; k++) {
        stars.push({
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 1.2 + 0.3,
          depth: Math.random() * 0.6 + 0.2,
          phase: Math.random() * Math.PI * 2,
          speed: Math.random() * 0.03 + 0.01
        });
      }
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildStars();
      computeTarget();
      cur.cx = target.cx; cur.cy = target.cy; cur.R = target.R; cur.alpha = target.alpha;
    }

    // Posición del planeta según el scroll.
    // En el hero asoma desde abajo como un horizonte (su borde superior queda
    // a ~66% de la altura); al bajar se mueve a la esquina y se atenúa.
    function computeTarget() {
      var mobile = W < 960;
      var p = smooth(clamp(window.scrollY / (H * 0.9), 0, 1));
      var heroR = mobile ? W * 0.95 : Math.max(W * 0.5, H * 0.75);
      var heroX = W * 0.5;
      var heroY = H * (mobile ? 0.64 : 0.66) + heroR;
      var farR = Math.max(W, H) * (mobile ? 0.55 : 0.42);
      var farX = mobile ? W * 0.5 : W * 0.88;
      var farY = H * (mobile ? 1.0 : 0.92);
      target.R = lerp(heroR, farR, p);
      target.cx = lerp(heroX, farX, p);
      target.cy = lerp(heroY, farY, p);
      target.alpha = lerp(1, palette.light ? 0.3 : 0.4, p);
    }

    var tmp = [0, 0, 0];
    // Senos/cosenos de la rotación: se calculan una vez por frame (updateRot)
    var cr = 1, sr = 0, ct = 1, st = 0;
    function updateRot() {
      cr = Math.cos(rotY); sr = Math.sin(rotY);
      ct = Math.cos(tilt); st = Math.sin(tilt);
    }
    // Rota (x,y,z) por rotY (eje vertical) y tilt (eje X) y proyecta
    function project(x, y, z, out) {
      var x1 = x * cr + z * sr;
      var z1 = -x * sr + z * cr;
      var y2 = y * ct - z1 * st;
      var z2 = y * st + z1 * ct;
      out[0] = cur.cx + x1 * cur.R;
      out[1] = cur.cy - y2 * cur.R;
      out[2] = z2;
      return out;
    }

    function drawStars() {
      // Un solo fillStyle; la opacidad de cada estrella va por globalAlpha
      // (evita crear y parsear un string rgba() por estrella en cada frame)
      ctx.fillStyle = rgba(palette.star, 1);
      var off = window.scrollY;
      var k2 = palette.light ? 0.35 : 1;
      for (var k = 0; k < stars.length; k++) {
        var s = stars[k];
        var y = (s.y - off * s.depth * 0.15) % H;
        if (y < 0) y += H;
        ctx.globalAlpha = (0.25 + 0.55 * (0.5 + 0.5 * Math.sin(s.phase + t * s.speed))) * k2;
        ctx.fillRect(s.x, y, s.r, s.r);
      }
      ctx.globalAlpha = 1;
    }

    function drawShootingStar() {
      if (reduced) return;
      if (!shooting && t > nextShoot) {
        var fromLeft = Math.random() < 0.5;
        shooting = {
          x: fromLeft ? Math.random() * W * 0.5 : W * (0.5 + Math.random() * 0.5),
          y: Math.random() * H * 0.4,
          vx: (fromLeft ? 1 : -1) * (9 + Math.random() * 5),
          vy: 4 + Math.random() * 3,
          life: 0, max: 50 + Math.random() * 30
        };
      }
      if (!shooting) return;
      var s = shooting;
      s.x += s.vx; s.y += s.vy; s.life++;
      var fade = Math.sin(Math.PI * s.life / s.max);
      var g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 10, s.y - s.vy * 10);
      g.addColorStop(0, rgba(palette.pale, 0.9 * fade));
      g.addColorStop(1, rgba(palette.y, 0));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 10, s.y - s.vy * 10); ctx.stroke();
      if (s.life >= s.max) { shooting = null; nextShoot = t + 240 + Math.random() * 360; }
    }

    function drawGraticule(c) {
      ctx.lineWidth = 0.8;
      var lat, lon, k, started;
      for (lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath(); started = false;
        for (k = 0; k <= 72; k++) {
          lon = k * 5 * DEG;
          project(Math.cos(lat * DEG) * Math.sin(lon), Math.sin(lat * DEG), Math.cos(lat * DEG) * Math.cos(lon), tmp);
          if (tmp[2] < 0) { started = false; continue; }
          if (!started) { ctx.moveTo(tmp[0], tmp[1]); started = true; } else ctx.lineTo(tmp[0], tmp[1]);
        }
        ctx.strokeStyle = rgba(c, lat === 0 ? 0.3 : 0.14);
        ctx.stroke();
      }
      ctx.strokeStyle = rgba(c, 0.14);
      for (lon = 0; lon < 180; lon += 30) {
        ctx.beginPath(); started = false;
        for (k = 0; k <= 72; k++) {
          var a = k * 5 * DEG;
          project(Math.cos(a) * Math.sin(lon * DEG), Math.sin(a), Math.cos(a) * Math.cos(lon * DEG), tmp);
          if (tmp[2] < 0) { started = false; continue; }
          if (!started) { ctx.moveTo(tmp[0], tmp[1]); started = true; } else ctx.lineTo(tmp[0], tmp[1]);
        }
        ctx.stroke();
      }
    }

    function drawOrbit(rx, ry, rot, angle, color, sat) {
      var R = cur.R;
      ctx.save();
      ctx.translate(cur.cx, cur.cy);
      ctx.rotate(rot);
      ctx.strokeStyle = rgba(color, 0.25);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 6]);
      ctx.beginPath(); ctx.ellipse(0, 0, R * rx, R * ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      var sx = Math.cos(angle) * R * rx, sy = Math.sin(angle) * R * ry;
      var behind = Math.sin(angle) < 0 && Math.abs(sx) < R;
      if (!behind) {
        // Brillo con un degradado radial (shadowBlur es muy caro por frame)
        var glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, 12);
        glow.addColorStop(0, rgba(color, 0.55));
        glow.addColorStop(1, rgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(sx, sy, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = rgba(sat, 1);
        ctx.beginPath(); ctx.arc(sx, sy, 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function drawGlobe() {
      var c = palette.y, pale = palette.pale, ember = palette.ember;
      var cx = cur.cx, cy = cur.cy, R = cur.R;

      // Halo exterior (solo el anillo; el interior queda oscuro)
      var halo = ctx.createRadialGradient(cx, cy, R, cx, cy, R * 1.35);
      halo.addColorStop(0, rgba(c, palette.light ? 0.16 : 0.22));
      halo.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.35, 0, Math.PI * 2); ctx.arc(cx, cy, R, 0, Math.PI * 2, true); ctx.fill();

      // Esfera de vidrio
      var body = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      body.addColorStop(0, rgba(pale, palette.light ? 0.16 : 0.08));
      body.addColorStop(0.7, rgba(ember, 0.05));
      body.addColorStop(1, rgba(c, palette.light ? 0.18 : 0.16));
      ctx.fillStyle = body;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

      drawGraticule(c);

      // Puntos de tierra (cara trasera tenue, frontal brillante).
      // Se agrupan por opacidad en BUCKETS trazados: un fill() por grupo en
      // vez de un fillStyle + fillRect por punto (miles por frame).
      var dot = Math.max(1.2, R / 115);
      var minX = -dot * 2, maxX = W + dot * 2, minY = -dot * 2, maxY = H + dot * 2;
      ctx.beginPath();
      var b, k;
      for (b = 0; b < BUCKETS; b++) { bucketLen[b] = 0; }
      for (k = 0; k < count; k++) {
        project(px[k], py[k], pz[k], tmp);
        var x0 = tmp[0], y0 = tmp[1], z = tmp[2];
        if (x0 < minX || x0 > maxX || y0 < minY || y0 > maxY) continue; // fuera de pantalla
        if (z < 0) {
          ctx.rect(x0 - dot * 0.4, y0 - dot * 0.4, dot * 0.8, dot * 0.8);
        } else {
          b = Math.min(BUCKETS - 1, (z * BUCKETS) | 0);
          var off = b * count * 3 + bucketLen[b] * 3;
          bucketPts[off] = x0; bucketPts[off + 1] = y0; bucketPts[off + 2] = z;
          bucketLen[b]++;
        }
      }
      ctx.fillStyle = rgba(c, 0.06);
      ctx.fill();
      for (b = 0; b < BUCKETS; b++) {
        var n = bucketLen[b];
        if (!n) continue;
        var zb = (b + 0.5) / BUCKETS;
        ctx.fillStyle = rgba(zb > 0.55 ? pale : c, 0.35 + zb * 0.65);
        ctx.beginPath();
        var base0 = b * count * 3;
        for (var j = 0; j < n; j++) {
          var o = base0 + j * 3;
          var s = dot * (0.65 + bucketPts[o + 2] * 0.55);
          ctx.rect(bucketPts[o] - s / 2, bucketPts[o + 1] - s / 2, s, s);
        }
        ctx.fill();
      }

      // Borde luminoso: halo con trazos anchos semitransparentes
      // (mismo efecto que shadowBlur pero mucho más barato)
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = rgba(c, 0.07); ctx.lineWidth = 16; ctx.stroke();
      ctx.strokeStyle = rgba(c, 0.12); ctx.lineWidth = 8; ctx.stroke();
      ctx.strokeStyle = rgba(c, 0.6); ctx.lineWidth = 1.5; ctx.stroke();

      // Santiago con pulso
      var h = project(Math.cos(HOME.lat * DEG) * Math.sin(HOME.lon * DEG), Math.sin(HOME.lat * DEG), Math.cos(HOME.lat * DEG) * Math.cos(HOME.lon * DEG), [0, 0, 0]);
      if (h[2] > 0) {
        var p = (t % 120) / 120;
        ctx.strokeStyle = rgba(pale, (1 - p) * 0.9 * h[2]);
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(h[0], h[1], 4 + p * 18, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = rgba(pale, h[2]);
        ctx.beginPath(); ctx.arc(h[0], h[1], 3.5, 0, Math.PI * 2); ctx.fill();
      }

      // Dos órbitas con satélites
      drawOrbit(1.25, 0.3, -0.35, t * 0.012, c, pale);
      drawOrbit(1.45, 0.22, 0.5, -t * 0.008 + 2, ember, pale);

      // Reflejo de luz en la base
      var by = cy + R * 1.12;
      var base = ctx.createRadialGradient(cx, by, 0, cx, by, R * 0.7);
      base.addColorStop(0, rgba(c, 0.35));
      base.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = base;
      ctx.beginPath(); ctx.ellipse(cx, by, R * 0.7, R * 0.08, 0, 0, Math.PI * 2); ctx.fill();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      updateRot();
      drawStars();
      drawShootingStar();
      ctx.globalAlpha = cur.alpha;
      drawGlobe();
      ctx.globalAlpha = 1;
    }

    function frame() {
      raf = 0;
      computeTarget();
      var e = 0.08;
      cur.cx = lerp(cur.cx, target.cx, e);
      cur.cy = lerp(cur.cy, target.cy, e);
      cur.R = lerp(cur.R, target.R, e);
      cur.alpha = lerp(cur.alpha, target.alpha, e);
      tilt = lerp(tilt, tiltTarget, 0.05);

      // El scroll le da un empujón al giro
      var y = window.scrollY;
      scrollBoost += (y - lastScroll) * 0.00025;
      lastScroll = y;
      scrollBoost *= 0.92;

      rotY += spin + scrollBoost + mouseX * 0.0006;
      t++;
      draw();
      raf = requestAnimationFrame(frame);
    }

    function start() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

    window.addEventListener('mousemove', function (e) {
      mouseX = e.clientX / W - 0.5;
      tiltTarget = (18 + (e.clientY / H - 0.5) * 14) * DEG;
    }, { passive: true });

    // Resize agrupado en un frame (evita reconstruir el canvas decenas de veces)
    var resizeRaf = 0;
    window.addEventListener('resize', function () {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(function () {
        resizeRaf = 0;
        resize();
        if (reduced) draw();
      });
    });

    document.addEventListener('visibilitychange', function () {
      if (reduced) return;
      if (document.hidden) stop(); else start();
    });

    // Recolorea al cambiar de tema
    new MutationObserver(function () {
      palette = readPalette();
      if (reduced) draw();
    }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    resize();
    if (reduced) {
      // Estático: solo se reposiciona con el scroll
      draw();
      window.addEventListener('scroll', function () {
        computeTarget();
        cur.cx = target.cx; cur.cy = target.cy; cur.R = target.R; cur.alpha = target.alpha;
        draw();
      }, { passive: true });
    } else {
      start();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
