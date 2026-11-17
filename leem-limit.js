/* StudyLeem AI — message limit REMOVED (unlimited for everyone).
   Kept as a tiny no-op shim so /leemai and the PDF-preview chat (pdf-embed.js) keep working unchanged.
   To bring a limit back later, restore the previous version of this file. */
(function () {
  'use strict';
  window.LeemLimit = {
    status: () => ({ left: Infinity, locked: false, wait: 0, max: Infinity }),
    consume: () => true,
    refund: () => {},
    note: (el, onChange) => {
      if (el) { el.textContent = ''; el.style.display = 'none'; }
      if (onChange) onChange({ left: Infinity, locked: false, wait: 0, max: Infinity });
      return { refresh() {}, stop() {} };
    },
    fmt: () => '0:00',
    MAX: Infinity
  };
})();
