// ---- Arrow Survival: Landing interactions (PLAY + SETTINGS) ----
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const playBtn = $('.hotspot.play');
  const settingsBtn = $('.hotspot.settings');
  const dialog = $('#settingsDialog');
  const toast = $('#toast');

  // ---------- LOW-LATENCY CLICK SOUND (Web Audio) ----------
  let audioCtx = null;
  let clickBuffer = null;
  let clickGain = null;

  async function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: 'interactive'
    });
    clickGain = audioCtx.createGain();
    clickGain.gain.value = 0.8; // volume 0.0–1.0
    clickGain.connect(audioCtx.destination);

    // Fetch & decode once (no playback yet)
    const res = await fetch('assets/click.wav', { cache: 'no-store' });
    const arr = await res.arrayBuffer();
    clickBuffer = await audioCtx.decodeAudioData(arr);
  }

  // Some browsers require a user gesture before resuming AudioContext
  function ensureAudioReady() {
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
  }

  function playClick() {
    // Respect your UI sound setting if you want; right now we always play
    const snd = localStorage.getItem('arrowSurvival:sound') || 'on';
    if (snd !== 'on') return;

    if (audioCtx && clickBuffer) {
      ensureAudioReady();
      const src = audioCtx.createBufferSource();
      src.buffer = clickBuffer;
      src.connect(clickGain);
      // start immediately with zero scheduling delay
      src.start(0);
      return;
    }
    // Fallback (rare): if buffer not ready yet, fall back to <audio>
    const a = new Audio('assets/click.wav');
    a.volume = 0.8;
    a.play();
  }

  // Initialize audio on the first user interaction (required by autoplay policies)
  window.addEventListener('pointerdown', async () => { try { await initAudio(); } catch {} }, { once: true });

  function showToast(msg){
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove('show'), 1400);
  }

  // ----- Global click sound for all buttons -----
  document.addEventListener('click', (e) => {
    if (e.target.closest('button')) {
      playClick();
    }
  });

  // ----- PLAY -----
  // Landing page: Play → go to game page
  playBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = 'game.html';
  });

  // Utilities for single-select groups
  function selectValue(groupName, value){
    const group = dialog?.querySelector(`[data-group="${groupName}"]`);
    if (!group) return;
    $$('.opt', group).forEach(b => {
      const active = b.dataset.value === value;
      b.classList.toggle('is-active', active);
      b.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function getSelected(groupName){
    const group = dialog?.querySelector(`[data-group="${groupName}"]`);
    return group?.querySelector('.opt.is-active')?.dataset.value || null;
  }

  function hydrate(){
    const diff = localStorage.getItem('arrowSurvival:difficulty') || 'easy';
    const snd  = localStorage.getItem('arrowSurvival:sound') || 'on';
    selectValue('difficulty', diff);
    selectValue('sound', snd);
  }

  // ----- OPEN SETTINGS -----
  settingsBtn?.addEventListener('click', () => {
    hydrate();
    dialog?.showModal();
  });

  // Single-select behavior
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.opt');
    if (!btn || !dialog?.open) return;
    const group = btn.closest('[data-group]');
    if (!group) return;

    $$('.opt', group).forEach(x => {
      x.classList.remove('is-active');
      x.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
  });

  // Save selections
  document.addEventListener('click', (e) => {
    if (e.target?.id === 'saveBtn') {
      const diff = getSelected('difficulty') || 'easy';
      const snd  = getSelected('sound') || 'on';
      localStorage.setItem('arrowSurvival:difficulty', diff);
      localStorage.setItem('arrowSurvival:sound', snd);
      showToast('Settings saved');
    }
  });

  // ====== (NEW) Minimal tone helper using same AudioContext ======
  function tone(freq = 600, dur = 0.3, type = 'sine', gain = 0.25){
    if (!audioCtx) return;
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    osc.start(now);
    // fade in/out to avoid clicks
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    osc.stop(now + dur + 0.05);
  }

  // ====== (NEW) Countdown that blurs the game background on game.html ======
  // Usage: call startCountdown(() => { /* start gameplay */ }) on the game page.
  let isCounting = false;
  async function startCountdown(onDone){
    if (isCounting) return;
    isCounting = true;
    try { await initAudio(); } catch {}

    const overlay = document.getElementById('countOverlay');
    const numEl   = document.getElementById('countNum');
    // Target #gameBg on game page; fallback to .hero if called on landing (won't blur landing now)
    const gameBg  = document.getElementById('gameBg') || document.querySelector('.hero');

    if (!overlay || !numEl || !gameBg){
      console.warn('Countdown elements missing');
      isCounting = false;
      return;
    }

    overlay.classList.add('is-visible');
    gameBg.classList.add('is-blurred');

    const seq = [3, 2, 1];
    let i = 0;

    const tick = () => {
      const n = seq[i];
      numEl.textContent = n;
      // 3→2→1 tones (420, 540, 660 Hz)
      tone(420 + i * 120, 0.28, 'sine', 0.28);
      // retrigger pop animation
      numEl.style.animation = 'none'; void numEl.offsetWidth; numEl.style.animation = '';
      i++;
      if (i < seq.length){
        setTimeout(tick, 820);
      } else {
        // GO sting, then unblur and finish
        setTimeout(() => {
          tone(880, 0.12, 'square', 0.25);
          setTimeout(() => tone(1200, 0.18, 'square', 0.2), 90);
          overlay.classList.remove('is-visible');
          gameBg.classList.remove('is-blurred');
          isCounting = false;
          document.dispatchEvent(new CustomEvent('arrowSurvival:gameStart'));
          if (typeof onDone === 'function') onDone();
        }, 780);
      }
    };
    tick();
  }

  // Expose startCountdown to the page scope (so game.html inline script can call it)
  window.startCountdown = startCountdown;
})();
