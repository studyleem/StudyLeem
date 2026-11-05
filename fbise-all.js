/* All classes for one material type: /fbise/notes and /fbise/books  (opened by "Click More" on the homepage) */
(function () {
  'use strict';
  const type = location.pathname.split('/').filter(Boolean)[1] === 'books' ? 'books' : 'notes';
  const T = type === 'books' ? 'Books' : 'Notes';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const MORE = ic('arrow-right');
  const LABEL = { '9': 'Class 9 \u2013 SSC Part 1', '10': 'Class 10 \u2013 SSC Part 2', '11': 'Class 11 \u2013 HSSC Part 1', '12': 'Class 12 \u2013 HSSC Part 2' };

  function setMeta() {
    document.getElementById('pageTitle').textContent = `FBISE ${T} Class 9, 10, 11, 12 \u2013 Free PDF | StudyLeem`;
    document.getElementById('pageDesc').content = `Free FBISE ${T.toLowerCase()} for Class 9, 10, 11 and 12 Federal Board Pakistan. Browse every subject by class.`;
    const kw = document.getElementById('pageKeywords'); if (kw) kw.content = `FBISE ${T.toLowerCase()}, Federal Board ${T.toLowerCase()} PDF, class 9 10 11 12 ${T.toLowerCase()}`;
    document.getElementById('pageCanonical').href = `https://studyleem.vercel.app/fbise/${type}`;
    document.getElementById('pageH1').textContent = `FBISE ${T} \u2013 Class 9 to 12`;
    document.getElementById('pageSubtitle').textContent = `Every subject we have uploaded, class by class. Open "Click More" to see the full list for a class.`;
    document.getElementById('breadClass').textContent = T;
    document.getElementById('typeSwitcher').innerHTML =
      `<a href="/fbise/notes" class="type-switch-btn ${type === 'notes' ? 'active' : ''}">${ic('notes')} Notes</a>` +
      `<a href="/fbise/books" class="type-switch-btn ${type === 'books' ? 'active' : ''}">${ic('book-open')} Books</a>`;
  }

  async function load() {
    const box = document.getElementById('classRows');
    try {
      const all = (await DB.getAll()).filter(m => m.type === type);
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
            ? `<div class="sp-row">${shown.map(s => spCard(`/fbise/${type}/${cls}/${s.slug}`, cls, s.name, type === 'books' ? 'FBISE Book' : 'FBISE Notes', s.cover)).join('')}</div>`
            : `<p class="sp-empty">No ${T.toLowerCase()} uploaded for Class ${cls} yet. Check back soon.</p>`}
        </div></section>`;
      });
      box.innerHTML = html;
    } catch (e) {
      console.error(e);
      box.innerHTML = '<div class="container"><p class="loading">Could not load materials. Please refresh.</p></div>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => { setMeta(); load(); });
})();
