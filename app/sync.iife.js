/*
 * DayScript sync — classic-script loader.
 *
 * For a page that is NOT using <script type="module"> (the single-file
 * prototype). Include this with a plain <script src="sync.iife.js"></script>
 * and it will dynamic-import ./sync.js and expose:
 *
 *   window.DayScriptSync          → Promise resolving to { createSync }
 *   window.createSync             → set once loaded
 *   'dayscript-sync-ready' event  → dispatched on window once loaded
 *
 * Usage in the prototype:
 *   window.addEventListener('dayscript-sync-ready', () => {
 *     window.sync = createSync({ ...config, getState: () => state, applyState, onStatus });
 *   });
 *
 * No bundler: modern browsers all support dynamic import() from classic scripts.
 */
(function () {
  var here = document.currentScript && document.currentScript.src
    ? document.currentScript.src.replace(/[^/]*$/, '')
    : './';
  var p = import(here + 'sync.js').then(function (m) {
    window.createSync = m.createSync;
    window.dispatchEvent(new Event('dayscript-sync-ready'));
    return m;
  });
  p.catch(function (e) { console.error('DayScript sync failed to load', e); });
  window.DayScriptSync = p;
})();
