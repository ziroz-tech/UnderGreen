/* ============================================================
   UNDERGREEN — COMMS FX (comms-fx.js)
   game.js 無改変のまま、通信ウィンドウの表示/ページ送りを検出して
   演出クラスの付与と微かな受信チャープ音を行う。
   ============================================================ */
(() => {
  "use strict";

  const banner = document.getElementById("comms-banner");
  const textEl = document.getElementById("comms-text");
  const titleEl = document.getElementById("comms-title");
  if (!banner || !textEl) return;

  /* ---- 受信チャープ (ごく控えめ / WebAudio生成) ---- */
  let ac = null;
  document.addEventListener("pointerdown", () => {
    if (ac && ac.state === "suspended") ac.resume().catch(() => {});
  }, { passive: true });

  function chirp(seq, gain = 0.035) {
    try {
      if (!ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ac = new AC();
      }
      if (ac.state === "suspended") { ac.resume().catch(() => {}); return; }
      seq.forEach(([freq, dur, delay]) => {
        const t0 = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const g = ac.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(g).connect(ac.destination);
        osc.start(t0);
        osc.stop(t0 + dur + 0.05);
      });
    } catch (e) { /* noop */ }
  }

  const retrigger = (el, cls) => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };

  /* ---- 着信検出: hidden クラスの着脱を監視 ---- */
  let wasHidden = banner.classList.contains("hidden");
  new MutationObserver(() => {
    const hidden = banner.classList.contains("hidden");
    if (wasHidden && !hidden) {
      retrigger(banner, "comms-fx-in");
      setTimeout(() => banner.classList.remove("comms-fx-in"), 900);
      chirp([[1180, 0.05, 0], [1560, 0.05, 0.07], [980, 0.09, 0.15]]); // 同期音
    }
    wasHidden = hidden;
  }).observe(banner, { attributes: true, attributeFilter: ["class"] });

  /* ---- ページ送り検出: 本文/タイトルの書き換えを監視 ---- */
  let lastText = textEl.textContent;
  new MutationObserver(() => {
    if (banner.classList.contains("hidden")) { lastText = textEl.textContent; return; }
    if (textEl.textContent === lastText) return;
    lastText = textEl.textContent;
    retrigger(textEl, "comms-text-in");
    chirp([[1420, 0.035, 0]], 0.03); // ページ送りの短いチャープ
  }).observe(textEl, { childList: true, characterData: true, subtree: true });

  if (titleEl) {
    let lastTitle = titleEl.textContent;
    new MutationObserver(() => {
      if (banner.classList.contains("hidden")) { lastTitle = titleEl.textContent; return; }
      if (titleEl.textContent === lastTitle) return;
      lastTitle = titleEl.textContent;
      retrigger(titleEl, "comms-text-in");
    }).observe(titleEl, { childList: true, characterData: true, subtree: true });
  }
})();
