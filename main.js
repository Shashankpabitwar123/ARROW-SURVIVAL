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

  // --- Background Music (looping) ---
  let bgmBuffer = null;
  let bgmSource = null;
  let bgmGain = null;

  async function loadBgm() {
    if (!audioCtx) return;
    if (bgmBuffer) return; // already loaded
    const res = await fetch('assets/bgmusic.mp3', { cache: 'no-store' });
    const arr = await res.arrayBuffer();
    bgmBuffer = await audioCtx.decodeAudioData(arr);
    if (!bgmGain) {
      bgmGain = audioCtx.createGain();
      bgmGain.gain.value = 0; // fade in later
      bgmGain.connect(audioCtx.destination);
    }
  }

  function startBgm(volume = 0.25, fadeMs = 600) {
    // respect sound setting
    const snd = localStorage.getItem('arrowSurvival:sound') || 'on';
    if (snd !== 'on') { stopBgm(true); return; }

    if (!audioCtx || !bgmBuffer) return;
    ensureAudioReady();

    // stop any existing source first
    stopBgm(true);

    bgmSource = audioCtx.createBufferSource();
    bgmSource.buffer = bgmBuffer;
    bgmSource.loop = true;
    bgmSource.connect(bgmGain);

    const now = audioCtx.currentTime;
    try {
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.setValueAtTime(0.0001, now);
      bgmGain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume), now + fadeMs / 1000);
    } catch {}
    bgmSource.start(now);
  }

  function stopBgm(immediate = false) {
    if (!audioCtx || !bgmSource || !bgmGain) return;
    const now = audioCtx.currentTime;
    if (immediate) {
      try { bgmSource.stop(); } catch {}
      try { bgmSource.disconnect(); } catch {}
      bgmSource = null;
      try { bgmGain.gain.setValueAtTime(0.0001, now); } catch {}
      return;
    }
    try {
      bgmGain.gain.cancelScheduledValues(now);
      bgmGain.gain.setValueAtTime(bgmGain.gain.value, now);
      const end = now + 0.35;
      bgmGain.gain.exponentialRampToValueAtTime(0.0001, end);
      bgmSource.stop(end + 0.05);
    } catch {}
    setTimeout(() => {
      if (bgmSource) {
        try { bgmSource.disconnect(); } catch {}
        bgmSource = null;
      }
    }, 450);
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

  // ====== Minimal tone helper using same AudioContext ======
  function tone(freq = 600, dur = 0.3, type = 'sine', gain = 0.25){
    if (!audioCtx) return;
    ensureAudioReady();
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

  // ====== Countdown that blurs the game background on game.html ======
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

    /* HUD + Diamonds */
    const hudLives = document.getElementById('lives');
    const hudScore = document.getElementById('score');
    const gameOverEl = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    const bestScoreEl = document.getElementById('bestScore');
    const restartBtn = document.getElementById('restartBtn');
    const homeBtn = document.getElementById('homeBtn');

    let lives = 2;
    let diamonds = 0;
    let best = Number(localStorage.getItem('arrowSurvival.bestDiamonds') || 0);
    let invuln = 0;
    let isGameOver = false;

    // Diamond state
    let diamond = null;       // { x, y, size }
    let diamondTimer = null;  // timeout id

    function updateHUD(){
      hudLives.textContent = lives === 2 ? '❤️❤️' : (lives === 1 ? '❤️' : '');
      hudScore.textContent = `💎 ${diamonds}`;
    }
    function scheduleDiamondSpawn(delayMs){
      if (diamondTimer){ clearTimeout(diamondTimer); diamondTimer = null; }
      diamondTimer = setTimeout(spawnDiamond, delayMs);
    }
    function spawnDiamond(){
      const margin = 40;
      const x = Math.random() * (canvas.width - margin*2) + margin;
      const y = Math.random() * (canvas.height - margin*2) + margin;
      diamond = { x, y, size: 12 };
    }
    function collectDiamond(){
      diamonds += 1;
      diamond = null;
      updateHUD();
      scheduleDiamondSpawn(2000); // spawn next after 2s
    }
    function showGameOver(){
      stopBgm();
      isGameOver = true;
      finalScoreEl.textContent = `Score: ${diamonds}`;
      if (diamonds > best){
        best = diamonds;
        localStorage.setItem('arrowSurvival.bestDiamonds', String(best));
      }
      bestScoreEl.textContent = `Best: ${best}`;
      gameOverEl.classList.remove('hidden');
    }
    function takeHit(){
      if (invuln > 0 || isGameOver) return;
      lives = Math.max(0, lives - 1);
      invuln = 1.0; // 1 second invulnerability
      updateHUD();
      if (lives <= 0) showGameOver();
    }

    updateHUD();

    // Start background music on game start
    try {
      await initAudio();
      await loadBgm();
      startBgm(0.25, 500); // volume, fade-in ms
    } catch {}

    restartBtn?.addEventListener('click', () => { stopBgm(true); location.reload(); });
    homeBtn?.addEventListener('click', () => { stopBgm(); location.href = 'index.html'; });
    // Also stop music if the page is being closed or navigated away
    window.addEventListener('pagehide', () => stopBgm(true));
    window.addEventListener('beforeunload', () => stopBgm(true));

    scheduleDiamondSpawn(0);

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

    // -------- Difficulty → attackers count --------
    function getDifficulty(){
      try {
        return (localStorage.getItem('arrowSurvival:difficulty') || 'easy').toLowerCase();
      } catch { return 'easy'; }
    }
    const diff = getDifficulty();
    const numAttackers = (diff === 'hard') ? 3
                    : (diff === 'medium' || diff === 'normal') ? 2
                    : 1;


    const attackers = [];
    const shootEvery = 3.0;

    function spawnAttackers(n){
      for (let i = 0; i < n; i++){
        const a = new SpriteSheet(attackerImg, 1, 1);
        a.speed = 95 + Math.random() * 30;      // slight speed variance
        a.scale = 1;
    
        // spread initial positions
        const ang = (i / Math.max(1, n)) * Math.PI * 2;
        a.x = canvas.width * 0.75 + Math.cos(ang) * 150;
        a.y = canvas.height * 0.50 + Math.sin(ang) * 150;
    
        // unique orbit/strafe params
        a.phase   = Math.random() * Math.PI * 2;
        a.freq    = 0.7 + Math.random() * 0.6;  // Hz-ish
        a.orbitR  = 170  + Math.random() * 80;   // px---------------------------------------
        a.shootTimer = Math.random() * 2.0;     // stagger first shots
    
        attackers.push(a);
      }
    }
    
    spawnAttackers(numAttackers);

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

    function updateAttackersVelocity(t){
      const SEP_RADIUS   = 300;   // start pushing apart under this distance  --------------------------
      const SEP_WEIGHT   = 3;  // how strong separation bends direction  --------------------------
    
      for (const a of attackers){
        // --- target offset: strafe around player on a little orbit ---
        const dxp = player.x - a.x, dyp = player.y - a.y;
        const lenp = Math.hypot(dxp, dyp) || 1;
        const nx = dxp / lenp, ny = dyp / lenp;     // to player (unit)
        const px = -ny, py = nx;                    // perpendicular (unit)
    
        const strafe = Math.sin(t * a.freq + a.phase); // -1..1
        const tx = player.x + px * (strafe * a.orbitR);
        const ty = player.y + py * (strafe * a.orbitR);
    
        // base chase toward offset target
        let dx = tx - a.x, dy = ty - a.y;
        let len = Math.hypot(dx, dy) || 1;
        let vx = dx / len, vy = dy / len;
    
        // --- separation from other attackers (short-range repulsion) ---
        let sx = 0, sy = 0;
        for (const b of attackers){
          if (b === a) continue;
          const ddx = a.x - b.x, ddy = a.y - b.y;
          const d   = Math.hypot(ddx, ddy) || 1e-6;
          if (d < SEP_RADIUS){
            const push = (SEP_RADIUS - d) / SEP_RADIUS; // 0..1
            sx += (ddx / d) * push;
            sy += (ddy / d) * push;
          }
        }
    
        // blend base chase with separation and renormalize to speed
        vx += sx * SEP_WEIGHT;
        vy += sy * SEP_WEIGHT;
    
        len = Math.hypot(vx, vy) || 1;
        a.vx = (vx / len) * a.speed;
        a.vy = (vy / len) * a.speed;
      }
    }
    

    // main loop
    let last = performance.now();
    let elapsed = 0; 

    function loop(now){
      const dt = Math.min(0.033, (now - last)/1000);
      last = now;
      elapsed += dt;  

      if (invuln > 0) invuln = Math.max(0, invuln - dt);
      if (isGameOver) return;

      updatePlayerVelocity();
      updateAttackersVelocity(elapsed);

      player.update(dt);
      for (const a of attackers) a.update(dt);

      // keep inside canvas
      const padP = Math.max(player.fw, player.fh)/2;
      player.x = Math.max(padP, Math.min(canvas.width - padP, player.x));
      player.y = Math.max(padP, Math.min(canvas.height - padP, player.y));
      for (const a of attackers){
        const padA = Math.max(a.fw, a.fh)/2;
        a.x = Math.max(padA, Math.min(canvas.width - padA, a.x));
        a.y = Math.max(padA, Math.min(canvas.height - padA, a.y));
      }

      // per-attacker shooting
      for (const a of attackers){
        a.shootTimer = (a.shootTimer || 0) + dt;
        if (a.shootTimer >= shootEvery){
          a.shootTimer = 0;
          shootArrow(a.x, a.y, player.x, player.y);
        }
      }

      // arrows update
      for (let i = arrows.length - 1; i >= 0; i--){
        const arw = arrows[i];
        arw.x += arw.vx * dt;
        arw.y += arw.vy * dt;
        arw.life -= dt;
        if (arw.life <= 0 || arw.x < -50 || arw.x > canvas.width+50 || arw.y < -50 || arw.y > canvas.height+50){
          arrows.splice(i, 1);
        }
      }

      // COLLISION: projectiles → player
      {
        const pr = 18;
        for (let i = arrows.length - 1; i >= 0; i--){
          const a = arrows[i];
          const dx = a.x - player.x, dy = a.y - player.y;
          if (dx*dx + dy*dy <= pr*pr){
            arrows.splice(i, 1);
            takeHit();
          }
        }
      }

      // COLLISION: attacker body → player (instant game over)
      {
        const pr = 18, ar = 18;
        for (const a of attackers){
          const dx = a.x - player.x, dy = a.y - player.y;
          if (dx*dx + dy*dy <= (pr + ar) * (pr + ar)){
            lives = 0;
            updateHUD();
            showGameOver();
            break;
          }
        }
      }

      // DIAMOND collection
      if (diamond){
        const dx = diamond.x - player.x, dy = diamond.y - player.y;
        const r = 18 + diamond.size; // pickup radius
        if (dx*dx + dy*dy <= r*r){
          collectDiamond();
        }
      }

      // draw
      ctx.clearRect(0,0,canvas.width,canvas.height);

      // draw diamond as emoji (matches high score), with glow
      if (diamond){
        const _now = (typeof now === 'number' ? now : performance.now());
        const pulse = 1 + 0.06 * Math.sin(_now * 0.006);
        const px = Math.max(20, diamond.size * 1.8) * pulse; // emoji size

        ctx.save();
        ctx.translate(diamond.x, diamond.y);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `${px}px Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;

        // outer glow
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.shadowColor = 'rgba(0,220,255,0.9)';
        ctx.shadowBlur = 18;
        ctx.fillText('💎', 0, 0);
        ctx.restore();

        // glyph
        ctx.fillText('💎', 0, 0);

        ctx.restore();
      }

      // draw arrows as lines
      ctx.lineWidth = 3;
      for (const a of arrows){
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(a.x - a.vx*0.05, a.y - a.vy*0.05);
        ctx.stroke();
      }

      player.draw(ctx);
      for (const a of attackers) a.draw(ctx);

      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  // Start when countdown finishes
  document.addEventListener('arrowSurvival:gameStart', initGameRuntime);

})();
