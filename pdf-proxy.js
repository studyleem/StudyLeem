// Vercel function: fetches a PUBLIC pdf server-side so the in-site viewer can show it
// even when the host blocks iframes (X-Frame-Options) or browser CORS. Only used by the viewer on this site.
const dns = require('dns').promises;
const net = require('net');
const MAX_BYTES = 40 * 1024 * 1024;

function privateIp(ip) {
  if (net.isIPv6(ip)) return ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168);
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ detail: 'Method not allowed' });
  // only our own pages may use the proxy
  const site = req.headers['sec-fetch-site'];
  let refHost = ''; try { refHost = new URL(req.headers.referer || '').hostname; } catch (_) {}
  if (!(site === 'same-origin' || refHost === String(req.headers.host).split(':')[0])) return res.status(403).json({ detail: 'Forbidden' });

  let u; try { u = new URL(String(req.query.url || '')); } catch (_) { return res.status(400).json({ detail: 'Bad url' }); }
  if (!/^https?:$/.test(u.protocol)) return res.status(400).json({ detail: 'Bad url' });
  try {
    const { address } = await dns.lookup(u.hostname);
    if (privateIp(address)) return res.status(400).json({ detail: 'Blocked host' });

    const r = await fetch(u.toString(), { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudyLeemViewer/1.0)', 'Accept': 'application/pdf,*/*' } });
    if (!r.ok) return res.status(502).json({ detail: 'Source returned ' + r.status });
    const len = Number(r.headers.get('content-length') || 0);
    if (len > MAX_BYTES) return res.status(413).json({ detail: 'File too large' });

    const reader = r.body.getReader(); let total = 0, first = true;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (first) {
        first = false;
        if (Buffer.from(value.slice(0, 1024)).toString('latin1').indexOf('%PDF') < 0) { try { reader.cancel(); } catch (_) {} return res.status(415).json({ detail: 'Not a PDF (the link may need a login or is a web page)' }); }
        res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Cache-Control', 'public, max-age=300'); res.status(200);
      }
      total += value.length;
      if (total > MAX_BYTES) { try { reader.cancel(); } catch (_) {} break; }
      res.write(Buffer.from(value));
    }
    if (first) return res.status(502).json({ detail: 'Empty response' });
    return res.end();
  } catch (e) {
    console.error('pdf-proxy', e);
    if (!res.headersSent) return res.status(502).json({ detail: 'Could not fetch the file' });
    try { res.end(); } catch (_) {}
  }
};
