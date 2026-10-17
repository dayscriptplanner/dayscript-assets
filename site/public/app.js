/* DayScript landing — waitlist form + small touches. No dependencies. */
(function () {
  'use strict';

  var ETSY = 'https://www.etsy.com/shop/DayscriptShop';
  var MAIL = 'hello@dayscriptplanner.org';

  // ---------- source tracking (?src=pdf from the QR codes in sold planners) ----------
  var params = new URLSearchParams(window.location.search);
  var src = (params.get('src') || 'web').replace(/[^a-z0-9_-]/gi, '').slice(0, 32) || 'web';

  // ---------- rotate the hero card line ----------
  var SMILES = [
    'the ending is written first. the middle is just commuting.',
    'write it down before it becomes a personality.',
    'a plan is a rumor you tell the morning.',
    'cross it off like you mean it.',
    'the margin is listening.',
    'an unwritten goal is just a mood.',
    'monday has been notified.',
    'file it under handled.'
  ];
  var cardLine = document.querySelector('[data-smile]');
  if (cardLine) {
    // a different line per day, so the page feels alive without being random on every reload
    var day = Math.floor(Date.now() / 864e5);
    cardLine.textContent = SMILES[day % SMILES.length];
  }

  // duplicate the ticker once so the drift loops seamlessly
  var ticker = document.querySelector('.ticker');
  if (ticker && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ticker.innerHTML += ticker.innerHTML;
    ticker.querySelectorAll('p').forEach(function (p, i) {
      if (i >= SMILES.length) p.setAttribute('aria-hidden', 'true');
    });
  }

  // ---------- waitlist form ----------
  var form = document.getElementById('waitlist');
  if (!form) return;
  var input = form.querySelector('input[name="email"]');
  var button = form.querySelector('button[type="submit"]');
  var note = document.getElementById('form-note');
  var defaultNote = note.textContent;

  function say(kind, html) {
    note.className = 'note' + (kind ? ' ' + kind : '');
    note.innerHTML = html;
  }

  function validEmail(v) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
  }

  function fallback(reason) {
    // Never fail silently. Give a human a human way in.
    var subject = encodeURIComponent('DayScript app waitlist');
    var body = encodeURIComponent('Please add me to the DayScript app waitlist.\n\n(email: ' + input.value.trim() + ', source: ' + src + ')');
    say('err',
      (reason || 'The waitlist isn’t taking names right this second.') +
      ' You can <a href="mailto:' + MAIL + '?subject=' + subject + '&body=' + body + '">email us instead</a>' +
      ' and we’ll add you by hand, or <a href="' + ETSY + '" target="_blank" rel="noopener">find the planner on Etsy</a> in the meantime.');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = input.value.trim();
    if (!validEmail(email)) {
      input.setAttribute('aria-invalid', 'true');
      say('err', 'That doesn’t look like an email address yet. One more look?');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');
    button.disabled = true;
    say('', 'Writing it down…');

    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 10000);

    fetch('/api/waitlist?src=' + encodeURIComponent(src), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ email: email, source: src }),
      signal: controller ? controller.signal : undefined
    })
      .then(function (res) {
        if (timer) clearTimeout(timer);
        // The function isn't deployed (static-only preview, 404/405) or Pages served the HTML shell.
        var ct = res.headers.get('content-type') || '';
        if (res.status === 404 || res.status === 405 || ct.indexOf('application/json') === -1) {
          throw new Error('not-deployed');
        }
        return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
      })
      .then(function (r) {
        if (r.ok && r.data && r.data.ok) {
          form.querySelector('.field').hidden = true;
          form.querySelector('.label').textContent = r.data.already
            ? 'You’re already on the list. We’ll write once, when it’s ready.'
            : 'You’re on the list. We’ll write once, when it’s ready.';
          say('ok', 'Until then, the ending is yours to write. <a href="' + ETSY + '" target="_blank" rel="noopener">The planner is on Etsy →</a>');
          return;
        }
        if (r.status === 400) {
          input.setAttribute('aria-invalid', 'true');
          say('err', (r.data && r.data.error) || 'That email didn’t go through. One more look?');
          button.disabled = false;
          return;
        }
        if (r.status === 429) {
          say('err', 'Easy there. Please try again in a minute.');
          button.disabled = false;
          return;
        }
        fallback('Something went sideways on our end.');
        button.disabled = false;
      })
      .catch(function () {
        if (timer) clearTimeout(timer);
        fallback();
        button.disabled = false;
      });
  });

  input.addEventListener('input', function () {
    if (note.classList.contains('err')) {
      input.removeAttribute('aria-invalid');
      say('', defaultNote);
    }
  });
})();
