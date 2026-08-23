'use strict';
/* ===================================================================
   תעלומה בשכונה — script.js
   Engine: canvas scale, goTo/resetScreenState, question engines,
   RevealTilesGroup, embedded-app gating, drag&drop, scoring.
   =================================================================== */

const TOTAL_SCREENS = 28;
let currentScreen = 1;

window.lomdaState = {
  score: 0,
  questionScores: {}, // key -> points earned
  DONE: {}            // screenNumber -> resolved boolean (resume-state lock)
};

/* ---------------- Canvas scaling ---------------- */
function scaleApp() {
  const app = document.getElementById('app');
  if (!app) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const left = (window.innerWidth - 1920 * scale) / 2;
  const top = (window.innerHeight - 1080 * scale) / 2;
  app.style.transform = 'scale(' + scale + ')';
  app.style.left = left + 'px';
  app.style.top = top + 'px';
}
window.addEventListener('resize', scaleApp);
window.addEventListener('load', scaleApp);
requestAnimationFrame(scaleApp);
setTimeout(scaleApp, 300);

/* ---------------- Navigation ---------------- */
function closeAllOverlays() {
  document.querySelectorAll('.hint-overlay').forEach(function (el) { el.classList.remove('show'); });
  const fb = document.getElementById('feedback-popup');
  if (fb) fb.classList.remove('show');
  const zoom = document.getElementById('img-zoom-modal');
  if (zoom) zoom.classList.remove('show');
  const sim = document.getElementById('sim-modal');
  if (sim) sim.classList.remove('show');
  const simPopup = document.getElementById('sim-reopen-popup');
  if (simPopup) simPopup.classList.remove('show');
  document.querySelectorAll('.sim-reopen-btn').forEach(function (b) { b.classList.remove('is-open'); });
}

function pauseAllVideos() {
  document.querySelectorAll('video').forEach(function (v) { try { v.pause(); } catch (e) {} });
}

function goTo(n) {
  if (n < 1 || n > TOTAL_SCREENS) return;
  pauseAllVideos();
  closeAllOverlays();
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  const target = document.querySelector('.screen[data-screen="' + n + '"]');
  if (target) target.classList.add('active');
  currentScreen = n;
  resetScreenState(n);
  notifyDev(n);
}

function advanceScreen() {
  // Gate: if this screen has a forward nav-next arrow and it is still
  // hidden (not yet unlocked by video-end / sim-timer / question-resolved /
  // all-tiles-viewed), block advancing. This closes the keyboard (ArrowLeft)
  // bypass — the gate must live here, not only in the arrow button's own
  // click handler. See 720-templates/_global-components.md "Advance gates".
  const nextArrow = document.querySelector('.screen[data-screen="' + currentScreen + '"] .nav-next');
  if (nextArrow && nextArrow.classList.contains('hidden')) return;
  goTo(currentScreen + 1);
}
function goBack() { goTo(currentScreen - 1); }

document.addEventListener('keydown', function (e) {
  if (e.key === 'ArrowLeft') advanceScreen();
  if (e.key === 'ArrowRight') goBack();
  if (e.key === 'Escape') closeAllOverlays();
});

function notifyDev(n) {
  try { window.parent.postMessage({ type: 'LOMDA_SCREEN_CHANGED', screen: n }, '*'); } catch (e) {}
}

/* Dev-tool bridge: index_dev.html embeds this page in an <iframe> and drives
   free navigation via postMessage (file:// protocol blocks direct
   cross-frame DOM/script access, so this is the only reliable channel). */
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'DEV_GOTO' && typeof e.data.screen === 'number') {
    goTo(e.data.screen);
  }
});
document.addEventListener('DOMContentLoaded', function () { notifyDev(1); });

/* Self-healing screen-entry watcher. Every per-screen setup step (sizing
   the textbox1 narration card, restarting a looping background video,
   arming a sim-launch timer, etc.) normally runs from resetScreenState(n),
   which only fires from goTo(). Some external harnesses (a review tool
   navigating via its own UI/URL-hash, not our goTo()) instead just toggle
   the .active class directly on a .screen element — silently skipping
   every one of those setup steps, which is exactly what produced the
   under-sized textbox1 card on screen 8, the still-disabled/faded check
   button, and the qState/RevealTilesGroup crashes fixed elsewhere in this
   file. Rather than special-case every individual symptom, watch for the
   .active class landing on any .screen — from ANY source — and run our
   normal entry logic if it wasn't already accounted for. When our own
   goTo() causes the mutation, currentScreen is already updated to n by
   the time this observer callback runs (it fires as a microtask after the
   synchronous classList.add), so the n !== currentScreen check below
   naturally skips re-running setup a second time. */
(function () {
  const app = document.getElementById('app');
  if (!app || typeof MutationObserver === 'undefined') return;
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      const el = m.target;
      if (!el.classList || !el.classList.contains('screen') || !el.classList.contains('active')) return;
      const n = parseInt(el.getAttribute('data-screen'), 10);
      if (isNaN(n) || n === currentScreen) return;
      currentScreen = n;
      resetScreenState(n);
      notifyDev(n);
    });
  }).observe(app, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

/* ===================================================================
   Shared feedback popup
   =================================================================== */
function showFeedback(type, cfg, actionsHtml) {
  const popup = document.getElementById('feedback-popup');
  const qcfg = QCONFIG[currentScreen];
  popup.className = 'show ' + type + (qcfg && qcfg.kind === 'single' ? ' fb-single-q' : '') + (currentScreen === 6 ? ' fb-q1' : '') + (currentScreen === 21 || currentScreen === 22 ? ' fb-s21' : '') + (currentScreen === 25 ? ' fb-s25' : '') + (currentScreen === 26 ? ' fb-s26' : '') + (currentScreen === 27 && type !== 'retry' ? ' fb-s27' : '') + (currentScreen === 18 ? ' fb-s18' : '');
  document.getElementById('fb-title').textContent = cfg.title || '';
  const bodyEl = document.getElementById('fb-body');
  bodyEl.innerHTML = '';
  (cfg.body || []).forEach(function (line) {
    const p = document.createElement('p');
    p.textContent = line;
    bodyEl.appendChild(p);
  });
  const actionsEl = document.getElementById('fb-actions');
  actionsEl.innerHTML = actionsHtml || '';
}
function hideFeedback() {
  document.getElementById('feedback-popup').classList.remove('show');
}

/* ===================================================================
   Hint overlay (generic, id-based)
   =================================================================== */
function openHint(id) { const el = document.getElementById(id); if (el) el.classList.add('show'); }
function closeHint(id) { const el = document.getElementById(id); if (el) el.classList.remove('show'); }

/* ===================================================================
   Image zoom modal (generic)
   =================================================================== */
document.addEventListener('click', function (e) {
  const zoomBtn = e.target.closest('[data-zoom-src]');
  if (zoomBtn) {
    const modal = document.getElementById('img-zoom-modal');
    const panel = document.getElementById('img-zoom-panel-body');
    const src = zoomBtn.getAttribute('data-zoom-src');
    const alt = zoomBtn.getAttribute('data-zoom-alt') || 'תצוגה מוגדלת';
    if (src) {
      panel.innerHTML = '';
      const img = document.createElement('img');
      img.src = src;
      img.alt = alt;
      img.className = 'img-zoom-full';
      panel.appendChild(img);
    } else {
      panel.textContent = alt;
    }
    modal.classList.add('show');
    return;
  }
  if (e.target.closest('[data-zoom-close]')) {
    document.getElementById('img-zoom-modal').classList.remove('show');
  }
});

/* ===================================================================
   Video / narration screens
   Markup contract per screen:
   <div class="video-wrap" data-video-screen="N">
     <video ...></video>
     <button class="play-btn-big" onclick="playVideo(N)" aria-label="הפעל סרטון"></button>
   </div>
   started[N] guards resetScreenState.
   =================================================================== */
const videoStarted = {};
const videoEnded = {};

/* Captions — same technique as the Psifas reference lomda's screen 9: a
   plain positioned DOM overlay driven by the video's own 'timeupdate'
   event, NOT a native <track>/TextTrack. Psifas's own code comments record
   why: under file:// a <track src="...vtt"> fetch is silently blocked
   (each local file is its own restricted origin), and even the in-memory
   addTextTrack()/VTTCue fallback they tried first renders its line/
   line-align positioning inconsistently across browsers. A plain element
   sidesteps both — cue data below as [start, end, text] tuples (seconds),
   transcribed from each video's own audio. */
const VIDEO_CAPTIONS = {
  2: [
    [4.72, 6.68, 'למה האורות מהבהבים ככה?'],
    [7.1, 10.08, 'זה נראה כאילו מישהו משחק עם החשמל של כל השכונה.'],
    [10.24, 12.08, 'לדעתי זה חייזר...'],
    [12.64, 13.62, 'הוא שולח אותות.']
  ],
  5: [
    [0.0, 2.02, 'אילו רעיונות יצירתיים!'],
    [2.97, 6.74, 'בואו נבדוק אילו מהרעיונות מבוססים על מדע'],
    [6.74, 9.68, 'ויכולים להסביר את תעלומת האורות בשכונה.']
  ],
  7: [
    [0.0, 5.94, 'אחרי שסיננו את ההשערות הלא מדעיות, נשארנו עם השערות מדעיות שאפשר לבדוק:'],
    [6.32, 12.04, 'נורה שמתחממת, חיבור רופף בארון החשמל או השפעה של סערת ברקים.'],
    [12.98, 18.0, 'כדי לגלות מהו הגורם האמיתי להבהוב האורות, עלינו לאסוף ראיות.'],
    [18.84, 24.9, 'ראיות הן עובדות שתומכות בהשערה, או תוצאות של מדידה או בדיקה שביצענו'],
    [25.24, 26.8, 'שמהן נוכל ללמוד על העולם.'],
    [27.8, 29.44, 'בואו נצא למשימת חקר!']
  ],
  10: [
    [0.0, 3.58, 'אני משער שברגע שהנורה מתחממת מדי היא נכבית,'],
    [3.58, 6.64, 'וכאשר היא מתקררת היא נדלקת שוב.'],
    [6.64, 8.34, 'זו השערה הגיונית.'],
    [8.78, 10.9, 'אפשר לבדוק את זה באמצעות סימולציה.'],
    [10.9, 12.54, 'יש לי כאן טאבלט.']
  ],
  16: [
    [5.9, 8.96, 'אני חושבת שאני יודעת מה גורם להבהובי האור.'],
    [9.82, 11.76, 'אפשר לראות מה מצאת?'],
    [13.4, 16.96, 'אסור לכם לגעת בארון חשמל בגלל סכנת התחשמלות,'],
    [16.96, 18.64, 'בואו נראה את זה בסימולציה.']
  ],
  24: [
    [0.0, 3.4, 'אתמול פעלנו בדיוק כמו מדענים ומדעניות.'],
    [4.2, 8.86, 'העלינו רעיונות שונים כדי להסביר את תופעת הבהובי האורות.'],
    [9.7, 13.32, 'במדע קוראים לרעיונות האלו השערות.'],
    [14.28, 17.98, 'אחר כך חשבנו איך אפשר לבדוק כל השערה,'],
    [17.98, 23.36, 'ובחרנו רק את ההשערות שאפשר לבדוק בעזרת כלים מדעיים.'],
    [24.16, 27.54, 'עכשיו נראה אם אתם זוכרים את הדרך שעברנו.']
  ]
};

function setupVideoCaptions(n) {
  const cues = VIDEO_CAPTIONS[n];
  const wrap = document.querySelector('.video-wrap[data-video-screen="' + n + '"]');
  const video = wrap && wrap.querySelector('video');
  const capEl = wrap && wrap.querySelector('.video-caption');
  const capText = capEl && capEl.querySelector('p');
  if (!cues || !video || !capEl || !capText) return;
  video.addEventListener('timeupdate', function () {
    const t = video.currentTime;
    const cue = cues.find(function (c) { return t >= c[0] && t < c[1]; });
    if (cue) {
      capText.textContent = cue[2];
      capEl.classList.remove('hidden');
    } else {
      capEl.classList.add('hidden');
    }
  });
}

function playVideo(n) {
  const wrap = document.querySelector('.video-wrap[data-video-screen="' + n + '"]');
  if (!wrap) return;
  const video = wrap.querySelector('video');
  const overlay = wrap.querySelector('.play-btn-big');
  videoStarted[n] = true;
  overlay.classList.add('hidden');
  if (video && video.getAttribute('data-pending-asset')) {
    // no real src yet — simulate an "ended" state after a short delay so
    // gating logic can still be exercised in dev.
    setTimeout(function () { onVideoEnded(n); }, 1500);
    return;
  }
  if (video) {
    video.play().catch(function () {});
    video.addEventListener('ended', function () { onVideoEnded(n); }, { once: true });
  }
}

function onVideoEnded(n) {
  videoEnded[n] = true;
  const arrow = document.querySelector('.screen[data-screen="' + n + '"] .nav-next');
  if (arrow) { arrow.classList.remove('hidden'); arrow.classList.add('blink'); }
}

/* Grows the textbox1 speech-bubble to fit longer narration, using the same
   technique as the Psifas reference lomda's screen 17 (same problem there:
   textbox1.png's own border is fixed at ~y170 and distorts if stretched).
   Only screens whose text exceeds the default crop's border-free room call
   this (screen 2's single short line fits the plain crop as-is and skips
   it entirely) — see resetVideoScreen()'s TEXTBOX1_EXTENDED_SCREENS check.
   - .textbox1-bg-crop stays at its DEFAULT size, completely untouched — its
     own top-left curve must render intact; shortening it (an earlier
     attempt here) breaks the curve's continuity and looks wrong.
   - .textbox1-strip-el (textbox1-strip.png) is inset from the crop's left
     edge so it never overlaps the curve, and STRETCHED downward to
     whatever height is needed — safe, it's a sample of a uniform straight
     run with no border features to distort.
   - .textbox1-corner-el (textbox1-corner.png) carries the real border.
     Its own asset has ~72px of plain curve/white before the border band
     begins (confirmed against Psifas's screen 17: content ending at y176
     with the corner positioned at top:125 — 176-72=104, +~20 gap≈125), so
     it's positioned using that lead distance, not its own top edge, as the
     text boundary. Height is never stretched (that's what distorts border
     thickness). textbox1-wrap sits above it at z-index 6, so text safely
     overlaps the corner's own non-border lead-in without being covered. */
const TEXTBOX1_WRAP_TOP = -4;        // .textbox1-wrap's fixed top
const TEXTBOX1_CROP_TOP = -43;       // .textbox1-bg-crop's fixed top (strip starts here too)
const TEXTBOX1_CORNER_LEAD = 72;     // px of plain curve/white before corner's own border band
const TEXTBOX1_OVERLAP = 4;          // px each layer overlaps its neighbor
const TEXTBOX1_GAP_AFTER_TEXT = 20;  // breathing room before the border band
const TEXTBOX1_CORNER_TOP_OVERRIDE = { 5: 38 }; // visually-tuned fixed top, bypasses the computed value

function syncTextbox1(n) {
  const wrap = document.getElementById('textbox-s' + n);
  const content = wrap && wrap.querySelector('.textbox1-content');
  const stripEl = document.getElementById('textbox-strip-s' + n);
  const cornerEl = document.getElementById('textbox-corner-s' + n);
  if (!content) return;
  // .textbox1-content is position:absolute inside .textbox1-wrap, so the
  // wrap's own scrollHeight never reflects it — measure the content box
  // itself, which sizes to its own children when height is auto.
  content.style.height = 'auto';
  const h = content.scrollHeight;
  content.style.height = h + 'px';
  if (!stripEl || !cornerEl) return; // screen 2: plain crop only, nothing more to size

  const contentBottom = TEXTBOX1_WRAP_TOP + h;
  const cornerTop = (n in TEXTBOX1_CORNER_TOP_OVERRIDE)
    ? TEXTBOX1_CORNER_TOP_OVERRIDE[n]
    : contentBottom - TEXTBOX1_CORNER_LEAD + TEXTBOX1_GAP_AFTER_TEXT;
  const stripTop = TEXTBOX1_CROP_TOP;
  const stripHeight = Math.max(cornerTop + TEXTBOX1_OVERLAP - stripTop, 0);

  stripEl.style.top = stripTop + 'px';
  stripEl.style.height = stripHeight + 'px';
  cornerEl.style.top = cornerTop + 'px';
}

function resetVideoScreen(n) {
  syncTextbox1(n);
  if (videoStarted[n]) return; // resume-state lock
  const wrap = document.querySelector('.video-wrap[data-video-screen="' + n + '"]');
  const arrow = document.querySelector('.screen[data-screen="' + n + '"] .nav-next');
  if (wrap) {
    const overlay = wrap.querySelector('.play-btn-big');
    if (overlay) overlay.classList.remove('hidden');
  }
  if (arrow) arrow.classList.add('hidden');
}

/* Explanation screens (no video) — arrow blinks immediately */
function resetExplainScreen(n) {
  syncTextbox1(n); // no-op if this screen has no textbox1 bubble
  const arrow = document.querySelector('.screen[data-screen="' + n + '"] .nav-next');
  if (arrow) { arrow.classList.remove('hidden'); arrow.classList.add('blink'); }
}

/* Screen 8 — background video plays immediately (decorative, no gating on
   it ending); the forward arrow instead appears+blinks a fixed 3s after
   entering, independent of the video's own length. */
let screen8ArrowTimer = null;
function resetScreen8() {
  syncTextbox1(8);
  const video = document.querySelector('.screen[data-screen="8"] .screen-bg-video');
  // The `autoplay` attribute alone can silently fail to (re)start playback
  // here: the screen is `display:none` until made active, and a video that
  // was never actually laid out/visible when the page first loaded doesn't
  // reliably honor autoplay once it's shown later. Explicitly (re)start it
  // every time this screen is entered instead of relying on the attribute.
  if (video) { video.currentTime = 0; video.play().catch(function () {}); }
  const arrow = document.querySelector('.screen[data-screen="8"] .nav-next');
  if (arrow) arrow.classList.add('hidden');
  if (screen8ArrowTimer) clearTimeout(screen8ArrowTimer);
  screen8ArrowTimer = setTimeout(function () {
    if (arrow) { arrow.classList.remove('hidden'); arrow.classList.add('blink'); }
  }, 3000);
}

/* ===================================================================
   RevealTilesGroup — shared local variant (screens 4 & 20)
   =================================================================== */
const RevealTilesGroup = {
  state: {}, // screenNum -> Set of viewed tile ids

  init: function (screenNum, mode) {
    if (!this.state[screenNum]) this.state[screenNum] = new Set();
  },

  reveal: function (screenNum, tileEl, mode) {
    // Lazily ensure state exists rather than assuming init()/reset() already
    // ran — a harness that jumps straight to a screen (bypassing our own
    // goTo() entry flow) can call rtgClick() before either does.
    if (!this.state[screenNum]) this.state[screenNum] = new Set();
    const id = tileEl.getAttribute('data-tile-id');
    const content = tileEl.getAttribute('data-content');
    const name = tileEl.getAttribute('data-name');
    const board = document.querySelector('.screen[data-screen="' + screenNum + '"] .rtg-board');
    if (board) {
      board.classList.remove('empty');
      board.innerHTML = (name ? '<span class="rtg-name">' + name + '</span>' : '') + content;
    }
    if (mode === 'grayscale-once') {
      tileEl.classList.add('viewed');
      const tilesWrap = document.querySelector('.screen[data-screen="' + screenNum + '"] .rtg-tiles-round');
      if (tilesWrap) tilesWrap.classList.add('started');
    } else if (mode === 'tabs-repeatable') {
      document.querySelectorAll('.screen[data-screen="' + screenNum + '"] .rtg-tab').forEach(function (t) {
        t.classList.remove('active');
      });
      tileEl.classList.add('active');
    } else if (mode === 'card-flip') {
      tileEl.classList.toggle('flipped');
    }
    const set = this.state[screenNum];
    set.add(id);
    const total = document.querySelectorAll('.screen[data-screen="' + screenNum + '"] [data-tile-id]').length;
    if (set.size >= total) {
      const arrow = document.querySelector('.screen[data-screen="' + screenNum + '"] .nav-next');
      if (arrow) { arrow.classList.remove('hidden'); arrow.classList.add('blink'); }
    }
  },

  reset: function (screenNum) {
    if (window.lomdaState.DONE[screenNum]) return;
    this.state[screenNum] = new Set();
    const arrow = document.querySelector('.screen[data-screen="' + screenNum + '"] .nav-next');
    if (arrow) arrow.classList.add('hidden');
    document.querySelectorAll('.screen[data-screen="' + screenNum + '"] [data-tile-id]').forEach(function (t) {
      t.classList.remove('viewed', 'active', 'flipped');
    });
    const tilesWrap = document.querySelector('.screen[data-screen="' + screenNum + '"] .rtg-tiles-round');
    if (tilesWrap) tilesWrap.classList.remove('started');
    const board = document.querySelector('.screen[data-screen="' + screenNum + '"] .rtg-board');
    if (board) { board.classList.add('empty'); board.textContent = ''; }
  }
};
function rtgClick(screenNum, el, mode) {
  RevealTilesGroup.reveal(screenNum, el, mode);
  // full viewing of screen 4/20 marks it "done" for resume-lock purposes
  const total = document.querySelectorAll('.screen[data-screen="' + screenNum + '"] [data-tile-id]').length;
  if (RevealTilesGroup.state[screenNum].size >= total) window.lomdaState.DONE[screenNum] = true;
}

/* ===================================================================
   Generic Single/Multi-choice question engine
   QCONFIG[screenNum] = {
     kind: 'single' | 'multi',
     key, weight,
     correct: 'id'            (single)
     correctSet: ['id',...]   (multi)
     feedback: { retry:{title,body}, correct:{title,body}, wrong2:{title,body} }
   }
   =================================================================== */
const QCONFIG = {};
const qState = {}; // screenNum -> { selected: id|Set, attempts, done, lastWrong }

function qInitConfig(n, cfg) { QCONFIG[n] = cfg; }

// Lazily creates qState[n] on first access rather than assuming qEnter(n)
// already ran — an external harness that jumps straight to a screen (e.g.
// a review tool driven by a URL fragment) can call qSelect/qCheck without
// ever going through our own goTo()/resetScreenState() entry flow.
function qEnsureState(n) {
  if (!qState[n]) qState[n] = { selected: QCONFIG[n].kind === 'multi' ? new Set() : null, attempts: 0, done: false, lastWrong: null };
  return qState[n];
}

function qEnter(n) {
  const st = qEnsureState(n);
  const checkBtn = document.getElementById('q-check-' + n);
  if (st.done) {
    // resume-state lock: keep final visual + reopen feedback
    qRenderLocked(n);
    if (checkBtn) { checkBtn.disabled = true; checkBtn.style.display = 'none'; }
    return;
  }
  document.querySelectorAll('.screen[data-screen="' + n + '"] .q-opt').forEach(function (o) {
    o.classList.remove('selected', 'correct', 'wrong');
  });
  if (checkBtn) { checkBtn.disabled = true; checkBtn.style.display = 'none'; }
  hideFeedback();
}

function qSnapshot(st) {
  return st.selected instanceof Set ? JSON.stringify(Array.from(st.selected).sort()) : String(st.selected);
}

function qSelect(n, id) {
  const cfg = QCONFIG[n];
  const st = qEnsureState(n);
  if (st.done) return;
  if (cfg.kind === 'single') {
    st.selected = id;
    document.querySelectorAll('.screen[data-screen="' + n + '"] .q-opt').forEach(function (o) {
      o.classList.toggle('selected', o.getAttribute('data-id') === id);
    });
  } else {
    if (st.selected.has(id)) st.selected.delete(id); else st.selected.add(id);
    const optEl = document.querySelector('.screen[data-screen="' + n + '"] .q-opt[data-id="' + id + '"]');
    if (optEl) optEl.classList.toggle('selected', st.selected.has(id));
  }
  const checkBtn = document.getElementById('q-check-' + n);
  const hasSelection = cfg.kind === 'single' ? !!st.selected : st.selected.size >= 1;
  const sameAsWrong = st.lastWrong !== null && qSnapshot(st) === st.lastWrong;
  const canCheck = hasSelection && !sameAsWrong;
  if (checkBtn) {
    checkBtn.disabled = !canCheck;
    // The button is hidden entirely (never shown disabled/faded) until the
    // pick is actually checkable — re-picking the exact same wrong answer
    // on a retry keeps it hidden too, instead of showing it faded out.
    checkBtn.style.display = canCheck ? '' : 'none';
  }
}

function qIsCorrect(n) {
  const cfg = QCONFIG[n];
  const st = qState[n];
  if (cfg.kind === 'single') return st.selected === cfg.correct;
  const a = st.selected, b = new Set(cfg.correctSet);
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function qMarkOptions(n, finalReveal) {
  const cfg = QCONFIG[n];
  const st = qState[n];
  document.querySelectorAll('.screen[data-screen="' + n + '"] .q-opt').forEach(function (o) {
    const id = o.getAttribute('data-id');
    const isSelected = cfg.kind === 'single' ? st.selected === id : st.selected.has(id);
    const isCorrectOpt = cfg.kind === 'single' ? id === cfg.correct : cfg.correctSet.indexOf(id) !== -1;
    o.classList.remove('correct', 'wrong');
    if (finalReveal) {
      if (isCorrectOpt) o.classList.add('correct');
      else if (isSelected) o.classList.add('wrong');
    } else {
      if (isSelected && !isCorrectOpt) o.classList.add('wrong');
    }
  });
}

function qRenderLocked(n) {
  qMarkOptions(n, true);
  const cfg = QCONFIG[n];
  const st = qState[n];
  const outcome = st.scoredCorrect ? 'correct' : 'wrong2';
  showFeedback(outcome, cfg.feedback[outcome]);
}

function qCheck(n) {
  const cfg = QCONFIG[n];
  const st = qEnsureState(n);
  st.attempts++;
  const correct = qIsCorrect(n);
  const checkBtn = document.getElementById('q-check-' + n);

  if (correct) {
    qMarkOptions(n, true);
    st.done = true;
    st.scoredCorrect = true;
    window.lomdaState.DONE[n] = true;
    recordScore(cfg.key, cfg.weight);
    showFeedback('correct', cfg.feedback.correct);
    if (checkBtn) { checkBtn.disabled = true; checkBtn.style.display = 'none'; }
    if (n !== 25) revealForwardNav(n); // screen 25: arrow waits for teacher reveal (see override below)
    return;
  }

  if (st.attempts >= 2) {
    qMarkOptions(n, true);
    st.done = true;
    st.scoredCorrect = false;
    window.lomdaState.DONE[n] = true;
    recordScore(cfg.key, 0);
    showFeedback('wrong2', cfg.feedback.wrong2);
    if (checkBtn) { checkBtn.disabled = true; checkBtn.style.display = 'none'; }
    if (n !== 25) revealForwardNav(n); // screen 25: arrow waits for teacher reveal (see override below)
    return;
  }

  // non-final wrong: retry gate. Every question kind (single AND multi)
  // leaves the picks as plain "selected" (no red) so the first wrong try
  // doesn't read as punitive — wrong picks only turn red on the final
  // reveal (qMarkOptions(n, true) above). The check button is hidden
  // entirely (not just disabled), same as every other outcome, and only
  // reappears once the learner picks something for the retry (see qSelect).
  st.lastWrong = qSnapshot(st);
  showFeedback('retry', cfg.feedback.retry);
  if (checkBtn) {
    checkBtn.disabled = true;
    checkBtn.style.display = 'none';
  }
}

function revealForwardNav(n) {
  const arrow = document.querySelector('.screen[data-screen="' + n + '"] .nav-next');
  if (arrow) { arrow.classList.remove('hidden'); arrow.classList.add('blink'); }
}

/* ===================================================================
   Screen 6 — Q1: 7-row classification table (mini two-option groups)
   Gated & scored as ONE question (10 pts), not per row.
   =================================================================== */
const Q1_ROWS = [
  { id: 'a', correct: 'sci' },
  { id: 'b', correct: 'sci' },
  { id: 'c', correct: 'not' },
  { id: 'd', correct: 'sci' },
  { id: 'e', correct: 'not' },
  { id: 'f', correct: 'not' },
  { id: 'g', correct: 'sci' }
];
const Q1_FEEDBACK = {
  correct: {
    title: 'צדקת!',
    body: [
      'רעיונות מדעיים הם רעיונות שניתן לבדוק בעזרת כלים ושיטות מדעיות, והבדיקה יכולה לאשש אותם או להפריך אותם. במקרה שלנו: נורה שמתחממת, חיבור רופף, ברקים וחשמל סטטי.',
      'רעיונות לא מדעיים הם רעיונות שאי‑אפשר לבדוק בעזרת כלים ושיטות מדעיות, או רעיונות שנבדקו והבדיקה הפריכה אותם, ולכן הם אינם נחשבים תקפים מבחינה מדעית. במקרה שלנו: מגנט ענק, רוח רפאים חשמלית וחייזרים ששולחים סימנים.',
      'לרעיונות האלה קוראים השערות מדעיות.'
    ]
  },
  wrong2: {
    title: 'זו טעות, כל הכבוד על הניסיון.',
    body: [
      'רעיונות מדעיים הם רעיונות שניתן לבדוק בעזרת כלים ושיטות מדעיות, והבדיקה יכולה לאשש אותם או להפריך אותם. במקרה שלנו: נורה שמתחממת, חיבור רופף, ברקים וחשמל סטטי.',
      'רעיונות לא מדעיים הם רעיונות שאי‑אפשר לבדוק בעזרת כלים ושיטות מדעיות, או רעיונות שנבדקו והבדיקה הפריכה אותם, ולכן הם אינם נחשבים תקפים מבחינה מדעית. במקרה שלנו: מגנט ענק, רוח רפאים חשמלית וחייזרים ששולחים סימנים.',
      'לרעיונות האלה קוראים השערות מדעיות.'
    ]
  }
};
let q1State = { answers: {}, attempts: 0, done: false, lastWrong: null };

function q1Enter() {
  const checkBtn = document.getElementById('q1-check');
  const pic = document.querySelector('[data-screen="6"] .q1-picture');
  if (pic) pic.style.display = '';
  if (q1State.done) {
    q1Render(true);
    if (checkBtn) checkBtn.disabled = true;
    return;
  }
  q1State = { answers: {}, attempts: q1State.attempts, done: false, lastWrong: q1State.lastWrong };
  document.querySelectorAll('.q1-toggle').forEach(function (b) { b.classList.remove('selected', 'correct', 'wrong'); });
  if (checkBtn) checkBtn.disabled = true;
  hideFeedback();
}

function q1Toggle(rowId, val) {
  if (q1State.done) return;
  q1State.answers[rowId] = val;
  document.querySelectorAll('.q1-toggle[data-row="' + rowId + '"]').forEach(function (b) {
    b.classList.toggle('selected', b.getAttribute('data-val') === val);
  });
  const allAnswered = Q1_ROWS.every(function (r) { return q1State.answers[r.id]; });
  document.getElementById('q1-check').disabled = !allAnswered;
}

function q1AllCorrect() {
  return Q1_ROWS.every(function (r) { return q1State.answers[r.id] === r.correct; });
}

function q1Render(finalReveal) {
  Q1_ROWS.forEach(function (r) {
    document.querySelectorAll('.q1-toggle[data-row="' + r.id + '"]').forEach(function (b) {
      b.classList.remove('correct', 'wrong');
      const val = b.getAttribute('data-val');
      if (finalReveal) {
        if (val === r.correct) b.classList.add('correct');
        else if (q1State.answers[r.id] === val) b.classList.add('wrong');
      } else if (q1State.answers[r.id] === val && val !== r.correct) {
        b.classList.add('wrong');
      }
    });
  });
}

/* Q1 is single-attempt — the very first check is final, correct or not,
   revealing the explanatory feedback either way. On a wrong outcome, only
   the learner's own wrong picks are marked (q1Render(false)) — with just 2
   options per row, also revealing the correct one is redundant. */
function q1Check() {
  q1State.attempts++;
  const correct = q1AllCorrect();
  const checkBtn = document.getElementById('q1-check');
  const pic = document.querySelector('[data-screen="6"] .q1-picture');
  q1Render(correct);
  q1State.done = true;
  window.lomdaState.DONE[6] = true;
  if (pic) pic.style.display = 'none';
  if (correct) {
    recordScore('q1', 10);
    showFeedback('correct', Q1_FEEDBACK.correct);
  } else {
    recordScore('q1', 0);
    showFeedback('wrong2', Q1_FEEDBACK.wrong2);
  }
  checkBtn.disabled = true;
  revealForwardNav(6);
}

/* ===================================================================
   Scoring — equal-weighted across split questions (Q3 x4, Q4 x2)
   =================================================================== */
function recordScore(key, points) {
  window.lomdaState.questionScores[key] = points;
  let total = 0;
  Object.keys(window.lomdaState.questionScores).forEach(function (k) {
    total += window.lomdaState.questionScores[k];
  });
  window.lomdaState.score = total; // out of 100
}

/* ===================================================================
   Embedded simulation apps (screens 11 & 17) + reopen modal
   Arrow reveals 15s after the learner launches the simulation (per
   production script: "החץ יופיע 15 שנ' לאחר הפעלת הישומון").
   =================================================================== */
const simLaunched = {};
function simLaunch(n) {
  if (simLaunched[n]) return;
  simLaunched[n] = true;
  const label = document.querySelector('.screen[data-screen="' + n + '"] .sim-placeholder-label');
  if (label) label.textContent = 'הסימולציה פועלת (ממתין לקובץ אמיתי) — החץ יופיע בעוד 15 שניות';
  setTimeout(function () { revealForwardNav(n); }, 15000);
}
function resetSimScreen(n) {
  if (n !== 17) syncTextbox1(n); // no-op for screen 11; screen 17 uses fixed CSS positioning instead of the auto-height calc
  if (window.lomdaState.DONE[n]) return;
  const arrow = document.querySelector('.screen[data-screen="' + n + '"] .nav-next');
  if (arrow) arrow.classList.add('hidden');
  // Screens 11 & 17: the real app is embedded inline on the tablet (no
  // click-to-launch placeholder), so start the same 15s reveal timer on
  // entry instead of waiting for a simLaunch() click.
  if ((n === 11 || n === 17) && !simLaunched[n]) {
    simLaunched[n] = true;
    setTimeout(function () { revealForwardNav(n); }, 15000);
  }
}

/* Reopen popup used from screens 12-15 (sim screen 11) and 18-19 (sim screen
   17) — anchored near its own .sim-reopen-btn (Psifas's .reminder-btn/
   .reminder-help-popup pattern) instead of a full-screen centered modal.
   Toggling: click again (or any other screen's reopen button) to close. */
function toggleSimPopup(btn, srcScreen) {
  const popup = document.getElementById('sim-reopen-popup');
  const body = document.getElementById('sim-reopen-popup-body');
  const isOpen = popup.classList.contains('show') && btn.classList.contains('is-open');
  document.querySelectorAll('.sim-reopen-btn').forEach(function (b) { b.classList.remove('is-open'); });
  popup.classList.remove('show');
  if (isOpen) {
    body.innerHTML = '';
    return;
  }
  if (srcScreen === 11) {
    body.innerHTML = '<iframe src="assets/app/LIGHT_BOLB.html" title="סימולציית נורה מתחממת"></iframe>';
  } else {
    body.innerHTML = '<iframe src="assets/app/LOOSE_CONNECTION.html" title="סימולציית חיבור רופף בלוח החשמל"></iframe>';
  }
  popup.classList.add('show');
  btn.classList.add('is-open');
}

/* ===================================================================
   Drag & Drop — Screen 26 (Q8), 6-step process ordering, maxAttempts:2
   with View My Answer Toggle on the final wrong attempt.
   =================================================================== */
const DDQ = {
  correctMap: {
    'target-row1': '5',
    'target-row2': '2',
    'target-row3': '4',
    'target-row4': '1',
    'target-row5': '6',
    'target-row6': '3'
  },
  maxAttempts: 2,
  feedbackText: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['התשובה הנכונה מופיעה כעת על המסך.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['התשובה הנכונה מופיעה כעת על המסך.'] }
  }
};
let ddqPlacement = { 'drag-1': 'source', 'drag-2': 'source', 'drag-3': 'source', 'drag-4': 'source', 'drag-5': 'source', 'drag-6': 'source' };
let ddqChecked = false;
let ddqDone = false;
let ddqAttempts = 0;
let ddqLastWrong = null;
let ddqScoredCorrect = null;
let ddqDragActive = null;
let ddqDropHandled = false;

function ddqRender() {
  // source tray
  Object.keys(ddqPlacement).forEach(function (id) {
    const card = document.getElementById(id);
    if (!card) return;
    const slot = card.closest('.ddq-source-slot');
    if (ddqPlacement[id] === 'source') {
      if (slot) slot.appendChild(card);
      card.classList.remove('ghost');
    } else if (slot) {
      card.classList.add('ghost');
    }
  });
  // targets
  Object.keys(DDQ.correctMap).forEach(function (targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    const placedId = Object.keys(ddqPlacement).find(function (k) { return ddqPlacement[k] === targetId; });
    target.innerHTML = '';
    target.classList.remove('occupied');
    if (placedId) {
      const num = placedId.replace('drag-', '');
      const chip = document.createElement('div');
      chip.className = 'ddq-drag-card' + (ddqChecked ? ' locked' : '');
      chip.textContent = num;
      chip.id = 'placed-' + targetId;
      chip.draggable = !ddqChecked;
      chip.addEventListener('dragstart', function (e) { ddqPlacedDragStart(e, placedId); });
      chip.addEventListener('dragend', ddqDragEnd);
      target.appendChild(chip);
      target.classList.add('occupied');
    }
  });
}

function ddqDragStart(e, dragId) {
  if (ddqChecked) { e.preventDefault(); return; }
  ddqDragActive = dragId;
  ddqDropHandled = false;
  e.dataTransfer.setData('text/plain', dragId);
  e.dataTransfer.effectAllowed = 'move';
}
function ddqPlacedDragStart(e, dragId) {
  if (ddqChecked) { e.preventDefault(); return; }
  ddqDragActive = dragId;
  ddqDropHandled = false;
  e.dataTransfer.setData('text/plain', dragId);
  e.dataTransfer.effectAllowed = 'move';
  setTimeout(function () { ddqPlacement[dragId] = 'source'; ddqRender(); }, 0);
}
function ddqDragEnd() {
  if (!ddqDropHandled) ddqRender();
  ddqDragActive = null;
}
function ddqDragOver(e, targetId) { e.preventDefault(); const t = document.getElementById(targetId); if (t) t.classList.add('drag-over'); }
function ddqDragLeave(e, targetId) { const t = document.getElementById(targetId); if (t) t.classList.remove('drag-over'); }
function ddqDrop(e, targetId) {
  e.preventDefault();
  const t = document.getElementById(targetId);
  if (t) t.classList.remove('drag-over');
  const dragId = ddqDragActive || e.dataTransfer.getData('text/plain');
  if (!dragId) return;
  ddqDropHandled = true;
  // evict any item currently in this target
  Object.keys(ddqPlacement).forEach(function (k) {
    if (ddqPlacement[k] === targetId && k !== dragId) ddqPlacement[k] = 'source';
  });
  ddqPlacement[dragId] = targetId;
  ddqRender();
  ddqUpdateCheckGate();
}
function ddqUpdateCheckGate() {
  const btn = document.getElementById('ddq-check');
  if (!btn) return;
  const allFilled = Object.keys(DDQ.correctMap).every(function (tId) {
    return Object.values(ddqPlacement).indexOf(tId) !== -1;
  });
  const snapshot = JSON.stringify(ddqPlacement);
  const sameAsWrong = ddqLastWrong !== null && snapshot === ddqLastWrong;
  const canCheck = allFilled && !sameAsWrong;
  btn.disabled = !canCheck;
  // Hidden entirely (never shown disabled/faded) until the placement is
  // actually checkable — mirrors the same-screen question engine's "button
  // only appears once there's something to check" behavior, including
  // staying hidden (not faded) when the retry re-lands on the exact same
  // wrong placement.
  btn.style.display = canCheck ? '' : 'none';
}

function ddqMarkTargetsCorrect() {
  Object.keys(DDQ.correctMap).forEach(function (tId) {
    const t = document.getElementById(tId);
    if (t) { t.classList.remove('wrong'); t.classList.add('correct'); }
  });
}
function ddqMarkTargetsByCorrectness() {
  Object.keys(DDQ.correctMap).forEach(function (tId) {
    const t = document.getElementById(tId);
    if (!t) return;
    const placedId = Object.keys(ddqPlacement).find(function (k) { return ddqPlacement[k] === tId; });
    const expected = 'drag-' + DDQ.correctMap[tId];
    t.classList.remove('correct', 'wrong');
    t.classList.add(placedId === expected ? 'correct' : 'wrong');
  });
}
function ddqRevealCorrect() {
  Object.keys(ddqPlacement).forEach(function (k) { ddqPlacement[k] = 'source'; });
  Object.keys(DDQ.correctMap).forEach(function (tId) {
    ddqPlacement['drag-' + DDQ.correctMap[tId]] = tId;
  });
  ddqRender();
}
function ddqLock() {
  ddqChecked = true;
  document.querySelectorAll('.ddq-drag-card').forEach(function (c) { c.classList.add('locked'); c.draggable = false; });
  const btn = document.getElementById('ddq-check');
  if (btn) btn.disabled = true;
}

function ddqCheck() {
  ddqAttempts++;
  const allCorrect = Object.keys(DDQ.correctMap).every(function (tId) {
    const placed = Object.keys(ddqPlacement).find(function (k) { return ddqPlacement[k] === tId; });
    return placed === 'drag-' + DDQ.correctMap[tId];
  });

  if (allCorrect) {
    ddqScoredCorrect = true;
    ddqMarkTargetsCorrect();
    ddqLock();
    ddqDone = true;
    window.lomdaState.DONE[26] = true;
    recordScore('q8', 10);
    showFeedback('correct', DDQ.feedbackText.correct);
    const btn = document.getElementById('ddq-check');
    if (btn) btn.style.display = 'none';
    revealForwardNav(26);
    return;
  }

  if (ddqAttempts >= DDQ.maxAttempts) {
    // Per the production script: show right/wrong on the learner's own
    // final placement first, then after a short pause the correct answers
    // fill in on their own (no "view my answer"/"view solution" toggle).
    ddqScoredCorrect = false;
    ddqDone = true;
    window.lomdaState.DONE[26] = true;
    recordScore('q8', 0);
    ddqMarkTargetsByCorrectness();
    ddqLock();
    showFeedback('wrong2', DDQ.feedbackText.wrong2);
    const btn = document.getElementById('ddq-check');
    if (btn) btn.style.display = 'none';
    setTimeout(function () {
      ddqRevealCorrect();
      ddqMarkTargetsCorrect();
      revealForwardNav(26);
    }, 2000);
    return;
  }

  // non-final wrong: retry gate — hidden entirely (not just disabled),
  // same as every other outcome; reappears once a placement changes (see
  // ddqUpdateCheckGate).
  ddqLastWrong = JSON.stringify(ddqPlacement);
  const retryBtn = document.getElementById('ddq-check');
  retryBtn.disabled = true;
  retryBtn.style.display = 'none';
  showFeedback('retry', DDQ.feedbackText.retry);
}

function ddqEnter() {
  const btn = document.getElementById('ddq-check');
  if (ddqDone) {
    if (btn) btn.style.display = 'none';
    if (ddqScoredCorrect) {
      ddqRender();
      ddqMarkTargetsCorrect();
      ddqLock();
      showFeedback('correct', DDQ.feedbackText.correct);
    } else {
      ddqRevealCorrect(); // re-renders with the correct placement, already final
      ddqMarkTargetsCorrect();
      ddqLock();
      showFeedback('wrong2', DDQ.feedbackText.wrong2);
    }
    return;
  }
  ddqPlacement = { 'drag-1': 'source', 'drag-2': 'source', 'drag-3': 'source', 'drag-4': 'source', 'drag-5': 'source', 'drag-6': 'source' };
  ddqChecked = false;
  ddqAttempts = 0;
  ddqLastWrong = null;
  ddqRender();
  hideFeedback();
  if (btn) { btn.disabled = true; btn.style.display = 'none'; }
}

/* ===================================================================
   Completion screen (28)
   =================================================================== */
function computeFinalGrade() { return Math.round(window.lomdaState.score); }
function finishLomda() {
  const grade = computeFinalGrade();
  try { window.parent.postMessage({ type: 'LOMDA_COMPLETE', score: grade }, '*'); } catch (e) {}
  const el = document.getElementById('completion-grade-display');
  if (el) el.textContent = grade;
  window.close();
}
function enterCompletion() {
  const el = document.getElementById('completion-grade-display');
  if (el) el.textContent = computeFinalGrade();
}

/* ===================================================================
   Question step indicator (1-9) — lives outside all .screen divs,
   shown/moved to the active step whenever a question screen is entered.
   =================================================================== */
const SCREEN_TO_QSTEP = {
  6: 1, 9: 2, 12: 3, 13: 3, 14: 3, 15: 3, 18: 4, 19: 4,
  21: 5, 22: 6, 25: 7, 26: 8, 27: 9
};
function updateQStepper(n) {
  const stepper = document.getElementById('q-stepper');
  if (!stepper) return;
  const active = SCREEN_TO_QSTEP[n];
  stepper.classList.toggle('visible', !!active);
  stepper.querySelectorAll('.q-step').forEach(function (el) {
    el.classList.toggle('active', Number(el.getAttribute('data-step')) === active);
  });
}

/* ===================================================================
   resetScreenState — dispatch per screen
   =================================================================== */
function resetScreenState(n) {
  updateQStepper(n);
  switch (n) {
    case 1: break; // intro, nothing to reset
    case 2: resetVideoScreen(2); break;
    case 3: resetExplainScreen(3); break;
    case 4: RevealTilesGroup.init(4); RevealTilesGroup.reset(4); break;
    case 5: resetVideoScreen(5); break;
    case 6: q1Enter(); break;
    case 7: resetVideoScreen(7); break;
    case 8: resetScreen8(); break;
    case 9: qEnter(9); break;
    case 10: resetVideoScreen(10); break;
    case 11: resetSimScreen(11); break;
    case 12: qEnter(12); break;
    case 13: qEnter(13); break;
    case 14: qEnter(14); break;
    case 15: qEnter(15); break;
    case 16: resetVideoScreen(16); break;
    case 17: resetSimScreen(17); break;
    case 18: qEnter(18); break;
    case 19: qEnter(19); break;
    case 20: RevealTilesGroup.init(20); RevealTilesGroup.reset(20); break;
    case 21: qEnter(21); break;
    case 22: qEnter(22); break;
    case 23: resetExplainScreen(23); break;
    case 24: resetVideoScreen(24); break;
    case 25: qEnter(25); break;
    case 26: ddqEnter(); break;
    case 27: qEnter(27); break;
    case 28: enterCompletion(); break;
  }
}

/* ===================================================================
   Question config registration
   =================================================================== */
qInitConfig(9, {
  kind: 'single', key: 'q2', weight: 10, correct: '2',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['ברקים מתרחשים בזמן סערה. מכיוון שהשמיים היו בהירים ולא היה סיכוי לגשם, אפשר לשלול את ההשערה שברקים גרמו להבהוב האורות.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['ברקים מתרחשים בזמן סערה. מכיוון שהשמיים היו בהירים ולא היה סיכוי לגשם, אפשר לשלול את ההשערה שברקים גרמו להבהוב האורות.'] }
  }
});
qInitConfig(12, {
  kind: 'single', key: 'q3a', weight: 5, correct: '1',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['הגרף מראה שטמפרטורת הנורה עולה בהדרגה לאורך הזמן. הממצא הזה יעזור לנו להבין בהמשך מדוע הנורה נכבית.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['הגרף מראה שטמפרטורת הנורה עולה בהדרגה לאורך הזמן. הממצא הזה יעזור לנו להבין בהמשך מדוע הנורה נכבית.'] }
  }
});
qInitConfig(13, {
  kind: 'single', key: 'q3b', weight: 5, correct: '3',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['הנורה נכבית כאשר טמפרטורת הנורה מגיעה לטמפרטורת הסף (120°C).'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['הנורה נכבית כאשר טמפרטורת הנורה מגיעה לטמפרטורת הסף (120°C).'] }
  }
});
qInitConfig(14, {
  kind: 'single', key: 'q3c', weight: 5, correct: '1',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['לאחר שהנורה התקררה לטמפרטורת החדר (25°C), היא נדלקה שוב.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['לאחר שהנורה התקררה לטמפרטורת החדר (25°C), היא נדלקה שוב.'] }
  }
});
qInitConfig(15, {
  kind: 'single', key: 'q3d', weight: 5, correct: '2',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['הסימולציה מראה שהנורה נכבית כאשר היא מתחממת מדי, ונדלקת מחדש לאחר שהתקררה. מכאן אפשר להסיק שהבהוב האורות נגרם ממנגנון הגנה מפני התחממות יתר.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['הסימולציה מראה שהנורה נכבית כאשר היא מתחממת מדי, ונדלקת מחדש לאחר שהתקררה. מכאן אפשר להסיק שהבהוב האורות נגרם ממנגנון הגנה מפני התחממות יתר.'] }
  }
});
qInitConfig(18, {
  kind: 'multi', key: 'q4a', weight: 5, correctSet: ['2', '4'],
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['בסימולציה אפשר לזהות חיבור רופף לפי שני סימנים: הזרם החשמלי אינו רציף, והנורה מהבהבת או נחלשת לסירוגין.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['בסימולציה אפשר לזהות חיבור רופף לפי שני סימנים: הזרם החשמלי אינו רציף, והנורה מהבהבת או נחלשת לסירוגין.'] }
  }
});
qInitConfig(19, {
  kind: 'single', key: 'q4b', weight: 5, correct: '1',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['חיבור רופף גורם לזרם החשמלי להיעצר ולהתחדש במהירות. כתוצאה מכך הנורה אינה מקבלת זרם באופן רציף ולכן היא מהבהבת.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['חיבור רופף גורם לזרם החשמלי להיעצר ולהתחדש במהירות. כתוצאה מכך הנורה אינה מקבלת זרם באופן רציף ולכן היא מהבהבת.'] }
  }
});
qInitConfig(21, {
  kind: 'multi', key: 'q5', weight: 10, correctSet: ['1', '3', '5'],
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['חיבור חשמלי רופף הוא לא רק תקלה טכנית. הוא עלול להשפיע על בטיחות התושבים, על אספקת החשמל ועל איכות החיים בשכונה.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['חיבור חשמלי רופף הוא לא רק תקלה טכנית. הוא עלול להשפיע על בטיחות התושבים, על אספקת החשמל ועל איכות החיים בשכונה.'] }
  }
});
qInitConfig(22, {
  kind: 'single', key: 'q6', weight: 10, correct: '2',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['כאשר מזהים תקלה שעלולה לסכן את הציבור, האחריות שלנו היא לדווח לגורמים המוסמכים כדי שיוכלו לטפל בה בצורה בטוחה.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['כאשר מזהים תקלה שעלולה לסכן את הציבור, האחריות שלנו היא לדווח לגורמים המוסמכים כדי שיוכלו לטפל בה בצורה בטוחה.'] }
  }
});
qInitConfig(25, {
  kind: 'multi', key: 'q7', weight: 10, correctSet: ['1', '3'],
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['חקר מדעי מתבסס על רעיונות שאפשר לבדוק באופן ממשי באמצעות תצפיות, ניסויים וכלים מדעיים.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['חקר מדעי מתבסס על רעיונות שאפשר לבדוק באופן ממשי באמצעות תצפיות, ניסויים וכלים מדעיים.'] }
  }
});
qInitConfig(27, {
  kind: 'single', key: 'q9', weight: 10, correct: '3',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['ידע מדעי אינו רק מסביר תופעות, אלא גם מסייע לקבל החלטות אחראיות ומבוססות לטובת האנשים והסביבה.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['ידע מדעי אינו רק מסביר תופעות, אלא גם מסייע לקבל החלטות אחראיות ומבוססות לטובת האנשים והסביבה.'] }
  }
});

/* Screen 25 extra: teacher character appears AFTER feedback is shown */
(function () {
  const originalQCheck = qCheck;
  window.qCheck = function (n) {
    originalQCheck(n);
    if (n === 25 && qState[25] && qState[25].done) {
      const teacher = document.getElementById('s25-teacher');
      if (teacher) teacher.style.display = 'block';
      const pic = document.querySelector('[data-screen="25"] .q7-picture');
      if (pic) pic.style.display = 'none';
      setTimeout(function () { revealForwardNav(25); }, 400);
    }
  };
})();

/* Initial screen setup on load */
document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
  const first = document.querySelector('.screen[data-screen="1"]');
  if (first) first.classList.add('active');
  resetScreenState(1);
  Object.keys(VIDEO_CAPTIONS).forEach(function (n) { setupVideoCaptions(Number(n)); });
});

/* Webfonts can finish loading after first layout, changing text-wrap height
   — resync every textbox1 bubble once fonts settle so none end up clipped. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    [2, 5, 7, 10, 16, 24].forEach(syncTextbox1);
  });
}
