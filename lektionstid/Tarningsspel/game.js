/* ============================================================
   TÄRNINGSSPEL — game.js
   ============================================================ */

'use strict';

// ============================================================
// KONSTANTER
// ============================================================

const CONFIG = {
  MAX_PLAYERS:        6,
  MIN_PLAYERS:        1,
  BOARD_SIZE:         100,
  MAX_GOAL:           100,
  MIN_GOAL:           5,
  DICE_FACES:         6,
  ROLL_BASE_MS:       900,
  ROLL_EXTRA_MS:      350,
  FLIP_INTERVAL_MIN:  38,
  FLIP_SLOWDOWN:      110,
  WRONG_LIMIT:        2,
  COMBO_MIN:          2,
  AUTO_SKIP_DELAY:    900,
};

/* Spelarspelarfärger (kopplade till slot-index, inte emoji) */
const PLAYER_COLORS = [
  { color: '#f97316', weak: '#ffedd5', border: '#fdba74', glow: 'rgba(249,115,22,.25)' },
  { color: '#10b981', weak: '#dcfce7', border: '#6ee7b7', glow: 'rgba(16,185,129,.25)'  },
  { color: '#3b82f6', weak: '#dbeafe', border: '#93c5fd', glow: 'rgba(59,130,246,.25)'  },
  { color: '#a855f7', weak: '#f3e8ff', border: '#d8b4fe', glow: 'rgba(168,85,247,.25)' },
  { color: '#06b6d4', weak: '#cffafe', border: '#67e8f9', glow: 'rgba(6,182,212,.25)'   },
  { color: '#ec4899', weak: '#ffe4e6', border: '#fda4af', glow: 'rgba(236,72,153,.25)'  },
];

/* Emoji-pool (spelare väljer sin figur) */
const EMOJI_POOL = [
  '🦊','🐼','🦁','🐨','🐸','🦄',
  '🐯','🐶','🐱','🐻','🐮','🐷',
  '🐹','🐰','🦋','🦅','🐲','🐬',
  '🤖','👾','🎃','🧙','🦸','🎯',
  '⭐','🚀','💎','🏆','🔥','❄️',
];

const DEFAULT_EMOJIS = ['🦊','🐼','🦁','🐨','🐸','🦄'];

/* Beröm-meddelanden */
const PRAISE = {
  combos:   ['🔥 Het!','💥 Boom!','🌟 Glänser!','⚡️ Supersnabb!','🚀 Flyger!'],
  multi:    ['Snyggt! Turbyte – kasta tärningen.','Bra jobbat! Din tur.','Toppen! Nästa spelare.'],
  solo:     ['Snyggt! Slå igen.','Bra jobbat! Kör nästa.','Toppen! Fortsätt!'],
};

// ============================================================
// SPELSTATUS
// ============================================================

const state = {
  playerCount:   2,
  current:       0,
  pos:           [0, 0],
  streak:        [0, 0],
  wins:          [0, 0, 0, 0, 0, 0],  // behålls över omgångar
  goal:          100,
  exact:         true,
  showNums:      true,
  rolled:        null,
  rolling:       false,
  winner:        null,
  wrongAttempts: 0,
  hintShown:     false,
  emojis:        [...DEFAULT_EMOJIS],
  muted:         false,
};

// ============================================================
// DOM-ELEMENT
// ============================================================

const dom = {
  board:       document.getElementById('board'),
  die:         document.getElementById('die'),
  diceWrap:    document.getElementById('diceWrap'),
  diceArea:    document.getElementById('diceArea'),
  dicePanel:   document.getElementById('dicePanel'),
  playersPanel:document.getElementById('playersPanel'),
  players:     document.getElementById('players'),
  status:      document.getElementById('status'),
  rollBtn:     document.getElementById('roll'),
  resetBtn:    document.getElementById('reset'),
  goalInput:   document.getElementById('goal'),
  goalLabel:   document.getElementById('goalLabel'),
  playerSel:   document.getElementById('playerCount'),
  exactChk:    document.getElementById('exact'),
  showNumsChk: document.getElementById('shownums'),
  muteChk:     document.getElementById('muteChk'),
  darkChk:     document.getElementById('darkChk'),
  fsBtn:       document.getElementById('fsBtn'),
  emojiPicker: document.getElementById('emojiPicker'),
  confetti:    document.getElementById('confettiCanvas'),
};

/* Cells-array indexeras 1..100 */
const cells = [null];

// ============================================================
// LJUD
// ============================================================

let audioCtx;

function initAudio() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { /* Inget ljud tillgängligt */ }
}

async function resumeAudio() {
  try { if (audioCtx?.state === 'suspended') await audioCtx.resume(); } catch {}
}

function tone(freq = 880, ms = 120, type = 'sine', vol = 0.07) {
  if (state.muted || !audioCtx) return;
  try {
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol;
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    setTimeout(() => osc.stop(), ms);
  } catch {}
}

const sound = {
  ok:    () => tone(920, 130, 'triangle', 0.08),
  error: () => tone(180, 200, 'square',   0.06),
  hint:  () => tone(520, 180, 'sine',     0.06),
  tick:  () => tone(260, 38,  'square',   0.05),
  win:   () => { tone(660, 100); setTimeout(() => tone(880, 150), 120); setTimeout(() => tone(1100, 200), 280); },
};

// ============================================================
// AKTIV SPELARFÄRG (uppdaterar CSS-variabler)
// ============================================================

function updateActiveColor() {
  const theme = PLAYER_COLORS[state.current];
  const root  = document.documentElement;
  root.style.setProperty('--active',      theme.color);
  root.style.setProperty('--active-glow', theme.glow);
}

// ============================================================
// TÄRNING — SVG-rendering
// ============================================================

/* Pip-positioner per sida */
const PIP_MAP = {
  1: [[50,50]],
  2: [[28,28],[72,72]],
  3: [[28,28],[50,50],[72,72]],
  4: [[28,28],[72,28],[28,72],[72,72]],
  5: [[28,28],[72,28],[50,50],[28,72],[72,72]],
  6: [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]],
};

function drawDie(face) {
  /* Ta bort gamla pippar */
  dom.die.querySelectorAll('circle').forEach(c => c.remove());

  const pipColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--die-pip').trim();

  (PIP_MAP[face] || PIP_MAP[1]).forEach(([cx, cy]) => {
    const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    c.setAttribute('cx', cx);
    c.setAttribute('cy', cy);
    c.setAttribute('r',  9);
    c.setAttribute('fill', pipColor);
    dom.die.appendChild(c);
  });
}

// ============================================================
// BRÄDE
// ============================================================

let goalFlagEl = null;

function buildBoard() {
  dom.board.innerHTML = '';
  cells.length = 1; // behåll null på index 0

  for (let n = 1; n <= CONFIG.BOARD_SIZE; n++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'cell';
    btn.dataset.n = n;
    btn.setAttribute('role',       'gridcell');
    btn.setAttribute('aria-label', `Ruta ${n}`);

    const span = document.createElement('span');
    span.className = 'num';
    span.textContent = n;
    btn.appendChild(span);

    dom.board.appendChild(btn);
    cells.push(btn);
  }

  /* Delegerad click-listener på brädet (mer effektivt än 100 lyssnare) */
  dom.board.addEventListener('click', onBoardClick);

  applyNumVisibility();
  updateGoalVisuals();
}

function applyNumVisibility() {
  dom.board.classList.toggle('hide-nums', !state.showNums);
}

function updateGoalVisuals() {
  dom.goalLabel.textContent = state.goal;

  /* Ta bort gamla flaggor */
  document.querySelectorAll('.goal-flag').forEach(el => el.remove());

  /* Sätt ny flagga */
  goalFlagEl = document.createElement('div');
  goalFlagEl.className = 'goal-flag';
  goalFlagEl.textContent = '🏁';
  goalFlagEl.setAttribute('aria-label', 'Målruta');
  cells[state.goal]?.appendChild(goalFlagEl);
}

// ============================================================
// SPELARPJÄSER
// ============================================================

function renderTokens() {
  document.querySelectorAll('.token').forEach(el => el.remove());

  const posMap = new Map();
  for (let i = 0; i < state.playerCount; i++) {
    const p = state.pos[i];
    if (p >= 1 && p <= state.goal) {
      if (!posMap.has(p)) posMap.set(p, []);
      posMap.get(p).push(i);
    }
  }

  posMap.forEach((players, pos) => {
    const cell = cells[pos];
    if (!cell) return;
    players.slice(0, 6).forEach((pi, slot) => {
      const t = document.createElement('div');
      t.className = `token slot-${slot + 1}`;
      t.textContent = state.emojis[pi];
      t.setAttribute('aria-hidden', 'true');
      cell.appendChild(t);
    });
  });
}

// ============================================================
// SPELARE — chips UI
// ============================================================

function buildPlayers() {
  dom.players.innerHTML = '';

  /* Justera state-arrays för spelartalet */
  while (state.pos.length    < state.playerCount) state.pos.push(0);
  while (state.streak.length < state.playerCount) state.streak.push(0);

  for (let i = 0; i < state.playerCount; i++) {
    const theme = PLAYER_COLORS[i];
    const emoji = state.emojis[i];

    const chip = document.createElement('div');
    chip.className = 'pchip';
    chip.id = `pc${i}`;
    chip.style.setProperty('--pc',   theme.color);
    chip.style.setProperty('--glow', theme.glow);

    /* Avatar (klickbar: öppnar emoji-picker) */
    const av = document.createElement('div');
    av.className = 'avatar';
    av.textContent = emoji;
    av.title = 'Klicka för att byta figur';
    av.addEventListener('click', (e) => openEmojiPicker(e, i));

    /* Info-kolumn */
    const info = document.createElement('div');
    info.className = 'info';

    const nameRow = document.createElement('div');
    nameRow.className = 'name-row';

    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = `P${i + 1}:`;

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id   = `p${i}name`;
    nameInput.value = `P${i + 1}`;
    nameInput.setAttribute('aria-label', `Namn på spelare ${i + 1}`);
    nameInput.addEventListener('keydown', e => e.stopPropagation());

    nameRow.append(tag, nameInput);

    const posWins = document.createElement('div');
    posWins.className = 'pos-wins';
    posWins.innerHTML =
      `Pos: <span class="pos-num" id="p${i}pos">0</span>` +
      (state.wins[i] ? `&nbsp;<span class="wins-badge">${state.wins[i]}W</span>` : '');

    info.append(nameRow, posWins);

    /* Din-tur-bricka */
    const turnBadge = document.createElement('div');
    turnBadge.className = 'turn-badge';
    turnBadge.textContent = 'DIN TUR';

    chip.append(av, info, turnBadge);
    dom.players.appendChild(chip);
  }
}

function updatePositionLabels() {
  for (let i = 0; i < state.playerCount; i++) {
    const el = document.getElementById(`p${i}pos`);
    if (el) el.textContent = state.pos[i];
  }
}

function updateTurnIndicators() {
  for (let i = 0; i < state.playerCount; i++) {
    document.getElementById(`pc${i}`)?.classList.toggle('is-turn', i === state.current);
  }
}

// ============================================================
// EMOJI-PICKER
// ============================================================

let activePicker = null; // { playerIndex }

function openEmojiPicker(e, playerIndex) {
  e.stopPropagation();

  /* Stäng om redan öppen för samma spelare */
  if (!dom.emojiPicker.classList.contains('hidden') &&
      activePicker === playerIndex) {
    closeEmojiPicker();
    return;
  }

  activePicker = playerIndex;
  dom.emojiPicker.innerHTML = '';

  EMOJI_POOL.forEach(emoji => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'emoji-opt';
    if (emoji === state.emojis[playerIndex]) btn.classList.add('selected');
    btn.textContent = emoji;
    btn.title = emoji;
    btn.addEventListener('click', () => {
      state.emojis[playerIndex] = emoji;
      /* Uppdatera avatar i chip */
      document.getElementById(`pc${playerIndex}`)
        ?.querySelector('.avatar')
        ?.textContent && (
          document.getElementById(`pc${playerIndex}`).querySelector('.avatar').textContent = emoji
        );
      renderTokens();
      closeEmojiPicker();
    });
    dom.emojiPicker.appendChild(btn);
  });

  /* Positionera pickern nära avataren */
  const rect = e.currentTarget.getBoundingClientRect();
  dom.emojiPicker.classList.remove('hidden');

  const pw = dom.emojiPicker.offsetWidth || 280;
  const ph = dom.emojiPicker.offsetHeight || 200;
  let left = rect.right + 8;
  let top  = rect.top;

  /* Klipp om pickern hamnar utanför fönstret */
  if (left + pw > window.innerWidth)  left = rect.left - pw - 8;
  if (top  + ph > window.innerHeight) top  = window.innerHeight - ph - 8;

  dom.emojiPicker.style.left = `${Math.max(4, left)}px`;
  dom.emojiPicker.style.top  = `${Math.max(4, top)}px`;
}

function closeEmojiPicker() {
  dom.emojiPicker.classList.add('hidden');
  activePicker = null;
}

/* Stäng om man klickar utanför */
document.addEventListener('click', (e) => {
  if (!dom.emojiPicker.classList.contains('hidden') &&
      !dom.emojiPicker.contains(e.target)) {
    closeEmojiPicker();
  }
});

// ============================================================
// SPELLOGIK
// ============================================================

function targetCell()   { return state.pos[state.current] + (state.rolled ?? 0); }
function isGameOver()   { return state.winner !== null; }

function canRoll() {
  return !isGameOver() && state.rolled === null && !state.rolling;
}

function pickMsg(arr)   { return arr[Math.floor(Math.random() * arr.length)]; }

function getPraise(isSolo = false) {
  const prevIdx  = isSolo
    ? state.current
    : (state.current - 1 + state.playerCount) % state.playerCount;
  const streak = state.streak[prevIdx] || 0;
  if (streak >= CONFIG.COMBO_MIN) {
    return `${pickMsg(PRAISE.combos)} Combo x${streak}!${isSolo ? ' Slå igen.' : ''}`;
  }
  return pickMsg(isSolo ? PRAISE.solo : PRAISE.multi);
}

/* Korrekt cellval */
function onCorrect(n) {
  sound.ok();

  if (state.wrongAttempts === 0) {
    state.streak[state.current] = (state.streak[state.current] || 0) + 1;
  } else {
    state.streak[state.current] = 0;
  }

  state.pos[state.current] = n;

  if (n === state.goal) {
    state.winner = state.current;
    state.wins[state.current]++;
    sound.win();
    launchConfetti();
    updateUI();
    return;
  }

  state.rolled = null;
  state.hintShown = false;
  state.wrongAttempts = 0;

  const msg = getPraise(state.playerCount === 1);
  state.current = (state.current + 1) % state.playerCount;
  updateActiveColor();
  updateUI(msg);
}

/* Felaktigt cellval */
function onWrong(cellEl) {
  state.wrongAttempts++;
  state.streak[state.current] = 0;

  if (state.wrongAttempts === 1) {
    dom.status.textContent = 'Fel (1/2) – försök igen.';
    sound.error();
  } else {
    state.hintShown = true;
    dom.status.textContent = `Fel igen. Rätt är ${targetCell()}. Klicka på den markerade pricken.`;
    sound.hint();
    updateUI();
  }

  cellEl.animate(
    [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-6px)' },
      { transform: 'translateX(6px)' },
      { transform: 'translateX(0)' },
    ],
    { duration: 160 }
  );
}

/* Board-klick (delegerat) */
function onBoardClick(e) {
  const cell = e.target.closest('.cell');
  if (!cell || isGameOver() || state.rolled === null || state.rolling) return;

  const n = Number(cell.dataset.n);
  if (n === targetCell()) onCorrect(n);
  else onWrong(cell);
}

// ============================================================
// TÄRNINGSKAST
// ============================================================

function rndFace(exclude = 0) {
  let r;
  do { r = 1 + Math.floor(Math.random() * CONFIG.DICE_FACES); } while (r === exclude);
  return r;
}

async function handleRollResult(result) {
  drawDie(result);
  state.rolled  = result;
  state.rolling = false;
  updateUI();

  const startPos   = state.pos[state.current];
  const wouldPass  = startPos + result > state.goal;

  if (state.exact && wouldPass) {
    const isSolo = state.playerCount === 1;
    updateUI(
      isSolo
        ? `Du slog ${result} och passerar målet – slag passas, försök igen.`
        : `Du slog ${result} men passerar målet. Turen går vidare…`
    );

    await new Promise(r => setTimeout(r, CONFIG.AUTO_SKIP_DELAY));

    state.rolled      = null;
    state.hintShown   = false;
    state.wrongAttempts = 0;

    if (!isSolo) {
      state.current = (state.current + 1) % state.playerCount;
      updateActiveColor();
    }
    updateUI();
  }
}

async function rollDice() {
  await resumeAudio();
  if (!canRoll()) return;

  state.wrongAttempts = 0;
  state.hintShown     = false;
  state.rolling       = true;
  updateUI();

  const totalMs = CONFIG.ROLL_BASE_MS + Math.random() * CONFIG.ROLL_EXTRA_MS;
  const t0      = performance.now();
  let lastFace  = 1;
  let nextFlip  = 0;

  const result = await new Promise(resolve => {
    function loop(now) {
      const elapsed  = now - t0;
      const progress = Math.min(1, elapsed / totalMs);
      const interval = CONFIG.FLIP_INTERVAL_MIN + CONFIG.FLIP_SLOWDOWN * progress * progress;

      if (elapsed >= nextFlip) {
        lastFace = rndFace(lastFace);
        drawDie(lastFace);
        sound.tick();
        nextFlip = elapsed + interval;
      }

      if (elapsed < totalMs) {
        requestAnimationFrame(loop);
      } else {
        resolve(rndFace(lastFace));
      }
    }
    requestAnimationFrame(loop);
  });

  await handleRollResult(result);
}

// ============================================================
// UI-UPPDATERING
// ============================================================

function clearHints()   { cells.forEach(c => c?.classList.remove('hint')); }

function paintBoard() {
  for (let n = 1; n <= CONFIG.BOARD_SIZE; n++) {
    const c = cells[n];
    if (!c) continue;

    /* Rensa gamla klasser utan att påverka .beyond och statiska klasser */
    c.className = c.className
      .replace(/\breached-\d\b/g, '')
      .replace(/\bcurrent-\d\b/g, '')
      .trim();

    c.classList.toggle('beyond', n > state.goal);
    c.disabled = isGameOver() || state.rolling || state.rolled === null || n > state.goal;
  }

  for (let i = 0; i < state.playerCount; i++) {
    const pos = state.pos[i];
    for (let n = 1; n <= Math.min(pos, state.goal); n++) {
      cells[n]?.classList.add(`reached-${i + 1}`);
    }
    if (pos >= 1 && pos <= state.goal) {
      cells[pos]?.classList.add(`current-${i + 1}`);
    }
  }
}

function updateStatus(msg = null) {
  if (msg) { dom.status.textContent = msg; return; }

  if (isGameOver()) {
    const name = document.getElementById(`p${state.winner}name`)?.value || `P${state.winner + 1}`;
    dom.status.textContent = `${name} vann! 🎉`;
    return;
  }

  const name = document.getElementById(`p${state.current}name`)?.value || `P${state.current + 1}`;

  if (state.rolled === null) {
    dom.status.textContent = `Tur: ${name}. Kasta tärningen!`;
  } else if (!state.hintShown) {
    dom.status.textContent = `Slått: ${state.rolled}. Välj rätt prick.`;
  } else {
    dom.status.textContent = `Rätt svar är ${targetCell()}. Klicka på den markerade pricken.`;
  }
}

function updateControls() {
  const busy          = isGameOver() || state.rolling;
  dom.rollBtn.disabled  = busy || state.rolled !== null;
  dom.resetBtn.disabled = state.rolling;
}

function updateUI(msg = null) {
  updateActiveColor();
  updateTurnIndicators();
  updatePositionLabels();
  paintBoard();
  clearHints();

  /* Visa hint om needed */
  if (state.hintShown && state.rolled !== null) {
    const t = targetCell();
    if (!(state.exact && t > state.goal)) {
      cells[t]?.classList.add('hint');
    }
  }

  renderTokens();
  updateControls();
  updateStatus(msg);

  dom.diceArea.classList.toggle('rolling', state.rolling);
}

// ============================================================
// KONFETTI
// ============================================================

function launchConfetti() {
  const canvas = dom.confetti;
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';

  const ctx    = canvas.getContext('2d');
  const colors = PLAYER_COLORS.map(p => p.color);
  const pieces = [];

  for (let i = 0; i < 160; i++) {
    pieces.push({
      x:  Math.random() * canvas.width,
      y:  -20 - Math.random() * 120,
      vx: (Math.random() - 0.5) * 5,
      vy: 2.5 + Math.random() * 4,
      color:  colors[Math.floor(Math.random() * colors.length)],
      size:   5 + Math.random() * 8,
      rot:    Math.random() * Math.PI * 2,
      rotSpd: (Math.random() - 0.5) * 0.18,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      p.x   += p.vx;
      p.y   += p.vy;
      p.vy  += 0.06;
      p.rot += p.rotSpd;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.4, p.size, p.size * 0.5);
      ctx.restore();
    });
    frame++;
    if (frame < 220) requestAnimationFrame(animate);
    else canvas.style.display = 'none';
  }

  requestAnimationFrame(animate);
}

// ============================================================
// FULLSKÄRM
// ============================================================

dom.fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.().catch(() => {});
  } else {
    document.exitFullscreen?.();
  }
});

// ============================================================
// MUTE-CHECKBOX
// ============================================================

dom.muteChk.checked = true; // Ljud på som default
dom.muteChk.addEventListener('change', () => {
  state.muted = !dom.muteChk.checked;
});

// ============================================================
// DARK MODE
// ============================================================

(function initDarkMode() {
  const saved = localStorage.getItem('tarning-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    dom.darkChk.checked = true;
  }

  dom.darkChk.addEventListener('change', () => {
    if (dom.darkChk.checked) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('tarning-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('tarning-theme', 'light');
    }
    /* Rita om tärningens pip-färg med nya CSS-variabler */
    drawDie(state.rolled ?? 1);
  });
})();

// ============================================================
// REGLER MODAL
// ============================================================

const rulesModal = document.getElementById('rulesModal');
const rulesBtn = document.getElementById('rulesBtn');
const closeRules = document.getElementById('closeRules');

rulesBtn.addEventListener('click', () => {
  rulesModal.classList.remove('hidden');
});

closeRules.addEventListener('click', () => {
  rulesModal.classList.add('hidden');
});

rulesModal.addEventListener('click', (e) => {
  if (e.target === rulesModal) {
    rulesModal.classList.add('hidden');
  }
});

// ============================================================
// GOAL PRESET BUTTONS
// ============================================================

document.querySelectorAll('.nav-btn[data-goal]').forEach(btn => {
  btn.addEventListener('click', () => {
    // Remove active from all
    document.querySelectorAll('.nav-btn[data-goal]').forEach(b => b.classList.remove('active'));
    // Add active to clicked
    btn.classList.add('active');
    // Update goal
    dom.goalInput.value = btn.dataset.goal;
    dom.goalInput.dispatchEvent(new Event('change'));
  });
});

// ============================================================
// KONTROLL-EVENTS
// ============================================================

/* Kasta */
dom.rollBtn.addEventListener('click', rollDice);
dom.diceWrap.addEventListener('click', rollDice);
dom.diceWrap.addEventListener('keydown', e => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rollDice(); }
});
document.addEventListener('keydown', e => {
  if (e.code === 'Space' && !e.target.matches('input,select,button')) {
    e.preventDefault(); rollDice();
  }
});

/* Ny omgång */
dom.resetBtn.addEventListener('click', () => {
  if (state.rolling) return;
  for (let i = 0; i < state.playerCount; i++) {
    state.pos[i]    = 0;
    state.streak[i] = 0;
  }
  state.current       = 0;
  state.rolled        = null;
  state.winner        = null;
  state.hintShown     = false;
  state.wrongAttempts = 0;
  drawDie(1);
  /* Uppdatera vinstmärken i chips */
  buildPlayers();
  updateUI('Nytt spel! P1 börjar.');
});

/* Exakt mål */
dom.exactChk.addEventListener('change', e => {
  state.exact = e.target.checked;
  updateUI();
});

/* Visa siffror */
dom.showNumsChk.addEventListener('change', e => {
  state.showNums = e.target.checked;
  applyNumVisibility();
});

/* Mål-input */
dom.goalInput.addEventListener('change', () => {
  const v = Math.max(CONFIG.MIN_GOAL, Math.min(CONFIG.MAX_GOAL, Number(dom.goalInput.value) || 100));
  state.goal = v;
  for (let i = 0; i < state.playerCount; i++) {
    state.pos[i] = Math.min(state.pos[i], state.goal);
  }
  updateGoalVisuals();
  renderTokens();
  updateUI(`Mål satt till ${state.goal}.`);
});

/* Antal spelare */
dom.playerSel.addEventListener('change', () => {
  const v = Math.max(1, Math.min(6, Number(dom.playerSel.value) || 1));
  state.playerCount = v;
  state.current     = 0;
  state.rolled      = null;
  state.winner      = null;
  buildPlayers();
  renderTokens();
  updateUI(`Antal spelare: ${v}.`);
});

// ============================================================
// INIT
// ============================================================

(function init() {
  initAudio();
  buildPlayers();
  buildBoard();
  drawDie(1);
  updateActiveColor();
  updateUI();
})();
