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
    ensureAudioReady();      // <-- make sure this line exists
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

    // ======================= GAME RUNTIME (12-frame sheets) =======================
  // Expects:
  //   assets/player.png   (4 rows: Down, Left, Right, Up; 3 cols: Idle, StepA, StepB)
  //   assets/attacker.png (same layout)
  // Runs on game.html after the countdown dispatches 'arrowSurvival:gameStart'

  // ---- helpers ----
  function loadImage(src){
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  class SpriteSheet {
    constructor(img, rows=4, cols=3){
      this.img = img;
      this.rows = rows; this.cols = cols;
      this.fw = Math.floor(img.width / cols);
      this.fh = Math.floor(img.height / rows);
      this.row = 0;     // 0:down, 1:left, 2:right, 3:up
      this.col = 0;     // 0..cols-1
      this.x = 400; this.y = 300;
      this.vx = 0; this.vy = 0;
      this.speed = 180;
      this.stepFps = 10;     // walk cycle speed
      this._acc = 0;
      this.scale = 0.5;
    }
    faceByVelocity(){
      const ax = Math.abs(this.vx), ay = Math.abs(this.vy);
      if (ax > ay) this.row = (this.vx > 0) ? 2 : 1;        // Right / Left
      else if (ay > 0) this.row = (this.vy > 0) ? 0 : 3;    // Down / Up
    }
    update(dt){
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const moving = (this.vx || this.vy);
      if (moving){
        this._acc += dt;
        const frameDur = 1 / this.stepFps;
        while (this._acc >= frameDur){
          this._acc -= frameDur;
          this.col = (this.col + 1) % this.cols; // 0→1→2→0
        }
      } else {
        this.col = 0; // idle
      }
    }
    draw(ctx){
      const PAD = 4; // inset to avoid sampling neighbor frame (use 1 if needed)
    
      // source rect (slightly inset)
      const sx = Math.floor(this.col * this.fw + PAD);
      const sy = Math.floor(this.row * this.fh + PAD);
      const sw = Math.ceil(this.fw - PAD * 2);
      const sh = Math.ceil(this.fh - PAD * 2);
    
      // destination size (respect scale) snapped to integers
      const scale = this.scale ?? 1;
      const dw = Math.round(this.fw * scale);
      const dh = Math.round(this.fh * scale);
    
      // destination position snapped to integers
      const dx = Math.round(this.x - dw / 2);
      const dy = Math.round(this.y - dh / 2);
    
      ctx.drawImage(this.img, sx, sy, sw, sh, dx, dy, dw, dh);
    }
    
  }

  // projectiles
  const arrows = [];
  function shootArrow(fromX, fromY, targetX, targetY){
    const dx = targetX - fromX, dy = targetY - fromY;
    const len = Math.hypot(dx, dy) || 1;
    const speed = 260;
    arrows.push({ x: fromX, y: fromY, vx: (dx/len)*speed, vy: (dy/len)*speed, life: 5 });
  }

  // keyboard
  const keys = new Set();
  window.addEventListener('keydown', e => {
    const ok = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'];
    if (ok.includes(e.key)) { keys.add(e.key); e.preventDefault(); }
  });
  window.addEventListener('keyup', e => keys.delete(e.key));

  async function initGameRuntime(){
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;        // <- no bilinear blur
    canvas.style.imageRendering = 'pixelated'; // <- CSS nearest-neighbor

    // Optional crisp pixel look:
    // ctx.imageSmoothingEnabled = false;
    // canvas.style.imageRendering = 'pixelated';

    // scale canvas to screen while keeping 800x600 logical pixels
    function fitCanvas(){
      // raw scale needed to fit 800x600 into the window
      const raw = Math.min(window.innerWidth / canvas.width,
                           window.innerHeight / canvas.height);
    
      // snap to 0.5 steps: 1.0, 1.5, 2.0, 2.5, ...
      const scale = Math.round(raw * 4) / 4;
    
      canvas.style.position = 'absolute';
      canvas.style.left = '50%';
      canvas.style.top  = '50%';
      canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }
    
    fitCanvas(); addEventListener('resize', fitCanvas);

    const [playerImg, attackerImg] = await Promise.all([
      loadImage('assets/player.png'),
      loadImage('assets/attacker.png'),
    ]);

    const player = new SpriteSheet(playerImg);
    player.x = canvas.width * 0.25;
    player.y = canvas.height * 0.5;
    player.speed = 350;
    player.scale = 1; // tweak 0.8–1.2 if needed

    const attacker = new SpriteSheet(attackerImg, 1, 1);
    attacker.x = canvas.width * 0.75;
    attacker.y = canvas.height * 0.5;
    attacker.speed = 100;
    attacker.scale = 1; // tweak 0.8–1.2 if needed

    let shootTimer = 0;
    const shootEvery = 3.0;

    function updatePlayerVelocity(){
      let vx = 0, vy = 0;
      if (keys.has('ArrowLeft') || keys.has('a'))  vx -= 1;
      if (keys.has('ArrowRight')|| keys.has('d'))  vx += 1;
      if (keys.has('ArrowUp')   || keys.has('w'))  vy -= 1;
      if (keys.has('ArrowDown') || keys.has('s'))  vy += 1;
      const len = Math.hypot(vx, vy) || 1;
      player.vx = (vx/len) * player.speed;
      player.vy = (vy/len) * player.speed;
      if (vx || vy) player.faceByVelocity();
    }

    function updateAttackerVelocity(){
      const dx = player.x - attacker.x;
      const dy = player.y - attacker.y;
      const len = Math.hypot(dx, dy) || 1;
      attacker.vx = (dx/len) * attacker.speed;
      attacker.vy = (dy/len) * attacker.speed;
      // Do NOT call attacker.faceByVelocity(); rows=1 must always stay row 0
    }

    // main loop
    let last = performance.now();
    function loop(now){
      const dt = Math.min(0.033, (now - last)/1000);
      last = now;

      updatePlayerVelocity();
      updateAttackerVelocity();

      player.update(dt);
      attacker.update(dt);

      // keep inside canvas
      const padP = Math.max(player.fw, player.fh)/2;
      const padA = Math.max(attacker.fw, attacker.fh)/2;
      player.x = Math.max(padP, Math.min(canvas.width - padP, player.x));
      player.y = Math.max(padP, Math.min(canvas.height - padP, player.y));
      attacker.x = Math.max(padA, Math.min(canvas.width - padA, attacker.x));
      attacker.y = Math.max(padA, Math.min(canvas.height - padA, attacker.y));

      // shooting
      shootTimer += dt;
      if (shootTimer >= shootEvery){
        shootTimer = 0;
        shootArrow(attacker.x, attacker.y, player.x, player.y);
      }

      // arrows update
      for (let i = arrows.length - 1; i >= 0; i--){
        const a = arrows[i];
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.life -= dt;
        if (a.life <= 0 || a.x < -50 || a.x > canvas.width+50 || a.y < -50 || a.y > canvas.height+50){
          arrows.splice(i, 1);
        }
      }

      // draw
      ctx.clearRect(0,0,canvas.width,canvas.height);

      // draw arrows as lines (replace with sprite later if you want)
      ctx.lineWidth = 3;
      for (const a of arrows){
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - a.vx*0.05, a.y - a.vy*0.05);
        ctx.stroke();
      }

      player.draw(ctx);
      attacker.draw(ctx);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // Start when countdown finishes
  document.addEventListener('arrowSurvival:gameStart', initGameRuntime);

})();
