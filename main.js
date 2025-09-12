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
  playBtn?.addEventListener('click', () => {
    showToast('Play clicked — starting game…');
    // window.location.href = 'game.html';
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
})();
