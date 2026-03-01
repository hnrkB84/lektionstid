'use strict';

// ============================================================
// KONFIGURATION
// ============================================================
const ALL_TABLES = [1,2,3,4,5,6,7,8,9,10];

const EMOJI_POOL = [
  '🏎️','🚀','🦊','🐼','🦁','🐨','🐸','🦄','🐯','🐶',
  '🐱','🐻','🤖','👾','🎃','🧙','🦸','⭐','🔥','💎',
  '🏆','🎯','🦅','🐲','🐬','❄️','🌪️','⚡','🛸','🦋',
];

function levelConfig(lvl) {
  return {
    goal: Math.round(150 * Math.pow(1.4, lvl - 1)),
    time: Math.min(30 + (lvl - 1) * 5, 60),
  };
}

// ============================================================
// STATE
// ============================================================
const state = {
  mode:          'tidsattack',
  tablePreset:   'all',
  customTables:  [...ALL_TABLES],
  timeLimit:     60,
  startScore:    2000,
  // runtime
  running:       false,
  score:         0,
  correctCount:  0,
  streak:        0,
  bestStreak:    0,
  currentQ:      null,
  questionActive:false,
  level:         1,
  levelScore:    0,
  elapsedMs:     0,
  timerRemaining:60,
  timerTotal:    60,
  countdownScore:2000,
  muted:         false,
  character:     '🏎️',
};

// ============================================================
// DOM
// ============================================================
const $ = id => document.getElementById(id);
const dom = {
  modeBtns:          $('modeBtns'),
  presetBtns:        $('presetBtns'),
  customTableRow:    $('customTableRow'),
  timeBtns:          $('timeBtns'),
  timeLabelEl:       $('timeLabelEl'),
  startScoreBtns:    $('startScoreBtns'),
  startScoreLabelEl: $('startScoreLabelEl'),
  characterEmoji:    $('characterEmoji'),
  timerDisplay:      $('timerDisplay'),
  timerFill:         $('timerFill'),
  timerTopLabel:     $('timerTopLabel'),
  hudTimerCell:      $('hudTimerCell'),
  hudScoreCell:      $('hudScoreCell'),
  hudCountdown:      $('hudCountdown'),
  scoreDisplay:      $('scoreDisplay'),
  scoreLabelEl:      $('scoreLabelEl'),
  countdownDisplay:  $('countdownDisplay'),
  elapsed:           $('elapsed'),
  levelRow:          $('levelRow'),
  levelNum:          $('levelNum'),
  levelFill:         $('levelFill'),
  levelGoalText:     $('levelGoalText'),
  levelProgress:     $('levelProgress'),
  levelName:         $('levelName'),
  levelCurrent:      $('levelCurrent'),
  levelGoalNum:      $('levelGoalNum'),
  factorA:           $('factorA'),
  factorB:           $('factorB'),
  answerDisplay:     $('answerDisplay'),
  answerValue:       $('answerValue'),
  numRow:            $('numRow'),
  numDel:            $('numDel'),
  numOk:             $('numOk'),
  statusBar:         $('statusBar'),
  startBtn:          $('startBtn'),
  correctCount:      $('correctCount'),
  bestStreak:        $('bestStreak'),
  hsList:            $('hsList'),
  hsTitle:           $('hsTitle'),
  emojiPicker:       $('emojiPicker'),
  confetti:          $('confettiCanvas'),
  rulesBtn:          $('rulesBtn'),
  rulesOverlay:      $('rulesOverlay'),
  rulesClose:        $('rulesClose'),
  resetBtn:          $('resetBtn'),
  muteChk:           $('muteChk'),
  darkChk:           $('darkChk'),
  fsBtn:             $('fsBtn'),
};

let numVal = '';
let timerInterval = null;

// ============================================================
// LJUD
// ============================================================
let audioCtx;
function initAudio() { try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch {} }
async function resumeAudio() { try { if (audioCtx?.state==='suspended') await audioCtx.resume(); } catch {} }
function tone(freq=880,ms=120,type='sine',vol=0.07) {
  if (state.muted || !audioCtx) return;
  try {
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=vol;
    o.connect(g).connect(audioCtx.destination);
    o.start(); setTimeout(()=>o.stop(), ms);
  } catch {}
}
const sound = {
  ok:    () => { tone(660,80,'triangle',.07); setTimeout(()=>tone(880,120,'triangle',.07),90); },
  error: () => tone(220,180,'square',.05),
  win:   () => { tone(660,100); setTimeout(()=>tone(880,150),120); setTimeout(()=>tone(1100,200),280); setTimeout(()=>tone(1320,300),500); },
  level: () => { tone(880,100); setTimeout(()=>tone(1100,100),120); setTimeout(()=>tone(1320,200),260); },
  tick:  () => tone(600,40,'sine',.04),
};

// ============================================================
// KARAKTÄR
// ============================================================
function reactCharacter(type) {
  const el = dom.characterEmoji;
  el.classList.remove('bounce','shake','win');
  void el.offsetWidth; // reflow to restart animation
  el.classList.add(type);
  el.addEventListener('animationend', () => el.classList.remove(type), { once: true });
}

function buildEmojiPicker() {
  const picker = dom.emojiPicker;
  picker.innerHTML = '';
  EMOJI_POOL.forEach(e => {
    const btn = document.createElement('button');
    btn.className = 'emoji-opt' + (e === state.character ? ' selected' : '');
    btn.textContent = e;
    btn.addEventListener('click', () => {
      state.character = e;
      dom.characterEmoji.textContent = e;
      picker.querySelectorAll('.emoji-opt').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      picker.classList.add('hidden');
    });
    picker.appendChild(btn);
  });
}

dom.characterEmoji.addEventListener('click', e => {
  buildEmojiPicker();
  const picker = dom.emojiPicker;
  picker.classList.toggle('hidden');
  if (!picker.classList.contains('hidden')) {
    const rect = dom.characterEmoji.getBoundingClientRect();
    picker.style.top  = `${rect.bottom + 6}px`;
    picker.style.left = `${rect.left}px`;
  }
});
document.addEventListener('click', e => {
  if (!dom.emojiPicker.contains(e.target) && e.target !== dom.characterEmoji) {
    dom.emojiPicker.classList.add('hidden');
  }
});

// ============================================================
// HIGHSCORES
// ============================================================
function hsKey() {
  if (state.mode === 'tidsattack') return `race-hs-tidsattack-${state.timeLimit}`;
  if (state.mode === 'nedrakning') return `race-hs-nedrakning-${state.startScore}`;
  return `race-hs-niva`;
}
function loadHS() {
  try { return JSON.parse(localStorage.getItem(hsKey())) || []; } catch { return []; }
}
function saveHS(list) {
  try { localStorage.setItem(hsKey(), JSON.stringify(list)); } catch {}
}
function addHS(value) {
  const list = loadHS();
  const entry = { v: value, d: new Date().toLocaleDateString('sv-SE') };
  list.push(entry);
  if (state.mode === 'nedrakning') list.sort((a,b) => a.v - b.v);
  else                             list.sort((a,b) => b.v - a.v);
  const top = list.slice(0,5);
  saveHS(top);
  // New record if this entry is first
  return top[0].v === value;
}
function renderHS() {
  if (state.mode === 'tidsattack')  dom.hsTitle.textContent = `🏆 Highscore (${state.timeLimit}s)`;
  else if (state.mode === 'nedrakning') dom.hsTitle.textContent = `🏆 Highscore (${state.startScore}p)`;
  else dom.hsTitle.textContent = `🏆 Highscore — Nivåläge`;

  const list = loadHS();
  if (!list.length) { dom.hsList.innerHTML = '<div class="hs-empty">Inga rekord ännu!</div>'; return; }
  const medals = ['gold','silver','bronze'];
  const icons  = ['🥇','🥈','🥉'];
  dom.hsList.innerHTML = list.map((e,i) => {
    const val = state.mode === 'nedrakning' ? formatTime(e.v) : `${e.v}p`;
    return `<div class="hs-item ${medals[i]||''}">
      <span class="hs-rank">${icons[i]||`${i+1}.`}</span>
      <span class="hs-score">${val}</span>
      <span class="hs-date">${e.d}</span>
    </div>`;
  }).join('');
}

// ============================================================
// TABELLER
// ============================================================
function getActiveTables() {
  if (state.tablePreset === 'all') return ALL_TABLES;
  return state.customTables.length ? state.customTables : ALL_TABLES;
}

// ============================================================
// FRÅGA
// ============================================================
function generateQ() {
  const tables = getActiveTables();
  const a = tables[Math.floor(Math.random() * tables.length)];
  const b = Math.floor(Math.random() * 10) + 1;
  return { a, b, answer: a * b };
}

function showQ() {
  if (!state.running) return;
  state.currentQ = generateQ();
  state.questionActive = true;

  dom.factorA.textContent = state.currentQ.a;
  dom.factorB.textContent = state.currentQ.b;

  numVal = '';
  dom.answerValue.textContent = '?';
  dom.answerValue.classList.add('placeholder');
  dom.numOk.disabled = true;
  dom.answerDisplay.className = 'answer-display active';
  dom.numRow.classList.remove('hidden');
  dom.statusBar.textContent = 'Vad är produkten?';
}

function flashAnswer(correct) {
  dom.answerDisplay.className = `answer-display ${correct ? 'correct' : 'wrong shake'}`;
}

function scorePopup(points, correct) {
  const el = document.createElement('div');
  el.className = `score-popup ${correct ? 'positive' : 'negative'}`;
  el.textContent = correct ? `+${points}` : '✗';
  const box = dom.answerDisplay.getBoundingClientRect();
  el.style.left = `${box.left + box.width/2 - 28}px`;
  el.style.top  = `${box.top - 10}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

// ============================================================
// SVAR
// ============================================================
function onAnswer() {
  if (!state.questionActive || !numVal) return;
  resumeAudio();

  const guess  = parseInt(numVal);
  const { a, b, answer } = state.currentQ;
  const correct = guess === answer;

  state.questionActive = false;

  if (correct) {
    sound.ok();
    reactCharacter('bounce');
    state.correctCount++;
    state.streak++;
    if (state.streak > state.bestStreak) state.bestStreak = state.streak;
    flashAnswer(true);
    scorePopup(answer, true);

    if (state.mode === 'tidsattack') {
      state.score += answer;
      animateScore();
    } else if (state.mode === 'nedrakning') {
      state.countdownScore = Math.max(0, state.countdownScore - answer);
      dom.countdownDisplay.textContent = state.countdownScore + 'p';
      if (state.countdownScore <= 0) { setTimeout(() => endGame(true), 400); return; }
    } else if (state.mode === 'niva') {
      state.score     += answer;
      state.levelScore+= answer;
      animateScore();
      updateLevelBar();
      const cfg = levelConfig(state.level);
      if (state.levelScore >= cfg.goal) {
        sound.level();
        setTimeout(() => advanceLevel(), 500);
        return;
      }
    }
  } else {
    sound.error();
    reactCharacter('shake');
    state.streak = 0;
    flashAnswer(false);
    scorePopup(answer, false);
  }

  updateSideStats();
  setTimeout(() => { if (state.running) showQ(); }, correct ? 500 : 700);
}

function animateScore() {
  dom.scoreDisplay.textContent = state.score + 'p';
  dom.scoreDisplay.classList.remove('pop');
  void dom.scoreDisplay.offsetWidth;
  dom.scoreDisplay.classList.add('pop');
  dom.scoreDisplay.addEventListener('animationend', () => dom.scoreDisplay.classList.remove('pop'), { once:true });
}

// ============================================================
// NIVÅLÄGE
// ============================================================
function updateLevelBar() {
  const cfg = levelConfig(state.level);
  const pct = Math.min(100, (state.levelScore / cfg.goal) * 100);
  dom.levelFill.style.width = `${pct}%`;
  dom.levelGoalText.textContent = `${state.levelScore}/${cfg.goal}p`;
  // Prominent display
  dom.levelCurrent.textContent = state.levelScore;
  dom.levelGoalNum.textContent = cfg.goal;
}

function advanceLevel() {
  state.level++;
  state.levelScore = 0;
  const cfg = levelConfig(state.level);

  clearInterval(timerInterval);
  state.timerRemaining = cfg.time;
  state.timerTotal     = cfg.time;

  dom.levelNum.textContent   = `Nivå ${state.level}`;
  dom.levelName.textContent  = `Nivå ${state.level}`;
  dom.levelGoalText.textContent = `0/${cfg.goal}p`;
  dom.levelFill.style.width  = '0%';
  dom.levelCurrent.textContent  = '0';
  dom.levelGoalNum.textContent  = cfg.goal;
  updateTimerDisplay();
  dom.statusBar.textContent = `🎯 Nivå ${state.level}! Mål: ${cfg.goal}p på ${cfg.time}s`;

  setTimeout(() => { startTimer(); showQ(); }, 1200);
}

// ============================================================
// TIMER
// ============================================================
function formatTime(ms) {
  const tot = Math.round(ms / 1000);
  const m   = Math.floor(tot / 60);
  const s   = tot % 60;
  return `${m}:${s.toString().padStart(2,'0')}`;
}

function startTimer() {
  clearInterval(timerInterval);

  if (state.mode === 'nedrakning') {
    const startTime = Date.now() - state.elapsedMs;
    timerInterval = setInterval(() => {
      state.elapsedMs = Date.now() - startTime;
      dom.elapsed.textContent = formatTime(state.elapsedMs);
    }, 100);
    return;
  }

  timerInterval = setInterval(() => {
    state.timerRemaining -= 0.1;
    if (state.timerRemaining <= 0) {
      state.timerRemaining = 0;
      clearInterval(timerInterval);
      updateTimerDisplay();
      state.questionActive = false;
      endGame(false);
      return;
    }
    updateTimerDisplay();
    if (state.timerRemaining <= 5) sound.tick();
  }, 100);
}

function updateTimerDisplay() {
  const s = Math.ceil(state.timerRemaining);
  dom.timerDisplay.textContent = s;
  const pct = (state.timerRemaining / state.timerTotal) * 100;
  dom.timerFill.style.width = `${pct}%`;
  const danger = state.timerRemaining <= 10;
  dom.timerDisplay.classList.toggle('danger', danger);
  dom.timerFill.classList.toggle('danger', danger);
}

// ============================================================
// SCORE DISPLAY
// ============================================================
function updateSideStats() {
  dom.correctCount.textContent = state.correctCount;
  dom.bestStreak.textContent   = state.bestStreak;
}

// ============================================================
// MODE UI
// ============================================================
function applyModeUI() {
  const m = state.mode;
  const isCountdown = m === 'nedrakning';
  const isNiva      = m === 'niva';
  const isTimer     = !isCountdown;

  dom.hudTimerCell.style.display  = isTimer ? '' : 'none';
  dom.hudScoreCell.style.display  = isTimer ? '' : 'none';
  dom.hudCountdown.classList.toggle('visible', isCountdown);
  dom.levelRow.classList.toggle('visible', isNiva);

  // Prominent level progress in score cell
  dom.levelProgress.classList.toggle('visible', isNiva);
  // In niva mode, hide the regular score value and label, show level progress instead
  dom.scoreDisplay.style.display  = isNiva ? 'none' : '';
  dom.scoreLabelEl.style.display  = isNiva ? 'none' : '';

  dom.timeBtns.classList.toggle('hidden', !(m === 'tidsattack'));
  dom.timeLabelEl.classList.toggle('hidden', !(m === 'tidsattack'));
  dom.startScoreBtns.classList.toggle('hidden', !isCountdown);
  dom.startScoreLabelEl.classList.toggle('hidden', !isCountdown);

  document.querySelector('.race-hud').style.gridTemplateColumns = isCountdown ? 'auto 1fr' : 'auto 1fr 1fr';

  renderHS();
}

// ============================================================
// START / END / RESET
// ============================================================
function startGame() {
  resumeAudio();
  state.running        = true;
  state.score          = 0;
  state.correctCount   = 0;
  state.streak         = 0;
  state.bestStreak     = 0;
  state.level          = 1;
  state.levelScore     = 0;
  state.elapsedMs      = 0;
  state.countdownScore = state.startScore;

  if (state.mode === 'niva') {
    const cfg = levelConfig(1);
    state.timerRemaining = cfg.time;
    state.timerTotal     = cfg.time;
    dom.levelNum.textContent    = 'Nivå 1';
    dom.levelName.textContent   = 'Nivå 1';
    dom.levelGoalText.textContent = `0/${cfg.goal}p`;
    dom.levelFill.style.width   = '0%';
    dom.levelCurrent.textContent = '0';
    dom.levelGoalNum.textContent = cfg.goal;
  } else {
    state.timerRemaining = state.timeLimit;
    state.timerTotal     = state.timeLimit;
  }

  dom.scoreDisplay.textContent    = '0p';
  dom.countdownDisplay.textContent= state.startScore + 'p';
  dom.elapsed.textContent         = '0:00';
  updateTimerDisplay();
  updateSideStats();

  dom.startBtn.classList.add('hidden');
  startTimer();
  showQ();
}

function endGame(win) {
  state.running = false;
  state.questionActive = false;
  clearInterval(timerInterval);

  dom.numRow.classList.add('hidden');
  dom.factorA.textContent = '–';
  dom.factorB.textContent = '–';
  dom.answerDisplay.className = 'answer-display';
  dom.answerValue.textContent = '?';
  dom.answerValue.classList.add('placeholder');

  reactCharacter(win ? 'win' : 'shake');

  let resultValue, isRecord;
  if (state.mode === 'tidsattack') {
    resultValue = state.score;
    isRecord    = addHS(resultValue);
  } else if (state.mode === 'nedrakning') {
    if (!win) { showWinOverlay(false, 0, false); renderHS(); return; }
    resultValue = state.elapsedMs;
    isRecord    = addHS(resultValue);
  } else {
    resultValue = win ? state.level : state.level - 1;
    isRecord    = addHS(resultValue);
  }

  renderHS();
  if (isRecord) launchConfetti();
  sound.win();
  showWinOverlay(win, resultValue, isRecord);
}

function showWinOverlay(win, resultValue, isRecord) {
  const el = document.createElement('div');
  el.className = 'win-overlay';
  let icon, title, sub, rec = '';

  if (state.mode === 'tidsattack') {
    icon  = '🏁';
    title = `${resultValue}p`;
    sub   = `${state.correctCount} rätt svar på ${state.timeLimit}s`;
  } else if (state.mode === 'nedrakning') {
    if (!win) {
      icon = '🕒'; title = 'Avbruten'; sub = `${state.correctCount} rätt svar`;
    } else {
      icon  = '🏁';
      title = formatTime(resultValue);
      sub   = `${state.startScore}p nollades! (${state.correctCount} rätt)`;
    }
  } else {
    icon  = win ? '🎉' : '💥';
    title = `Nivå ${resultValue}`;
    sub   = `${state.correctCount} rätt · ${state.score}p totalt`;
  }

  if (isRecord && (win !== false || state.mode !== 'nedrakning')) {
    rec = `<div class="win-record">🌟 Nytt rekord!</div>`;
  }

  el.innerHTML = `
    <div class="win-box">
      <div class="win-icon">${icon}</div>
      <div class="win-label">Resultat</div>
      <div class="win-name">${title}</div>
      <div class="win-sub">${sub}</div>
      ${rec}
      <button class="win-btn" id="winRestartBtn">🔄 Spela igen</button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#winRestartBtn').addEventListener('click', () => {
    el.remove(); stopConfetti(); resetToReady();
  });
}

function resetToReady() {
  clearInterval(timerInterval);
  state.running = false;
  state.questionActive = false;
  state.score = 0; state.correctCount = 0;
  state.streak = 0; state.bestStreak = 0;
  state.level = 1; state.levelScore = 0;
  state.elapsedMs = 0;

  if (state.mode === 'niva') {
    const cfg = levelConfig(1);
    state.timerRemaining = cfg.time; state.timerTotal = cfg.time;
    dom.levelNum.textContent = 'Nivå 1';
    dom.levelName.textContent = 'Nivå 1';
    dom.levelGoalText.textContent = `0/${cfg.goal}p`;
    dom.levelFill.style.width = '0%';
    dom.levelCurrent.textContent = '0';
    dom.levelGoalNum.textContent = cfg.goal;
  } else {
    state.timerRemaining = state.timeLimit;
    state.timerTotal     = state.timeLimit;
  }
  state.countdownScore = state.startScore;

  dom.scoreDisplay.textContent     = '0p';
  dom.countdownDisplay.textContent = state.startScore + 'p';
  dom.elapsed.textContent          = '0:00';
  updateTimerDisplay();
  updateSideStats();

  dom.factorA.textContent = '–';
  dom.factorB.textContent = '–';
  dom.answerDisplay.className = 'answer-display';
  dom.answerValue.textContent = '?';
  dom.answerValue.classList.add('placeholder');
  dom.numRow.classList.add('hidden');
  dom.startBtn.classList.remove('hidden');
  dom.statusBar.textContent = 'Välj läge och tryck Starta!';
  dom.timerDisplay.classList.remove('danger');
  dom.timerFill.classList.remove('danger');
  dom.timerFill.style.width = '100%';
}

// ============================================================
// SETTINGS EVENTS
// ============================================================
dom.modeBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-mode]');
  if (!btn || state.running) return;
  dom.modeBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.mode = btn.dataset.mode;
  applyModeUI();
  resetToReady();
});

dom.presetBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-preset]');
  if (!btn || state.running) return;
  dom.presetBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.tablePreset = btn.dataset.preset;
  dom.customTableRow.classList.toggle('hidden', state.tablePreset !== 'custom');
});

dom.timeBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-time]');
  if (!btn || state.running) return;
  dom.timeBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.timeLimit = parseInt(btn.dataset.time);
  state.timerRemaining = state.timeLimit;
  state.timerTotal = state.timeLimit;
  updateTimerDisplay();
  renderHS();
});

dom.startScoreBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-start]');
  if (!btn || state.running) return;
  dom.startScoreBtns.querySelectorAll('button').forEach(b=>b.classList.remove('active-preset'));
  btn.classList.add('active-preset');
  state.startScore = parseInt(btn.dataset.start);
  state.countdownScore = state.startScore;
  dom.countdownDisplay.textContent = state.startScore + 'p';
  renderHS();
});

function buildCustomTableBtns() {
  dom.customTableRow.innerHTML = '';
  ALL_TABLES.forEach(n => {
    const btn = document.createElement('button');
    btn.className = 'xs' + (state.customTables.includes(n) ? ' active-preset' : '');
    btn.textContent = `${n}×`;
    btn.addEventListener('click', () => {
      if (state.running) return;
      if (state.customTables.includes(n)) {
        if (state.customTables.length === 1) return;
        state.customTables = state.customTables.filter(t=>t!==n);
        btn.classList.remove('active-preset');
      } else {
        state.customTables.push(n); btn.classList.add('active-preset');
      }
    });
    dom.customTableRow.appendChild(btn);
  });
}

dom.startBtn.addEventListener('click', () => { initAudio(); startGame(); });

dom.resetBtn.addEventListener('click', () => {
  stopConfetti();
  document.querySelectorAll('.win-overlay').forEach(el=>el.remove());
  clearInterval(timerInterval);
  state.running = false;
  resetToReady();
});

dom.rulesBtn.addEventListener('click', ()  => dom.rulesOverlay.classList.remove('hidden'));
dom.rulesClose.addEventListener('click', () => dom.rulesOverlay.classList.add('hidden'));
dom.rulesOverlay.addEventListener('click', e => { if (e.target===dom.rulesOverlay) dom.rulesOverlay.classList.add('hidden'); });

dom.muteChk.checked = true;
dom.muteChk.addEventListener('change', () => { state.muted = !dom.muteChk.checked; });

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
// SIFFERRAD
// ============================================================
function numPress(digit) {
  if (!state.questionActive) return;
  if (numVal.length >= 4) return;
  numVal += digit;
  dom.answerValue.textContent = numVal;
  dom.answerValue.classList.remove('placeholder');
  dom.numOk.disabled = false;
}
function numDelete() {
  if (!numVal) return;
  numVal = numVal.slice(0,-1);
  if (!numVal) {
    dom.answerValue.textContent = '?';
    dom.answerValue.classList.add('placeholder');
    dom.numOk.disabled = true;
  } else {
    dom.answerValue.textContent = numVal;
  }
}

document.getElementById('numRow').addEventListener('click', e => {
  const btn = e.target.closest('[data-n]');
  if (btn) numPress(btn.dataset.n);
});
dom.numDel.addEventListener('click', numDelete);
dom.numOk.addEventListener('click', onAnswer);
document.addEventListener('keydown', e => {
  if (!state.questionActive) return;
  if (e.key >= '0' && e.key <= '9') { numPress(e.key); return; }
  if (e.key === 'Backspace') { e.preventDefault(); numDelete(); return; }
  if (e.key === 'Enter') { onAnswer(); return; }
});

// ============================================================
// KONFETTI
// ============================================================
let confAnim;
function launchConfetti() {
  const c = dom.confetti;
  c.width = window.innerWidth; c.height = window.innerHeight; c.style.display='block';
  const ctx    = c.getContext('2d');
  const colors = ['#f97316','#10b981','#3b82f6','#a855f7','#ec4899','#fbbf24'];
  const bits   = Array.from({length:200}, () => ({
    x:Math.random()*c.width, y:-20-Math.random()*120,
    vx:(Math.random()-.5)*7, vy:2.5+Math.random()*4,
    color:colors[Math.floor(Math.random()*colors.length)],
    size:5+Math.random()*9, rot:Math.random()*Math.PI*2, rs:(Math.random()-.5)*.2,
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
    f++; if(f<260) confAnim=requestAnimationFrame(draw); else c.style.display='none';
  }
  confAnim=requestAnimationFrame(draw);
}
function stopConfetti() { cancelAnimationFrame(confAnim); dom.confetti.style.display='none'; }

// ============================================================
// INIT
// ============================================================
(function init() {
  buildCustomTableBtns();
  applyModeUI();
  updateTimerDisplay();
  renderHS();
})();
