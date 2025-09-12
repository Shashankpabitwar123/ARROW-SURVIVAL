// ---- Arrow Survival: Landing interactions (PLAY + SETTINGS) ----
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const playBtn = $('.hotspot.play');
  const settingsBtn = $('.hotspot.settings');
  const dialog = $('#settingsDialog');
  const toast = $('#toast');

  // Load click sound (wav file)
  const clickSound = new Audio('assets/click.wav');
  clickSound.volume = 0.8;

  // Play sound helper, respects "sound" setting
  function playClick(){
    const snd = localStorage.getItem('arrowSurvival:sound') || 'on';
    if (snd === 'on') {
      clickSound.cloneNode(true).play();
    }
  }

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
    // TODO: when ready -> window.location.href = 'game.html';
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
