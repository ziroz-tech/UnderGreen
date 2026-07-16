/* UNDERGREEN proximity radar. Game state and persistence live in game.js. */
(() => {
  "use strict";

  const bridge = window.UndergreenRadar;
  if (!bridge) return;

  const BASE = { x: 0.5, y: 0.5 };
  const PULSE_RADIUS = 0.13;
  const CONTACT_DISTANCE = 0.022;
  const ALERT_DISTANCE = 0.48;
  const PATROL_SPEED_MIN = 0.0035;
  const PATROL_SPEED_MAX = 0.0065;
  const APPROACH_SPEED = 0.009;
  const RAPID_APPROACH_SPEED = APPROACH_SPEED * 1.8;
  const RAPID_CHANCE_MIN = 0.02;
  const RAPID_CHANCE_MAX = 0.5;
  const RAPID_CHANCE_EXPONENT = 1.2;
  const TUTORIAL_APPROACH_SPEED = 0.03;
  const APPROACH_GUARANTEE_DAYS = 5;
  const RETREAT_SPEED = 0.012;
  const STATE_POLL_MS = 250;
  const GREEN = "114,255,184";
  const YELLOW = "245,214,91";
  const RED = "255,92,114";

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const rand = (min, max) => min + Math.random() * (max - min);
  const distanceToBase = (contact) => Math.hypot(contact.x - BASE.x, contact.y - BASE.y);
  const rgba = (rgb, alpha) => "rgba(" + rgb + "," + alpha + ")";
  const rapidApproachChance = (suspicion) => {
    const suspicionRatio = clamp((Number(suspicion) || 0) / 100, 0, 1);
    return RAPID_CHANCE_MIN
      + (RAPID_CHANCE_MAX - RAPID_CHANCE_MIN) * Math.pow(suspicionRatio, RAPID_CHANCE_EXPONENT);
  };

  const win = document.createElement("aside");
  win.className = "radar-window";
  win.id = "radar-window";
  win.setAttribute("aria-label", "周辺監視レーダー");
  win.innerHTML = [
    '<div class="radar-shell">',
      '<div class="radar-head">',
        '<div class="radar-title"><small>PERIMETER SCAN</small><strong>周辺監視レーダー</strong></div>',
        '<span class="radar-clock" id="radar-clock">CLOCK HOLD</span>',
        '<span class="radar-power" id="radar-power">MAIN PWR</span>',
        '<i class="radar-live" aria-hidden="true"></i>',
        '<button class="radar-mute" id="radar-mute" type="button" title="警報音 ON/OFF" aria-label="警報音 ON/OFF" aria-pressed="false">♪</button>',
      '</div>',
      '<div class="radar-scope-wrap">',
        '<canvas id="radar-canvas" aria-label="官憲巡回レーダー"></canvas>',
        '<div class="radar-alert-banner" id="radar-banner">APPROACH VECTOR</div>',
        '<div class="radar-msg" id="radar-msg" aria-live="polite"></div>',
      '</div>',
      '<div class="radar-actions">',
        '<button class="radar-estop" id="radar-estop" type="button"><span aria-hidden="true">■</span> 電源を落とす</button>',
      '</div>',
      '<div class="radar-foot">',
        '<span>CONTACTS <b id="radar-count">0</b></span>',
        '<span>THREAT <b class="radar-nearest" id="radar-nearest">---</b></span>',
        '<span>ALERT <b id="radar-alert-value">0%</b></span>',
      '</div>',
    '</div>',
    '<button class="radar-tab" id="radar-tab" type="button" aria-expanded="false">RADAR</button>'
  ].join("");
  document.body.appendChild(win);

  const blackout = document.createElement("div");
  blackout.id = "farm-blackout";
  blackout.setAttribute("aria-hidden", "true");
  blackout.innerHTML = [
    '<div class="blackout-label">',
      '<small>MAIN POWER OFFLINE</small>',
      '農場系統停止中 / 熱・光・電磁シグネチャ低下',
    '</div>'
  ].join("");
  document.body.appendChild(blackout);

  const fineOverlay = document.createElement("div");
  fineOverlay.id = "radar-fine-overlay";
  fineOverlay.setAttribute("aria-hidden", "true");
  fineOverlay.innerHTML = [
    '<div class="fine-stamp">',
      '<small>ENFORCEMENT ACTION</small>',
      '<strong>管理局による摘発</strong>',
      '<b id="fine-amount">罰金 C---</b>',
      '<span id="fine-balance">稼働中の熱シグネチャを検知</span>',
    '</div>'
  ].join("");
  document.body.appendChild(fineOverlay);

  const threatOverlay = document.createElement("div");
  threatOverlay.id = "radar-threat-overlay";
  threatOverlay.setAttribute("aria-hidden", "true");
  document.body.appendChild(threatOverlay);

  const canvas = win.querySelector("#radar-canvas");
  const ctx = canvas.getContext("2d");
  const banner = win.querySelector("#radar-banner");
  const msgEl = win.querySelector("#radar-msg");
  const tab = win.querySelector("#radar-tab");
  const muteBtn = win.querySelector("#radar-mute");
  const powerButton = win.querySelector("#radar-estop");
  const powerChip = win.querySelector("#radar-power");
  const clockChip = win.querySelector("#radar-clock");
  const nearestEl = win.querySelector("#radar-nearest");
  const countEl = win.querySelector("#radar-count");
  const alertValueEl = win.querySelector("#radar-alert-value");

  let snapshot = bridge.getSnapshot();
  let muted = false;
  let audioContext = null;
  let messageTimer = null;
  let patrols = [];
  let approacher = null;
  let activeClockMs = 0;
  let nextApproachCheckMs = 12000;
  let lastFrameAt = performance.now();
  let lastStatePollAt = 0;
  let lastPingAt = 0;
  let sweep = 0;
  let canvasSize = 0;
  let canvasDpr = 1;

  tab.addEventListener("click", () => {
    const open = !win.classList.contains("open");
    win.classList.toggle("open", open);
    tab.setAttribute("aria-expanded", String(open));
  });

  muteBtn.addEventListener("click", () => {
    muted = !muted;
    muteBtn.classList.toggle("off", muted);
    muteBtn.setAttribute("aria-pressed", String(muted));
    muteBtn.textContent = muted ? "×" : "♪";
  });

  document.addEventListener("pointerdown", () => {
    if (audioContext && audioContext.state === "suspended") audioContext.resume().catch(() => {});
  }, { passive: true });

  function tone(frequency, duration, options = {}) {
    if (muted) return;
    try {
      if (!audioContext) {
        const AudioEngine = window.AudioContext || window.webkitAudioContext;
        if (!AudioEngine) return;
        audioContext = new AudioEngine();
      }
      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
        return;
      }
      const type = options.type || "sine";
      const gainValue = Number(options.gain) || 0.06;
      const slide = Number(options.slide) || 0;
      const delay = Number(options.delay) || 0;
      const startAt = audioContext.currentTime + delay;
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      if (slide) {
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(24, frequency + slide), startAt + duration);
      }
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.05);
    } catch (error) {
      // Audio is optional; input and radar simulation continue without it.
    }
  }

  function showMessage(message, kind = "") {
    msgEl.textContent = message;
    msgEl.dataset.kind = kind;
    msgEl.classList.add("on");
    window.clearTimeout(messageTimer);
    messageTimer = window.setTimeout(() => msgEl.classList.remove("on"), 5200);
  }

  function setPanelOpen(open) {
    win.classList.toggle("open", open);
    tab.setAttribute("aria-expanded", String(open));
  }

  function syncPowerUi() {
    const unlocked = Boolean(snapshot.unlocked);
    const powerOn = snapshot.powerOn !== false;
    document.body.classList.toggle("farm-power-off", unlocked && !powerOn);
    blackout.classList.toggle("on", unlocked && !powerOn);
    blackout.setAttribute("aria-hidden", String(!unlocked || powerOn));
    powerButton.classList.toggle("restart", !powerOn);
    powerButton.innerHTML = powerOn
      ? '<span aria-hidden="true">■</span> 電源を落とす'
      : '<span aria-hidden="true">▶</span> 系統を再起動';
    powerChip.textContent = powerOn ? "MAIN PWR" : "INT PWR";
    powerChip.classList.toggle("off", !powerOn);
  }

  powerButton.addEventListener("click", () => {
    const nextPower = bridge.setPower(snapshot.powerOn === false);
    snapshot = bridge.getSnapshot();
    snapshot.powerOn = nextPower;
    syncPowerUi();
    if (nextPower) {
      showMessage("系統再起動 / 農場シグネチャ復帰", "warn");
      tone(120, 0.5, { type: "sawtooth", gain: 0.08, slide: 320 });
      tone(660, 0.15, { type: "triangle", gain: 0.06, delay: 0.45 });
    } else {
      showMessage("全系統停止 / シグネチャ低下中", "safe");
      tone(220, 0.7, { type: "sawtooth", gain: 0.09, slide: -170 });
      tone(90, 0.5, { type: "sine", gain: 0.1, delay: 0.15, slide: -50 });
    }
  });

  function updateSnapshot(nextSnapshot) {
    if (!nextSnapshot || typeof nextSnapshot !== "object") return;
    snapshot = nextSnapshot;
    win.classList.toggle("unlocked", Boolean(snapshot.unlocked));
    win.setAttribute("aria-hidden", String(!snapshot.unlocked));
    const clockRunning = snapshot.clockRunning === undefined ? snapshot.running : snapshot.clockRunning;
    clockChip.textContent = snapshot.tutorialActive
      ? "TUTORIAL HOLD"
      : clockRunning
        ? "TIME LIVE"
        : "CLOCK HOLD";
    clockChip.classList.toggle("live", Boolean(snapshot.running));
    syncPowerUi();
    syncPatrolCount();
  }

  window.addEventListener("undergreen:radar-state", (event) => updateSnapshot(event.detail));

  function createPatrol(demo = false) {
    let x;
    let y;
    let heading;
    if (demo) {
      const angle = rand(0, Math.PI * 2);
      const radius = rand(0.2, 0.24);
      x = BASE.x + Math.cos(angle) * radius;
      y = BASE.y + Math.sin(angle) * radius;
      heading = Math.atan2(BASE.y - y, BASE.x - x);
    } else {
      const edge = Math.floor(rand(0, 4));
      if (edge === 0) {
        x = rand(0.06, 0.94);
        y = 0.055;
      } else if (edge === 1) {
        x = 0.945;
        y = rand(0.06, 0.94);
      } else if (edge === 2) {
        x = rand(0.06, 0.94);
        y = 0.945;
      } else {
        x = 0.055;
        y = rand(0.06, 0.94);
      }
      heading = rand(0, Math.PI * 2);
    }
    return {
      x,
      y,
      heading,
      cruiseHeading: heading,
      speed: rand(PATROL_SPEED_MIN, PATROL_SPEED_MAX),
      mode: "patrol",
      phase: rand(0, Math.PI * 2),
      resolved: false,
      rapid: false,
      tutorial: Boolean(demo)
    };
  }

  function syncPatrolCount() {
    if (!snapshot.unlocked) {
      patrols = [];
      approacher = null;
      return;
    }
    const requested = clamp(Math.round(Number(snapshot.patrolCount) || 0), 0, 12);
    const target = approacher ? Math.max(1, requested) : requested;
    while (patrols.length < target) patrols.push(createPatrol(false));
    while (patrols.length > target) {
      const removableIndex = patrols.map((contact, index) => ({ contact, index }))
        .reverse()
        .find((entry) => entry.contact !== approacher)?.index;
      if (removableIndex === undefined) break;
      patrols.splice(removableIndex, 1);
    }
  }

  function turnToward(current, target, maximumStep) {
    let delta = target - current;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    return current + clamp(delta, -maximumStep, maximumStep);
  }

  function beginApproach(options = {}) {
    const normalized = typeof options === "boolean" ? { tutorial: options } : (options || {});
    const tutorial = Boolean(normalized.tutorial);
    const guaranteed = Boolean(normalized.guaranteed);
    const rapid = !tutorial && (typeof normalized.rapid === "boolean"
      ? normalized.rapid
      : Math.random() < rapidApproachChance(snapshot.suspicion));
    if (approacher || !snapshot.unlocked || !snapshot.running) return false;
    let candidates = patrols.filter((contact) => contact.mode === "patrol");
    if (!candidates.length) {
      const contact = createPatrol(tutorial);
      patrols.push(contact);
      candidates = [contact];
    }
    const contact = candidates[Math.floor(Math.random() * candidates.length)];
    if (tutorial) {
      Object.assign(contact, createPatrol(true));
      setPanelOpen(true);
    }
    contact.mode = "approach";
    contact.resolved = false;
    contact.rapid = rapid;
    contact.tutorial = tutorial;
    approacher = contact;
    if (typeof bridge.markApproachStarted === "function") {
      bridge.markApproachStarted({ tutorial, guaranteed });
      snapshot = bridge.getSnapshot();
    }
    const approachMessage = tutorial
      ? "TUTORIAL / 接近ベクトルを捕捉"
      : rapid
        ? "RAPID RESPONSE / 管理局高速個体を捕捉"
        : "接近ベクトルを捕捉";
    showMessage(approachMessage, "warn");
    tone(rapid ? 920 : 720, 0.14, { type: "triangle", gain: rapid ? 0.085 : 0.07 });
    if (tutorial && snapshot.demoPending) {
      bridge.consumeDemo();
      snapshot = bridge.getSnapshot();
    }
    return true;
  }

  function scheduleNextApproach(longDelay = false) {
    nextApproachCheckMs = activeClockMs + (longDelay ? rand(45000, 90000) : rand(9000, 16000));
  }

  function maybeStartRandomApproach() {
    const clockRunning = snapshot.clockRunning === undefined ? snapshot.running : snapshot.clockRunning;
    if (approacher || !clockRunning || snapshot.tutorialActive) return;
    const dayFloat = Number(snapshot.dayFloat);
    const lastApproachDayFloat = Number(snapshot.lastApproachDayFloat);
    if (Number.isFinite(dayFloat)
      && Number.isFinite(lastApproachDayFloat)
      && dayFloat - lastApproachDayFloat >= APPROACH_GUARANTEE_DAYS) {
      if (beginApproach({ guaranteed: true })) scheduleNextApproach(false);
      return;
    }
    if (activeClockMs < nextApproachCheckMs) return;
    const suspicionRatio = clamp((Number(snapshot.suspicion) || 0) / 100, 0, 1);
    const chance = 0.008 + 0.11 * Math.pow(suspicionRatio, 1.35);
    if (patrols.length > 0 && Math.random() < chance) beginApproach();
    scheduleNextApproach(false);
  }

  function resolveContact(contact) {
    if (!contact || contact.resolved) return;
    contact.resolved = true;
    const tutorial = Boolean(contact.tutorial || snapshot.tutorialActive);
    const success = snapshot.powerOn === false;
    if (tutorial) {
      if (success) {
        showMessage("TUTORIAL CLEAR / 接触前に信号を遮断", "safe");
        tone(660, 0.12, { gain: 0.07 });
        tone(880, 0.2, { gain: 0.07, delay: 0.1 });
      } else {
        showMessage("TUTORIAL CONTACT / 今回は罰金なし", "warn");
        tone(420, 0.18, { type: "square", gain: 0.06 });
        tone(300, 0.22, { type: "square", gain: 0.05, delay: 0.16 });
      }
      if (typeof bridge.resolveTutorial === "function") {
        bridge.resolveTutorial(success ? "success" : "failure");
        snapshot = bridge.getSnapshot();
      }
    } else if (success) {
      showMessage("SIGNAL LOST / 官憲は農場を特定できなかった", "safe");
      tone(660, 0.12, { gain: 0.07 });
      tone(880, 0.2, { gain: 0.07, delay: 0.1 });
    } else {
      const result = bridge.applyFine();
      snapshot = bridge.getSnapshot();
      if (result) showFine(result);
    }
    contact.mode = "retreat";
    contact.tutorial = false;
    contact.rapid = false;
    approacher = null;
    scheduleNextApproach(true);
  }

  function showFine(result) {
    const amount = Number(result.amount) || 0;
    const percent = Math.round((Number(result.rate) || 0) * 100);
    fineOverlay.querySelector("#fine-amount").textContent = "罰金 C" + amount.toLocaleString();
    fineOverlay.querySelector("#fine-balance").textContent =
      "所持金の" + percent + "% / 残高 C" + (Number(result.money) || 0).toLocaleString();
    fineOverlay.classList.remove("on");
    document.body.classList.remove("radar-shake");
    void fineOverlay.offsetWidth;
    fineOverlay.classList.add("on");
    document.body.classList.add("radar-shake");
    window.setTimeout(() => fineOverlay.classList.remove("on"), 2800);
    window.setTimeout(() => document.body.classList.remove("radar-shake"), 650);
    showMessage("摘発 / 罰金 C" + amount.toLocaleString(), "danger");
    tone(940, 0.3, { type: "square", gain: 0.09 });
    tone(700, 0.3, { type: "square", gain: 0.09, delay: 0.3 });
    tone(940, 0.35, { type: "square", gain: 0.08, delay: 0.6 });
    window.dispatchEvent(new CustomEvent("undergreen:radar-fine", { detail: result }));
  }

  function updatePatrol(contact, deltaSeconds) {
    const dist = distanceToBase(contact);
    let targetHeading = contact.cruiseHeading + Math.sin(activeClockMs / 6500 + contact.phase) * 0.28;
    let speed = contact.speed;

    if (contact.mode === "approach") {
      targetHeading = Math.atan2(BASE.y - contact.y, BASE.x - contact.x);
      speed = contact.tutorial
        ? TUTORIAL_APPROACH_SPEED
        : contact.rapid
          ? RAPID_APPROACH_SPEED
          : APPROACH_SPEED;
    } else if (contact.mode === "retreat") {
      targetHeading = Math.atan2(contact.y - BASE.y, contact.x - BASE.x);
      speed = RETREAT_SPEED;
    } else if (dist < 0.23) {
      targetHeading = Math.atan2(contact.y - BASE.y, contact.x - BASE.x);
    }

    contact.heading = turnToward(contact.heading, targetHeading, deltaSeconds * 0.9);
    contact.x += Math.cos(contact.heading) * speed * deltaSeconds;
    contact.y += Math.sin(contact.heading) * speed * deltaSeconds;

    if (contact.mode === "retreat") {
      if (contact.x < -0.04 || contact.x > 1.04 || contact.y < -0.04 || contact.y > 1.04) {
        const replacement = createPatrol(false);
        Object.assign(contact, replacement);
      }
      return;
    }

    if (contact.x < 0.035 || contact.x > 0.965) {
      contact.heading = Math.PI - contact.heading;
      contact.cruiseHeading = contact.heading;
      contact.x = clamp(contact.x, 0.035, 0.965);
    }
    if (contact.y < 0.035 || contact.y > 0.965) {
      contact.heading = -contact.heading;
      contact.cruiseHeading = contact.heading;
      contact.y = clamp(contact.y, 0.035, 0.965);
    }

    if (contact.mode === "approach" && distanceToBase(contact) <= CONTACT_DISTANCE) {
      resolveContact(contact);
    }
  }

  function alertMetrics() {
    if (!approacher) return { distance: Infinity, approach: 0, pulse: 0, intensity: 0 };
    const distance = distanceToBase(approacher);
    const approach = clamp((ALERT_DISTANCE - distance) / (ALERT_DISTANCE - CONTACT_DISTANCE), 0, 1);
    const pulse = clamp((PULSE_RADIUS - distance) / (PULSE_RADIUS - CONTACT_DISTANCE), 0, 1);
    return {
      distance,
      approach,
      pulse,
      intensity: clamp(approach * 0.72 + pulse * 0.55, 0, 1)
    };
  }

  function updateAlert(now) {
    const metrics = alertMetrics();
    const intensity = snapshot.running ? metrics.intensity : 0;
    const inPulse = snapshot.running && metrics.distance <= PULSE_RADIUS;
    const imminent = snapshot.running && metrics.distance <= 0.055;

    win.style.setProperty("--radar-alert", intensity.toFixed(3));
    const pulseDuration = Math.round(1250 - intensity * 970) + "ms";
    win.style.setProperty("--radar-pulse-ms", pulseDuration);
    threatOverlay.style.setProperty("--radar-pulse-ms", pulseDuration);
    win.classList.toggle("caution", intensity > 0.02);
    win.classList.toggle("danger", inPulse);
    win.classList.toggle("imminent", imminent);
    threatOverlay.style.opacity = String(intensity * 0.72);

    if (!snapshot.running) {
      banner.textContent = "CLOCK HOLD";
    } else if (inPulse) {
      banner.textContent = imminent
        ? "CONTACT IMMINENT"
        : approacher?.rapid
          ? "RAPID / PULSE RANGE"
          : "PULSE RANGE";
    } else {
      banner.textContent = approacher
        ? approacher.rapid
          ? "RAPID APPROACH"
          : "APPROACH VECTOR"
        : "PERIMETER CLEAR";
    }

    nearestEl.textContent = approacher ? Math.max(0, Math.round(metrics.distance * 1000)) + "m" : "---";
    countEl.textContent = String(patrols.length);
    alertValueEl.textContent = Math.round(intensity * 100) + "%";

    if (snapshot.running && approacher && intensity > 0.01) {
      const interval = 2400 - intensity * 2110;
      if (now - lastPingAt >= interval) {
        lastPingAt = now;
        tone(680 + intensity * 420, 0.085, { type: intensity > 0.78 ? "square" : "triangle", gain: 0.04 + intensity * 0.055 });
      }
    }
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10) return false;
    canvasDpr = Math.min(window.devicePixelRatio || 1, 2);
    canvasSize = rect.width;
    canvas.width = Math.round(canvasSize * canvasDpr);
    canvas.height = Math.round(canvasSize * canvasDpr);
    ctx.setTransform(canvasDpr, 0, 0, canvasDpr, 0, 0);
    return true;
  }

  window.addEventListener("resize", () => {
    canvasSize = 0;
    resizeCanvas();
  }, { passive: true });

  function drawScope() {
    if (!canvasSize && !resizeCanvas()) return;
    const rect = canvas.getBoundingClientRect();
    if (Math.abs(rect.width - canvasSize) > 1) resizeCanvas();
    const size = canvasSize;
    const center = size / 2;
    ctx.clearRect(0, 0, size, size);

    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(GREEN, 0.13);
    const cell = size / 8;
    for (let index = 1; index < 8; index += 1) {
      ctx.beginPath();
      ctx.moveTo(index * cell, 0);
      ctx.lineTo(index * cell, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, index * cell);
      ctx.lineTo(size, index * cell);
      ctx.stroke();
    }

    ctx.strokeStyle = rgba(GREEN, 0.28);
    [0.22, 0.44, 0.66, 0.88].forEach((radius) => {
      ctx.beginPath();
      ctx.arc(center, center, center * radius, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(center, 4);
    ctx.lineTo(center, size - 4);
    ctx.moveTo(4, center);
    ctx.lineTo(size - 4, center);
    ctx.stroke();

    if (ctx.createConicGradient) {
      const gradient = ctx.createConicGradient(sweep, center, center);
      gradient.addColorStop(0, rgba(GREEN, 0.3));
      gradient.addColorStop(0.08, rgba(GREEN, 0.08));
      gradient.addColorStop(0.17, "rgba(0,0,0,0)");
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.moveTo(center, center);
      ctx.arc(center, center, center * 0.92, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = rgba(GREEN, snapshot.running ? 0.68 : 0.24);
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.cos(sweep) * center * 0.92, center + Math.sin(sweep) * center * 0.92);
    ctx.stroke();

    const baseX = BASE.x * size;
    const baseY = BASE.y * size;
    const powerOn = snapshot.powerOn !== false;
    ctx.save();
    ctx.translate(baseX, baseY);
    ctx.strokeStyle = rgba(GREEN, powerOn ? 0.95 : 0.42);
    ctx.fillStyle = rgba(GREEN, powerOn ? 0.24 : 0.07);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    if (powerOn && snapshot.running) {
      const ringRadius = 8 + (activeClockMs / 130 % 18);
      ctx.strokeStyle = rgba(GREEN, Math.max(0, 0.38 - ringRadius / 62));
      ctx.beginPath();
      ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = rgba(GREEN, 0.8);
    ctx.font = "700 8px Consolas, monospace";
    ctx.fillText("BASE", baseX + 9, baseY + 3);

    const metrics = alertMetrics();
    patrols.forEach((contact) => {
      const contactDistance = distanceToBase(contact);
      const isApproacher = contact === approacher;
      const isRapid = Boolean(isApproacher && contact.rapid);
      const color = isApproacher ? (contactDistance <= PULSE_RADIUS ? RED : YELLOW) : GREEN;
      const x = contact.x * size;
      const y = contact.y * size;
      const blinkRate = isRapid ? 78 : isApproacher ? 130 : 430;
      const blink = snapshot.running ? 0.62 + Math.sin(activeClockMs / blinkRate + contact.phase) * 0.34 : 0.62;

      ctx.strokeStyle = rgba(color, isApproacher ? 0.42 + metrics.intensity * 0.4 : 0.14);
      ctx.lineWidth = isApproacher ? 1.25 : 0.8;
      ctx.beginPath();
      ctx.arc(x, y, PULSE_RADIUS * size, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = rgba(color, clamp(blink, 0.2, 1));
      ctx.beginPath();
      ctx.arc(x, y, isApproacher ? 4.8 : 3.2, 0, Math.PI * 2);
      ctx.fill();

      if (isRapid) {
        const markerRadius = 8 + Math.sin(activeClockMs / 90 + contact.phase) * 1.2;
        ctx.save();
        ctx.strokeStyle = rgba(RED, 0.78);
        ctx.fillStyle = rgba(RED, 0.92);
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.arc(x, y, markerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.font = "700 8px Consolas, monospace";
        ctx.fillText("FAST", x + 9, y - 7);
        ctx.restore();
      }

      if (isApproacher) {
        ctx.save();
        ctx.strokeStyle = rgba(color, 0.28 + metrics.intensity * 0.42);
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(baseX, baseY);
        ctx.stroke();
        ctx.restore();
      }
    });

    if (!snapshot.running) {
      ctx.fillStyle = "rgba(1,8,6,.58)";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = rgba(GREEN, 0.3);
      ctx.strokeRect(10.5, center - 18.5, size - 21, 37);
      ctx.fillStyle = rgba(GREEN, 0.75);
      ctx.font = "700 11px Consolas, monospace";
      ctx.textAlign = "center";
      ctx.fillText("GAME CLOCK HOLD", center, center + 4);
      ctx.textAlign = "start";
    }
  }

  function frame(now) {
    const deltaMs = Math.min(100, Math.max(0, now - lastFrameAt));
    lastFrameAt = now;

    if (now - lastStatePollAt >= STATE_POLL_MS) {
      lastStatePollAt = now;
      updateSnapshot(bridge.getSnapshot());
    }

    if (snapshot.unlocked) {
      if (snapshot.running) {
        activeClockMs += deltaMs;
        sweep += deltaMs / 1000 * 0.72;
        if ((snapshot.tutorialActive || snapshot.demoPending) && !approacher) {
          beginApproach({ tutorial: true });
        }
        maybeStartRandomApproach();
        patrols.slice().forEach((contact) => updatePatrol(contact, deltaMs / 1000));
      }
      drawScope();
      updateAlert(now);
    } else {
      win.classList.remove("open", "caution", "danger", "imminent");
      threatOverlay.style.opacity = "0";
    }

    window.requestAnimationFrame(frame);
  }

  updateSnapshot(snapshot);
  scheduleNextApproach(false);
  window.requestAnimationFrame(frame);
})();