/* All classes for one material type: /fbise/notes and /fbise/books  (opened by "Click More" on the homepage) */
(function () {
  'use strict';
  const type = (location.pathname.split('/').filter(Boolean)[1] || 'notes').toLowerCase();
  let T = type;                                  // set from SLT / the data once the page is ready (SLT loads with firebase-client.js)
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MORE = ic('arrow-right');
  const LABEL = { '9': 'Class 9 \u2013 SSC Part 1', '10': 'Class 10 \u2013 SSC Part 2', '11': 'Class 11 \u2013 HSSC Part 1', '12': 'Class 12 \u2013 HSSC Part 2' };

  function setMeta() {
    document.getElementById('pageTitle').textContent = `FBISE ${T} Class 9, 10, 11, 12 \u2013 Free PDF | StudyLeem`;
    document.getElementById('pageDesc').content = `Free FBISE ${T.toLowerCase()} for Class 9, 10, 11 and 12 Federal Board Pakistan. Browse every subject by class.`;
    const kw = document.getElementById('pageKeywords'); if (kw) kw.content = `FBISE ${T.toLowerCase()}, Federal Board ${T.toLowerCase()} PDF, class 9 10 11 12 ${T.toLowerCase()}`;
    document.getElementById('pageCanonical').href = `https://studyleem.vercel.app/fbise/${type}`;
    if (window.SEO) SEO.apply({
      title: document.getElementById('pageTitle').textContent, description: document.getElementById('pageDesc').content,
      keywords: document.getElementById('pageKeywords').content, canonical: `/fbise/${type}`,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'FBISE', url: '/fbise' }, { name: `FBISE ${T}`, url: `/fbise/${type}` }],
      jsonld: [{ '@type': 'CollectionPage', name: `FBISE ${T} for Class 9, 10, 11 and 12`, url: `https://studyleem.vercel.app/fbise/${type}`, isPartOf: { '@type': 'WebSite', name: 'StudyLeem', url: 'https://studyleem.vercel.app' }, inLanguage: 'en' }]
    });
    document.getElementById('pageH1').textContent = `FBISE ${T} \u2013 Class 9 to 12`;
    document.getElementById('pageSubtitle').textContent = `Every subject we have uploaded, class by class. Open "Click More" to see the full list for a class.`;
    document.getElementById('breadClass').textContent = T;
    drawSwitcher(typeList);
  }
  let typeList = [];
  function drawSwitcher(list) {
    document.getElementById('typeSwitcher').innerHTML = list.map(t =>
      `<a href="/fbise/${t.slug}" class="type-switch-btn ${t.slug === type ? 'active' : ''}">${ic(SLT.icon(t.slug))} ${esc(t.label)}</a>`).join('');
  }

  async function load() {
    const box = document.getElementById('classRows');
    try {
      const everything = await DB.getAll();
      typeList = SLT.typesFrom(everything, { always: true });
      if (!typeList.some(t => t.slug === type)) typeList.push({ slug: type, label: T, count: 0 });
      const found = typeList.find(t => t.slug === type); if (found) T = found.label;
      setMeta();
      const all = everything.filter(m => m.type === type);
      let html = '';
      ['9', '10', '11', '12'].forEach(cls => {
        const map = {};
        all.filter(m => String(m.class) === cls).forEach(m => {              // newest first
          const slug = m.subjectSlug || toSlug(m.subject || '');
          if (!map[slug]) map[slug] = { name: m.subject, slug, cover: '' };
          if (!map[slug].cover && m.coverImage) map[slug].cover = m.coverImage;
        });
        const subjects = Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
        const shown = subjects.slice(0, 6);
        html += `<section class="section" style="padding-block:1.4rem"><div class="container">
          <div class="sp-head"><h2>${esc(LABEL[cls])} ${T}</h2><a href="/fbise/${type}/${cls}" class="sp-more">Click More ${MORE}</a></div>
          ${shown.length
            ? `<div class="sp-row">${shown.map(s => spCard(SLT.hubHref(cls, s.slug), cls, s.name, SLT.tag(type, T), s.cover)).join('')}</div>`
            : `<p class="sp-empty">No ${T.toLowerCase()} uploaded for Class ${cls} yet. Check back soon.</p>`}
        </div></section>`;
      });
      box.innerHTML = html;
    } catch (e) {
      console.error(e);
      box.innerHTML = '<div class="container"><p class="loading">Could not load materials. Please refresh.</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => { T = SLT.label(type); typeList = SLT.typesFrom([], { always: true }); setMeta(); load(); });
})();
