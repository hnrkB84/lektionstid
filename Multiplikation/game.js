'use strict';

// ============================================================
// KONSTANTER
// ============================================================
const PLAYER_COLORS = [
  { color:'#f97316', weak:'#ffedd5', border:'#fdba74', glow:'rgba(249,115,22,.18)'  },
  { color:'#10b981', weak:'#dcfce7', border:'#6ee7b7', glow:'rgba(16,185,129,.18)' },
  { color:'#3b82f6', weak:'#dbeafe', border:'#93c5fd', glow:'rgba(59,130,246,.18)' },
  { color:'#a855f7', weak:'#f3e8ff', border:'#d8b4fe', glow:'rgba(168,85,247,.18)' },
  { color:'#06b6d4', weak:'#cffafe', border:'#67e8f9', glow:'rgba(6,182,212,.18)'  },
  { color:'#ec4899', weak:'#ffe4e6', border:'#fda4af', glow:'rgba(236,72,153,.18)' },
];
const EMOJI_POOL    = ['🦊','🐼','🦁','🐨','🐸','🦄','🐯','🐶','🐱','🐻','🐮','🐷','🐹','🐰','🦋','🦅','🐲','🐬','🤖','👾','🎃','🧙','🦸','🎯','⭐','🚀','💎','🏆','🔥','❄️'];
const DEFAULT_EMOJIS= ['🦊','🐼','🦁','🐨','🐸','🦄'];
const ALL_TABLES    = [1,2,3,4,5,6,7,8,9,10];

const COMMENTS = {
  start: [
    'Välj inställningar ovan och tryck Starta!',
    'Faktor × faktor = produkt. Lycka till!',
    'Redo? Ange inställningar och tryck Starta!',
  ],
  correct_first: [
    (a,b,ans) => `Rätt! ${a} och ${b} är faktorerna — ${ans} är produkten. ✓`,
    (a,b,ans) => `Perfekt! ${a} × ${b} = ${ans}. Snabbt och rätt!`,
    (a,b,ans) => `${ans} stämmer! ${a}-tabellen sitter som en smäck.`,
    (a,b,ans) => `Bra! Produkten ${ans} är ${a} adderat ${b} gånger.`,
    (a,b,ans) => `Rätt produkt! ${a} × ${b} kan också skrivas ${b} × ${a} = ${ans}.`,
    (a,b,ans) => `✓ Korrekt! Faktorerna ${a} och ${b} ger alltid produkten ${ans}.`,
  ],
  correct_second: [
    (a,b,ans) => `Rätt på andra försöket! ${ans} är produkten av ${a} × ${b}.`,
    (a,b,ans) => `Det där satt! Kom ihåg: ${a} × ${b} = ${ans}.`,
    (a,b,ans) => `Bra kämpat! Produkten ${ans} är värd att minnas.`,
  ],
  wrong_hint: [
    (a,b,ans) => `Tips: ${a} × ${b} betyder ${a} adderat ${b} gånger. Svaret är ${ans}.`,
    (a,b,ans) => `Faktorn ${a} multiplicerat med ${b} ger produkten ${ans}.`,
    (a,b,ans) => `Rätt svar: ${ans}. Tänk: ${b} grupper med ${a} i varje = ${ans}.`,
  ],
  wrong_reveal: [
    (a,b,ans) => `Produkten av ${a} × ${b} är ${ans}. Nästa spelare!`,
    (a,b,ans) => `Svaret var ${ans}. ${a}-tabellen: kolla gärna igen!`,
    (a,b,ans) => `${a} × ${b} = ${ans}. Öva på ${a}-tabellen!`,
  ],
  streak: [
    n => `🔥 ${n} rätt i rad! Faktorerna faller på plats!`,
    n => `💥 Combo x${n}! Du multiplicerar som ett proffs!`,
    n => `⚡️ ${n} i rad! Produkterna bara haglar!`,
  ],
  waiting: [
    'Skriv svaret och tryck Enter!',
    'Vad är produkten? Skriv och tryck Enter.',
    'Beräkna produkten och tryck Enter!',
  ],
};

function pick(arr, ...args) {
  const item = arr[Math.floor(Math.random() * arr.length)];
  return typeof item === 'function' ? item(...args) : item;
}

// ============================================================
// STATE
// ============================================================
const state = {
  playerCount:    2,
  current:        0,
  scores:         [],
  streak:         [],
  wins:           [0,0,0,0,0,0],
  goal:           1000,
  maxAttempts:    1,
  tablePreset:    'all',
  customTables:   [...ALL_TABLES],
  currentQ:       null,
  wrongAttempts:  0,
  questionActive: false,
  winner:         null,
  emojis:         [...DEFAULT_EMOJIS],
  muted:          false,
  gameStarted:    false,
};

const $ = id => document.getElementById(id);
const dom = {
  activeAvatar:   $('activeAvatar'),
  activeName:     $('activeName'),
  activeComment:  $('activeComment'),
  activeScore:    $('activeScore'),
  questionBox:    $('questionBox'),
  factorA:        $('factorA'),
  factorB:        $('factorB'),
  labelA:         $('labelA'),
  labelB:         $('labelB'),
  answerDisplay:  $('answerDisplay'),
  answerValue:    $('answerValue'),
  answerInput:    $('answerInput'),   // dolt, för desktop-tangentbord
  numpad:         $('numpad'),
  npEnter:        $('npEnter'),
  npDel:          $('npDel'),
  termLabel:      $('termLabel'),
  dot1:           $('dot1'),
  dot2:           $('dot2'),
  statusBar:      $('statusBar'),
  players:        $('players'),
  emojiPicker:    $('emojiPicker'),
  confetti:       $('confettiCanvas'),
  playerBtns:     $('playerBtns'),
  goalBtns:       $('goalBtns'),
  chancesBtns:    $('chancesBtns'),
  presetBtns:     $('presetBtns'),
  customTableRow: $('customTableRow'),
  lockNote:       $('settingsLockNote'),
  resetBtn:       $('resetBtn'),
  muteChk:        $('muteChk'),
  darkChk:        $('darkChk'),
  fsBtn:          $('fsBtn'),
  rulesBtn:       $('rulesBtn'),
  rulesOverlay:   $('rulesOverlay'),
  rulesClose:     $('rulesClose'),
  startBtn:       $('startBtn'),
};

// ── Numpad state ──────────────────────────────────
let numpadValue = '';

// ============================================================
// LJUD
// ============================================================
let audioCtx;
function initAudio() { try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch {} }
async function resumeAudio() { try { if (audioCtx?.state==='suspended') await audioCtx.resume(); } catch {} }
function tone(freq=880,ms=120,type='sine',vol=0.07) {
  if (state.muted||!audioCtx) return;
  try {
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=vol;
    o.connect(g).connect(audioCtx.destination);
    o.start(); setTimeout(()=>o.stop(),ms);
  } catch {}
}
const sound = {
  ok:    ()=>{ tone(660,80,'triangle',.07); setTimeout(()=>tone(880,120,'triangle',.07),90); },
  error: ()=>tone(180,220,'square',.06),
  hint:  ()=>tone(520,180,'sine',.06),
  win:   ()=>{ tone(660,100); setTimeout(()=>tone(880,150),120); setTimeout(()=>tone(1100,200),280); },
};

// ============================================================
// AKTIV SPELARFÄRG
// ============================================================
function updateActiveColor() {
  const t = PLAYER_COLORS[state.current];
  const r = document.documentElement;
  r.style.setProperty('--active',      t.color);
  r.style.setProperty('--active-glow', t.glow);
  r.style.setProperty('--active-weak', t.weak);
}

// ============================================================
// TABELLVAL — bara all eller custom
// ============================================================
function getActiveTables() {
  if (state.tablePreset === 'all') return ALL_TABLES;
  return state.customTables.length ? state.customTables : ALL_TABLES;
}

// ============================================================
// FRÅGELOGIK
// ============================================================
function isGameOver() { return state.winner !== null; }

function generateAndShow() {
  resumeAudio();
  const tables = getActiveTables();
  const a = tables[Math.floor(Math.random() * tables.length)];
  const b = Math.floor(Math.random() * 10) + 1;
  state.currentQ      = { a, b, answer: a * b };
  state.wrongAttempts = 0;
  state.questionActive= true;

  if (!state.gameStarted) {
    state.gameStarted = true;
    setSettingsLocked(true);
  }

  updateActiveBanner(pick(COMMENTS.waiting));
  renderQuestion();
  renderAttemptDots();
  updateTurnIndicators();
  dom.termLabel.textContent = 'faktor × faktor = produkt';
  resetNumpad();
  dom.numpad.classList.remove('hidden');
  dom.answerDisplay.classList.add('active');
}

function renderQuestion() {
  const q = state.currentQ;
  if (!q) {
    dom.factorA.textContent = '–'; dom.factorB.textContent = '–';
    dom.labelA.textContent  = '';  dom.labelB.textContent  = '';
    dom.answerDisplay.classList.remove('active','correct');
    dom.numpad.classList.add('hidden');
    resetNumpad();
    return;
  }
  dom.factorA.textContent = q.a;
  dom.factorB.textContent = q.b;
  dom.labelA.textContent  = 'faktor';
  dom.labelB.textContent  = 'faktor';
  dom.answerDisplay.classList.remove('correct');
}

function renderAttemptDots() {
  const show = state.maxAttempts >= 2;
  dom.dot1.style.display = show ? '' : 'none';
  dom.dot2.style.display = show ? '' : 'none';
  dom.dot1.classList.remove('used');
  dom.dot2.classList.remove('used');
}

function onAnswer() {
  if (!state.questionActive || isGameOver()) return;
  const val = parseInt(numpadValue, 10);
  if (isNaN(val) || numpadValue === '') return;
  const { a, b, answer } = state.currentQ;
  val === answer ? handleCorrect(a, b, answer) : handleWrong(a, b, answer);
}

function handleCorrect(a, b, answer) {
  sound.ok();
  const pi = state.current;
  const pts = answer;
  const wasFirst = state.wrongAttempts === 0;
  wasFirst ? (state.streak[pi] = (state.streak[pi]||0) + 1) : (state.streak[pi] = 0);
  state.scores[pi]     = (state.scores[pi]||0) + pts;
  state.questionActive = false;

  const comment = wasFirst
    ? pick(COMMENTS.correct_first, a, b, answer)
    : pick(COMMENTS.correct_second, a, b, answer);

  dom.answerDisplay.classList.add('correct');
  dom.numpad.classList.add('hidden');
  dom.npEnter.disabled = true;
  dom.termLabel.textContent = `${a} × ${b} = produkt ← ${answer} ✓`;

  spawnFloatPoints(pts);
  dom.questionBox.classList.add('pop');
  setTimeout(() => dom.questionBox.classList.remove('pop'), 350);
  updateActiveBanner(comment);
  updateScoreInBanner();
  updateScores();

  const scoreEl = $('stageScore');
  if (scoreEl) {
    scoreEl.classList.remove('popping');
    void scoreEl.offsetWidth;
    scoreEl.classList.add('popping');
    setTimeout(() => scoreEl.classList.remove('popping'), 380);
  }

  if ((state.streak[pi]||0) >= 3) showStreakToast(pick(COMMENTS.streak, state.streak[pi]));
  dom.statusBar.textContent = `+${pts}p → ${state.scores[pi].toLocaleString('sv')}p`;

  if (state.scores[pi] >= state.goal) {
    setTimeout(() => {
      state.winner = pi; state.wins[pi]++;
      sound.win(); updateTurnIndicators(); launchConfetti(); showWinOverlay(pi);
    }, 700);
    return;
  }

  setTimeout(() => {
    state.current = (state.current + 1) % state.playerCount;
    updateActiveColor(); updateTurnIndicators(); generateAndShow(); updateScores();
  }, 950);
}

function handleWrong(a, b, answer) {
  sound.error();
  state.wrongAttempts++;
  state.streak[state.current] = 0;
  dom.answerDisplay.classList.add('shake');
  setTimeout(() => dom.answerDisplay.classList.remove('shake'), 380);
  resetNumpad();

  if (state.maxAttempts >= 2 && state.wrongAttempts < state.maxAttempts) {
    dom.dot1.classList.add('used');
    updateActiveBanner(pick(COMMENTS.wrong_hint, a, b, answer));
    dom.statusBar.textContent = 'Fel — ett försök kvar!';
  } else {
    if (state.maxAttempts >= 2) dom.dot2?.classList.add('used');
    state.questionActive = false;
    dom.numpad.classList.add('hidden');
    const comment = state.maxAttempts >= 2
      ? pick(COMMENTS.wrong_reveal, a, b, answer)
      : pick(COMMENTS.wrong_hint, a, b, answer);
    updateActiveBanner(comment);
    dom.termLabel.textContent = `${a} × ${b} = ${answer} (rätt svar)`;
    dom.statusBar.textContent = `Svaret var ${answer} — nästa spelare`;
    updateScores();
    setTimeout(() => {
      state.current = (state.current + 1) % state.playerCount;
      updateActiveColor(); updateTurnIndicators(); generateAndShow(); updateScores();
    }, 1800);
  }
}

// ============================================================
// ACTIVE BANNER & STAGE
// ============================================================
function updateActiveBanner(comment) {
  const pi = state.current;
  const score = state.scores[pi]||0;
  dom.activeAvatar.textContent  = state.emojis[pi];
  dom.activeName.textContent    = getPlayerName(pi);
  dom.activeComment.textContent = comment || '';
  dom.activeScore.textContent   = `${score.toLocaleString('sv')}p`;
  updateStage(pi, score);
}

function updateStage(pi, score) {
  $('stageEmoji').textContent = state.emojis[pi];
  $('stageName').textContent  = getPlayerName(pi);
  const scoreEl = $('stageScore');
  scoreEl.textContent = (score||0).toLocaleString('sv');
  $('stageGoal').textContent  = `/ ${state.goal.toLocaleString('sv')} p`;
  const pct  = Math.min(100, ((score||0) / state.goal) * 100);
  const fill = $('stageBarFill');
  if (fill) { fill.style.width = `${pct}%`; fill.style.background = PLAYER_COLORS[pi].color; }
  const stage = $('playerStage');
  if (stage) {
    stage.style.background  = 'var(--active-weak)';
    stage.style.borderColor = PLAYER_COLORS[pi].color;
    stage.style.boxShadow   = `0 0 0 2px ${PLAYER_COLORS[pi].glow}`;
  }
}

function updateScoreInBanner() {
  const pi = state.current;
  dom.activeScore.textContent = `${(state.scores[pi]||0).toLocaleString('sv')}p`;
  updateStage(pi, state.scores[pi]||0);
}

// ============================================================
// FLOAT POINTS
// ============================================================
function spawnFloatPoints(pts) {
  const rect = dom.answerDisplay.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = 'float-pts'; el.textContent = `+${pts}p`;
  el.style.left = `${rect.left + rect.width/2 - 30}px`;
  el.style.top  = `${rect.top - 10}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 950);
}

// ============================================================
// STREAK TOAST
// ============================================================
function showStreakToast(msg) {
  const el = document.createElement('div');
  el.className = 'streak-toast'; el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

// ============================================================
// PLAYERS UI
// ============================================================
function buildPlayers() {
  dom.players.innerHTML = '';
  while (state.scores.length < state.playerCount) state.scores.push(0);
  while (state.streak.length < state.playerCount) state.streak.push(0);

  for (let i = 0; i < state.playerCount; i++) {
    const t = PLAYER_COLORS[i];
    const chip = document.createElement('div');
    chip.className = 'pchip'; chip.id = `pc${i}`;
    chip.style.setProperty('--pc',   t.color);
    chip.style.setProperty('--glow', t.glow);

    const top = document.createElement('div'); top.className = 'chip-top';
    const av  = document.createElement('div');
    av.className = 'avatar'; av.textContent = state.emojis[i];
    av.title = 'Klicka för att byta figur';
    av.addEventListener('click', e => openEmojiPicker(e, i));

    const info     = document.createElement('div'); info.className = 'chip-info';
    const nameRow  = document.createElement('div'); nameRow.className = 'chip-namerow';
    const tag      = document.createElement('span');
    tag.className  = 'chip-tag'; tag.textContent = `P${i+1}:`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text'; nameInput.id = `p${i}name`; nameInput.value = `P${i+1}`;
    nameInput.setAttribute('aria-label', `Namn P${i+1}`);
    nameInput.addEventListener('keydown', e => e.stopPropagation());
    nameInput.addEventListener('change', () => { if (state.current === i) updateActiveBanner(dom.activeComment.textContent); });
    nameRow.append(tag, nameInput);

    const scoreRow = document.createElement('div');
    scoreRow.style.cssText = 'display:flex;align-items:baseline;gap:4px;';
    const scoreNum = document.createElement('span');
    scoreNum.className = 'chip-score'; scoreNum.id = `p${i}score`;
    scoreNum.textContent = (state.scores[i]||0).toLocaleString('sv');
    const goalSpan = document.createElement('span');
    goalSpan.className = 'chip-goal'; goalSpan.id = `p${i}goal`;
    goalSpan.textContent = `/ ${state.goal.toLocaleString('sv')} p`;
    scoreRow.append(scoreNum, goalSpan);
    info.append(nameRow, scoreRow);
    top.append(av, info);

    const badges = document.createElement('div');
    badges.className = 'chip-badges'; badges.id = `p${i}badges`;
    const turnBadge = document.createElement('span');
    turnBadge.className = 'badge badge-turn'; turnBadge.textContent = 'Din tur';
    badges.appendChild(turnBadge);

    const track = document.createElement('div'); track.className = 'progress-track';
    const fill  = document.createElement('div'); fill.className = 'progress-fill';
    fill.id = `p${i}fill`; fill.style.background = t.color;
    fill.style.width = `${Math.min(100,(state.scores[i]||0)/state.goal*100)}%`;
    track.appendChild(fill);

    chip.append(top, badges, track);
    dom.players.appendChild(chip);
  }
  updateTurnIndicators();
  updateScores();
}

function updateTurnIndicators() {
  for (let i = 0; i < state.playerCount; i++)
    $(`pc${i}`)?.classList.toggle('is-turn', i === state.current);
}

function updateScores() {
  const maxScore = Math.max(...state.scores.slice(0, state.playerCount));
  for (let i = 0; i < state.playerCount; i++) {
    const score  = state.scores[i]||0;
    const el     = $(`p${i}score`);
    const fill   = $(`p${i}fill`);
    const goal   = $(`p${i}goal`);
    const badges = $(`p${i}badges`);
    if (el)   el.textContent   = score.toLocaleString('sv');
    if (goal) goal.textContent = `/ ${state.goal.toLocaleString('sv')} p`;
    if (fill) fill.style.width = `${Math.min(100, score/state.goal*100)}%`;
    if (badges) {
      badges.innerHTML = '';
      if (state.wins[i]) {
        const bw = document.createElement('span');
        bw.className = 'badge badge-wins'; bw.textContent = `🏆 ${state.wins[i]}`;
        badges.appendChild(bw);
      }
      if ((state.streak[i]||0) >= 3) {
        const bs = document.createElement('span');
        bs.className = 'badge badge-streak'; bs.textContent = `🔥 ${state.streak[i]}`;
        badges.appendChild(bs);
      }
      if (score === maxScore && score > 0 && state.playerCount > 1) {
        const bl = document.createElement('span');
        bl.className = 'badge badge-lead'; bl.textContent = '🥇 Leder';
        badges.appendChild(bl);
      }
      const bt = document.createElement('span');
      bt.className = 'badge badge-turn'; bt.textContent = 'Din tur';
      badges.appendChild(bt);
    }
  }
}

function getPlayerName(i) { return $(`p${i}name`)?.value || `P${i+1}`; }

// ============================================================
// SETTINGS LOCK
// ============================================================
function setSettingsLocked(locked) {
  ['playerBtns','goalBtns','presetBtns','customTableRow','chancesBtns'].forEach(id => {
    $(id)?.querySelectorAll('button').forEach(b => { b.disabled = locked; });
  });
  if (locked) dom.lockNote.classList.remove('hidden');
  else        dom.lockNote.classList.add('hidden');
}

// ============================================================
// EMOJI PICKER
// ============================================================
let activePicker = null;
function openEmojiPicker(e, pi) {
  e.stopPropagation();
  if (!dom.emojiPicker.classList.contains('hidden') && activePicker === pi) {
    closeEmojiPicker(); return;
  }
  activePicker = pi;
  dom.emojiPicker.innerHTML = '';
  EMOJI_POOL.forEach(em => {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'emoji-opt';
    if (em === state.emojis[pi]) btn.classList.add('selected');
    btn.textContent = em;
    btn.addEventListener('click', () => {
      state.emojis[pi] = em;
      $(`pc${pi}`)?.querySelector('.avatar') && ($(`pc${pi}`).querySelector('.avatar').textContent = em);
      if (state.current === pi) dom.activeAvatar.textContent = em;
      closeEmojiPicker();
    });
    dom.emojiPicker.appendChild(btn);
  });
  const rect = e.currentTarget.getBoundingClientRect();
  dom.emojiPicker.classList.remove('hidden');
  const pw = dom.emojiPicker.offsetWidth||280, ph = dom.emojiPicker.offsetHeight||200;
  let left = rect.right+8, top = rect.top;
  if (left+pw > window.innerWidth)  left = rect.left-pw-8;
  if (top+ph  > window.innerHeight) top  = window.innerHeight-ph-8;
  dom.emojiPicker.style.left = `${Math.max(4,left)}px`;
  dom.emojiPicker.style.top  = `${Math.max(4,top)}px`;
}
function closeEmojiPicker() { dom.emojiPicker.classList.add('hidden'); activePicker = null; }
document.addEventListener('click', e => {
  if (!dom.emojiPicker.classList.contains('hidden') && !dom.emojiPicker.contains(e.target))
    closeEmojiPicker();
});

// ============================================================
// WIN
// ============================================================
function showWinOverlay(pi) {
  const name  = getPlayerName(pi);
  const score = state.scores[pi].toLocaleString('sv');
  const el    = document.createElement('div');
  el.className = 'win-overlay';
  el.innerHTML = `
    <div class="win-box">
      <div class="win-avatar">${state.emojis[pi]}</div>
      <div class="win-label">VANN!</div>
      <div class="win-name">${name}</div>
      <div class="win-score">${score} poäng</div>
      <button class="win-btn" id="playAgainBtn">🔄 Ny omgång</button>
    </div>`;
  document.body.appendChild(el);
  $('playAgainBtn').addEventListener('click', () => { el.remove(); stopConfetti(); resetGame(); });
}

// ============================================================
// KONFETTI
// ============================================================
let confAnim;
function launchConfetti() {
  const c = dom.confetti;
  c.width = window.innerWidth; c.height = window.innerHeight; c.style.display = 'block';
  const ctx    = c.getContext('2d');
  const colors = PLAYER_COLORS.map(p=>p.color);
  const bits   = Array.from({length:160},()=>({
    x:Math.random()*c.width, y:-20-Math.random()*120,
    vx:(Math.random()-.5)*5, vy:2.5+Math.random()*4,
    color:colors[Math.floor(Math.random()*colors.length)],
    size:5+Math.random()*8, rot:Math.random()*Math.PI*2, rs:(Math.random()-.5)*.18,
  }));
  let f=0;
  function draw() {
    ctx.clearRect(0,0,c.width,c.height);
    bits.forEach(b=>{
      b.x+=b.vx; b.y+=b.vy; b.vy+=.06; b.rot+=b.rs;
      ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
      ctx.fillStyle=b.color; ctx.fillRect(-b.size/2,-b.size*.4,b.size,b.size*.5);
      ctx.restore();
    });
    f++; if(f<220) confAnim=requestAnimationFrame(draw); else c.style.display='none';
  }
  confAnim=requestAnimationFrame(draw);
}
function stopConfetti() { cancelAnimationFrame(confAnim); dom.confetti.style.display='none'; }

// ============================================================
// READY STATE
// ============================================================
function showReadyState() {
  state.currentQ       = null;
  state.questionActive = false;
  state.wrongAttempts  = 0;
  renderQuestion();
  renderAttemptDots();
  updateActiveBanner(pick(COMMENTS.start));
  dom.statusBar.textContent = 'Välj inställningar ovan och tryck Starta!';
  dom.startBtn.classList.remove('hidden');
}

// ============================================================
// RESET
// ============================================================
function resetGame() {
  for (let i = 0; i < state.playerCount; i++) { state.scores[i]=0; state.streak[i]=0; }
  state.current     = 0;
  state.winner      = null;
  state.gameStarted = false;
  setSettingsLocked(false);
  buildPlayers();
  updateActiveColor();
  showReadyState();
}

// ============================================================
// SETTINGS EVENTS
// ============================================================

// Spelare — byter bara antal, startar INTE spelet
dom.playerBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-players]');
  if (!btn || btn.disabled) return;
  dom.playerBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.playerCount = parseInt(btn.dataset.players);
  state.current = 0; state.winner = null;
  // Trimma scores/streaks om färre spelare
  state.scores = state.scores.slice(0, state.playerCount);
  state.streak = state.streak.slice(0, state.playerCount);
  buildPlayers();
  updateActiveColor();
  // Uppdatera banner utan att starta fråga
  updateActiveBanner(pick(COMMENTS.start));
  dom.statusBar.textContent = 'Välj inställningar ovan och tryck Starta!';
});

dom.goalBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-goal]'); if (!btn||btn.disabled) return;
  dom.goalBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.goal = parseInt(btn.dataset.goal);
  updateScores();
});

dom.chancesBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-chances]'); if (!btn||btn.disabled) return;
  dom.chancesBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.maxAttempts = parseInt(btn.dataset.chances);
  renderAttemptDots();
});

dom.presetBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-preset]'); if (!btn||btn.disabled) return;
  dom.presetBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.tablePreset = btn.dataset.preset;
  dom.customTableRow.classList.toggle('hidden', state.tablePreset !== 'custom');
});

function buildCustomTableBtns() {
  dom.customTableRow.innerHTML = '';
  ALL_TABLES.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'xs' + (state.customTables.includes(n) ? ' active-preset' : '');
    btn.textContent = `${n}×`;
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      if (state.customTables.includes(n)) {
        if (state.customTables.length === 1) return;
        state.customTables = state.customTables.filter(t=>t!==n);
        btn.classList.remove('active-preset');
      } else {
        state.customTables.push(n);
        btn.classList.add('active-preset');
      }
    });
    dom.customTableRow.appendChild(btn);
  });
}

// Startknapp
dom.startBtn.addEventListener('click', () => {
  dom.startBtn.classList.add('hidden');
  generateAndShow();
});

// Ny omgång
dom.resetBtn.addEventListener('click', () => {
  stopConfetti();
  document.querySelector('.win-overlay')?.remove();
  resetGame();
});

// Regler
dom.rulesBtn.addEventListener('click', () => dom.rulesOverlay.classList.remove('hidden'));
dom.rulesClose.addEventListener('click', () => dom.rulesOverlay.classList.add('hidden'));
dom.rulesOverlay.addEventListener('click', e => {
  if (e.target === dom.rulesOverlay) dom.rulesOverlay.classList.add('hidden');
});

// Ljud
dom.muteChk.checked = true;
dom.muteChk.addEventListener('change', () => { state.muted = !dom.muteChk.checked; });

// Mörkt läge
(function initDark() {
  if (localStorage.getItem('multi-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme','dark');
    dom.darkChk.checked = true;
  }
  dom.darkChk.addEventListener('change', () => {
    if (dom.darkChk.checked) { document.documentElement.setAttribute('data-theme','dark'); localStorage.setItem('multi-theme','dark'); }
    else { document.documentElement.removeAttribute('data-theme'); localStorage.setItem('multi-theme','light'); }
  });
})();

dom.fsBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(()=>{});
  else document.exitFullscreen?.();
});

// ============================================================
// NUMPAD LOGIK
// ============================================================
function resetNumpad() {
  numpadValue = '';
  dom.answerValue.textContent = '?';
  dom.answerValue.classList.add('placeholder');
  dom.npEnter.disabled = true;
}

function numpadPress(val) {
  if (!state.questionActive || isGameOver()) return;
  if (numpadValue.length >= 4) return; // max 4 siffror
  numpadValue += val;
  dom.answerValue.textContent = numpadValue;
  dom.answerValue.classList.remove('placeholder');
  dom.npEnter.disabled = false;
}

function numpadDelete() {
  if (!numpadValue) return;
  numpadValue = numpadValue.slice(0, -1);
  if (numpadValue === '') {
    dom.answerValue.textContent = '?';
    dom.answerValue.classList.add('placeholder');
    dom.npEnter.disabled = true;
  } else {
    dom.answerValue.textContent = numpadValue;
  }
}

// Numpad-knappar
document.getElementById('numpad').addEventListener('click', e => {
  const btn = e.target.closest('[data-val]');
  if (btn) numpadPress(btn.dataset.val);
});
dom.npDel.addEventListener('click', numpadDelete);
dom.npEnter.addEventListener('click', onAnswer);

// Fysiskt tangentbord (desktop) — fungerar fortfarande
document.addEventListener('keydown', e => {
  if (!state.questionActive || isGameOver()) return;
  if (e.key >= '0' && e.key <= '9') { numpadPress(e.key); return; }
  if (e.key === 'Backspace') { numpadDelete(); return; }
  if (e.key === 'Enter') { onAnswer(); return; }
});

// ============================================================
// INIT
// ============================================================
(function init() {
  initAudio();
  buildCustomTableBtns();
  buildPlayers();
  updateActiveColor();
  showReadyState();
})();
