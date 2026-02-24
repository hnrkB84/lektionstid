'use strict';

// ============================================================
// ORDLISTOR
// ============================================================
const WORDS = {
  djur: ['LEJON','ELEFANT','GIRAFF','PINGVIN','DELFIN','KROKODIL','FLAMINGO','GORILLA',
         'GEPARD','FLODHÄST','NÄSHÖRNING','ZEBRA','KAMEL','STRUTS','PINGVIN','PAPEGOJA'],
  lander: ['SVERIGE','FINLAND','NORGE','DANMARK','FRANKRIKE','SPANIEN','ITALIEN','TYSKLAND',
           'PORTUGAL','GREKLAND','BRASILIEN','ARGENTINA','AUSTRALIEN','KANADA','MEXIKO','JAPAN'],
  mat: ['PIZZA','SPAGHETTI','PANNKAKA','LASAGNE','HAMBURGARE','WOK','SUSHI','TACO',
        'SMÖRGÅS','SOPPA','SALLAD','MANDARIN','ANANAS','JORDGUBBE','CHOKLAD','GLASS'],
  skolord: ['MULTIPLIKATION','ADDITION','SUBTRAKTION','DIVISION','GEOMETRI',
            'BRÅK','PROCENT','EKVATION','KVADRAT','TRIANGEL','CIRKEL','DIAMETER',
            'ASTRONOMI','EVOLUTION','FOTOSYNTSE','DEMOKRATI'],
};

// Ordningsföljd för robotdelar (8 möjliga = max 8 missar, 6 = visar 6 delar, 10 = alla)
// Delar: huvud(1), antenn(2), ögon(3), mun(4), kropp(5), vänster arm(6), höger arm(7), vänster ben(8), höger ben(9)
// Vi har 9 delar — för 6 missar visar vi 6 delar, 8 missar = 8 delar, 10 = vi kör med 8 max (9 delar)
// ============================================================
// ROBOT — "Rädda roboten!" — startar komplett, delar försvinner
// ============================================================

// 10 delar totalt — tas bort i denna ordning (utifrån & in, nedifrån & upp)
// rp10=höger fot, rp9=höger ben, rp8=vänster ben, rp7=höger arm, rp6=vänster arm,
// rp5=kropp, rp4=mun, rp3=ögon, rp2=antenn, rp1=huvud
const ALL_PARTS = ['rp10','rp9','rp8','rp7','rp6','rp5','rp4','rp3','rp2','rp1'];

// Välj exakt maxMisses delar att ta bort (alltid de första N i listan)
function getRemoveParts() {
  return ALL_PARTS.slice(0, state.maxMisses);
}

const ROBOT_LABELS_RESCUE = [
  'Rädda roboten! 🤖',
  'Höger fot försvann! 😨',
  'Höger ben borta!',
  'Vänster ben borta!',
  'Höger arm försvann! 😰',
  'Vänster arm borta!',
  'Kroppen faller isär! 😱',
  'Munnen är borta…',
  'Ögonen slocknar! 😵',
  'Antennen flyger iväg!',
  'Huvudet är borta — roboten är förlorad! 💀',
];

function resetRobot() {
  // Visa ALLA delar (robot startar komplett)
  ALL_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('hidden','removing');
      el.style.opacity = '';
    }
  });
  const sad = document.getElementById('rpSad');
  if (sad) sad.classList.add('hidden');

  dom.robotLabel.textContent = ROBOT_LABELS_RESCUE[0];
  dom.robotPanel.classList.remove('accent');
}

function removeRobotPart() {
  const order = getRemoveParts();
  const idx   = state.misses - 1;
  if (idx < 0 || idx >= order.length) return;

  const partId = order[idx];
  const part   = document.getElementById(partId);
  if (part) {
    part.classList.add('removing');
    setTimeout(() => part.classList.add('hidden'), 400);
  }

  const labelIdx = Math.min(state.misses, ROBOT_LABELS_RESCUE.length - 1);
  dom.robotLabel.textContent = ROBOT_LABELS_RESCUE[labelIdx];
  dom.robotPanel.classList.add('accent');
}

function wobbleRobot() {
  dom.robotSvg.classList.remove('wobble');
  void dom.robotSvg.offsetWidth;
  dom.robotSvg.classList.add('wobble');
  setTimeout(() => dom.robotSvg.classList.remove('wobble'), 450);
}

const SWEDISH_ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ'.split('');

// ============================================================
// STATE
// ============================================================
const state = {
  word:        '',
  guessed:     new Set(),
  maxMisses:   8,
  misses:      0,
  category:    null,
  gameOver:    false,
  won:         false,
  muted:       false,
};

// ============================================================
// DOM
// ============================================================
const $ = id => document.getElementById(id);
const dom = {
  entryOverlay: $('entryOverlay'),
  gameScreen:   $('gameScreen'),
  wordInput:    $('wordInput'),
  toggleShow:   $('toggleShow'),
  startGameBtn: $('startGameBtn'),
  entryHint:    $('entryHint'),
  letterSlots:  $('letterSlots'),
  missText:     $('missText'),
  missDots:     $('missDots'),
  alphaGrid:    $('alphaGrid'),
  robotSvg:     $('robotSvg'),
  robotLabel:   $('robotLabel'),
  robotPanel:   $('robotPanel'),
  wordPanel:    $('wordPanel'),
  alphaPanel:   $('alphaPanel'),
  categoryBadge:$('categoryBadge'),
  resultOverlay:$('resultOverlay'),
  resultEmoji:  $('resultEmoji'),
  resultTitle:  $('resultTitle'),
  resultWord:   $('resultWord'),
  btnPlayAgain: $('btnPlayAgain'),
  confetti:     $('confettiCanvas'),
  btnSound:     $('btnSound'),
  btnDark:      $('btnDark'),
  btnFs:        $('btnFs'),
  btnNewWord:   $('btnNewWord'),
  missBtns:     $('missBtns'),
};

// ============================================================
// LJUD
// ============================================================
let audioCtx;
function initAudio() { try { audioCtx = new (window.AudioContext||window.webkitAudioContext)(); } catch {} }
function tone(freq,ms,type='sine',vol=0.07) {
  if (state.muted||!audioCtx) return;
  try {
    const o=audioCtx.createOscillator(), g=audioCtx.createGain();
    o.type=type; o.frequency.value=freq; g.gain.value=vol;
    o.connect(g).connect(audioCtx.destination);
    o.start(); setTimeout(()=>o.stop(),ms);
  } catch {}
}
const sound = {
  correct: ()=>{ tone(660,80,'triangle',.07); setTimeout(()=>tone(880,120,'triangle',.07),90); },
  wrong:   ()=>tone(160,250,'square',.06),
  win:     ()=>{ [660,880,1100,1320].forEach((f,i)=>setTimeout(()=>tone(f,150,'triangle',.07),i*120)); },
  lose:    ()=>{ tone(300,200,'sawtooth',.06); setTimeout(()=>tone(200,400,'sawtooth',.05),220); },
};

// ============================================================
// ENTRY OVERLAY
// ============================================================

// Visa/dölj inmatat ord
let showingWord = false;
dom.toggleShow.addEventListener('click', () => {
  showingWord = !showingWord;
  dom.wordInput.type = showingWord ? 'text' : 'password';
  dom.toggleShow.textContent = showingWord ? '🙈' : '👁';
});

// Validera input
dom.wordInput.addEventListener('input', () => {
  const raw = dom.wordInput.value.trim().toUpperCase();
  const clean = raw.replace(/[^A-ZÅÄÖ ]/gi, '');
  if (clean.length > 0 && clean.replace(/ /g,'').length > 0) {
    dom.startGameBtn.disabled = false;
    dom.entryHint.textContent = `${clean.replace(/ /g,'').length} bokstäver`;
  } else {
    dom.startGameBtn.disabled = true;
    dom.entryHint.textContent = '';
  }
});

// Kategori-knappar
document.querySelectorAll('.cat-btn[data-cat]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.cat-btn[data-cat]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const cat = btn.dataset.cat;
    const list = WORDS[cat];
    const word = list[Math.floor(Math.random() * list.length)];
    dom.wordInput.value = word;
    dom.wordInput.type = 'password';
    showingWord = false;
    dom.toggleShow.textContent = '👁';
    dom.startGameBtn.disabled = false;
    dom.entryHint.textContent = `${word.length} bokstäver — ${btn.textContent}`;
    state.category = cat;
    dom.wordInput.dispatchEvent(new Event('input'));
  });
});

// Max missar
dom.missBtns.addEventListener('click', e => {
  const btn = e.target.closest('[data-miss]'); if (!btn) return;
  dom.missBtns.querySelectorAll('button').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  state.maxMisses = parseInt(btn.dataset.miss);
});

// Enter i ordfältet
dom.wordInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !dom.startGameBtn.disabled) startGame();
});

dom.startGameBtn.addEventListener('click', startGame);

function startGame() {
  const word = dom.wordInput.value.trim().toUpperCase().replace(/[^A-ZÅÄÖ ]/g,'');
  if (!word || !word.replace(/ /g,'')) return;

  state.word     = word;
  state.guessed  = new Set();
  state.misses   = 0;
  state.gameOver = false;
  state.won      = false;

  dom.entryOverlay.classList.add('hidden');
  dom.gameScreen.classList.remove('hidden');

  buildAlphabet();
  renderSlots();
  renderMissDots();
  resetRobot();
  updateAccentColor();

  if (state.category) {
    const labels = { djur:'🦁 Djur', lander:'🌍 Länder', mat:'🍕 Mat', skolord:'📚 Skolord' };
    dom.categoryBadge.textContent = labels[state.category];
    dom.categoryBadge.classList.remove('hidden');
  } else {
    dom.categoryBadge.classList.add('hidden');
    state.category = null;
  }

  // Fokus på första alfabetsknappen
  setTimeout(() => dom.alphaGrid.querySelector('.alpha-btn')?.focus(), 100);
}

// ============================================================
// SPEL — ALFABETET
// ============================================================
function buildAlphabet() {
  dom.alphaGrid.innerHTML = '';
  SWEDISH_ALPHA.forEach(letter => {
    const btn = document.createElement('button');
    btn.className = 'alpha-btn';
    btn.textContent = letter;
    btn.dataset.letter = letter;
    btn.addEventListener('click', () => guessLetter(letter));
    dom.alphaGrid.appendChild(btn);
  });
}

// Tangentbordsgissning
document.addEventListener('keydown', e => {
  if (dom.entryOverlay && !dom.entryOverlay.classList.contains('hidden')) return;
  if (state.gameOver) return;
  const key = e.key.toUpperCase();
  if (SWEDISH_ALPHA.includes(key) && !state.guessed.has(key)) {
    guessLetter(key);
  }
});

function guessLetter(letter) {
  if (state.gameOver || state.guessed.has(letter)) return;
  state.guessed.add(letter);

  const btn = dom.alphaGrid.querySelector(`[data-letter="${letter}"]`);

  if (state.word.includes(letter)) {
    sound.correct();
    btn?.classList.add('correct');
    renderSlots();
    // Koll vinst
    const allGuessed = [...state.word.replace(/ /g,'')].every(l => state.guessed.has(l));
    if (allGuessed) triggerWin();
  } else {
    sound.wrong();
    btn?.classList.add('wrong');
    btn?.setAttribute('disabled','');
    state.misses++;
    renderMissDots();
    removeRobotPart();
    wobbleRobot();
    if (state.misses >= state.maxMisses) triggerLoss();
  }
}

// ============================================================
// SLOTS
// ============================================================
function renderSlots() {
  dom.letterSlots.innerHTML = '';
  [...state.word].forEach(letter => {
    const slot = document.createElement('div');
    if (letter === ' ') {
      slot.className = 'slot space';
      slot.innerHTML = '<div class="slot-line"></div>';
    } else {
      slot.className = 'slot';
      const lEl = document.createElement('div');
      lEl.className = 'slot-letter';
      if (state.guessed.has(letter)) {
        lEl.textContent = letter;
        lEl.classList.add('reveal');
      } else {
        lEl.textContent = '';
      }
      const line = document.createElement('div');
      line.className = 'slot-line';
      slot.append(lEl, line);
    }
    dom.letterSlots.appendChild(slot);
  });
}

// ============================================================
// MISS-PRICKAR
// ============================================================
function renderMissDots() {
  dom.missDots.innerHTML = '';
  for (let i = 0; i < state.maxMisses; i++) {
    const dot = document.createElement('div');
    dot.className = 'miss-dot' + (i < state.misses ? ' hit' : '');
    dom.missDots.appendChild(dot);
  }
  dom.missText.textContent = `${state.misses} / ${state.maxMisses} fel`;
}

// ============================================================
// ROBOT
// ============================================================
// ============================================================
// VINST / FÖRLUST
// ============================================================
function triggerWin() {
  state.gameOver = true; state.won = true;
  sound.win();
  // Visa alla bokstäver med animation
  renderSlots();
  launchConfetti();
  setTimeout(() => {
    dom.resultEmoji.textContent  = '🎉';
    dom.resultTitle.textContent  = 'Rätt! Koden knäckt!';
    dom.resultWord.textContent   = state.word;
    dom.resultOverlay.classList.remove('hidden');
  }, 800);
}

function triggerLoss() {
  state.gameOver = true; state.won = false;
  sound.lose();
  [...state.word].forEach(l => { if (l !== ' ') state.guessed.add(l); });
  renderSlots();
  // Ledsen mun (om huvud fortfarande finns kvar)
  const head = document.getElementById('rp1');
  const mouth = document.getElementById('rp4');
  const sad   = document.getElementById('rpSad');
  if (head && !head.classList.contains('hidden')) {
    mouth?.classList.add('hidden');
    sad?.classList.remove('hidden');
  }
  dom.robotLabel.textContent = '💀 Roboten är förlorad!';
  setTimeout(() => {
    dom.resultEmoji.textContent  = '🤖';
    dom.resultTitle.textContent  = 'Roboten förlorades!';
    dom.resultWord.textContent   = state.word;
    dom.resultOverlay.classList.remove('hidden');
  }, 700);
}

// ============================================================
// ACCENTFÄRG — växlar per omgång för variation
// ============================================================
// Färgtema låst till guld — ingen cyklning
function updateAccentColor() {
  // Guld är alltid guld — inget att uppdatera, CSS-variablerna sätts i :root
}

// ============================================================
// NY OMGÅNG
// ============================================================
function goToEntry() {
  dom.resultOverlay.classList.add('hidden');
  stopConfetti();
  // Rensa state
  state.category = null;
  dom.wordInput.value = '';
  dom.wordInput.type = 'password';
  dom.toggleShow.textContent = '👁';
  showingWord = false;
  dom.startGameBtn.disabled = true;
  dom.entryHint.textContent = '';
  document.querySelectorAll('.cat-btn[data-cat]').forEach(b=>b.classList.remove('active'));
  dom.gameScreen.classList.add('hidden');
  dom.entryOverlay.classList.remove('hidden');
  setTimeout(()=>dom.wordInput.focus(),100);
}

dom.btnPlayAgain.addEventListener('click', goToEntry);
dom.btnNewWord.addEventListener('click', goToEntry);

// ============================================================
// KONFETTI
// ============================================================
let confAnim;
function launchConfetti() {
  const c = dom.confetti;
  c.width = window.innerWidth; c.height = window.innerHeight;
  c.style.display = 'block';
  const ctx   = c.getContext('2d');
  const colors= ['#a855f7','#3b82f6','#10b981','#f97316','#ec4899','#fbbf24'];
  const bits  = Array.from({length:140},()=>({
    x:Math.random()*c.width, y:-20-Math.random()*80,
    vx:(Math.random()-.5)*5, vy:2+Math.random()*4,
    color:colors[Math.floor(Math.random()*colors.length)],
    size:5+Math.random()*7, rot:Math.random()*Math.PI*2, rs:(Math.random()-.5)*.18,
  }));
  let f=0;
  function draw(){
    ctx.clearRect(0,0,c.width,c.height);
    bits.forEach(b=>{
      b.x+=b.vx; b.y+=b.vy; b.vy+=.07; b.rot+=b.rs;
      ctx.save(); ctx.translate(b.x,b.y); ctx.rotate(b.rot);
      ctx.fillStyle=b.color;
      ctx.fillRect(-b.size/2,-b.size*.4,b.size,b.size*.5);
      ctx.restore();
    });
    if(++f<200) confAnim=requestAnimationFrame(draw);
    else c.style.display='none';
  }
  confAnim=requestAnimationFrame(draw);
}
function stopConfetti(){
  cancelAnimationFrame(confAnim);
  dom.confetti.style.display='none';
}

// ============================================================
// HEADER-KONTROLLER
// ============================================================
dom.btnSound.addEventListener('click', ()=>{
  state.muted=!state.muted;
  dom.btnSound.textContent=state.muted?'🔇':'🔊';
});

(function initDark(){
  if(localStorage.getItem('kodknackare-theme')==='dark'){
    document.documentElement.setAttribute('data-theme','dark');
    dom.btnDark.textContent='☀️';
  }
  dom.btnDark.addEventListener('click',()=>{
    const dark=document.documentElement.getAttribute('data-theme')==='dark';
    dark
      ?(document.documentElement.removeAttribute('data-theme'),dom.btnDark.textContent='🌙',localStorage.setItem('kodknackare-theme','light'))
      :(document.documentElement.setAttribute('data-theme','dark'),dom.btnDark.textContent='☀️',localStorage.setItem('kodknackare-theme','dark'));
  });
})();

dom.btnFs.addEventListener('click',()=>{
  if(!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(()=>{});
  else document.exitFullscreen?.();
});

// ============================================================
// INIT
// ============================================================
(function init(){
  initAudio();
  setTimeout(()=>dom.wordInput.focus(),200);
})();
