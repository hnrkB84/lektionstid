/* ══════════════════════════════════
   SNURRAN — game.js  v4
   Real FLIP group animation
══════════════════════════════════ */

// ─── STATE ────────────────────────
let appMode         = 'spin';
let inputMode       = 'numbers';
let allParticipants = [];
let remaining       = [];
let drawnItems      = [];
let removeDrawn     = false;
let isSpinning      = false;
let soundEnabled    = true;
let currentAngle    = 0;
let audioCtx        = null;
let numGroups       = 4;
let settingsPanelOpen = false;
let drawnPanelOpen    = false;

// ─── WHEEL COLORS — fully saturated ─
const SEG_COLORS = [
  '#FF4136','#FF851B','#FFDC00','#2ECC40',
  '#0074D9','#B10DC9','#FF69B4','#01FF70',
  '#FF6B00','#00B4D8','#E040FB','#F9A825',
  '#E53935','#43A047','#1E88E5','#FB8C00',
];

// ─── INIT ─────────────────────────
window.addEventListener('load', () => {
  applyTheme();
  checkOrientation();
  document.getElementById('input-names').addEventListener('input', updateNameCount);
  document.getElementById('input-count').addEventListener('input', updateCountPreview);
  updateGroupsHint();
});

// ─── SETUP ────────────────────────
function setAppMode(m) {
  appMode = m;
  document.getElementById('btn-mode-spin').classList.toggle('active', m === 'spin');
  document.getElementById('btn-mode-groups').classList.toggle('active', m === 'groups');
  document.getElementById('setup-spin-extra').classList.toggle('hidden', m !== 'spin');
  document.getElementById('setup-groups-extra').classList.toggle('hidden', m !== 'groups');
}

function setInputMode(m) {
  inputMode = m;
  document.getElementById('btn-input-numbers').classList.toggle('active', m === 'numbers');
  document.getElementById('btn-input-names').classList.toggle('active', m === 'names');
  document.getElementById('setup-numbers').classList.toggle('hidden', m !== 'numbers');
  document.getElementById('setup-names').classList.toggle('hidden', m !== 'names');
  updateGroupsHint();
}

function adjustCount(delta) {
  const el = document.getElementById('input-count');
  el.value = Math.max(2, Math.min(60, (parseInt(el.value) || 2) + delta));
  updateCountPreview();
}
function updateCountPreview() {
  document.getElementById('count-preview').textContent =
    parseInt(document.getElementById('input-count').value) || 2;
  updateGroupsHint();
}
function updateNameCount() {
  document.getElementById('name-count').textContent = parseNames().length;
  updateGroupsHint();
}
function parseNames() {
  return document.getElementById('input-names').value
    .split('\n').map(n => n.trim()).filter(n => n.length > 0);
}
function adjustGroups(delta) {
  numGroups = Math.max(2, Math.min(12, numGroups + delta));
  const el = document.getElementById('input-groups');
  if (el) el.value = numGroups;
  updateGroupsHint();
}
function adjustGroupsLive(delta) {
  numGroups = Math.max(2, Math.min(12, numGroups + delta));
  document.getElementById('groups-count-display').textContent = numGroups;
  updateGroupsPerHint();
}
function updateGroupsHint() {
  const total = inputMode === 'numbers'
    ? (parseInt(document.getElementById('input-count')?.value) || 0)
    : parseNames().length;
  const hint = document.getElementById('groups-size-hint');
  if (hint) hint.textContent = total > 0 ? `≈ ${Math.ceil(total / numGroups)} per grupp` : '';
}
function updateGroupsPerHint() {
  const total = allParticipants.length;
  const el = document.getElementById('groups-per-hint');
  if (el) el.textContent = total > 0 ? `(≈ ${Math.ceil(total / numGroups)} / grupp)` : '';
}

// ─── START ────────────────────────
function startApp() {
  if (inputMode === 'numbers') {
    const count = parseInt(document.getElementById('input-count').value) || 2;
    allParticipants = Array.from({ length: count }, (_, i) => String(i + 1));
  } else {
    const names = parseNames();
    if (names.length < 2) { alert('Ange minst 2 namn.'); return; }
    allParticipants = [...names];
  }

  document.getElementById('overlay-setup').classList.remove('active');

  if (appMode === 'spin') {
    removeDrawn = document.getElementById('chk-remove').checked;
    document.getElementById('chk-remove-live').checked = removeDrawn;
    remaining = [...allParticipants];
    drawnItems = [];
    currentAngle = 0;
    document.getElementById('page-spin').classList.remove('hidden');
    updateBadge();
    renderDrawnList();
    setTimeout(initWheel, 50);

  } else {
    numGroups = parseInt(document.getElementById('input-groups').value) || 4;
    document.getElementById('groups-count-display').textContent = numGroups;
    document.getElementById('page-groups').classList.remove('hidden');
    document.getElementById('groups-participant-count').textContent =
      `${allParticipants.length} deltagare`;
    updateGroupsPerHint();
    renderPool();
  }
}

function restartApp() {
  document.getElementById('page-spin').classList.add('hidden');
  document.getElementById('page-groups').classList.add('hidden');
  document.getElementById('settings-panel').classList.add('hidden');
  document.getElementById('drawn-panel').classList.add('hidden');
  settingsPanelOpen = false; drawnPanelOpen = false;
  allParticipants = []; remaining = []; drawnItems = [];
  currentAngle = 0; isSpinning = false;
  const ir = document.getElementById('inline-result');
  if (ir) ir.textContent = '';
  document.getElementById('overlay-setup').classList.add('active');
}

// ─── SPIN SETTINGS / DRAWN PANELS ─
function toggleSettingsPanel() {
  settingsPanelOpen = !settingsPanelOpen;
  document.getElementById('settings-panel').classList.toggle('hidden', !settingsPanelOpen);
}

function toggleRemove() {
  removeDrawn = document.getElementById('chk-remove-live').checked;
  updateBadge();
}

function newRound() {
  remaining = [...allParticipants];
  drawnItems = [];
  currentAngle = 0;
  document.getElementById('inline-result').textContent = '';
  document.getElementById('btn-spin').disabled = false;
  updateBadge();
  renderDrawnList();
  drawWheel();
}

function updateBadge() {
  const badge = document.getElementById('remaining-badge');
  badge.textContent = removeDrawn
    ? `${remaining.length} kvar`
    : `${allParticipants.length} st`;
}

function renderDrawnList() {
  const list = document.getElementById('drawn-list');
  // Newest first
  list.innerHTML = [...drawnItems].reverse()
    .map(d => `<span class="drawn-chip">${d}</span>`).join('');
  const footer = document.getElementById('drawn-count-label');
  if (footer) {
    const total = allParticipants.length;
    const drawn = drawnItems.length;
    footer.textContent = drawn === 0
      ? 'Ingen dragen än'
      : `${drawn} av ${total} dragna`;
  }
}

// Jump to groups page from spin
function openGroupsFromSpin() {
  document.getElementById('page-spin').classList.add('hidden');
  document.getElementById('page-groups').classList.remove('hidden');
  document.getElementById('groups-participant-count').textContent =
    `${allParticipants.length} deltagare`;
  updateGroupsPerHint();
  resetGroupsToPool();
}

// ─── GROUPS PAGE ──────────────────

function renderPool() {
  const poolLayer = document.getElementById('pool-layer');
  poolLayer.innerHTML = '';
  poolLayer.classList.remove('hidden');
  document.getElementById('columns-layer').classList.add('hidden');
  document.getElementById('btn-divide').classList.remove('hidden');
  document.getElementById('btn-reset-groups').classList.add('hidden');

  allParticipants.forEach(p => {
    const chip = document.createElement('span');
    chip.className = 'chip';
    chip.textContent = p;
    chip.dataset.val = p;
    poolLayer.appendChild(chip);
  });
}

function resetGroupsToPool() {
  renderPool();
}

async function startDivideAnimation() {
  // Shuffle into groups
  const pool = [...allParticipants].sort(() => Math.random() - 0.5);
  const groups = [];
  for (let i = 0; i < numGroups; i++) groups.push([]);
  pool.forEach((p, i) => groups[i % numGroups].push(p));

  // 1 — Record positions of pool chips (before animation)
  const poolLayer   = document.getElementById('pool-layer');
  const poolChips   = [...poolLayer.querySelectorAll('.chip')];

  // Map value → pool chip rect
  const startRects = {};
  poolChips.forEach(c => {
    startRects[c.dataset.val] = c.getBoundingClientRect();
  });

  // 2 — Build columns layer (hidden, measure target positions)
  const colLayer = document.getElementById('columns-layer');
  colLayer.innerHTML = '';
  colLayer.classList.remove('hidden');
  colLayer.style.visibility = 'hidden'; // invisible but measurable

  const cols = groups.map((members, gi) => {
    const color = SEG_COLORS[gi % SEG_COLORS.length];
    const col   = document.createElement('div');
    col.className = 'group-col';
    col.innerHTML = `<div class="group-col-title" style="color:${color}">Grupp ${gi + 1}</div>
      <div class="group-col-members" id="col-members-${gi}"></div>`;
    colLayer.appendChild(col);
    return { col, members, color };
  });

  // Add placeholder pills (invisible) to measure targets
  const pillRects = {}; // val → DOMRect
  cols.forEach(({ members }, gi) => {
    const membersEl = document.getElementById(`col-members-${gi}`);
    members.forEach(m => {
      const pill = document.createElement('div');
      pill.className = 'group-pill';
      pill.textContent = m;
      pill.style.opacity = '0';
      pill.dataset.val = m;
      membersEl.appendChild(pill);
    });
  });

  // Force layout so we can measure
  colLayer.getBoundingClientRect();

  colLayer.querySelectorAll('.group-pill').forEach(p => {
    pillRects[p.dataset.val] = p.getBoundingClientRect();
  });

  // 3 — Hide the pool layer and make columns invisible (pills will be invisible, flying chips visible)
  poolLayer.style.opacity = '0';
  colLayer.style.visibility = 'visible';

  // 4 — Create flying chips, position at pool origin, animate to target
  const flyingChips = [];
  allParticipants.forEach(val => {
    const startR  = startRects[val];
    const targetR = pillRects[val];
    if (!startR || !targetR) return;

    const flying = document.createElement('div');
    flying.className = 'chip chip-flying';
    flying.textContent = val;

    // Start position (matches pool chip exactly)
    flying.style.left    = startR.left + 'px';
    flying.style.top     = startR.top  + 'px';
    flying.style.width   = startR.width  + 'px';
    flying.style.height  = startR.height + 'px';
    flying.style.transition = 'none';
    document.body.appendChild(flying);
    flyingChips.push({ flying, targetR });
  });

  // 5 — Brief pause so chips register start position, then animate
  await delay(40);

  // Stagger the animations slightly for visual appeal
  flyingChips.forEach(({ flying, targetR }, i) => {
    setTimeout(() => {
      flying.style.transition =
        `left .55s cubic-bezier(.4,0,.2,1) ${i * 18}ms,
         top  .55s cubic-bezier(.4,0,.2,1) ${i * 18}ms,
         opacity .3s ${i * 18 + 320}ms`;
      flying.style.left    = targetR.left + 'px';
      flying.style.top     = targetR.top  + 'px';
      flying.style.width   = targetR.width  + 'px';
      flying.style.height  = targetR.height + 'px';
    }, 10);
  });

  // 6 — After animation, remove flying chips, reveal pills
  const totalDuration = 40 + allParticipants.length * 18 + 600;
  await delay(totalDuration);

  flyingChips.forEach(({ flying }) => flying.remove());
  colLayer.querySelectorAll('.group-pill').forEach(p => { p.style.opacity = '1'; });
  poolLayer.classList.add('hidden');

  // Update controls
  document.getElementById('btn-divide').classList.add('hidden');
  document.getElementById('btn-reset-groups').classList.remove('hidden');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── WHEEL ────────────────────────
let wheelSize = 300;

function initWheel() {
  const canvas   = document.getElementById('wheel-canvas');
  const spinMain = document.querySelector('.spin-main');
  if (!spinMain) return;

  const dpr = window.devicePixelRatio || 1;
  const w   = spinMain.clientWidth;
  const h   = spinMain.clientHeight;

  // Reserve space for result text (~3.5rem ≈ 56px) + button (~58px) + gaps + pointer
  const reserved = 56 + 58 + 40 + 24; // result + button + gaps + pointer
  const avail    = Math.min(w - 24, h - reserved, 580);
  wheelSize      = Math.max(180, avail);

  // Physical pixels for sharp rendering on retina
  canvas.width  = Math.round(wheelSize * dpr);
  canvas.height = Math.round(wheelSize * dpr);
  // CSS size stays at logical pixels
  canvas.style.width  = wheelSize + 'px';
  canvas.style.height = wheelSize + 'px';

  drawWheel();
}

function drawWheel() {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const ctx  = canvas.getContext('2d');
  const W    = canvas.width;   // physical pixels
  const cx   = W / 2, cy = W / 2, r = W / 2 - 2 * dpr;
  ctx.clearRect(0, 0, W, W);

  // Fill white background — prevents transparency blending with page on iPad
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, 2 * Math.PI);
  ctx.fill();

  const items = remaining.length > 0 ? remaining : ['—'];
  const n   = items.length;
  const arc = (2 * Math.PI) / n;

  for (let i = 0; i < n; i++) {
    const startA = currentAngle + i * arc - Math.PI / 2;
    const endA   = startA + arc;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, startA, endA);
    ctx.closePath();
    ctx.fillStyle = SEG_COLORS[i % SEG_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startA + arc / 2);

    const text = items[i];
    const fs   = (text.length <= 3
      ? Math.max(12, Math.min(26, r * 0.17))
      : Math.max(9,  Math.min(16, r * 0.11)));

    ctx.font = `900 ${fs}px Nunito, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur  = 3 * dpr;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const maxLen = r * 0.78;
    let label = text;
    while (ctx.measureText(label).width > maxLen && label.length > 1) label = label.slice(0, -1);
    if (label !== text) label += '…';
    ctx.fillText(label, r - 12 * dpr, 0);
    ctx.restore();
  }

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.1, 0, 2 * Math.PI);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.1)';
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
}

// ─── SPIN ─────────────────────────
function spin() {
  if (isSpinning || remaining.length === 0) return;
  isSpinning = true;
  document.getElementById('btn-spin').disabled = true;
  document.getElementById('inline-result').textContent = '';

  const winnerIdx   = Math.floor(Math.random() * remaining.length);
  const winner      = remaining[winnerIdx];
  const n           = remaining.length;
  const arc         = (2 * Math.PI) / n;
  const jitter      = (Math.random() - 0.5) * 0.62 * arc;
  const base        = -(winnerIdx + 0.5) * arc + jitter;
  const minSpins    = (6 + Math.floor(Math.random() * 3)) * 2 * Math.PI;
  const minTarget   = currentAngle + minSpins;
  const k           = Math.ceil((minTarget - base) / (2 * Math.PI));
  const targetAngle = base + k * 2 * Math.PI;

  playSpinSound();
  const duration  = 3700 + Math.random() * 800;
  const startA    = currentAngle;
  const startTime = performance.now();

  function animate(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    currentAngle = startA + (targetAngle - startA) * easeOutQuart(progress);
    drawWheel();
    if (progress < 1) requestAnimationFrame(animate);
    else { currentAngle = targetAngle; drawWheel(); onSpinComplete(winner); }
  }
  requestAnimationFrame(animate);
}

function easeOutQuart(t) { return 1 - Math.pow(1 - t, 4); }

function onSpinComplete(winner) {
  isSpinning = false;
  drawnItems.push(winner);
  if (removeDrawn) remaining = remaining.filter(x => x !== winner);
  playWinSound();
  renderDrawnList();
  updateBadge();
  document.getElementById('inline-result').textContent = winner;

  if (removeDrawn && remaining.length === 0) {
    setTimeout(() => {
      launchConfetti();
      document.getElementById('result-value').textContent = '🎉';
      document.getElementById('result-label').textContent = 'Alla är dragna!';
      document.getElementById('overlay-result').classList.add('active');
    }, 600);
  } else {
    document.getElementById('btn-spin').disabled = false;
  }
  drawWheel();
}

function closeResult() {
  document.getElementById('overlay-result').classList.remove('active');
  newRound();
}

// ─── THEME ────────────────────────
function toggleTheme() {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('theme', next);
  ['theme-btn','theme-btn-g'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = next === 'dark' ? '☀️' : '🌙';
  });
  drawWheel();
}
function applyTheme() {
  const saved = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  ['theme-btn','theme-btn-g'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = saved === 'dark' ? '☀️' : '🌙';
  });
}

// ─── FULLSCREEN ───────────────────
function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// ─── SOUND ────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playSpinSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.frequency.setValueAtTime(280, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(540, ctx.currentTime + .18);
    g.gain.setValueAtTime(.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .28);
    osc.start(ctx.currentTime); osc.stop(ctx.currentTime + .28);
  } catch(e) {}
}
function playWinSound() {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioCtx();
    [523, 659, 784, 1047].forEach((f, i) => {
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      const t = ctx.currentTime + i * .1;
      osc.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(.18, t);
      g.gain.exponentialRampToValueAtTime(.001, t + .24);
      osc.start(t); osc.stop(t + .24);
    });
  } catch(e) {}
}
function toggleSound() {
  soundEnabled = !soundEnabled;
  document.getElementById('btn-sound').textContent = soundEnabled ? '🔊' : '🔇';
}

// ─── CONFETTI ─────────────────────
function launchConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  const pieces = Array.from({ length: 130 }, () => ({
    x: Math.random() * canvas.width, y: -10,
    r: 5 + Math.random() * 8,
    color: SEG_COLORS[Math.floor(Math.random() * SEG_COLORS.length)],
    vx: (Math.random() - 0.5) * 4.5,
    vy: 2 + Math.random() * 4,
    angle: Math.random() * 360,
    spin: (Math.random() - 0.5) * 8
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    pieces.forEach(p => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle * Math.PI / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      ctx.restore();
      p.x += p.vx; p.y += p.vy;
      p.angle += p.spin; p.vy += .08;
    });
    if (++frame < 210) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(draw);
}

// ─── PORTRAIT WARNING ─────────────
function checkOrientation() {
  const warn = document.getElementById('portrait-warning');
  if (!warn) return;
  const isPortrait = window.innerHeight > window.innerWidth;
  const isTouch    = navigator.maxTouchPoints > 0;
  if (isTouch && isPortrait) warn.classList.remove('hidden');
  else warn.classList.add('hidden');
}

window.addEventListener('resize', () => {
  checkOrientation();
  if (!document.getElementById('page-spin').classList.contains('hidden')) initWheel();
});
window.addEventListener('orientationchange', () => {
  setTimeout(() => { checkOrientation(); initWheel(); }, 300);
});

// ─── WHEEL ────────────────────────
