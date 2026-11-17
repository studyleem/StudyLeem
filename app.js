/* ── app.js: Homepage logic ── */
document.addEventListener('DOMContentLoaded', () => {
  setupMobileMenu();
  setupSearch();
  loadData();
});

function setupMobileMenu() {
  const btn  = document.getElementById('mobileMenuBtn');
  const menu = document.getElementById('mobileMenu');
  if (btn && menu) {
    btn.onclick = e => { e.stopPropagation(); menu.classList.toggle('active'); };
    document.onclick = e => {
      if (!menu.contains(e.target) && !btn.contains(e.target)) menu.classList.remove('active');
    };
    menu.querySelectorAll('a').forEach(a => a.onclick = () => menu.classList.remove('active'));
  }
}

function setupSearch() {
  const input   = document.getElementById('searchInput');
  const btn     = document.getElementById('searchBtn');
  const results = document.getElementById('searchResults');
  if (!input || !btn) return;

  let allMaterials = [];
  let searchTimer;

  // Lazy-load materials for search
  async function ensureLoaded() {
    if (!allMaterials.length && typeof DB !== 'undefined') {
      allMaterials = await DB.getAll().catch(() => []);
    }
  }

  async function doSearch() {
    const q = input.value.trim().toLowerCase();
    if (!q || q.length < 2) { results.style.display = 'none'; return; }
    await ensureLoaded();
    const hits = allMaterials.filter(m =>
      (m.title && m.title.toLowerCase().includes(q)) ||
      (m.subject && m.subject.toLowerCase().includes(q)) ||
      (m.chapterTitle && m.chapterTitle.toLowerCase().includes(q))
    ).slice(0, 8);

    if (!hits.length) {
      results.innerHTML = '<div class="search-no-results">No results found.</div>';
      results.style.display = 'block';
      return;
    }

    results.innerHTML = hits.map(m => {
      const slug = m.subjectSlug || toSlug(m.subject || '');
      const href = `/fbise/${m.type === 'books' ? 'books' : 'notes'}/${m.class}/${slug}`;
      const icon = m.type === 'books' ? ic('book-open') : ic('notes');
      return `<a href="${href}" class="search-result-item">
        ${icon} <strong>${escHtml(m.title)}</strong>
        <span class="search-meta">Class ${m.class} · ${escHtml(m.subject)}</span>
      </a>`;
    }).join('');
    results.style.display = 'block';
  }

  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(doSearch, 250);
  });
  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !results.contains(e.target)) results.style.display = 'none';
  });
}

async function loadData() {
  if (typeof DB === 'undefined') {
    console.error('DB not ready');
    return;
  }
  try {
    const materials = await DB.getAll();
    loadLatestMaterials(materials);
    loadChapterLinks(materials);
    loadPopularSubjects(materials);
    updateStats(materials);
  } catch (err) {
    console.error('loadData error:', err);
  }
}

function loadLatestMaterials(materials) {
  const container = document.getElementById('latestMaterials');
  if (!container) return;
  const latest = materials.slice(0, 6);
  if (!latest.length) { container.innerHTML = '<p class="loading">No materials yet.</p>'; return; }

  container.innerHTML = latest.map(m => {
    const slug = m.subjectSlug || toSlug(m.subject || '');
    const href = `/fbise/${m.type === 'books' ? 'books' : 'notes'}/${m.class}/${slug}`;
    return `
    <a href="${href}" class="material-card">
      <div style="position:relative">
        <img src="${escHtml(m.coverImage)}" alt="${escHtml(m.title)}" class="material-cover"
          onerror="this.src='data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27208%27 height=%27300%27%3E%3Crect fill=%27%23f3f4f6%27 width=%27208%27 height=%27300%27/%3E%3Ctext x=%2750%25%27 y=%2750%25%27 text-anchor=%27middle%27 dy=%27.3em%27 fill=%27%239ca3af%27 font-family=%27Arial%27 font-size=%2714%27%3ENo Image%3C/text%3E%3C/svg%3E'"
          loading="lazy">
        <span class="material-type-badge">${m.type === 'books' ? ic('book-open') + ' Book' : ic('notes') + ' Notes'}</span>
      </div>
      <div class="material-content">
        <h3 class="material-title">${escHtml(m.title)}</h3>
        <div class="material-meta">
          <span>Class ${m.class}</span>
          <span>${escHtml(m.subject)}</span>
          ${m.chapterNumber ? `<span>Ch. ${m.chapterNumber}</span>` : ''}
        </div>
        <p class="material-description">${escHtml((m.description || '').substring(0, 80))}${(m.description||'').length > 80 ? '…' : ''}</p>
      </div>
    </a>`;
  }).join('');
}

function loadPopularSubjects(materials) {
  // two rows (notes / books): up to 6 subjects each, spread across classes 12 -> 9
  const fill = (id, type) => {
    const box = document.getElementById(id);
    if (!box) return;
    const map = {};
    materials.filter(m => m.type === type).forEach(m => {
      const slug = m.subjectSlug || toSlug(m.subject || '');
      const key = `${m.class}-${slug}`;
      if (!map[key]) map[key] = { class: String(m.class), subject: m.subject, slug, count: 0, cover: '' };
      map[key].count++;
      if (!map[key].cover && m.coverImage) map[key].cover = m.coverImage;   // newest upload with a cover
    });
    const byClass = {};
    Object.values(map).forEach(s => (byClass[s.class] = byClass[s.class] || []).push(s));
    Object.values(byClass).forEach(a => a.sort((x, y) => y.count - x.count));
    const order = ['9', '10', '11', '12'], picked = [];
    for (let round = 0; picked.length < 6 && round < 6; round++) {
      order.forEach(c => { if (picked.length < 6 && byClass[c] && byClass[c][round]) picked.push(byClass[c][round]); });
    }
    box.innerHTML = picked.length
      ? picked.map(s => spCard(`/fbise/${type}/${s.class}/${s.slug}`, s.class, s.subject, type === 'books' ? 'FBISE Book' : 'FBISE Notes', s.cover)).join('')
      : `<p class="loading">No ${type} yet.</p>`;
  };
  fill('notesRow', 'notes');
  fill('booksRow', 'books');
}

function updateStats(materials) {
  const stats = {
    total: materials.length,
    books: materials.filter(m => m.type === 'books').length,
    notes: materials.filter(m => m.type === 'notes').length
  };
  [['totalMaterials', stats.total], ['totalBooks', stats.books], ['totalNotes', stats.notes]]
    .forEach(([id, val]) => { const el = document.getElementById(id); if (el) el.textContent = val; });
}

function toSlug(str) {
  return String(str).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function escHtml(t) {
  if (!t) return '';
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}


/* SEO: crawlable links to every chapter page (reads the same materials already loaded) */
function loadChapterLinks(materials) {
  const box = document.getElementById('chapterLinks');
  if (!box) return;
  const seen = {}, byClass = { '9': [], '10': [], '11': [], '12': [] };
  materials.forEach(m => {
    if (m.type === 'books' || (m.contentType && m.contentType !== 'chapter') || !m.chapterNumber) return;
    const subj = m.subjectSlug || toSlug(m.subject || '');
    const slug = m.chapterSlug || `chapter-${m.chapterNumber}`;
    const href = `/fbise/notes/${m.class}/${subj}/${slug}`;
    if (seen[href] || !byClass[String(m.class)]) return;
    seen[href] = 1;
    byClass[String(m.class)].push({ href, subject: m.subject || subj, n: Number(m.chapterNumber) || 0 });
  });
  box.innerHTML = Object.keys(byClass).filter(c => byClass[c].length).map(c => {
    const items = byClass[c].sort((a, b) => a.subject.localeCompare(b.subject) || a.n - b.n);
    return `<div class="sl-ln-group"><h3>Class ${c} Chapter-wise Notes</h3><div class="sl-ln-links">` +
      items.map(i => `<a href="${i.href}">Class ${c} ${escHtml(i.subject)} Chapter ${i.n} Notes</a>`).join('') + '</div></div>';
  }).join('');
}
