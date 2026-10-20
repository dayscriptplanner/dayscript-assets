/**
 * DayScript sync UI — the cover-page "Sync across devices" affordance, the sign-in sheet,
 * the status dot, and the "updated from your other device" toast. Brand-styled, no deps.
 *
 * Usage (classic script or module):
 *   const ui = mountSyncUI({ sync, anchor: document.querySelector('#cover-actions') });
 *   // pass ui.onStatus as createSync's onStatus, or call ui.onStatus(status, detail) yourself
 *
 * It never opens anything on its own (the companion rule): the sheet opens only when the
 * person taps the link. Apple is hidden unless opts.apple === true.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.mountSyncUI = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CSS = `
  .ds-sync { font-family: "Karla", system-ui, sans-serif; color: #26324B; }
  .ds-sync-link { background: none; border: 0; padding: 6px 0; font: inherit; font-size: 12px; font-weight: 700;
    letter-spacing: .12em; text-transform: uppercase; color: #B5713D; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; }
  .ds-dot { width: 9px; height: 9px; border-radius: 50%; background: #DCD5C5; flex: none; transition: background .2s; }
  .ds-dot[data-s="synced"] { background: #6E9A7A; }
  .ds-dot[data-s="syncing"] { background: #B5713D; animation: ds-pulse 1s ease-in-out infinite; }
  .ds-dot[data-s="offline"] { background: #B4AD9E; }
  .ds-dot[data-s="error"] { background: #B23A3A; }
  @keyframes ds-pulse { 0%,100% { opacity: 1 } 50% { opacity: .35 } }
  @media (prefers-reduced-motion: reduce) { .ds-dot[data-s="syncing"] { animation: none } }
  .ds-sheet-bg { position: fixed; inset: 0; background: rgba(38,50,75,.28); display: none; align-items: flex-end; justify-content: center; z-index: 60; }
  .ds-sheet-bg[open] { display: flex; }
  .ds-sheet { background: #F7F3EA; width: min(440px, 100%); border-radius: 14px 14px 0 0; padding: 22px 22px calc(22px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -18px 40px -24px rgba(38,50,75,.5); display: grid; gap: 14px; }
  @media (min-width: 520px) { .ds-sheet-bg { align-items: center } .ds-sheet { border-radius: 14px } }
  .ds-sheet h2 { font-family: "Playfair Display", Georgia, serif; font-style: italic; font-weight: 600; font-size: 22px; margin: 0; }
  .ds-sheet p { margin: 0; color: #7A7466; font-size: 14px; line-height: 1.45; }
  .ds-field { display: flex; gap: 8px; }
  .ds-field input { flex: 1; min-width: 0; font: inherit; font-size: 15px; padding: 10px 0; border: 0; border-bottom: 1px solid #B5713D; background: transparent; color: #26324B; }
  .ds-field input::placeholder { color: #B4AD9E; font-style: italic; }
  .ds-btn { font: inherit; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; border: 0; border-radius: 99px; padding: 10px 16px; cursor: pointer; }
  .ds-btn.ink { background: #26324B; color: #F7F3EA; }
  .ds-btn.copper { background: #B5713D; color: #F7F3EA; }
  .ds-btn.line { background: transparent; color: #B5713D; box-shadow: inset 0 0 0 1px #B5713D; }
  .ds-btn:disabled { opacity: .5; cursor: default; }
  .ds-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .ds-or { text-align: center; color: #B4AD9E; font-size: 12px; letter-spacing: .1em; text-transform: uppercase; }
  .ds-msg { font-family: "Playfair Display", Georgia, serif; font-style: italic; color: #26324B; font-size: 15px; min-height: 1.4em; }
  .ds-toast { position: fixed; left: 50%; bottom: calc(18px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%) translateY(20px);
    background: #26324B; color: #F7F3EA; font-family: "Playfair Display", Georgia, serif; font-style: italic; font-size: 14px;
    padding: 10px 16px; border-radius: 99px; opacity: 0; transition: opacity .2s, transform .2s; pointer-events: none; z-index: 70; }
  .ds-toast[open] { opacity: 1; transform: translateX(-50%) translateY(0); }
  `;

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else n.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(c => n.appendChild(c));
    return n;
  }

  const LABEL = {
    'signed-out': 'sync off',
    'syncing': 'syncing',
    'synced': 'synced',
    'offline': 'offline — will retry',
    'conflict-resolved': 'synced',
    'error': 'sync error',
  };

  function mountSyncUI(opts) {
    const sync = opts.sync;
    const anchor = opts.anchor || document.body;
    const apple = !!opts.apple;
    const doc = anchor.ownerDocument || document;

    if (!doc.getElementById('ds-sync-css')) doc.head.appendChild(el('style', { id: 'ds-sync-css', text: CSS }));

    // --- cover link + dot
    const dot = el('span', { class: 'ds-dot', 'data-s': 'signed-out', 'aria-hidden': 'true' });
    const linkText = el('span', { text: 'sync across devices' });
    const link = el('button', { class: 'ds-sync-link', type: 'button', 'aria-haspopup': 'dialog', onclick: open }, [dot, linkText]);
    const wrap = el('div', { class: 'ds-sync' }, [link]);
    anchor.appendChild(wrap);

    // --- sheet
    const msg = el('div', { class: 'ds-msg', role: 'status', 'aria-live': 'polite' });
    const email = el('input', { type: 'email', placeholder: 'your email', autocomplete: 'email', inputmode: 'email', 'aria-label': 'Email address' });
    const sendBtn = el('button', { class: 'ds-btn copper', type: 'submit', text: 'email me a link' });
    const form = el('form', { class: 'ds-field', onsubmit: async (e) => {
      e.preventDefault();
      const v = email.value.trim(); if (!v) { email.focus(); return; }
      sendBtn.disabled = true; msg.textContent = 'sending…';
      try { await sync.signInWithEmail(v); msg.textContent = 'check your email — the link signs you in here.'; }
      catch (err) { msg.textContent = friendly(err); }
      finally { sendBtn.disabled = false; }
    } }, [email, sendBtn]);

    const googleBtn = el('button', { class: 'ds-btn line', type: 'button', text: 'continue with google', onclick: () => oauth('google') });
    const appleBtn = el('button', { class: 'ds-btn line', type: 'button', text: 'continue with apple', onclick: () => oauth('apple') });
    const signOutBtn = el('button', { class: 'ds-btn ink', type: 'button', text: 'sign out', onclick: async () => {
      signOutBtn.disabled = true; msg.textContent = 'saving, then signing out…';
      try { await sync.signOut(); msg.textContent = 'signed out. your pages stay on this device.'; refresh(); }
      catch (err) { msg.textContent = friendly(err); }
      finally { signOutBtn.disabled = false; }
    } });
    const closeBtn = el('button', { class: 'ds-btn line', type: 'button', text: 'close', onclick: close });

    const signedOutView = el('div', { style: 'display:grid;gap:12px' }, [
      el('p', { text: 'Sign in once and your pages follow you — iPad, phone, laptop. Nothing leaves this device until you do.' }),
      form,
      el('div', { class: 'ds-or', text: 'or' }),
      el('div', { class: 'ds-row' }, apple ? [googleBtn, appleBtn] : [googleBtn]),
    ]);
    const who = el('p');
    const signedInView = el('div', { style: 'display:grid;gap:12px' }, [who, el('div', { class: 'ds-row' }, [signOutBtn])]);

    const sheet = el('div', { class: 'ds-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ds-sync-title' }, [
      el('h2', { id: 'ds-sync-title', text: 'sync across devices' }),
      signedOutView, signedInView, msg,
      el('div', { class: 'ds-row', style: 'justify-content:flex-end' }, [closeBtn]),
    ]);
    const bg = el('div', { class: 'ds-sheet-bg', onclick: (e) => { if (e.target === bg) close(); } }, [sheet]);
    doc.body.appendChild(bg);
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape' && bg.hasAttribute('open')) close(); });

    const toast = el('div', { class: 'ds-toast', role: 'status' });
    doc.body.appendChild(toast);
    let toastT;
    function say(t) { toast.textContent = t; toast.setAttribute('open', ''); clearTimeout(toastT); toastT = setTimeout(() => toast.removeAttribute('open'), 2600); }

    async function oauth(provider) {
      msg.textContent = 'opening ' + provider + '…';
      try { await sync.signInWithOAuth(provider); } catch (err) { msg.textContent = friendly(err); }
    }
    function friendly(err) {
      const m = (err && err.message) || String(err);
      if (/rate|too many/i.test(m)) return 'too many tries — give it a minute.';
      if (/network|fetch/i.test(m)) return 'no connection right now. your pages are safe here.';
      return "that didn't work: " + m;
    }
    function refresh() {
      const u = sync.user && sync.user();
      signedOutView.style.display = u ? 'none' : '';
      signedInView.style.display = u ? '' : 'none';
      who.textContent = u ? 'signed in as ' + (u.email || 'you') + '. your pages sync across devices.' : '';
      linkText.textContent = u ? LABEL[dot.dataset.s] || 'synced' : 'sync across devices';
    }
    function open() { msg.textContent = ''; refresh(); bg.setAttribute('open', ''); (sync.user && sync.user() ? closeBtn : email).focus(); }
    function close() { bg.removeAttribute('open'); link.focus(); }

    function onStatus(status, detail) {
      dot.dataset.s = status;
      if (status === 'conflict-resolved' && detail && detail.outcome === 'server-won') say('updated from your other device');
      if (status === 'error' && detail && detail.message) console.warn('[dayscript sync]', detail.message);
      if (status === 'signed-out' || status === 'synced') refresh();
      linkText.textContent = sync.user && sync.user() ? (LABEL[status] || status) : 'sync across devices';
    }

    refresh();
    return { onStatus, open, close, say, element: wrap };
  }

  return mountSyncUI;
});
