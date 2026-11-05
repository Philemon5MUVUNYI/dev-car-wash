(() => {
  'use strict';

  /* ---------- Settings: edit these to match your business ---------- */
  const CURRENCY = '$';
  const HOURS = { 0: [9, 16], 1: [7, 19], 2: [7, 19], 3: [7, 19], 4: [7, 19], 5: [7, 19], 6: [7, 19] };
  /* ------------------------------------------------------------------ */

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Before / after slider ---------- */
  const stage = $('#stage');
  const range = $('#wash');
  const hint = $('#hint');
  let userTouched = false;

  const setPos = v => {
    v = Math.max(0, Math.min(100, v));
    stage.style.setProperty('--pos', v + '%');
    range.value = v;
  };
  const fromPointer = e => {
    const r = stage.getBoundingClientRect();
    setPos(((e.clientX - r.left) / r.width) * 100);
  };
  const touched = () => { userTouched = true; hint.classList.add('hide'); };

  stage.addEventListener('pointerdown', e => {
    touched();
    stage.setPointerCapture(e.pointerId);
    fromPointer(e);
    const move = ev => fromPointer(ev);
    const up = () => {
      stage.removeEventListener('pointermove', move);
      stage.removeEventListener('pointerup', up);
      stage.removeEventListener('pointercancel', up);
    };
    stage.addEventListener('pointermove', move);
    stage.addEventListener('pointerup', up);
    stage.addEventListener('pointercancel', up);
  });
  range.addEventListener('input', () => { touched(); setPos(+range.value); });

  // One intro sweep to show what the slider does
  if (!reduceMotion) {
    setPos(6);
    const start = performance.now() + 500, dur = 1700;
    const tick = now => {
      if (userTouched) return;
      const t = Math.min(Math.max((now - start) / dur, 0), 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setPos(6 + 64 * ease);
      if (t < 1) requestAnimationFrame(tick);
      else if (!userTouched) setPos(70);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- Pricing by vehicle size ---------- */
  const prices = $$('[data-base]');
  const updatePrices = () => {
    const mult = parseFloat($('input[name="size"]:checked').value);
    prices.forEach(el => {
      el.textContent = CURRENCY + Math.round(parseFloat(el.dataset.base) * mult);
    });
  };
  $$('input[name="size"]').forEach(r => r.addEventListener('change', updatePrices));
  updatePrices();

  /* ---------- Pick a package -> prefill form ---------- */
  $$('[data-pick]').forEach(btn => btn.addEventListener('click', () => {
    $('#package').value = btn.dataset.pick;
    clearError($('#package'));
    $('#book').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    setTimeout(() => $('#name').focus({ preventScroll: true }), 500);
  }));

  /* ---------- Opening hours: highlight today + open status ---------- */
  const fmt = h => {
    const hr = h % 12 === 0 ? 12 : h % 12;
    return hr + (h < 12 ? 'am' : 'pm');
  };
  const now = new Date();
  const today = now.getDay();
  const row = $(`#hours tr[data-day="${today}"]`);
  if (row) row.classList.add('today');
  const status = $('#status');
  const [open, close] = HOURS[today];
  const hr = now.getHours() + now.getMinutes() / 60;
  if (hr >= open && hr < close) {
    status.textContent = `Open now, until ${fmt(close)}`;
    status.classList.add('open');
  } else {
    status.textContent = `Closed now, opens ${hr < open ? 'today' : 'tomorrow'} at ${fmt(hr < open ? open : HOURS[(today + 1) % 7][0])}`;
  }

  /* ---------- Booking form ---------- */
  const form = $('#bookForm');
  const dateInput = $('#date');
  const timeSelect = $('#time');
  const note = $('#formNote');

  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  dateInput.min = iso(now);
  dateInput.value = iso(now);

  const buildTimes = () => {
    const d = dateInput.value ? new Date(dateInput.value + 'T00:00') : now;
    const [o, c] = HOURS[d.getDay()];
    const isToday = iso(d) === iso(now);
    const current = timeSelect.value;
    timeSelect.innerHTML = '<option value="">Choose a time</option>';
    for (let h = o; h < c; h++) {
      if (isToday && h <= now.getHours()) continue;
      const opt = document.createElement('option');
      opt.value = opt.textContent = `${fmt(h)}`;
      timeSelect.appendChild(opt);
    }
    if ([...timeSelect.options].some(o => o.value === current)) timeSelect.value = current;
  };
  dateInput.addEventListener('change', buildTimes);
  buildTimes();

  const errEl = input => $(`.error[data-for="${input.id}"]`);
  const setError = (input, msg) => {
    input.closest('.field').classList.add('invalid');
    input.setAttribute('aria-invalid', 'true');
    errEl(input).textContent = msg;
  };
  function clearError(input) {
    input.closest('.field').classList.remove('invalid');
    input.removeAttribute('aria-invalid');
    errEl(input).textContent = '';
  }

  const validators = {
    name: v => v.trim().length < 2 ? 'Enter your name.' : '',
    phone: v => v.replace(/\D/g, '').length < 7 ? 'Enter a phone number we can call, at least 7 digits.' : '',
    package: v => !v ? 'Choose a package.' : '',
    date: v => !v ? 'Choose a date.' : (v < dateInput.min ? 'Choose today or a later date.' : ''),
    time: v => !v ? 'Choose a time.' : ''
  };

  Object.keys(validators).forEach(id => {
    const el = $('#' + id);
    el.addEventListener('input', () => clearError(el));
    el.addEventListener('change', () => clearError(el));
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    note.textContent = '';
    note.className = 'form-note';
    let firstBad = null;
    Object.keys(validators).forEach(id => {
      const el = $('#' + id);
      const msg = validators[id](el.value);
      if (msg) { setError(el, msg); firstBad = firstBad || el; } else clearError(el);
    });
    if (firstBad) { firstBad.focus(); return; }

    const d = new Date(dateInput.value + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
    // No server in this demo. Connect your own endpoint here, e.g. fetch('/api/book', { method: 'POST', body: new FormData(form) })
    note.textContent = `Thanks, ${$('#name').value.trim().split(' ')[0]}. We have your request for ${$('#package').value} on ${d} at ${timeSelect.value}. We will call to confirm.`;
    note.classList.add('ok');
    form.reset();
    dateInput.value = iso(new Date());
    buildTimes();
  });
})();
