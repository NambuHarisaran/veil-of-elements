/* ============================================================
   Veil of the Elements — Bootstrap
   ============================================================ */
(function () {
"use strict";
const VEIL = window.VEIL;

// Shared helper any realm scene calls on completion.
VEIL.completeRealm = function (element, ability, fragmentKey, nextScene) {
  const st = VEIL.engine.state;
  if (ability) st.abilities[ability] = true;
  if (element && !st.realmsCleared.includes(element)) st.realmsCleared.push(element);
  const frag = VEIL.story.fragments[fragmentKey || element];
  if (frag && !st.fragments.includes(frag)) st.fragments.push(frag);
  VEIL.engine.save();
  if (nextScene) VEIL.engine.go(nextScene);
};

function boot() {
  VEIL.ui.init();
  VEIL.engine = new VEIL.Engine();
  // restore sound preference
  try { const s = VEIL.Save.read(); if (s && s.flags && s.flags.muted) { /* applied after audio init */ VEIL._wantMute = true; } } catch (e) {}
  const origInit = VEIL.engine.audio.init.bind(VEIL.engine.audio);
  VEIL.engine.audio.init = function () { origInit(); if (VEIL._wantMute) this.setMuted(true); };
  VEIL.engine.start();
  // expose for debugging
  window.__veil = VEIL;
}

if (document.readyState === 'complete' || document.readyState === 'interactive') boot();
else window.addEventListener('DOMContentLoaded', boot);

})();
