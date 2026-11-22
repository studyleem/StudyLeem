// Dynamic sitemap of published blog posts, served at /sitemap-blog.xml (see vercel.json rewrite).
const PROJECT = 'studyleem0786';
const KEY = 'AIzaSyD3v1qSVW-DIuqLhJFRESjl903VjH55umA'; // public Firebase web key (same as firebase-client.js)
const SITE = 'https://studyleem.vercel.app';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
  try {
    const r = await fetch(`https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery?key=${KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Referer: SITE + '/' },
      body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'blogPosts' }], limit: 500,
        where: { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'published' } } } } })
    });
    if (!r.ok) throw new Error('Firestore ' + r.status);
    const rows = (await r.json()).filter(x => x.document);
    const urls = rows.map(x => {
      const f = x.document.fields || {}, slug = x.document.name.split('/').pop();
      const ts = (f.updatedAt && f.updatedAt.timestampValue) || (f.publishedAt && f.publishedAt.timestampValue) || '';
      return `  <url><loc>${esc(SITE + '/blog/' + slug)}</loc>${ts ? `<lastmod>${ts.slice(0, 10)}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.6</priority></url>`;
    });
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.join('\n') + '\n</urlset>\n');
  } catch (e) {
    console.error('sitemap-blog', e && e.message);
    return res.status(200).send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n');
  }
};
