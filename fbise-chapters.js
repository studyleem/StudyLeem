/* ── fbise-chapters.js: /fbise/notes/:class/:subject or /fbise/books/:class/:subject ── */

(function () {
  'use strict';

  function escHtml(t) {
    if (!t) return '';
    const d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  function mobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const menu = document.getElementById('mobileMenu');
    if (btn && menu) {
      btn.onclick = e => { e.stopPropagation(); menu.classList.toggle('active'); };
      document.onclick = e => { if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('active'); };
      menu.querySelectorAll('a').forEach(a => a.onclick = () => menu.classList.remove('active'));
    }
  }

  function parsePath() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // ['fbise', 'notes', '12', 'physics']  or  ['fbise', 'books', '12', 'chemistry']
    const type        = parts[1] || 'notes';
    const cls         = parts[2] || '12';
    const subjectSlug = parts[3] || '';
    return { type, cls, subjectSlug };
  }

  const classLabels = {
    '9':  'Class 9', '10': 'Class 10', '11': 'Class 11', '12': 'Class 12'
  };

  let allItems = [];
  let activeFilter = 'all';

  let curLabel = '';
  function setMeta(type, cls, subjectSlug, subjectName) {
    const typeLabel = curLabel || SLT.label(type);
    const clsLabel  = classLabels[cls] || `Class ${cls}`;
    const subLabel  = subjectName || subjectSlug.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
    const title = `${subLabel} ${type === 'books' ? 'Book' : type === 'notes' ? 'Notes' : typeLabel} Class ${cls} FBISE – Free PDF | StudyLeem`;
    const desc  = `Free FBISE ${subLabel} ${typeLabel.toLowerCase()} for ${clsLabel} (Federal Board Pakistan): chapter-wise PDF, plus a free LeemAI ${subLabel} quiz and AI tutor.`;

    document.getElementById('pageTitle').textContent    = title;
    document.getElementById('pageDesc').content         = desc;
    document.getElementById('pageKeywords').content     = `FBISE ${subLabel} ${typeLabel.toLowerCase()} class ${cls}, ${subLabel} ${typeLabel.toLowerCase()} FBISE, Federal Board ${cls} ${subLabel} PDF, free ${subLabel} notes Pakistan`;
    document.getElementById('pageCanonical').href       = `https://studyleem.vercel.app/fbise/${type}/${cls}/${subjectSlug}`;
    if (window.SEO) SEO.apply({
      title, description: desc, keywords: document.getElementById('pageKeywords').content, canonical: `/fbise/${type}/${cls}/${subjectSlug}`,
      breadcrumbs: [{ name: 'Home', url: '/' }, { name: 'FBISE', url: '/fbise' }, { name: `Class ${cls}`, url: `/fbise/${type}/${cls}` }, { name: subLabel, url: `/fbise/${type}/${cls}/${subjectSlug}` }],
      jsonld: [{ '@type': 'CollectionPage', name: `${subLabel} ${typeLabel} – ${clsLabel}`, description: desc, url: `https://studyleem.vercel.app/fbise/${type}/${cls}/${subjectSlug}`, about: subLabel, educationalLevel: clsLabel, inLanguage: 'en', isAccessibleForFree: true }]
    });
    document.getElementById('pageH1').textContent       = `${subLabel} – ${typeLabel} (${clsLabel})`;
    document.getElementById('pageSubtitle').textContent = type === 'books'
      ? `FBISE Federal Board complete textbook in PDF`
      : type === 'notes' ? `FBISE Federal Board chapter-wise notes in PDF` : `FBISE Federal Board ${typeLabel.toLowerCase()} in PDF`;
    document.getElementById('breadSubject').textContent = subLabel;

    const classLink = document.getElementById('breadClassLink');
    classLink.textContent = clsLabel;
    classLink.href        = `/fbise/${type}/${cls}`;
  }

  function renderItems(items) {
    const grid = document.getElementById('chaptersGrid');
    if (!items.length) {
      grid.innerHTML = '<p class="loading">No materials found for this filter.</p>';
      return;
    }

    const { type, cls, subjectSlug } = parsePath();

    const hasExercise = items.some(m => m.contentType === 'exercise');
    const hasChapter  = items.some(m => !m.contentType || m.contentType === 'chapter');

    const tabs = document.getElementById('filterTabs');
    if (hasExercise && hasChapter) {
      tabs.style.display = 'flex';
    }

    let display = items;
    if (activeFilter === 'chapter')  display = items.filter(m => !m.contentType || m.contentType === 'chapter');
    if (activeFilter === 'exercise') display = items.filter(m => m.contentType === 'exercise');

    display.sort(SLT.compareItems);   // chapter number, then exercise number (review last), then title

    // ── one card per item (old single textbooks keep their "Full Textbook" card) ──
    grid.innerHTML = display.map(m => {
      const href       = `/fbise/${type}/${cls}/${subjectSlug}/${SLT.itemSlug(m)}`;
      const legacyBook = SLT.isLegacyBook(m);
      const isEx       = m.type === 'notes' && m.contentType === 'exercise';
      const label      = SLT.itemLabel(m);
      const icon       = legacyBook ? ic('book-open') : isEx ? ic('calculator') : ic(type === 'notes' ? 'book' : SLT.icon(type));
      const cta        = legacyBook ? 'Read Book' : isEx ? 'Open Exercise' : type === 'notes' ? 'Notes + Exercise' : 'Open';
      const clip       = legacyBook ? 120 : 100;
      return `
        <a href="${href}" class="chapter-item${legacyBook ? ' book-item' : ''}${m.coverImage ? ' has-cover' : ''}" aria-label="${escHtml(label)}: ${escHtml(m.title)}">
          ${m.coverImage ? `<div class="chapter-thumb"><img src="${escHtml(m.coverImage)}" alt="" loading="lazy" onerror="this.parentNode.parentNode.classList.remove('has-cover');this.parentNode.remove()"></div>` : ''}
          <div class="chapter-body">
          <div class="chapter-num">${icon} ${escHtml(label)}</div>
          <div class="chapter-info">
            <h3 class="chapter-title">${escHtml(m.title)}</h3>
            ${m.description ? `<p class="chapter-desc">${escHtml(m.description.substring(0, clip))}${m.description.length > clip ? '…' : ''}</p>` : ''}
          </div>
          <span class="chapter-cta">${cta} ${ic('arrow-right')}</span>
          </div>
        </a>
      `;
    }).join('');
  }

  function setupFilter(items) {
    document.querySelectorAll('#filterTabs .tab-btn').forEach(btn => {
      btn.onclick = () => {
        document.querySelectorAll('#filterTabs .tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderItems(items);
      };
    });
  }


  // ── Study++-style information blocks under the chapter list (Quick Answer, features, steps, related, FAQ) ──
  async function renderInfo(type, cls, subjectName) {
    const box = document.getElementById('subjectInfo');
    if (!box) return;
    const { subjectSlug } = parsePath();
    const isBook = type === 'books', isNotes = type === 'notes', kind = isBook ? 'Book' : isNotes ? 'Notes' : (curLabel || SLT.label(type)), S = escHtml(subjectName), C = escHtml(cls);
    const box2 = (icon, h, p) => `<div class="sp-box">${ic(icon)}<h3>${h}</h3><p>${p}</p></div>`;
    const faq = [
      [`Are these ${S} ${kind.toLowerCase()} for the FBISE Federal Board?`, `Yes. This page is for Class ${C} ${S} students following the Federal Board (FBISE) syllabus in Pakistan. Always check the latest syllabus notification from your college or the board.`],
      ['Can I read the PDF online?', 'Yes. Open any item to read it inside the site with the built-in viewer. You can zoom, jump to a page and use fullscreen on mobile and desktop.'],
      ['Can I download the PDF?', 'Yes. Use the Download button on the viewer page. It starts after a short countdown.'],
      ['What is Ask LeemAI?', 'LeemAI is the built-in study assistant. While a PDF is open, it can summarize the page you are on, explain it in simple words, or answer your question about it. You get 4 free messages, then a 5-minute break, with no account needed.'],
      ['Are these materials enough for exam preparation?', 'They are meant to support your learning and revision. Read the official textbook as well, and practise with past papers and model papers.'],
      ['Is StudyLeem free?', 'Yes. All study materials on StudyLeem are free and need no registration.']
    ].map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('');

    box.innerHTML = `
      <h2>Quick Answer</h2>
      <div class="sp-quick">The <b>Class ${C} ${S} ${kind}</b> page gives FBISE students ${isBook ? 'the full textbook PDF' : isNotes ? 'chapter-wise study material' : escHtml(kind.toLowerCase()) + ' in PDF'} for ${S}. Open any item to read it online, download the PDF, or ask LeemAI to summarize the page you are reading.
        <div class="sp-chips"><span class="sp-chip2">Federal Board</span><span class="sp-chip2">Class ${C}</span><span class="sp-chip2">${S}</span><span class="sp-chip2">${isBook ? 'Full Textbook' : isNotes ? 'Chapter-Wise' : escHtml(kind)}</span><span class="sp-chip2">Free PDF</span><span class="sp-chip2">AI Summaries</span></div>
      </div>
      <h2>What you get</h2>
      <div class="sp-grid">
        ${box2('notes', isBook ? 'Complete textbook' : isNotes ? 'Chapter-wise notes' : escHtml(kind), isBook ? 'The whole book as one PDF, ready to read online.' : isNotes ? 'Each chapter is a separate PDF so you can jump straight to the topic you need.' : 'Each item is a separate PDF so you can open exactly what you need.')}
        ${box2('calculator', 'Exercise solutions', 'Where available, exercises are uploaded one by one so you can open the exact exercise.')}
        ${box2('eye', 'Online viewer', 'Read in your browser with zoom, page jump and fullscreen. No app needed.')}
        ${box2('sparkles', 'AI page summary', 'Ask LeemAI to summarize or explain the page you have open.')}
        ${box2('download', 'PDF download', 'Save the PDF to your phone or computer for offline revision.')}
        ${box2('check-circle', '100% free', 'No account, no payment. Just open and study.')}
      </div>
      <h2>How to prepare ${S}</h2>
      <ol class="sp-steps">
        <li><div><b>Read the textbook chapter first</b><span>Understand the topic, examples and diagrams before using notes.</span></div></li>
        <li><div><b>Revise with the notes</b><span>Use the chapter PDF for key definitions, formulas and short answers.</span></div></li>
        <li><div><b>Solve the exercises</b><span>Try each question yourself, then compare with the solved exercise.</span></div></li>
        <li><div><b>Use LeemAI for hard pages</b><span>Open a page you find difficult and ask for a summary or a simpler explanation.</span></div></li>
        <li><div><b>Practise past papers</b><span>Finish with model papers and past papers before your exams.</span></div></li>
      </ol>
      <div id="relatedBox"></div>
      <h2>Frequently Asked Questions</h2>
      <div class="sp-faq">${faq}</div>
      <p class="sp-notice"><b>Educational notice:</b> This content is provided for educational support only. It is not for sale or commercial use. StudyLeem does not claim ownership of any official government textbook material.</p>`;

    try {
      const all = await DB.getByClass(cls);
      const seen = {}, links = [];
      all.forEach(m => {
        const slug = m.subjectSlug || toSlug(m.subject || '');
        const k = m.type + slug;
        if (slug && !seen[k] && !(m.type === type && slug === subjectSlug)) { seen[k] = 1; links.push(`<a href="/fbise/${m.type || 'notes'}/${cls}/${slug}">Class ${C} ${escHtml(m.subject)} (${escHtml(SLT.badge(m))})</a>`); }
      });
      if (links.length) document.getElementById('relatedBox').innerHTML = `<h2>Related resources</h2><div class="sp-rel">${links.slice(0, 12).join('')}</div>`;
    } catch (e) { console.warn(e); }
  }

  async function loadChapters(type, cls, subjectSlug) {
    const grid = document.getElementById('chaptersGrid');
    try {
      grid.innerHTML = '<div class="loading">Loading...</div>';
      // For books, fetch without type filter first (books may be stored as type='books')
      allItems = await DB.getBySubjectSlug(cls, subjectSlug, type);

      if (!allItems.length) {
        grid.innerHTML = `<p class="loading">No ${type === 'books' ? 'books' : type === 'notes' ? 'chapters' : escHtml(SLT.label(type).toLowerCase())} uploaded yet for this subject. Check back soon!</p>`;
        return;
      }

      // Get real subject name from first item
      const subjectName = allItems[0].subject || subjectSlug;
      curLabel = SLT.label(type, allItems[0].typeLabel);
      setMeta(type, cls, subjectSlug, subjectName);
      renderInfo(type, cls, subjectName);

      if (type === 'notes') {
        const hasExercise = allItems.some(m => m.contentType === 'exercise');
        const hasChapter  = allItems.some(m => !m.contentType || m.contentType === 'chapter');
        if (hasExercise && hasChapter) {
          document.getElementById('filterTabs').style.display = 'flex';
          setupFilter(allItems);
        }
      }

      renderItems(allItems);
    } catch (err) {
      console.error(err);
      grid.innerHTML = '<p class="loading">Error loading. Please refresh.</p>';
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    mobileMenu();
    const { type, cls, subjectSlug } = parsePath();

    // Set initial placeholder meta
    setMeta(type, cls, subjectSlug, subjectSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));

    loadChapters(type, cls, subjectSlug);
  });
})();
