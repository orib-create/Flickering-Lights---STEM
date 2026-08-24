'use strict';
/* ===================================================================
   תעלומה בשכונה — script.js
   Engine: canvas scale, goTo/resetScreenState, question engines,
   RevealTilesGroup, embedded-app gating, drag&drop, scoring.
   =================================================================== */

const TOTAL_SCREENS = 29;
let currentScreen = 1;

window.lomdaState = {
  score: 0,
  questionScores: {}, // key -> points earned
  DONE: {}            // screenNumber -> resolved boolean (resume-state lock)
};

/* ---------------- Canvas scaling ----------------
   Embedding this page in an external QA/review "system" iframe means the
   wrapper's own layout isn't always settled at the instant this first runs
   (unlike opening the file directly, where the browser window is already
   correctly sized) — and resizing an iframe from its parent page doesn't
   reliably fire a 'resize' event inside the iframe's own window in every
   browser, so a wrong initial scale can otherwise never self-correct. The
   visible symptom is exactly "the page doesn't always load well": content
   clipped/misplaced, or clicks landing at coordinates that don't match what
   rendered. Defend on three fronts: skip computing against a not-yet-laid-out
   0×0 viewport, re-run a few times over the following seconds regardless of
   whether 'resize' ever fires, and watch the layout viewport itself via
   ResizeObserver (catches an iframe-parent resize that skips 'resize'). */
function scaleApp() {
  const app = document.getElementById('app');
  if (!app || !window.innerWidth || !window.innerHeight) return;
  const scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
  const left = (window.innerWidth - 1920 * scale) / 2;
  const top = (window.innerHeight - 1080 * scale) / 2;
  app.style.transform = 'scale(' + scale + ')';
  app.style.left = left + 'px';
  app.style.top = top + 'px';
}
window.addEventListener('resize', scaleApp);
window.addEventListener('load', scaleApp);
document.addEventListener('visibilitychange', function () { if (!document.hidden) scaleApp(); });
requestAnimationFrame(scaleApp);
[100, 300, 800, 1500, 3000].forEach(function (ms) { setTimeout(scaleApp, ms); });
if (window.ResizeObserver) new ResizeObserver(scaleApp).observe(document.documentElement);

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
  returnOverlayFocus();
}

/* ---------------- Overlay focus management (a11y) ----------------
   feedback-popup / img-zoom-modal / sim-reopen-popup are all role="dialog"/
   "alertdialog" overlays with no native <dialog> backing them, so focus
   has to be moved in/out and Tab has to be trapped by hand. */
let lastFocusedBeforeOverlay = null;
function openOverlayFocus(el) {
  if (!el) return;
  lastFocusedBeforeOverlay = document.activeElement;
  el.focus({ preventScroll: true });
}
function returnOverlayFocus() {
  const el = lastFocusedBeforeOverlay;
  lastFocusedBeforeOverlay = null;
  if (el && typeof el.focus === 'function' && document.contains(el)) el.focus({ preventScroll: true });
}
function getOpenDialog() {
  const ids = ['feedback-popup', 'img-zoom-modal', 'sim-reopen-popup'];
  for (let i = 0; i < ids.length; i++) {
    const el = document.getElementById(ids[i]);
    if (el && el.classList.contains('show')) return el;
  }
  return null;
}
function getFocusable(container) {
  return Array.prototype.slice
    .call(container.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"]), iframe'))
    .filter(function (el) { return el.tagName === 'IFRAME' || el.offsetParent !== null; });
}
function focusScreen(n) {
  const section = document.querySelector('.screen[data-screen="' + n + '"]');
  if (section) section.focus({ preventScroll: true });
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
  const openDialog = getOpenDialog();

  // Trap Tab inside whichever overlay is open — otherwise focus can leave
  // to the screen "behind" it, which a sighted mouse-user would never notice
  // but strands keyboard/screen-reader users outside a dialog they can't see.
  if (openDialog && e.key === 'Tab') {
    const focusables = getFocusable(openDialog);
    if (!focusables.length) { e.preventDefault(); return; }
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (focusables.indexOf(document.activeElement) === -1) {
      e.preventDefault(); (e.shiftKey ? last : first).focus({ preventScroll: true });
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus({ preventScroll: true });
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus({ preventScroll: true });
    }
    return;
  }

  if (!openDialog) {
    if (e.key === 'ArrowLeft') advanceScreen();
    if (e.key === 'ArrowRight') goBack();
  }
  if (e.key === 'Escape') closeAllOverlays();

  if (e.key === 'Enter' || e.key === ' ') {
    const el = document.activeElement;
    if (!el) return;
    // Drag-and-drop keyboard alternative (screen 26) — see ddqKeyPick/ddqKeyDrop.
    if (el.classList && el.classList.contains('ddq-drag-card')) {
      e.preventDefault();
      ddqKeyPick(el.dataset.dragId || el.id);
      return;
    }
    if (el.classList && el.classList.contains('ddq-target')) {
      e.preventDefault();
      ddqKeyDrop(el.id);
      return;
    }
    // Generic custom-widget activation: role="button"/"radio"/"checkbox" on a
    // non-native element (e.g. <div role="button">) gets no automatic
    // Enter/Space handling from the browser the way a real <button> does.
    const role = el.getAttribute && el.getAttribute('role');
    if (role === 'button' || role === 'radio' || role === 'checkbox') {
      e.preventDefault();
      el.click();
    }
  }
});

function notifyDev(n) {
  try { window.parent.postMessage({ type: 'LOMDA_SCREEN_CHANGED', screen: n }, '*'); } catch (e) {}
}

/* Dev-tool bridge: index_dev.html embeds this page in an <iframe> and drives
   free navigation via postMessage (file:// protocol blocks direct
   cross-frame DOM/script access, so this is the only reliable channel). */
window.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'DEV_GOTO' && typeof e.data.screen === 'number') {
    handshakeAcked = true;
    goTo(e.data.screen);
  }
});
/* A single one-shot "I'm ready" postMessage can silently go missing if the
   host page (an external QA/review "system") attaches its own message
   listener a moment after this fires — there's no delivery guarantee, and
   no error either way. Re-announce a few times until the host actually
   replies with a DEV_GOTO, instead of firing once and hoping. */
let handshakeAcked = false;
function announceReady() {
  if (handshakeAcked) return;
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'DEV_READY', total: TOTAL_SCREENS }, '*');
    }
  } catch (e) {}
}
document.addEventListener('DOMContentLoaded', function () {
  notifyDev(1);
  announceReady();
});
window.addEventListener('load', announceReady);
let handshakeTries = 0;
const handshakeTimer = setInterval(function () {
  announceReady();
  if (handshakeAcked || ++handshakeTries > 20) clearInterval(handshakeTimer);
}, 400);

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
  popup.className = 'show ' + type + (qcfg && qcfg.kind === 'single' ? ' fb-single-q' : '') + (currentScreen === 6 ? ' fb-q1' : '') + (currentScreen === 22 || currentScreen === 23 ? ' fb-s22' : '') + (currentScreen === 26 ? ' fb-s26' : '') + (currentScreen === 27 ? ' fb-s27' : '') + (currentScreen === 28 && type !== 'retry' ? ' fb-s28' : '') + (currentScreen === 19 ? ' fb-s19' : '');
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
  openOverlayFocus(popup);
}
function hideFeedback() {
  document.getElementById('feedback-popup').classList.remove('show');
  returnOverlayFocus();
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
    openOverlayFocus(modal.querySelector('.img-zoom-close'));
    return;
  }
  if (e.target.closest('[data-zoom-close]')) {
    document.getElementById('img-zoom-modal').classList.remove('show');
    returnOverlayFocus();
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
    [12.56, 14.34, 'למה האורות מהבהבים ככה?'],
    [14.76, 17.74, 'זה נראה כאילו מישהו משחק עם החשמל של כל השכונה.'],
    [18.06, 19.74, 'לדעתי זה חייזר...'],
    [20.24, 21.22, 'הוא שולח אותות.']
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
  11: [
    [0.0, 3.58, 'אני משער שברגע שהנורה מתחממת מדי היא נכבית,'],
    [3.58, 6.64, 'וכאשר היא מתקררת היא נדלקת שוב.'],
    [6.64, 8.34, 'זו השערה הגיונית.'],
    [8.78, 10.9, 'אפשר לבדוק את זה באמצעות סימולציה.'],
    [10.9, 12.54, 'יש לי כאן טאבלט.']
  ],
  17: [
    [5.57, 9.41, 'אני חושבת שאני יודעת מה גורם להבהובי האור.'],
    [9.41, 11.87, 'אפשר לראות מה מצאת?'],
    [12.05, 15.61, 'אסור לכם לגעת בארון חשמל בגלל סכנת התחשמלות,'],
    [15.61, 17.49, 'בואו נראה את זה בסימולציה.']
  ],
  25: [
    [0.0, 3.02, 'אתמול פעלנו בדיוק כמו מדענים ומדעניות.'],
    [3.7, 7.84, 'העלינו רעיונות שונים כדי להסביר את תופעת הבהובי האורות.'],
    [8.46, 11.64, 'במדע קוראים לרעיונות האלו השערות.'],
    [12.46, 15.7, 'אחר כך חשבנו איך אפשר לבדוק כל השערה,'],
    [15.7, 20.4, 'ובחרנו רק את ההשערות שאפשר לבדוק בעזרת כלים מדעיים.'],
    [21.2, 24.0, 'עכשיו נראה אם אתם זוכרים את הדרך שעברנו.']
  ]
};

const videoCaptionsEnabled = {}; // n -> boolean, toggled by the vctrls CC button; defaults true

function setupVideoCaptions(n) {
  const cues = VIDEO_CAPTIONS[n];
  const wrap = document.querySelector('.video-wrap[data-video-screen="' + n + '"]');
  const video = wrap && wrap.querySelector('video');
  const capEl = wrap && wrap.querySelector('.video-caption');
  const capText = capEl && capEl.querySelector('p');
  if (!cues || !video || !capEl || !capText) return;
  if (!(n in videoCaptionsEnabled)) videoCaptionsEnabled[n] = true;
  video.addEventListener('timeupdate', function () {
    if (!videoCaptionsEnabled[n]) { capEl.classList.add('hidden'); return; }
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

/* Custom playback bar (.vctrls) — replaces native <video controls> so the
   RTL screen keeps a consistent look across browsers. Wired once per video
   the first time playVideo() starts it; videoControlsInit guards against
   re-binding listeners if the learner re-enters the screen. */
const videoControlsInit = {};
function formatTime(sec) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return m + ':' + (s < 10 ? '0' : '') + s;
}
function initVideoControls(n) {
  if (videoControlsInit[n]) return;
  videoControlsInit[n] = true;
  const wrap = document.querySelector('.video-wrap[data-video-screen="' + n + '"]');
  const video = wrap && wrap.querySelector('video');
  const bar = wrap && wrap.querySelector('.vctrls');
  if (!video || !bar) return;

  const playBtn = bar.querySelector('[data-play]');
  const curEl = bar.querySelector('[data-cur]');
  const durEl = bar.querySelector('[data-dur]');
  const seek = bar.querySelector('[data-seek]');
  const ccBtn = bar.querySelector('[data-cc]');
  const muteBtn = bar.querySelector('[data-mute]');
  const vol = bar.querySelector('[data-vol]');
  const fullBtn = bar.querySelector('[data-full]');
  let seeking = false;

  function syncPlayIcon() { playBtn.textContent = video.paused ? '▶' : '⏸'; }
  video.addEventListener('play', syncPlayIcon);
  video.addEventListener('pause', syncPlayIcon);
  video.addEventListener('ended', function () { onVideoEnded(n); });
  playBtn.addEventListener('click', function () {
    // Route through playVideo() so the poster overlay / resume-state lock
    // stay correct even if the learner starts playback from the bar itself
    // instead of the big poster button.
    if (video.paused) playVideo(n); else video.pause();
  });

  video.addEventListener('loadedmetadata', function () { durEl.textContent = formatTime(video.duration); });
  video.addEventListener('timeupdate', function () {
    curEl.textContent = formatTime(video.currentTime);
    if (!seeking && video.duration) seek.value = String(Math.round((video.currentTime / video.duration) * 1000));
    // Reveal forward nav a few seconds before the real end instead of only
    // on 'ended' — confirmed in the Psifas reference lomda (screen 1) as a
    // defense against embedded/QA-host playback where 'ended' can be late
    // or, under an odd embed, never fire at all, otherwise stranding the
    // learner on a screen that never lets them continue.
    if (!videoEnded[n] && video.duration && video.duration - video.currentTime <= 3) onVideoEnded(n);
  });
  seek.addEventListener('input', function () {
    seeking = true;
    if (video.duration) curEl.textContent = formatTime((seek.value / 1000) * video.duration);
  });
  seek.addEventListener('change', function () {
    if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
    seeking = false;
  });

  if (!(n in videoCaptionsEnabled)) videoCaptionsEnabled[n] = true;
  ccBtn.classList.toggle('is-off', !videoCaptionsEnabled[n]);
  ccBtn.addEventListener('click', function () {
    videoCaptionsEnabled[n] = !videoCaptionsEnabled[n];
    ccBtn.classList.toggle('is-off', !videoCaptionsEnabled[n]);
    ccBtn.setAttribute('aria-pressed', String(videoCaptionsEnabled[n]));
  });

  function syncMuteIcon() { muteBtn.textContent = video.muted || video.volume === 0 ? '🔇' : '🔊'; }
  muteBtn.addEventListener('click', function () {
    video.muted = !video.muted;
    if (!video.muted && video.volume === 0) video.volume = 1;
    vol.value = video.muted ? '0' : String(Math.round(video.volume * 100));
    syncMuteIcon();
  });
  vol.addEventListener('input', function () {
    video.volume = vol.value / 100;
    video.muted = video.volume === 0;
    syncMuteIcon();
  });
  syncMuteIcon();

  fullBtn.addEventListener('click', function () {
    const target = wrap;
    if (document.fullscreenElement) { document.exitFullscreen().catch(function () {}); }
    else if (target.requestFullscreen) { target.requestFullscreen().catch(function () {}); }
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
    initVideoControls(n); // no-op if already bound at page init
    video.play().catch(function () {});
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
   RevealTilesGroup — shared local variant (screens 4 & 21)
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
    o.setAttribute('aria-checked', 'false');
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
      const isSel = o.getAttribute('data-id') === id;
      o.classList.toggle('selected', isSel);
      o.setAttribute('aria-checked', String(isSel));
    });
  } else {
    if (st.selected.has(id)) st.selected.delete(id); else st.selected.add(id);
    const optEl = document.querySelector('.screen[data-screen="' + n + '"] .q-opt[data-id="' + id + '"]');
    if (optEl) {
      const isSel = st.selected.has(id);
      optEl.classList.toggle('selected', isSel);
      optEl.setAttribute('aria-checked', String(isSel));
    }
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

// Multi-choice partial credit check: did the learner pick at least one of
// the correct answers (even though not all of them)? Used to distinguish
// "זו תשובה חלקית" from a fully-wrong final attempt (no correct answers
// picked at all) — only meaningful where the config defines a `partial`
// feedback entry (see qCheck).
function qHasAnyCorrectSelected(n) {
  const cfg = QCONFIG[n];
  const st = qState[n];
  if (cfg.kind !== 'multi') return false;
  for (const v of st.selected) if (cfg.correctSet.indexOf(v) !== -1) return true;
  return false;
}

function qMarkOptions(n, finalReveal) {
  const cfg = QCONFIG[n];
  const st = qState[n];
  document.querySelectorAll('.screen[data-screen="' + n + '"] .q-opt').forEach(function (o) {
    const id = o.getAttribute('data-id');
    const isSelected = cfg.kind === 'single' ? st.selected === id : st.selected.has(id);
    const isCorrectOpt = cfg.kind === 'single' ? id === cfg.correct : cfg.correctSet.indexOf(id) !== -1;
    o.setAttribute('aria-checked', String(isSelected));
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
  const outcome = st.scoredCorrect ? 'correct' : (st.scoredPartial ? 'partial' : 'wrong2');
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
    if (n !== 26) revealForwardNav(n); // screen 26: arrow waits for teacher reveal (see override below)
    return;
  }

  if (st.attempts >= 2) {
    qMarkOptions(n, true);
    st.done = true;
    st.scoredCorrect = false;
    window.lomdaState.DONE[n] = true;
    recordScore(cfg.key, 0);
    // Partial credit wording: only kicks in where the config actually
    // defines a `partial` feedback entry, and only when the learner's final
    // pick included at least one correct answer (not zero).
    st.scoredPartial = !!cfg.feedback.partial && qHasAnyCorrectSelected(n);
    const outcome = st.scoredPartial ? 'partial' : 'wrong2';
    showFeedback(outcome, cfg.feedback[outcome]);
    if (checkBtn) { checkBtn.disabled = true; checkBtn.style.display = 'none'; }
    if (n !== 26) revealForwardNav(n); // screen 26: arrow waits for teacher reveal (see override below)
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
  document.querySelectorAll('.q1-toggle').forEach(function (b) {
    b.classList.remove('selected', 'correct', 'wrong');
    b.setAttribute('aria-pressed', 'false');
  });
  if (checkBtn) checkBtn.disabled = true;
  hideFeedback();
}

function q1Toggle(rowId, val) {
  if (q1State.done) return;
  q1State.answers[rowId] = val;
  document.querySelectorAll('.q1-toggle[data-row="' + rowId + '"]').forEach(function (b) {
    const isSel = b.getAttribute('data-val') === val;
    b.classList.toggle('selected', isSel);
    b.setAttribute('aria-pressed', String(isSel));
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
   Embedded simulation apps (screens 12 & 18) + reopen modal
   Arrow reveals 15s after the learner launches the simulation (per
   production script: "החץ יופיע 15 שנ' לאחר הפעלת הישומון").
   =================================================================== */
const simLaunched = {};
const simRevealed = {}; // n -> true once the 15s timer has actually fired (resume-state lock)
function simLaunch(n) {
  if (simLaunched[n]) return;
  simLaunched[n] = true;
  const label = document.querySelector('.screen[data-screen="' + n + '"] .sim-placeholder-label');
  if (label) label.textContent = 'הסימולציה פועלת (ממתין לקובץ אמיתי) — החץ יופיע בעוד 15 שניות';
  setTimeout(function () { simRevealed[n] = true; revealForwardNav(n); }, 15000);
}
function resetSimScreen(n) {
  if (n !== 18) syncTextbox1(n); // no-op for screen 12; screen 18 uses fixed CSS positioning instead of the auto-height calc
  if (window.lomdaState.DONE[n]) return;
  const arrow = document.querySelector('.screen[data-screen="' + n + '"] .nav-next');
  // Resume-state lock: once the timer has actually fired, keep the arrow
  // visible on every re-entry instead of re-hiding it — the original code
  // unconditionally hid the arrow on every entry but only ever (re)started
  // the timer on the FIRST entry (guarded by simLaunched), so leaving
  // screen 18 and coming back after the timer already fired left the arrow
  // hidden forever with nothing left to reveal it again.
  if (simRevealed[n]) {
    if (arrow) { arrow.classList.remove('hidden'); arrow.classList.add('blink'); }
    return;
  }
  if (arrow) arrow.classList.add('hidden');
  // Screens 12 & 18: the real app is embedded inline on the tablet (no
  // click-to-launch placeholder), so start the same 15s reveal timer on
  // entry instead of waiting for a simLaunch() click.
  if ((n === 12 || n === 18) && !simLaunched[n]) {
    simLaunched[n] = true;
    setTimeout(function () { simRevealed[n] = true; revealForwardNav(n); }, 15000);
  }
}

/* Reopen popup used from screens 13-16 (sim screen 12) and 19-20 (sim screen
   18) — anchored near its own .sim-reopen-btn (Psifas's .reminder-btn/
   .reminder-help-popup pattern) instead of a full-screen centered modal.
   Toggling: click again (or any other screen's reopen button) to close. */
// While the sim reopen-popup is open, any already-showing feedback popup
// (a question answered before opening the simulation) is hidden so the two
// don't overlap, then brought back automatically when the sim popup closes.
let simPopupHiddenFeedback = false;

function toggleSimPopup(btn, srcScreen) {
  const popup = document.getElementById('sim-reopen-popup');
  const body = document.getElementById('sim-reopen-popup-body');
  const feedbackPopup = document.getElementById('feedback-popup');
  const isOpen = popup.classList.contains('show') && btn.classList.contains('is-open');
  document.querySelectorAll('.sim-reopen-btn').forEach(function (b) { b.classList.remove('is-open'); });
  popup.classList.remove('show');
  popup.classList.remove('is-reminder');
  if (isOpen) {
    body.innerHTML = '';
    returnOverlayFocus();
    if (simPopupHiddenFeedback) {
      feedbackPopup.classList.add('show');
      simPopupHiddenFeedback = false;
    }
    return;
  }
  simPopupHiddenFeedback = feedbackPopup.classList.contains('show');
  if (simPopupHiddenFeedback) feedbackPopup.classList.remove('show');
  if (srcScreen === 12) {
    body.innerHTML = '<iframe src="assets/app/LIGHT_BOLB.html" title="סימולציית נורה מתחממת"></iframe>';
  } else {
    body.innerHTML = '<iframe src="assets/app/LOOSE_CONNECTION.html" title="סימולציית חיבור רופף בלוח החשמל"></iframe>';
  }
  popup.classList.add('show');
  btn.classList.add('is-open');
  openOverlayFocus(popup);
}

/* Screen 10's "תזכורת" button — same reopen-popup mechanism as the
   simulation screens (toggleSimPopup), but shows the group A data text +
   weather forecast image (screen 9's content) instead of an embedded app. */
function toggleReminderPopup(btn) {
  const popup = document.getElementById('sim-reopen-popup');
  const body = document.getElementById('sim-reopen-popup-body');
  const feedbackPopup = document.getElementById('feedback-popup');
  const isOpen = popup.classList.contains('show') && btn.classList.contains('is-open');
  document.querySelectorAll('.sim-reopen-btn').forEach(function (b) { b.classList.remove('is-open'); });
  popup.classList.remove('show');
  popup.classList.remove('is-reminder');
  if (isOpen) {
    body.innerHTML = '';
    returnOverlayFocus();
    if (simPopupHiddenFeedback) {
      feedbackPopup.classList.add('show');
      simPopupHiddenFeedback = false;
    }
    return;
  }
  simPopupHiddenFeedback = feedbackPopup.classList.contains('show');
  if (simPopupHiddenFeedback) feedbackPopup.classList.remove('show');
  popup.classList.add('is-reminder');
  body.innerHTML = '<div class="reminder-content"><div class="reminder-text"><strong>קבוצה א\' חקרה את ההשערה שברקים גורמים לאורות להבהב. אלה הנתונים שאספה:</strong><br>השמיים היו בהירים לחלוטין, לא נשמע רעם, ואפליקציית מזג האוויר הראתה שאין סיכוי לגשם באזור:</div><img class="reminder-weather-img" src="assets/images/q2_picture.png" alt=""></div>';
  popup.classList.add('show');
  btn.classList.add('is-open');
  openOverlayFocus(popup);
}

/* ===================================================================
   Drag & Drop — Screen 27 (Q8), 6-step process ordering, maxAttempts:2
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
// ddqPicked: dragId currently "picked up" via the keyboard alternative to
// native HTML5 drag (which is mouse/touch-only — see ddqKeyPick/ddqKeyDrop).
let ddqPicked = null;

function ddqAnnounce(msg) {
  const el = document.getElementById('a11y-status');
  if (el) el.textContent = msg;
}

function ddqRender() {
  // source tray
  Object.keys(ddqPlacement).forEach(function (id) {
    const card = document.getElementById(id);
    if (!card) return;
    const slot = card.closest('.ddq-source-slot');
    const num = id.replace('drag-', '');
    if (ddqPlacement[id] === 'source') {
      if (slot) slot.appendChild(card);
      card.classList.remove('ghost');
      card.classList.toggle('selected', ddqPicked === id);
      card.setAttribute('aria-label', ddqPicked === id
        ? 'שלב ' + num + ', נבחר. הקישו Enter לביטול הבחירה, או נווטו לתא ריק והקישו Enter להצבה'
        : 'שלב ' + num + ', הקישו Enter לבחירה ולאחר מכן על התא הריק המתאים');
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
      chip.className = 'ddq-drag-card' + (ddqChecked ? ' locked' : '') + (ddqPicked === placedId ? ' selected' : '');
      chip.textContent = num;
      chip.id = 'placed-' + targetId;
      chip.dataset.dragId = placedId;
      chip.draggable = !ddqChecked;
      if (!ddqChecked) {
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        chip.setAttribute('aria-label', 'שלב ' + num + ' מוצב בתא זה, הקישו Enter להרים ולהעביר');
      }
      chip.addEventListener('dragstart', function (e) { ddqPlacedDragStart(e, placedId); });
      chip.addEventListener('dragend', ddqDragEnd);
      target.appendChild(chip);
      target.classList.add('occupied');
      target.setAttribute('tabindex', '-1');
      target.setAttribute('aria-label', 'תא תפוס בשלב ' + num);
    } else {
      target.setAttribute('tabindex', ddqChecked ? '-1' : '0');
      target.setAttribute('aria-label', ddqPicked ? 'תא ריק, הקישו Enter להצבת השלב שנבחר' : 'תא ריק');
    }
  });
}

function ddqKeyPick(dragId) {
  if (ddqChecked || !dragId) return;
  const num = dragId.replace('drag-', '');
  if (ddqPicked === dragId) {
    ddqPicked = null;
    ddqRender();
    ddqAnnounce('בוטלה הבחירה של שלב ' + num + '.');
    return;
  }
  if (ddqPlacement[dragId] !== 'source') ddqPlacement[dragId] = 'source';
  ddqPicked = dragId;
  ddqRender();
  ddqAnnounce('שלב ' + num + ' נבחר. נווטו בעזרת Tab לתא הריק הרצוי והקישו Enter להצבה.');
  const card = document.getElementById(dragId);
  if (card) card.focus({ preventScroll: true });
}

function ddqKeyDrop(targetId) {
  if (ddqChecked) return;
  if (!ddqPicked) {
    ddqAnnounce('בחרו קודם שלב מרשימת הכרטיסים בעזרת Enter.');
    return;
  }
  const dragId = ddqPicked;
  const num = dragId.replace('drag-', '');
  Object.keys(ddqPlacement).forEach(function (k) {
    if (ddqPlacement[k] === targetId && k !== dragId) ddqPlacement[k] = 'source';
  });
  ddqPlacement[dragId] = targetId;
  ddqPicked = null;
  ddqRender();
  ddqUpdateCheckGate();
  ddqAnnounce('שלב ' + num + ' הוצב בתא.');
  requestAnimationFrame(function () {
    const placedChip = document.getElementById('placed-' + targetId);
    if (placedChip) placedChip.focus({ preventScroll: true });
  });
}

function ddqDragStart(e, dragId) {
  if (ddqChecked) { e.preventDefault(); return; }
  ddqPicked = null;
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
  ddqPicked = null;
  document.querySelectorAll('.ddq-drag-card').forEach(function (c) {
    c.classList.add('locked');
    c.draggable = false;
    c.setAttribute('tabindex', '-1');
  });
  document.querySelectorAll('.ddq-target').forEach(function (t) { t.setAttribute('tabindex', '-1'); });
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
    window.lomdaState.DONE[27] = true;
    recordScore('q8', 10);
    showFeedback('correct', DDQ.feedbackText.correct);
    const btn = document.getElementById('ddq-check');
    if (btn) btn.style.display = 'none';
    revealForwardNav(27);
    return;
  }

  if (ddqAttempts >= DDQ.maxAttempts) {
    // Per the production script: show right/wrong on the learner's own
    // final placement first, then after a short pause the correct answers
    // fill in on their own (no "view my answer"/"view solution" toggle).
    ddqScoredCorrect = false;
    ddqDone = true;
    window.lomdaState.DONE[27] = true;
    recordScore('q8', 0);
    ddqMarkTargetsByCorrectness();
    ddqLock();
    showFeedback('wrong2', DDQ.feedbackText.wrong2);
    const btn = document.getElementById('ddq-check');
    if (btn) btn.style.display = 'none';
    setTimeout(function () {
      ddqRevealCorrect();
      ddqMarkTargetsCorrect();
      revealForwardNav(27);
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
  ddqPicked = null;
  ddqAttempts = 0;
  ddqLastWrong = null;
  ddqRender();
  hideFeedback();
  if (btn) { btn.disabled = true; btn.style.display = 'none'; }
}

/* ===================================================================
   Completion screen (29)
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
  6: 1, 10: 2, 13: 3, 14: 3, 15: 3, 16: 3, 19: 4, 20: 4,
  22: 5, 23: 6, 26: 7, 27: 8, 28: 9
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
    case 9: resetExplainScreen(9); break;
    case 10: qEnter(10); break;
    case 11: resetVideoScreen(11); break;
    case 12: resetSimScreen(12); break;
    case 13: qEnter(13); break;
    case 14: qEnter(14); break;
    case 15: qEnter(15); break;
    case 16: qEnter(16); break;
    case 17: resetVideoScreen(17); break;
    case 18: resetSimScreen(18); break;
    case 19: qEnter(19); break;
    case 20: qEnter(20); break;
    case 21: syncTextbox1(21); RevealTilesGroup.init(21); RevealTilesGroup.reset(21); break;
    case 22: qEnter(22); break;
    case 23: qEnter(23); break;
    case 24: resetExplainScreen(24); break;
    case 25: resetVideoScreen(25); break;
    case 26: qEnter(26); break;
    case 27: ddqEnter(); break;
    case 28: qEnter(28); break;
    case 29: enterCompletion(); break;
  }
  focusScreen(n);
}

/* ===================================================================
   Question config registration
   =================================================================== */
qInitConfig(10, {
  kind: 'single', key: 'q2', weight: 10, correct: '2',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['ברקים מתרחשים בזמן סערה. מכיוון שהשמיים היו בהירים ולא היה סיכוי לגשם, אפשר לשלול את ההשערה שברקים גרמו להבהוב האורות.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['ברקים מתרחשים בזמן סערה. מכיוון שהשמיים היו בהירים ולא היה סיכוי לגשם, אפשר לשלול את ההשערה שברקים גרמו להבהוב האורות.'] }
  }
});
qInitConfig(13, {
  kind: 'single', key: 'q3a', weight: 5, correct: '1',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['הגרף מראה שטמפרטורת הנורה עולה בהדרגה לאורך הזמן. הממצא הזה יעזור לנו להבין בהמשך מדוע הנורה נכבית.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['הגרף מראה שטמפרטורת הנורה עולה בהדרגה לאורך הזמן. הממצא הזה יעזור לנו להבין בהמשך מדוע הנורה נכבית.'] }
  }
});
qInitConfig(14, {
  kind: 'single', key: 'q3b', weight: 5, correct: '3',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['הנורה נכבית כאשר טמפרטורת הנורה מגיעה לטמפרטורת הסף (120°C).'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['הנורה נכבית כאשר טמפרטורת הנורה מגיעה לטמפרטורת הסף (120°C).'] }
  }
});
qInitConfig(15, {
  kind: 'single', key: 'q3c', weight: 5, correct: '1',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['לאחר שהנורה התקררה לטמפרטורת החדר (25°C), היא נדלקה שוב.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['לאחר שהנורה התקררה לטמפרטורת החדר (25°C), היא נדלקה שוב.'] }
  }
});
qInitConfig(16, {
  kind: 'single', key: 'q3d', weight: 5, correct: '2',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['הסימולציה מראה שהנורה נכבית כאשר היא מתחממת מדי, ונדלקת מחדש לאחר שהתקררה. מכאן אפשר להסיק שהבהוב האורות נגרם ממנגנון הגנה מפני התחממות יתר.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['הסימולציה מראה שהנורה נכבית כאשר היא מתחממת מדי, ונדלקת מחדש לאחר שהתקררה. מכאן אפשר להסיק שהבהוב האורות נגרם ממנגנון הגנה מפני התחממות יתר.'] }
  }
});
qInitConfig(19, {
  kind: 'multi', key: 'q4a', weight: 5, correctSet: ['2', '4'],
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['בסימולציה אפשר לזהות חיבור רופף לפי שני סימנים: הזרם החשמלי אינו רציף, והנורה מהבהבת או נחלשת לסירוגין.'] },
    partial: { title: 'זו תשובה חלקית', body: ['בסימולציה אפשר לזהות חיבור רופף לפי שני סימנים: הזרם החשמלי אינו רציף, והנורה מהבהבת או נחלשת לסירוגין.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['בסימולציה אפשר לזהות חיבור רופף לפי שני סימנים: הזרם החשמלי אינו רציף, והנורה מהבהבת או נחלשת לסירוגין.'] }
  }
});
qInitConfig(20, {
  kind: 'single', key: 'q4b', weight: 5, correct: '1',
  feedback: {
    retry: { title: 'זו אינה התשובה,', body: ['הפעילו שוב את הסימולציה, התבוננו בתהליך ונסו שוב.'] },
    correct: { title: 'צדקת!', body: ['חיבור רופף גורם לזרם החשמלי להיעצר ולהתחדש במהירות. כתוצאה מכך הנורה אינה מקבלת זרם באופן רציף ולכן היא מהבהבת.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['חיבור רופף גורם לזרם החשמלי להיעצר ולהתחדש במהירות. כתוצאה מכך הנורה אינה מקבלת זרם באופן רציף ולכן היא מהבהבת.'] }
  }
});
qInitConfig(22, {
  kind: 'multi', key: 'q5', weight: 10, correctSet: ['1', '3', '5'],
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['חיבור חשמלי רופף הוא לא רק תקלה טכנית. הוא עלול להשפיע על בטיחות התושבים, על אספקת החשמל ועל איכות החיים בשכונה.'] },
    partial: { title: 'זו תשובה חלקית', body: ['חיבור חשמלי רופף הוא לא רק תקלה טכנית. הוא עלול להשפיע על בטיחות התושבים, על אספקת החשמל ועל איכות החיים בשכונה.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['חיבור חשמלי רופף הוא לא רק תקלה טכנית. הוא עלול להשפיע על בטיחות התושבים, על אספקת החשמל ועל איכות החיים בשכונה.'] }
  }
});
qInitConfig(23, {
  kind: 'single', key: 'q6', weight: 10, correct: '2',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['כאשר מזהים תקלה שעלולה לסכן את הציבור, האחריות שלנו היא לדווח לגורמים המוסמכים כדי שיוכלו לטפל בה בצורה בטוחה.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['כאשר מזהים תקלה שעלולה לסכן את הציבור, האחריות שלנו היא לדווח לגורמים המוסמכים כדי שיוכלו לטפל בה בצורה בטוחה.'] }
  }
});
qInitConfig(26, {
  kind: 'multi', key: 'q7', weight: 10, correctSet: ['1', '3'],
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['חקר מדעי מתבסס על רעיונות שאפשר לבדוק באופן ממשי באמצעות תצפיות, ניסויים וכלים מדעיים.'] },
    partial: { title: 'זו תשובה חלקית', body: ['חקר מדעי מתבסס על רעיונות שאפשר לבדוק באופן ממשי באמצעות תצפיות, ניסויים וכלים מדעיים.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['חקר מדעי מתבסס על רעיונות שאפשר לבדוק באופן ממשי באמצעות תצפיות, ניסויים וכלים מדעיים.'] }
  }
});
qInitConfig(28, {
  kind: 'single', key: 'q9', weight: 10, correct: '3',
  feedback: {
    retry: { title: 'זו אינה התשובה, נסו שוב.', body: [] },
    correct: { title: 'צדקת!', body: ['ידע מדעי אינו רק מסביר תופעות, אלא גם מסייע לקבל החלטות אחראיות ומבוססות לטובת האנשים והסביבה.'] },
    wrong2: { title: 'זו טעות, כל הכבוד על הניסיון.', body: ['ידע מדעי אינו רק מסביר תופעות, אלא גם מסייע לקבל החלטות אחראיות ומבוססות לטובת האנשים והסביבה.'] }
  }
});

/* Screen 26 extra: teacher character appears AFTER feedback is shown */
(function () {
  const originalQCheck = qCheck;
  window.qCheck = function (n) {
    originalQCheck(n);
    if (n === 26 && qState[26] && qState[26].done) {
      // .s12-left is a fixed-width column (same as every other split-question
      // screen), so swapping its contents never resizes/reflows .s12-right —
      // simple display toggle, matching the picture it's replacing.
      const teacher = document.getElementById('s26-teacher');
      if (teacher) teacher.style.display = 'flex'; // matches .qt-teacher-col's own display:flex
      const pic = document.querySelector('[data-screen="26"] .q7-picture');
      if (pic) pic.style.display = 'none';
      setTimeout(function () { revealForwardNav(26); }, 400);
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
  // Bind the .vctrls bar up front for every video screen (not on first play) —
  // the bar itself is always visible in the markup (no .hidden gate), so its
  // own buttons must work even if the big play-overlay is never clicked.
  document.querySelectorAll('.video-wrap[data-video-screen]').forEach(function (wrap) {
    initVideoControls(Number(wrap.getAttribute('data-video-screen')));
  });
});

/* Webfonts can finish loading after first layout, changing text-wrap height
   — resync every textbox1 bubble once fonts settle so none end up clipped. */
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    [2, 5, 7, 9, 11, 17, 21, 25].forEach(syncTextbox1);
  });
}
