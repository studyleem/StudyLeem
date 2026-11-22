// Dynamic sitemap: every subject page, chapter, exercise and book that exists in Firestore.
// Served at /sitemap-materials.xml (see vercel.json rewrite). New uploads appear automatically.
const PROJECT = 'studyleem0786';
const KEY = 'AIzaSyD3v1qSVW-DIuqLhJFRESjl903VjH55umA'; // public Firebase web key (same as firebase-client.js)
const SITE = 'https://studyleem.vercel.app';
const FIELDS = ['type', 'class', 'subject', 'subjectSlug', 'chapterSlug', 'contentType', 'chapterNumber', 'exerciseNumber', 'review', 'createdAt'];

const toSlug = s => String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const val = f => f ? (f.stringValue ?? f.integerValue ?? f.doubleValue ?? f.booleanValue ?? f.timestampValue ?? null) : null;

async function fetchAll() {
  const docs = []; let token = '';
  for (let i = 0; i < 30; i++) {
    const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/materials?pageSize=300&key=${KEY}` +
      FIELDS.map(f => '&mask.fieldPaths=' + f).join('') + (token ? '&pageToken=' + encodeURIComponent(token) : '');
    const r = await fetch(url, { headers: { Referer: SITE + '/' } });
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const j = await r.json();
    (j.documents || []).forEach(d => docs.push({ id: d.name.split('/').pop(), f: d.fields || {} }));
    if (!j.nextPageToken) break;
    token = j.nextPageToken;
  }
  return docs;
}

module.exports = async (req, res) => {
  try {
    const docs = await fetchAll();
    const urls = new Map(); // loc -> {lastmod, pri, freq}
    const add = (path, lastmod, pri, freq) => { const loc = SITE + path; const o = urls.get(loc); if (!o || (lastmod && lastmod > (o.lastmod || ''))) urls.set(loc, { lastmod: lastmod || (o && o.lastmod) || '', pri, freq }); };

    for (const { id, f } of docs) {
      const type = val(f.type) === 'books' ? 'books' : 'notes';
      const cls = String(val(f.class) || '');
      if (!['9', '10', '11', '12'].includes(cls)) continue;
      const subject = val(f.subject), slug = val(f.subjectSlug) || toSlug(subject);
      if (!slug) continue;
      const created = val(f.createdAt); const lastmod = created ? String(created).slice(0, 10) : '';
      add(`/fbise/${type}/${cls}/${slug}`, lastmod, '0.8', 'weekly');

      let chSlug = val(f.chapterSlug);
      if (type === 'books') chSlug = 'book-' + id;
      else if (!chSlug) {
        const n = val(f.chapterNumber);
        if (n != null && val(f.contentType) === 'exercise') chSlug = val(f.review) ? `review-exercise-${n}` : `exercise-${n}${val(f.exerciseNumber) ? '-' + val(f.exerciseNumber) : ''}`;
        else if (n != null) chSlug = `chapter-${n}`;
      }
      if (chSlug) add(`/fbise/${type}/${cls}/${slug}/${chSlug}`, lastmod, '0.7', 'monthly');
    }

    const body = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      [...urls].map(([loc, o]) => `  <url><loc>${esc(loc)}</loc>${o.lastmod ? `<lastmod>${o.lastmod}</lastmod>` : ''}<changefreq>${o.freq}</changefreq><priority>${o.pri}</priority></url>`).join('\n') + '\n</urlset>\n';
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(body);
  } catch (e) {
    console.error('sitemap-materials', e && e.message);
    // empty but valid sitemap so Search Console does not report a hard error
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300');
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
  }
};
