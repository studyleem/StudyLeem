// StudyLeem — Firebase backend (Firestore + Auth). Loaded as <script type="module">.
// Exposes globals used by every page: DB, Auth, Messages, toSlug.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import {
  getFirestore, collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, writeBatch, serverTimestamp, Timestamp
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';

// Domain lock (keep in sync with domain-guard.js): no data is fetched on any other domain.
const HOST_OK = ['studyleem.vercel.app', 'localhost', '127.0.0.1'];
if (!HOST_OK.includes(location.hostname)) throw new Error('StudyLeem: this domain is not allowed');

const firebaseConfig = {
  apiKey: "AIzaSyD3v1qSVW-DIuqLhJFRESjl903VjH55umA",
  authDomain: "studyleem0786.firebaseapp.com",
  projectId: "studyleem0786",
  storageBucket: "studyleem0786.firebasestorage.app",
  messagingSenderId: "458499883774",
  appId: "1:458499883774:web:bb623188b2c6570fe25baf",
  measurementId: "G-HB80RDNDKQ"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

/* ── helpers ── */
function toSlug(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '')
    .replace(/-+/g, '-').replace(/^-|-$/g, '');
}
function chapterSlugOf(m) {
  if (m.type !== 'notes') return null;
  if (m.chapterNumber == null || m.chapterNumber === '') return toSlug(m.chapterTitle) || null;
  if (m.contentType === 'exercise') return m.review ? `review-exercise-${m.chapterNumber}` : `exercise-${m.chapterNumber}${m.exerciseNumber ? '-' + m.exerciseNumber : ''}`;
  return `chapter-${m.chapterNumber}`;
}
const ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : (typeof t === 'number' ? t : 0);
const fromDoc = d => { const x = d.data(); return { ...x, id: d.id, class: String(x.class), createdAt: ms(x.createdAt) }; };
const num = (v, f) => (v === null || v === undefined || v === '' ? null : f(v));
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function friendly(e) {
  const c = e && e.code || '';
  if (c.includes('permission-denied')) return new Error('Permission denied. Check Firestore rules and admin login.');
  if (c.includes('unavailable') || c.includes('network')) return new Error('Network error. Check your connection.');
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-email'))
    return new Error('Invalid email or password');
  if (c.includes('too-many-requests')) return new Error('Too many attempts. Try again later.');
  return e instanceof Error ? e : new Error(String(e));
}

/* ── tiny cache: public reads are cached 5 min to stay inside the free Firestore quota ── */
const TTL = 5 * 60 * 1000, PFX = 'sl_cache_v1:';
let _admin = false;
const cacheGet = k => { try { const o = JSON.parse(localStorage.getItem(PFX + k)); return o && Date.now() - o.t < TTL ? o.v : null; } catch (_) { return null; } };
const cacheSet = (k, v) => { try { localStorage.setItem(PFX + k, JSON.stringify({ t: Date.now(), v })); } catch (_) {} };
const cacheClear = () => { try { Object.keys(localStorage).filter(k => k.startsWith(PFX)).forEach(k => localStorage.removeItem(k)); } catch (_) {} };

async function cached(key, fn) {
  if (!_admin) { const hit = cacheGet(key); if (hit) return hit; }
  const v = await fn();
  if (!_admin) cacheSet(key, v);
  return v;
}

function clean(b, base = {}) {
  const m = { ...base };
  for (const k of ['type', 'contentType']) if (b[k] !== undefined) m[k] = b[k];
  for (const [k, max] of [['title', 300], ['class', 4], ['subject', 200], ['chapterTitle', 300], ['coverImage', 2000], ['pdfLink', 2000], ['description', 5000]])
    if (b[k] !== undefined) m[k] = str(String(b[k] ?? ''), max);
  if (b.chapterNumber !== undefined) m.chapterNumber = num(b.chapterNumber, v => parseInt(v, 10));
  if (b.exerciseNumber !== undefined) m.exerciseNumber = num(b.exerciseNumber, parseFloat);
  if (b.review !== undefined) m.review = !!b.review;
  return m;
}
function validate(m) {
  const e = [];
  if (!['notes', 'books'].includes(m.type)) e.push('type');
  if (!m.title) e.push('title');
  if (!['9', '10', '11', '12'].includes(String(m.class))) e.push('class');
  if (!m.subject) e.push('subject');
  for (const k of ['coverImage', 'pdfLink']) if (m[k] && !/^https?:\/\//i.test(m[k])) e.push(k + ' (must be an http/https URL)');
  if (m.type === 'notes' && m.chapterNumber != null && Number.isNaN(m.chapterNumber)) e.push('chapterNumber');
  if (e.length) throw new Error('Invalid: ' + e.join(', '));
}
function finalize(m) {
  if (m.type === 'notes' && !m.contentType) m.contentType = 'chapter';
  if (m.type === 'books') { m.contentType = null; m.chapterNumber = null; m.exerciseNumber = null; m.chapterTitle = null; m.review = false; }
  if (m.type === 'notes' && m.contentType !== 'exercise') m.review = false;
  if (m.review) m.exerciseNumber = null;          // a review exercise has no exercise number
  validate(m);
  return {
    type: m.type, contentType: m.contentType ?? null, title: m.title, class: String(m.class),
    subject: m.subject, subjectSlug: toSlug(m.subject),
    chapterNumber: m.chapterNumber ?? null, exerciseNumber: m.exerciseNumber ?? null, review: !!m.review,
    chapterTitle: m.chapterTitle ?? null, chapterSlug: chapterSlugOf(m),
    coverImage: m.coverImage || null, pdfLink: m.pdfLink || null, description: m.description || null
  };
}

/* ── Materials ── */
const DB = {
  setAdminMode(on) { _admin = !!on; },

  async create(data) {
    try {
      const rec = finalize(clean(data));
      const ref = await addDoc(collection(db, 'materials'), { ...rec, createdAt: serverTimestamp() });
      cacheClear(); return ref.id;
    } catch (e) { throw friendly(e); }
  },
  async update(id, data) {
    try {
      const snap = await getDoc(doc(db, 'materials', id));
      if (!snap.exists()) throw new Error('Material not found');
      const b = { ...data };
      const cur = fromDoc(snap);
      if (b.exerciseNumber && cur.type === 'notes' && b.contentType === undefined) b.contentType = 'exercise';
      if (cur.type === 'notes' && b.exerciseNumber === null && b.contentType === undefined) b.contentType = 'chapter';
      await updateDoc(doc(db, 'materials', id), finalize(clean(b, cur)));
      cacheClear();
    } catch (e) { throw friendly(e); }
  },
  async delete(id) { try { await deleteDoc(doc(db, 'materials', id)); cacheClear(); } catch (e) { throw friendly(e); } },

  async getAll() {
    try {
      return await cached('all', async () => {
        const s = await getDocs(collection(db, 'materials'));
        return s.docs.map(fromDoc).sort((a, b) => b.createdAt - a.createdAt);
      });
    } catch (e) { console.error('❌ Firestore:', e); return []; }
  },
  async getByClass(c) {
    try {
      return await cached('c' + c, async () => {
        const s = await getDocs(query(collection(db, 'materials'), where('class', '==', String(c))));
        return s.docs.map(fromDoc).sort((a, b) => b.createdAt - a.createdAt);
      });
    } catch (e) { console.error('❌ Firestore:', e); return []; }
  },
  async getBySubject(c, subject) {
    return (await this.getByClass(c)).filter(m => m.subject === subject);
  },
  async getBySubjectSlug(c, slug, type) {
    const all = await this.getByClass(c);
    return all.filter(m => (m.subjectSlug || toSlug(m.subject)) === slug && (!type || type === 'all' || m.type === type));
  },
  async getByChapterSlug(c, slug, ch, type) {
    const items = await this.getBySubjectSlug(c, slug, type);
    return items.filter(m => (m.chapterSlug || chapterSlugOf(m)) === ch);
  },
  async getById(id) {
    try {
      const s = await getDoc(doc(db, 'materials', String(id)));
      return s.exists() ? fromDoc(s) : null;
    } catch (e) { console.error('❌ Firestore:', e); return null; }
  },
  async getStats() {
    const items = await this.getAll();
    const stats = { total: items.length, books: 0, notes: 0, byClass: { '9': 0, '10': 0, '11': 0, '12': 0 } };
    items.forEach(m => { stats[m.type === 'books' ? 'books' : 'notes']++; if (stats.byClass[m.class] !== undefined) stats.byClass[m.class]++; });
    return stats;
  },

  // Bulk import (keeps document IDs so existing /book-ID links keep working). Safe to re-run.
  async importItems(items) {
    let n = 0, skipped = 0;
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      for (const x of items.slice(i, i + 400)) {
        try {
          const type = x.type === 'books' ? 'books' : 'notes';
          const rec = finalize(clean({
            ...x, type,
            class: String(x.class),
            contentType: type === 'notes' ? (x.contentType || (x.exerciseNumber ? 'exercise' : 'chapter')) : null
          }));
          if (x.chapterSlug && type === 'notes') rec.chapterSlug = x.chapterSlug;
          const t = x.createdAt ? Timestamp.fromMillis(typeof x.createdAt === 'number' ? x.createdAt : Date.parse(x.createdAt) || Date.now()) : Timestamp.now();
          const ref = x.id ? doc(db, 'materials', String(x.id)) : doc(collection(db, 'materials'));
          batch.set(ref, { ...rec, createdAt: t });
          n++;
        } catch (_) { skipped++; }
      }
      await batch.commit();
    }
    cacheClear();
    return { imported: n, skipped };
  }
};

/* ── Admin auth (Firebase Auth email/password; admin = UID listed in ADMIN_UIDS) ── */
const authReady = new Promise(res => { const un = onAuthStateChanged(auth, u => { un(); res(u); }); });
// Admin accounts (Firebase Auth UIDs). Must match the list in firestore.rules.
const ADMIN_UIDS = ['FtNUvUpPIxfMMO1ag5SARCMqDqE3'];
async function isAdminUser(u) { return !!u && ADMIN_UIDS.includes(u.uid); }
const Auth = {
  async check() { const u = await authReady.then(() => auth.currentUser); return await isAdminUser(u); },
  async login(email, password) {
    let cred;
    try { cred = await signInWithEmailAndPassword(auth, String(email).trim(), String(password)); }
    catch (e) { throw friendly(e); }
    if (!(await isAdminUser(cred.user))) {
      await signOut(auth);
      throw new Error('This account is not authorized as admin.');
    }
    return { ok: true, email: cred.user.email };
  },
  async logout() { await signOut(auth); }
};

/* ── Contact messages ── */
const Messages = {
  async send(d) {
    if (d.website) return { ok: true }; // honeypot
    const name = str(d.name, 120), email = str(d.email, 200), message = str(d.message, 5000), subjectLabel = str(d.subjectLabel, 200);
    if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Please provide a valid name, email and message.');
    const last = +localStorage.getItem('sl_last_msg') || 0;
    if (Date.now() - last < 30000) throw new Error('Please wait a few seconds before sending another message.');
    try {
      await addDoc(collection(db, 'contact_messages'), { name, email, subjectLabel, message, read: false, sentAt: serverTimestamp() });
      localStorage.setItem('sl_last_msg', String(Date.now()));
      return { ok: true };
    } catch (e) { throw friendly(e); }
  },
  async list() {
    try {
      const s = await getDocs(query(collection(db, 'contact_messages'), orderBy('sentAt', 'desc'), limit(500)));
      return s.docs.map(d => ({ ...d.data(), id: d.id, sentAt: ms(d.data().sentAt) }));
    } catch (e) { throw friendly(e); }
  },
  async markRead(id) { try { await updateDoc(doc(db, 'contact_messages', id), { read: true }); } catch (e) { throw friendly(e); } },
  async remove(id)   { try { await deleteDoc(doc(db, 'contact_messages', id)); } catch (e) { throw friendly(e); } }
};


/* ── Blog (collection: blogPosts, document id = URL slug) ── */
const BLOG_SLUG = /^[a-z0-9][a-z0-9-]{2,90}$/;
const fromPost = d => { const x = d.data(); return { ...x, id: d.id, slug: d.id, publishedAt: ms(x.publishedAt), createdAt: ms(x.createdAt), updatedAt: ms(x.updatedAt) }; };
const Blog = {
  isValidSlug: s => BLOG_SLUG.test(String(s || '')),
  // public: published posts, newest first (cached 5 min)
  async listPublished(max = 100) {
    return cached('blog_list', async () => {
      try {
        const s = await getDocs(query(collection(db, 'blogPosts'), where('status', '==', 'published'), limit(max)));
        return s.docs.map(fromPost).sort((a, b) => b.publishedAt - a.publishedAt);
      } catch (e) { throw friendly(e); }
    });
  },
  async getBySlug(slug) {
    if (!BLOG_SLUG.test(String(slug || ''))) return null;
    try {
      const d = await getDoc(doc(db, 'blogPosts', slug));
      if (!d.exists()) return null;
      const p = fromPost(d);
      return (p.status === 'published' || _admin) ? p : null;
    } catch (e) {
      if (String(e && e.code).includes('permission-denied')) return null;
      throw friendly(e);
    }
  },
  // admin: everything including drafts
  async listAll() {
    try {
      const s = await getDocs(query(collection(db, 'blogPosts'), limit(500)));
      return s.docs.map(fromPost).sort((a, b) => (b.publishedAt || b.createdAt) - (a.publishedAt || a.createdAt));
    } catch (e) { throw friendly(e); }
  },
  async save(slug, d, isNew) {
    if (!BLOG_SLUG.test(String(slug || ''))) throw new Error('Slug must be 3-90 characters: lowercase letters, numbers and hyphens.');
    const content = str(d.content, 60000), title = str(d.title, 200);
    if (!title || content.length < 50) throw new Error('A title and some content are required.');
    const words = content.split(/\s+/).filter(Boolean).length;
    const status = d.status === 'published' ? 'published' : 'draft';
    const data = {
      title, excerpt: str(d.excerpt, 400), metaDescription: str(d.metaDescription, 200), keywords: str(d.keywords, 400),
      category: str(d.category, 60) || 'Study Tips', content, wordCount: words,
      readingMinutes: Math.max(1, Math.round(Number(d.readingMinutes)) || Math.ceil(words / 200)),
      status, updatedAt: serverTimestamp()
    };
    if (status === 'published' && !d.hadPublishedAt) data.publishedAt = serverTimestamp();
    if (isNew) { data.createdAt = serverTimestamp(); data.source = 'admin'; }
    try {
      if (isNew && (await getDoc(doc(db, 'blogPosts', slug))).exists()) throw new Error('A post with this slug already exists.');
      await setDoc(doc(db, 'blogPosts', slug), data, { merge: true });
      cacheClear();
    } catch (e) { throw friendly(e); }
  },
  async remove(slug) { try { await deleteDoc(doc(db, 'blogPosts', slug)); cacheClear(); } catch (e) { throw friendly(e); } }
};

Object.assign(window, { DB, Auth, Messages, Blog, toSlug });
window.dispatchEvent(new Event('firebase-ready'));
