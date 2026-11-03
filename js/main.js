(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const root = document.documentElement;
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const host = url => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const { PROFILE, PROJECTS, TIMELINE, SKILLS } = window;

  /* ---------- Theme ---------- */
  const isLight = () => root.dataset.theme === 'light'; // dark unless the visitor picked light
  $('.theme-toggle').addEventListener('click', () => {
    root.dataset.theme = isLight() ? 'dark' : 'light';
    try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
    $('meta[name="theme-color"]').content = isLight() ? '#f6f6f3' : '#0a0b0f';
    hero.refreshColors();
    trailColors();
  });

  /* ---------- Custom cursor ---------- */
  const cursor = $('.cursor');
  let trailColors = () => {};
  const pointer = { x: innerWidth / 2, y: innerHeight / 2, active: false, last: 0 };
  if (finePointer && !reduceMotion) {
    root.classList.add('has-cursor');
    const dot = $('.cursor-dot'), ring = $('.cursor-ring'), label = $('.cursor-label');
    const ringPos = { x: pointer.x, y: pointer.y };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = e.clientX; pointer.y = e.clientY;
      dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      cursor.classList.remove('hidden');
    });
    document.addEventListener('pointerleave', () => cursor.classList.add('hidden'));
    addEventListener('pointerdown', () => cursor.classList.add('down'));
    addEventListener('pointerup', () => cursor.classList.remove('down'));
    const loop = () => {
      ringPos.x += (pointer.x - ringPos.x) * .18;
      ringPos.y += (pointer.y - ringPos.y) * .18;
      ring.style.transform = `translate(${ringPos.x}px, ${ringPos.y}px)`;
      requestAnimationFrame(loop);
    };
    loop();
    // Glowing trail: keep the last ~400 ms of pointer positions and draw them as a tapering, fading ribbon.
    // The loop only runs while there are points left, so an idle mouse costs nothing.
    const trail = document.createElement('canvas');
    trail.className = 'cursor-trail';
    cursor.prepend(trail);
    const tctx = trail.getContext('2d');
    const pts = [];
    let trailOn = false, tColors = [];
    const sizeTrail = () => { const d = Math.min(devicePixelRatio || 1, 2); trail.width = innerWidth * d; trail.height = innerHeight * d; tctx.setTransform(d, 0, 0, d, 0, 0); };
    trailColors = () => { const cs = getComputedStyle(root); tColors = [cs.getPropertyValue('--accent').trim(), cs.getPropertyValue('--accent-2').trim()]; };
    const LIFE = 420;
    const drawTrail = now => {
      while (pts.length && now - pts[0].t > LIFE) pts.shift();
      tctx.clearRect(0, 0, innerWidth, innerHeight);
      if (pts.length > 1) {
        tctx.lineCap = 'round';
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1], b = pts[i], k = i / pts.length, life = 1 - (now - b.t) / LIFE;
          tctx.strokeStyle = k < .5 ? tColors[1] : tColors[0];
          // wide soft pass for the glow, then a thin bright core
          tctx.globalAlpha = life * k * .18; tctx.lineWidth = 2 + k * 16;
          tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
          tctx.globalAlpha = life * k * .9; tctx.lineWidth = .8 + k * 3.2;
          tctx.beginPath(); tctx.moveTo(a.x, a.y); tctx.lineTo(b.x, b.y); tctx.stroke();
        }
        tctx.globalAlpha = 1;
      }
      if (pts.length) requestAnimationFrame(drawTrail); else trailOn = false;
    };
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      pts.push({ x: e.clientX, y: e.clientY, t: performance.now() });
      if (pts.length > 60) pts.shift();
      if (!trailOn) { trailOn = true; requestAnimationFrame(drawTrail); }
    }, { passive: true });
    addEventListener('resize', sizeTrail);
    sizeTrail(); trailColors();

    document.addEventListener('pointerover', e => {
      const t = e.target.closest('[data-cursor], a, button, input, .tile');
      cursor.classList.toggle('hover', !!t && !t.dataset.cursor);
      cursor.classList.toggle('label', !!(t && t.dataset.cursor));
      label.textContent = t?.dataset.cursor || '';
    });
  } else {
    cursor.remove();
  }

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduceMotion) {
    document.addEventListener('pointermove', e => {
      const b = e.target.closest('.magnetic');
      $$('.magnetic.pulled').forEach(m => { if (m !== b) { m.style.transform = ''; m.classList.remove('pulled'); } });
      if (!b) return;
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .25}px, ${(e.clientY - r.top - r.height / 2) * .35}px)`;
      b.classList.add('pulled');
    });
  }

  /* ---------- Hero: interactive dot field ---------- */
  const hero = (() => {
    const canvas = $('.hero-canvas'), ctx = canvas.getContext('2d');
    const section = $('.hero');
    let w, h, dpr, dots = [], colors = {}, running = false, visible = true, t0 = performance.now();
    const ghost = { x: 0, y: 0 };
    const refreshColors = () => {
      const cs = getComputedStyle(root);
      colors = { dot: cs.getPropertyValue('--muted').trim(), a: cs.getPropertyValue('--accent').trim(), b: cs.getPropertyValue('--accent-2').trim() };
    };
    const resize = () => {
      dpr = Math.min(devicePixelRatio || 1, 2);
      w = section.clientWidth; h = section.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const gap = w < 700 ? 24 : 30;
      dots = [];
      for (let y = gap / 2; y < h; y += gap) for (let x = gap / 2; x < w; x += gap) dots.push({ x, y, ox: 0, oy: 0, glow: 0 });
    };
    const draw = now => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);
      const rect = section.getBoundingClientRect();
      // Use the real pointer when it's been active recently, otherwise let a "ghost" wander so the field stays alive on touch screens
      const idle = now - pointer.last > 2500;
      ghost.x = w * (.5 + .32 * Math.cos(t * .35)); ghost.y = h * (.45 + .25 * Math.sin(t * .5));
      const px = idle ? ghost.x : pointer.x - rect.left, py = idle ? ghost.y : pointer.y - rect.top;
      const R = Math.min(220, w * .28);
      for (const d of dots) {
        const dx = d.x - px, dy = d.y - py, dist = Math.hypot(dx, dy);
        let tx = Math.sin(t * .9 + d.x * .012 + d.y * .008) * 1.6, ty = Math.cos(t * .8 + d.y * .012) * 1.6, g = 0;
        if (dist < R) {
          const f = (1 - dist / R) ** 2;
          tx += dx / (dist || 1) * f * 34; ty += dy / (dist || 1) * f * 34; g = f;
        }
        d.ox += (tx - d.ox) * .12; d.oy += (ty - d.oy) * .12; d.glow += (g - d.glow) * .15;
        const r = 1.1 + d.glow * 2.4;
        ctx.globalAlpha = .28 + d.glow * .72;
        ctx.fillStyle = d.glow > .05 ? (d.x / w < .5 ? colors.a : colors.b) : colors.dot;
        ctx.beginPath(); ctx.arc(d.x + d.ox, d.y + d.oy, r, 0, 6.283); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (running) requestAnimationFrame(draw);
    };
    const start = () => { if (!running && visible && !document.hidden) { running = true; requestAnimationFrame(draw); } };
    const stop = () => { running = false; };
    addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.last = performance.now(); }, { passive: true });
    addEventListener('resize', () => { resize(); if (reduceMotion) draw(performance.now()); });
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }).observe(section);
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
    refreshColors(); resize();
    if (reduceMotion) draw(performance.now()); else start();
    return { refreshColors };
  })();

  /* ---------- Hero word rotator ---------- */
  const words = $$('.rotator span');
  let wi = 0;
  words[0].classList.add('on');
  if (!reduceMotion) setInterval(() => {
    const cur = words[wi]; wi = (wi + 1) % words.length; const next = words[wi];
    cur.classList.replace('on', 'out');
    next.classList.remove('out'); next.classList.add('on');
    setTimeout(() => cur.classList.remove('out'), 650);
  }, 2400);

  /* ---------- Marquee ---------- */
  const tools = ['React', 'TypeScript', 'Python', 'FastAPI', 'Figma', 'Illustrator', 'Next.js', 'SVG', 'Tailwind', 'Sanity', 'Cloudflare', 'Photoshop', 'InDesign', 'Git'];
  $('.marquee-track').innerHTML = [...tools, ...tools].map(t => `<span>${t}</span>`).join('');

  /* ---------- Project cards ---------- */
  const networkSVG = () => `
    <svg class="network" viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <g class="trk">
        <line x1="70" y1="90" x2="200" y2="90"/><line x1="70" y1="200" x2="200" y2="200"/><line x1="70" y1="310" x2="200" y2="310"/>
        <line x1="200" y1="90" x2="200" y2="310"/><line x1="200" y1="90" x2="320" y2="145"/><line x1="200" y1="200" x2="320" y2="145"/>
        <line x1="200" y1="200" x2="320" y2="255"/><line x1="200" y1="310" x2="320" y2="255"/><line x1="320" y1="145" x2="320" y2="255"/>
        <line x1="320" y1="145" x2="430" y2="90"/><line x1="320" y1="145" x2="430" y2="200"/><line x1="320" y1="255" x2="430" y2="200"/>
        <line x1="320" y1="255" x2="430" y2="310"/><line x1="430" y1="90" x2="430" y2="310"/><line x1="200" y1="90" x2="430" y2="90"/>
        <line x1="200" y1="310" x2="430" y2="310"/><line x1="430" y1="90" x2="535" y2="90"/><line x1="430" y1="200" x2="535" y2="200"/><line x1="430" y1="310" x2="535" y2="310"/>
      </g>
      <path class="route" pathLength="1" d="M70 90 H200 L320 145 L430 200 H535"/>
      <path class="route b" pathLength="1" d="M70 310 H200 L320 255 V145 L430 90 H535"/>
      ${[[70, 90], [70, 200], [70, 310], [535, 90], [535, 200], [535, 310]].map(([x, y]) => `<circle class="nd big" cx="${x}" cy="${y}" r="15"/>`).join('')}
      ${[[200, 90], [200, 200], [200, 310], [320, 145], [320, 255], [430, 90], [430, 200], [430, 310]].map(([x, y]) => `<circle class="nd" cx="${x}" cy="${y}" r="6"/>`).join('')}
    </svg>`;

  const mediaFor = p => {
    if (p.visual === 'network') return `<span class="badge">Interactive case study</span>${networkSVG()}`;
    if (p.visual === 'device') return `
      <span class="badge">Live app</span>
      <div class="devices">
        <div class="browser"><div class="browser-bar"><i></i><i></i><i></i><em>${esc(host(p.live))}</em></div>
          <div class="screen"><img src="${p.shots.desktop}" alt="" loading="lazy"></div></div>
        <div class="phone"><img src="${p.shots.mobile}" alt="" loading="lazy"></div>
      </div>`;
    if (p.visual === 'audio') return `<span class="badge">With sound</span><div class="audio-visual"><img class="cover-img" src="${p.cover}" alt="" loading="lazy">
      <div class="wave">${Array.from({ length: 28 }, (_, i) => `<i style="--h:${20 + Math.round(Math.abs(Math.sin(i * 1.7)) * 75)}%;animation-delay:${(i % 7) * -.17}s"></i>`).join('')}</div></div>`;
    return `${p.live ? '<span class="badge">Live site</span>' : ''}<img class="cover-img" src="${p.cover}" alt="" loading="lazy">`;
  };

  const card = p => {
    const href = p.caseStudy || `#/p/${p.slug}`;
    return `
    <a class="project reveal${p.featured ? ' featured' : ''}" href="${href}" data-cat="${p.category}" data-cursor="${p.caseStudy ? 'Read' : 'Open'}">
      <div class="project-media">${mediaFor(p)}</div>
      <div class="project-info">
        <div class="project-meta"><span class="cat">${p.category === 'dev' ? 'Development' : 'Design'}</span><span>${p.year}</span><span>${esc(p.role)}</span></div>
        <h3>${esc(p.title)}</h3>
        <p class="tag">${esc(p.tagline)}</p>
        ${p.stats ? `<div class="stats">${p.stats.map(([b, s]) => `<div><b>${esc(b)}</b><span>${esc(s)}</span></div>`).join('')}</div>` : ''}
        <div class="tools">${p.tools.map(t => `<span>${esc(t)}</span>`).join('')}</div>
        <span class="open-hint">${p.caseStudy ? 'Read the case study' : 'View project'} <i>→</i></span>
      </div>
    </a>`;
  };
  const grid = $('#projects');
  grid.innerHTML = PROJECTS.map(card).join('');

  // Card spotlight that follows the mouse
  grid.addEventListener('pointermove', e => {
    const c = e.target.closest('.project'); if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`); c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
  // Scroll the screenshot inside the browser frame exactly to its bottom on hover
  const setScroll = img => {
    const screen = img.closest('.screen');
    img.style.setProperty('--scroll', `${Math.min(0, screen.clientHeight - img.clientHeight)}px`);
  };
  $$('.screen img').forEach(img => img.complete ? setScroll(img) : img.addEventListener('load', () => setScroll(img)));
  addEventListener('resize', () => $$('.screen img').forEach(setScroll));

  // Filters
  $$('.chip').forEach(b => b.addEventListener('click', () => {
    $$('.chip').forEach(c => c.classList.toggle('active', c === b));
    const f = b.dataset.filter;
    $$('.project').forEach(p => p.classList.toggle('is-hidden', f !== 'all' && p.dataset.cat !== f));
  }));

  /* ---------- Compare slider ---------- */
  const mountCompare = (el, cfg) => {
    el.innerHTML = `
      <div class="stage"><img src="${cfg.after}" alt="Finished Kvikk Racing logo"></div>
      <div class="before"><div class="stage"><img class="sketch" src="${cfg.before}" alt="Pencil sketch of the bear"></div></div>
      <div class="handle"></div><span class="tag l">Sketch</span><span class="tag r">Final logo</span>
      <input type="range" min="0" max="100" value="50" aria-label="${esc(cfg.label)}: drag to compare">`;
    const input = $('input', el);
    const set = v => el.style.setProperty('--pos', `${v}%`);
    input.addEventListener('input', () => set(input.value));
    set(50);
  };
  const kvikk = PROJECTS.find(p => p.slug === 'kvikk-racing');
  mountCompare($('#compare'), kvikk.compare);

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox'), lbImg = $('img', lb), lbCap = $('figcaption', lb);
  let lbItems = [], lbIndex = 0, lbReturn = null;
  const lbShow = i => { lbIndex = (i + lbItems.length) % lbItems.length; const it = lbItems[lbIndex]; lbImg.src = it.src; lbImg.alt = it.caption; lbCap.textContent = `${it.caption} · ${lbIndex + 1} / ${lbItems.length}`; };
  const openLightbox = (items, i, from) => { lbItems = items; lbReturn = from; lb.hidden = false; requestAnimationFrame(() => lb.classList.add('open')); lbShow(i); $('.lb-close', lb).focus(); };
  const closeLightbox = () => { lb.classList.remove('open'); setTimeout(() => { lb.hidden = true; lbImg.src = ''; }, 250); lbReturn?.focus(); };
  $('.lb-close', lb).addEventListener('click', closeLightbox);
  $('.lb-prev', lb).addEventListener('click', () => lbShow(lbIndex - 1));
  $('.lb-next', lb).addEventListener('click', () => lbShow(lbIndex + 1));
  lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
  let touchX = null;
  lb.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => { if (touchX == null) return; const dx = e.changedTouches[0].clientX - touchX; if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1)); touchX = null; });

  const tiles = (items, cls = '') => items.map((it, i) => `<button type="button" class="tile ${it.contain ? 'contain' : ''} ${cls}" data-i="${i}" data-cursor="View"><img src="${it.src}" alt="${esc(it.caption)}" loading="lazy"><span>${esc(it.caption)}</span></button>`).join('');
  const wireTiles = (container, items) => container.addEventListener('click', e => { const t = e.target.closest('.tile'); if (t) openLightbox(items, +t.dataset.i, t); });

  // Design galleries, one group per project so each brand stays together
  const groups = $('#design-groups');
  groups.innerHTML = PROJECTS.filter(p => p.category === 'design').map(p => `
    <div class="design-group" data-slug="${p.slug}">
      <div class="group-head reveal">
        <div>
          <p class="kicker">${p.year} · ${esc(p.context)}</p>
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.tagline)}</p>
        </div>
        <a class="btn small magnetic" href="#/p/${p.slug}">Open project →</a>
      </div>
      <div class="masonry">${tiles(p.gallery, 'reveal')}</div>
    </div>`).join('');
  $$('.design-group', groups).forEach(g => wireTiles($('.masonry', g), PROJECTS.find(p => p.slug === g.dataset.slug).gallery));

  /* ---------- About ---------- */
  $('#skills').innerHTML = Object.entries(SKILLS).map(([k, v]) => `<div><h3>${esc(k)}</h3><ul>${v.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>`).join('');
  $('#timeline').innerHTML = TIMELINE.map(t => `<li class="reveal"><span class="yr">${esc(t.years)}</span><div><h3>${esc(t.title)}</h3><div class="pl">${esc(t.place)}</div></div><p>${esc(t.text)}</p></li>`).join('');

  /* ---------- Contact ---------- */
  const emailBtn = $('#copy-email');
  $('.email-text', emailBtn).textContent = PROFILE.email;
  emailBtn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(PROFILE.email); $('.copied', emailBtn).textContent = '· copied!'; }
    catch (e) { location.href = `mailto:${PROFILE.email}`; }
    setTimeout(() => { $('.copied', emailBtn).textContent = ''; }, 2200);
  });
  $('#linkedin').href = PROFILE.linkedin;
  $('#github').href = PROFILE.github;
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Audio players with live waveform ---------- */
  let audioCtx;
  const mountPlayers = container => $$('.player', container).forEach(pl => {
    const audio = new Audio(pl.dataset.src); audio.preload = 'none';
    const btn = $('button', pl), canvas = $('canvas', pl), g = canvas.getContext('2d');
    let analyser, data, raf;
    const icons = { play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>', pause: '<svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>' };
    btn.innerHTML = icons.play;
    const size = () => { const d = Math.min(devicePixelRatio || 1, 2); canvas.width = canvas.clientWidth * d; canvas.height = canvas.clientHeight * d; };
    const draw = () => {
      size();
      const n = 48, W = canvas.width, H = canvas.height, bw = W / n;
      g.clearRect(0, 0, W, H);
      g.fillStyle = getComputedStyle(root).getPropertyValue('--accent');
      if (analyser) analyser.getByteFrequencyData(data);
      for (let i = 0; i < n; i++) {
        const v = analyser && !audio.paused ? data[Math.floor(i * data.length / n / 1.6)] / 255 : .12 + .1 * Math.abs(Math.sin(i * .9));
        const bh = Math.max(3, v * H * .95);
        g.globalAlpha = .35 + v * .65;
        g.fillRect(i * bw + bw * .2, (H - bh) / 2, bw * .6, bh);
      }
      if (!audio.paused) raf = requestAnimationFrame(draw);
    };
    draw();
    btn.addEventListener('click', () => {
      if (!analyser) {
        audioCtx ??= new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser(); analyser.fftSize = 256; data = new Uint8Array(analyser.frequencyBinCount);
        src.connect(analyser); analyser.connect(audioCtx.destination);
      }
      audioCtx.resume();
      if (audio.paused) { document.dispatchEvent(new CustomEvent('stop-audio', { detail: audio })); audio.play(); btn.innerHTML = icons.pause; btn.setAttribute('aria-label', 'Pause'); draw(); }
      else audio.pause();
    });
    audio.addEventListener('pause', () => { btn.innerHTML = icons.play; btn.setAttribute('aria-label', `Play ${pl.dataset.label}`); cancelAnimationFrame(raf); draw(); });
    audio.addEventListener('ended', () => audio.pause());
    document.addEventListener('stop-audio', e => { if (e.detail !== audio) audio.pause(); });
    btn.setAttribute('aria-label', `Play ${pl.dataset.label}`);
  });

  /* ---------- Project overlay (#/p/slug) ---------- */
  const overlay = $('#overlay'), content = $('#overlay-content');
  let lastFocus = null;
  const list = items => `<ol class="ov-list">${items.map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;

  const renderProject = p => {
    const live = p.live ? (p.embeddable
      ? `<div class="live-frame"><div class="browser-bar"><i></i><i></i><i></i><em>${esc(host(p.live))}</em></div>
           <div class="live-placeholder" style="background-image:url('${p.shots?.desktop || p.cover}')">
             <button type="button" class="btn primary big" data-load-live>▶ Try it live here</button>
             ${p.demoHint ? `<p class="hint">${esc(p.demoHint)}</p>` : ''}
           </div></div>`
      : `<div class="live-frame"><div class="browser-bar"><i></i><i></i><i></i><em>${esc(host(p.live))}</em></div>
           <div class="live-placeholder" style="background-image:url('${p.shots.desktop}')">
             <a class="btn primary big" href="${p.live}" target="_blank" rel="noopener">Open the live app ↗</a>
           </div></div>`) : '';
    return `
      <header class="ov-head">
        <p class="kicker">${esc(p.context)} · ${p.year}</p>
        <h2 id="ov-title">${esc(p.title)}</h2>
        <p class="lead">${esc(p.summary || p.tagline)}</p>
      </header>
      <dl class="ov-facts">
        <div><dt>My role</dt><dd>${esc(p.role)}</dd></div>
        <div><dt>Year</dt><dd>${p.year}</dd></div>
        <div><dt>Tools</dt><dd>${esc(p.tools.join(', '))}</dd></div>
      </dl>
      <div class="ov-actions">
        ${p.live ? `<a class="btn primary" href="${p.live}" target="_blank" rel="noopener">Live site ↗</a>` : ''}
        ${p.github ? `<a class="btn" href="${p.github}" target="_blank" rel="noopener">GitHub ↗</a>` : ''}
        ${p.download ? `<a class="btn" href="${p.download.href}" target="_blank" rel="noopener">${esc(p.download.label)} ↓</a>` : ''}
      </div>
      ${live}
      ${p.audio ? `<section class="ov-section"><h3>Listen to the trolls</h3><div class="players">${p.audio.map(a => `<div class="player" data-src="${a.src}" data-label="${esc(a.label)}"><button type="button"></button><b>${esc(a.label)}</b><canvas></canvas></div>`).join('')}</div></section>` : ''}
      ${p.howItWorks ? `<section class="ov-section"><h3>How it works</h3>${list(p.howItWorks)}</section>` : ''}
      ${p.contribution ? `<section class="ov-section"><h3>What I did</h3>${list(p.contribution)}</section>` : ''}
      ${p.process ? `<section class="ov-section"><h3>Process</h3>${list(p.process)}</section>` : ''}
      ${p.compare ? `<section class="ov-section newsletter-row"><div class="compare small" data-cursor="Drag" id="ov-compare"></div><div><h3>${esc(p.compare.label)}</h3><p class="hint">Drag the handle to compare the pencil sketches with the finished logo.</p></div></section>` : ''}
      ${p.gallery ? `<section class="ov-section"><h3>Gallery</h3><div class="ov-gallery">${tiles(p.gallery)}</div>${p.note ? `<p class="ov-note">${esc(p.note)}</p>` : ''}</section>` : ''}`;
  };

  const openProject = slug => {
    const p = PROJECTS.find(x => x.slug === slug);
    if (!p) return closeProject(true);
    lastFocus ??= document.activeElement;
    content.innerHTML = renderProject(p);
    overlay.hidden = false; document.body.style.overflow = 'hidden';
    $('.overlay-scroll', overlay).scrollTop = 0;
    requestAnimationFrame(() => overlay.classList.add('open'));
    if (p.gallery) wireTiles($('.ov-gallery', content), p.gallery);
    if (p.compare) mountCompare($('#ov-compare', content), p.compare);
    mountPlayers(content);
    $('[data-load-live]', content)?.addEventListener('click', e => {
      const ph = e.target.closest('.live-placeholder');
      ph.outerHTML = `<iframe src="${p.live}" title="${esc(p.title)} live" loading="lazy" allow="clipboard-write"></iframe>`;
    });
    document.title = `${p.title} · Robert Johannessen`;
    $('.overlay-close', overlay).focus();
  };
  const closeProject = replace => {
    document.dispatchEvent(new CustomEvent('stop-audio'));
    overlay.classList.remove('open'); document.body.style.overflow = '';
    setTimeout(() => { overlay.hidden = true; content.innerHTML = ''; }, 350);
    document.title = 'Robert Johannessen · Developer & Designer';
    if (replace && location.hash.startsWith('#/p/')) history.replaceState(null, '', location.pathname + location.search + '#work');
    lastFocus?.focus(); lastFocus = null;
  };
  // Projects opened by clicking a card add a history entry, so closing goes "back";
  // a project opened from a shared link has nothing to go back to, so it just closes.
  let openedInSession = false;
  const route = () => {
    const m = location.hash.match(/^#\/p\/([\w-]+)/);
    if (m) openProject(m[1]); else if (!overlay.hidden) closeProject();
  };
  addEventListener('hashchange', () => { openedInSession = location.hash.startsWith('#/p/'); route(); });
  $('.overlay-close', overlay).addEventListener('click', () => openedInSession ? history.back() : closeProject(true));
  overlay.addEventListener('click', e => { if (e.target.classList.contains('overlay-scroll')) $('.overlay-close', overlay).click(); });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!lb.hidden) closeLightbox();
    else if (!overlay.hidden) $('.overlay-close', overlay).click();
  });
  // Keep keyboard focus inside the open dialog
  addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const box = !lb.hidden ? lb : !overlay.hidden ? overlay : null;
    if (!box) return;
    const f = $$('a[href], button, input, iframe, [tabindex]:not([tabindex="-1"])', box).filter(x => x.offsetParent !== null);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f.at(-1).focus(); }
    else if (!e.shiftKey && document.activeElement === f.at(-1)) { e.preventDefault(); f[0].focus(); }
  });

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
  }), { rootMargin: '0px 0px -8% 0px', threshold: .08 });
  $$('.reveal').forEach((el, i) => { if (el.closest('.hero')) el.style.setProperty('--d', `${i * .08}s`); io.observe(el); });

  /* ---------- Nav: hide on scroll down, highlight current section ---------- */
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    $('.nav').classList.toggle('hide', y > lastY && y > 300);
    lastY = y;
  }, { passive: true });
  const navLinks = $$('.nav nav a');
  const navObserver = new IntersectionObserver(entries => entries.forEach(e => {
    if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === `#${e.target.id}`));
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['work', 'design', 'about', 'contact'].forEach(id => navObserver.observe(document.getElementById(id)));

  route();
})();
