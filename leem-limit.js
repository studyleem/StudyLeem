/* StudyLeem free AI limit — tracked in this browser only (no account).
   4 free messages, then a 5-minute break; counter resets after the break. Shared by /leemai and PDF previews. */
(function () {
  'use strict';
  const KEY = 'sl_ai_quota_v1', MAX = 4, BREAK_MS = 5 * 60 * 1000;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || { n: 0, lock: 0 }; } catch (_) { return { n: 0, lock: 0 }; } };
  const write = s => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {} };

  function status() {
    let s = read(); const now = Date.now();
    if (s.lock && now >= s.lock) { s = { n: 0, lock: 0 }; write(s); }   // break is over
    const locked = !!(s.lock && now < s.lock);
    return { left: locked ? 0 : Math.max(0, MAX - s.n), locked, wait: locked ? s.lock - now : 0, max: MAX };
  }
  function consume() {                       // call right before sending a message
    const st = status(); if (st.locked || st.left <= 0) return false;
    const s = read(); s.n = (s.n || 0) + 1;
    if (s.n >= MAX) s.lock = Date.now() + BREAK_MS;
    write(s); return true;
  }
  function refund() {                        // call if the request failed (not the user's fault)
    const s = read(); if (s.n > 0) s.n--; if (s.n < MAX) s.lock = 0; write(s);
  }
  const fmt = ms => { const t = Math.ceil(ms / 1000); return String(Math.floor(t / 60)).padStart(1, '0') + ':' + String(t % 60).padStart(2, '0'); };

  /* small live status line: LeemLimit.note(el, onChange) */
  function note(el, onChange) {
    let was = null;
    const tick = () => {
      const st = status();
      el.textContent = st.locked ? `Free limit reached. You can ask again in ${fmt(st.wait)}.`
        : `${st.left} of ${MAX} free messages left`;
      el.classList.toggle('sl-locked', st.locked);
      if (was !== st.locked && onChange) onChange(st);
      was = st.locked;
    };
    tick(); const id = setInterval(tick, 1000); return { refresh: tick, stop: () => clearInterval(id) };
  }
  window.LeemLimit = { status, consume, refund, note, fmt, MAX };
})();
