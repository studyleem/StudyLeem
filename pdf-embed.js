/* StudyLeem Pro PDF viewer — in-page, works with Mega, Google Drive, OneDrive, Dropbox and direct links.
   Includes page navigation, zoom, fullscreen and "Ask LeemAI" (summary / questions about the open page).
   API: StudyPDF.mount(el, url, {title}) · openModal(title, url) · download(url, title) · withTimer(btn, sec, fn)
        isMega(url) · downloadUrl(url)                                                                         */
(function () {
  'use strict';
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const icon = n => (window.ic ? window.ic(n) : '');
  if (!window.LeemLimit) { const s = document.createElement('script'); s.src = '/leem-limit.js'; document.head.appendChild(s); }

  /* ── styles ── */
  const css = document.createElement('style');
  css.textContent = `
  .sp-host{position:absolute;inset:0;background:#1e1e2e;display:flex;flex-direction:column;min-height:300px;overflow:hidden}
  .sp-host:fullscreen{position:fixed}
  .sp-stage{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
  .sp-bar{display:flex;align-items:center;gap:.4rem;padding:.4rem .7rem;background:#0f172a;color:#e5e7eb;font:500 .82rem Inter,system-ui,sans-serif;flex-wrap:wrap;border-bottom:1px solid rgba(255,255,255,.08)}
  .sp-bar .sp-sp{flex:1}.sp-sep{width:1px;height:20px;background:rgba(255,255,255,.15);margin:0 .2rem}
  .sp-btn{display:inline-flex;align-items:center;gap:.35rem;background:rgba(255,255,255,.09);color:#fff;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:.28rem .6rem;cursor:pointer;font:600 .82rem Inter,sans-serif}
  .sp-btn:hover{background:rgba(255,255,255,.2)}.sp-btn:disabled{opacity:.4;cursor:default}
  .sp-ai-btn{background:linear-gradient(135deg,#f97316,#ea580c);border-color:transparent}.sp-ai-btn:hover{background:linear-gradient(135deg,#fb923c,#f97316)}
  .sp-pg{width:46px;text-align:center;background:#1e293b;color:#fff;border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:.2rem;font:600 .82rem Inter,sans-serif}
  .sp-zl{min-width:44px;text-align:center}
  .sp-scroll{flex:1;overflow:auto;padding:12px;-webkit-overflow-scrolling:touch}
  .sp-page{margin:0 auto 12px;background:#fff;box-shadow:0 4px 16px rgba(0,0,0,.4);position:relative}
  .sp-page canvas{display:block;max-width:none}
  .sp-iframe{flex:1;width:100%;border:0;background:#fff}
  .sp-ovl{position:absolute;top:0;right:0;width:70px;height:62px;z-index:3}
  .sp-fab{position:absolute;left:12px;bottom:14px;z-index:5;box-shadow:0 6px 18px rgba(0,0,0,.35)}
  .sp-msg{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.7rem;color:#cbd5e1;text-align:center;padding:1.5rem;font:500 .95rem Inter,sans-serif;z-index:4;background:#1e1e2e}
  .sp-msg h3{margin:0;color:#fff;font:600 1.15rem Poppins,Inter,sans-serif}
  .sp-msg button{background:#2563eb;color:#fff;border:0;border-radius:10px;padding:.6rem 1.2rem;font:600 .9rem Inter,sans-serif;cursor:pointer}
  .sp-spin{width:42px;height:42px;border:4px solid rgba(255,255,255,.2);border-top-color:#60a5fa;border-radius:50%;animation:sp-r 1s linear infinite}
  @keyframes sp-r{to{transform:rotate(360deg)}}
  /* AI panel */
  .sp-ai{position:absolute;top:0;right:0;bottom:0;width:min(400px,100%);z-index:8;background:#fff;color:#0f172a;display:none;flex-direction:column;box-shadow:-8px 0 30px rgba(0,0,0,.35);font-family:Inter,system-ui,sans-serif}
  .sp-ai.open{display:flex}
  .sp-ai-h{display:flex;align-items:center;gap:.5rem;padding:.7rem .9rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff}
  .sp-ai-h b{flex:1;font:600 1rem Poppins,Inter,sans-serif;display:flex;align-items:center;gap:.4rem}
  .sp-ai-h button{background:rgba(255,255,255,.18);border:0;color:#fff;border-radius:8px;padding:.3rem .5rem;cursor:pointer;display:inline-flex}
  .sp-ai-msgs{flex:1;overflow:auto;padding:.9rem;display:flex;flex-direction:column;gap:.7rem;background:#f8fafc}
  .sp-b{max-width:92%;padding:.6rem .8rem;border-radius:14px;font-size:.88rem;line-height:1.55;word-wrap:break-word}
  .sp-b p{margin:.25rem 0}.sp-b ul,.sp-b ol{margin:.3rem 0;padding-left:1.2rem}
  .sp-b.u{align-self:flex-end;background:#2563eb;color:#fff;border-bottom-right-radius:4px}
  .sp-b.a{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;border-bottom-left-radius:4px}
  .sp-b.e{align-self:flex-start;background:#fef2f2;border:1px solid #fecaca;color:#b91c1c}
  .sp-hi{color:#64748b;font-size:.85rem;text-align:center;padding:.5rem}
  .sp-chips{display:flex;gap:.4rem;flex-wrap:wrap;padding:.5rem .9rem 0;background:#fff;border-top:1px solid #e2e8f0}
  .sp-chip{background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe;border-radius:999px;padding:.3rem .7rem;font:600 .76rem Inter,sans-serif;cursor:pointer}
  .sp-chip:hover:not(:disabled){background:#dbeafe}.sp-chip:disabled{opacity:.45;cursor:not-allowed}
  .sp-note{padding:.35rem .9rem 0;font-size:.74rem;color:#64748b;background:#fff}.sp-note.sl-locked{color:#b45309;font-weight:600}
  .sp-in{display:flex;gap:.5rem;padding:.55rem .9rem .8rem;background:#fff}
  .sp-in textarea{flex:1;resize:none;border:1.5px solid #e2e8f0;border-radius:12px;padding:.55rem .7rem;font:400 .88rem Inter,sans-serif;max-height:90px}
  .sp-in textarea:focus{outline:0;border-color:#2563eb;box-shadow:0 0 0 3px rgba(37,99,235,.15)}
  .sp-in button{background:#2563eb;color:#fff;border:0;border-radius:12px;width:44px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center}
  .sp-in button:disabled,.sp-in textarea:disabled{opacity:.5;cursor:not-allowed}
  @media(max-width:700px){.sp-ai{top:auto;height:74%;width:100%;border-radius:18px 18px 0 0}.sp-bar{gap:.3rem;padding:.35rem .5rem}.sp-hide-m{display:none}}
  .sp-modal{position:fixed;inset:0;z-index:9999;background:#0f172a;display:flex;flex-direction:column}
  .sp-mhead{display:flex;align-items:center;gap:.75rem;padding:.7rem 1rem;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff}
  .sp-mhead b{flex:1;font:600 1rem Poppins,Inter,sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .sp-mbtn{display:inline-flex;align-items:center;gap:.4rem;background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.3);border-radius:10px;padding:.45rem .9rem;font:600 .85rem Inter,sans-serif;cursor:pointer}
  .sp-mbtn:hover:not(:disabled){background:rgba(255,255,255,.28)}.sp-mbtn:disabled{opacity:.85;cursor:wait}
  .sp-mbody{position:relative;flex:1;min-height:0}`;
  document.head.appendChild(css);

  const el = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  /* ── url helpers ── */
  function megaInfo(url) {
    if (!url || !/mega\.(nz|co\.nz)/i.test(url)) return null;
    const m = url.match(/\/(?:file|embed)\/([\w-]+)#([\w-]+)/i) || url.match(/#!([\w-]+)!([\w-]+)/);
    return m ? { id: m[1], key: m[2] } : null;
  }
  const isMega = u => /mega\.(nz|co\.nz)/i.test(u || '');
  function driveId(url) {
    if (!/drive\.google\.com|docs\.google\.com/i.test(url)) return null;
    const m = url.match(/\/file\/d\/([\w-]+)/) || url.match(/[?&]id=([\w-]+)/) || url.match(/\/d\/([\w-]+)/);
    return m ? m[1] : null;
  }
  function directUrl(url) {
    try {
      const u = new URL(url);
      if (/(^|\.)dropbox\.com$/.test(u.hostname)) { u.hostname = 'dl.dropboxusercontent.com'; u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); return u.toString(); }
      if (u.hostname === 'github.com') return url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
    } catch (_) {}
    return url;
  }
  function downloadUrl(url) {
    const id = driveId(url);
    if (id) return `https://drive.google.com/uc?export=download&id=${id}`;
    if (/dropbox\.com/i.test(url)) { try { const u = new URL(url); u.searchParams.set('dl', '1'); return u.toString(); } catch (_) {} }
    return url;
  }
  const b64urlStr = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  /* ── Mega: fetch encrypted file and decrypt in the browser ── */
  const megaCache = {};
  const b64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return Uint8Array.from(atob(s), c => c.charCodeAt(0)); };
  function megaBytes(url) {
    if (megaCache[url]) return megaCache[url];
    return (megaCache[url] = (async () => {
      const info = megaInfo(url);
      if (!info) throw new Error('Unsupported Mega link (use a file link, not a folder)');
      const r = await fetch('https://g.api.mega.co.nz/cs?id=' + Math.floor(Math.random() * 1e9), { method: 'POST', body: JSON.stringify([{ a: 'g', g: 1, ssl: 1, p: info.id }]) });
      const j = await r.json(); const o = Array.isArray(j) ? j[0] : j;
      if (typeof o === 'number') throw new Error(o === -9 || o === -8 ? 'File not found on Mega' : o === -16 ? 'File was removed from Mega' : o === -17 ? 'Mega download limit reached, try again later' : 'Mega error ' + o);
      if (!o || !o.g) throw new Error('Mega did not return a download link');
      const enc = await (await fetch(o.g)).arrayBuffer();
      const k = b64u(info.key); if (k.length < 32) throw new Error('Invalid Mega key in link');
      const aes = new Uint8Array(16); for (let i = 0; i < 16; i++) aes[i] = k[i] ^ k[i + 16];
      const iv = new Uint8Array(16); iv.set(k.slice(16, 24));
      const ck = await crypto.subtle.importKey('raw', aes, 'AES-CTR', false, ['decrypt']);
      return await crypto.subtle.decrypt({ name: 'AES-CTR', counter: iv, length: 64 }, ck, enc);
    })().catch(e => { delete megaCache[url]; throw e; }));
  }
  async function fetchPdfBytes(url) {
    const r = await fetch(url, { mode: 'cors', credentials: 'omit' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const buf = await r.arrayBuffer();
    if (String.fromCharCode(...new Uint8Array(buf.slice(0, 1024))).indexOf('%PDF') < 0) throw new Error('Not a PDF');
    return buf;
  }
  const viaProxy = u => '/api/pdf-proxy?url=' + encodeURIComponent(u);

  /* ── pdf.js ── */
  let pdfjsP;
  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve();
    return pdfjsP || (pdfjsP = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = PDFJS;
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER; res(); };
      s.onerror = () => { pdfjsP = null; rej(new Error('Could not load the PDF engine')); };
      document.head.appendChild(s);
    }));
  }

  /* ── AI panel ── */
  function fmt(text) {
    const lines = esc(text).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').split('\n'); let out = '', list = null;
    const close = () => { if (list) { out += `</${list}>`; list = null; } };
    for (const l of lines) {
      let m;
      if ((m = l.match(/^\s*[-*•]\s+(.*)/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += `<li>${m[1]}</li>`; }
      else if ((m = l.match(/^\s*\d+[.)]\s+(.*)/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += `<li>${m[1]}</li>`; }
      else { close(); if (l.trim()) out += `<p>${l}</p>`; }
    }
    close(); return out;
  }
  function aiPanel(host, o) {   // o: {capture:()=>Promise<{page,image,text}>|null, title:()=>string, canRead:boolean}
    const p = el('div', 'sp-ai'); p.setAttribute('role', 'dialog'); p.setAttribute('aria-label', 'Ask LeemAI');
    p.innerHTML = `<div class="sp-ai-h"><b>${icon('sparkles')} Ask LeemAI</b><button type="button" class="sp-x" aria-label="Close">${icon('x')}</button></div>
      <div class="sp-ai-msgs"></div><div class="sp-chips"></div><div class="sp-note"></div>
      <div class="sp-in"><textarea rows="1" maxlength="600" placeholder="Ask about this page…"></textarea><button type="button" class="sp-send" aria-label="Send">${icon('send')}</button></div>`;
    host.appendChild(p);
    const msgs = p.querySelector('.sp-ai-msgs'), chips = p.querySelector('.sp-chips'), note = p.querySelector('.sp-note'), ta = p.querySelector('textarea'), send = p.querySelector('.sp-send');
    const add = (cls, html) => { const d = el('div', 'sp-b ' + cls, html); msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d; };
    msgs.appendChild(el('div', 'sp-hi', o.canRead
      ? 'Open any page, then tap <b>Summarize this page</b> or ask a question about it.'
      : 'This link type opens in a basic viewer, so LeemAI cannot see the page. You can still ask a study question.'));
    let busy = false, locked = false;
    const setDisabled = () => { const d = busy || locked; ta.disabled = d; send.disabled = d; chips.querySelectorAll('button').forEach(b => b.disabled = d); };
    const CH = o.canRead ? [['summary', 'Summarize this page'], ['simple', 'Explain simply'], ['exam', 'Key points & exam Qs']] : [];
    CH.forEach(([m, t]) => { const b = el('button', 'sp-chip', t); b.type = 'button'; b.onclick = () => ask(m, ''); chips.appendChild(b); });
    if (!CH.length) chips.style.display = 'none';
    const lim = () => window.LeemLimit;
    let ln = null;
    const startNote = () => { if (ln || !lim()) return; ln = lim().note(note, st => { locked = st.locked; setDisabled(); }); };

    async function ask(mode, q) {
      if (busy) return; startNote();
      if (!lim()) { add('e', 'Loading… please try again in a second.'); return; }
      const st = lim().status();
      if (st.locked) { add('e', `You have used your free messages. Please wait ${lim().fmt(st.wait)} and try again.`); return; }
      if (mode === 'ask' && !q.trim()) return;
      if (!lim().consume()) return;
      busy = true; setDisabled(); ln && ln.refresh();
      let cap = null; if (o.capture && o.canRead) { try { cap = await o.capture(); } catch (e) { console.warn(e); } }
      const label = { summary: 'Summarize this page', simple: 'Explain this page simply', exam: 'Key points & exam questions' }[mode] || q;
      add('u', esc(label) + (cap && cap.page && mode !== 'ask' ? ` <small>(page ${cap.page})</small>` : ''));
      const typing = add('a', '<i>LeemAI is reading…</i>');
      try {
        const r = await fetch('/api/pdf-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode, question: q, title: o.title(), page: cap && cap.page, image: cap && cap.image, pageText: cap && cap.text }) });
        const d = await r.json().catch(() => null);
        if (!r.ok || !d) throw new Error((d && d.detail) || (r.status === 404 ? 'AI for PDFs is not deployed yet (api/pdf-ai.js is missing).' : 'LeemAI server error (' + r.status + ').'));
        typing.innerHTML = fmt(d.answer);
      } catch (e) {
        lim().refund(); typing.className = 'sp-b e'; typing.textContent = e.message || 'Could not reach LeemAI.';
      }
      busy = false; setDisabled(); ln && ln.refresh(); msgs.scrollTop = msgs.scrollHeight;
    }
    const submit = () => { const q = ta.value.trim(); if (!q) return; ta.value = ''; ta.style.height = 'auto'; ask('ask', q); };
    send.onclick = submit;
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = Math.min(90, ta.scrollHeight) + 'px'; });
    p.querySelector('.sp-x').onclick = () => p.classList.remove('open');
    return { toggle() { p.classList.toggle('open'); if (p.classList.contains('open')) { startNote(); setTimeout(() => ta.focus(), 50); } }, el: p };
  }

  /* ── pdf.js renderer with pro toolbar ── */
  async function renderPdf(host, stage, buf, ctx) {
    await loadPdfJs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
    const bar = el('div', 'sp-bar'), scroll = el('div', 'sp-scroll');
    const btn = (h, f, c, t) => { const b = el('button', 'sp-btn' + (c ? ' ' + c : ''), h); b.type = 'button'; if (t) b.title = t; b.onclick = f; return b; };
    const pg = el('input', 'sp-pg'); pg.type = 'text'; pg.inputMode = 'numeric'; pg.value = '1'; pg.setAttribute('aria-label', 'Page number');
    const total = el('span', '', ' / ' + pdf.numPages), zl = el('span', 'sp-zl', '100%');
    const prev = btn(icon('chevron-left'), () => go(cur - 1), '', 'Previous page'), next = btn(icon('chevron-right'), () => go(cur + 1), '', 'Next page');
    const ai = aiPanel(host, { canRead: true, title: () => (typeof ctx.title === 'function' ? ctx.title() : ctx.title) || 'PDF',
      capture: () => capture() });
    bar.append(prev, pg, total, next, el('span', 'sp-sep'),
      btn(icon('minus'), () => setZoom(zoom - .15), '', 'Zoom out'), zl, btn(icon('plus'), () => setZoom(zoom + .15), '', 'Zoom in'),
      btn(icon('columns') + '<span class="sp-hide-m"> Fit width</span>', () => setZoom(1), '', 'Fit width'),
      btn(icon('file') + '<span class="sp-hide-m"> Fit page</span>', () => fitPage(), '', 'Fit page'),
      btn(icon('maximize'), () => fullscreen(), '', 'Fullscreen'),
      el('span', 'sp-sp'),
      btn(icon('sparkles') + ' Ask LeemAI', () => ai.toggle(), 'sp-ai-btn', 'Summaries and questions about this page'));
    stage.append(bar, scroll);

    let zoom = 1, cur = 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const first = await pdf.getPage(1), fv = first.getViewport({ scale: 1 }), ratio = fv.height / fv.width;
    const holders = [], done = new Set();
    for (let i = 1; i <= pdf.numPages; i++) { const h = el('div', 'sp-page'); h.dataset.n = i; scroll.appendChild(h); holders.push(h); }
    const width = () => Math.max(260, scroll.clientWidth - 24) * zoom;
    const size = () => holders.forEach(h => { h.style.width = width() + 'px'; h.style.height = (width() * ratio) + 'px'; });
    async function draw(n) {
      if (done.has(n)) return; done.add(n);
      const page = await pdf.getPage(n), base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: (width() / base.width) * dpr });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      c.style.width = vp.width / dpr + 'px'; c.style.height = vp.height / dpr + 'px'; c.oncontextmenu = e => e.preventDefault();
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const h = holders[n - 1]; h.style.height = c.style.height; h.replaceChildren(c);
    }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) draw(+e.target.dataset.n); }), { root: scroll, rootMargin: '800px 0px' });
    function setZoom(z) {
      const keep = cur; zoom = Math.min(3, Math.max(.4, z)); zl.textContent = Math.round(zoom * 100) + '%';
      done.clear(); holders.forEach(h => h.replaceChildren()); size();
      holders.forEach(h => { io.unobserve(h); io.observe(h); }); go(keep, true);
    }
    function fitPage() { const w = scroll.clientWidth - 24, h = scroll.clientHeight - 24; setZoom(Math.min(1, (h / ratio) / w)); }
    function go(n, instant) { n = Math.min(pdf.numPages, Math.max(1, n || 1)); cur = n; pg.value = n; holders[n - 1] && scroll.scrollTo({ top: holders[n - 1].offsetTop - 12, behavior: instant ? 'auto' : 'smooth' }); }
    function fullscreen() { const d = document; if (d.fullscreenElement) d.exitFullscreen(); else (host.requestFullscreen || host.webkitRequestFullscreen || (() => {})).call(host); }
    pg.addEventListener('change', () => go(parseInt(pg.value, 10) || cur));
    pg.addEventListener('keydown', e => { e.stopPropagation(); });
    scroll.addEventListener('scroll', () => {
      const mid = scroll.scrollTop + scroll.clientHeight / 3; let c = 1;
      for (const h of holders) { if (h.offsetTop <= mid) c = +h.dataset.n; else break; }
      if (c !== cur) { cur = c; if (document.activeElement !== pg) pg.value = c; }
    }, { passive: true });
    let rt; const onResize = () => { clearTimeout(rt); rt = setTimeout(() => setZoom(zoom), 250); };
    window.addEventListener('resize', onResize); (host._sp_clean = host._sp_clean || []).push(() => window.removeEventListener('resize', onResize));
    async function capture() {          // current page -> JPEG (+ text) for LeemAI
      const page = await pdf.getPage(cur), base = page.getViewport({ scale: 1 });
      const vp = page.getViewport({ scale: Math.min(2.2, 1200 / base.width) });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      let text = ''; try { text = (await page.getTextContent()).items.map(i => i.str).join(' ').replace(/\s+/g, ' ').trim(); } catch (_) {}
      return { page: cur, image: c.toDataURL('image/jpeg', 0.72).split(',')[1], text };
    }
    size(); holders.forEach(h => io.observe(h));
  }

  /* ── strategy plan (bytes first so every link gets the full viewer + AI; iframes are last resorts) ── */
  function plan(url) {
    if (isMega(url)) {
      const m = megaInfo(url), p = [{ t: 'mega' }];
      if (m) p.push({ t: 'iframe', url: `https://mega.nz/embed/${m.id}#${m.key}`, wait: 25000 });
      return p;
    }
    const id = driveId(url);
    if (id) {
      const dl = `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
      return [{ t: 'fetch', url: viaProxy(dl) },
        { t: 'iframe', url: `https://drive.google.com/file/d/${id}/preview`, drive: true, wait: 12000 },
        { t: 'iframe', url: `https://docs.google.com/viewer?url=${encodeURIComponent('https://drive.google.com/uc?export=download&id=' + id)}&embedded=true`, wait: 15000 }];
    }
    if (/1drv\.ms|onedrive\.live\.com|onedrive\.com/i.test(url)) {
      return [{ t: 'fetch', url: viaProxy('https://api.onedrive.com/v1.0/shares/u!' + b64urlStr(url) + '/root/content') },
        { t: 'iframe', url, wait: 15000 }];
    }
    if (/sharepoint\.com/i.test(url)) {
      return [{ t: 'fetch', url: viaProxy(url + (url.includes('?') ? '&' : '?') + 'download=1') }, { t: 'iframe', url, wait: 15000 }];
    }
    const d = directUrl(url);
    return [{ t: 'fetch', url: d }, { t: 'fetch', url: viaProxy(d) },
      { t: 'iframe', url: `https://docs.google.com/viewer?url=${encodeURIComponent(d)}&embedded=true`, wait: 15000 },
      { t: 'iframe', url: d, wait: 15000 }];
  }

  function mount(host, url, opts) {
    opts = opts || {};
    (host._sp_clean || []).forEach(f => f()); host._sp_clean = [];
    host.innerHTML = ''; host.classList.add('sp-host');
    const stage = el('div', 'sp-stage'); host.appendChild(stage);
    const loading = el('div', 'sp-msg', '<div class="sp-spin"></div><div id="spTxt">Loading PDF…</div>');
    const txt = loading.querySelector('#spTxt'); let alive = true;
    const title = () => (typeof opts.title === 'function' ? opts.title() : opts.title) || 'PDF';
    const fail = why => {
      stage.innerHTML = '';
      const m = el('div', 'sp-msg', `<h3>This PDF could not be displayed</h3><div>${why ? esc(why) + '. ' : ''}Please use the Download button.</div>`);
      const b = el('button', '', 'Try again'); b.type = 'button'; b.onclick = () => mount(host, url, opts);
      m.appendChild(b); stage.appendChild(m);
    };
    if (!url) { fail('No PDF link'); return; }
    stage.appendChild(loading);

    (async () => {
      let lastErr = '';
      for (const s of plan(url)) {
        if (!alive) return;
        try {
          if (s.t === 'mega' || s.t === 'fetch') {
            txt.textContent = s.t === 'mega' ? 'Fetching from Mega…' : 'Loading PDF…';
            const buf = s.t === 'mega' ? await megaBytes(url) : await fetchPdfBytes(s.url);
            stage.innerHTML = ''; await renderPdf(host, stage, buf, { title }); return;
          }
          txt.textContent = 'Loading PDF…';
          await new Promise((res, rej) => {
            const f = el('iframe', 'sp-iframe'); f.title = 'PDF Viewer'; f.allowFullscreen = true; f.style.visibility = 'hidden';
            const t = setTimeout(() => { f.remove(); rej(new Error('timeout')); }, s.wait || 15000);
            f.onload = () => {
              clearTimeout(t); f.style.visibility = 'visible'; loading.remove(); if (s.drive) stage.appendChild(el('div', 'sp-ovl'));
              const ai = aiPanel(host, { canRead: false, title });
              const fab = el('button', 'sp-btn sp-ai-btn sp-fab', icon('sparkles') + ' Ask LeemAI'); fab.type = 'button'; fab.onclick = () => ai.toggle(); host.appendChild(fab);
              res();
            };
            f.onerror = () => { clearTimeout(t); f.remove(); rej(new Error('blocked')); };
            stage.insertBefore(f, loading); f.src = s.url;
          });
          return;
        } catch (e) { lastErr = e.message; console.warn('PDF strategy failed:', s.t, e); stage.querySelectorAll('iframe,.sp-ovl,.sp-bar,.sp-scroll').forEach(n => n.remove()); host.querySelectorAll('.sp-ai,.sp-fab').forEach(n => n.remove()); }
      }
      fail(lastErr);
    })();
    return { destroy() { alive = false; (host._sp_clean || []).forEach(f => f()); host._sp_clean = []; } };
  }

  /* ── download ── */
  async function download(url, title) {
    if (isMega(url) && megaInfo(url)) {
      const buf = await megaBytes(url), a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
      a.download = (String(title || 'StudyLeem-notes').replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'StudyLeem-notes') + '.pdf';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return;
    }
    const a = document.createElement('a'); a.href = downloadUrl(url); a.target = '_blank'; a.rel = 'noopener'; a.download = '';
    document.body.appendChild(a); a.click(); a.remove();
  }
  function withTimer(btn, seconds, fn) {
    if (btn._busy) return; btn._busy = true;
    const html = btn.innerHTML; btn.disabled = true; let left = seconds;
    const tick = () => {
      if (left > 0) { btn.textContent = `Download in ${left}s`; left--; setTimeout(tick, 1000); }
      else { btn.textContent = 'Starting…'; Promise.resolve().then(fn).catch(e => alert(e.message || 'Download failed')).finally(() => { btn.innerHTML = html; btn.disabled = false; btn._busy = false; }); }
    };
    tick();
  }

  /* ── in-page modal ── */
  function openModal(title, url) {
    if (!url) { alert('PDF link not available for this material.'); return; }
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const m = el('div', 'sp-modal'); m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true');
    const head = el('div', 'sp-mhead'), t = el('b'); t.textContent = title || 'PDF';
    const dl = el('button', 'sp-mbtn', icon('download') + ' Download'); dl.type = 'button';
    dl.onclick = () => withTimer(dl, 15, () => download(url, title));
    const x = el('button', 'sp-mbtn', icon('x') + ' Close'); x.type = 'button';
    head.append(t, dl, x);
    const body = el('div', 'sp-mbody'); m.append(head, body); document.body.appendChild(m);
    const h = mount(body, url, { title });
    const close = () => { h && h.destroy(); m.remove(); document.body.style.overflow = prev; document.removeEventListener('keydown', onKey); };
    const onKey = e => { if (e.key === 'Escape' && !document.fullscreenElement) close(); };
    x.onclick = close; document.addEventListener('keydown', onKey);
  }

  window.StudyPDF = { mount, openModal, download, withTimer, isMega, downloadUrl };
})();
