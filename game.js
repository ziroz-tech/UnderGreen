"use strict";

let CROPS = {};
let MARKETS = {};
let MARKET_SIGNALS = {};
let CROP_MARKET_RESPONSE = {};
let BASE_TAGS = {};
let EQUIPMENT_TAGS = {};
let CROP_ENVIRONMENT = {};
let GROW_UNITS = {};
let GROW_UNIT_SLOT_LAYOUTS = {};
let PLANT_STAGE_SPRITES = {};
let AREA_PROFILES = {};
let PROPERTY_COMMENTS = {};
let FLOOR_DEVICES = {};
let ROBOT_SKILLS = {};
let ROBOT_PERSONALITIES = {};
let EVENTS = [];
let QUIET_NEWS = [];
let EQUIPMENT = {};
let SOUND_FILES = {};
let SOUND_VOLUMES = {};
let AMBIENT_LAYERS = {};
let RADIO_PROGRAMS = {};
let UNLOCK_RULES = [];
let SCHEDULE_RUMORS = [];

const QUALITY = {
  C: { multiplier: 0.7, color: "#ff765e" },
  B: { multiplier: 1.0, color: "#78bfa5" },
  A: { multiplier: 1.3, color: "#72ffb8" },
  S: { multiplier: 1.8, color: "#f5d65b" }
};

const RESOURCE_CONSUMPTION_RATE = 1 / 6;
const REALTIME_DAY_MS = 20000;
const WITHER_DAYS = 1;
const SAVE_KEY = "undergreen-save-v16";
const SAVE_BACKUP_KEY = `${SAVE_KEY}-backup`;
const LEGACY_SAVE_KEYS = Array.from({ length: 15 }, (_, index) => `undergreen-save-v${15 - index}`);
const DAY30_RECORDS_KEY = "undergreen-day30-records-v1";
const FREE_RECORDS_KEY = "undergreen-free-records-v1";
const START_MODE_PREF_KEY = "undergreen-start-mode-view-v1";
const PUBLIC_GAME_URL = "https://ziroz-tech.github.io/UnderGreen/";
const GOOGLE_FORM_PREFILL_URL = "https://docs.google.com/forms/d/1DhYFy45WvRujbb3CzGxlMpZXWnAe5eZFt62CczIPxqk/viewform?usp=pp_url";
const GOOGLE_FORM_FIELDS = {
  recordJson: "entry.1523070449",
  day30Count: "",
  freeCount: "",
  latestRevenue: "",
  latestTitles: ""
};
const PROPERTY_REROLL_FEE = 100;
const PROCUREMENT_REROLL_FEE = 80;
const PROPERTY_LISTING_COUNT = 4;
const SAFE_ROOM_IMAGE = "assets/bases/safe-room.png";
const DEFAULT_ENVIRONMENT = { temp: 24, humidity: 60, co2: 700 };
const ISO_TILE_WIDTH = 96;
const ISO_TILE_HEIGHT = 48;
const ISO_GRID_PAD_X = 64;
const ISO_GRID_PAD_Y = 96;
const FACILITY_ZOOM_MIN = 0.65;
const FACILITY_ZOOM_MAX = 1.8;
const FACILITY_ZOOM_STEP = 0.12;
const FACILITY_INITIAL_ZOOM = 1.44;
const SPRITE_ALPHA_THRESHOLD = 18;
const BOOT_ASSET_TIMEOUT_MS = 20000;
const AUDIO_CACHE_BUSTER = Date.now().toString(36);
const spriteAlphaCache = new Map();
let state;
let selectedSeed = "lettuce";
let selectedMarket = "lower";
let saleQuantities = {};
let selectedUnitId = null;
let selectedDeviceId = null;
let selectedBaseId = null;
let placementSelection = null;
let dragPayload = null;
let pointerDrag = null;
let pendingSeedDrag = null;
let harvestSwipe = null;
let harvestHold = null;
let facilityPan = null;
let facilityPinch = null;
let equipmentMenu = null;
let equipmentMenuTimer = null;
let cleanToolDrag = null;
const facilityPointers = new Map();
let facilityView = { x: 0, y: 0, zoom: FACILITY_INITIAL_ZOOM };
let suppressClickUntil = 0;
let farmRenderRequested = false;
let lastTickAt = Date.now();
let lastRenderAt = 0;
let lastAutosaveAt = 0;
let UI_TEXT = {};
let COMM_EVENTS = [];
let activeComms = null;
let pendingComms = [];
let startScreenOpen = true;
let pendingConfirmAction = null;
let pendingDangerAction = null;
let pendingExtraAction = null;
let pausedBeforeStartScreen = false;
let pendingDay30RecordId = null;
let startModeView = "day30";
let startTitleTapCount = 0;
let startTitleTapAt = 0;
const COMMS_DEDUPE_TRIGGERS = new Set(["plant_resource_shortage", "resource_low"]);

const SCHEDULE_DAYS = 30;
const SCHEDULE_REROLL_COST = 120;
const SCHEDULE_NON_TARGET_SIGNAL_CAP = 0.42;
const SUPPORT_ROBOT_DEFAULT_RANGE = 2;
const SUPPORT_ROBOT_MIN_ENERGY = 8;
const SUPPORT_ROBOT_MAX_ENERGY = 100;
const SUPPORT_TASK_BASE_COOLDOWN = { harvest: 0.055, plant: 0.06, cleaning: 0.06, procure: 0.08, ship: 0.08 };
const SUPPORT_TASK_BASE_COST = { harvest: 5, plant: 4, cleaning: 6, procure: 4, ship: 4 };
const SUPPORT_TASKS = Object.keys(SUPPORT_TASK_BASE_COOLDOWN);
const SUPPORT_GRADE_MULTIPLIER = { S: 1.35, A: 1.12, B: 1, C: 0.78 };

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        value += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(value);
      value = "";
    } else if (char === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (char !== "\r") {
      value += char;
    }
  }
  row.push(value);
  rows.push(row);
  const [headers, ...body] = rows.filter((entry) => entry.some((cell) => cell.trim() !== ""));
  if (!headers) return [];
  return body.map((entry) => Object.fromEntries(headers.map((header, index) => [header.trim(), (entry[index] || "").trim()])));
}

async function loadCsv(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return parseCsv(await response.text());
}

function toNumber(value, fallback = 0) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toBool(value) {
  return String(value).toLowerCase() === "true";
}

function toList(value) {
  if (Array.isArray(value)) return value.map((entry) => String(entry).trim()).filter(Boolean);
  return value ? String(value).split("|").map((entry) => entry.trim()).filter(Boolean) : [];
}

function toRange(value) {
  const [min, max] = String(value).split("-").map((entry) => Number(entry));
  return [Number.isFinite(min) ? min : 0, Number.isFinite(max) ? max : min];
}

function toMap(value) {
  return Object.fromEntries(toList(value).map((entry) => {
    const [key, raw] = entry.split(":");
    return [key, toNumber(raw, 0)];
  }).filter(([key]) => key));
}

function parseRequirement(entry) {
  const match = String(entry).match(/^([^<>=!]+)(>=|<=|=|>|<)(.+)$/);
  if (!match) return null;
  return {
    key: match[1].trim(),
    operator: match[2],
    value: match[3].trim()
  };
}

function toRequirements(value) {
  return toList(value).map(parseRequirement).filter(Boolean);
}

function parseContextMatcher(entry) {
  const match = String(entry).match(/^([^!=]+)(!?=)(.*)$/);
  if (!match) return null;
  return {
    key: match[1].trim(),
    operator: match[2],
    value: match[3].trim()
  };
}

function toContextMatchers(value) {
  return toList(value).map(parseContextMatcher).filter(Boolean);
}

function parseCommsEffect(entry) {
  const raw = String(entry || "").trim();
  if (!raw) return null;
  const [conditionPart, actionPart = conditionPart] = raw.includes("->")
    ? raw.split("->").map((part) => part.trim())
    : ["choice:*", raw];
  let choice = "*";
  if (conditionPart && conditionPart !== "always") {
    const [kind, value] = conditionPart.split(":").map((part) => part.trim());
    if (kind === "choice") choice = value || "*";
  }
  const [action, value = ""] = actionPart.split(":").map((part) => part.trim());
  return action ? { choice, action, value } : null;
}

function toCommsEffects(value) {
  return toList(value).map(parseCommsEffect).filter(Boolean);
}

function rowsToObject(rows, mapper) {
  return Object.fromEntries(rows.map((row) => [row.id, mapper(row)]).filter(([id]) => id));
}

async function loadRequiredCsv(path, apply) {
  apply(await loadCsv(path));
}

async function loadExternalData() {
  await loadRequiredCsv("data/crops.csv", (rows) => {
    CROPS = rowsToObject(rows, (row) => ({
      name: row.name,
      days: toNumber(row.days),
      seedPrice: toNumber(row.seedPrice),
      packSize: toNumber(row.packSize),
      basePrice: toNumber(row.basePrice),
      water: toNumber(row.water),
      nutrient: toNumber(row.nutrient),
      icon: row.icon,
      color: row.color,
      note: row.note,
      unlock: row.unlock,
      primaryMarket: row.unlock,
      category: row.category
    }));
  });
  await loadRequiredCsv("data/markets.csv", (rows) => {
    MARKETS = rowsToObject(rows, (row) => ({
      name: row.name,
      contact: row.contact,
      portrait: row.portrait,
      description: row.description,
      risk: row.risk,
      multipliers: toMap(row.multipliers),
      accepts: toList(row.accepts),
      unlockHint: row.unlockHint
    }));
  });
  await loadRequiredCsv("data/market_signals.csv", (rows) => {
    MARKET_SIGNALS = rowsToObject(rows, (row) => ({
      axisA: row.axisA,
      axisALabel: row.axisALabel,
      axisADescription: row.axisADescription,
      axisB: row.axisB,
      axisBLabel: row.axisBLabel,
      axisBDescription: row.axisBDescription
    }));
  });
  await loadRequiredCsv("data/crop_market_response.csv", (rows) => {
    CROP_MARKET_RESPONSE = rows.reduce((entries, row) => {
      entries[row.marketId] ||= {};
      entries[row.marketId][row.cropId] = {
        axisAWeight: toNumber(row.axisAWeight),
        axisBWeight: toNumber(row.axisBWeight),
        synergy: toNumber(row.synergy),
        minMultiplier: toNumber(row.minMultiplier, 0.65),
        maxMultiplier: toNumber(row.maxMultiplier, 1.75),
        note: row.note
      };
      return entries;
    }, {});
  });
  await loadRequiredCsv("data/schedule_rumors.csv", (rows) => {
    SCHEDULE_RUMORS = rows.map((row) => ({
      id: row.id,
      type: row.type || "basic",
      startDay: toNumber(row.startDay, 1),
      duration: toNumber(row.duration, 1),
      marketId: row.marketId,
      axes: toList(row.axes || row.axis),
      cropIds: toList(row.cropIds || row.crops),
      strength: row.strength || "mid",
      chance: toNumber(row.chance, row.type === "rare" ? 0.45 : 1),
      jitter: toNumber(row.jitter, row.type === "rare" ? 2 : 0),
      signalBoost: toNumber(row.signalBoost, 0),
      priceBoost: toNumber(row.priceBoost, 0),
      title: row.title,
      rumor: row.rumor,
      comment: row.comment
    })).filter((entry) => entry.id && entry.marketId && entry.axes.length);
  });
  await loadRequiredCsv("data/plant_sprites.csv", (rows) => {
    PLANT_STAGE_SPRITES = rows.reduce((entries, row) => {
      const cropId = row.cropId || row.id;
      if (!cropId) return entries;
      entries[cropId] = [row.stage1, row.stage2, row.stage3, row.stage4, row.stage5].filter(Boolean);
      return entries;
    }, {});
  });
  await loadRequiredCsv("data/grow_unit_slots.csv", (rows) => {
    GROW_UNIT_SLOT_LAYOUTS = rows.reduce((entries, row) => {
      const unitId = row.unitId || row.unit;
      const slotIndex = Math.max(0, Math.floor(toNumber(row.slotIndex, 0)));
      if (!unitId) return entries;
      entries[unitId] ||= [];
      entries[unitId][slotIndex] = {
        x: toNumber(row.x, 50),
        y: toNumber(row.y, 50),
        size: toNumber(row.size, 20),
        z: toNumber(row.z, slotIndex)
      };
      return entries;
    }, {});
  });
  await loadRequiredCsv("data/base_tags.csv", (rows) => {
    BASE_TAGS = rowsToObject(rows, (row) => ({
      name: row.name,
      text: row.text,
      effects: toMap(row.effects)
    }));
  });
  await loadRequiredCsv("data/equipment_tags.csv", (rows) => {
    EQUIPMENT_TAGS = rowsToObject(rows, (row) => ({
      name: row.name,
      text: row.text,
      effects: toMap(row.effects)
    }));
  });
  await loadRequiredCsv("data/crop_environment.csv", (rows) => {
    CROP_ENVIRONMENT = rowsToObject(rows, (row) => ({
      temp: toNumber(row.temp, DEFAULT_ENVIRONMENT.temp),
      humidity: toNumber(row.humidity, DEFAULT_ENVIRONMENT.humidity),
      co2: toNumber(row.co2, DEFAULT_ENVIRONMENT.co2)
    }));
  });
  await loadRequiredCsv("data/grow_units.csv", (rows) => {
    GROW_UNITS = rowsToObject(rows, (row) => ({
      name: row.name,
      code: row.code,
      slots: toNumber(row.slots),
      price: toNumber(row.price),
      upkeep: toNumber(row.upkeep),
      width: toNumber(row.width),
      height: toNumber(row.height),
      continuous: toBool(row.continuous),
      icon: row.icon,
      sprite: row.sprite,
      emptySprite: row.emptySprite,
      description: row.description
    }));
  });
  await loadRequiredCsv("data/floor_devices.csv", (rows) => {
    FLOOR_DEVICES = rowsToObject(rows, (row) => ({
      name: row.name,
      code: row.code,
      width: toNumber(row.width),
      height: toNumber(row.height),
      radius: toNumber(row.radius),
      upkeep: toNumber(row.upkeep),
      icon: row.icon,
      sprite: row.sprite,
      color: row.color
    }));
  });
  await loadRequiredCsv("data/support_robot_skills.csv", (rows) => {
    ROBOT_SKILLS = rowsToObject(rows, (row) => ({
      name: row.name,
      harvest: row.harvest || "B",
      plant: row.plant || row.planting || "B",
      cleaning: row.cleaning || row.clean || "B",
      procure: row.procure || "B",
      ship: row.ship || "B",
      description: row.description
    }));
  });
  await loadRequiredCsv("data/support_robot_personalities.csv", (rows) => {
    ROBOT_PERSONALITIES = rowsToObject(rows, (row) => ({
      name: row.name,
      rangeMod: toNumber(row.rangeMod, 1),
      fuelMod: toNumber(row.fuelMod, 1),
      speedMod: toNumber(row.speedMod, 1),
      description: row.description
    }));
  });
  await loadRequiredCsv("data/equipment.csv", (rows) => {
    EQUIPMENT = rowsToObject(rows, (row) => ({
      name: row.name,
      icon: row.icon,
      sprite: row.sprite,
      basePrice: toNumber(row.basePrice),
      color: row.color,
      description: row.description
    }));
  });
  await loadRequiredCsv("data/unlocks.csv", (rows) => {
    UNLOCK_RULES = rows.map((row) => ({
      id: row.id,
      type: row.type,
      target: row.target,
      requirements: toRequirements(row.requirements),
      event: row.event,
      hint: row.hint,
      initiallyUnlocked: toBool(row.initiallyUnlocked)
    })).filter((row) => row.id && row.type && row.target);
  });
  await loadRequiredCsv("data/area_profiles.csv", (rows) => {
    AREA_PROFILES = rowsToObject(rows, (row) => ({
      areaNames: toList(row.areaNames),
      facilityNames: toList(row.facilityNames),
      cols: toRange(row.cols),
      rows: toRange(row.rows),
      prices: toRange(row.prices),
      upkeep: toRange(row.upkeep),
      image: row.image,
      allowedUnits: toList(row.allowedUnits),
      traits: toList(row.traits)
    }));
  });
  await loadRequiredCsv("data/property_comments.csv", (rows) => {
    PROPERTY_COMMENTS = rows.reduce((entries, row) => {
      const tier = row.tier || "drainage";
      entries[tier] ||= { lines: [], saleSuffix: "" };
      if (row.line) entries[tier].lines.push(row.line);
      if (row.saleSuffix) entries[tier].saleSuffix = row.saleSuffix;
      return entries;
    }, {});
  });
  await loadRequiredCsv("data/events.csv", (rows) => {
    EVENTS = rows.map((row) => ({
      id: row.id,
      forecastText: row.forecastText || row.text,
      activeText: row.activeText || row.text,
      label: row.label,
      leadDays: Math.max(2, Math.round(toNumber(row.leadDays, 5))),
      duration: Math.max(1, Math.round(toNumber(row.duration, 2))),
      allCropMod: row.allCropMod ? toNumber(row.allCropMod, 1) : undefined,
      cropMods: row.cropMods ? toMap(row.cropMods) : undefined,
      waterCostMod: row.waterCostMod ? toNumber(row.waterCostMod, 1) : undefined,
      fee: row.fee ? toNumber(row.fee, 0) : undefined
    })).filter((row) => row.id && row.forecastText && row.activeText);
  });
  await loadRequiredCsv("data/quiet_news.csv", (rows) => {
    QUIET_NEWS = rows.map((row) => row.text).filter(Boolean);
  });
  await loadRequiredCsv("data/audio.csv", (rows) => {
    SOUND_FILES = rowsToObject(rows, (row) => row.file);
    SOUND_VOLUMES = rowsToObject(rows, (row) => toNumber(row.volume, 0.28));
  });
  await loadRequiredCsv("data/ambient_layers.csv", (rows) => {
    AMBIENT_LAYERS = rowsToObject(rows, (row) => ({
      label: row.label,
      file: row.file,
      volume: toNumber(row.volume, 0.15),
      condition: row.condition || "always",
      description: row.description
    }));
  });
  await loadRequiredCsv("data/radio_programs.csv", (rows) => {
    RADIO_PROGRAMS = rowsToObject(rows, (row) => ({
      name: row.name,
      kicker: row.kicker,
      description: row.description,
      file: row.file,
      volume: toNumber(row.volume, 0.2),
      unlocked: row.unlocked !== "false"
    }));
  });
  await loadRequiredCsv("data/comm_events.csv", (rows) => {
    COMM_EVENTS = rows.map((row) => ({
      id: row.id,
      trigger: row.trigger,
      speakerName: row.speakerName,
      speakerRole: row.speakerRole,
      icon: row.icon,
      kicker: row.kicker,
      title: row.title,
      pages: toList(row.body),
      choices: toList(row.choices).map((entry) => {
        const [id, label] = entry.split("=");
        return { id, label: label || id };
      }),
      once: String(row.once || "").trim().toLowerCase() !== "false",
      blocking: toBool(row.blocking),
      priority: toNumber(row.priority, 0),
      requirements: toRequirements(row.requirements),
      context: toContextMatchers(row.context),
      sound: row.sound || "",
      soundVolume: row.soundVolume ? toNumber(row.soundVolume, null) : null,
      effects: toCommsEffects(row.effects)
    })).sort((a, b) => b.priority - a.priority);
  });
  await loadRequiredCsv("data/ui_text.csv", applyUiText);
}

function setBootLoadingProgress(done, total, label = "素材を読み込んでいます...") {
  const overlay = document.getElementById("boot-loading");
  if (!overlay) return;
  const ratio = total ? Math.round((done / total) * 100) : 0;
  const fill = document.getElementById("boot-loading-fill");
  const textNode = document.getElementById("boot-loading-text");
  const count = document.getElementById("boot-loading-count");
  if (fill) fill.style.width = `${Math.max(0, Math.min(100, ratio))}%`;
  if (textNode) textNode.textContent = label;
  if (count) count.textContent = total ? `${done} / ${total} // ${ratio}%` : "0%";
}

function hideBootLoading() {
  const overlay = document.getElementById("boot-loading");
  if (!overlay) return;
  overlay.classList.add("hidden");
  window.setTimeout(() => overlay.remove(), 420);
}

function addAssetUrl(set, value) {
  const url = String(value || "").trim();
  if (!url || url.startsWith("#") || url.startsWith("data:")) return;
  if (!/\.(png|jpe?g|webp|gif|svg|ico)(\?|#|$)/i.test(url)) return;
  set.add(url);
}

function collectBootImageAssets() {
  const urls = new Set();
  document.querySelectorAll("img[src], link[rel='icon'][href]").forEach((element) => {
    addAssetUrl(urls, element.getAttribute("src") || element.getAttribute("href"));
  });
  [SAFE_ROOM_IMAGE].forEach((url) => addAssetUrl(urls, url));
  Object.values(CROPS).forEach((entry) => addAssetUrl(urls, entry.icon));
  Object.values(MARKETS).forEach((entry) => addAssetUrl(urls, entry.portrait));
  Object.values(GROW_UNITS).forEach((entry) => {
    addAssetUrl(urls, entry.icon);
    addAssetUrl(urls, entry.sprite);
    addAssetUrl(urls, entry.emptySprite);
  });
  Object.values(FLOOR_DEVICES).forEach((entry) => {
    addAssetUrl(urls, entry.icon);
    addAssetUrl(urls, entry.sprite);
  });
  Object.values(EQUIPMENT).forEach((entry) => {
    addAssetUrl(urls, entry.icon);
    addAssetUrl(urls, entry.sprite);
  });
  Object.values(AREA_PROFILES).forEach((entry) => addAssetUrl(urls, entry.image));
  Object.values(PLANT_STAGE_SPRITES).flat().forEach((url) => addAssetUrl(urls, url));
  COMM_EVENTS.forEach((event) => addAssetUrl(urls, event.icon));
  Object.values(UI_TEXT).forEach((value) => addAssetUrl(urls, value));
  return [...urls];
}

function preloadImageAsset(url, timeoutMs = BOOT_ASSET_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (error = null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (error) reject(error);
      else resolve(url);
    };
    const timer = window.setTimeout(() => finish(new Error(`Image timed out: ${url}`)), timeoutMs);
    image.decoding = "async";
    image.onload = () => finish();
    image.onerror = () => finish(new Error(`Image failed to load: ${url}`));
    image.src = url;
    if (image.complete && image.naturalWidth > 0) image.onload();
  });
}

async function preloadBootAssets() {
  const urls = collectBootImageAssets();
  const failures = [];
  let done = 0;
  let nextIndex = 0;
  const workerCount = Math.min(6, Math.max(1, urls.length));
  setBootLoadingProgress(done, urls.length, "画像素材を確認しています...");
  async function preloadNext() {
    while (nextIndex < urls.length) {
      const currentIndex = nextIndex;
      const url = urls[currentIndex];
      nextIndex += 1;
      setBootLoadingProgress(done, urls.length, `読み込み中 (${Math.min(done + 1, urls.length)}/${urls.length}): ${url}`);
      try {
        await preloadImageAsset(url);
      } catch (error) {
        failures.push({ url, message: error.message });
        console.warn("Boot image preload skipped", url, error);
      }
      done += 1;
      setBootLoadingProgress(done, urls.length, `確認済み (${done}/${urls.length}): ${url}`);
    }
  }
  await Promise.all(Array.from({ length: workerCount }, preloadNext));
  window.BOOT_ASSET_FAILURES = failures;
  if (failures.length) console.warn("Boot image preload completed with missing assets", failures);
}
function applyUiText(rows) {
  rows.forEach((row) => {
    UI_TEXT[row.key] = row.text;
    if (!row.selector) return;
    const element = row.selector === "title" ? document.querySelector("title") : document.querySelector(row.selector);
    if (!element) return;
    if (row.attribute === "html") element.innerHTML = row.text;
    else if (row.attribute === "text") element.textContent = row.text;
    else element.setAttribute(row.attribute, row.text);
  });
}

function text(key, fallback, vars = {}) {
  return Object.entries(vars).reduce(
    (message, [name, value]) => message.replaceAll(`{${name}}`, value),
    UI_TEXT[key] || fallback
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}


function defaultAnalytics() {
  return {
    startedAt: Date.now(),
    timeline: {},
    purchaseOrder: [],
    recentFailures: [],
    plantingFailures: {},
    plants: {
      plantedByCrop: {},
      plantedByUnit: {},
      readyByCrop: {},
      harvestByCrop: {},
      harvestByUnit: {},
      harvestByQuality: {},
      degradedHarvests: 0,
      deaths: 0,
      deadRemoved: 0,
      harvestDelayTotalSec: 0,
      harvestDelayCount: 0,
      maxHarvestDelaySec: 0
    },
    sales: {
      saleCount: 0,
      byCropMarket: {},
      byQuality: {},
      premiumSales: 0,
      bestMarketMisses: 0,
      estimatedRevenueLoss: 0
    },
    resources: {
      waterUsed: 0,
      nutrientUsed: 0,
      waterUsedOnPlanting: 0,
      nutrientUsedOnPlanting: 0,
      waterUsedWhileGrowing: 0,
      nutrientUsedWhileGrowing: 0
    },
    tabs: {},
    equipment: {
      placements: 0,
      stocked: 0,
      sold: 0
    }
  };
}

function ensureAnalytics() {
  if (!state) return null;
  const defaults = defaultAnalytics();
  state.analytics = { ...defaults, ...(state.analytics || {}) };
  state.analytics.timeline ||= {};
  state.analytics.purchaseOrder = Array.isArray(state.analytics.purchaseOrder) ? state.analytics.purchaseOrder : [];
  state.analytics.recentFailures = Array.isArray(state.analytics.recentFailures) ? state.analytics.recentFailures : [];
  state.analytics.plantingFailures ||= {};
  state.analytics.plants = { ...defaults.plants, ...(state.analytics.plants || {}) };
  state.analytics.plants.plantedByCrop ||= {};
  state.analytics.plants.plantedByUnit ||= {};
  state.analytics.plants.readyByCrop ||= {};
  state.analytics.plants.harvestByCrop ||= {};
  state.analytics.plants.harvestByUnit ||= {};
  state.analytics.plants.harvestByQuality ||= {};
  state.analytics.sales = { ...defaults.sales, ...(state.analytics.sales || {}) };
  state.analytics.sales.byCropMarket ||= {};
  state.analytics.sales.byQuality ||= {};
  state.analytics.resources = { ...defaults.resources, ...(state.analytics.resources || {}) };
  state.analytics.tabs ||= {};
  state.analytics.equipment = { ...defaults.equipment, ...(state.analytics.equipment || {}) };
  if (!Number.isFinite(Number(state.analytics.startedAt))) state.analytics.startedAt = Date.now();
  return state.analytics;
}

function incrementMetric(record, key, amount = 1) {
  if (!record || !key) return;
  record[key] = Math.round((Number(record[key]) || 0) + amount);
}

function addMetric(record, key, amount = 0) {
  if (!record || !key) return;
  record[key] = Math.round((Number(record[key]) || 0) + amount);
}

function analyticsElapsedSeconds() {
  const analytics = ensureAnalytics();
  if (!analytics) return 0;
  return Math.max(0, Math.round((Date.now() - analytics.startedAt) / 1000));
}

function analyticsDayFloat() {
  return Number(((Number(state?.day) || 1) + (Number(state?.dayProgress) || 0)).toFixed(2));
}

function analyticsStamp(extra = {}) {
  return {
    day: Number(state?.day) || 1,
    dayFloat: analyticsDayFloat(),
    elapsedSec: analyticsElapsedSeconds(),
    ...extra
  };
}

function pushCapped(list, entry, limit = 120) {
  list.push(entry);
  if (list.length > limit) list.splice(0, list.length - limit);
}

function trackTimeline(key, context = {}) {
  const analytics = ensureAnalytics();
  if (!analytics || analytics.timeline[key]) return;
  analytics.timeline[key] = analyticsStamp(context);
}

function trackPurchase(kind, itemId, price = 0, extra = {}) {
  const analytics = ensureAnalytics();
  if (!analytics) return;
  const entry = analyticsStamp({ kind, itemId, price: Math.round(Number(price) || 0), ...extra });
  pushCapped(analytics.purchaseOrder, entry, 200);
  trackTimeline('firstPurchase', entry);
  trackTimeline('firstPurchase:' + kind, entry);
  if (itemId) trackTimeline('firstPurchase:' + kind + ':' + itemId, entry);
}

function plantingShortageReason(context = {}) {
  const waterMissing = Number(context.waterMissing) > 0;
  const nutrientMissing = Number(context.nutrientMissing) > 0;
  if (waterMissing && nutrientMissing) return 'water_and_nutrient';
  if (waterMissing) return 'water';
  if (nutrientMissing) return 'nutrient';
  return 'resource';
}

function trackPlantingFailure(reason, context = {}) {
  const analytics = ensureAnalytics();
  if (!analytics) return;
  incrementMetric(analytics.plantingFailures, reason || 'unknown');
  pushCapped(analytics.recentFailures, analyticsStamp({ type: 'planting', reason: reason || 'unknown', ...context }), 80);
}

function trackPlanting(cropId, unit, shelfIndex, slotIndex, plantingCost = {}) {
  const analytics = ensureAnalytics();
  if (!analytics) return;
  incrementMetric(analytics.plants.plantedByCrop, cropId);
  incrementMetric(analytics.plants.plantedByUnit, unit?.type || 'unknown');
  const water = Number(plantingCost.water) || 0;
  const nutrient = Number(plantingCost.nutrient) || 0;
  addMetric(analytics.resources, 'waterUsed', water);
  addMetric(analytics.resources, 'nutrientUsed', nutrient);
  addMetric(analytics.resources, 'waterUsedOnPlanting', water);
  addMetric(analytics.resources, 'nutrientUsedOnPlanting', nutrient);
  trackTimeline('firstPlant', { cropId, unitType: unit?.type, shelfIndex, slotIndex });
  trackTimeline('firstPlant:' + cropId, { cropId, unitType: unit?.type, shelfIndex, slotIndex });
  trackTimeline('firstPlantUnit:' + (unit?.type || 'unknown'), { cropId, unitType: unit?.type, shelfIndex, slotIndex });
}

function trackPlantReady(plant, shelf) {
  const analytics = ensureAnalytics();
  if (!analytics || !plant || plant.readyTracked) return;
  plant.readyTracked = true;
  plant.readyAtElapsedSec = analyticsElapsedSeconds();
  plant.readyAtDayFloat = analyticsDayFloat();
  incrementMetric(analytics.plants.readyByCrop, plant.crop);
  trackTimeline('firstReady', { cropId: plant.crop, unitType: shelf?.type });
  trackTimeline('firstReady:' + plant.crop, { cropId: plant.crop, unitType: shelf?.type });
}

function trackHarvestAnalytics(plant, shelf, qty = 1) {
  const analytics = ensureAnalytics();
  if (!analytics || !plant) return;
  const amount = Math.max(1, Number(qty) || 1);
  incrementMetric(analytics.plants.harvestByCrop, plant.crop, amount);
  incrementMetric(analytics.plants.harvestByUnit, shelf?.type || 'unknown', amount);
  incrementMetric(analytics.plants.harvestByQuality, plant.quality || 'unknown', amount);
  if (plant.degraded) analytics.plants.degradedHarvests += amount;
  if (Number.isFinite(Number(plant.readyAtElapsedSec))) {
    const delay = Math.max(0, analyticsElapsedSeconds() - Number(plant.readyAtElapsedSec));
    analytics.plants.harvestDelayTotalSec += delay * amount;
    analytics.plants.harvestDelayCount += amount;
    analytics.plants.maxHarvestDelaySec = Math.max(Number(analytics.plants.maxHarvestDelaySec) || 0, delay);
  }
  trackTimeline('firstHarvest', { cropId: plant.crop, unitType: shelf?.type, quality: plant.quality });
  trackTimeline('firstHarvest:' + plant.crop, { cropId: plant.crop, unitType: shelf?.type, quality: plant.quality });
}

function trackDeadPlantAnalytics(plant, shelf, reason = 'dead') {
  const analytics = ensureAnalytics();
  if (!analytics || !plant) return;
  if (reason === 'removed') {
    analytics.plants.deadRemoved += 1;
    return;
  }
  if (plant.deadTracked) return;
  plant.deadTracked = true;
  analytics.plants.deaths += 1;
  pushCapped(analytics.recentFailures, analyticsStamp({ type: 'plant_dead', reason, cropId: plant.crop, unitType: shelf?.type }), 80);
}

function trackSaleAnalytics(batch, marketId, qty, unitPrice, revenue, premiumSale = false) {
  const analytics = ensureAnalytics();
  if (!analytics || !batch) return;
  const amount = Math.max(1, Number(qty) || 1);
  analytics.sales.saleCount += 1;
  incrementMetric(analytics.sales.byQuality, batch.quality || 'unknown', amount);
  if (premiumSale) analytics.sales.premiumSales += amount;
  const key = batch.crop + ':' + marketId;
  const entry = analytics.sales.byCropMarket[key] || { cropId: batch.crop, marketId, qty: 0, revenue: 0 };
  entry.qty += amount;
  entry.revenue += Math.round(Number(revenue) || 0);
  analytics.sales.byCropMarket[key] = entry;
  const acceptedMarkets = Object.keys(MARKETS).filter((candidate) => isMarketAvailable(candidate) && MARKETS[candidate]?.accepts?.includes(batch.crop));
  const best = acceptedMarkets
    .map((candidate) => ({ marketId: candidate, price: getUnitPrice(batch, candidate) }))
    .sort((a, b) => b.price - a.price)[0];
  if (best && best.marketId !== marketId && best.price > unitPrice) {
    analytics.sales.bestMarketMisses += 1;
    analytics.sales.estimatedRevenueLoss += Math.round((best.price - unitPrice) * amount);
  }
  trackTimeline('firstSale', { cropId: batch.crop, marketId, qty: amount, revenue: Math.round(Number(revenue) || 0) });
  trackTimeline('firstSaleMarket:' + marketId, { cropId: batch.crop, marketId, qty: amount, revenue: Math.round(Number(revenue) || 0) });
}

function trackTabAnalytics(tabId, previousTab = '') {
  const analytics = ensureAnalytics();
  if (!analytics || !tabId) return;
  incrementMetric(analytics.tabs, tabId);
  trackTimeline('firstTab:' + tabId, { tabId, previousTab });
}

function trackResourceGrowthUse(water = 0, nutrient = 0) {
  const analytics = ensureAnalytics();
  if (!analytics) return;
  addMetric(analytics.resources, 'waterUsed', water);
  addMetric(analytics.resources, 'nutrientUsed', nutrient);
  addMetric(analytics.resources, 'waterUsedWhileGrowing', water);
  addMetric(analytics.resources, 'nutrientUsedWhileGrowing', nutrient);
}

function trackPlacementAnalytics(kind, item) {
  const analytics = ensureAnalytics();
  if (!analytics || !item) return;
  analytics.equipment.placements += 1;
  trackTimeline('firstPlaced:' + kind + ':' + item.type, { kind, itemId: item.type, x: item.x, y: item.y });
}

function trackStockAnalytics(kind, item) {
  const analytics = ensureAnalytics();
  if (!analytics || !item) return;
  analytics.equipment.stocked += 1;
}

function trackEquipmentSaleAnalytics(kind, item, refund = 0) {
  const analytics = ensureAnalytics();
  if (!analytics || !item) return;
  analytics.equipment.sold += 1;
  pushCapped(analytics.purchaseOrder, analyticsStamp({ kind: 'sell_' + kind, itemId: item.type, price: -Math.round(Number(refund) || 0) }), 200);
}

function createAnalyticsSummary() {
  const analytics = ensureAnalytics() || defaultAnalytics();
  const plants = analytics.plants || {};
  const totalSlots = allShelves().reduce((sum, shelf) => sum + (shelf.slots?.length || 0), 0);
  const active = activePlants();
  const plantedSlots = active.filter(({ plant }) => plant && !plant.dead).length;
  const readySlots = active.filter(({ plant }) => plant?.ready).length;
  const plantingFailureTotal = Object.values(analytics.plantingFailures || {}).reduce((sum, value) => sum + (Number(value) || 0), 0);
  return {
    startedAt: analytics.startedAt,
    elapsedSec: analyticsElapsedSeconds(),
    timeline: analytics.timeline,
    purchaseOrder: analytics.purchaseOrder,
    recentFailures: analytics.recentFailures,
    plantingFailures: analytics.plantingFailures,
    plantingFailureTotal,
    plants: {
      ...plants,
      averageHarvestDelaySec: plants.harvestDelayCount ? Math.round(plants.harvestDelayTotalSec / plants.harvestDelayCount) : 0
    },
    sales: analytics.sales,
    resources: analytics.resources,
    tabs: analytics.tabs,
    equipment: analytics.equipment,
    utilization: {
      totalSlots,
      plantedSlots,
      readySlots,
      occupancyRate: totalSlots ? Number((plantedSlots / totalSlots).toFixed(3)) : 0
    }
  };
}

function createDefaultSupportAutomation() {
  return {
    procurement: {
      selectedCropId: "lettuce",
      byCrop: Object.fromEntries(Object.keys(CROPS).map((cropId) => [cropId, { enabled: false, packs: 1 }]))
    },
    planting: { enabled: false, cropId: "lettuce" },
    shipping: {
      selectedCropId: "lettuce",
      byCrop: Object.fromEntries(Object.keys(CROPS).map((cropId) => [cropId, { enabled: false, marketId: "lower", qty: 1 }]))
    }
  };
}

function createInitialState(mode = "normal") {
  const initialProperty = createInitialSafeRoom();
  initialProperty.ownedAt = Date.now();
  const initialPod = createStarterPod();
  return {
    day: 1,
    mode,
    money: 300,
    water: 20,
    nutrient: 20,
    nutrientCapacity: 20,
    seeds: Object.fromEntries(Object.keys(CROPS).map((cropId) => [cropId, cropId === "lettuce" ? 6 : 0])),
    bases: [{
      ...initialProperty,
      shelves: [initialPod],
      floorDevices: []
    }],
    activeBaseId: initialProperty.id,
    propertyListings: generatePropertyListings(PROPERTY_LISTING_COUNT),
    procurementTags: {},
    unlocks: {},
    inventory: [],
    equipment: { tanks: 0, filter: false, fridge: false },
    supportOS: { harvest: false, planting: false, cleaning: false },
    automation: createDefaultSupportAutomation(),
    resourceRemainders: { water: 0, nutrient: 0 },
    dayProgress: 0,
    paused: false,
    timeUnlocked: false,
    marketFluctuation: {},
    marketSignals: {},
    marketEventQueue: [],
    monthlySchedule: generateMonthlySchedule(),
    nextMarketForecastDay: 3,
    newsHistory: [],
    tradeStats: {
      unitsSold: 0,
      revenue: 0,
      byMarket: { lower: 0, medical: 0, upper: 0, rebel: 0 },
      byMarketQty: { lower: 0, medical: 0, upper: 0, rebel: 0 },
      byCrop: {},
      eventRevenue: 0,
      foodToRebels: 0,
      weaponsToRebels: 0
    },
    analytics: defaultAnalytics(),
    marketUnlocked: { lower: true, medical: false, upper: false, rebel: false },
    marketTabUnlocked: false,
    shopUnlocked: false,
    brokerUnlocked: false,
    commsSeen: {},
    commsChoices: {},
    commsOpen: [],
    event: null,
    news: "",
    newsLabel: "",
    audio: {
      noiseCanceling: false,
      radioProgram: "off"
    },
    day30Recorded: false,
    day30RecordId: null,
    consecutiveDebtDays: 0,
    tomatoHarvested: false,
    prototypeReportShown: false,
    supportRobotGranted: false,
    ended: false,
    resultShown: false,
    log: text("log_initial", "System online. Place the grow pod Mara sent you.")
  };
}

function createStarterPod() {
  return {
    id: makeId("unit"),
    type: "pod",
    led: false,
    fan: false,
    placed: false,
    x: null,
    y: null,
    tags: pickTagIds(EQUIPMENT_TAGS, 1),
    dirt: 0,
    slots: Array(GROW_UNITS.pod.slots).fill(null)
  };
}

function createInitialSafeRoom() {
  const drainageProfile = AREA_PROFILES.drainage || {};
  const tags = ["humid"];
  const tagEffects = combinedEffects(tags, BASE_TAGS);
  const property = {
    id: makeId("property"),
    tier: "safe_room",
    name: "下層貧民区のセーフルーム",
    code: "SAFE-ROOM-01",
    cols: 3,
    rows: 2,
    price: 0,
    basePrice: 0,
    onSale: false,
    discountRate: 0,
    blockedCells: [],
    upkeep: 0,
    image: SAFE_ROOM_IMAGE,
    allowedUnits: ["pod"],
    traits: ["初期拠点", "POD専用", "極小区画"],
    tags,
    environment: {
      temp: DEFAULT_ENVIRONMENT.temp + (tagEffects.temp || 0),
      humidity: DEFAULT_ENVIRONMENT.humidity + (tagEffects.humidity || 0),
      co2: DEFAULT_ENVIRONMENT.co2 + (tagEffects.co2 || 0)
    },
    description: ""
  };
  property.description = propertyFlavorDescription(property);
  return property;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function pickTagIds(source, count = 1) {
  const ids = Object.keys(source).sort(() => Math.random() - 0.5);
  return ids.slice(0, count);
}

function tagMarkup(tags = [], source = {}) {
  return tags.length
    ? `<div class="tag-list">${tags.map((tagId) => `<span title="${source[tagId]?.text || ""}">${source[tagId]?.name || tagId}</span>`).join("")}</div>`
    : "";
}

function combinedEffects(tags = [], source = {}) {
  return tags.reduce((effects, tagId) => {
    Object.entries(source[tagId]?.effects || {}).forEach(([key, value]) => {
      if (key.endsWith("Mod") || key === "growthMod" || key === "leafGrowth" || key === "fruitGrowth" || key === "herbGrowth") {
        effects[key] = (effects[key] || 1) * value;
      } else {
        effects[key] = (effects[key] || 0) + value;
      }
    });
    return effects;
  }, {});
}

function ensureProcurementTags() {
  state.procurementTags ||= {};
  Object.keys(EQUIPMENT).forEach((itemId) => {
    if (GROW_UNITS[itemId] || FLOOR_DEVICES[itemId]) {
      state.procurementTags[itemId] ||= pickTagIds(EQUIPMENT_TAGS, Math.random() < 0.22 ? 2 : 1);
    }
  });
}

function unitTags(itemId) {
  ensureProcurementTags();
  return [...(state.procurementTags[itemId] || [])];
}

function cellKey(x, y) {
  return `${x},${y}`;
}

function blockedCellSet(base) {
  return new Set(base.blockedCells || []);
}

function isBlockedCell(base, x, y) {
  return blockedCellSet(base).has(cellKey(x, y));
}

function generateBlockedCells(cols, rows, discountRate = 0, initial = false) {
  if (initial || discountRate <= 0) return [];
  const totalCells = cols * rows;
  const minRatio = Math.max(0.04, discountRate * 0.22);
  const maxRatio = Math.min(0.34, discountRate * 0.78);
  const holeCount = Math.max(1, Math.min(totalCells - 2, Math.round(totalCells * randomBetween(minRatio, maxRatio))));
  const candidates = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      candidates.push({ x, y, edge: x === 0 || y === 0 || x === cols - 1 || y === rows - 1 });
    }
  }
  candidates.sort((a, b) => Number(b.edge) - Number(a.edge) || Math.random() - 0.5);
  return candidates.slice(0, holeCount).map(({ x, y }) => cellKey(x, y));
}

function usableCellCount(base) {
  return base.cols * base.rows - (base.blockedCells || []).length;
}

function propertyFlavorDescription(property, onSale = property.onSale) {
  const comments = PROPERTY_COMMENTS[property.tier] || PROPERTY_COMMENTS.drainage || { lines: [] };
  const pool = comments.lines && comments.lines.length ? comments.lines : ["Kido: No comment filed for this property. Check the preview."];
  const baseLine = pool[Math.abs(hashString(property.id || property.name || property.code)) % pool.length];
  return onSale ? baseLine + (comments.saleSuffix || "") : baseLine;
}

function hashString(value) {
  return String(value).split("").reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function generateProperty(tier = "drainage", initial = false) {
  const profile = AREA_PROFILES[tier];
  const cols = initial ? 5 : randomInt(profile.cols[0], profile.cols[1]);
  const rows = initial ? 2 : randomInt(profile.rows[0], profile.rows[1]);
  const basePrice = initial ? 0 : Math.round(randomBetween(profile.prices[0], profile.prices[1]) / 50) * 50;
  const onSale = !initial && Math.random() < 0.38;
  const discountRate = onSale ? randomBetween(0.15, 0.55) : 0;
  const blockedCells = generateBlockedCells(cols, rows, discountRate, initial);
  const price = initial ? 0 : Math.max(50, Math.round(basePrice * (1 - discountRate) / 50) * 50);
  const traits = [...profile.traits].sort(() => Math.random() - 0.5).slice(0, 2);
  if (onSale) traits.unshift(`SALE -${Math.round(discountRate * 100)}%`);
  const tags = initial ? ["humid"] : pickTagIds(BASE_TAGS, Math.random() < 0.28 ? 2 : 1);
  const tagEffects = combinedEffects(tags, BASE_TAGS);
  const property = {
    id: makeId("property"),
    tier,
    name: `${pick(profile.areaNames)}の${pick(profile.facilityNames)}`,
    code: `${tier.toUpperCase()}-${randomInt(11, 99)}`,
    cols,
    rows,
    price,
    basePrice,
    onSale,
    discountRate,
    blockedCells,
    upkeep: initial ? 0 : randomInt(profile.upkeep[0], profile.upkeep[1]),
    image: profile.image,
    allowedUnits: [...profile.allowedUnits],
    traits,
    tags,
    environment: {
      temp: DEFAULT_ENVIRONMENT.temp + (tagEffects.temp || 0),
      humidity: DEFAULT_ENVIRONMENT.humidity + (tagEffects.humidity || 0),
      co2: DEFAULT_ENVIRONMENT.co2 + (tagEffects.co2 || 0)
    },
    description: ""
  };
  property.description = propertyFlavorDescription(property, onSale);
  return property;
}

function generatePropertyListings(count = PROPERTY_LISTING_COUNT) {
  const tiers = ["drainage", "drainage", "tunnel", "freight", "station"];
  return Array.from({ length: count }, (_, index) => generateProperty(tiers[Math.min(index, tiers.length - 1)]));
}

function ensureMarketNewsState() {
  state.marketEventQueue = Array.isArray(state.marketEventQueue) ? state.marketEventQueue : [];
  state.monthlySchedule = ensureMonthlyScheduleBasics(Array.isArray(state.monthlySchedule) && state.monthlySchedule.length ? state.monthlySchedule : generateMonthlySchedule());
  state.newsHistory = Array.isArray(state.newsHistory) ? state.newsHistory : [];
  if (!Number.isFinite(Number(state.nextMarketForecastDay))) {
    state.nextMarketForecastDay = Math.max(3, (Number(state.day) || 1) + 2);
  }
}

function marketEventById(eventId) {
  return EVENTS.find((entry) => entry.id === eventId);
}

function marketEventText(template, event, schedule) {
  const leadDays = Math.max(0, schedule.activeDay - schedule.announcedDay);
  const duration = Math.max(1, schedule.endDay - schedule.activeDay);
  return String(template || event.activeText || event.forecastText || "")
    .replaceAll("{leadDays}", leadDays)
    .replaceAll("{activeDay}", schedule.activeDay)
    .replaceAll("{duration}", duration);
}

function addNewsHistory(entry) {
  ensureMarketNewsState();
  const day = Number(entry.day) || Number(state.day) || 1;
  const key = entry.key || [entry.kind || "news", entry.eventId || "", day, entry.activeDay || ""].join(":");
  if (state.newsHistory.some((item) => item.key === key)) return;
  state.newsHistory.unshift({
    key,
    kind: entry.kind || "news",
    eventId: entry.eventId || "",
    label: entry.label || "LOWNET",
    text: entry.text || "",
    day,
    activeDay: Number(entry.activeDay) || null,
    endDay: Number(entry.endDay) || null
  });
  state.newsHistory = state.newsHistory.slice(0, 40);
}

function scheduleMarketForecast() {
  if (!EVENTS.length) return null;
  const event = EVENTS[Math.floor(Math.random() * EVENTS.length)];
  const leadDays = Math.max(2, event.leadDays || 5);
  const duration = Math.max(1, event.duration || 2);
  const schedule = {
    id: makeId("market-event"),
    eventId: event.id,
    announcedDay: Number(state.day) || 1,
    activeDay: (Number(state.day) || 1) + leadDays,
    endDay: (Number(state.day) || 1) + leadDays + duration
  };
  state.marketEventQueue.push(schedule);
  state.nextMarketForecastDay = schedule.endDay + Math.floor(randomBetween(2, 5));
  return schedule;
}

function activeMarketSchedule() {
  return state.marketEventQueue.find((schedule) =>
    marketEventById(schedule.eventId)
    && state.day >= schedule.activeDay
    && state.day < schedule.endDay
  );
}

function updateMarketForDay() {
  ensureMarketNewsState();
  Object.keys(CROPS).forEach((cropId) => {
    state.marketFluctuation[cropId] = randomBetween(0.94, 1.06);
  });
  state.marketSignals = {};
  Object.entries(MARKET_SIGNALS).forEach(([marketId, profile]) => {
    state.marketSignals[marketId] = {
      [profile.axisA]: randomBetween(0.18, 0.94),
      [profile.axisB]: randomBetween(0.18, 0.94)
    };
  });
  applyScheduleMarketSignals();

  state.marketEventQueue = state.marketEventQueue.filter((schedule) =>
    marketEventById(schedule.eventId) && state.day < schedule.endDay + 2
  );

  const activeSchedule = activeMarketSchedule();
  if (activeSchedule) {
    const activeEvent = marketEventById(activeSchedule.eventId);
    state.event = activeEvent;
    state.news = marketEventText(activeEvent.activeText, activeEvent, activeSchedule);
    state.newsLabel = `${activeEvent.label || "ACTIVE"} ${Math.max(1, activeSchedule.endDay - state.day)}D`;
    addNewsHistory({
      kind: "active",
      eventId: activeEvent.id,
      label: activeEvent.label || "MARKET EVENT",
      text: state.news,
      day: state.day,
      activeDay: activeSchedule.activeDay,
      endDay: activeSchedule.endDay
    });
  } else {
    state.event = null;
    const hasFutureEvent = state.marketEventQueue.some((schedule) =>
      marketEventById(schedule.eventId) && state.day < schedule.activeDay
    );
    const forecastSchedule = !hasFutureEvent && state.day >= state.nextMarketForecastDay
      ? scheduleMarketForecast()
      : null;
    if (forecastSchedule) {
      const forecastEvent = marketEventById(forecastSchedule.eventId);
      state.news = marketEventText(forecastEvent.forecastText, forecastEvent, forecastSchedule);
      state.newsLabel = `${forecastEvent.label || "FORECAST"} IN ${forecastSchedule.activeDay - state.day}D`;
      addNewsHistory({
        kind: "forecast",
        eventId: forecastEvent.id,
        label: forecastEvent.label || "FORECAST",
        text: state.news,
        day: state.day,
        activeDay: forecastSchedule.activeDay,
        endDay: forecastSchedule.endDay
      });
    } else {
      state.news = QUIET_NEWS[Math.floor(Math.random() * QUIET_NEWS.length)];
      state.newsLabel = "MARKET STABLE";
      addNewsHistory({
        kind: "quiet",
        label: state.newsLabel,
        text: state.news,
        day: state.day
      });
    }
  }
  if (!isMarketAvailable(selectedMarket)) selectedMarket = "lower";
}

function isMarketAvailable(marketId) {
  return Boolean(MARKETS[marketId] && state.marketUnlocked[marketId]);
}

function progressionValue(key) {
  if (key === "shopUnlocked") return state.shopUnlocked;
  if (key === "marketTabUnlocked") return state.marketTabUnlocked;
  if (key === "brokerUnlocked") return state.brokerUnlocked;
  if (key === "timeUnlocked") return state.timeUnlocked;
  if (key === "revenue") return state.tradeStats?.revenue || 0;
  if (key === "unitsSold") return state.tradeStats?.unitsSold || 0;
  if (key === "money") return state.money || 0;
  if (key === "baseCount") return ownedBases().length;
  if (key.startsWith("marketUnlocked:")) return Boolean(state.marketUnlocked?.[key.split(":")[1]]);
  if (key.startsWith("marketRevenue:")) return state.tradeStats?.byMarket?.[key.split(":")[1]] || 0;
  if (key.startsWith("cropSold:")) return state.tradeStats?.byCrop?.[key.split(":")[1]] || 0;
  if (key.startsWith("unit:")) return unitCount(key.split(":")[1]);
  if (key.startsWith("unitPlaced:")) return allShelves().filter((unit) => unit.type === key.split(":")[1] && unit.placed).length;
  if (key.startsWith("device:")) return allFloorDevices().filter((device) => device.type === key.split(":")[1]).length;
  if (key.startsWith("equipment:")) return Boolean(state.equipment?.[key.split(":")[1]]);
  return 0;
}

function compareRequirement(actual, operator, expectedRaw) {
  const expected = expectedRaw === "true" ? true : expectedRaw === "false" ? false : Number(expectedRaw);
  const value = Number.isFinite(expected) ? Number(actual) : actual;
  if (operator === "=") return value === expected;
  if (operator === ">=") return value >= expected;
  if (operator === "<=") return value <= expected;
  if (operator === ">") return value > expected;
  if (operator === "<") return value < expected;
  return false;
}

function requirementsMet(requirements = []) {
  return requirements.every((requirement) =>
    compareRequirement(progressionValue(requirement.key), requirement.operator, requirement.value)
  );
}

function applyUnlock(rule) {
  state.unlocks[rule.id] = true;
  if (rule.type === "market") state.marketUnlocked[rule.target] = true;
  if (rule.type === "broker") {
    state.brokerUnlocked = true;
    if (!state.propertyListings?.length) state.propertyListings = generatePropertyListings(PROPERTY_LISTING_COUNT);
  }
  if (rule.type === "tab" && rule.target === "shop") state.shopUnlocked = true;
  if (rule.type === "tab" && rule.target === "market") state.marketTabUnlocked = true;
}

function updateProgressionUnlocks({ silent = false } = {}) {
  state.unlocks ||= {};
  const unlockedEvents = [];
  const queuedEvents = new Set();
  UNLOCK_RULES.forEach((rule) => {
    if (state.unlocks[rule.id]) return;
    if (rule.initiallyUnlocked || requirementsMet(rule.requirements)) {
      applyUnlock(rule);
      if (!silent && rule.event && !queuedEvents.has(rule.event)) {
        queuedEvents.add(rule.event);
        unlockedEvents.push({
          event: rule.event,
          context: {
            unlockId: rule.id,
            unlockType: rule.type,
            unlockTarget: rule.target,
            target: rule.target,
            marketId: rule.type === "market" ? rule.target : "",
            itemId: ["shop_item", "seed_item"].includes(rule.type) ? rule.target : "",
            cropId: rule.type === "seed_item" ? rule.target : ""
          }
        });
      }
    }
  });
  if (!silent) {
    unlockedEvents.forEach(({ event, context }) => triggerComms(event, context));
    if (unlockedEvents.length) playSound("unlock_notice", 0.18);
  }
}

function unlockRulesFor(type, target) {
  return UNLOCK_RULES.filter((rule) => rule.type === type && rule.target === target);
}

function isUnlocked(type, target) {
  const rules = unlockRulesFor(type, target);
  if (!rules.length) return true;
  return rules.some((rule) => state.unlocks?.[rule.id]);
}

function unlockHint(type, target, fallback = "Locked") {
  const rule = unlockRulesFor(type, target).find((entry) => !state.unlocks?.[entry.id]);
  return rule?.hint || fallback;
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn(`Save read failed: ${key}`, error);
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn(`Save write failed: ${key}`, error);
    return false;
  }
}

function isUsableSave(value) {
  return Boolean(
    value
    && typeof value === "object"
    && Number.isFinite(Number(value.day))
    && (Array.isArray(value.bases) || Array.isArray(value.shelves))
  );
}

function parseSavedState(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isUsableSave(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

function readSavedGame() {
  const keys = [SAVE_KEY, SAVE_BACKUP_KEY, ...LEGACY_SAVE_KEYS];
  for (const key of keys) {
    const parsed = parseSavedState(safeStorageGet(key));
    if (parsed) return { state: parsed, sourceKey: key };
  }
  return { state: null, sourceKey: null };
}

function saveGame() {
  if (!isUsableSave(state)) return false;
  let serialized;
  try {
    serialized = JSON.stringify(state);
  } catch (error) {
    console.warn("Save serialization failed", error);
    return false;
  }
  const previous = safeStorageGet(SAVE_KEY);
  if (parseSavedState(previous)) safeStorageSet(SAVE_BACKUP_KEY, previous);
  const saved = safeStorageSet(SAVE_KEY, serialized);
  if (saved) safeStorageSet(SAVE_BACKUP_KEY, serialized);
  return saved;
}

function recordStorageKey(mode = "day30") {
  return mode === "free" ? FREE_RECORDS_KEY : DAY30_RECORDS_KEY;
}

function readPlayRecords(mode = "day30") {
  try {
    const raw = safeStorageGet(recordStorageKey(mode));
    const records = raw ? JSON.parse(raw) : [];
    return Array.isArray(records) ? records : [];
  } catch (error) {
    return [];
  }
}

function savePlayRecords(mode = "day30", records = []) {
  safeStorageSet(recordStorageKey(mode), JSON.stringify(records.slice(0, 50)));
}

function readDay30Records() {
  return readPlayRecords("day30");
}

function readFreeRecords() {
  return readPlayRecords("free");
}

function saveDay30Records(records) {
  savePlayRecords("day30", records);
}

function saveFreeRecords(records) {
  savePlayRecords("free", records);
}

function repairPlayableState() {
  let repaired = false;
  state.seeds ||= {};
  Object.keys(CROPS).forEach((cropId) => {
    if (!Number.isFinite(Number(state.seeds[cropId]))) {
      state.seeds[cropId] = 0;
      repaired = true;
    }
  });
  state.inventory ||= [];
  state.inventory = state.inventory.map((item) => ({
    ...item,
    qty: Math.max(0, Number(item.qty) || 0),
    age: Math.max(0, Number(item.age) || 0)
  })).filter((item) => item.qty > 0);
  state.equipment ||= { tanks: 0, filter: false, fridge: false };
  state.resourceRemainders ||= { water: 0, nutrient: 0 };
  state.water = Number.isFinite(Number(state.water)) ? Number(state.water) : 20;
  state.nutrient = Number.isFinite(Number(state.nutrient)) ? Number(state.nutrient) : 20;
  state.nutrientCapacity = Math.max(20, Number.isFinite(Number(state.nutrientCapacity)) ? Number(state.nutrientCapacity) : 20);
  const bases = ownedBases();
  if (repairEquipmentOwnership()) repaired = true;
  const anyEquipment = bases.some((base) => base.shelves.length || base.floorDevices.length);
  const earlyNoProgress = (state.day || 1) <= 2
    && !state.inventory.length
    && !state.tradeStats?.unitsSold
    && !state.tradeStats?.revenue;
  if (!anyEquipment && earlyNoProgress) {
    currentBase().shelves.push(createStarterPod());
    repaired = true;
  }
  const seedTotal = Object.values(state.seeds).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  if (seedTotal <= 0 && earlyNoProgress) {
    state.seeds.lettuce = Math.max(6, Number(state.seeds.lettuce) || 0);
    repaired = true;
  }
  if (repaired) {
    state.log = "Starter kit restored. Place the grow pod and plant lettuce to begin.";
    saveGame();
  }
}

function loadGame() {
  const loaded = readSavedGame();
  state = loaded.state || createInitialState();
  state.commsSeen ||= {};
  state.commsChoices ||= {};
  state.commsOpen ||= [];
  state.unlocks ||= {};
  state.mode ||= "normal";
  state.day30Recorded = Boolean(state.day30Recorded);
  state.day30RecordId ||= null;
  state.supportRobotGranted = Boolean(state.supportRobotGranted);
  state.tradeStats ||= { unitsSold: 0, revenue: 0, byMarket: { lower: 0, medical: 0, upper: 0, rebel: 0 }, byMarketQty: { lower: 0, medical: 0, upper: 0, rebel: 0 }, byCrop: {}, eventRevenue: 0, foodToRebels: 0, weaponsToRebels: 0 };
  state.tradeStats.byMarket ||= { lower: 0, medical: 0, upper: 0, rebel: 0 };
  state.tradeStats.byMarketQty ||= { lower: 0, medical: 0, upper: 0, rebel: 0 };
  ["lower", "medical", "upper", "rebel"].forEach((marketId) => {
    state.tradeStats.byMarket[marketId] ||= 0;
    state.tradeStats.byMarketQty[marketId] ||= 0;
  });
  state.tradeStats.byCrop ||= {};
  state.tradeStats.eventRevenue ||= 0;
  state.tradeStats.foodToRebels ||= 0;
  state.tradeStats.weaponsToRebels ||= 0;
  ensureAnalytics();
  state.marketFluctuation ||= {};
  state.marketSignals ||= {};
  state.audio ||= {};
  state.audio.noiseCanceling = Boolean(state.audio.noiseCanceling);
  ensureSupportAutomationState();
  if (!RADIO_PROGRAMS[state.audio.radioProgram]) state.audio.radioProgram = "off";
  state.marketEventQueue = Array.isArray(state.marketEventQueue) ? state.marketEventQueue : [];
  state.monthlySchedule = ensureMonthlyScheduleBasics(Array.isArray(state.monthlySchedule) && state.monthlySchedule.length ? state.monthlySchedule : generateMonthlySchedule());
  state.newsHistory = Array.isArray(state.newsHistory) ? state.newsHistory : [];
  if (!Number.isFinite(Number(state.nextMarketForecastDay))) {
    state.nextMarketForecastDay = Math.max(3, (Number(state.day) || 1) + 2);
  }
  ownedBases();
  ensureProcurementTags();
  state.marketTabUnlocked = Boolean(state.marketTabUnlocked || state.tradeStats?.unitsSold > 0);
  state.shopUnlocked = Boolean(state.shopUnlocked);
  state.brokerUnlocked = Boolean(state.brokerUnlocked);
  if (state.timeUnlocked === undefined) {
    state.timeUnlocked = Boolean(state.shopUnlocked || state.day > 1 || state.tradeStats?.unitsSold > 0);
  }
  updateProgressionUnlocks({ silent: true });
  repairPlayableState();
  ensureSupportRobotGrant();
  restoreCommsState();
  if (!isMarketAvailable(selectedMarket)) selectedMarket = "lower";
  const hasLegacyImmediateEvent = state.event && !state.marketEventQueue.length;
  if (!state.news || !Object.keys(state.marketSignals).length || hasLegacyImmediateEvent) updateMarketForDay();
  applyScheduleMarketSignals();
  if (loaded.sourceKey && loaded.sourceKey !== SAVE_KEY) saveGame();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeBase(base) {
  base.shelves ||= [];
  base.floorDevices ||= [];
  if (base.tier === "safe_room") base.image = SAFE_ROOM_IMAGE;
  base.allowedUnits = (base.allowedUnits || []).filter((unitId) => GROW_UNITS[unitId]);
  base.shelves = base.shelves.filter((unit) => GROW_UNITS[unit.type]);
  base.floorDevices = base.floorDevices.filter((device) => FLOOR_DEVICES[device.type]);
  base.ownedAt ||= Date.now();
  base.tags ||= pickTagIds(BASE_TAGS, 1);
  base.environment ||= { ...DEFAULT_ENVIRONMENT };
  base.cleanCells ||= [];
  base.description = propertyFlavorDescription(base);
  [...base.shelves, ...base.floorDevices].forEach((item) => {
    item.tags ||= [];
    item.dirt ||= 0;
  });
  base.floorDevices.forEach(ensureSupportRobotProfile);
  return base;
}

function ownedBases() {
  state.bases ||= [];
  if (!state.bases.length) {
    const fallback = state.property || createInitialSafeRoom();
    state.bases.push(normalizeBase({
      ...fallback,
      shelves: state.shelves || [],
      floorDevices: state.floorDevices || []
    }));
    state.activeBaseId = fallback.id;
  }
  state.bases.forEach(normalizeBase);
  if (!state.activeBaseId || !state.bases.some((base) => base.id === state.activeBaseId)) {
    state.activeBaseId = state.bases[0].id;
  }
  selectedBaseId = state.activeBaseId;
  return state.bases;
}

function currentBase() {
  return ownedBases().find((base) => base.id === state.activeBaseId) || ownedBases()[0];
}

function currentShelves() {
  return currentBase().shelves;
}

function currentFloorDevices() {
  return currentBase().floorDevices;
}

function switchBase(baseId) {
  if (!ownedBases().some((base) => base.id === baseId)) return;
  state.activeBaseId = baseId;
  selectedBaseId = baseId;
  selectedUnitId = null;
  selectedDeviceId = null;
  placementSelection = null;
  setStatus(`Active base switched to ${currentBase().name}.`);
  saveGame();
  renderFarm();
  renderHeader();
}

function allShelves() {
  return ownedBases().flatMap((base) => base.shelves.map((shelf) => ({ ...shelf, baseId: base.id })));
}

function allFloorDevices() {
  return ownedBases().flatMap((base) => base.floorDevices.map((device) => ({ ...device, baseId: base.id })));
}

function findOwnedEquipment(kind, id) {
  for (const base of ownedBases()) {
    const collection = kind === "unit" ? base.shelves : base.floorDevices;
    const item = collection.find((entry) => entry.id === id);
    if (item) return { base, collection, item };
  }
  return null;
}

function sharedStockItems() {
  return ownedBases().flatMap((base) => [
    ...base.shelves.filter((item) => !item.placed).map((item) => ({ item, base, kind: "unit" })),
    ...base.floorDevices.filter((item) => !item.placed).map((item) => ({ item, base, kind: "device" }))
  ]);
}

function moveEquipmentToBase(record, targetBase) {
  if (!record || record.base.id === targetBase.id) return record;
  const index = record.collection.indexOf(record.item);
  if (index >= 0) record.collection.splice(index, 1);
  const targetCollection = record.item.type && GROW_UNITS[record.item.type] ? targetBase.shelves : targetBase.floorDevices;
  const duplicateIndex = targetCollection.findIndex((entry) => entry.id === record.item.id);
  if (duplicateIndex >= 0) targetCollection.splice(duplicateIndex, 1);
  targetCollection.push(record.item);
  removeDuplicateEquipmentEntries(record.item.type && GROW_UNITS[record.item.type] ? "unit" : "device", record.item.id, targetBase.id);
  return { base: targetBase, collection: targetCollection, item: record.item };
}

function removeDuplicateEquipmentEntries(kind, id, keepBaseId) {
  ownedBases().forEach((base) => {
    const collection = kind === "unit" ? base.shelves : base.floorDevices;
    for (let index = collection.length - 1; index >= 0; index -= 1) {
      if (collection[index].id === id && base.id !== keepBaseId) collection.splice(index, 1);
    }
  });
}

function repairEquipmentOwnership() {
  let repaired = false;
  ["unit", "device"].forEach((kind) => {
    const seen = new Map();
    ownedBases().forEach((base, baseIndex) => {
      const collection = kind === "unit" ? base.shelves : base.floorDevices;
      collection.forEach((item, itemIndex) => {
        const previous = seen.get(item.id);
        const entry = { base, baseIndex, collection, item, itemIndex };
        if (!previous) {
          seen.set(item.id, entry);
          return;
        }
        const preferCurrent = base.id === state.activeBaseId && previous.base.id !== state.activeBaseId;
        const preferPlaced = Boolean(item.placed) && !previous.item.placed;
        const keep = preferCurrent || (!previous.item.placed && preferPlaced) ? entry : previous;
        const discard = keep === entry ? previous : entry;
        const discardIndex = discard.collection.indexOf(discard.item);
        if (discardIndex >= 0) {
          discard.collection.splice(discardIndex, 1);
          repaired = true;
        }
        seen.set(item.id, keep);
      });
    });
  });
  return repaired;
}

function allPlacedObjects() {
  return [
    ...currentShelves().filter((item) => item.placed).map((item) => ({ ...item, kind: "unit" })),
    ...currentFloorDevices().filter((item) => item.placed).map((item) => ({ ...item, kind: "device" }))
  ];
}

function randomRecordId(record, fallback = "") {
  const ids = Object.keys(record || {});
  if (!ids.length) return fallback;
  return ids[Math.floor(Math.random() * ids.length)] || fallback;
}

function ensureSupportRobotProfile(device) {
  if (!device || device.type !== "support_robot") return device;
  if (!ROBOT_SKILLS[device.robotSkillId]) device.robotSkillId = randomRecordId(ROBOT_SKILLS, "balanced");
  if (!ROBOT_PERSONALITIES[device.robotPersonalityId]) device.robotPersonalityId = randomRecordId(ROBOT_PERSONALITIES, "steady");
  if (!Number.isFinite(Number(device.supportEnergy))) device.supportEnergy = SUPPORT_ROBOT_MAX_ENERGY;
  const legacyCooldown = Number.isFinite(Number(device.supportCooldown)) ? Number(device.supportCooldown) : 0;
  const previousCooldowns = device.supportTaskCooldowns || {};
  device.supportTaskCooldowns = {};
  SUPPORT_TASKS.forEach((task) => {
    const value = Number(previousCooldowns[task]);
    device.supportTaskCooldowns[task] = Number.isFinite(value) ? Math.max(0, value) : Math.max(0, legacyCooldown);
  });
  device.supportCooldown = Math.max(0, ...Object.values(device.supportTaskCooldowns));
  const harvestSource = device.harvestAutomation || device.automation?.harvest || {};
  device.harvestAutomation = {
    enabled: harvestSource.enabled !== false
  };
  const plantingSource = device.plantingAutomation || device.automation?.planting || {};
  device.plantingAutomation = {
    enabled: Boolean(plantingSource.enabled),
    cropId: CROPS[plantingSource.cropId] ? plantingSource.cropId : "lettuce"
  };
  return device;
}

function createFloorDevice(type) {
  const device = { id: makeId("device"), type, placed: false, x: null, y: null, tags: unitTags(type), dirt: 0 };
  ensureSupportRobotProfile(device);
  return device;
}

function normalizedCropAutomationEntry(source = {}, defaults = {}) {
  return {
    enabled: Boolean(source.enabled),
    packs: Math.max(1, Math.min(12, Math.round(Number(source.packs ?? defaults.packs ?? 1))))
  };
}

function normalizedShipAutomationEntry(source = {}, defaults = {}) {
  const marketId = MARKETS[source.marketId] ? source.marketId : (MARKETS[defaults.marketId] ? defaults.marketId : "lower");
  return {
    enabled: Boolean(source.enabled),
    marketId,
    qty: Math.max(1, Math.min(99, Math.round(Number(source.qty ?? defaults.qty ?? 1))))
  };
}

function ensureSupportAutomationState() {
  const previous = state.automation || {};
  const legacyProcCrop = CROPS[previous.procurement?.cropId] ? previous.procurement.cropId : "lettuce";
  const legacyShipCrop = CROPS[previous.shipping?.cropId] ? previous.shipping.cropId : "lettuce";
  state.supportOS = {
    harvest: Boolean(state.supportOS?.harvest),
    planting: Boolean(state.supportOS?.planting),
    cleaning: Boolean(state.supportOS?.cleaning)
  };
  state.automation = {
    procurement: {
      selectedCropId: CROPS[previous.procurement?.selectedCropId] ? previous.procurement.selectedCropId : legacyProcCrop,
      byCrop: {}
    },
    planting: {
      enabled: Boolean(previous.planting?.enabled),
      cropId: CROPS[previous.planting?.cropId] ? previous.planting.cropId : legacyProcCrop
    },
    shipping: {
      selectedCropId: CROPS[previous.shipping?.selectedCropId] ? previous.shipping.selectedCropId : legacyShipCrop,
      byCrop: {}
    }
  };
  Object.keys(CROPS).forEach((cropId) => {
    const procSource = previous.procurement?.byCrop?.[cropId]
      || (cropId === legacyProcCrop ? previous.procurement : {});
    state.automation.procurement.byCrop[cropId] = normalizedCropAutomationEntry(procSource, { packs: 1 });
    const shipSource = previous.shipping?.byCrop?.[cropId]
      || (cropId === legacyShipCrop ? previous.shipping : {});
    state.automation.shipping.byCrop[cropId] = normalizedShipAutomationEntry(shipSource, { marketId: "lower", qty: 1 });
  });
  if (state.bases) {
    const legacyPlanting = previous.planting || {};
    const legacyPlantingCropId = CROPS[legacyPlanting.cropId] ? legacyPlanting.cropId : legacyProcCrop;
    state.bases.forEach((base) => base.floorDevices?.forEach((device) => {
      ensureSupportRobotProfile(device);
      if (device.type === "support_robot" && legacyPlanting.enabled && !device.plantingAutomation.enabled) {
        device.plantingAutomation = { enabled: true, cropId: legacyPlantingCropId };
      }
    }));
  }
}
function supportRobotSkill(device) {
  ensureSupportRobotProfile(device);
  return ROBOT_SKILLS[device.robotSkillId] || ROBOT_SKILLS.balanced || { name: "Balanced", harvest: "B", plant: "B", cleaning: "B", procure: "B", ship: "B" };
}

function supportRobotPersonality(device) {
  ensureSupportRobotProfile(device);
  return ROBOT_PERSONALITIES[device.robotPersonalityId] || ROBOT_PERSONALITIES.steady || { name: "Steady", rangeMod: 1, fuelMod: 1, speedMod: 1 };
}

function supportTaskGrade(device, task) {
  return String(supportRobotSkill(device)[task] || "B").toUpperCase();
}

function supportTaskMultiplier(device, task) {
  return SUPPORT_GRADE_MULTIPLIER[supportTaskGrade(device, task)] || 1;
}

function supportRobotRange(device) {
  const baseRange = Number(FLOOR_DEVICES.support_robot?.radius) || SUPPORT_ROBOT_DEFAULT_RANGE;
  const personality = supportRobotPersonality(device);
  return Math.max(1, Math.round(baseRange * (Number(personality.rangeMod) || 1)));
}

function supportRobotCooldownDays(device, task) {
  const personality = supportRobotPersonality(device);
  const speed = (Number(personality.speedMod) || 1) * supportTaskMultiplier(device, task);
  return (SUPPORT_TASK_BASE_COOLDOWN[task] || 0.08) / Math.max(0.25, speed);
}

function supportRobotEnergyCost(device, task) {
  const personality = supportRobotPersonality(device);
  const grade = supportTaskMultiplier(device, task);
  return Math.max(1, (SUPPORT_TASK_BASE_COST[task] || 4) * (Number(personality.fuelMod) || 1) / Math.max(0.45, grade));
}

function itemGridCenter(item, kind) {
  const size = footprint({ ...item, kind });
  return { x: item.x + (size.width - 1) / 2, y: item.y + (size.height - 1) / 2 };
}

function supportRobotCanReach(robot, item, kind) {
  if (!robot?.placed || !item?.placed) return false;
  const center = itemGridCenter(item, kind);
  return Math.max(Math.abs(center.x - robot.x), Math.abs(center.y - robot.y)) <= supportRobotRange(robot);
}

function refreshSupportRobotCooldown(robot) {
  ensureSupportRobotProfile(robot);
  robot.supportCooldown = Math.max(0, ...Object.values(robot.supportTaskCooldowns || {}));
}

function tickSupportRobotCooldowns(robot, deltaDays) {
  ensureSupportRobotProfile(robot);
  SUPPORT_TASKS.forEach((task) => {
    robot.supportTaskCooldowns[task] = Math.max(0, (Number(robot.supportTaskCooldowns[task]) || 0) - deltaDays);
  });
  refreshSupportRobotCooldown(robot);
}

function supportRobotTaskReady(robot, task) {
  ensureSupportRobotProfile(robot);
  return (Number(robot.supportCooldown) || 0) <= 0
    && (Number(robot.supportTaskCooldowns?.[task]) || 0) <= 0
    && (Number(robot.supportEnergy) || 0) >= SUPPORT_ROBOT_MIN_ENERGY
    && (Number(robot.supportEnergy) || 0) >= supportRobotEnergyCost(robot, task);
}

function spendSupportRobotAction(robot, task) {
  ensureSupportRobotProfile(robot);
  robot.supportEnergy = Math.max(0, (Number(robot.supportEnergy) || 0) - supportRobotEnergyCost(robot, task));
  const cooldown = supportRobotCooldownDays(robot, task);
  SUPPORT_TASKS.forEach((entryTask) => {
    robot.supportTaskCooldowns[entryTask] = cooldown;
  });
  refreshSupportRobotCooldown(robot);
}

function supportRobotExists() {
  return ownedBases().some((base) => base.floorDevices?.some((device) => device.type === "support_robot"));
}


function hasAnySupportOS() {
  return Boolean(state.supportOS?.harvest || state.supportOS?.planting || state.supportOS?.cleaning);
}

function findSupportRobotById(robotId) {
  for (const base of ownedBases()) {
    const robot = base.floorDevices?.find((device) => device.id === robotId && device.type === "support_robot");
    if (robot) return robot;
  }
  return null;
}

function preferredSupportRobotPosition(base, item) {
  const candidates = [
    { x: Math.min(base.cols - 1, 2), y: Math.min(base.rows - 1, 1) },
    { x: Math.min(base.cols - 1, 2), y: 0 },
    { x: Math.min(base.cols - 1, 1), y: Math.min(base.rows - 1, 1) },
    { x: base.cols - 1, y: base.rows - 1 }
  ];
  for (const pos of candidates) {
    if (pos.x >= 0 && pos.y >= 0 && canPlace(item, pos.x, pos.y, item.id)) return pos;
  }
  return firstAvailablePosition(item);
}

function hasCompletedCommsTrigger(trigger) {
  return COMM_EVENTS.some((event) => event.trigger === trigger && state.commsChoices?.[event.id]);
}

function grantFloorDevice(type) {
  if (!FLOOR_DEVICES[type]) return false;
  if (type === "support_robot") {
    if (supportRobotExists()) {
      state.supportRobotGranted = true;
      return false;
    }
    state.supportRobotGranted = true;
  }
  const device = createFloorDevice(type);
  currentFloorDevices().push(device);
  const item = { ...device, kind: "device" };
  const position = preferredSupportRobotPosition(currentBase(), item);
  if (position) Object.assign(device, position, { placed: true });
  selectedDeviceId = null;
  placementSelection = null;
  return true;
}

function ensureSupportRobotGrant() {
  if (!state.supportRobotGranted && hasCompletedCommsTrigger("first_place") && grantFloorDevice("support_robot")) saveGame();
}

function footprint(item) {
  const definition = item.kind === "device" || FLOOR_DEVICES[item.type]
    ? FLOOR_DEVICES[item.type]
    : GROW_UNITS[item.type];
  return { width: definition.width, height: definition.height };
}

function equipmentVisualDepth(item, kind) {
  const size = footprint({ ...item, kind });
  const anchorX = item.x + (size.width - 1) / 2;
  const anchorY = item.y + size.height - 1;
  const footprintBias = Math.max(0, size.width - 1) * 0.35;
  return Math.round((anchorX + anchorY) * 100 + anchorY * 10 - footprintBias);
}

function canPlace(item, x, y, ignoreId = null) {
  const base = currentBase();
  const size = footprint(item);
  if (x < 0 || y < 0 || x + size.width > base.cols || y + size.height > base.rows) return false;
  for (let offsetY = 0; offsetY < size.height; offsetY += 1) {
    for (let offsetX = 0; offsetX < size.width; offsetX += 1) {
      if (isBlockedCell(base, x + offsetX, y + offsetY)) return false;
    }
  }
  return !allPlacedObjects().some((placed) => {
    if (placed.id === ignoreId) return false;
    const other = footprint(placed);
    return x < placed.x + other.width
      && x + size.width > placed.x
      && y < placed.y + other.height
      && y + size.height > placed.y;
  });
}

function firstAvailablePosition(item) {
  const base = currentBase();
  const size = footprint(item);
  for (let y = 0; y <= base.rows - size.height; y += 1) {
    for (let x = 0; x <= base.cols - size.width; x += 1) {
      if (canPlace(item, x, y, item.id)) return { x, y };
    }
  }
  return null;
}

function migrateLegacyPlacements() {
  [...currentShelves(), ...currentFloorDevices()].forEach((item) => {
    const needsMigration = item.needsPlacementMigration;
    delete item.needsPlacementMigration;
    if (!needsMigration) return;
    if (item.placed && canPlace(item, item.x, item.y, item.id)) return;
    item.placed = false;
    item.x = null;
    item.y = null;
    const position = firstAvailablePosition(item);
    if (position) Object.assign(item, position, { placed: true });
  });
}

function enforceBaseRestrictions() {
  currentShelves().forEach((unit) => {
    if (unit.placed && !canPlace({ ...unit, kind: "unit" }, unit.x, unit.y, unit.id)) {
      unit.placed = false;
      unit.x = null;
      unit.y = null;
    }
  });
  currentFloorDevices().forEach((device) => {
    if (device.placed && !canPlace({ ...device, kind: "device" }, device.x, device.y, device.id)) {
      device.placed = false;
      device.x = null;
      device.y = null;
    }
  });
}

function getUnitEffects(unit) {
  if (!unit.placed) return { light: false, fan: false };
  const size = footprint(unit);
  const centerX = unit.x + (size.width - 1) / 2;
  const centerY = unit.y + (size.height - 1) / 2;
  const base = ownedBases().find((entry) => entry.shelves.some((shelf) => shelf.id === unit.id)) || currentBase();
  const affected = (type) => base.floorDevices.some((device) => {
    if (!device.placed || device.type !== type) return false;
    const radius = FLOOR_DEVICES[type].radius;
    return Math.max(Math.abs(centerX - device.x), Math.abs(centerY - device.y)) <= radius;
  });
  return { light: affected("light"), fan: affected("fan") };
}

function unitTagEffects(unit) {
  return combinedEffects(unit.tags || [], EQUIPMENT_TAGS);
}

function baseTagEffects(base) {
  return combinedEffects(base.tags || [], BASE_TAGS);
}

function dirtyEfficiency(item) {
  const dirt = item.dirt || 0;
  if (dirt < 45) return 1;
  return Math.max(0.68, 1 - (dirt - 45) / 170);
}

function environmentScore(cropId, base) {
  const target = CROP_ENVIRONMENT[cropId] || DEFAULT_ENVIRONMENT;
  const env = base.environment || DEFAULT_ENVIRONMENT;
  const baseEffects = baseTagEffects(base);
  const co2Tolerance = baseEffects.co2Tolerance || 1;
  const tempPenalty = Math.abs(env.temp - target.temp) / 18;
  const humidityPenalty = Math.abs(env.humidity - target.humidity) / 70;
  const co2Penalty = Math.abs(env.co2 - target.co2) / (900 * co2Tolerance);
  const score = 1 - (tempPenalty + humidityPenalty + co2Penalty) / 3;
  return Math.max(0.85, Math.min(1.12, 0.92 + score * 0.18));
}

function cropBaseTagGrowth(cropId, base) {
  const crop = CROPS[cropId];
  const effects = baseTagEffects(base);
  let mod = 1;
  if (["lettuce", "spinach", "basil"].includes(cropId)) mod *= effects.leafGrowth || 1;
  if (crop.category === "luxury" || cropId === "tomato") mod *= effects.fruitGrowth || 1;
  if (crop.category === "medical") mod *= effects.herbGrowth || 1;
  return mod;
}

function unitPerformance(unit, cropId, base) {
  const effects = unitTagEffects(unit);
  const baseEffects = baseTagEffects(base);
  return {
    growth: (effects.growthMod || 1) * dirtyEfficiency(unit) * environmentScore(cropId, base) * cropBaseTagGrowth(cropId, base),
    water: (effects.waterMod || 1) * (baseEffects.waterMod || 1),
    nutrient: effects.nutrientMod || 1,
    upkeep: effects.upkeepMod || 1,
    dirt: (effects.dirtMod || 1) * (baseEffects.dirtMod || 1),
    qualityBonus: (effects.qualityBonus || 0) + (baseEffects.herbQuality && CROPS[cropId]?.category === "medical" ? baseEffects.herbQuality : 0)
  };
}

function formatNumber(value) {
  return Math.round(value).toLocaleString("ja-JP");
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cropEventMultiplier(cropId) {
  if (!state.event) return 1;
  return (state.event.allCropMod || 1) * ((state.event.cropMods && state.event.cropMods[cropId]) || 1);
}

function cropPrimaryMarket(cropId) {
  return CROPS[cropId]?.primaryMarket || CROPS[cropId]?.unlock || "lower";
}

function isMarketSpecialty(cropId, marketId) {
  return cropPrimaryMarket(cropId) === marketId;
}

function cropDemandMultiplier(cropId, marketId = selectedMarket) {
  const profile = MARKET_SIGNALS[marketId];
  const response = CROP_MARKET_RESPONSE[marketId]?.[cropId];
  if (!profile || !response || !isMarketSpecialty(cropId, marketId)) return 1;
  const signals = state.marketSignals?.[marketId] || {};
  const axisA = signals[profile.axisA] ?? 0.5;
  const axisB = signals[profile.axisB] ?? 0.5;
  const sharedHigh = Math.max(0, Math.min(axisA, axisB) - 0.5) * 2;
  const multiplier = 1
    + (axisA - 0.5) * response.axisAWeight
    + (axisB - 0.5) * response.axisBWeight
    + sharedHigh * response.synergy;
  return clamp(multiplier, response.minMultiplier, response.maxMultiplier);
}

function cropDemandNote(cropId, marketId = selectedMarket) {
  if (!isMarketSpecialty(cropId, marketId)) {
    if (marketId === "rebel") return "下層市場基準の1.5倍で固定";
    if (marketId !== "medical" && marketId !== "lower") return "下層市場基準の半額で固定";
    if (marketId === "medical") return "医療需要の影響なし";
  }
  const note = CROP_MARKET_RESPONSE[marketId]?.[cropId]?.note || "";
  return scheduleCropEventMultiplier(cropId, marketId) > 1
    ? (note ? `${note} / LOWNET噂補正` : "LOWNET噂補正")
    : note;
}


function scheduleClampDay(day) {
  return Math.max(1, Math.min(SCHEDULE_DAYS, Math.round(Number(day) || 1)));
}

function scheduleJitterDay(day, range = 2) {
  return scheduleClampDay(day + Math.floor(Math.random() * (range * 2 + 1)) - range);
}

function scheduleRumorDefinitions(type = "basic") {
  return SCHEDULE_RUMORS.filter((entry) => (entry.type || "basic") === type);
}

function scheduleDefinition(entryId) {
  return SCHEDULE_RUMORS.find((entry) => entry.id === entryId) || null;
}

function normalizeScheduleEntry(entry = {}) {
  const definition = scheduleDefinition(entry.id);
  const merged = definition ? { ...entry, ...definition } : { ...entry };
  if (definition && (definition.type || "basic") === "rare" && Number.isFinite(Number(entry.startDay))) {
    merged.startDay = Number(entry.startDay);
  }
  merged.type ||= "basic";
  merged.axes = Array.isArray(merged.axes) ? merged.axes : toList(merged.axes || merged.axis);
  merged.cropIds = Array.isArray(merged.cropIds) ? merged.cropIds : toList(merged.cropIds || merged.crops || merged.cropId);
  merged.startDay = scheduleClampDay(merged.startDay);
  merged.duration = Math.max(1, Math.round(Number(merged.duration) || 1));
  merged.chance = Number.isFinite(Number(merged.chance)) ? Number(merged.chance) : (merged.type === "rare" ? 0.45 : 1);
  merged.jitter = Math.max(0, Math.round(Number(merged.jitter) || 0));
  merged.signalBoost = Number.isFinite(Number(merged.signalBoost)) ? Number(merged.signalBoost) : 0;
  merged.priceBoost = Number.isFinite(Number(merged.priceBoost)) ? Number(merged.priceBoost) : 0;
  return merged;
}

function ensureMonthlyScheduleBasics(schedule = []) {
  const knownIds = new Set(SCHEDULE_RUMORS.map((entry) => entry.id));
  const entries = (Array.isArray(schedule) ? schedule : [])
    .map(normalizeScheduleEntry)
    .filter((entry) => entry.id && knownIds.has(entry.id));
  const seen = new Set(entries.map((entry) => entry.id));
  scheduleRumorDefinitions("basic").forEach((entry) => {
    if (!seen.has(entry.id)) entries.push(normalizeScheduleEntry({ ...entry, certainty: "known" }));
  });
  return entries.sort((a, b) => a.startDay - b.startDay || String(a.id).localeCompare(String(b.id)));
}

function generateMonthlySchedule() {
  const entries = scheduleRumorDefinitions("basic").map((entry) => normalizeScheduleEntry({ ...entry, certainty: "known" }));
  scheduleRumorDefinitions("rare").forEach((entry) => {
    const chance = Number.isFinite(Number(entry.chance)) ? Number(entry.chance) : 0.45;
    if (Math.random() < chance) {
      entries.push(normalizeScheduleEntry({ ...entry, startDay: scheduleJitterDay(entry.startDay, entry.jitter || 2), certainty: "rumor" }));
    }
  });
  if (entries.length > 5 && !entries.some((entry, index) => entries.some((other, otherIndex) => otherIndex !== index && scheduleEntryDays(other).includes(entry.startDay)))) {
    entries[entries.length - 1].startDay = entries[1].startDay;
  }
  return ensureMonthlyScheduleBasics(entries);
}

function scheduleEntryDays(entry) {
  return Array.from({ length: Math.max(1, Number(entry.duration) || 1) }, (_, index) => Number(entry.startDay) + index).filter((day) => day >= 1 && day <= SCHEDULE_DAYS);
}

function scheduleEntriesForDay(day) {
  return (state.monthlySchedule || []).map(normalizeScheduleEntry).filter((entry) => scheduleEntryDays(entry).includes(day));
}

function scheduleSignalBoost(entry) {
  if (Number(entry.signalBoost) > 0) return clamp(Number(entry.signalBoost), 0, 1);
  if (entry.strength === "rare") return 0.94;
  if (entry.strength === "high") return 0.9;
  return 0.84;
}

function schedulePriceBoost(entry) {
  if (Number(entry.priceBoost) > 0) return Math.max(1, Number(entry.priceBoost));
  if (entry.strength === "rare") return 1.65;
  if (entry.strength === "high") return 1.8;
  return 1.55;
}

function scheduleCropEventMultiplier(cropId, marketId = selectedMarket) {
  return activeScheduleEntries()
    .filter((entry) => entry.marketId === marketId && scheduleCropIds(entry).includes(cropId))
    .reduce((multiplier, entry) => Math.max(multiplier, schedulePriceBoost(entry)), 1);
}

function activeScheduleEntries(day = state.day) {
  return scheduleEntriesForDay(Number(day) || 1);
}

function applyScheduleMarketSignals() {
  const activeEntries = activeScheduleEntries();
  const targetedAxesByMarket = new Map();
  activeEntries.forEach((entry) => {
    const signals = state.marketSignals?.[entry.marketId];
    if (!signals) return;
    const boost = scheduleSignalBoost(entry);
    const targetedAxes = targetedAxesByMarket.get(entry.marketId) || new Set();
    scheduleAxisList(entry).forEach((axis) => {
      if (!axis || !(axis in signals)) return;
      targetedAxes.add(axis);
      signals[axis] = clamp(Math.max(Number(signals[axis]) || 0, boost), 0, 0.98);
    });
    targetedAxesByMarket.set(entry.marketId, targetedAxes);
  });

  targetedAxesByMarket.forEach((targetedAxes, marketId) => {
    const profile = MARKET_SIGNALS[marketId];
    const signals = state.marketSignals?.[marketId];
    if (!profile || !signals) return;
    [profile.axisA, profile.axisB].forEach((axis) => {
      if (!axis || targetedAxes.has(axis) || !(axis in signals)) return;
      signals[axis] = clamp(Math.min(Number(signals[axis]) || 0, SCHEDULE_NON_TARGET_SIGNAL_CAP), 0, 1);
    });
  });
}

function scheduleAxisList(entry) {
  return Array.isArray(entry?.axes) ? entry.axes : toList(entry?.axes || entry?.axis);
}

function scheduleCropIds(entry) {
  return Array.isArray(entry?.cropIds) ? entry.cropIds : toList(entry?.cropIds || entry?.crops || entry?.cropId);
}

function marketAxisLabels(marketId, axes) {
  const profile = MARKET_SIGNALS[marketId];
  return toList(axes).map((axis) => {
    if (!profile) return axis || "---";
    if (profile.axisA === axis) return profile.axisALabel;
    if (profile.axisB === axis) return profile.axisBLabel;
    return axis || "---";
  }).filter(Boolean);
}

function marketAxisLabel(marketId, axis) {
  return marketAxisLabels(marketId, axis).join(" / ") || "---";
}

function scheduleCropLabel(entry) {
  const names = scheduleCropIds(entry).map((cropId) => CROPS[cropId]?.name || cropId).filter(Boolean);
  return names.length ? names.join(" / ") : "---";
}

function scheduleMarketLabel(entry) {
  return MARKETS[entry.marketId]?.name || entry.marketId || "---";
}

function scheduleStrengthLabel(strength) {
  if (strength === "rare") return "RARE";
  if (strength === "high") return "HIGH";
  return "WATCH";
}


function findScheduleEntry(entryId) {
  const entry = (state.monthlySchedule || []).find((candidate) => candidate.id === entryId) || null;
  return entry ? normalizeScheduleEntry(entry) : null;
}

function scheduleDayRange(entry) {
  const endDay = Number(entry.startDay) + Math.max(1, Number(entry.duration) || 1) - 1;
  return "DAY " + String(entry.startDay).padStart(2, "0") + (endDay !== Number(entry.startDay) ? "-" + String(endDay).padStart(2, "0") : "");
}

function scheduleDetailMarkup(entry) {
  const axisLabel = marketAxisLabel(entry.marketId, scheduleAxisList(entry));
  return '<div class="schedule-detail-card ' + (entry.strength || 'mid') + '">'
    + '<div class="schedule-detail-meta"><span>' + escapeHtml(scheduleDayRange(entry)) + '</span><strong>' + escapeHtml(scheduleStrengthLabel(entry.strength)) + '</strong></div>'
    + '<p class="schedule-detail-rumor">' + escapeHtml(entry.rumor) + '</p>'
    + '<dl><dt>CROP</dt><dd>' + escapeHtml(scheduleCropLabel(entry)) + '</dd><dt>MARKET</dt><dd>' + escapeHtml(scheduleMarketLabel(entry)) + '</dd><dt>SIGNAL</dt><dd>' + escapeHtml(axisLabel) + '</dd></dl>'
    + '<blockquote>' + escapeHtml(entry.comment) + '</blockquote>'
    + '</div>';
}

function showScheduleEntryDetail(entryId, sourceElement = null) {
  const entry = findScheduleEntry(entryId);
  if (!entry) return;
  if (sourceElement) {
    sourceElement.classList.remove("schedule-chip-pulse");
    void sourceElement.offsetWidth;
    sourceElement.classList.add("schedule-chip-pulse");
  }
  playSound("tab_switch", 0.12);
  window.setTimeout(() => {
    showModal("LOWNET RUMOR", entry.title, scheduleDetailMarkup(entry), true);
    document.getElementById("modal-reset").style.display = "none";
  }, 170);
}

function rerollMonthlySchedule() {
  if (state.money < SCHEDULE_REROLL_COST) {
    toast("Credits insufficient for reinvestigation.", "warning");
    rejectFeedback();
    return;
  }
  state.money -= SCHEDULE_REROLL_COST;
  state.monthlySchedule = generateMonthlySchedule();
  applyScheduleMarketSignals();
  state.log = "LOWNET rumors reinvestigated. Monthly schedule updated.";
  playSound("market_select", 0.22);
  saveGame();
  render();
}

function requestScheduleReroll() {
  openConfirmWidget({
    kicker: "LOWNET RECHECK",
    title: "\u518d\u8abf\u67fb",
    copy: "\u20a1" + SCHEDULE_REROLL_COST + "\u3092\u652f\u6255\u3044\u3001\u6708\u9593\u30b9\u30b1\u30b8\u30e5\u30fc\u30eb\u306e\u5642\u3092\u518d\u8abf\u67fb\u3057\u307e\u3059\u3002",
    confirmText: "\u518d\u8abf\u67fb",
    onConfirm: rerollMonthlySchedule
  });
}
function renderSchedule() {
  const calendar = document.getElementById("schedule-calendar");
  const list = document.getElementById("schedule-briefing-list");
  const summary = document.getElementById("schedule-summary");
  if (!calendar || !list) return;
  state.monthlySchedule = ensureMonthlyScheduleBasics(Array.isArray(state.monthlySchedule) && state.monthlySchedule.length ? state.monthlySchedule : generateMonthlySchedule());
  const entries = state.monthlySchedule;
  const rareCount = entries.filter((entry) => entry.strength === "rare").length;
  if (summary) summary.innerHTML = '<span>RUMORS</span><strong>' + entries.length + '</strong><span>RARE</span><strong>' + rareCount + '</strong><button class="secondary-button schedule-reroll-button" data-reroll-schedule type="button" ' + (state.money < SCHEDULE_REROLL_COST ? 'disabled' : '') + '>\u518d\u8abf\u67fb \u20a1' + SCHEDULE_REROLL_COST + '</button>';
  calendar.innerHTML = Array.from({ length: SCHEDULE_DAYS }, (_, index) => {
    const day = index + 1;
    const dayEntries = scheduleEntriesForDay(day);
    const isToday = day === Math.min(SCHEDULE_DAYS, Math.max(1, Number(state.day) || 1));
    const isPast = day < (Number(state.day) || 1);
    const dayClass = 'schedule-day ' + (isToday ? 'today ' : '') + (isPast ? 'past ' : '') + (dayEntries.length ? 'has-rumor' : '');
    const chips = dayEntries.map((entry) => '<button class="schedule-chip ' + (entry.strength || 'mid') + '" data-schedule-entry="' + escapeHtml(entry.id) + '" type="button">' + escapeHtml(scheduleStrengthLabel(entry.strength)) + ' // ' + escapeHtml(scheduleCropLabel(entry)) + '</button>').join('');
    return '<article class="' + dayClass.trim() + '"><header><span>DAY</span><strong>' + String(day).padStart(2, "0") + '</strong></header><div class="schedule-day-events">' + chips + '</div></article>';
  }).join('');
  list.innerHTML = entries.map((entry) => {
    const axisLabel = marketAxisLabel(entry.marketId, scheduleAxisList(entry));
    const endDay = Number(entry.startDay) + Math.max(1, Number(entry.duration) || 1) - 1;
    const dayRange = 'DAY ' + String(entry.startDay).padStart(2, "0") + (endDay !== Number(entry.startDay) ? '-' + String(endDay).padStart(2, "0") : '');
    return '<article class="schedule-note ' + (entry.strength || 'mid') + '" id="schedule-' + escapeHtml(entry.id) + '"><div class="schedule-note-head"><span>' + dayRange + '</span><strong>' + escapeHtml(scheduleStrengthLabel(entry.strength)) + '</strong></div><h3>' + escapeHtml(entry.title) + '</h3><p>' + escapeHtml(entry.rumor) + '</p><small>' + escapeHtml(scheduleCropLabel(entry)) + ' // ' + escapeHtml(scheduleMarketLabel(entry)) + ' // ' + escapeHtml(axisLabel) + '</small><blockquote>' + escapeHtml(entry.comment) + '</blockquote></article>';
  }).join('');
}
function baseMarketUnitPrice(batch, marketId = selectedMarket, options = {}) {
  const crop = CROPS[batch.crop];
  const quality = QUALITY[batch.quality];
  let price = crop.basePrice
    * quality.multiplier
    * (MARKETS[marketId].multipliers[batch.crop] || 0.4)
    * state.marketFluctuation[batch.crop]
    * (options.ignoreDemand ? 1 : cropDemandMultiplier(batch.crop, marketId))
    * (options.ignoreDemand ? 1 : scheduleCropEventMultiplier(batch.crop, marketId))
    * cropEventMultiplier(batch.crop);

  if (batch.degraded) price *= 0.5;
  if (marketId === "upper" && batch.quality === "C") price *= 0.65;
  if (state.event && state.event.fee) price *= (1 - state.event.fee);
  return price;
}

function lowerMarketReferencePrice(batch) {
  return baseMarketUnitPrice(batch, "lower");
}

function getUnitPrice(batch, marketId = selectedMarket) {
  let price;
  if (marketId !== "medical" && marketId !== "lower" && !isMarketSpecialty(batch.crop, marketId)) {
    price = lowerMarketReferencePrice(batch) * (marketId === "rebel" ? 1.5 : 0.5);
  } else {
    price = baseMarketUnitPrice(batch, marketId);
  }
  return Math.max(1, Math.round(price));
}

function getQuote(cropId, marketId = selectedMarket) {
  return getUnitPrice({ crop: cropId, quality: "B", degraded: false }, marketId);
}

function bestAvailableQuote(cropOrBatch) {
  const batch = typeof cropOrBatch === "string"
    ? { crop: cropOrBatch, quality: "B", degraded: false }
    : cropOrBatch;
  if (!batch?.crop) return 1;
  const prices = Object.keys(MARKETS)
    .filter((marketId) => isMarketAvailable(marketId) && MARKETS[marketId]?.accepts?.includes(batch.crop))
    .map((marketId) => getUnitPrice(batch, marketId));
  return Math.max(1, ...prices);
}

function unitCount(type) {
  return ownedBases().reduce((sum, base) => sum + base.shelves.filter((unit) => unit.type === type).length, 0);
}

function growUnitPrice(type) {
  const definition = GROW_UNITS[type];
  const escalation = type === "pod" ? 10 : type === "box" ? 40 : 150;
  return definition.price + unitCount(type) * escalation;
}

function totalGrowSlots() {
  return ownedBases().reduce((sum, base) => sum + base.shelves.reduce((unitSum, unit) => unitSum + unit.slots.length, 0), 0);
}

function waterPackPrice() {
  const eventMod = state.event && state.event.waterCostMod ? state.event.waterCostMod : 1;
  const filterMod = state.equipment.filter ? 0.75 : 1;
  return Math.round(20 * eventMod * filterMod);
}

function dailyUpkeep() {
  return ownedBases().reduce((total, base) => {
    const leds = base.shelves.filter((shelf) => shelf.led).length;
    const fans = base.shelves.filter((shelf) => shelf.fan).length;
    const baseEffects = baseTagEffects(base);
    const units = base.shelves.reduce((sum, unit) => {
      const definition = GROW_UNITS[unit.type];
      return sum + (definition ? definition.upkeep * (unitTagEffects(unit).upkeepMod || 1) : 0);
    }, 0);
    const floorDevices = base.floorDevices.reduce((sum, device) =>
      sum + FLOOR_DEVICES[device.type].upkeep * (unitTagEffects(device).upkeepMod || 1) * (baseEffects.deviceUpkeepMod || 1), 0);
    return total + Math.round(units + floorDevices + leds * 5 + fans * 3 + (base.upkeep || 0));
  }, 0);
}

function activePlants() {
  return ownedBases().flatMap((base) =>
    base.shelves.flatMap((shelf, shelfIndex) =>
      shelf.slots
        .map((plant, slotIndex) => plant ? { plant, shelf, shelfIndex, slotIndex, baseId: base.id } : null)
        .filter(Boolean)
    )
  );
}

function currentActivePlants() {
  return activePlants().filter((entry) => entry.baseId === currentBase().id);
}

function facilityMoodClasses(base) {
  const env = base.environment || DEFAULT_ENVIRONMENT;
  const classes = [];
  if (env.humidity >= 68) classes.push("humid-air");
  if (env.humidity <= 45) classes.push("dry-air");
  if (env.temp >= 28) classes.push("warm-air");
  if (env.temp <= 20) classes.push("cold-air");
  if (env.co2 >= 850) classes.push("rich-co2");
  return classes.join(" ");
}

function plantStageClass(unit) {
  const plants = unit.slots.filter(Boolean);
  if (!plants.length) return "stage-empty";
  if (plants.some((plant) => plant.dead)) return "stage-dead";
  const stage = unitGrowthStage(unit);
  if (plants.some((plant) => plant.ready)) return `stage-ready stage-${stage}`;
  return `stage-${stage}`;
}

function unitGrowthStage(unit) {
  const plants = unit.slots.filter(Boolean);
  if (!plants.length) return 0;
  if (plants.some((plant) => plant.ready)) return 5;
  const average = plants.reduce((sum, plant) => sum + plant.growth / CROPS[plant.crop].days, 0) / plants.length;
  return growthStageIndex(average);
}

function unitPrimaryCrop(unit) {
  const summary = unit.slots.filter(Boolean).reduce((entries, plant) => {
    const crop = CROPS[plant.crop];
    if (!crop) return entries;
    entries[plant.crop] ||= { count: 0, progress: 0 };
    entries[plant.crop].count += 1;
    entries[plant.crop].progress += plant.ready ? 1 : Math.max(0, Math.min(1, plant.growth / crop.days));
    return entries;
  }, {});
  return Object.entries(summary).sort(([, a], [, b]) =>
    b.count - a.count || b.progress - a.progress
  )[0]?.[0] || "";
}

function unitSprite(unit, definition) {
  const plants = unit.slots.filter(Boolean);
  if (!plants.length) return definition.emptySprite || definition.sprite;
  return definition.sprite;
}

function plantVisualStage(plant) {
  if (!plant) return 0;
  const crop = CROPS[plant.crop];
  if (!crop) return 1;
  if (plant.ready) return 5;
  if (plant.dead) return 1;
  return growthStageIndex(plant.growth / crop.days);
}

function plantSprite(plant) {
  if (!plant) return "";
  const stage = plantVisualStage(plant);
  const sprites = PLANT_STAGE_SPRITES[plant.crop];
  return sprites?.[Math.max(0, stage - 1)] || CROPS[plant.crop]?.icon || "";
}

function renderUnitPlantSlots(unit, shelfIndex) {
  const layout = GROW_UNIT_SLOT_LAYOUTS[unit.type];
  if (!layout?.length) return "";
  return `<span class="box-plant-slots" aria-hidden="false">${unit.slots.map((plant, slotIndex) => {
    const slot = layout[slotIndex] || { x: 50, y: 50, size: 20, z: slotIndex };
    const stage = plantVisualStage(plant);
    const crop = plant ? CROPS[plant.crop] : null;
    const ready = Boolean(plant?.ready);
    const dead = Boolean(plant?.dead);
    const sprite = plantSprite(plant);
    const now = Date.now();
    const stagePulse = Boolean(plant?.stagePulseAt && now - plant.stagePulseAt < 1500);
    const readyPulse = Boolean(plant?.readyPulseAt && now - plant.readyPulseAt < 1900);
    const slotPulseClass = `${stagePulse ? "stage-pop" : ""} ${readyPulse ? "ready-pop" : ""}`.trim();
    return `<span class="box-plant-slot ${plant ? "planted" : "empty"} ${ready ? "ready" : ""} ${dead ? "dead" : ""} ${slotPulseClass} stage-${stage}" data-shelf="${shelfIndex}" data-slot="${slotIndex}" data-box-plant-slot style="--slot-x:${slot.x}%;--slot-y:${slot.y}%;--slot-size:${slot.size}%;--slot-z:${slot.z};--crop-color:${crop?.color || "#72ffb8"}" role="button" aria-label="${crop ? `${crop.name} slot ${slotIndex + 1}` : `Empty slot ${slotIndex + 1}`}">
      ${sprite ? `<img class="box-plant-sprite" src="${sprite}" alt="" draggable="false">` : ""}
      ${ready ? `<span class="box-ready-dot"></span>` : ""}
    </span>`;
  }).join("")}</span>`;
}

function growthStageIndex(progress) {
  if (progress >= 0.68) return 4;
  if (progress >= 0.43) return 3;
  if (progress >= 0.18) return 2;
  return 1;
}

function updatePlantVisualStage(plant) {
  const crop = CROPS[plant.crop];
  if (!crop) return false;
  const nextStage = plant.ready ? 5 : plant.dead ? 1 : growthStageIndex(plant.growth / crop.days);
  if (plant.visualStage === nextStage) return false;
  plant.visualStage = nextStage;
  plant.stagePulseAt = Date.now();
  if (nextStage === 5) plant.readyPulseAt = plant.stagePulseAt;
  return true;
}

function observationForUnit(unit) {
  const plants = unit.slots.filter(Boolean);
  if (!plants.length) return `${GROW_UNITS[unit.type].name} is quiet. The lights are asleep.`;
  if (plants.some((plant) => plant.dead)) return "The leaves have gone dull. The room knows the failure before the terminal does.";
  if (plants.some((plant) => plant.ready)) return "The leaves push back against the light. Something is ready to cut.";
  const average = plants.reduce((sum, plant) => sum + plant.growth / CROPS[plant.crop].days, 0) / plants.length;
  if (average < 0.3) return "Small sprouts press through the medium. Fragile, but alive.";
  if (average < 0.75) return "The leaves are learning the fan. The green is a little louder than yesterday.";
  return "Almost there. The equipment is crowded with overlapping leaves.";
}

function resourceDemand() {
  return activePlants().reduce((total, entry) => {
    if (entry.plant.ready || entry.plant.dead) return total;
    const crop = CROPS[entry.plant.crop];
    if (!GROW_UNITS[entry.shelf.type]?.continuous) return total;
    const base = ownedBases().find((candidate) => candidate.id === entry.baseId) || currentBase();
    const perf = unitPerformance(entry.shelf, entry.plant.crop, base);
    total.water += crop.water * RESOURCE_CONSUMPTION_RATE * perf.water;
    total.nutrient += crop.nutrient * RESOURCE_CONSUMPTION_RATE * perf.nutrient * (getUnitEffects(entry.shelf).fan ? 0.9 : 1);
    return total;
  }, { water: 0, nutrient: 0 });
}

function formatResource(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function plantingResourceCost(cropId, unit) {
  const definition = GROW_UNITS[unit.type];
  if (!definition) return { water: 0, nutrient: 0 };
  if (definition.continuous) return { water: 0, nutrient: 0 };
  const crop = CROPS[cropId];
  const base = ownedBases().find((candidate) => candidate.shelves.some((shelf) => shelf.id === unit.id)) || currentBase();
  const perf = unitPerformance(unit, cropId, base);
  return {
    water: crop.water * RESOURCE_CONSUMPTION_RATE * crop.days * perf.water,
    nutrient: crop.nutrient * RESOURCE_CONSUMPTION_RATE * crop.days * perf.nutrient * (getUnitEffects(unit).fan ? 0.9 : 1)
  };
}

function resourceShortageContext(cropId, unit, cost) {
  const waterMissing = Math.max(0, cost.water - state.water);
  const nutrientMissing = Math.max(0, cost.nutrient - state.nutrient);
  const missing = [];
  if (waterMissing > 0.001) missing.push(`? ${formatResource(waterMissing)}`);
  if (nutrientMissing > 0.001) missing.push(`?? ${formatResource(nutrientMissing)}`);
  return {
    cropId,
    cropName: CROPS[cropId]?.name || cropId,
    unitType: unit.type,
    unitName: GROW_UNITS[unit.type]?.name || unit.type,
    waterRequired: formatResource(cost.water),
    nutrientRequired: formatResource(cost.nutrient),
    waterCurrent: formatResource(state.water),
    nutrientCurrent: formatResource(state.nutrient),
    waterMissing: formatResource(waterMissing),
    nutrientMissing: formatResource(nutrientMissing),
    missingResources: missing.join(' / ') || '??'
  };
}

function setStatus(message) {
  state.log = message;
  const status = document.getElementById("status-text");
  if (status) status.textContent = message;
}

const soundPool = {};
const loopAudioPool = {};

function cacheBustedAudioSource(source) {
  if (!source || /^(data:|blob:)/i.test(source)) return source;
  const separator = source.includes("?") ? "&" : "?";
  return `${source}${separator}audio=${AUDIO_CACHE_BUSTER}`;
}

function playSound(name, volume = null) {
  const source = SOUND_FILES[name];
  if (!source) return false;
  const audioSource = cacheBustedAudioSource(source);
  const audio = soundPool[name] || new Audio(audioSource);
  soundPool[name] = audio;
  audio.volume = Math.max(0, Math.min(1, volume ?? SOUND_VOLUMES[name] ?? 0.28));
  audio.currentTime = 0;
  audio.play().catch(() => {});
  return true;
}

function playSoundFirst(names, volume = null) {
  const soundId = names.find((name) => SOUND_FILES[name]);
  if (!soundId) return false;
  return playSound(soundId, volume);
}

function playCommsSound(commsEntry, fallback = "comms_open") {
  const event = commsEntry?.event || commsEntry;
  playSound(event?.sound || fallback, event?.soundVolume ?? null);
}

function loopAudio(id, source) {
  if (!source || source === "none") return null;
  if (!loopAudioPool[id]) {
    const audio = new Audio(cacheBustedAudioSource(source));
    audio.loop = true;
    audio.preload = "auto";
    audio.volume = 0;
    loopAudioPool[id] = audio;
  }
  return loopAudioPool[id];
}

function setLoopVolume(id, source, volume) {
  const audio = loopAudio(id, source);
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, volume));
  if (volume > 0) {
    if (audio.paused) audio.play().catch(() => {});
  } else {
    audio.pause();
  }
}

function currentAmbientConditions() {
  const placedUnits = allShelves().filter((unit) => unit.placed);
  const planted = activePlants().length;
  const cleaningNeeded = ownedBases().some((base) => [...base.shelves, ...base.floorDevices].some(needsCleaning));
  const fanDevice = allFloorDevices().some((device) => device.placed && device.type === "fan");
  const demand = resourceDemand();
  return {
    always: true,
    time_running: Boolean(state.timeUnlocked && !state.paused && !state.ended),
    plants: planted > 0,
    cleaning_needed: cleaningNeeded,
    fan_device: fanDevice,
    many_units: placedUnits.length >= 3,
    water_low: demand.water > 0 && state.water <= Math.max(2, demand.water * 3),
    market_unlocked: Boolean(state.marketTabUnlocked)
  };
}

function ambientLayerActive(layer) {
  const condition = layer.condition || "always";
  if (condition.startsWith("base_tier:")) {
    return currentBase().tier === condition.split(":")[1];
  }
  if (condition.startsWith("market:")) {
    return document.getElementById("market-screen")?.classList.contains("active")
      && selectedMarket === condition.split(":")[1];
  }
  const conditions = currentAmbientConditions();
  return Boolean(conditions[condition]);
}

function activeAmbientLayers() {
  if (state.audio?.noiseCanceling) return [];
  return Object.entries(AMBIENT_LAYERS).filter(([, layer]) => ambientLayerActive(layer));
}

function syncLoopAudio() {
  if (!state?.audio) return;
  const activeIds = new Set();
  activeAmbientLayers().forEach(([id, layer]) => {
    const audioId = `ambient:${id}`;
    activeIds.add(audioId);
    setLoopVolume(audioId, layer.file, layer.volume);
  });
  const radio = RADIO_PROGRAMS[state.audio.radioProgram];
  if (radio && radio.file && radio.file !== "none") {
    const audioId = `radio:${state.audio.radioProgram}`;
    activeIds.add(audioId);
    setLoopVolume(audioId, radio.file, radio.volume);
  }
  Object.entries(loopAudioPool).forEach(([id, audio]) => {
    if (activeIds.has(id)) return;
    audio.pause();
    audio.volume = 0;
  });
}

function setNoiseCanceling(enabled) {
  state.audio.noiseCanceling = Boolean(enabled);
  saveGame();
  renderRadio();
  syncLoopAudio();
  playSound(state.audio.noiseCanceling ? "environment_adjust" : "tab_switch", 0.14);
  hapticFeedback(state.audio.noiseCanceling ? [8, 26, 8] : 8);
  terminalSurfaceFeedback("radio");
  toast(state.audio.noiseCanceling ? "Noise canceling enabled." : "Ambient audio restored.");
}

function selectRadioProgram(programId) {
  if (!RADIO_PROGRAMS[programId]) return;
  state.audio.radioProgram = programId;
  saveGame();
  renderRadio();
  syncLoopAudio();
  playSound("radio_select", 0.12);
  hapticFeedback(8);
  terminalSurfaceFeedback("radio");
}

function burstEffect(target, color = "#72ffb8", count = 12) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "effect-burst";
  layer.style.left = `${rect.left + rect.width / 2}px`;
  layer.style.top = `${rect.top + rect.height / 2}px`;
  for (let index = 0; index < count; index += 1) {
    const particle = document.createElement("i");
    const angle = (Math.PI * 2 * index) / count + Math.random() * 0.35;
    const distance = 28 + Math.random() * 54;
    particle.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    particle.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    particle.style.setProperty("--particle-color", color);
    layer.appendChild(particle);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 850);
}

function cleanSplashEffect(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "clean-effect clean-splash-effect";
  layer.style.left = `${rect.left + rect.width / 2}px`;
  layer.style.top = `${rect.top + rect.height * 0.45}px`;
  for (let index = 0; index < 18; index += 1) {
    const drop = document.createElement("i");
    const angle = -Math.PI * 0.85 + Math.random() * Math.PI * 1.7;
    const distance = 18 + Math.random() * 70;
    drop.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    drop.style.setProperty("--dy", `${Math.sin(angle) * distance - Math.random() * 24}px`);
    drop.style.setProperty("--delay", `${Math.random() * 90}ms`);
    layer.appendChild(drop);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 900);
}

function brushCleanEffect(target) {
  if (!target) return;
  const rect = target.getBoundingClientRect();
  const layer = document.createElement("div");
  layer.className = "clean-effect brush-clean-effect";
  layer.style.left = `${rect.left + rect.width / 2}px`;
  layer.style.top = `${rect.top + rect.height * 0.45}px`;
  for (let index = 0; index < 7; index += 1) {
    const stroke = document.createElement("i");
    stroke.style.setProperty("--x", `${-34 + Math.random() * 68}px`);
    stroke.style.setProperty("--y", `${-26 + Math.random() * 52}px`);
    stroke.style.setProperty("--delay", `${index * 38}ms`);
    layer.appendChild(stroke);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 760);
}

function pulseElement(element, className = "reward-pulse") {
  if (!element) return;
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
  window.setTimeout(() => element.classList.remove(className), 700);
}

function hapticFeedback(pattern = 10) {
  if (!navigator?.vibrate) return;
  try {
    navigator.vibrate(pattern);
  } catch (error) {}
}

function tactileFeedback(target, { sound = "click", volume = 0.08, vibration = 8, className = "tactile-pop" } = {}) {
  if (sound) playSound(sound, volume);
  if (vibration) hapticFeedback(vibration);
  if (target) pulseElement(target, className);
}

function feedbackRect(target) {
  if (!target) return null;
  if (typeof target.getBoundingClientRect === "function") {
    const rect = target.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
  }
  if (["left", "top", "width", "height"].every((key) => Number.isFinite(target[key]))) return target;
  return null;
}

function floatingFeedback(target, textValue, color = "#f5d65b", className = "") {
  if (!target || !textValue) return;
  const rect = feedbackRect(target);
  if (!rect) return;
  const element = document.createElement("div");
  element.className = ("floating-feedback " + className).trim();
  element.textContent = textValue;
  element.style.left = (rect.left + rect.width / 2) + "px";
  element.style.top = (rect.top + rect.height * 0.32) + "px";
  element.style.setProperty("--float-color", color);
  document.body.appendChild(element);
  window.setTimeout(() => element.remove(), 980);
}

function animateMoneyCounter(fromValue, toValue) {
  const element = document.getElementById("money-value");
  if (!element) return;
  const start = Number(fromValue) || 0;
  const end = Number(toValue) || 0;
  const startedAt = performance.now();
  const duration = 620;
  const tick = (now) => {
    const t = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - t, 3);
    element.textContent = formatNumber(Math.round(start + (end - start) * eased));
    if (t < 1) requestAnimationFrame(tick);
    else element.textContent = formatNumber(end);
  };
  requestAnimationFrame(tick);
}

function saleStreamEffect(sourceElement, cropId, qty = 1, premium = false) {
  const target = document.getElementById("money-value");
  const crop = CROPS[cropId];
  if (!sourceElement || !target || !crop?.icon) return;
  const from = feedbackRect(sourceElement);
  const to = feedbackRect(target);
  if (!from || !to) return;
  const count = Math.min(7, Math.max(3, qty));
  const layer = document.createElement("div");
  layer.className = ("sale-stream " + (premium ? "premium" : "")).trim();
  for (let index = 0; index < count; index += 1) {
    const pip = document.createElement("img");
    pip.src = crop.icon;
    pip.alt = "";
    const startX = from.left + from.width * (0.3 + Math.random() * 0.4);
    const startY = from.top + from.height * (0.25 + Math.random() * 0.5);
    pip.style.left = startX + "px";
    pip.style.top = startY + "px";
    pip.style.setProperty("--dx", (to.left + to.width / 2 - startX + (Math.random() * 30 - 15)) + "px");
    pip.style.setProperty("--dy", (to.top + to.height / 2 - startY + (Math.random() * 20 - 10)) + "px");
    pip.style.setProperty("--delay", (index * 48) + "ms");
    layer.appendChild(pip);
  }
  document.body.appendChild(layer);
  window.setTimeout(() => layer.remove(), 980);
}

function saleRewardEffect({ sourceElement, sourceRect, cropId, revenue, qty, quality, premium, fromMoney, toMoney }) {
  const source = sourceRect || sourceElement;
  floatingFeedback(source, "+?" + formatNumber(revenue), premium ? "#fff2a8" : "#f5d65b", premium ? "cash premium" : "cash");
  if (qty > 1) floatingFeedback(source, qty + " SOLD", CROPS[cropId]?.color || "#72ffb8", "small");
  saleStreamEffect(source, cropId, qty, premium);
  window.setTimeout(() => {
    animateMoneyCounter(fromMoney, toMoney);
    pulseElement(document.getElementById("money-value"), premium ? "cash-shock-premium" : "cash-shock");
  }, 120);
  if (premium) window.setTimeout(() => toast((CROPS[cropId]?.name || cropId) + " ???? // Q-" + quality), 180);
}

function plantGrowthFeedback(target, plant) {
  if (!target || !plant) return;
  const crop = CROPS[plant.crop];
  floatingFeedback(target, plant.ready ? "READY" : "STAGE " + (plant.visualStage || plantVisualStage(plant)), plant.ready ? "#f5d65b" : crop?.color || "#72ffb8", plant.ready ? "ready" : "small");
  burstEffect(target, plant.ready ? "#f5d65b" : crop?.color || "#72ffb8", plant.ready ? 18 : 8);
}

function terminalSurfaceFeedback(tabId) {
  const screen = document.getElementById(tabId + "-screen");
  if (!screen) return;
  screen.classList.remove("terminal-flash");
  void screen.offsetWidth;
  screen.classList.add("terminal-flash");
  window.setTimeout(() => screen.classList.remove("terminal-flash"), 420);
}

function rejectFeedback() {
  playSound("feedback_reject", 0.18);
  pulseElement(document.getElementById("app"), "micro-shake");
}

function toast(message, type = "") {
  const element = document.createElement("div");
  element.className = `toast ${type}`.trim();
  element.textContent = message;
  document.getElementById("toast-container").appendChild(element);
  window.setTimeout(() => element.remove(), 3000);
}

function botActionLog(message) {
  setStatus(message);
  toast(message, "bot");
}

function switchTab(tabId) {
  const previousTab = document.querySelector(".screen.active")?.id?.replace("-screen", "");
  if (tabId === "market" && !state.marketTabUnlocked) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  if (tabId === "shop" && !state.shopUnlocked) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  if (tabId === "schedule" && !state.shopUnlocked) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  if (tabId === "broker" && !state.brokerUnlocked) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.tab === tabId);
  });
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === `${tabId}-screen`);
  });
  if (tabId === "schedule") {
    renderSchedule();
    triggerComms("schedule_opened");
  }
  if (tabId === "radio") renderRadio();
  if (previousTab !== tabId) {
    playSound("tab_switch", 0.18);
    hapticFeedback(8);
    trackTabAnalytics(tabId, previousTab);
    terminalSurfaceFeedback(tabId);
  }
}

function commsContextValue(context = {}, key = "") {
  if (key in context) return context[key];
  if (key === "cropName" && context.cropId) return CROPS[context.cropId]?.name;
  if (key === "marketName" && context.marketId) return MARKETS[context.marketId]?.name;
  if (key === "itemName" && context.itemId) {
    return EQUIPMENT[context.itemId]?.name || CROPS[context.itemId]?.name || GROW_UNITS[context.itemId]?.name || FLOOR_DEVICES[context.itemId]?.name;
  }
  if (key === "unitName" && context.unitType) return GROW_UNITS[context.unitType]?.name;
  if (key === "deviceName" && context.deviceType) return FLOOR_DEVICES[context.deviceType]?.name;
  return undefined;
}

function commsContextMatches(matchers = [], context = {}) {
  return matchers.every((matcher) => {
    const actual = commsContextValue(context, matcher.key);
    const expected = matcher.value;
    const actualText = actual === undefined || actual === null ? "" : String(actual);
    return matcher.operator === "!=" ? actualText !== expected : actualText === expected;
  });
}

function commsEventMatches(entry, trigger, context = {}) {
  return entry.trigger === trigger
    && (!entry.once || !state.commsSeen[entry.id])
    && requirementsMet(entry.requirements || [])
    && commsContextMatches(entry.context || [], context);
}

function commsVariables(context = {}) {
  const itemId = context.itemId || context.cropId || context.unitType || context.deviceType || "";
  return {
    ...context,
    cropName: context.cropName || (context.cropId ? CROPS[context.cropId]?.name : "") || "",
    marketName: context.marketName || (context.marketId ? MARKETS[context.marketId]?.name : "") || "",
    itemName: context.itemName || (itemId ? (EQUIPMENT[itemId]?.name || CROPS[itemId]?.name || GROW_UNITS[itemId]?.name || FLOOR_DEVICES[itemId]?.name) : "") || "",
    unitName: context.unitName || (context.unitType ? GROW_UNITS[context.unitType]?.name : "") || "",
    deviceName: context.deviceName || (context.deviceType ? FLOOR_DEVICES[context.deviceType]?.name : "") || ""
  };
}

function formatCommsText(template = "", context = {}) {
  const vars = commsVariables(context);
  return String(template).replaceAll(/\{([^}]+)\}/g, (_, key) => {
    const value = vars[key.trim()];
    return value === undefined || value === null ? "" : String(value);
  });
}

function commsDedupeContextKey(trigger, context = {}) {
  if (trigger === "resource_low") return String(context.resource || "resource");
  if (trigger === "plant_resource_shortage") return plantingShortageReason(context);
  return "";
}

function commsDedupeKey(entry) {
  const trigger = entry?.event?.trigger || "";
  if (!COMMS_DEDUPE_TRIGGERS.has(trigger)) return "";
  return trigger + ":" + commsDedupeContextKey(trigger, entry.context || {});
}

function hasMatchingQueuedComms(event, context = {}) {
  if (!COMMS_DEDUPE_TRIGGERS.has(event?.trigger)) return false;
  const key = commsDedupeKey({ event, context });
  if (!key) return false;
  return [activeComms, ...pendingComms].some((entry) => commsDedupeKey(entry) === key);
}

function triggerComms(trigger, context = {}) {
  if (!state || state.ended) return;
  const events = COMM_EVENTS
    .filter((entry) => commsEventMatches(entry, trigger, context))
    .filter((event) => !hasMatchingQueuedComms(event, context));
  if (!events.length) {
    if (activeComms) renderComms();
    return;
  }
  const nextEvents = events.map((event) => {
    state.commsSeen[event.id] = Date.now();
    return { event, page: 0, context };
  });
  if (activeComms) pendingComms.push(...nextEvents);
  else activeComms = nextEvents.shift();
  pendingComms.push(...nextEvents);
  persistCommsState();
  renderComms();
  playCommsSound(activeComms, "comms_open");
  saveGame();
}

function serializeCommsEntry(entry) {
  if (!entry?.event?.id) return null;
  return {
    id: entry.event.id,
    page: Math.max(0, Number(entry.page) || 0),
    context: entry.context || {}
  };
}

function persistCommsState() {
  if (!state) return;
  state.commsOpen = [activeComms, ...pendingComms]
    .map(serializeCommsEntry)
    .filter(Boolean);
}

function restoreCommsState() {
  let sourceEntries = state.commsOpen || [];
  if (!sourceEntries.length) {
    sourceEntries = COMM_EVENTS
      .filter((event) => event.blocking && state.commsSeen?.[event.id] && !state.commsChoices?.[event.id])
      .map((event) => ({ id: event.id, page: 0, context: {} }));
  }
  const restoredDedupeKeys = new Set();
  const restored = sourceEntries.map((entry) => {
    const event = COMM_EVENTS.find((candidate) => candidate.id === entry.id);
    if (!event) return null;
    const maxPage = Math.max(0, event.pages.length - 1);
    return {
      event,
      page: Math.max(0, Math.min(Number(entry.page) || 0, maxPage)),
      context: entry.context || {}
    };
  }).filter(Boolean).filter(commsEntryStillValid).filter((entry) => {
    const key = commsDedupeKey(entry);
    if (!key) return true;
    if (restoredDedupeKeys.has(key)) return false;
    restoredDedupeKeys.add(key);
    return true;
  });
  activeComms = restored.shift() || null;
  pendingComms = restored;
  persistCommsState();
}

function isCommsBlocking() {
  return Boolean(activeComms?.event?.blocking);
}

function isCommsInteractionTarget(target) {
  return Boolean(target?.closest?.("#comms-banner, #modal-backdrop, #toast-container, #confirm-widget, #start-screen"));
}

function renderComms() {
  const banner = document.getElementById("comms-banner");
  if (!banner || !activeComms) {
    if (banner) banner.classList.add("hidden");
    document.body.classList.remove("comms-modal-active");
    return;
  }
  const { event, page } = activeComms;
  const pages = event.pages.length ? event.pages : [""];
  const lastPage = page >= pages.length - 1;
  document.body.classList.toggle("comms-modal-active", Boolean(event.blocking));
  banner.classList.toggle("blocking", Boolean(event.blocking));
  document.getElementById("comms-icon").src = event.icon || text("comms_fallback_icon", "assets/icons/credit.webp");
  document.getElementById("comms-kicker").textContent = event.kicker || "COMMS";
  document.getElementById("comms-speaker-name").textContent = event.speakerName || "---";
  document.getElementById("comms-speaker-role").textContent = event.speakerRole || "---";
  document.getElementById("comms-title").textContent = formatCommsText(event.title || "INCOMING MESSAGE", activeComms.context);
  document.getElementById("comms-text").textContent = formatCommsText(pages[page], activeComms.context);
  document.getElementById("comms-progress").textContent = pages.length > 1 ? `${page + 1}/${pages.length}` : "";
  document.getElementById("comms-actions").innerHTML = lastPage
    ? (event.choices.length ? event.choices : [{ id: "close", label: text("comms_close", "Close") }]).map((choice) =>
      `<button data-comms-choice="${choice.id}">${choice.label}</button>`
    ).join("")
    : `<button data-comms-next>${text("comms_next", "次へ")}</button>`;
  banner.classList.remove("hidden");
}

function commsEffectApplies(effect, choiceId) {
  return !effect.choice || effect.choice === "*" || effect.choice === choiceId;
}

function runCommsEffect(effect) {
  if (!effect) return;
  if (effect.action === "tab" && effect.value) {
    switchTab(effect.value);
    return;
  }
  if (effect.action === "unlock_time") {
    unlockTutorialTime();
    return;
  }
  if (effect.action === "add_device" && effect.value) {
    if (grantFloorDevice(effect.value)) render();
    return;
  }
}

function applyCommsEffects(event, choiceId) {
  (event.effects || [])
    .filter((effect) => commsEffectApplies(effect, choiceId))
    .forEach(runCommsEffect);
}

function commsEntryStillValid(entry) {
  return requirementsMet(entry?.event?.requirements || [])
    && commsContextMatches(entry?.event?.context || [], entry?.context || {});
}

function closeComms(choiceId = "close") {
  if (!activeComms) return;
  const closedEvent = activeComms.event;
  state.commsChoices[closedEvent.id] = choiceId;
  applyCommsEffects(closedEvent, choiceId);
  pendingComms = pendingComms.filter(commsEntryStillValid);
  activeComms = pendingComms.shift() || null;
  persistCommsState();
  renderComms();
  if (activeComms) playCommsSound(activeComms, "comms_next");
  saveGame();
}

function isFreshOperationState() {
  const shelves = allShelves();
  const hasPlacedUnit = shelves.some((unit) => unit.placed);
  const hasPlant = shelves.some((unit) => unit.slots?.some(Boolean));
  return state.day === 1
    && !hasPlacedUnit
    && !hasPlant
    && !state.inventory.length
    && !state.tradeStats?.unitsSold
    && !state.shopUnlocked
    && !state.marketTabUnlocked;
}

function clearCommsForTrigger(trigger) {
  const ids = COMM_EVENTS.filter((event) => event.trigger === trigger).map((event) => event.id);
  ids.forEach((id) => {
    delete state.commsSeen[id];
    delete state.commsChoices[id];
  });
  const keepEntry = (entry) => entry?.event ? !ids.includes(entry.event.id) : !ids.includes(entry?.id);
  if (activeComms && !keepEntry(activeComms)) activeComms = null;
  pendingComms = pendingComms.filter(keepEntry);
  state.commsOpen = (state.commsOpen || []).filter(keepEntry);
}

function topEntry(record = {}) {
  return Object.entries(record)
    .filter(([, value]) => Number(value) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]))[0] || [null, 0];
}

function maintainedEquipmentCount() {
  const hardware = (state.equipment?.tanks || 0)
    + (state.equipment?.filter ? 1 : 0)
    + (state.equipment?.fridge ? 1 : 0);
  return allShelves().length + allFloorDevices().length + hardware;
}

function marketLabel(marketId) {
  return MARKETS[marketId]?.name || marketId || "---";
}

function cropLabel(cropId) {
  return CROPS[cropId]?.name || cropId || "---";
}

function day30Titles(summary) {
  const titles = [];
  if (summary.topMarketRevenueId === "upper" && summary.topMarketQtyId === "lower") titles.push("義賊");
  if (summary.propertyCount === 1) titles.push("押し入れ農家");
  if (summary.eventRevenue >= 800 && summary.eventRevenue >= summary.revenue * 0.2) titles.push("市場読み");
  if (summary.topCropId === "lettuce") titles.push("レタスマニア");
  else if (summary.topCropId) titles.push(`${cropLabel(summary.topCropId)}好き`);
  if (summary.unitsSold > 0 && Object.keys(summary.byCrop).filter((cropId) => summary.byCrop[cropId] > 0).every((cropId) => cropId === "lettuce")) {
    titles.push("レタス命");
  }
  if (summary.topMarketQtyId === "lower") titles.push("庶民の味方");
  if (summary.topMarketRevenueId === "medical") titles.push("医療区画御用達");
  if (summary.topMarketRevenueId === "upper") titles.push("金の亡者");
  if (summary.topMarketRevenueId === "rebel") titles.push("抵抗の補給線");
  if (summary.averageUnitPrice >= 180 && summary.unitsSold >= 6) titles.push("高級志向");
  if (summary.unitsSold >= 24 && summary.averageUnitPrice <= 85) titles.push("薄利多売");
  return [...new Set(titles)];
}

function createDay30Summary(options = {}) {
  const recordMode = options.mode || state.mode || "day30";
  const byCrop = { ...(state.tradeStats?.byCrop || {}) };
  const byMarket = { ...(state.tradeStats?.byMarket || {}) };
  const byMarketQty = { ...(state.tradeStats?.byMarketQty || {}) };
  const [topCropId, topCropQty] = topEntry(byCrop);
  const [topMarketRevenueId, topMarketRevenue] = topEntry(byMarket);
  const [topMarketQtyId, topMarketQty] = topEntry(byMarketQty);
  const unitsSold = Number(state.tradeStats?.unitsSold) || 0;
  const revenue = Math.round(Number(state.tradeStats?.revenue) || 0);
  const completed = Boolean(options.completed ?? (recordMode === "day30" && state.day > 30));
  const dayLimit = recordMode === "day30" ? 30 : 9999;
  const fallbackDay = completed && recordMode === "day30" ? 30 : state.day;
  const playedDays = Math.max(1, Math.min(dayLimit, Number(options.playedDays ?? fallbackDay) || 1));
  const records = readPlayRecords(recordMode);
  const summary = {
    id: options.id || makeId(recordMode === "free" ? "free" : "day30"),
    mode: recordMode,
    recordedAt: new Date().toISOString(),
    runLabel: `RUN ${String(records.length + 1).padStart(2, "0")}`,
    playerName: options.playerName || "未記名",
    completed,
    day: playedDays,
    revenue,
    money: Math.round(Number(state.money) || 0),
    unitsSold,
    averageUnitPrice: unitsSold ? Math.round(revenue / unitsSold) : 0,
    byCrop,
    byMarket,
    byMarketQty,
    topCropId,
    topCropQty,
    topMarketRevenueId,
    topMarketRevenue: Math.round(Number(topMarketRevenue) || 0),
    topMarketQtyId,
    topMarketQty,
    equipmentCount: maintainedEquipmentCount(),
    propertyCount: ownedBases().length,
    eventRevenue: Math.round(Number(state.tradeStats?.eventRevenue) || 0),
    analytics: createAnalyticsSummary(),
    titles: []
  };
  summary.titles = day30Titles(summary);
  return summary;
}

function recordDay30Run(options = {}) {
  if (state.day30Recorded) return null;
  const summary = createDay30Summary(options);
  const records = readPlayRecords(summary.mode);
  records.unshift(summary);
  savePlayRecords(summary.mode, records);
  state.day30Recorded = true;
  state.day30RecordId = summary.id;
  pendingDay30RecordId = summary.id;
  return summary;
}

function updateDay30RecordName(recordId, playerName) {
  const name = String(playerName || "").trim() || "未記名";
  for (const mode of ["day30", "free"]) {
    const records = readPlayRecords(mode);
    const record = records.find((entry) => entry.id === recordId);
    if (record) {
      record.playerName = name;
      savePlayRecords(mode, records);
      return record;
    }
  }
  return null;
}

function unlockTutorialTime() {
  if (state.timeUnlocked) return;
  state.timeUnlocked = true;
  state.dayProgress = 0;
  state.paused = false;
  lastTickAt = Date.now();
  setStatus("Realtime clock linked. Growth, demand, and daily market drift are now live.");
  render();
}

function nextCommsPage() {
  if (!activeComms) return;
  activeComms.page += 1;
  persistCommsState();
  renderComms();
  playSound("comms_page", 0.12);
}

function spriteContentRect(image, rect) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const rectRatio = rect.width / rect.height;
  if (rectRatio > imageRatio) {
    const width = rect.height * imageRatio;
    return {
      left: rect.left + (rect.width - width) / 2,
      top: rect.top,
      width,
      height: rect.height
    };
  }
  const height = rect.width / imageRatio;
  return {
    left: rect.left,
    top: rect.bottom - height,
    width: rect.width,
    height
  };
}

function canvasForSprite(image) {
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return null;
  const key = image.currentSrc || image.src;
  const cached = spriteAlphaCache.get(key);
  if (cached && cached.width === image.naturalWidth && cached.height === image.naturalHeight) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  try {
    context.drawImage(image, 0, 0);
  } catch (error) {
    return null;
  }
  const entry = { context, width: canvas.width, height: canvas.height };
  spriteAlphaCache.set(key, entry);
  return entry;
}

function isOpaqueImagePoint(image, clientX, clientY) {
  if (!image) return false;
  if (!image.complete || !image.naturalWidth || !image.naturalHeight) return true;
  const rect = image.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  const contentRect = spriteContentRect(image, rect);
  if (
    clientX < contentRect.left ||
    clientX > contentRect.left + contentRect.width ||
    clientY < contentRect.top ||
    clientY > contentRect.top + contentRect.height
  ) {
    return false;
  }
  const canvas = canvasForSprite(image);
  if (!canvas) return true;
  const pixelX = Math.min(canvas.width - 1, Math.max(0, Math.floor(((clientX - contentRect.left) / contentRect.width) * canvas.width)));
  const pixelY = Math.min(canvas.height - 1, Math.max(0, Math.floor(((clientY - contentRect.top) / contentRect.height) * canvas.height)));
  try {
    return canvas.context.getImageData(pixelX, pixelY, 1, 1).data[3] > SPRITE_ALPHA_THRESHOLD;
  } catch (error) {
    return true;
  }
}

function isOpaqueEquipmentPoint(element, clientX, clientY) {
  const image = element?.querySelector?.(".equipment-sprite");
  if (!image) return true;
  return isOpaqueImagePoint(image, clientX, clientY);
}

function isOpaqueEquipmentPointer(element, event) {
  return isOpaqueEquipmentPoint(element, event.clientX, event.clientY);
}

function compareVisualStack(a, b) {
  const zIndexDifference = (Number.parseInt(getComputedStyle(b).zIndex, 10) || 0) - (Number.parseInt(getComputedStyle(a).zIndex, 10) || 0);
  if (zIndexDifference) return zIndexDifference;
  return (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) ? 1 : -1;
}

function comparePlantSlotStack(a, b) {
  const itemA = a.closest(".facility-item");
  const itemB = b.closest(".facility-item");
  if (itemA && itemB && itemA !== itemB) return compareVisualStack(itemA, itemB);
  return compareVisualStack(a, b);
}

function equipmentItemAtSpritePoint(clientX, clientY, ignoredItem = null) {
  return Array.from(document.querySelectorAll(".facility-item[data-drag-kind][data-drag-id]"))
    .filter((item) => item !== ignoredItem)
    .sort(compareVisualStack)
    .find((item) => isOpaqueEquipmentPoint(item, clientX, clientY)) || null;
}

function elementFromPointWithSpriteAlpha(clientX, clientY) {
  const skipped = [];
  try {
    for (let index = 0; index < 8; index += 1) {
      const hovered = document.elementFromPoint(clientX, clientY);
      const item = hovered?.closest?.(".facility-item[data-drag-kind][data-drag-id]");
      if (!item || isOpaqueEquipmentPoint(item, clientX, clientY)) return hovered;
      skipped.push({ item, pointerEvents: item.style.pointerEvents });
      item.style.pointerEvents = "none";
    }
    return document.elementFromPoint(clientX, clientY);
  } finally {
    skipped.forEach(({ item, pointerEvents }) => {
      item.style.pointerEvents = pointerEvents;
    });
  }
}

function interactiveElementFromPoint(clientX, clientY, ignoredItem = null) {
  return equipmentItemAtSpritePoint(clientX, clientY, ignoredItem) || elementFromPointWithSpriteAlpha(clientX, clientY);
}

function gridCellAtPoint(clientX, clientY) {
  return document.elementsFromPoint(clientX, clientY)
    .map((element) => element.closest?.("[data-grid-x][data-grid-y]"))
    .find(Boolean) || null;
}

function equipmentDefinition(kind, type) {
  return kind === "unit" ? GROW_UNITS[type] : FLOOR_DEVICES[type];
}

function equipmentRecordFromElement(element) {
  if (!element) return null;
  const kind = element.dataset.dragKind;
  const id = element.dataset.dragId;
  if (!kind || !id) return null;
  const record = findOwnedEquipment(kind, id);
  if (!record) return null;
  return { ...record, kind, id, definition: equipmentDefinition(kind, record.item.type) };
}

function canReturnEquipmentToStock(kind, item) {
  return kind !== "unit" || !item.slots.some(Boolean);
}

function canSellEquipment(kind, item) {
  if (kind === "device" && item.type === "support_robot") return false;
  return kind !== "unit" || !item.slots.some(Boolean);
}

function equipmentCleanText(item) {
  const dirt = Math.round(item.dirt || 0);
  if (dirt >= 60) return `DIRT ${dirt}% // CLEAN NEEDED`;
  if (dirt >= 25) return `DIRT ${dirt}% // WATCH`;
  return `DIRT ${dirt}% // CLEAN`;
}

function cancelEquipmentMenuTimer() {
  if (!equipmentMenuTimer) return;
  clearTimeout(equipmentMenuTimer.timerId);
  equipmentMenuTimer = null;
}

function clearEquipmentMenu() {
  cancelEquipmentMenuTimer();
  if (equipmentMenu?.menu) equipmentMenu.menu.remove();
  if (equipmentMenu?.source?.releasePointerCapture) {
    try {
      equipmentMenu.source.releasePointerCapture(equipmentMenu.pointerId);
    } catch (error) {}
  }
  equipmentMenu = null;
}

function setEquipmentMenuAction(action) {
  if (!equipmentMenu) return;
  equipmentMenu.activeAction = action;
  equipmentMenu.menu.querySelectorAll("[data-pie-action]").forEach((button) => {
    const active = button.dataset.pieAction === action;
    button.classList.toggle("active", active);
  });
}

function updateEquipmentMenu(event) {
  if (!equipmentMenu || event.pointerId !== equipmentMenu.pointerId) return false;
  const dx = event.clientX - equipmentMenu.centerX;
  const dy = event.clientY - equipmentMenu.centerY;
  const distance = Math.hypot(dx, dy);
  if (distance < 22) {
    setEquipmentMenuAction(null);
  } else {
    const action = Math.abs(dx) >= Math.abs(dy) ? (dx < 0 ? "stock" : "sell") : (dy < 0 ? "stock" : "sell");
    const disabled = (action === "stock" && equipmentMenu.stockDisabled) || (action === "sell" && equipmentMenu.sellDisabled);
    setEquipmentMenuAction(disabled ? null : action);
  }
  event.preventDefault();
  return true;
}

function finishEquipmentMenu(event) {
  if (!equipmentMenu || event.pointerId !== equipmentMenu.pointerId) return false;
  updateEquipmentMenu(event);
  const action = equipmentMenu.activeAction;
  const { kind, id } = equipmentMenu;
  clearEquipmentMenu();
  suppressClickUntil = Date.now() + 260;
  executeEquipmentMenuAction(kind, id, action);
  return true;
}

function executeEquipmentMenuAction(kind, id, action) {
  if (action === "stock") {
    returnItemToStock(kind, id);
  } else if (action === "sell") {
    sellOwnedItem(kind, id);
  }
}

function openEquipmentMenu(element, event, options = {}) {
  const record = equipmentRecordFromElement(element);
  if (!record || !record.item.placed) return false;
  if (harvestHold && harvestHold.source === element) harvestHold = null;
  clearEquipmentMenu();
  const stockDisabled = !canReturnEquipmentToStock(record.kind, record.item);
  const sellDisabled = !canSellEquipment(record.kind, record.item);
  const menu = document.createElement("div");
  menu.className = `equipment-pie-menu ${options.persistent ? "persistent-menu" : ""}`.trim();
  menu.style.left = `${event.clientX}px`;
  menu.style.top = `${event.clientY}px`;
  const tags = tagMarkup(record.item.tags, EQUIPMENT_TAGS);
  menu.innerHTML = `
    <div class="equipment-mini-window">
      <p class="eyebrow">${record.definition.code || record.item.type}</p>
      <strong>${record.definition.name}</strong>
      <small>${equipmentCleanText(record.item)}</small>
      ${tags}
    </div>
    <button class="pie-action pie-stock ${stockDisabled ? "disabled" : ""}" data-pie-action="stock" type="button" ${stockDisabled ? "disabled" : ""}><span>STOCK</span></button>
    <button class="pie-action pie-sell ${sellDisabled ? "disabled" : ""}" data-pie-action="sell" type="button" ${sellDisabled ? "disabled" : ""}><span>SELL</span></button>`;
  document.body.appendChild(menu);
  if (options.persistent) {
    menu.querySelectorAll("[data-pie-action]").forEach((button) => {
      button.addEventListener("click", (clickEvent) => {
        clickEvent.preventDefault();
        clickEvent.stopPropagation();
        if (button.disabled) return;
        const action = button.dataset.pieAction;
        const { kind, id } = equipmentMenu;
        clearEquipmentMenu();
        executeEquipmentMenuAction(kind, id, action);
      });
    });
  }
  equipmentMenu = {
    pointerId: event.pointerId,
    source: element,
    menu,
    kind: record.kind,
    id: record.id,
    centerX: event.clientX,
    centerY: event.clientY,
    activeAction: null,
    stockDisabled,
    sellDisabled,
    persistent: Boolean(options.persistent)
  };
  if (element.setPointerCapture) {
    try {
      element.setPointerCapture(event.pointerId);
    } catch (error) {}
  }
  playSound("equipment_menu_open", 0.18);
  suppressClickUntil = Date.now() + 300;
  event.preventDefault();
  return true;
}

function beginEquipmentMenuHold(element, event) {
  cancelEquipmentMenuTimer();
  const holdDelay = event.pointerType === "mouse" ? 360 : 520;
  equipmentMenuTimer = {
    pointerId: event.pointerId,
    source: element,
    startX: event.clientX,
    startY: event.clientY,
    timerId: window.setTimeout(() => {
      const pending = equipmentMenuTimer;
      if (!pending || pending.pointerId !== event.pointerId) return;
      equipmentMenuTimer = null;
      openEquipmentMenu(pending.source, {
        pointerId: pending.pointerId,
        clientX: pending.startX,
        clientY: pending.startY,
        pointerType: event.pointerType,
        preventDefault() {}
      });
    }, holdDelay)
  };
  if (element.setPointerCapture) {
    try {
      element.setPointerCapture(event.pointerId);
    } catch (error) {}
  }
  suppressClickUntil = Date.now() + holdDelay + 80;
  event.preventDefault();
  return true;
}

function beginPointerDrag(source, event, payload, startX = event.clientX, startY = event.clientY) {
  dragPayload = payload;
  event.preventDefault();
  let anchor = { x: 0, y: 0 };
  if (dragPayload.type === "equipment") {
    const record = findOwnedEquipment(dragPayload.kind, dragPayload.id);
    if (record) anchor = dragAnchorForItem(record.item, dragPayload.kind, startX, startY);
  }
  pointerDrag = {
    source,
    startX,
    startY,
    pointerId: event.pointerId,
    anchorX: anchor.x,
    anchorY: anchor.y,
    dropOrigin: null,
    dropUnitId: null,
    moved: false,
    ghost: null
  };
  if (pointerDrag.source.setPointerCapture) {
    try {
      pointerDrag.source.setPointerCapture(event.pointerId);
    } catch (error) {}
  }
}

function updatePendingEquipmentMenu(event) {
  if (!equipmentMenuTimer || event.pointerId !== equipmentMenuTimer.pointerId) return false;
  const distance = Math.hypot(event.clientX - equipmentMenuTimer.startX, event.clientY - equipmentMenuTimer.startY);
  if (distance > 10) {
    const pending = equipmentMenuTimer;
    cancelEquipmentMenuTimer();
    beginPointerDrag(pending.source, event, {
      type: "equipment",
      kind: pending.source.dataset.dragKind,
      id: pending.source.dataset.dragId
    }, pending.startX, pending.startY);
    return false;
  }
  event.preventDefault();
  return true;
}

function clearCleanToolTarget() {
  document.querySelectorAll(".clean-tool-target").forEach((element) => element.classList.remove("clean-tool-target"));
}

function clearCleanToolDrag() {
  if (!cleanToolDrag) return;
  cleanToolDrag.source?.classList.remove("dragging");
  cleanToolDrag.ghost?.remove();
  clearCleanToolTarget();
  document.body.classList.remove("clean-tool-active");
  cleanToolDrag = null;
}

function beginCleanToolDrag(button, event) {
  cleanToolDrag = {
    pointerId: event.pointerId,
    source: button,
    tool: button.dataset.cleanTool,
    startX: event.clientX,
    startY: event.clientY,
    ghost: null,
    target: null,
    lastSoundAt: 0
  };
  button.classList.add("dragging");
  document.body.classList.add("clean-tool-active");
  if (button.setPointerCapture) {
    try {
      button.setPointerCapture(event.pointerId);
    } catch (error) {}
  }
  playSound("clean_tool_grab", 0.18);
  event.preventDefault();
}

function updateCleanToolDrag(event) {
  if (!cleanToolDrag || event.pointerId !== cleanToolDrag.pointerId) return false;
  if (!cleanToolDrag.ghost) {
    cleanToolDrag.ghost = cleanToolDrag.source.cloneNode(true);
    cleanToolDrag.ghost.className = `clean-tool-ghost tool-${cleanToolDrag.tool}`;
    document.body.appendChild(cleanToolDrag.ghost);
  }
  cleanToolDrag.ghost.style.left = `${event.clientX}px`;
  cleanToolDrag.ghost.style.top = `${event.clientY}px`;
  clearCleanToolTarget();
  const target = equipmentItemAtSpritePoint(event.clientX, event.clientY);
  cleanToolDrag.target = target;
  if (target) {
    target.classList.add("clean-tool-target");
    const now = Date.now();
    if (cleanToolDrag.tool === "brush" && now - cleanToolDrag.lastSoundAt > 420) {
      playSound("clean_tool_brush_loop", 0.08);
      cleanToolDrag.lastSoundAt = now;
    }
  }
  event.preventDefault();
  return true;
}

function finishCleanToolDrag(event) {
  if (!cleanToolDrag || event.pointerId !== cleanToolDrag.pointerId) return false;
  const target = equipmentItemAtSpritePoint(event.clientX, event.clientY);
  const record = equipmentRecordFromElement(target);
  const tool = cleanToolDrag.tool;
  clearCleanToolDrag();
  suppressClickUntil = Date.now() + 220;
  if (record) {
    cleanItem(record.kind, record.id, tool);
  } else {
    rejectFeedback();
  }
  return true;
}

function selectedPlacementItem() {
  if (!placementSelection) return null;
  const record = findOwnedEquipment(placementSelection.kind, placementSelection.id);
  return record ? { ...record.item, kind: placementSelection.kind } : null;
}

function cancelPlacementSelection() {
  if (!placementSelection) return;
  placementSelection = null;
  selectedUnitId = null;
  selectedDeviceId = null;
  setStatus("設置をキャンセルしました。未設置の設備はストックから再配置できます。");
  renderFarm();
}

function placeSelectedAt(x, y) {
  const selected = selectedPlacementItem();
  if (!selected) return;
  placeItemAt(selected.kind, selected.id, x, y);
}

function placeItemAt(kind, id, x, y, targetElement = null, options = {}) {
  const selectAfterPlace = options.selectAfterPlace !== false;
  let record = findOwnedEquipment(kind, id);
  if (!record) return false;
  const selected = { ...record.item, kind };
  if (!canPlace(selected, x, y, selected.id)) {
    toast("Action failed.", "error");
    rejectFeedback();
    return false;
  }
  record = moveEquipmentToBase(record, currentBase());
  const item = record.item;
  Object.assign(item, { x, y, placed: true });
  trackPlacementAnalytics(kind, item);
  removeDuplicateEquipmentEntries(kind, item.id, record.base.id);
  placementSelection = null;
  if (!selectAfterPlace) {
    selectedUnitId = null;
    selectedDeviceId = null;
  } else if (kind === "unit") {
    selectedUnitId = selected.id;
    selectedDeviceId = null;
  } else {
    selectedDeviceId = selected.id;
    selectedUnitId = null;
  }
  setStatus(`${kind === "unit" ? GROW_UNITS[item.type].name : FLOOR_DEVICES[item.type].name}を区画 (${x + 1}, ${y + 1}) に設置しました。`);
  playSound("equipment_place");
  burstEffect(targetElement, kind === "unit" ? "#72ffb8" : FLOOR_DEVICES[item.type].color, 14);
  triggerComms("first_place", { kind, itemId: item.type });
  updateProgressionUnlocks();
  saveGame();
  render();
  return true;
}

function dragAnchorForItem(item, kind, clientX, clientY) {
  const size = footprint({ ...item, kind });
  if (!item.placed) {
    return {
      x: Math.floor((size.width - 1) / 2),
      y: Math.floor((size.height - 1) / 2)
    };
  }
  let nearest = { x: 0, y: 0, distance: Infinity };
  for (let offsetY = 0; offsetY < size.height; offsetY += 1) {
    for (let offsetX = 0; offsetX < size.width; offsetX += 1) {
      const cell = document.querySelector(`[data-grid-x="${item.x + offsetX}"][data-grid-y="${item.y + offsetY}"]`);
      if (!cell) continue;
      const rect = cell.getBoundingClientRect();
      const distance = Math.hypot(clientX - (rect.left + rect.width / 2), clientY - (rect.top + rect.height / 2));
      if (distance < nearest.distance) nearest = { x: offsetX, y: offsetY, distance };
    }
  }
  return { x: nearest.x, y: nearest.y };
}

function highlightDragFootprint(item, kind, originX, originY) {
  const size = footprint({ ...item, kind });
  for (let offsetY = 0; offsetY < size.height; offsetY += 1) {
    for (let offsetX = 0; offsetX < size.width; offsetX += 1) {
      const cell = document.querySelector(`[data-grid-x="${originX + offsetX}"][data-grid-y="${originY + offsetY}"]`);
      if (cell) cell.classList.add("drop-target", "drop-footprint");
    }
  }
}

function isoGridMetrics(base) {
  const rawPoints = [
    { x: 0, y: 0 },
    { x: base.cols - 1, y: 0 },
    { x: 0, y: base.rows - 1 },
    { x: base.cols - 1, y: base.rows - 1 }
  ].map(({ x, y }) => ({
    x: ((y - x) * ISO_TILE_WIDTH) / 2,
    y: ((x + y) * ISO_TILE_HEIGHT) / 2
  }));
  const minX = Math.min(...rawPoints.map((point) => point.x));
  const maxX = Math.max(...rawPoints.map((point) => point.x));
  const minY = Math.min(...rawPoints.map((point) => point.y));
  const maxY = Math.max(...rawPoints.map((point) => point.y));
  const width = maxX - minX + ISO_TILE_WIDTH + ISO_GRID_PAD_X * 2;
  const height = maxY - minY + ISO_TILE_HEIGHT + ISO_GRID_PAD_Y * 2 + 120;
  return {
    width,
    height,
    originX: ISO_GRID_PAD_X + ISO_TILE_WIDTH / 2 - minX,
    originY: ISO_GRID_PAD_Y + ISO_TILE_HEIGHT / 2 - minY
  };
}

function gridToIso(x, y, base = currentBase()) {
  const metrics = isoGridMetrics(base);
  return {
    x: metrics.originX + ((y - x) * ISO_TILE_WIDTH) / 2,
    y: metrics.originY + ((x + y) * ISO_TILE_HEIGHT) / 2
  };
}

function equipmentIsoPosition(item, kind, base = currentBase()) {
  const size = footprint({ ...item, kind });
  return {
    ...gridToIso(item.x + (size.width - 1) / 2, item.y + (size.height - 1) / 2, base),
    size
  };
}

function clampFacilityZoom(value) {
  return Math.max(FACILITY_ZOOM_MIN, Math.min(FACILITY_ZOOM_MAX, value));
}

function applyFacilityView() {
  const grid = document.getElementById("facility-grid");
  if (!grid) return;
  grid.style.setProperty("--view-x", `${facilityView.x}px`);
  grid.style.setProperty("--view-y", `${facilityView.y}px`);
  grid.style.setProperty("--view-zoom", facilityView.zoom.toFixed(2));
}

function resetFacilityView() {
  facilityView = { x: 0, y: 0, zoom: FACILITY_INITIAL_ZOOM };
  applyFacilityView();
}

function zoomFacility(delta) {
  facilityView.zoom = clampFacilityZoom(facilityView.zoom + delta);
  applyFacilityView();
}

function pointerPairMetrics() {
  const points = Array.from(facilityPointers.values());
  if (points.length < 2) return null;
  const [first, second] = points;
  return {
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
    centerX: (first.x + second.x) / 2,
    centerY: (first.y + second.y) / 2
  };
}

function beginFacilityPinch(shell) {
  const metrics = pointerPairMetrics();
  if (!metrics) return;
  facilityPinch = {
    startDistance: metrics.distance,
    startCenterX: metrics.centerX,
    startCenterY: metrics.centerY,
    startZoom: facilityView.zoom,
    viewX: facilityView.x,
    viewY: facilityView.y,
    moved: false
  };
  facilityPan = null;
  harvestSwipe = null;
  clearDragState();
  shell.classList.add("panning");
}

function updateFacilityPinch(event) {
  if (!facilityPinch || !facilityPointers.has(event.pointerId)) return false;
  facilityPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const metrics = pointerPairMetrics();
  if (!metrics) return false;
  event.preventDefault();
  facilityPinch.moved = true;
  facilityView.zoom = clampFacilityZoom(facilityPinch.startZoom * (metrics.distance / facilityPinch.startDistance));
  facilityView.x = facilityPinch.viewX + (metrics.centerX - facilityPinch.startCenterX);
  facilityView.y = facilityPinch.viewY + (metrics.centerY - facilityPinch.startCenterY);
  applyFacilityView();
  return true;
}

function endFacilityPointer(event) {
  facilityPointers.delete(event.pointerId);
  if (facilityPinch && facilityPointers.size < 2) {
    const shell = document.querySelector(".facility-grid-shell");
    if (shell) shell.classList.remove("panning");
    if (facilityPinch.moved) suppressClickUntil = Date.now() + 180;
    facilityPinch = null;
  }
}

function startPlacement(kind, id) {
  const record = findOwnedEquipment(kind, id);
  if (!record) return;
  const item = record.item;
  item.placed = false;
  item.x = null;
  item.y = null;
  placementSelection = { kind, id };
  selectedUnitId = kind === "unit" ? id : null;
  selectedDeviceId = kind === "device" ? id : null;
  setStatus("Select a destination that fits the whole equipment. Dragging uses the grabbed point as the anchor.");
  saveGame();
  renderFarm();
}

function returnItemToStock(kind, id) {
  const record = findOwnedEquipment(kind, id);
  if (!record) return;
  const item = record.item;
  if (kind === "unit" && item.slots.some(Boolean)) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  const definition = kind === "unit" ? GROW_UNITS[item.type] : FLOOR_DEVICES[item.type];
  item.placed = false;
  item.x = null;
  item.y = null;
  trackStockAnalytics(kind, item);
  placementSelection = null;
  selectedUnitId = null;
  selectedDeviceId = null;
  setStatus(`${definition.name}をStockへ戻しました。`);
  toast(`${definition.name}をStockへ収納`);
  playSound("stock_store", 0.2);
  saveGame();
  renderFarm();
}

function refreshPropertyListings() {
  const fee = PROPERTY_REROLL_FEE;
  if (state.money < fee) {
    toast("Action failed.", "error");
    return;
  }
  state.money -= fee;
  state.propertyListings = generatePropertyListings(PROPERTY_LISTING_COUNT);
  setStatus(`不動産ブローカーへ更新料 ₡${PROPERTY_REROLL_FEE}を支払い、新しい物件情報を取得しました。`);
  playSound("property_refresh");
  saveGame();
  render();
}

function refreshProcurementLineup() {
  if (state.money < PROCUREMENT_REROLL_FEE) {
    toast("Action failed.", "error");
    return;
  }
  state.money -= PROCUREMENT_REROLL_FEE;
  state.procurementTags = {};
  ensureProcurementTags();
  setStatus(`マラへ更新料 ₡${PROCUREMENT_REROLL_FEE}を支払い、タグ付き設備ラインナップを引き直しました。`);
  playSound("procurement_refresh");
  saveGame();
  render();
}

function sellOwnedItem(kind, id) {
  const record = findOwnedEquipment(kind, id);
  if (!record) return;
  const { collection, item } = record;
  if (kind === "unit" && item.slots.some(Boolean)) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  const definition = kind === "unit" ? GROW_UNITS[item.type] : FLOOR_DEVICES[item.type];
  const basePrice = EQUIPMENT[item.type]?.basePrice || definition.price || 50;
  const refund = Math.max(10, Math.round(basePrice * 0.45 * (1 - Math.min(0.35, (item.dirt || 0) / 240))));
  const index = collection.indexOf(item);
  collection.splice(index, 1);
  state.money += refund;
  trackEquipmentSaleAnalytics(kind, item, refund);
  selectedUnitId = selectedUnitId === id ? null : selectedUnitId;
  selectedDeviceId = selectedDeviceId === id ? null : selectedDeviceId;
  placementSelection = null;
  setStatus(`${definition.name}を解体売却し、₡${formatNumber(refund)}を回収しました。`);
  toast(`売却 +₡${formatNumber(refund)}`);
  playSoundFirst(["equipment_sell", "sale"], 0.26);
  saveGame();
  render();
}

function contractProperty(propertyId) {
  const property = state.propertyListings.find((item) => item.id === propertyId);
  if (!property || state.money < property.price) {
    toast("Action failed.", "error");
    return;
  }
  state.money -= property.price;
  const newBase = normalizeBase({ ...property, price: 0, shelves: [], floorDevices: [], ownedAt: Date.now() });
  state.bases.push(newBase);
  trackPurchase("property", propertyId, property.price, { itemName: property.name, width: newBase.width, height: newBase.height, tier: newBase.tier });
  state.activeBaseId = newBase.id;
  placementSelection = null;
  selectedUnitId = null;
  selectedDeviceId = null;
  state.propertyListings = generatePropertyListings(PROPERTY_LISTING_COUNT);
  setStatus(`${property.name}を追加拠点として契約しました。新しい区画を選択中です。`);
  toast(`NEW BASE ADDED // ${property.name}`);
  playSound("property_contract");
  triggerComms("relocate", { propertyId });
  updateProgressionUnlocks();
  saveGame();
  render();
  switchTab("farm");
}

function checkFactionProgression() {
  updateProgressionUnlocks();
}

function plantSeed(shelfIndex, slotIndex, cropId = selectedSeed, sourceElement = null) {
  if (state.ended) return;
  if (!cropId || state.seeds[cropId] <= 0) {
    trackPlantingFailure("seed_unavailable", { cropId });
    toast("Action failed.", "error");
    rejectFeedback();
    return;
  }
  const unit = currentShelves()[shelfIndex];
  const slot = unit.slots[slotIndex];
  if (slot) {
    trackPlantingFailure("occupied_slot", { cropId, unitType: unit.type, shelfIndex, slotIndex });
    return;
  }

  const plantingCost = plantingResourceCost(cropId, unit);
  if (state.water < plantingCost.water || state.nutrient < plantingCost.nutrient) {
    const shortageContext = resourceShortageContext(cropId, unit, plantingCost);
    trackPlantingFailure(plantingShortageReason(shortageContext), shortageContext);
    toast(`????: ${shortageContext.missingResources}`, "warning");
    triggerComms("plant_resource_shortage", shortageContext);
    rejectFeedback();
    return;
  }

  state.water -= plantingCost.water;
  state.nutrient -= plantingCost.nutrient;
  state.seeds[cropId] -= 1;
  const plantedAt = Date.now();
  unit.slots[slotIndex] = {
    id: makeId("plant"),
    crop: cropId,
    growth: 0,
    ready: false,
    readyAge: 0,
    degraded: false,
    waterShortage: false,
    nutrientShortage: false,
    witherProgress: 0,
    dead: false,
    visualStage: 1,
    stagePulseAt: plantedAt,
    prepaid: !GROW_UNITS[unit.type].continuous,
    quality: null
  };
  trackPlanting(cropId, unit, shelfIndex, slotIndex, plantingCost);
  const resourceNote = plantingCost.water || plantingCost.nutrient
    ? ` Initial feed: water ${formatResource(plantingCost.water)} / nutrient ${formatResource(plantingCost.nutrient)}`
    : " Continuous feed while growing.";
  setStatus(`${CROPS[cropId].name} planted in ${GROW_UNITS[unit.type].name} ${shelfIndex + 1}.${resourceNote}`);
  const plantTarget = sourceElement || document.querySelector(`[data-shelf="${shelfIndex}"][data-slot="${slotIndex}"]`);
  playSound("plant_seed");
  hapticFeedback(12);
  burstEffect(plantTarget, CROPS[cropId].color, 14);
  pulseElement(document.querySelector(`[data-select-unit="${unit.id}"]`), "equipment-confirm");
  const commsContext = {
    cropId,
    cropName: CROPS[cropId]?.name || cropId,
    unitType: unit.type,
    unitName: GROW_UNITS[unit.type]?.name || unit.type,
    shelfIndex,
    slotIndex
  };
  triggerComms("first_plant", commsContext);
  triggerComms("plant", commsContext);
  saveGame();
  render();
}

function determineQuality(plant, hasLed, hasFan, qualityBonus = 0) {
  let roll = Math.random();
  let quality;
  const ledBonus = hasLed ? 0.1 : 0;
  const fanBonus = hasFan ? 0.05 : 0;
  const tagBonus = qualityBonus || 0;

  if (roll < 0.05 + ledBonus * 0.35 + fanBonus * 0.2 + tagBonus * 0.35) quality = "S";
  else if (roll < 0.2 + ledBonus + fanBonus + tagBonus) quality = "A";
  else quality = "B";

  let index = ["C", "B", "A", "S"].indexOf(quality);
  if (plant.waterShortage) index -= 1;
  if (plant.nutrientShortage) index -= 1;
  return ["C", "B", "A", "S"][Math.max(0, index)];
}

function harvest(shelfIndex, slotIndex, sourceElement = null) {
  const shelf = currentShelves()[shelfIndex];
  const plant = shelf.slots[slotIndex];
  if (!plant || !plant.ready) return;

  const existing = state.inventory.find((batch) =>
    batch.crop === plant.crop
    && batch.quality === plant.quality
    && batch.degraded === plant.degraded
    && batch.age === 0
  );
  if (existing) existing.qty += 1;
  else {
    state.inventory.push({
      id: `${Date.now()}-${Math.random()}`,
      crop: plant.crop,
      quality: plant.quality,
      qty: 1,
      age: 0,
      degraded: plant.degraded
    });
  }

  trackHarvestAnalytics(plant, shelf, 1);
  if (plant.crop === "tomato") state.tomatoHarvested = true;
  const harvestTarget = sourceElement || document.querySelector(`[data-shelf="${shelfIndex}"][data-slot="${slotIndex}"]`);
  shelf.slots[slotIndex] = null;
  setStatus(`${CROPS[plant.crop].name}を収穫。品質 ${plant.quality} を在庫へ移しました。`);
  toast(`${CROPS[plant.crop].name}を収穫しました`);
  playSound("harvest_single");
  hapticFeedback(10);
  burstEffect(harvestTarget, QUALITY[plant.quality].color, 24);
  floatingFeedback(harvestTarget, "+1 " + CROPS[plant.crop].name, QUALITY[plant.quality].color, "harvest");
  state.marketTabUnlocked = true;
  const commsContext = {
    cropId: plant.crop,
    cropName: CROPS[plant.crop]?.name || plant.crop,
    quality: plant.quality,
    unitType: shelf.type,
    unitName: GROW_UNITS[shelf.type]?.name || shelf.type,
    shelfIndex,
    slotIndex,
    qty: 1
  };
  triggerComms("first_harvest", commsContext);
  triggerComms("harvest", commsContext);
  checkVictory();
  saveGame();
  render();
}

function harvestReadyPlantsInUnit(unitId, sourceElement = null) {
  const shelfIndex = currentShelves().findIndex((unit) => unit.id === unitId);
  const shelf = currentShelves()[shelfIndex];
  if (!shelf) return false;
  const readySlots = shelf.slots
    .map((plant, slotIndex) => plant?.ready ? slotIndex : -1)
    .filter((slotIndex) => slotIndex >= 0);
  if (!readySlots.length) return false;

  let harvested = 0;
  let lastCrop = null;
  let lastQuality = null;
  readySlots.forEach((slotIndex) => {
    const plant = shelf.slots[slotIndex];
    const existing = state.inventory.find((batch) =>
      batch.crop === plant.crop
      && batch.quality === plant.quality
      && batch.degraded === plant.degraded
      && batch.age === 0
    );
    if (existing) existing.qty += 1;
    else {
      state.inventory.push({
        id: `${Date.now()}-${Math.random()}`,
        crop: plant.crop,
        quality: plant.quality,
        qty: 1,
        age: 0,
        degraded: plant.degraded
      });
    }
    trackHarvestAnalytics(plant, shelf, 1);
    if (plant.crop === "tomato") state.tomatoHarvested = true;
    lastCrop = plant.crop;
    lastQuality = plant.quality;
    const slotTarget = document.querySelector(`[data-shelf="${shelfIndex}"][data-slot="${slotIndex}"]`);
    if (slotTarget) {
      const qualityColor = QUALITY[plant.quality]?.color || "#72ffb8";
      window.setTimeout(() => {
        burstEffect(slotTarget, qualityColor, 10);
        floatingFeedback(slotTarget, "+1", qualityColor, "harvest small");
      }, harvested * 55);
    }
    shelf.slots[slotIndex] = null;
    harvested += 1;
  });

  const definition = GROW_UNITS[shelf.type];
  setStatus(`${definition.name}から${harvested}株を収穫しました。品質 ${lastQuality} を在庫へ移しました。`);
  toast(`${definition.name} 収穫 +${harvested}`);
  playSound("harvest_bulk");
  hapticFeedback([8, 32, 8]);
  const bulkTarget = sourceElement || document.querySelector(`[data-select-unit="${unitId}"]`);
  burstEffect(bulkTarget, QUALITY[lastQuality]?.color || "#72ffb8", 26);
  floatingFeedback(bulkTarget, "+" + harvested + " STOCK", QUALITY[lastQuality]?.color || "#72ffb8", "harvest");
  state.marketTabUnlocked = true;
  if (lastCrop) {
    const commsContext = {
      cropId: lastCrop,
      cropName: CROPS[lastCrop]?.name || lastCrop,
      quality: lastQuality,
      unitType: shelf.type,
      unitName: GROW_UNITS[shelf.type]?.name || shelf.type,
      unitId,
      qty: harvested
    };
    triggerComms("first_harvest", commsContext);
    triggerComms("harvest", commsContext);
  }
  checkVictory();
  saveGame();
  render();
  return true;
}

function harvestReadyUnitAtPoint(clientX, clientY) {
  const slot = plantSlotElementAtPoint(clientX, clientY);
  if (slot) return harvestReadySlotElement(slot);
  const item = equipmentItemAtSpritePoint(clientX, clientY);
  const unitId = item?.dataset.selectUnit;
  if (!unitId || harvestSwipe?.harvested?.has(unitId)) return false;
  const unit = currentShelves().find((entry) => entry.id === unitId);
  if (!unit || GROW_UNIT_SLOT_LAYOUTS[unit.type]?.length || !unit.slots.some((plant) => plant?.ready)) return false;
  harvestSwipe?.harvested?.add(unitId);
  return harvestReadyPlantsInUnit(unitId, item);
}

function harvestReadyUnitElement(element) {
  const slot = element?.closest?.("[data-box-plant-slot]");
  if (slot) return harvestReadySlotElement(slot);
  const unitId = element?.dataset.selectUnit;
  if (!unitId || harvestSwipe?.harvested?.has(unitId)) return false;
  const unit = currentShelves().find((entry) => entry.id === unitId);
  if (!unit || GROW_UNIT_SLOT_LAYOUTS[unit.type]?.length || !unit.slots.some((plant) => plant?.ready)) return false;
  harvestSwipe?.harvested?.add(unitId);
  return harvestReadyPlantsInUnit(unitId, element);
}

function plantSlotElementAtPoint(clientX, clientY) {
  const directSlot = document.elementsFromPoint(clientX, clientY)
    .map((element) => element.closest?.("[data-box-plant-slot]"))
    .find(Boolean);
  if (directSlot) return directSlot;
  return Array.from(document.querySelectorAll("[data-box-plant-slot].planted"))
    .sort(comparePlantSlotStack)
    .find((slot) => isOpaqueImagePoint(slot.querySelector(".box-plant-sprite"), clientX, clientY)) || null;
}

function harvestReadySlotElement(element) {
  const shelfIndex = Number(element?.dataset.shelf);
  const slotIndex = Number(element?.dataset.slot);
  const key = `slot:${shelfIndex}:${slotIndex}`;
  if (!Number.isInteger(shelfIndex) || !Number.isInteger(slotIndex) || harvestSwipe?.harvested?.has(key)) return false;
  const plant = currentShelves()[shelfIndex]?.slots?.[slotIndex];
  if (!plant?.ready) return false;
  harvestSwipe?.harvested?.add(key);
  harvest(shelfIndex, slotIndex, element);
  return true;
}

function handleFacilityEquipmentTap(element, event) {
  if (!element || !isOpaqueEquipmentPointer(element, event)) return false;
  const unitButton = element.closest("[data-select-unit]");
  if (unitButton) {
    const unit = currentShelves().find((entry) => entry.id === unitButton.dataset.selectUnit);
    if (unit?.slots.some((plant) => plant?.ready) && !GROW_UNIT_SLOT_LAYOUTS[unit.type]?.length) {
      harvestReadyPlantsInUnit(unit.id, unitButton);
      return true;
    }
    if (unit) {
      setStatus(observationForUnit(unit));
      return true;
    }
    return false;
  }

  const deviceButton = element.closest("[data-select-device]");
  if (deviceButton) {
    const device = currentFloorDevices().find((entry) => entry.id === deviceButton.dataset.selectDevice);
    if (device?.type === "support_robot") {
      showSupportRobotPanel(device);
      if (!hasAnySupportOS()) triggerComms("support_robot_os_required");
      return true;
    }
    if (device?.type === "procurement_terminal") {
      showProcurementTerminal();
      return true;
    }
    if (device?.type === "shipping_hatch") {
      showShippingTerminal();
      return true;
    }
    if (device) {
      setStatus(`${FLOOR_DEVICES[device.type].name}が低く唸っています。周囲の空気だけが少し違う速度で動いています。`);
      return true;
    }
  }
  return false;
}

function handleSlotClick(shelfIndex, slotIndex) {
  const plant = currentShelves()[shelfIndex].slots[slotIndex];
  if (!plant) plantSeed(shelfIndex, slotIndex);
  else if (plant.dead) removeDeadPlant(shelfIndex, slotIndex);
  else if (plant.ready) harvest(shelfIndex, slotIndex, document.querySelector(`[data-shelf="${shelfIndex}"][data-slot="${slotIndex}"]`));
}

function removeDeadPlant(shelfIndex, slotIndex) {
  const plant = currentShelves()[shelfIndex].slots[slotIndex];
  if (!plant || !plant.dead) return;
  trackDeadPlantAnalytics(plant, currentShelves()[shelfIndex], "removed");
  currentShelves()[shelfIndex].slots[slotIndex] = null;
  setStatus(`枯死した${CROPS[plant.crop].name}を撤去しました。`);
  saveGame();
  render();
}

function buySeed(cropId) {
  if (!isUnlocked("seed_item", cropId)) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  const crop = CROPS[cropId];
  if (state.money < crop.seedPrice) {
    toast("Action failed.", "error");
    return;
  }
  state.money -= crop.seedPrice;
  state.seeds[cropId] += crop.packSize;
  trackPurchase("seed", cropId, crop.seedPrice, { itemName: crop.name, packSize: crop.packSize });
  selectedSeed = cropId;
  setStatus(`${crop.name} seed pack purchased. +${crop.packSize} seeds.`);
  playSound("buy_seed");
  pulseElement(document.getElementById("money-value"));
  const commsContext = {
    itemId: cropId,
    itemKind: "seed",
    cropId,
    cropName: crop.name,
    itemName: crop.name,
    packSize: crop.packSize
  };
  triggerComms("buy_seed", commsContext);
  triggerComms("buy_item", commsContext);
  saveGame();
  render();
}

function buyEquipment(itemId) {
  if (!isUnlocked("shop_item", itemId)) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  let price = EQUIPMENT[itemId].basePrice;
  if (itemId === "water") price = waterPackPrice();
  if (GROW_UNITS[itemId]) price = growUnitPrice(itemId);
  const tags = (GROW_UNITS[itemId] || FLOOR_DEVICES[itemId]) ? unitTags(itemId) : [];
  const tagEffects = combinedEffects(tags, EQUIPMENT_TAGS);
  if (tags.length) price = Math.max(1, Math.round(price * (tagEffects.priceMod || 1)));

  if (itemId === "nutrient" && state.nutrient >= state.nutrientCapacity) {
    toast("Action unavailable right now.", "warning");
    return;
  }
  if ((itemId === "filter" && state.equipment.filter) || (itemId === "fridge" && state.equipment.fridge)) {
    toast("Action unavailable right now.", "warning");
    return;
  }
  if (state.money < price) {
    toast("Action failed.", "error");
    return;
  }

  state.money -= price;
  if (itemId === "water") state.water += 10;
  if (itemId === "nutrient") state.nutrient = Math.min(state.nutrientCapacity, state.nutrient + 10);
  if (GROW_UNITS[itemId]) {
    const definition = GROW_UNITS[itemId];
    const unit = {
      id: makeId("unit"),
      type: itemId,
      led: false,
      fan: false,
      placed: false,
      x: null,
      y: null,
      tags,
      dirt: 0,
      slots: Array(definition.slots).fill(null)
    };
    currentShelves().push(unit);
    placementSelection = { kind: "unit", id: unit.id };
    selectedUnitId = unit.id;
  }
  if (FLOOR_DEVICES[itemId]) {
    const device = createFloorDevice(itemId);
    device.tags = tags;
    currentFloorDevices().push(device);
    placementSelection = { kind: "device", id: device.id };
    selectedDeviceId = device.id;
  }
  if (itemId === "tank") {
    state.equipment.tanks += 1;
    state.nutrientCapacity += 30;
  }
  if (itemId === "filter") state.equipment.filter = true;
  if (itemId === "fridge") state.equipment.fridge = true;
  if (itemId === "support_os_harvest") state.supportOS.harvest = true;
  if (itemId === "support_os_planting") state.supportOS.planting = true;
  if (itemId === "support_os_cleaning") state.supportOS.cleaning = true;

  const placementNote = GROW_UNITS[itemId] || FLOOR_DEVICES[itemId] ? " Select a place in the facility layout." : "";
  setStatus(`${EQUIPMENT[itemId].name}を購入しました。${placementNote}`);
  toast(`${EQUIPMENT[itemId].name}を調達`);
  playSoundFirst(["buy_equipment", "equipment_purchase", "purchase"]);
  pulseElement(document.getElementById("money-value"));
  const itemKind = GROW_UNITS[itemId] ? "unit" : FLOOR_DEVICES[itemId] ? "device" : ["water", "nutrient"].includes(itemId) ? "resource" : "upgrade";
  trackPurchase(itemKind, itemId, price, {
    itemName: EQUIPMENT[itemId]?.name || itemId,
    tags,
    placementRequired: Boolean(GROW_UNITS[itemId] || FLOOR_DEVICES[itemId])
  });
  const commsContext = {
    itemId,
    itemKind,
    itemName: EQUIPMENT[itemId]?.name || itemId,
    unitType: GROW_UNITS[itemId] ? itemId : "",
    deviceType: FLOOR_DEVICES[itemId] ? itemId : ""
  };
  triggerComms(`buy_${GROW_UNITS[itemId] ? `unit_${itemId}` : itemId}`, commsContext);
  triggerComms("buy_item", commsContext);
  updateProgressionUnlocks();
  if (placementNote) switchTab("farm");
  checkVictory();
  saveGame();
  render();
}

function sellBatch(batchId) {
  const batch = state.inventory.find((item) => item.id === batchId);
  if (!batch) return;
  if (!isMarketAvailable(selectedMarket)) {
    selectedMarket = "lower";
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    renderMarkets();
    return;
  }
  if (!MARKETS[selectedMarket].accepts.includes(batch.crop)) {
    toast("Action unavailable right now.", "warning");
    rejectFeedback();
    return;
  }
  const qty = Math.max(1, Math.min(batch.qty, saleQuantities[batchId] || 1));
  const unitPrice = getUnitPrice(batch);
  const revenue = unitPrice * qty;
  const moneyBeforeSale = state.money;
  const saleSourceElement = document.querySelector(`[data-sell-id="${batchId}"]`);
  const saleSourceRect = feedbackRect(saleSourceElement);
  const premiumSale = unitPrice >= Math.round((CROPS[batch.crop]?.basePrice || unitPrice) * (batch.quality === "S" ? 1.25 : 1.15));
  batch.qty -= qty;
  state.money += revenue;
  state.tradeStats.unitsSold += qty;
  state.tradeStats.revenue += revenue;
  state.tradeStats.byMarket[selectedMarket] += revenue;
  state.tradeStats.byMarketQty ||= { lower: 0, medical: 0, upper: 0, rebel: 0 };
  state.tradeStats.byMarketQty[selectedMarket] = (state.tradeStats.byMarketQty[selectedMarket] || 0) + qty;
  state.tradeStats.byCrop ||= {};
  state.tradeStats.byCrop[batch.crop] = (state.tradeStats.byCrop[batch.crop] || 0) + qty;
  if (state.event) state.tradeStats.eventRevenue = (state.tradeStats.eventRevenue || 0) + revenue;
  trackSaleAnalytics(batch, selectedMarket, qty, unitPrice, revenue, premiumSale);
  if (selectedMarket === "rebel") {
    if (CROPS[batch.crop].category === "weapon") state.tradeStats.weaponsToRebels += revenue;
    else if (CROPS[batch.crop].category === "food") state.tradeStats.foodToRebels += revenue;
  }
  if (batch.qty <= 0) {
    state.inventory = state.inventory.filter((item) => item.id !== batchId);
    delete saleQuantities[batchId];
  }
  setStatus(`${MARKETS[selectedMarket].name}で${CROPS[batch.crop].name}を${qty}個売却。₡${formatNumber(revenue)}を受領。`);
  toast(`売却成立 +₡${formatNumber(revenue)}`);
  playSoundFirst(["sell_crop", "sale"], premiumSale ? 0.42 : 0.34);
  hapticFeedback(premiumSale ? [12, 34, 12] : 14);
  burstEffect(saleSourceElement, premiumSale ? "#fff2a8" : "#f5d65b", premiumSale ? 28 : 18);
  const commsContext = {
    marketId: selectedMarket,
    marketName: MARKETS[selectedMarket]?.name || selectedMarket,
    cropId: batch.crop,
    cropName: CROPS[batch.crop]?.name || batch.crop,
    cropCategory: CROPS[batch.crop]?.category || "",
    qty,
    revenue,
    quality: batch.quality
  };
  triggerComms("first_sale", commsContext);
  triggerComms("sale", commsContext);
  if (selectedMarket === "medical" && CROPS[batch.crop].category === "medical") {
    triggerComms("medical_specialty_sale", commsContext);
  }
  checkFactionProgression();
  saveGame();
  render();
  saleRewardEffect({
    sourceElement: saleSourceElement,
    sourceRect: saleSourceRect,
    cropId: batch.crop,
    revenue,
    qty,
    quality: batch.quality,
    premium: premiumSale,
    fromMoney: moneyBeforeSale,
    toMoney: state.money
  });
}

function changeSaleQty(batchId, delta) {
  const batch = state.inventory.find((item) => item.id === batchId);
  if (!batch) return;
  saleQuantities[batchId] = Math.max(1, Math.min(batch.qty, (saleQuantities[batchId] || 1) + delta));
  renderInventory();
}

function processRealtimeGrowth(deltaDays) {
  const plants = activePlants().filter(({ plant }) => !plant.ready && !plant.dead);
  if (deltaDays <= 0) return;
  processDirt(deltaDays);
  if (!plants.length) return;

  const continuousPlants = plants.filter(({ shelf }) => GROW_UNITS[shelf.type]?.continuous);
  const requested = continuousPlants.reduce((total, { plant, shelf, baseId }) => {
    const crop = CROPS[plant.crop];
    const base = ownedBases().find((candidate) => candidate.id === baseId) || currentBase();
    const perf = unitPerformance(shelf, plant.crop, base);
    total.water += crop.water * RESOURCE_CONSUMPTION_RATE * perf.water * deltaDays;
    total.nutrient += crop.nutrient * RESOURCE_CONSUMPTION_RATE * perf.nutrient * (getUnitEffects(shelf).fan ? 0.9 : 1) * deltaDays;
    return total;
  }, { water: 0, nutrient: 0 });

  const waterRatio = requested.water > 0 ? Math.min(1, state.water / requested.water) : 1;
  const nutrientRatio = requested.nutrient > 0 ? Math.min(1, state.nutrient / requested.nutrient) : 1;
  state.water = Math.max(0, state.water - requested.water * waterRatio);
  state.nutrient = Math.max(0, state.nutrient - requested.nutrient * nutrientRatio);
  trackResourceGrowthUse(requested.water * waterRatio, requested.nutrient * nutrientRatio);

  plants.forEach(({ plant, shelf, baseId }) => {
    const base = ownedBases().find((candidate) => candidate.id === baseId) || currentBase();
    const perf = unitPerformance(shelf, plant.crop, base);
    const continuous = Boolean(GROW_UNITS[shelf.type]?.continuous);
    if (!continuous) {
      plant.growth += deltaDays * perf.growth;
      if (updatePlantVisualStage(plant)) farmRenderRequested = true;
      if (plant.growth >= CROPS[plant.crop].days) {
        plant.growth = CROPS[plant.crop].days;
        plant.ready = true;
        plant.readyPulseAt = Date.now();
        updatePlantVisualStage(plant);
        const effects = getUnitEffects(shelf);
        plant.quality = determineQuality(plant, effects.light, effects.fan, perf.qualityBonus);
      trackPlantReady(plant, shelf);
        toast(`${CROPS[plant.crop].name}が収穫可能になりました`);
        farmRenderRequested = true;
        playSound("crop_ready", 0.24);
      }
      return;
    }

    const noWater = waterRatio <= 0.001;
    const noNutrient = nutrientRatio <= 0.001;
    if (waterRatio < 0.999) plant.waterShortage = true;
    if (nutrientRatio < 0.999) plant.nutrientShortage = true;

    if (noWater && noNutrient) {
      plant.witherProgress = (plant.witherProgress || 0) + deltaDays;
      if (plant.witherProgress >= WITHER_DAYS) {
        plant.dead = true;
        trackDeadPlantAnalytics(plant, shelf, "wither");
        plant.ready = false;
        farmRenderRequested = true;
        playSound("plant_wither", 0.2);
      }
      return;
    }

    plant.witherProgress = Math.max(0, (plant.witherProgress || 0) - deltaDays * 0.5);
    const growthFactor = Math.max(0.25, Math.min(waterRatio, nutrientRatio));
    plant.growth += deltaDays * growthFactor * perf.growth;
    if (updatePlantVisualStage(plant)) farmRenderRequested = true;
    if (plant.growth >= CROPS[plant.crop].days) {
      plant.growth = CROPS[plant.crop].days;
      plant.ready = true;
      plant.readyPulseAt = Date.now();
      updatePlantVisualStage(plant);
      const effects = getUnitEffects(shelf);
      plant.quality = determineQuality(plant, effects.light, effects.fan, perf.qualityBonus);
        trackPlantReady(plant, shelf);
      toast(`${CROPS[plant.crop].name}が収穫可能になりました`);
      farmRenderRequested = true;
      playSound("crop_ready", 0.24);
    }
  });
}

function processDirt(deltaDays) {
  ownedBases().forEach((base) => {
    const baseEffects = baseTagEffects(base);
    [...base.shelves, ...base.floorDevices].forEach((item) => {
      const active = item.slots ? item.slots.some(Boolean) : item.placed;
      if (!active) return;
      const dirtMod = (unitTagEffects(item).dirtMod || 1) * (baseEffects.dirtMod || 1);
      const wasCleanEnough = !needsCleaning(item);
      item.dirt = Math.min(100, (item.dirt || 0) + deltaDays * 7 * dirtMod);
      if (wasCleanEnough && needsCleaning(item)) {
        farmRenderRequested = true;
        triggerComms("first_cleaning_needed", { kind: item.slots ? "unit" : "device", itemId: item.type });
      }
    });
  });
}

function needsCleaning(item) {
  return (item.dirt || 0) >= 60;
}

function cleanItem(kind, id, tool = "brush") {
  const collection = kind === "unit" ? currentShelves() : currentFloorDevices();
  const item = collection.find((entry) => entry.id === id);
  if (!item) return;
  const definition = kind === "unit" ? GROW_UNITS[item.type] : FLOOR_DEVICES[item.type];
  const target = document.querySelector(`[data-drag-kind="${kind}"][data-drag-id="${id}"]`);
  item.dirt = 0;
  setStatus(`${definition.name} cleaned. Dirt penalty removed.`);
  toast(`${definition.name} cleaned.`);
  if (tool === "bucket") {
    cleanSplashEffect(target);
    playSound("clean_bucket", 0.2);
  } else {
    brushCleanEffect(target);
    playSound("clean_brush", 0.14);
  }
  saveGame();
  render();
}

function currentBaseElementSelector(kind, id) {
  return `[data-drag-kind="${kind}"][data-drag-id="${id}"]`;
}

function addInventoryFromPlant(plant) {
  const existing = state.inventory.find((batch) => batch.crop === plant.crop && batch.quality === plant.quality && batch.degraded === plant.degraded && batch.age === 0);
  if (existing) existing.qty += 1;
  else state.inventory.push({ id: `${Date.now()}-${Math.random()}`, crop: plant.crop, quality: plant.quality, qty: 1, age: 0, degraded: plant.degraded });
}

function harvestPlantByRobot(base, unit, slotIndex, robot) {
  const plant = unit.slots?.[slotIndex];
  if (!plant?.ready) return false;
  addInventoryFromPlant(plant);
  trackHarvestAnalytics(plant, unit, 1);
  if (plant.crop === "tomato") state.tomatoHarvested = true;
  unit.slots[slotIndex] = null;
  farmRenderRequested = true;
  state.marketTabUnlocked = true;
  const target = base.id === currentBase().id ? document.querySelector(`[data-shelf="${currentShelves().findIndex((entry) => entry.id === unit.id)}"][data-slot="${slotIndex}"]`) : null;
  if (target) {
    burstEffect(target, QUALITY[plant.quality]?.color || "#72ffb8", 12);
    floatingFeedback(target, "BOT +1", QUALITY[plant.quality]?.color || "#72ffb8", "harvest small");
  }
  botActionLog(`BOT // ${CROPS[plant.crop]?.name || plant.crop} harvested.`);
  playSound("harvest_single", 0.12);
  triggerComms("first_harvest", { cropId: plant.crop, cropName: CROPS[plant.crop]?.name || plant.crop, quality: plant.quality, unitType: unit.type, unitName: GROW_UNITS[unit.type]?.name || unit.type, qty: 1 });
  triggerComms("harvest", { cropId: plant.crop, cropName: CROPS[plant.crop]?.name || plant.crop, quality: plant.quality, unitType: unit.type, unitName: GROW_UNITS[unit.type]?.name || unit.type, qty: 1 });
  return true;
}

function cleanItemByRobot(base, kind, item, robot) {
  if (!needsCleaning(item)) return false;
  item.dirt = 0;
  const target = base.id === currentBase().id ? document.querySelector(currentBaseElementSelector(kind, item.id)) : null;
  if (target) brushCleanEffect(target);
  botActionLog(`BOT // ${kind === "unit" ? GROW_UNITS[item.type]?.name : FLOOR_DEVICES[item.type]?.name} cleaned.`);
  playSound("clean_brush", 0.1);
  return true;
}

function plantSeedByRobot(base, unit, slotIndex, cropId, robot) {
  const crop = CROPS[cropId];
  if (!crop || !unit?.placed || unit.slots?.[slotIndex]) return false;
  if ((state.seeds[cropId] || 0) <= 0) return false;
  const plantingCost = plantingResourceCost(cropId, unit);
  if (state.water < plantingCost.water || state.nutrient < plantingCost.nutrient) return false;
  state.water -= plantingCost.water;
  state.nutrient -= plantingCost.nutrient;
  state.seeds[cropId] -= 1;
  const plantedAt = Date.now();
  unit.slots[slotIndex] = {
    id: makeId("plant"),
    crop: cropId,
    growth: 0,
    ready: false,
    readyAge: 0,
    degraded: false,
    waterShortage: false,
    nutrientShortage: false,
    witherProgress: 0,
    dead: false,
    visualStage: 1,
    stagePulseAt: plantedAt,
    prepaid: !GROW_UNITS[unit.type].continuous,
    quality: null
  };
  const shelfIndex = base.shelves.findIndex((entry) => entry.id === unit.id);
  trackPlanting(cropId, unit, shelfIndex, slotIndex, plantingCost);
  const target = base.id === currentBase().id ? document.querySelector(`[data-shelf="${shelfIndex}"][data-slot="${slotIndex}"]`) : null;
  if (target) {
    burstEffect(target, crop.color, 12);
    floatingFeedback(target, "BOT PLANT", crop.color, "small");
  }
  botActionLog(`BOT // ${crop.name} planted.`);
  playSound("plant_seed", 0.12);
  triggerComms("first_plant", { cropId, cropName: crop.name, unitType: unit.type, unitName: GROW_UNITS[unit.type]?.name || unit.type, shelfIndex, slotIndex, automated: true });
  triggerComms("plant", { cropId, cropName: crop.name, unitType: unit.type, unitName: GROW_UNITS[unit.type]?.name || unit.type, shelfIndex, slotIndex, automated: true });
  return true;
}

function configuredProcurementEntries() {
  ensureSupportAutomationState();
  return Object.entries(state.automation.procurement.byCrop || {})
    .filter(([cropId, config]) => CROPS[cropId] && config.enabled);
}

function configuredShippingEntries() {
  ensureSupportAutomationState();
  return Object.entries(state.automation.shipping.byCrop || {})
    .filter(([cropId, config]) => CROPS[cropId] && config.enabled);
}

function buySeedsByRobot() {
  const entry = configuredProcurementEntries().find(([cropId, config]) => {
    const crop = CROPS[cropId];
    if (!crop || !isUnlocked("seed_item", cropId)) return false;
    const targetSeeds = crop.packSize * Math.max(1, config.packs || 1);
    return (state.seeds[cropId] || 0) < targetSeeds && state.money >= crop.seedPrice;
  });
  if (!entry) return false;
  const [cropId] = entry;
  const crop = CROPS[cropId];
  state.money -= crop.seedPrice;
  state.seeds[cropId] = (state.seeds[cropId] || 0) + crop.packSize;
  trackPurchase("seed", cropId, crop.seedPrice, { itemName: crop.name, packSize: crop.packSize, automated: true });
  botActionLog(`BOT // ${crop.name} seed pack purchased.`);
  playSound("buy_seed", 0.11);
  return true;
}

function sellInventoryByRobot(cropId, marketId) {
  if (!isMarketAvailable(marketId) || !MARKETS[marketId]?.accepts.includes(cropId)) return false;
  const batches = state.inventory.filter((item) => item.crop === cropId && Math.max(0, Number(item.qty) || 0) > 0);
  if (!batches.length) return false;

  let totalQty = 0;
  let totalRevenue = 0;
  let premiumSale = false;
  batches.forEach((batch) => {
    const amount = Math.max(0, Number(batch.qty) || 0);
    const unitPrice = getUnitPrice(batch, marketId);
    const revenue = unitPrice * amount;
    if (amount <= 0) return;
    totalQty += amount;
    totalRevenue += revenue;
    premiumSale = premiumSale || unitPrice >= bestAvailableQuote(batch) * 0.98;
    trackSaleAnalytics(batch, marketId, amount, unitPrice, revenue, unitPrice >= bestAvailableQuote(batch) * 0.98);
    batch.qty = 0;
  });

  if (totalQty <= 0) return false;
  state.money += totalRevenue;
  state.inventory = state.inventory.filter((item) => item.crop !== cropId || item.qty > 0);
  state.tradeStats.byCrop ||= {};
  state.tradeStats.byMarket ||= { lower: 0, medical: 0, upper: 0, rebel: 0 };
  state.tradeStats.unitsSold = (Number(state.tradeStats.unitsSold) || 0) + totalQty;
  state.tradeStats.revenue = (Number(state.tradeStats.revenue) || 0) + totalRevenue;
  state.tradeStats.byCrop[cropId] = (state.tradeStats.byCrop[cropId] || 0) + totalQty;
  state.tradeStats.byMarket[marketId] = (state.tradeStats.byMarket[marketId] || 0) + totalRevenue;
  state.tradeStats.byMarketQty ||= { lower: 0, medical: 0, upper: 0, rebel: 0 };
  state.tradeStats.byMarketQty[marketId] = (state.tradeStats.byMarketQty[marketId] || 0) + totalQty;
  if (marketId === "rebel") {
    if (CROPS[cropId]?.category === "weapon") state.tradeStats.weaponsToRebels += totalQty;
    else state.tradeStats.foodToRebels += totalQty;
  }

  const cropName = CROPS[cropId]?.name || cropId;
  const marketName = MARKETS[marketId]?.name || marketId;
  botActionLog(`BOT // ${cropName} shipped to ${marketName}. x${totalQty} +C${formatNumber(totalRevenue)}`);
  playSoundFirst(["sell_crop", "sale"], premiumSale ? 0.18 : 0.12);
  triggerComms("first_sale", { cropId, cropName, marketId, marketName, qty: totalQty, revenue: totalRevenue, automated: true });
  triggerComms("sale", { cropId, cropName, marketId, marketName, qty: totalQty, revenue: totalRevenue, automated: true });
  return true;
}
function sellConfiguredInventoryByRobot() {
  let soldAny = false;
  configuredShippingEntries().forEach(([cropId, config]) => {
    if (!MARKETS[config.marketId]?.accepts.includes(cropId) || !isMarketAvailable(config.marketId)) return;
    const hasStock = state.inventory.some((item) => item.crop === cropId && Math.max(0, Number(item.qty) || 0) > 0);
    if (!hasStock) return;
    if (sellInventoryByRobot(cropId, config.marketId)) soldAny = true;
  });
  return soldAny;
}

function findSupportHarvestTarget(base, robot) {
  ensureSupportRobotProfile(robot);
  if (!state.supportOS?.harvest || !robot.harvestAutomation?.enabled) return null;
  for (const unit of base.shelves) {
    if (!unit.placed || !supportRobotCanReach(robot, unit, "unit")) continue;
    const slotIndex = unit.slots.findIndex((plant) => plant?.ready);
    if (slotIndex >= 0) return { unit, slotIndex };
  }
  return null;
}

function findSupportPlantingTarget(base, robot) {
  ensureSupportRobotProfile(robot);
  const planting = robot.plantingAutomation || {};
  if (!state.supportOS?.planting || !planting.enabled) return null;
  const cropId = CROPS[planting.cropId] ? planting.cropId : "lettuce";
  if ((state.seeds[cropId] || 0) <= 0) return null;
  for (const unit of base.shelves) {
    if (!unit.placed || !supportRobotCanReach(robot, unit, "unit")) continue;
    const slotIndex = unit.slots.findIndex((plant) => !plant);
    if (slotIndex < 0) continue;
    const plantingCost = plantingResourceCost(cropId, unit);
    if (state.water < plantingCost.water || state.nutrient < plantingCost.nutrient) return null;
    return { unit, slotIndex, cropId };
  }
  return null;
}

function findSupportCleaningTarget(base, robot) {
  if (!state.supportOS?.cleaning) return null;
  const unit = base.shelves.find((item) => item.placed && needsCleaning(item) && supportRobotCanReach(robot, item, "unit"));
  if (unit) return { kind: "unit", item: unit };
  const device = base.floorDevices.find((item) => item.placed && needsCleaning(item) && supportRobotCanReach(robot, item, "device"));
  if (device) return { kind: "device", item: device };
  return null;
}

function baseHasReachableDevice(base, robot, type) {
  return base.floorDevices.some((device) => device.type === type && device.placed && supportRobotCanReach(robot, device, "device"));
}
function reachableSupportRobotCountForDevice(type, base = currentBase()) {
  return base.floorDevices.filter((device) => device.type === "support_robot" && device.placed && baseHasReachableDevice(base, device, type)).length;
}

function supportAutomationRunHint(type) {
  if (!state.timeUnlocked) return "ゲーム内時間が始まると自動処理が動きます。";
  if (state.paused) return "現在は一時停止中です。再開すると自動処理が動きます。";
  const reachable = reachableSupportRobotCountForDevice(type);
  if (reachable <= 0) return "この拠点では、搬出口の範囲内にサポートロボットがいません。";
  return `搬出口に接続できるサポートロボット: ${reachable}体`;
}


function processSupportRobots(deltaDays) {
  ensureSupportAutomationState();
  if (!state.timeUnlocked || state.ended || state.paused) return;
  let acted = false;
  ownedBases().forEach((base) => {
    base.floorDevices.filter((device) => device.type === "support_robot" && device.placed).forEach((robot) => {
      ensureSupportRobotProfile(robot);
      tickSupportRobotCooldowns(robot, deltaDays);
      robot.supportEnergy = Math.min(SUPPORT_ROBOT_MAX_ENERGY, (Number(robot.supportEnergy) || 0) + deltaDays * 18);

      const tryTask = (task, action) => {
        if (!supportRobotTaskReady(robot, task)) return false;
        if (!action()) return false;
        spendSupportRobotAction(robot, task);
        acted = true;
        return true;
      };

      const actions = [
        ["harvest", () => {
          const harvestTarget = findSupportHarvestTarget(base, robot);
          return Boolean(harvestTarget && harvestPlantByRobot(base, harvestTarget.unit, harvestTarget.slotIndex, robot));
        }],
        ["ship", () => (
          baseHasReachableDevice(base, robot, "shipping_hatch") && sellConfiguredInventoryByRobot()
        )],
        ["plant", () => {
          const plantingTarget = findSupportPlantingTarget(base, robot);
          return Boolean(plantingTarget && plantSeedByRobot(base, plantingTarget.unit, plantingTarget.slotIndex, plantingTarget.cropId, robot));
        }],
        ["cleaning", () => {
          const cleaningTarget = findSupportCleaningTarget(base, robot);
          return Boolean(cleaningTarget && cleanItemByRobot(base, cleaningTarget.kind, cleaningTarget.item, robot));
        }],
        ["procure", () => (
          baseHasReachableDevice(base, robot, "procurement_terminal") && buySeedsByRobot()
        )]
      ];

      actions.some(([task, action]) => tryTask(task, action));
    });
  });
  if (acted) {
    if (document.getElementById("farm-screen")?.classList.contains("active")) {
      farmRenderRequested = false;
      renderFarm();
    } else {
      farmRenderRequested = true;
    }
    if (document.getElementById("market-screen")?.classList.contains("active")) renderMarkets();
    if (document.getElementById("shop-screen")?.classList.contains("active")) renderShop();
    const activeModalTitle = document.getElementById("modal-backdrop")?.classList.contains("hidden")
      ? ""
      : document.getElementById("modal-title")?.textContent;
    if (activeModalTitle === "自動出荷設定") showShippingTerminal();
    if (activeModalTitle === "自動種子調達") showProcurementTerminal();
    renderHeader();
    saveGame();
    checkVictory();
  }
}

function automationButtonClass(active) {
  return active ? "secondary-button active" : "secondary-button";
}

function supportRobotHarvestPanel(device) {
  ensureSupportRobotProfile(device);
  const config = device.harvestAutomation || { enabled: true };
  const locked = !state.supportOS?.harvest;
  return `<div class="automation-config compact-config robot-harvest-config">
    <div class="automation-section"><h4>自動収穫設定</h4>
      ${locked ? `<div class="automation-detail-card"><p class="automation-hint">収穫OSを購入すると、このロボットごとの自動収穫を切り替えられます。</p></div>` : `<div class="automation-detail-card">
        <div class="automation-row compact"><strong>収穫AI</strong><button class="${automationButtonClass(config.enabled)}" data-auto-action="robot-harvest-toggle" data-robot-id="${device.id}">${config.enabled ? "ONLINE" : "OFFLINE"}</button></div>
        <small class="automation-hint">ONLINE中は、この個体の行動範囲内に収穫可能な株があれば、一株ずつ収穫します。</small>
      </div>`}
    </div>
  </div>`;
}
function supportRobotPlantingPanel(device) {
  ensureSupportRobotProfile(device);
  const config = device.plantingAutomation || { enabled: false, cropId: "lettuce" };
  const cropId = CROPS[config.cropId] ? config.cropId : "lettuce";
  const locked = !state.supportOS?.planting;
  const cropButtons = Object.entries(CROPS).map(([entryCropId, crop]) => {
    const seedLocked = !isUnlocked("seed_item", entryCropId);
    return `<button class="${automationButtonClass(entryCropId === cropId)}" data-auto-action="robot-plant-select" data-robot-id="${device.id}" data-crop-id="${entryCropId}" ${locked || seedLocked ? "disabled" : ""}>${escapeHtml(crop.name)}</button>`;
  }).join("");
  return `<div class="automation-config compact-config robot-planting-config">
    <div class="automation-section"><h4>自動植え付け設定</h4>
      <p>このロボット個体が範囲内の空きスロットへ植える種を指定します。種と水と養液がある限り、一株ずつ植え付けます。</p>
      ${locked ? `<div class="automation-detail-card"><p class="automation-hint">植え付けOSを購入すると、このロボットごとの自動植え付け設定を変更できます。</p></div>` : `<div class="automation-buttons crop-selector">${cropButtons}</div>
      <div class="automation-detail-card">
        ${selectedAutomationCropCard(cropId, "procurement")}
        <div class="automation-row compact"><strong>植え付けAI</strong><button class="${automationButtonClass(config.enabled)}" data-auto-action="robot-plant-toggle" data-robot-id="${device.id}" data-crop-id="${cropId}">${config.enabled ? "ONLINE" : "OFFLINE"}</button></div>
        <small class="automation-hint">ONLINE中は、この個体の行動範囲内に空きスロットがあれば、選択中の種をあるだけ植えていきます。</small>
      </div>`}
    </div>
  </div>`;
}

function showSupportRobotPanel(device) {
  ensureSupportRobotProfile(device);
  const skill = supportRobotSkill(device);
  const personality = supportRobotPersonality(device);
  const html = `<div class="device-detail support-automation-panel"><img src="${FLOOR_DEVICES.support_robot?.sprite || FLOOR_DEVICES.support_robot?.icon}" alt=""><div><h3>${escapeHtml(FLOOR_DEVICES.support_robot?.name || "Support Robot")}</h3><p>特技: ${escapeHtml(skill.name || device.robotSkillId)} // 収穫${supportTaskGrade(device, "harvest")} 植付${supportTaskGrade(device, "plant")} 清掃${supportTaskGrade(device, "cleaning")} 調達${supportTaskGrade(device, "procure")} 出荷${supportTaskGrade(device, "ship")}</p><p>性格: ${escapeHtml(personality.name || device.robotPersonalityId)} // 範囲 ${supportRobotRange(device)} / ENERGY ${Math.round(Number(device.supportEnergy) || 0)}%</p><p>OS: 収穫 ${state.supportOS.harvest ? "ONLINE" : "LOCKED"} / 植付 ${state.supportOS.planting ? "ONLINE" : "LOCKED"} / 清掃 ${state.supportOS.cleaning ? "ONLINE" : "LOCKED"}</p></div></div>${supportRobotHarvestPanel(device)}${supportRobotPlantingPanel(device)}`;
  showModal("SUPPORT ROBOT", "支援ロボット個体情報", html, true, false, "閉じる");
}
function cropChoiceButtons(actionPrefix, selectedCropId, { seedLocked = false } = {}) {
  return Object.entries(CROPS).map(([cropId, crop]) => {
    const locked = seedLocked && !isUnlocked("seed_item", cropId);
    return `<button class="${automationButtonClass(cropId === selectedCropId)}" data-auto-action="${actionPrefix}" data-crop-id="${cropId}" ${locked ? "disabled" : ""}>${escapeHtml(crop.name)}</button>`;
  }).join("");
}

function cropStockCount(cropId) {
  return state.inventory.filter((item) => item.crop === cropId).reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0);
}

function selectedAutomationCropCard(cropId, mode) {
  const crop = CROPS[cropId] || CROPS.lettuce;
  const subline = mode === "shipping"
    ? `STOCK ${cropStockCount(cropId)}`
    : `SEED ${state.seeds[cropId] || 0} / PACK ${crop.packSize}`;
  return `<div class="automation-selected-crop" style="--crop-color:${crop.color}">
    <img src="${crop.icon}" alt="">
    <div><strong>${escapeHtml(crop.name)}</strong><small>${subline}</small><p>${escapeHtml(crop.note || "")}</p></div>
  </div>`;
}

function procurementSelectedPanel() {
  const cropId = CROPS[state.automation.procurement.selectedCropId] ? state.automation.procurement.selectedCropId : "lettuce";
  const crop = CROPS[cropId];
  const config = state.automation.procurement.byCrop[cropId] || { enabled: false, packs: 1 };
  const locked = !isUnlocked("seed_item", cropId);
  return `<div class="automation-detail-card">
    ${selectedAutomationCropCard(cropId, "procurement")}
    <div class="automation-row compact"><strong>調達</strong><button class="${automationButtonClass(config.enabled)}" data-auto-action="proc-toggle" data-crop-id="${cropId}" ${locked ? "disabled" : ""}>${locked ? "LOCKED" : config.enabled ? "ONLINE" : "OFFLINE"}</button></div>
    <div class="automation-row compact"><strong>PACKS</strong><span class="automation-stepper"><button class="secondary-button" data-auto-action="proc-packs" data-crop-id="${cropId}" data-delta="-1" ${locked ? "disabled" : ""}>-</button><strong>${config.packs}</strong><button class="secondary-button" data-auto-action="proc-packs" data-crop-id="${cropId}" data-delta="1" ${locked ? "disabled" : ""}>+</button></span></div>
    <small class="automation-hint">${locked ? "この種はまだ購入できません。" : `目標 ${crop.packSize * config.packs}粒を下回ると1パックずつ購入します。`}</small>
  </div>`;
}
function shippingMarketButtons(cropId, selectedMarketId) {
  return Object.entries(MARKETS).map(([marketId, market]) => `<button class="${automationButtonClass(marketId === selectedMarketId)}" data-auto-action="ship-market" data-crop-id="${cropId}" data-market-id="${marketId}" ${isMarketAvailable(marketId) && market.accepts.includes(cropId) ? "" : "disabled"}>${escapeHtml(market.name)}</button>`).join("");
}

function shippingSelectedPanel() {
  const cropId = CROPS[state.automation.shipping.selectedCropId] ? state.automation.shipping.selectedCropId : "lettuce";
  const config = state.automation.shipping.byCrop[cropId] || { enabled: false, marketId: "lower", qty: 1 };
  return `<div class="automation-detail-card">
    ${selectedAutomationCropCard(cropId, "shipping")}
    <div class="automation-row compact"><strong>出荷</strong><button class="${automationButtonClass(config.enabled)}" data-auto-action="ship-toggle" data-crop-id="${cropId}">${config.enabled ? "ONLINE" : "OFFLINE"}</button></div>
    <div class="automation-row compact market-row"><strong>MARKET</strong><div class="automation-buttons market-buttons">${shippingMarketButtons(cropId, config.marketId)}</div></div>
    <p class="automation-hint">在庫がある場合、この作物を一括で自動出荷します。</p>
    <small class="automation-hint">${supportAutomationRunHint("shipping_hatch")}</small>
  </div>`;
}
function showProcurementTerminal() {
  ensureSupportAutomationState();
  const selectedCropId = state.automation.procurement.selectedCropId;
  const html = `<div class="automation-config compact-config"><p>SEEDで作物を選び、種子の自動調達だけを作物ごとに設定します。植え付けAIは各サポートロボットをクリックして設定します。</p>
    <div class="automation-section"><h4>SEED</h4><div class="automation-buttons crop-selector">${cropChoiceButtons("proc-select", selectedCropId)}</div>${procurementSelectedPanel()}</div></div>`;
  showModal("PROCUREMENT TERMINAL", "自動種子調達", html, true, false, "閉じる");
}
function showShippingTerminal() {
  ensureSupportAutomationState();
  const selectedCropId = state.automation.shipping.selectedCropId;
  const html = `<div class="automation-config compact-config"><p>CROPで作物を選び、作物ごとに出荷ON/OFFと販売先を設定します。出荷時は指定作物の在庫を一括で売却します。</p>
    <div class="automation-section"><h4>CROP</h4><div class="automation-buttons crop-selector">${cropChoiceButtons("ship-select", selectedCropId)}</div>${shippingSelectedPanel()}</div></div>`;
  showModal("SHIPPING HATCH", "自動出荷設定", html, true, false, "閉じる");
}
function handleAutomationControl(button) {
  ensureSupportAutomationState();
  const action = button.dataset.autoAction;
  const cropId = button.dataset.cropId;

  if (action === "robot-harvest-toggle") {
    const robot = findSupportRobotById(button.dataset.robotId);
    if (!robot || !state.supportOS?.harvest) return;
    ensureSupportRobotProfile(robot);
    robot.harvestAutomation.enabled = !robot.harvestAutomation.enabled;
    playSound("tab_switch", 0.08);
    saveGame();
    showSupportRobotPanel(robot);
    return;
  }

  if (action?.startsWith("robot-plant")) {
    const robot = findSupportRobotById(button.dataset.robotId);
    if (!robot || !state.supportOS?.planting) return;
    ensureSupportRobotProfile(robot);
    if (action === "robot-plant-select" && CROPS[cropId]) robot.plantingAutomation.cropId = cropId;
    if (action === "robot-plant-toggle") {
      const targetCropId = CROPS[cropId] ? cropId : robot.plantingAutomation.cropId;
      robot.plantingAutomation.cropId = targetCropId;
      robot.plantingAutomation.enabled = !(robot.plantingAutomation.enabled && robot.plantingAutomation.cropId === targetCropId);
    }
    playSound("tab_switch", 0.08);
    saveGame();
    showSupportRobotPanel(robot);
    return;
  }

  if (action === "proc-select" && CROPS[cropId]) state.automation.procurement.selectedCropId = cropId;
  if (action === "ship-select" && CROPS[cropId]) state.automation.shipping.selectedCropId = cropId;
  if (action === "proc-toggle" && CROPS[cropId]) state.automation.procurement.byCrop[cropId].enabled = !state.automation.procurement.byCrop[cropId].enabled;
  if (action === "proc-packs" && CROPS[cropId]) state.automation.procurement.byCrop[cropId].packs = Math.max(1, Math.min(12, state.automation.procurement.byCrop[cropId].packs + Number(button.dataset.delta || 0)));
  if (action === "ship-toggle" && CROPS[cropId]) state.automation.shipping.byCrop[cropId].enabled = !state.automation.shipping.byCrop[cropId].enabled;
  if (action === "ship-market" && CROPS[cropId] && MARKETS[button.dataset.marketId]) state.automation.shipping.byCrop[cropId].marketId = button.dataset.marketId;
  playSound("tab_switch", 0.08);
  saveGame();
  if (action.startsWith("ship")) showShippingTerminal();
  else showProcurementTerminal();
}

function adjustEnvironment(key, delta) {
  const base = currentBase();
  base.environment ||= { ...DEFAULT_ENVIRONMENT };
  const ranges = {
    temp: [16, 32],
    humidity: [35, 85],
    co2: [450, 1100]
  };
  const [min, max] = ranges[key] || [0, 9999];
  base.environment[key] = Math.max(min, Math.min(max, base.environment[key] + delta));
  setStatus(`${base.name} environment updated: temp ${base.environment.temp}C / humidity ${base.environment.humidity}% / CO2 ${base.environment.co2}ppm.`);
  playSound("environment_adjust", 0.12);
  saveGame();
  renderFarm();
}

function processDayBoundary() {
  if (state.ended) return;
  activePlants().forEach(({ plant }) => {
    if (plant.ready) {
      plant.readyAge += 1;
      const degradeAfter = state.equipment.fridge ? 6 : 3;
      if (plant.readyAge >= degradeAfter) plant.degraded = true;
    }
  });

  const degradeAfter = state.equipment.fridge ? 6 : 3;
  state.inventory.forEach((batch) => {
    batch.age += 1;
    if (batch.age >= degradeAfter) batch.degraded = true;
  });

  const upkeep = dailyUpkeep();
  state.money -= upkeep;
  if (state.money < 0) state.consecutiveDebtDays += 1;
  else state.consecutiveDebtDays = 0;

  state.day += 1;
  if (state.mode === "day30" && state.day > 30) {
    finalizeDay30Run({ completed: true, playedDays: 30 });
    return;
  }
  const operationFailed = state.money <= -500 || state.consecutiveDebtDays >= 3;
  if (operationFailed && state.mode === "day30") {
    finalizeDay30Run({ completed: false, playedDays: state.day, mode: state.mode });
    return;
  }
  if (operationFailed && state.mode !== "free") {
    state.ended = true;
    state.paused = true;
    showEndReport();
  } else {
    updateMarketForDay();
    setStatus(`DAY ${state.day} 開始：維持費 ₡${upkeep}を支払いました。`);
    toast(`DAY ${String(state.day).padStart(2, "0")} 開始`);
    if (state.mode === "normal" && state.day > 30 && !state.prototypeReportShown) {
      state.prototypeReportShown = true;
      setStatus("30 day evaluation complete. Endless mode begins.");
      toast("Notification.");
    }
    checkVictory();
  }

  saveGame();
  render();
}

function realtimeTick() {
  const now = Date.now();
  const elapsedMs = Math.min(1000, now - lastTickAt);
  lastTickAt = now;
  if (startScreenOpen) return;
  if (state.ended || state.paused) {
    if (now - lastRenderAt >= 500) {
      renderRuntime();
      lastRenderAt = now;
    }
    return;
  }

  const deltaDays = elapsedMs / REALTIME_DAY_MS;
  processRealtimeGrowth(deltaDays);
  processSupportRobots(deltaDays);
  if (!state.timeUnlocked) {
    state.dayProgress = 0;
    if (now - lastRenderAt >= 350) {
      renderRuntime();
      lastRenderAt = now;
    }
    if (now - lastAutosaveAt >= 5000) {
      saveGame();
      lastAutosaveAt = now;
    }
    return;
  }
  state.dayProgress += deltaDays;
  while (state.dayProgress >= 1 && !state.ended) {
    state.dayProgress -= 1;
    processDayBoundary();
  }

  if (now - lastRenderAt >= 350) {
    renderRuntime();
    lastRenderAt = now;
  }
  if (now - lastAutosaveAt >= 5000) {
    saveGame();
    lastAutosaveAt = now;
  }
}

function togglePause() {
  if (state.ended || !state.timeUnlocked) {
    setStatus("Tutorial link active. The day clock is locked, but plants continue growing.");
    return;
  }
  state.paused = !state.paused;
  lastTickAt = Date.now();
  setStatus(state.paused ? "Paused." : "Realtime growth resumed.");
  saveGame();
  render();
}

function checkVictory() {
  checkFactionProgression();
}

function reportMarkup() {
  const planted = activePlants().length;
  const inventoryCount = state.inventory.reduce((sum, item) => sum + item.qty, 0);
  return `<div class="modal-report">
    <div><span>到達日</span><strong>DAY ${Math.min(state.day, 30)}</strong></div>
    <div><span>所持金</span><strong>₡${formatNumber(state.money)}</strong></div>
    <div><span>栽培設備</span><strong>P${unitCount("pod")} / B${unitCount("box")}</strong></div>
    <div><span>栽培中 / 在庫</span><strong>${planted} / ${inventoryCount}</strong></div>
  </div>`;
}

function showEndReport() {
  let title = "Operation Ended";
  let copy = "The underground farm can no longer continue.";
  let kicker = "OPERATION CLOSED";
  if (state.money <= -500) {
    title = "Supply Network Collapse";
    copy = "Debt crossed the limit and supply routes stopped.";
  } else if (state.consecutiveDebtDays >= 3) {
    title = "Maintenance Failed";
    copy = "Three deficit days pushed collaborators away.";
  }
  showModal(kicker, title, `<p class="modal-copy">${copy}</p>${reportMarkup()}`, false);
}

function finalizeDay30Run({ completed = false, playedDays = state.day, mode = state.mode } = {}) {
  state.ended = true;
  state.paused = true;
  const summary = recordDay30Run({ completed, playedDays, mode }) || createDay30Summary({
    completed,
    playedDays,
    mode,
    id: state.day30RecordId || undefined
  });
  if (summary.mode === "free") setStartModeView("free");
  else if (summary.mode === "day30") setStartModeView("day30");
  pendingDay30RecordId = summary.id;
  showDay30Report(summary);
  saveGame();
  render();
}

function randomResultTitle(summary) {
  const titles = Array.isArray(summary?.titles) ? summary.titles.filter(Boolean) : [];
  if (!titles.length) return "\u9055\u6cd5\u30ec\u30bf\u30b9\u8fb2\u5bb6";
  return titles[Math.floor(Math.random() * titles.length)];
}

function publicGameUrl() {
  const host = window.location.hostname;
  if (!host || host === "127.0.0.1" || host === "localhost") return PUBLIC_GAME_URL;
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/index\.html$/i, "");
  return url.href;
}

function currentDay30Record() {
  if (!pendingDay30RecordId) return null;
  for (const mode of ["day30", "free"]) {
    const record = readPlayRecords(mode).find((entry) => entry.id === pendingDay30RecordId);
    if (record) return record;
  }
  return null;
}

function currentResultSummary() {
  applyDay30PlayerName();
  return currentDay30Record() || createDay30Summary({
    id: pendingDay30RecordId || undefined,
    mode: state.mode || "day30",
    completed: state.ended,
    playedDays: state.mode === "day30" ? Math.min(30, state.day) : state.day,
    playerName: currentDay30PlayerName()
  });
}

function xShareDraft(summary) {
  const title = randomResultTitle(summary);
  return "\u3042\u306a\u305f\u306f\u9055\u6cd5\u30ec\u30bf\u30b9\u3092\u58f2\u3063\u3066\u3001"
    + formatNumber(summary.revenue || 0)
    + "\u5186\u7a3c\u304e\u3001"
    + title
    + "\u3068\u547c\u3070\u308c\u307e\u3057\u305f\u3002\n#UnderGreen #\u9055\u6cd5\u30ec\u30bf\u30b9\u683d\u57f9\n"
    + publicGameUrl();
}

function openXShareDraft() {
  const summary = currentResultSummary();
  const textValue = xShareDraft(summary);
  legacyCopyToClipboard(textValue);
  window.open("https://twitter.com/intent/tweet?text=" + encodeURIComponent(textValue), "_blank", "noopener,noreferrer");
  toast("X post draft opened.");
}

function latestPlayRecordForExport() {
  return [...readDay30Records(), ...readFreeRecords()]
    .sort((a, b) => String(b.recordedAt || "").localeCompare(String(a.recordedAt || "")))[0] || null;
}

function googleFormExportPayload() {
  const records = playRecordsExportPayload();
  const latest = latestPlayRecordForExport();
  return {
    recordJson: JSON.stringify(records),
    day30Count: String(records.records.day30.length),
    freeCount: String(records.records.free.length),
    latestRevenue: latest ? String(latest.revenue || 0) : "0",
    latestTitles: latest?.titles?.join(" / ") || ""
  };
}

function googleFormConfigured() {
  return Boolean(GOOGLE_FORM_PREFILL_URL && Object.values(GOOGLE_FORM_FIELDS).some(Boolean));
}

function googleFormPrefillUrl() {
  const url = new URL(GOOGLE_FORM_PREFILL_URL);
  const payload = googleFormExportPayload();
  Object.entries(GOOGLE_FORM_FIELDS).forEach(([key, entryId]) => {
    if (!entryId || payload[key] === undefined) return;
    url.searchParams.set(entryId, payload[key]);
  });
  return url.href;
}

function openGoogleFormRecordExport() {
  const payload = googleFormExportPayload();
  if (!googleFormConfigured()) {
    showModal("FORM SETUP", "Google Form setting required", `<p class="modal-copy">Set GOOGLE_FORM_PREFILL_URL and GOOGLE_FORM_FIELDS in game.js. The payload below is what will be sent.</p><textarea class="record-export-field" readonly>${escapeHtml(JSON.stringify(payload, null, 2))}</textarea>`, true);
    document.getElementById("modal-reset").style.display = "none";
    window.setTimeout(() => {
      const field = document.querySelector(".record-export-field");
      if (field) field.select();
    }, 0);
    return;
  }
  window.open(googleFormPrefillUrl(), "_blank", "noopener,noreferrer");
  toast("Google Form opened.");
}
function day30ReportMarkup(summary) {
  const status = summary.completed ? "完走" : "途中終了";
  return `<p class="modal-copy">DAY30モードの記録を保存しました。名前はこの端末の記録一覧に表示されます。</p>
  <label class="day30-name-field">
    <span>PLAYER NAME</span>
    <input id="day30-player-name" type="text" maxlength="18" value="${escapeHtml(summary.playerName || "")}" placeholder="名前を入力">
  </label>
  <div class="modal-report">
    <div><span>到達</span><strong>${status} / DAY ${summary.day}</strong></div>
    <div><span>累計稼得金額</span><strong>₡${formatNumber(summary.revenue)}</strong></div>
    <div><span>最多作物</span><strong>${cropLabel(summary.topCropId)} x${summary.topCropQty || 0}</strong></div>
    <div><span>設備 / 不動産</span><strong>${summary.equipmentCount} / ${summary.propertyCount}</strong></div>
    <div><span>最多市場(金)</span><strong>${marketLabel(summary.topMarketRevenueId)} ₡${formatNumber(summary.topMarketRevenue)}</strong></div>
    <div><span>最多市場(量)</span><strong>${marketLabel(summary.topMarketQtyId)} x${summary.topMarketQty || 0}</strong></div>
  </div>
  <p class="modal-copy">称号: ${summary.titles.length ? summary.titles.join(" / ") : "なし"}</p>
  <div class="day30-share-actions">
    <button class="secondary-button" data-day30-result="share-x">X POST DRAFT</button>
  </div>
  <div class="day30-result-actions">
    <button class="secondary-button" data-day30-result="start">スタートへ戻る</button>
    <button class="primary-button" data-day30-result="view">閲覧モード</button>
  </div>`;
}

function showDay30Report(summary) {
  const isFreeResult = summary.mode === "free";
  showModal("DAY30 RESULT", "DAY30モード終了", day30ReportMarkup(summary), false);
  if (isFreeResult) {
    document.getElementById("modal-kicker").textContent = "FREE RESULT";
    document.getElementById("modal-title").textContent = "フリーモード終了";
  }
  document.getElementById("modal-reset").style.display = "none";
}

function showModal(kicker, title, content, canContinue, showReset = true, closeLabel = "続ける") {
  document.getElementById("modal-kicker").textContent = kicker;
  document.getElementById("modal-title").textContent = title;
  document.getElementById("modal-content").innerHTML = content;
  const closeButton = document.getElementById("modal-close");
  const resetButton = document.getElementById("modal-reset");
  closeButton.textContent = closeLabel;
  closeButton.hidden = !canContinue;
  closeButton.style.display = canContinue ? "" : "none";
  resetButton.hidden = !showReset;
  resetButton.style.display = showReset ? "" : "none";
  document.getElementById("modal-backdrop").classList.remove("hidden");
}

function clearSessionInteractionState() {
  clearDragState();
  clearEquipmentMenu();
  clearCleanToolDrag();
  selectedSeed = "lettuce";
  selectedMarket = "lower";
  saleQuantities = {};
  selectedUnitId = null;
  selectedDeviceId = null;
  selectedBaseId = null;
  placementSelection = null;
  dragPayload = null;
  pointerDrag = null;
  harvestSwipe = null;
  harvestHold = null;
  facilityPan = null;
  facilityPinch = null;
  equipmentMenu = null;
  equipmentMenuTimer = null;
  cleanToolDrag = null;
  activeComms = null;
  pendingComms = [];
}

function hasStartProgress() {
  const shelves = allShelves();
  return state.day > 1
    || state.tradeStats?.unitsSold > 0
    || ownedBases().length > 1
    || shelves.some((unit) => unit.placed || unit.slots?.some(Boolean))
    || allFloorDevices().some((device) => device.placed);
}

function startSelectedModeGame() {
  if (startModeView === "free") startFreeGame();
  else startDay30Game();
}

function handleStartPrimary() {
  if (hasStartProgress()) closeStartScreen();
  else startSelectedModeGame();
}

function unlockDebugState() {
  state.money = 99999;
  state.water = Math.max(Number(state.water) || 0, 999);
  state.nutrientCapacity = Math.max(Number(state.nutrientCapacity) || 0, 999);
  state.nutrient = Math.max(Number(state.nutrient) || 0, 999);
  state.seeds = Object.fromEntries(Object.keys(CROPS).map((cropId) => [cropId, 99]));
  state.marketUnlocked = Object.fromEntries(Object.keys(MARKETS).map((marketId) => [marketId, true]));
  state.marketTabUnlocked = true;
  state.shopUnlocked = true;
  state.brokerUnlocked = true;
  state.timeUnlocked = true;
  state.unlocks ||= {};
  UNLOCK_RULES.forEach((rule) => {
    state.unlocks[rule.id] = true;
    applyUnlock(rule);
  });
  state.equipment = {
    ...(state.equipment || {}),
    tanks: Math.max(Number(state.equipment?.tanks) || 0, 3),
    filter: true,
    fridge: true
  };
  state.propertyListings = generatePropertyListings(PROPERTY_LISTING_COUNT);
  state.log = "DEBUG OPERATION READY // all routes and procurement unlocked.";
}

function startDebugGame() {
  clearSessionInteractionState();
  state = createInitialState("free");
  unlockDebugState();
  updateMarketForDay();
  startScreenOpen = false;
  lastTickAt = Date.now();
  document.getElementById("start-screen")?.classList.add("hidden");
  document.getElementById("start-screen")?.setAttribute("aria-hidden", "true");
  document.getElementById("modal-backdrop")?.classList.add("hidden");
  document.getElementById("comms-banner")?.classList.add("hidden");
  saveGame();
  render();
  toast("DEBUG OPERATION READY");
  playSound("unlock_notice", 0.2);
}

function handleStartTitleTap() {
  const now = Date.now();
  startTitleTapCount = now - startTitleTapAt > 1600 ? 1 : startTitleTapCount + 1;
  startTitleTapAt = now;
  if (startTitleTapCount < 5) return;
  startTitleTapCount = 0;
  startDebugGame();
}
function startNewGame(mode = "normal") {
  clearSessionInteractionState();
  state = createInitialState(mode);
  updateMarketForDay();
  clearCommsForTrigger("game_start");
  startScreenOpen = false;
  lastTickAt = Date.now();
  document.getElementById("start-screen")?.classList.add("hidden");
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("comms-banner")?.classList.add("hidden");
  document.getElementById("modal-close").hidden = false;
  document.getElementById("modal-close").style.display = "";
  saveGame();
  render();
  triggerComms("game_start");
}

function startDay30Game() {
  startNewGame("day30");
}

function startFreeGame() {
  startNewGame("free");
}

function selectedStartModeLabel() {
  return startModeView === "free" ? "フリーモード" : "DAY30モード";
}

function setStartModeView(mode) {
  startModeView = mode === "free" ? "free" : "day30";
  safeStorageSet(START_MODE_PREF_KEY, startModeView);
  updateStartScreen();
}

function toggleStartModeView() {
  setStartModeView(startModeView === "free" ? "day30" : "free");
  playSound("start_mode_toggle", 0.12);
}

function openStartScreen(options = {}) {
  const { persist = true } = options;
  startScreenOpen = true;
  pausedBeforeStartScreen = Boolean(state.paused);
  state.paused = true;
  clearDragState();
  clearEquipmentMenu();
  clearCleanToolDrag();
  document.getElementById("modal-backdrop")?.classList.add("hidden");
  document.getElementById("comms-banner")?.classList.add("hidden");
  document.getElementById("news-history-panel")?.classList.add("hidden");
  updateStartScreen();
  const screen = document.getElementById("start-screen");
  if (screen) {
    screen.classList.remove("hidden");
    screen.setAttribute("aria-hidden", "false");
  }
  if (persist) {
    state.paused = pausedBeforeStartScreen;
    saveGame();
    state.paused = true;
  }
}

function closeStartScreen() {
  startScreenOpen = false;
  state.paused = pausedBeforeStartScreen;
  const screen = document.getElementById("start-screen");
  if (screen) {
    screen.classList.add("hidden");
    screen.setAttribute("aria-hidden", "true");
  }
  lastTickAt = Date.now();
  render();
  if (isFreshOperationState()) clearCommsForTrigger("game_start");
  if (isFreshOperationState() || activeComms) triggerComms("game_start");
}

function updateStartScreen() {
  const status = document.getElementById("start-status");
  const continueButton = document.getElementById("start-continue");
  const modeButton = document.getElementById("start-day30");
  const recordsTitle = document.getElementById("start-records-title");
  if (!status || !continueButton) return;
  const hasProgress = hasStartProgress();
  const newButton = document.getElementById("start-new");
  continueButton.textContent = hasProgress ? "続きから" : `${selectedStartModeLabel()}開始`;
  if (modeButton) {
    modeButton.hidden = true;
    modeButton.textContent = selectedStartModeLabel();
    modeButton.classList.toggle("free-mode", startModeView === "free");
  }
  if (newButton) {
    newButton.hidden = !hasProgress;
    newButton.textContent = `${selectedStartModeLabel()}で新規開始`;
  }
  if (recordsTitle) recordsTitle.textContent = startModeView === "free" ? "FREE MODE RECORDS" : "DAY30 RECORDS";
  status.textContent = hasProgress
    ? `SAVE SIGNAL // ${state.mode === "day30" ? "DAY30" : state.mode === "free" ? "FREE" : "NORMAL"} // DAY ${String(state.day).padStart(2, "0")} // C${formatNumber(state.money)}`
    : "NO SAVE SIGNAL // NEW OPERATION READY";
  renderDay30Records();
}

function renderDay30Records() {
  const list = document.getElementById("day30-record-list");
  const count = document.getElementById("day30-record-count");
  if (!list || !count) return;
  const records = readPlayRecords(startModeView);
  count.textContent = `${records.length} RUN${records.length === 1 ? "" : "S"}`;
  list.replaceChildren();
  if (!records.length) {
    const empty = document.createElement("p");
    empty.className = "day30-record-empty";
    empty.textContent = "まだDAY30モードの記録はありません。";
    if (startModeView === "free") empty.textContent = "フリーモードの記録はまだありません。";
    list.appendChild(empty);
    return;
  }
  records.slice(0, 12).forEach((record) => {
    const item = document.createElement("article");
    item.className = "day30-record";

    const main = document.createElement("div");
    main.className = "day30-record-main";
    const score = document.createElement("strong");
    score.textContent = `₡${formatNumber(record.revenue || 0)}`;
    const label = document.createElement("span");
    const resultStatus = record.mode === "free" ? "終了" : null;
    label.textContent = `${record.playerName || "未記名"} // ${record.completed ? "完走" : "途中終了"} DAY ${record.day || 0} // ${new Date(record.recordedAt).toLocaleDateString("ja-JP")}`;
    if (resultStatus) {
      label.textContent = `${record.playerName || "譛ｪ險伜錐"} // ${resultStatus} DAY ${record.day || 0} // ${new Date(record.recordedAt).toLocaleDateString("ja-JP")}`;
    }
    main.append(score, label);

    const sub = document.createElement("div");
    sub.className = "day30-record-sub";
    [
      `最多作物 ${cropLabel(record.topCropId)} x${record.topCropQty || 0}`,
      `市場(金) ${marketLabel(record.topMarketRevenueId)}`,
      `市場(量) ${marketLabel(record.topMarketQtyId)}`,
      `設備 ${record.equipmentCount || 0}`,
      `物件 ${record.propertyCount || 0}`
    ].forEach((textValue) => {
      const span = document.createElement("span");
      span.textContent = textValue;
      sub.appendChild(span);
    });

    const titles = document.createElement("div");
    titles.className = "day30-record-titles";
    (record.titles?.length ? record.titles : ["称号なし"]).forEach((title) => {
      const badge = document.createElement("span");
      badge.className = "day30-record-title";
      badge.textContent = title;
      titles.appendChild(badge);
    });

    item.append(main, sub, titles);
    list.appendChild(item);
  });
}

function openConfirmWidget({ kicker = "CONFIRM", title, copy, confirmText = "実行", onConfirm }) {
  pendingConfirmAction = onConfirm;
  pendingDangerAction = null;
  pendingExtraAction = null;
  document.getElementById("confirm-kicker").textContent = kicker;
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-copy").textContent = copy;
  document.getElementById("confirm-ok").textContent = confirmText;
  const dangerButton = document.getElementById("confirm-danger");
  if (dangerButton) dangerButton.classList.add("hidden");
  const extraButton = document.getElementById("confirm-extra");
  if (extraButton) extraButton.classList.add("hidden");
  const widget = document.getElementById("confirm-widget");
  widget.classList.remove("hidden");
  widget.setAttribute("aria-hidden", "false");
}

function closeConfirmWidget() {
  pendingConfirmAction = null;
  pendingDangerAction = null;
  pendingExtraAction = null;
  document.getElementById("confirm-danger")?.classList.add("hidden");
  document.getElementById("confirm-extra")?.classList.add("hidden");
  const widget = document.getElementById("confirm-widget");
  widget.classList.add("hidden");
  widget.setAttribute("aria-hidden", "true");
}

function confirmWidgetAction() {
  const action = pendingConfirmAction;
  closeConfirmWidget();
  if (action) action();
}

function confirmWidgetDangerAction() {
  const action = pendingDangerAction;
  closeConfirmWidget();
  if (action) action();
}

function confirmWidgetExtraAction() {
  const action = pendingExtraAction;
  closeConfirmWidget();
  if (action) action();
}

function requestNewGame() {
  requestSelectedModeGame();
}

function requestDay30Game() {
  openConfirmWidget({
    kicker: "DAY30 CHALLENGE",
    title: "DAY30モード",
    copy: "現在のセーブデータを上書きして、DAY30終了時点の記録を残す競技モードを開始します。",
    confirmText: "DAY30開始",
    onConfirm: startDay30Game
  });
}

function requestSelectedModeGame() {
  if (startModeView === "free") {
    openConfirmWidget({
      kicker: "FREE OPERATION",
      title: "フリーモード",
      copy: "DAY30の期限なしで、現在のセーブデータを上書きしてゆったり遊ぶモードを開始します。",
      confirmText: "フリー開始",
      onConfirm: startFreeGame
    });
    return;
  }
  requestDay30Game();
}

function playRecordsExportPayload() {
  return {
    app: "UNDERGREEN",
    exportedAt: new Date().toISOString(),
    records: {
      day30: readDay30Records(),
      free: readFreeRecords()
    }
  };
}

function legacyCopyToClipboard(text) {
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.position = "fixed";
  field.style.left = "0";
  field.style.top = "0";
  field.style.width = "1px";
  field.style.height = "1px";
  field.style.opacity = "0.01";
  field.style.zIndex = "9999";
  document.body.appendChild(field);
  field.focus({ preventScroll: true });
  field.select();
  field.setSelectionRange(0, field.value.length);
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch (error) {
    copied = false;
  }
  field.remove();
  return copied;
}

function showRecordExportFallback(text) {
  showModal("RECORD EXPORT", "コピー用データ", `<p class="modal-copy">ブラウザがクリップボード更新を拒否しました。下のデータ欄を選択してコピーしてください。</p><textarea class="record-export-field" readonly>${escapeHtml(text)}</textarea>`, true);
  document.getElementById("modal-reset").style.display = "none";
  window.setTimeout(() => {
    const field = document.querySelector(".record-export-field");
    if (!field) return;
    field.focus({ preventScroll: true });
    field.select();
  }, 0);
}

async function copyPlayRecordsToClipboard() {
  const text = JSON.stringify(playRecordsExportPayload(), null, 2);
  if (legacyCopyToClipboard(text)) {
    toast("プレイレコードをクリップボードにコピーしました。");
    setStatus("Play records exported to clipboard.");
    return;
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else if (!legacyCopyToClipboard(text)) {
      showRecordExportFallback(text);
      return;
    }
    toast("プレイレコードをクリップボードにコピーしました。");
    setStatus("Play records exported to clipboard.");
  } catch (error) {
    console.warn("Record export failed", error);
    if (legacyCopyToClipboard(text)) {
      toast("プレイレコードをクリップボードにコピーしました。");
      setStatus("Play records exported to clipboard.");
      return;
    }
    showRecordExportFallback(text);
    toast("クリップボードへのコピーに失敗しました。");
    setStatus("Record export failed. Browser permission may be blocking clipboard access.");
  }
}

function clearPlayRecords() {
  saveDay30Records([]);
  saveFreeRecords([]);
  renderDay30Records();
  toast("この端末のプレイレコードを消去しました。");
  setStatus("Local play records cleared.");
}

function requestClearPlayRecords() {
  openConfirmWidget({
    kicker: "DELETE RECORDS",
    title: "記録消去",
    copy: "この端末に保存されているDAY30/フリーモードのプレイレコードをすべて消去します。",
    confirmText: "消去",
    onConfirm: clearPlayRecords
  });
}

function requestRecordExport() {
  openConfirmWidget({
    kicker: "RECORD EXPORT",
    title: "記録書き出し",
    copy: "この端末に保存されているDAY30/フリーモードのプレイレコードをコピー、または消去できます。",
    confirmText: "コピー",
    onConfirm: copyPlayRecordsToClipboard
  });
  pendingDangerAction = requestClearPlayRecords;
  const dangerButton = document.getElementById("confirm-danger");
  if (dangerButton) {
    dangerButton.textContent = "記録消去";
    dangerButton.classList.remove("hidden");
  }
  pendingExtraAction = openGoogleFormRecordExport;
  const extraButton = document.getElementById("confirm-extra");
  if (extraButton) {
    extraButton.textContent = "GOOGLE FORM";
    extraButton.classList.remove("hidden");
  }
}

function currentDay30PlayerName() {
  return document.getElementById("day30-player-name")?.value || "未記名";
}

function applyDay30PlayerName() {
  if (!pendingDay30RecordId) return;
  updateDay30RecordName(pendingDay30RecordId, currentDay30PlayerName());
  renderDay30Records();
}

function day30ResultToStart() {
  applyDay30PlayerName();
  openStartScreen();
}

function enterDay30ViewMode() {
  applyDay30PlayerName();
  startScreenOpen = false;
  state.ended = true;
  state.paused = true;
  document.getElementById("modal-backdrop").classList.add("hidden");
  document.getElementById("modal-close").hidden = false;
  document.getElementById("modal-reset").style.display = "";
  setStatus("DAY30閲覧モード。時計は停止しています。");
  saveGame();
  render();
}

function requestExitToStart() {
  if (state.mode === "day30" && !state.day30Recorded && !state.ended) {
    openConfirmWidget({
      kicker: "DAY30 RETIRE",
      title: "途中終了しますか",
      copy: "現在のDAYまでの内容で記録を保存し、結果画面へ進みます。",
      confirmText: "記録する",
      onConfirm: () => finalizeDay30Run({ completed: false, playedDays: state.day })
    });
    return;
  }
  if (state.mode === "free" && !state.day30Recorded && !state.ended) {
    openConfirmWidget({
      kicker: "FREE OPERATION CLOSE",
      title: "フリーモードを終了しますか",
      copy: "現在までの内容でプレイレコードを保存し、結果画面へ進みます。",
      confirmText: "記録する",
      onConfirm: () => finalizeDay30Run({ completed: false, playedDays: state.day, mode: "free" })
    });
    return;
  }
  openConfirmWidget({
    kicker: "CLOSE TERMINAL",
    title: "終了しますか",
    copy: "現在の状態を保存し、スタート画面へ戻ります。",
    confirmText: "終了",
    onConfirm: openStartScreen
  });
}

function renderHeader() {
  document.getElementById("day-value").textContent = String(state.day).padStart(2, "0");
  document.getElementById("day-limit").textContent = state.mode === "day30"
    ? " / DAY30"
    : state.mode === "free" ? " / FREE" : state.day > 30 ? " / inf" : " / 30";
  document.getElementById("money-value").textContent = formatNumber(state.money);
  document.getElementById("water-value").textContent = formatResource(Math.max(0, state.water));
  document.getElementById("nutrient-value").textContent = formatResource(Math.max(0, state.nutrient));
  document.getElementById("nutrient-capacity").textContent = ` / ${state.nutrientCapacity}`;
  document.getElementById("upkeep-value").textContent = dailyUpkeep();
  document.getElementById("slot-value").textContent = totalGrowSlots();
  document.getElementById("news-text").textContent = state.news;
  document.getElementById("news-effect").textContent = state.newsLabel;
  const status = document.getElementById("status-text");
  if (status) status.textContent = state.log;
  document.getElementById("day-progress-fill").style.width = state.timeUnlocked ? `${Math.min(100, state.dayProgress * 100)}%` : "0%";
  document.getElementById("time-remaining").textContent = state.timeUnlocked
    ? `${((1 - state.dayProgress) * REALTIME_DAY_MS / 1000).toFixed(1)} SEC`
    : "DAY HOLD";
  renderResourceAlert("water", state.water, resourceDemand().water);
  renderResourceAlert("nutrient", state.nutrient, resourceDemand().nutrient);
  renderNewsHistory();
}

function newsHistoryTiming(entry) {
  const age = Math.max(0, (Number(state.day) || 1) - (Number(entry.day) || 1));
  const parts = [`DAY ${String(entry.day).padStart(2, "0")}`, age === 0 ? "今日" : `${age}日前`];
  if (entry.activeDay && state.day < entry.activeDay) {
    parts.push(`発効まで${entry.activeDay - state.day}日`);
  } else if (entry.endDay && state.day >= entry.activeDay && state.day < entry.endDay) {
    parts.push(`残り${entry.endDay - state.day}日`);
  } else if (entry.activeDay && state.day >= entry.endDay) {
    parts.push("終了済み");
  }
  return parts;
}

function newsHistoryKindLabel(kind) {
  if (kind === "forecast") return "重要予報";
  if (kind === "active") return "市場変動中";
  return "";
}

function renderNewsHistory() {
  const list = document.getElementById("news-history-list");
  if (!list) return;
  ensureMarketNewsState();
  list.replaceChildren();
  if (!state.newsHistory.length) {
    const empty = document.createElement("p");
    empty.className = "news-history-empty";
    empty.textContent = "まだ記録されたニュースはありません。";
    list.appendChild(empty);
    return;
  }
  state.newsHistory.forEach((entry) => {
    const item = document.createElement("article");
    item.className = `news-history-item ${entry.kind || "news"}`;

    const meta = document.createElement("div");
    meta.className = "news-history-meta";
    const kindText = newsHistoryKindLabel(entry.kind);
    if (kindText) {
      const kind = document.createElement("span");
      kind.className = `news-history-kind ${entry.kind || "news"}`;
      kind.textContent = kindText;
      meta.appendChild(kind);
    }

    const label = document.createElement("span");
    label.className = "news-history-label";
    label.textContent = entry.label || "LOWNET";
    meta.appendChild(label);
    newsHistoryTiming(entry).forEach((part) => {
      const span = document.createElement("span");
      span.textContent = part;
      meta.appendChild(span);
    });

    const textLine = document.createElement("p");
    textLine.textContent = entry.text || "";

    item.append(meta, textLine);
    list.appendChild(item);
  });
}

function openNewsHistory() {
  renderNewsHistory();
  const panel = document.getElementById("news-history-panel");
  if (!panel) return;
  panel.classList.remove("hidden");
  panel.setAttribute("aria-hidden", "false");
}

function closeNewsHistory() {
  const panel = document.getElementById("news-history-panel");
  if (!panel) return;
  panel.classList.add("hidden");
  panel.setAttribute("aria-hidden", "true");
}

function renderResourceAlert(type, amount, dailyDemand) {
  const card = document.getElementById(`${type}-card`);
  const label = document.getElementById(`${type}-alert`);
  const critical = amount <= 0.05;
  const warning = !critical && dailyDemand > 0 && amount <= Math.max(2, dailyDemand * 3);
  card.classList.toggle("critical", critical);
  card.classList.toggle("warning", warning);
  label.textContent = critical ? "EMPTY" : warning ? "LOW" : "";
  if ((critical || warning) && dailyDemand > 0) triggerComms("resource_low", { resource: type });
}

function renderFarm() {
  const base = currentBase();
  const shelves = currentShelves();
  const floorDevices = currentFloorDevices();
  const placementItem = selectedPlacementItem();
  const baseTabs = ownedBases().map((entry, index) => {
    const planted = entry.shelves.reduce((sum, unit) => sum + unit.slots.filter(Boolean).length, 0);
    return `<button class="base-switch ${entry.id === base.id ? "active" : ""}" data-select-base="${entry.id}">
      <span>BASE ${index + 1}</span><strong>${entry.name}</strong><small>${entry.cols} x ${entry.rows} / ${planted}株</small>
    </button>`;
  }).join("");
  document.getElementById("base-banner").style.backgroundImage = `linear-gradient(90deg, rgba(3, 10, 8, .94), rgba(3, 10, 8, .28)), url("${base.image}")`;
  document.getElementById("base-banner").innerHTML = `
    <div><p class="eyebrow">${base.code} // BASE ${ownedBases().findIndex((entry) => entry.id === base.id) + 1}/${ownedBases().length}</p><h3>${base.name}</h3><p>${base.description}</p>${tagMarkup(base.tags, BASE_TAGS)}</div>
    <strong>${base.cols} x ${base.rows}<small>${base.cols * base.rows} GRID CELLS</small></strong>
    <div class="base-switcher">${baseTabs}</div>`;

  const env = base.environment || DEFAULT_ENVIRONMENT;
  const dirtyCount = [...shelves, ...floorDevices].filter(needsCleaning).length;
  document.getElementById("facility-grid-toolbar").innerHTML = placementItem
    ? `<span class="placement-active">PLACING // ${placementItem.kind === "unit" ? GROW_UNITS[placementItem.type].name : FLOOR_DEVICES[placementItem.type].name}</span><div class="placement-tools"><small>Drop on an open isometric cell</small><button type="button" data-cancel-placement>CANCEL</button></div>`
    : `<span>ISOMETRIC FACILITY LAYOUT ${dirtyCount ? `<b class="clean-alert">CLEAN ${dirtyCount}</b>` : ""}</span>
      <div class="environment-controls">
        <button data-env="temp" data-env-delta="-1">-</button><strong>${env.temp}C</strong><button data-env="temp" data-env-delta="1">+</button>
        <button data-env="humidity" data-env-delta="-5">-</button><strong>${env.humidity}%RH</strong><button data-env="humidity" data-env-delta="5">+</button>
        <button data-env="co2" data-env-delta="-50">-</button><strong>${env.co2}ppm</strong><button data-env="co2" data-env-delta="50">+</button>
        <button data-view-zoom="-1">ZOOM-</button><strong>${Math.round(facilityView.zoom * 100)}%</strong><button data-view-zoom="1">ZOOM+</button>
        <button data-view-reset>RESET</button>
      </div>
      <small>GRID READY</small>`;

  const coverageDevices = floorDevices.filter((device) => {
    const definition = FLOOR_DEVICES[device.type];
    return device.placed && definition && Number(definition.radius) > 0;
  });
  const cellMarkup = Array.from({ length: base.cols * base.rows }, (_, index) => {
    const x = index % base.cols;
    const y = Math.floor(index / base.cols);
    const blocked = isBlockedCell(base, x, y);
    const coverageTypes = coverageDevices
      .filter((device) => Math.max(Math.abs(x - device.x), Math.abs(y - device.y)) <= FLOOR_DEVICES[device.type].radius)
      .map((device) => device.type);
    const coverageClass = !blocked && coverageTypes.length
      ? ["covered", ...new Set(coverageTypes.map((type) => `covered-${type}`))].join(" ")
      : "";
    const placeable = !blocked && placementItem && canPlace(placementItem, x, y, placementItem.id);
    return `<button class="facility-cell ${blocked ? "blocked-cell" : ""} ${coverageClass} ${placeable ? "placeable" : ""}"
      style="grid-column:${x + 1};grid-row:${y + 1}" data-grid-x="${x}" data-grid-y="${y}" aria-label="${blocked ? "Blocked cell" : "Grid cell"} ${x + 1}, ${y + 1}" ${blocked ? "disabled" : ""}></button>`;
  }).join("");

  const placedUnits = shelves.filter((unit) => unit.placed).map((unit) => {
    const shelfIndex = shelves.findIndex((entry) => entry.id === unit.id);
    const definition = GROW_UNITS[unit.type];
    const effects = getUnitEffects(unit);
    const occupied = unit.slots.filter(Boolean).length;
    const running = occupied > 0;
    const usesSlotWidget = Boolean(GROW_UNIT_SLOT_LAYOUTS[unit.type]?.length);
    const sprite = usesSlotWidget ? (definition.emptySprite || definition.sprite) : unitSprite(unit, definition);
    const spriteCrop = unitPrimaryCrop(unit);
    const plantSlots = renderUnitPlantSlots(unit, shelfIndex);
    const ready = unit.slots.some((plant) => plant?.ready);
    return `<button class="facility-item grow-item type-${unit.type} ${usesSlotWidget ? "unit-widget" : ""} ${running ? "unit-running" : "unit-idle"} ${plantStageClass(unit)} ${ready ? "harvest-glow" : ""} ${needsCleaning(unit) ? "needs-cleaning" : ""} ${selectedUnitId === unit.id ? "selected" : ""}" aria-label="${definition.name} ${occupied}/${definition.slots}株 ${running ? "稼働中" : "停止中"}"
      style="grid-column:${unit.x + 1}/span ${definition.width};grid-row:${unit.y + 1}/span ${definition.height};z-index:${20 + unit.y}"
      data-select-unit="${unit.id}" data-drag-kind="unit" data-drag-id="${unit.id}" data-sprite-crop="${spriteCrop}">
      <img class="equipment-sprite growth-stage-sprite ${usesSlotWidget ? "widget-body-sprite" : ""}" src="${sprite}" alt="" draggable="false">${plantSlots}<span class="unit-aura"></span><span class="unit-power-state">${ready ? "READY" : running ? "ACTIVE" : "OFFLINE"}</span><span class="item-label"><strong>${definition.name}</strong><small>${occupied}/${definition.slots} plants</small></span>
      ${needsCleaning(unit) ? `<span class="clean-badge">清掃</span>` : ""}
      <span class="effect-dots"><i class="${effects.light ? "on light" : ""}">L</i><i class="${effects.fan ? "on fan" : ""}">F</i></span>
    </button>`;
  }).join("");

  const placedDevices = floorDevices.filter((device) => device.placed).map((device) => {
    const definition = FLOOR_DEVICES[device.type];
    const deviceLabel = device.type === "light" ? "LED" : device.type === "fan" ? "FAN" : definition.code || definition.name;
    return `<button class="facility-item floor-device device-${device.type} device-running ${needsCleaning(device) ? "needs-cleaning" : ""} ${selectedDeviceId === device.id ? "selected" : ""}"
      style="grid-column:${device.x + 1};grid-row:${device.y + 1};z-index:${20 + device.y}" data-select-device="${device.id}" data-drag-kind="device" data-drag-id="${device.id}">
      <img class="equipment-sprite" src="${definition.sprite}" alt="" draggable="false"><span class="device-field"></span><span class="item-label">${deviceLabel}</span>
      ${needsCleaning(device) ? `<span class="clean-badge">清掃</span>` : ""}
    </button>`;
  }).join("");

  const grid = document.getElementById("facility-grid");
  const gridShell = document.querySelector(".facility-grid-shell");
  const metrics = isoGridMetrics(base);
  gridShell.className = `facility-grid-shell ${base.rows <= 3 ? "compact-grid" : ""} ${placementItem ? "equipment-placement-mode" : ""} ${facilityMoodClasses(base)}`.trim();
  grid.style.setProperty("--iso-width", `${metrics.width}px`);
  grid.style.setProperty("--iso-height", `${metrics.height}px`);
  grid.style.setProperty("--tile-w", `${ISO_TILE_WIDTH}px`);
  grid.style.setProperty("--tile-h", `${ISO_TILE_HEIGHT}px`);
  grid.style.setProperty("--grid-cols", base.cols);
  grid.style.setProperty("--grid-rows", base.rows);
  applyFacilityView();
  grid.innerHTML = cellMarkup + placedUnits + placedDevices;

  grid.querySelectorAll(".facility-cell").forEach((cell) => {
    const x = Number(cell.dataset.gridX);
    const y = Number(cell.dataset.gridY);
    const pos = gridToIso(x, y, base);
    cell.style.left = `${pos.x}px`;
    cell.style.top = `${pos.y}px`;
  });
  grid.querySelectorAll("[data-select-unit]").forEach((element) => {
    const unit = shelves.find((entry) => entry.id === element.dataset.selectUnit);
    if (!unit) return;
    const definition = GROW_UNITS[unit.type];
    const pos = equipmentIsoPosition(unit, "unit", base);
    element.style.left = `${pos.x}px`;
    element.style.top = `${pos.y}px`;
    element.style.setProperty("--footprint-w", definition.width);
    element.style.setProperty("--footprint-h", definition.height);
    element.style.zIndex = String(100 + equipmentVisualDepth(unit, "unit"));
  });
  grid.querySelectorAll("[data-select-device]").forEach((element) => {
    const device = floorDevices.find((entry) => entry.id === element.dataset.selectDevice);
    if (!device) return;
    const pos = equipmentIsoPosition(device, "device", base);
    element.style.left = `${pos.x}px`;
    element.style.top = `${pos.y}px`;
    element.style.setProperty("--footprint-w", pos.size.width);
    element.style.setProperty("--footprint-h", pos.size.height);
    element.style.zIndex = String(100 + equipmentVisualDepth(device, "device"));
  });

  const detailPanel = document.getElementById("selected-unit-panel");
  if (detailPanel) detailPanel.innerHTML = "";
const unplaced = sharedStockItems();
  document.getElementById("placement-palette").innerHTML = unplaced.length ? unplaced.map(({ item: stockItem, kind, base: stockBase }) => {
    const item = { ...stockItem, kind };
    const definition = kind === "unit" ? GROW_UNITS[item.type] : FLOOR_DEVICES[item.type];
    const active = placementSelection && placementSelection.id === item.id;
    const compatible = true;
    const dragAttributes = `data-place-kind="${kind}" data-place-id="${item.id}" data-drag-kind="${kind}" data-drag-id="${item.id}"`;
    const stockLabel = stockBase.id === base.id ? "CURRENT BASE" : `STOCK // ${stockBase.name}`;
    const sellButton = canSellEquipment(kind, item) ? `<button class="stock-sell-button" data-sell-stock-kind="${item.kind}" data-sell-stock-id="${item.id}">売却</button>` : "";
    return `<div class="placement-stock-row">
      <button class="placement-stock stock-${item.type} ${active ? "active" : ""}" title="${stockLabel}" ${dragAttributes}>
        <img src="${definition.emptySprite || definition.sprite || definition.icon}" alt=""><span><strong>${definition.name}</strong><small>${definition.width} x ${definition.height}マス${compatible ? "" : " / 非対応"}</small>${tagMarkup(item.tags, EQUIPMENT_TAGS)}</span>
      </button>
      ${sellButton}
    </div>`;
  }).join("") : `<p class="palette-empty">未配置の設備はありません</p>`;

  document.getElementById("seed-selector").innerHTML = Object.entries(CROPS).filter(([, crop]) =>
    state.marketUnlocked[crop.unlock]
  ).map(([cropId, crop]) => `
    <button class="seed-option ${selectedSeed === cropId ? "active" : ""}" data-seed="${cropId}" data-drag-crop="${cropId}" ${state.seeds[cropId] <= 0 ? "disabled" : ""} style="--crop-color:${crop.color}">
      <span class="seed-glyph"><img src="${crop.icon}" alt=""></span>
      <span><strong>${crop.name}</strong><small>${crop.days} DAYS / 適温 ${CROP_ENVIRONMENT[cropId]?.temp || DEFAULT_ENVIRONMENT.temp}C</small></span>
      <b>x${state.seeds[cropId]}</b>
    </button>
  `).join("");

  const demand = resourceDemand();
  const visiblePlants = currentActivePlants();
  const ready = visiblePlants.filter(({ plant }) => plant.ready).length;
  const dead = visiblePlants.filter(({ plant }) => plant.dead).length;
  const growing = visiblePlants.length - ready - dead;
  document.getElementById("water-demand").textContent = `${formatResource(demand.water)} / DAY`;
  document.getElementById("nutrient-demand").textContent = `${formatResource(demand.nutrient)} / DAY`;
  document.getElementById("unit-count").textContent = `${shelves.length} / ${allShelves().length} UNIT`;
  document.getElementById("continuous-count").textContent = `${allShelves().filter((unit) => GROW_UNITS[unit.type]?.continuous).length} UNIT`;
  document.getElementById("farm-summary").innerHTML = `<span>生育中</span><strong>${growing}</strong><span>収穫可能</span><strong>${ready}</strong>${dead ? `<span>枯死</span><strong class="danger-text">${dead}</strong>` : ""}`;
}

function renderSlot(plant, shelfIndex, slotIndex) {
  if (!plant) {
    return `<button class="slot empty" data-shelf="${shelfIndex}" data-slot="${slotIndex}">
      <span><span class="empty-plus">+</span><span class="empty-label">EMPTY SLOT</span></span>
    </button>`;
  }

  const crop = CROPS[plant.crop];
  if (plant.dead) {
    return `<button class="slot dead" data-shelf="${shelfIndex}" data-slot="${slotIndex}" style="--crop-color:#76656a">
      <span class="plant-visual"><img src="${crop.icon}" alt=""></span>
      <strong class="crop-name">${crop.name}</strong>
      <span class="slot-meta"><span>WITHERED</span><span>撤去待ち</span></span>
      <span class="dead-badge">枯死 // クリックで撤去</span>
    </button>`;
  }
  const progress = Math.min(100, Math.round((plant.growth / crop.days) * 100));
  const remaining = Math.max(0, crop.days - plant.growth);
  const qualityText = plant.ready ? `Q-${plant.quality}` : estimateQuality(plant);
  let badge = "";
  if (plant.degraded) badge = `<span class="degraded-badge">DEGRADED // 収穫</span>`;
  else if (plant.ready) badge = `<span class="ready-badge">HARVEST READY</span>`;

  return `<button class="slot" data-shelf="${shelfIndex}" data-slot="${slotIndex}" style="--crop-color:${crop.color}">
    <span class="plant-visual"><img src="${crop.icon}" alt=""></span>
    <strong class="crop-name">${crop.name}</strong>
    <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
    <span class="slot-meta"><span>${plant.ready ? "READY" : `残り ${remaining.toFixed(1)}日`}</span><span>${qualityText}</span></span>
    ${badge}
  </button>`;
}

function estimateQuality(plant) {
  if (plant.waterShortage && plant.nutrientShortage) return "予測 C";
  if (plant.waterShortage || plant.nutrientShortage) return "予測 C-B";
  return "予測 B-S";
}

function marketIds() {
  return Object.keys(MARKETS);
}

function availableMarketIds() {
  return marketIds().filter(isMarketAvailable);
}

function cycleMarket(direction = 1) {
  const available = availableMarketIds();
  if (!available.length) return;
  const currentIndex = Math.max(0, available.indexOf(selectedMarket));
  selectedMarket = available[(currentIndex + direction + available.length) % available.length];
  playSound("market_select", 0.2);
  hapticFeedback(8);
  renderMarkets(direction > 0 ? "next" : "prev");
}

function marketCarouselPosition(marketId) {
  const ids = marketIds();
  const selectedIndex = Math.max(0, ids.indexOf(selectedMarket));
  const index = ids.indexOf(marketId);
  const count = ids.length;
  let offset = index - selectedIndex;
  if (offset > count / 2) offset -= count;
  if (offset < -count / 2) offset += count;
  if (offset === 0) return "center";
  if (offset === -1 || offset === count - 1) return "left";
  if (offset === 1 || offset === 1 - count) return "right";
  return offset < 0 ? "far-left" : "far-right";
}

function renderMarkets(direction = "") {
  const selector = document.getElementById("market-selector");
  if (selector) {
    selector.className = ("market-selector market-carousel " + (direction ? "slide-" + direction : "")).trim();
    if (direction) window.setTimeout(() => selector.classList.remove("slide-" + direction), 360);
  }
  document.getElementById("market-selector").innerHTML = `
    <button class="market-cycle-button cycle-prev" data-market-cycle="-1" aria-label="Previous market">&lsaquo;</button>
    <div class="market-carousel-stage">
      ${Object.entries(MARKETS).map(([marketId, market]) => {
        const available = isMarketAvailable(marketId);
        const position = marketCarouselPosition(marketId);
        return `<button class="market-card carousel-market ${position} ${selectedMarket === marketId ? "active" : ""} ${available ? "" : "locked"}" data-market="${marketId}" ${available ? "" : "disabled"}>
          <img class="market-portrait" src="${market.portrait}" alt="${market.contact}">
          <span class="market-copy">
            <span class="market-contact">${market.contact}</span>
            <strong>${market.name}</strong>
            <small>${market.description}</small>
            <span class="market-risk">${available
              ? `Permanent trade // total C${formatNumber(state.tradeStats.byMarket[marketId])}`
              : `LOCKED // ${market.unlockHint}`}</span>
          </span>
        </button>`;
      }).join("")}
    </div>
    <button class="market-cycle-button cycle-next" data-market-cycle="1" aria-label="Next market">&rsaquo;</button>
  `;

  const signalProfile = MARKET_SIGNALS[selectedMarket];
  const signals = state.marketSignals?.[selectedMarket] || {};
  document.getElementById("market-signal-row").innerHTML = signalProfile ? [signalProfile.axisA, signalProfile.axisB].map((axis, index) => {
    const label = index === 0 ? signalProfile.axisALabel : signalProfile.axisBLabel;
    const description = index === 0 ? signalProfile.axisADescription : signalProfile.axisBDescription;
    const value = clamp(signals[axis] ?? 0.5, 0, 1);
    return `<div class="market-signal">
      <span>${label}</span>
      <strong>${Math.round(value * 100)}%</strong>
      <i style="--signal:${Math.round(value * 100)}%"></i>
      <small>${description}</small>
    </div>`;
  }).join("") : "";

  document.getElementById("price-grid").innerHTML = Object.entries(CROPS).filter(([cropId]) =>
    MARKETS[selectedMarket].accepts.includes(cropId)
  ).map(([cropId, crop]) => {
    const fluctuation = state.marketFluctuation[cropId];
    const demand = cropDemandMultiplier(cropId, selectedMarket);
    const scheduleBoost = scheduleCropEventMultiplier(cropId, selectedMarket);
    const totalTrend = fluctuation * demand * scheduleBoost * cropEventMultiplier(cropId);
    const delta = Math.round((totalTrend - 1) * 100);
    const trendClass = delta > 0 ? "up" : delta < 0 ? "down" : "";
    return `<div class="price-cell" style="--crop-color:${crop.color}">
      <header><img src="${crop.icon}" alt=""><strong>${crop.name}</strong></header>
      <span class="quote">C${formatNumber(getQuote(cropId))}</span>
      <span class="trend ${trendClass}">${delta >= 0 ? "UP" : "DOWN"} ${Math.abs(delta)}% TODAY</span>
      <span class="demand-note">${cropDemandNote(cropId, selectedMarket)}</span>
    </div>`;
  }).join("");

  renderInventory();
}

function renderInventory() {
  const inventoryList = document.getElementById("inventory-list");
  const count = state.inventory.reduce((sum, batch) => sum + Math.max(0, Number(batch.qty) || 0), 0);
  document.getElementById("inventory-summary").innerHTML = `
    <span>在庫 ${count} / 累計販売 ${state.tradeStats.unitsSold}</span>
    <strong>₡${formatNumber(state.tradeStats.revenue)} VOLUME</strong>`;

  if (!state.inventory.length) {
    inventoryList.innerHTML = `<div class="inventory-empty">NO HARVEST STOCK // 収穫物はまだありません</div>`;
    return;
  }

  inventoryList.innerHTML = state.inventory.map((batch) => {
    const crop = CROPS[batch.crop];
    const batchQty = Math.max(0, Number(batch.qty) || 0);
    const qty = Math.min(batchQty, saleQuantities[batch.id] || 1);
    const unitPrice = getUnitPrice(batch);
    const accepted = MARKETS[selectedMarket].accepts.includes(batch.crop);
    return `<div class="inventory-row" style="--crop-color:${crop.color};--quality-color:${QUALITY[batch.quality].color}">
      <div class="inventory-crop">
        <span class="crop-glyph"><img src="${crop.icon}" alt=""></span>
        <span><strong>${crop.name} x${batchQty}</strong><small>${batch.degraded ? "劣化品 / 売値50%" : "FRESH HARVEST"}</small></span>
      </div>
      <div class="quality-cell"><span class="quality-badge">${batch.quality}</span></div>
      <div class="age-cell"><span class="inventory-label">AGE</span><br><strong>${batch.age} DAY</strong></div>
      <div class="unit-price-cell"><span class="inventory-label">UNIT</span><br><strong>₡${formatNumber(unitPrice)}</strong></div>
      <div class="qty-control">
        <button data-qty-id="${batch.id}" data-delta="-1">-</button>
        <span>${qty}</span>
        <button data-qty-id="${batch.id}" data-delta="1">+</button>
      </div>
      <button class="sell-button" data-sell-id="${batch.id}" ${accepted ? "" : "disabled"}>${accepted ? `C${formatNumber(unitPrice * qty)} SELL` : "NOT ACCEPTED"}</button>
    </div>`;
  }).join("");
}

function renderShop() {
  ensureProcurementTags();
  document.getElementById("seed-shop").innerHTML = Object.entries(CROPS).map(([cropId, crop]) => {
    const available = isUnlocked("seed_item", cropId);
    return `
    <article class="shop-card ${available ? "" : "locked"}" style="--item-color:${crop.color}">
      <div class="shop-glyph"><img src="${crop.icon}" alt=""></div>
      <h3>${crop.name} 種子 x${crop.packSize}</h3>
      <p>${available ? crop.note : unlockHint("seed_item", cropId, crop.note)}<br>${crop.packSize}粒パック / 成長 ${crop.days}日</p>
      <footer>
        <span class="shop-price">₡${crop.seedPrice}</span>
        <button class="buy-button" data-buy-seed="${cropId}" ${!available || state.money < crop.seedPrice ? "disabled" : ""}>${available ? `購入 +${crop.packSize}` : "LOCKED"}</button>
      </footer>
    </article>
  `;}).join("");

  const hardwareCards = Object.entries(EQUIPMENT).map(([itemId, item]) => {
    const available = isUnlocked("shop_item", itemId);
    const owned = (itemId === "filter" && state.equipment.filter)
      || (itemId === "fridge" && state.equipment.fridge)
      || (itemId === "support_os_harvest" && state.supportOS?.harvest)
      || (itemId === "support_os_planting" && state.supportOS?.planting)
      || (itemId === "support_os_cleaning" && state.supportOS?.cleaning);
    const nutrientFull = itemId === "nutrient" && state.nutrient >= state.nutrientCapacity;
    let price = item.basePrice;
    if (itemId === "water") price = waterPackPrice();
    if (GROW_UNITS[itemId]) price = growUnitPrice(itemId);
    const tags = (GROW_UNITS[itemId] || FLOOR_DEVICES[itemId]) ? unitTags(itemId) : [];
    const tagEffects = combinedEffects(tags, EQUIPMENT_TAGS);
    if (tags.length) price = Math.max(1, Math.round(price * (tagEffects.priceMod || 1)));
    const disabled = !available || owned || nutrientFull || state.money < price;
    let count = "";
    if (itemId === "tank") count = ` x${state.equipment.tanks}`;
    if (GROW_UNITS[itemId]) count = ` x${unitCount(itemId)}`;
    if (FLOOR_DEVICES[itemId]) count = ` x${allFloorDevices().filter((device) => device.type === itemId).length}`;
    return `<article class="shop-card ${available ? "" : "locked"} ${owned ? "owned" : ""}" style="--item-color:${item.color}">
      ${owned ? `<span class="owned-tag">INSTALLED</span>` : ""}
      <div class="shop-glyph"><img src="${item.sprite || item.icon}" alt=""></div>
      <h3>${item.name}${count}</h3>
      <p>${available ? item.description : unlockHint("shop_item", itemId, item.description)}</p>
      ${tagMarkup(tags, EQUIPMENT_TAGS)}
      <footer>
        <span class="shop-price">₡${price}</span>
        <button class="buy-button" data-buy-item="${itemId}" ${disabled ? "disabled" : ""}>${!available ? "LOCKED" : owned ? "OWNED" : "BUY"}</button>
      </footer>
    </article>`;
  }).join("");
  document.getElementById("equipment-shop").innerHTML = `
    <article class="shop-card lineup-card">
      <div class="shop-glyph"><img src="${text("procurement_refresh_icon", "assets/icons/seed.webp")}" alt=""></div>
      <h3>${text("procurement_refresh_title", "タグ付き在庫更新")}</h3>
      <p>${text("procurement_refresh_copy", "Mara searches alternate equipment routes. Performance tags change after each refresh.")}</p>
      <footer>
        <span class="shop-price">₡${PROCUREMENT_REROLL_FEE}</span>
        <button class="buy-button" data-refresh-procurement ${state.money < PROCUREMENT_REROLL_FEE ? "disabled" : ""}>${text("procurement_refresh_button", "更新")}</button>
      </footer>
    </article>${hardwareCards}`;
}

function renderBroker() {
  const totalUsable = ownedBases().reduce((sum, base) => sum + usableCellCount(base), 0);
  document.getElementById("property-summary").innerHTML = `<span>OWNED BASES ${ownedBases().length}</span><strong>${totalUsable} usable grid cells</strong>`;
  document.getElementById("refresh-properties").disabled = state.money < PROPERTY_REROLL_FEE;
  document.getElementById("property-list").innerHTML = state.propertyListings.map((property) => {
    property.description = propertyFlavorDescription(property);
    const blocked = blockedCellSet(property);
    const preview = Array.from({ length: property.cols * property.rows }, (_, index) => {
      const x = index % property.cols;
      const y = Math.floor(index / property.cols);
      return `<i class="${blocked.has(cellKey(x, y)) ? "hole" : ""}" title="${x + 1},${y + 1}"></i>`;
    }).join("");
    const saleMarkup = property.onSale
      ? `<small class="sale-note">SALE ${Math.round(property.discountRate * 100)}% OFF / 通常 ₡${formatNumber(property.basePrice)}</small>`
      : "";
    const visibleTraits = property.traits.filter((trait) => !trait.startsWith("Missing"));
    return `
    <article class="property-card">
      <div class="property-visual">
        <img src="${property.image}" alt="">
      </div>
      <div class="property-copy">
        <p class="eyebrow">${property.code}</p>
        <h3>${property.name}</h3>
        <p>${property.description}</p>
        ${tagMarkup(property.tags, BASE_TAGS)}
        <div class="property-preview" style="--preview-cols:${property.cols};--preview-rows:${property.rows}" aria-label="物件マス形状プレビュー">${preview}</div>
        <div class="property-tags">${visibleTraits.map((trait) => `<span>${trait}</span>`).join("")}</div>
      </div>
      <div class="property-contract">
        <strong>${property.cols} x ${property.rows}</strong>
        <small>維持費 ₡${property.upkeep}/日</small>
        ${saleMarkup}
        <b>₡${formatNumber(property.price)}</b>
        <button class="buy-button" data-contract-property="${property.id}" ${state.money < property.price ? "disabled" : ""}>CONTRACT</button>
      </div>
    </article>
  `;
  }).join("");
}

function renderRadio() {
  const summary = document.getElementById("radio-summary");
  const noiseButton = document.getElementById("noise-cancel-toggle");
  const noiseState = document.getElementById("noise-cancel-state");
  const ambientList = document.getElementById("ambient-layer-list");
  const radioList = document.getElementById("radio-program-list");
  if (!summary || !noiseButton || !noiseState || !ambientList || !radioList) return;

  const activeLayers = new Set(activeAmbientLayers().map(([id]) => id));
  const radio = RADIO_PROGRAMS[state.audio.radioProgram] || RADIO_PROGRAMS.off;
  summary.innerHTML = `<span>${state.audio.noiseCanceling ? "NOISE CANCELING" : `${activeLayers.size} AMBIENT LAYERS`}</span><strong>${radio?.name || "OFF"}</strong>`;
  noiseButton.classList.toggle("active", state.audio.noiseCanceling);
  noiseState.textContent = state.audio.noiseCanceling ? "ON" : "OFF";

  ambientList.innerHTML = Object.entries(AMBIENT_LAYERS).map(([id, layer]) => {
    const active = activeLayers.has(id);
    return `<article class="ambient-layer ${active ? "active" : ""} ${state.audio.noiseCanceling ? "muted" : ""}">
      <span>${active ? "LIVE" : "STANDBY"} // ${escapeHtml(layer.condition)}</span>
      <strong>${escapeHtml(layer.label || id)}</strong>
      <p>${escapeHtml(layer.description || "")}</p>
    </article>`;
  }).join("");

  radioList.innerHTML = Object.entries(RADIO_PROGRAMS).filter(([, program]) => program.unlocked).map(([id, program]) => `
    <button class="radio-program ${state.audio.radioProgram === id ? "active" : ""}" data-radio-program="${id}" type="button">
      <span>${escapeHtml(program.kicker || "RADIO")}</span>
      <strong>${escapeHtml(program.name || id)}</strong>
      <p>${escapeHtml(program.description || "")}</p>
    </button>
  `).join("");
}

function render() {
  const cleaningNeeded = ownedBases().some((base) => [...base.shelves, ...base.floorDevices].some(needsCleaning));
  document.querySelector('[data-tab="farm"]')?.classList.toggle("needs-cleaning-tab", cleaningNeeded);
  document.querySelector('[data-tab="market"]')?.classList.toggle("locked", !state.marketTabUnlocked);
  document.querySelector('[data-tab="market"]')?.toggleAttribute("disabled", !state.marketTabUnlocked);
  document.querySelector('[data-tab="shop"]')?.classList.toggle("locked", !state.shopUnlocked);
  document.querySelector('[data-tab="shop"]')?.toggleAttribute("disabled", !state.shopUnlocked);
  document.querySelector('[data-tab="schedule"]')?.classList.toggle("locked", !state.shopUnlocked);
  document.querySelector('[data-tab="schedule"]')?.toggleAttribute("disabled", !state.shopUnlocked);
  document.querySelector('[data-tab="broker"]')?.classList.toggle("locked", !state.brokerUnlocked);
  document.querySelector('[data-tab="broker"]')?.toggleAttribute("disabled", !state.brokerUnlocked);
  renderHeader();
  renderFarm();
  renderMarkets();
  renderSchedule();
  renderShop();
  renderBroker();
  renderRadio();
  renderTimeControl();
  syncLoopAudio();
}

function renderRuntime() {
  const cleaningNeeded = ownedBases().some((base) => [...base.shelves, ...base.floorDevices].some(needsCleaning));
  document.querySelector('[data-tab="farm"]')?.classList.toggle("needs-cleaning-tab", cleaningNeeded);
  renderHeader();
  if (farmRenderRequested) {
    farmRenderRequested = false;
    renderFarm();
  } else {
    updateFarmProgress();
  }
  if (document.getElementById("schedule-screen")?.classList.contains("active")) renderSchedule();
  if (document.getElementById("radio-screen")?.classList.contains("active")) renderRadio();
  renderTimeControl();
  syncLoopAudio();
}

function updateFarmProgress() {
  currentActivePlants().forEach(({ plant, shelfIndex, slotIndex }) => {
    const slot = document.querySelector(`[data-shelf="${shelfIndex}"][data-slot="${slotIndex}"]`);
    if (!slot || plant.ready || plant.dead) return;
    const crop = CROPS[plant.crop];
    const progress = Math.min(100, (plant.growth / crop.days) * 100);
    const fill = slot.querySelector(".progress-fill");
    const remaining = slot.querySelector(".slot-meta span");
    if (fill) fill.style.width = `${progress}%`;
    if (remaining) remaining.textContent = `残り ${Math.max(0, crop.days - plant.growth).toFixed(1)}日`;
  });
}

function renderTimeControl() {
  const button = document.getElementById("end-day-button");
  button.disabled = state.ended;
  button.classList.toggle("paused", state.paused || !state.timeUnlocked);
  document.getElementById("time-control-label").textContent = state.ended ? "OPERATION CLOSED" : !state.timeUnlocked ? "TUTORIAL DAY LOCK" : state.paused ? "REALTIME PAUSED" : "REALTIME RUNNING";
  document.getElementById("time-control-text").textContent = state.ended ? "Game ended" : !state.timeUnlocked ? "DAY停止中" : state.paused ? "Resume" : "Pause";
  document.getElementById("time-control-icon").textContent = state.ended ? "■" : !state.timeUnlocked ? "LOCK" : state.paused ? "▶" : "Ⅱ";
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    const scheduleEntryAction = event.target.closest("[data-schedule-entry]");
    if (scheduleEntryAction) {
      event.preventDefault();
      showScheduleEntryDetail(scheduleEntryAction.dataset.scheduleEntry, scheduleEntryAction);
      return;
    }

    const scheduleRerollAction = event.target.closest("[data-reroll-schedule]");
    if (scheduleRerollAction) {
      event.preventDefault();
      requestScheduleReroll();
      return;
    }

    const day30ResultAction = event.target.closest("[data-day30-result]");
    if (day30ResultAction) {
      event.preventDefault();
      if (day30ResultAction.dataset.day30Result === "start") day30ResultToStart();
      if (day30ResultAction.dataset.day30Result === "view") enterDay30ViewMode();
      if (day30ResultAction.dataset.day30Result === "share-x") openXShareDraft();
      return;
    }

    if (event.target.closest("#confirm-cancel")) {
      event.preventDefault();
      closeConfirmWidget();
      return;
    }

    if (event.target.closest("#confirm-ok")) {
      event.preventDefault();
      confirmWidgetAction();
      return;
    }

    const commsNext = event.target.closest("[data-comms-next]");
    if (commsNext) {
      event.preventDefault();
      nextCommsPage();
      return;
    }

    const commsChoice = event.target.closest("[data-comms-choice]");
    if (commsChoice) {
      event.preventDefault();
      closeComms(commsChoice.dataset.commsChoice);
      return;
    }

    if (event.target.closest("#comms-close")) {
      event.preventDefault();
      closeComms("dismiss");
      return;
    }

    if (isCommsBlocking() && !isCommsInteractionTarget(event.target)) {
      event.preventDefault();
      return;
    }
    if (event.target.closest("#news-history-button")) {
      event.preventDefault();
      openNewsHistory();
      return;
    }
    if (event.target.closest("#news-history-close")) {
      event.preventDefault();
      closeNewsHistory();
      return;
    }
    if (event.target.id === "news-history-panel") {
      event.preventDefault();
      closeNewsHistory();
      return;
    }
    if (Date.now() < suppressClickUntil) {
      event.preventDefault();
      return;
    }

    const noiseToggle = event.target.closest("#noise-cancel-toggle");
    if (noiseToggle) {
      event.preventDefault();
      setNoiseCanceling(!state.audio.noiseCanceling);
      return;
    }

    const radioProgram = event.target.closest("[data-radio-program]");
    if (radioProgram) {
      event.preventDefault();
      selectRadioProgram(radioProgram.dataset.radioProgram);
      return;
    }

    const automationControl = event.target.closest("[data-auto-action]");
    if (automationControl) {
      event.preventDefault();
      handleAutomationControl(automationControl);
      return;
    }

    const tab = event.target.closest(".tab");
    if (tab) {
      switchTab(tab.dataset.tab);
      syncLoopAudio();
    }

    const seedOption = event.target.closest("[data-seed]");
    if (seedOption) {
      selectedSeed = seedOption.dataset.seed;
      playSound("seed_select", 0.16);
      renderFarm();
    }

    const slot = plantSlotElementAtPoint(event.clientX, event.clientY) || event.target.closest("[data-shelf][data-slot]");
    if (slot) {
      handleSlotClick(Number(slot.dataset.shelf), Number(slot.dataset.slot));
      return;
    }

    const alphaTarget = placementSelection
      ? (gridCellAtPoint(event.clientX, event.clientY) || event.target)
      : (interactiveElementFromPoint(event.clientX, event.clientY) || event.target);
    const gridCell = alphaTarget.closest("[data-grid-x][data-grid-y]");
    if (gridCell && placementSelection) {
      placeSelectedAt(Number(gridCell.dataset.gridX), Number(gridCell.dataset.gridY));
      return;
    }

    const placementStock = event.target.closest("[data-place-kind][data-place-id]");
    if (placementStock) {
      placementSelection = { kind: placementStock.dataset.placeKind, id: placementStock.dataset.placeId };
      renderFarm();
    }

    const stockSellButton = event.target.closest("[data-sell-stock-kind][data-sell-stock-id]");
    if (stockSellButton) {
      sellOwnedItem(stockSellButton.dataset.sellStockKind, stockSellButton.dataset.sellStockId);
      return;
    }

    const envButton = event.target.closest("[data-env][data-env-delta]");
    if (envButton) {
      adjustEnvironment(envButton.dataset.env, Number(envButton.dataset.envDelta));
      return;
    }

    const zoomButton = event.target.closest("[data-view-zoom]");
    if (zoomButton) {
      zoomFacility(Number(zoomButton.dataset.viewZoom) * FACILITY_ZOOM_STEP);
      renderFarm();
      return;
    }

    if (event.target.closest("[data-view-reset]")) {
      resetFacilityView();
      renderFarm();
      return;
    }

    if (event.target.closest("[data-cancel-placement]")) {
      cancelPlacementSelection();
      return;
    }

    const spriteEquipment = equipmentItemAtSpritePoint(event.clientX, event.clientY);
    const unitButton = spriteEquipment?.closest("[data-select-unit]") || event.target.closest("[data-select-unit]");
    if (unitButton) {
      if (!isOpaqueEquipmentPointer(unitButton, event)) return;
      const unit = currentShelves().find((entry) => entry.id === unitButton.dataset.selectUnit);
      if (unit?.slots.some((plant) => plant?.ready) && !GROW_UNIT_SLOT_LAYOUTS[unit.type]?.length) {
        harvestReadyPlantsInUnit(unit.id, unitButton);
        return;
      }
      if (unit) setStatus(observationForUnit(unit));
      return;
    }

    const deviceButton = spriteEquipment?.closest("[data-select-device]") || event.target.closest("[data-select-device]");
    if (deviceButton) {
      if (!isOpaqueEquipmentPointer(deviceButton, event)) return;
      const device = currentFloorDevices().find((entry) => entry.id === deviceButton.dataset.selectDevice);
      if (device?.type === "support_robot") {
        showSupportRobotPanel(device);
        if (!hasAnySupportOS()) triggerComms("support_robot_os_required");
        return;
      }
      if (device?.type === "procurement_terminal") {
        showProcurementTerminal();
        return;
      }
      if (device?.type === "shipping_hatch") {
        showShippingTerminal();
        return;
      }
      if (device) setStatus(`${FLOOR_DEVICES[device.type].name}が低く唸っています。周囲の空気だけが少し違う速度で動いています。`);
      return;
    }

    const moveUnitButton = event.target.closest("[data-move-unit]");
    if (moveUnitButton) startPlacement("unit", moveUnitButton.dataset.moveUnit);

    const moveDeviceButton = event.target.closest("[data-move-device]");
    if (moveDeviceButton) startPlacement("device", moveDeviceButton.dataset.moveDevice);

    const stockUnitButton = event.target.closest("[data-stock-unit]");
    if (stockUnitButton) returnItemToStock("unit", stockUnitButton.dataset.stockUnit);

    const stockDeviceButton = event.target.closest("[data-stock-device]");
    if (stockDeviceButton) returnItemToStock("device", stockDeviceButton.dataset.stockDevice);

    const sellUnitButton = event.target.closest("[data-sell-unit]");
    if (sellUnitButton) sellOwnedItem("unit", sellUnitButton.dataset.sellUnit);

    const sellDeviceButton = event.target.closest("[data-sell-device]");
    if (sellDeviceButton) sellOwnedItem("device", sellDeviceButton.dataset.sellDevice);

    const baseSwitch = event.target.closest("[data-select-base]");
    if (baseSwitch) switchBase(baseSwitch.dataset.selectBase);

    const contractButton = event.target.closest("[data-contract-property]");
    if (contractButton) contractProperty(contractButton.dataset.contractProperty);
    const marketCycle = event.target.closest("[data-market-cycle]");
    if (marketCycle) {
      event.preventDefault();
      cycleMarket(Number(marketCycle.dataset.marketCycle) || 1);
      return;
    }

    const market = event.target.closest("[data-market]");
    if (market) {
      if (!isMarketAvailable(market.dataset.market)) {
        rejectFeedback();
        return;
      }
      selectedMarket = market.dataset.market;
      playSound("market_select", 0.18);
      hapticFeedback(8);
      renderMarkets();
    }

    const buySeedButton = event.target.closest("[data-buy-seed]");
    if (buySeedButton) buySeed(buySeedButton.dataset.buySeed);

    const buyItemButton = event.target.closest("[data-buy-item]");
    if (buyItemButton) buyEquipment(buyItemButton.dataset.buyItem);

    const refreshProcurementButton = event.target.closest("[data-refresh-procurement]");
    if (refreshProcurementButton) refreshProcurementLineup();

    const qtyButton = event.target.closest("[data-qty-id]");
    if (qtyButton) changeSaleQty(qtyButton.dataset.qtyId, Number(qtyButton.dataset.delta));

    const sellButton = event.target.closest("[data-sell-id]");
    if (sellButton) sellBatch(sellButton.dataset.sellId);
  });

  document.addEventListener("input", (event) => {
    if (event.target.id === "day30-player-name") applyDay30PlayerName();
  });

  document.addEventListener("pointerdown", (event) => {
    if (isCommsInteractionTarget(event.target)) return;
    if (isCommsBlocking() && !isCommsInteractionTarget(event.target)) {
      event.preventDefault();
      return;
    }
    if (pointerDrag) return;
    if (equipmentMenu?.persistent) {
      if (event.target.closest(".equipment-pie-menu")) return;
      clearEquipmentMenu();
    }
    if (event.button !== undefined && event.button !== 0) return;
    const cleanTool = event.target.closest("[data-clean-tool]");
    if (cleanTool) {
      beginCleanToolDrag(cleanTool, event);
      return;
    }
    const seed = event.target.closest("[data-drag-crop]");
    const plantSlotTarget = plantSlotElementAtPoint(event.clientX, event.clientY) || event.target.closest("[data-box-plant-slot]");
    const equipment = equipmentItemAtSpritePoint(event.clientX, event.clientY) || event.target.closest("[data-drag-kind][data-drag-id]");
    const opaqueEquipment = equipment && isOpaqueEquipmentPointer(equipment, event);
    const placedEquipment = equipment?.classList.contains("facility-item");
    const gridShell = event.target.closest(".facility-grid-shell");
    if (gridShell && event.pointerType !== "mouse") {
      facilityPointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (gridShell.setPointerCapture) gridShell.setPointerCapture(event.pointerId);
      if (facilityPointers.size >= 2 && !placementSelection) {
        beginFacilityPinch(gridShell);
        event.preventDefault();
        return;
      }
    }
    if (facilityPinch) return;
    const harvestableUnit = equipment?.dataset.selectUnit
      ? currentShelves().find((unit) => unit.id === equipment.dataset.selectUnit && unit.slots.some((plant) => plant?.ready))
      : null;
    if (plantSlotTarget) {
      const shelfIndex = Number(plantSlotTarget.dataset.shelf);
      const slotIndex = Number(plantSlotTarget.dataset.slot);
      const plant = currentShelves()[shelfIndex]?.slots?.[slotIndex];
      if (plant?.ready) {
        harvestSwipe = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          harvested: new Set()
        };
        harvestReadySlotElement(plantSlotTarget);
        suppressClickUntil = Date.now() + 250;
        event.preventDefault();
        return;
      }
    }
    if (equipment && opaqueEquipment && harvestableUnit && !plantSlotTarget) {
      if (event.pointerType === "mouse") {
        harvestSwipe = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          harvested: new Set()
        };
        harvestReadyUnitElement(equipment);
        suppressClickUntil = Date.now() + 250;
        event.preventDefault();
        return;
      }
      harvestHold = {
        pointerId: event.pointerId,
        source: equipment,
        unitId: harvestableUnit.id,
        startX: event.clientX,
        startY: event.clientY
      };
      beginEquipmentMenuHold(equipment, event);
      event.preventDefault();
      return;
    }
    if (equipment && opaqueEquipment && placedEquipment && event.pointerType !== "mouse") {
      beginEquipmentMenuHold(equipment, event);
      return;
    }
    if (seed && state.seeds[seed.dataset.dragCrop] > 0) {
      if (event.pointerType !== "mouse") {
        pendingSeedDrag = {
          source: seed,
          pointerId: event.pointerId,
          cropId: seed.dataset.dragCrop,
          startX: event.clientX,
          startY: event.clientY
        };
        return;
      }
      dragPayload = { type: "seed", cropId: seed.dataset.dragCrop };
    } else if (equipment && opaqueEquipment) {
      dragPayload = { type: "equipment", kind: equipment.dataset.dragKind, id: equipment.dataset.dragId };
    } else if (gridShell && !placementSelection && !event.target.closest("[data-shelf], .facility-grid-toolbar, .selected-unit-panel") && !opaqueEquipment) {
      facilityPan = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        viewX: facilityView.x,
        viewY: facilityView.y,
        moved: false
      };
      gridShell.classList.add("panning");
      if (gridShell.setPointerCapture) gridShell.setPointerCapture(event.pointerId);
      return;
    } else {
      return;
    }
    beginPointerDrag(seed || equipment, event, dragPayload);
  });

  document.addEventListener("pointermove", (event) => {
    if (updateCleanToolDrag(event)) return;
    if (updateEquipmentMenu(event)) return;
    if (pendingSeedDrag && event.pointerId === pendingSeedDrag.pointerId) {
      const dx = event.clientX - pendingSeedDrag.startX;
      const dy = event.clientY - pendingSeedDrag.startY;
      const distance = Math.hypot(dx, dy);
      if (distance < 9) return;
      if (Math.abs(dy) > Math.abs(dx) * 1.15) {
        pendingSeedDrag = null;
        return;
      }
      const pending = pendingSeedDrag;
      pendingSeedDrag = null;
      beginPointerDrag(pending.source, event, { type: "seed", cropId: pending.cropId }, pending.startX, pending.startY);
    }
    if (harvestHold && event.pointerId === harvestHold.pointerId) {
      const distance = Math.hypot(event.clientX - harvestHold.startX, event.clientY - harvestHold.startY);
      if (distance < 9) {
        event.preventDefault();
        return;
      }
      const pending = harvestHold;
      harvestHold = null;
      cancelEquipmentMenuTimer();
      harvestSwipe = {
        pointerId: event.pointerId,
        startX: pending.startX,
        startY: pending.startY,
        harvested: new Set()
      };
      harvestReadyUnitElement(pending.source);
      harvestReadyUnitAtPoint(event.clientX, event.clientY);
      suppressClickUntil = Date.now() + 250;
      event.preventDefault();
      return;
    }
    if (updatePendingEquipmentMenu(event)) return;
    if (facilityPinch && updateFacilityPinch(event)) return;
    if (harvestSwipe && event.pointerId === harvestSwipe.pointerId) {
      const distance = Math.hypot(event.clientX - harvestSwipe.startX, event.clientY - harvestSwipe.startY);
      if (distance >= 6) {
        event.preventDefault();
        harvestReadyUnitAtPoint(event.clientX, event.clientY);
      }
      return;
    }
    if (facilityPan && event.pointerId === facilityPan.pointerId) {
      const dx = event.clientX - facilityPan.startX;
      const dy = event.clientY - facilityPan.startY;
      if (!facilityPan.moved && Math.hypot(dx, dy) < 4) return;
      facilityPan.moved = true;
      event.preventDefault();
      facilityView.x = facilityPan.viewX + dx;
      facilityView.y = facilityPan.viewY + dy;
      applyFacilityView();
      return;
    }
    if (!pointerDrag || !dragPayload || event.pointerId !== pointerDrag.pointerId) return;
    const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY);
    if (!pointerDrag.moved && distance < 7) return;
    if (!pointerDrag.moved) {
      pointerDrag.moved = true;
      pointerDrag.source.classList.add("dragging");
      document.body.classList.add("drag-active");
      if (dragPayload.type === "equipment") document.body.classList.add("equipment-drag-active");
      pointerDrag.ghost = pointerDrag.source.cloneNode(true);
      pointerDrag.ghost.className = "drag-ghost";
      document.body.appendChild(pointerDrag.ghost);
    }
    event.preventDefault();
    pointerDrag.ghost.style.left = `${event.clientX}px`;
    pointerDrag.ghost.style.top = `${event.clientY}px`;
    const ignoredItem = dragPayload.type === "equipment" ? pointerDrag.source : null;
    const hovered = interactiveElementFromPoint(event.clientX, event.clientY, ignoredItem);
    const slot = hovered && hovered.closest("[data-shelf][data-slot]");
    const unitTarget = hovered && hovered.closest("[data-select-unit]");
    const cell = dragPayload.type === "equipment"
      ? gridCellAtPoint(event.clientX, event.clientY)
      : hovered && hovered.closest("[data-grid-x][data-grid-y]");
    document.querySelectorAll(".drop-target, .drop-footprint, .seed-drop-target").forEach((element) => element.classList.remove("drop-target", "drop-footprint", "seed-drop-target"));
    pointerDrag.dropOrigin = null;
    pointerDrag.dropUnitId = null;
    if (dragPayload.type === "seed" && slot) {
      const plant = currentShelves()[Number(slot.dataset.shelf)]?.slots[Number(slot.dataset.slot)];
      if (!plant) {
        slot.classList.add("drop-target");
      }
    } else if (dragPayload.type === "seed" && unitTarget) {
      const unit = currentShelves().find((entry) => entry.id === unitTarget.dataset.selectUnit);
      if (unit && unit.slots.some((plant) => !plant)) {
        pointerDrag.dropUnitId = unit.id;
        unitTarget.classList.add("seed-drop-target");
      }
    }
    if (dragPayload.type === "equipment" && cell) {
      const record = findOwnedEquipment(dragPayload.kind, dragPayload.id);
      const item = record?.item;
      const originX = Number(cell.dataset.gridX) - pointerDrag.anchorX;
      const originY = Number(cell.dataset.gridY) - pointerDrag.anchorY;
      if (item && canPlace({ ...item, kind: dragPayload.kind }, originX, originY, item.id)) {
        pointerDrag.dropOrigin = { x: originX, y: originY };
        highlightDragFootprint(item, dragPayload.kind, originX, originY);
      } else {
        pointerDrag.dropOrigin = null;
      }
    }
  });

  document.addEventListener("pointerup", (event) => {
    endFacilityPointer(event);
    if (finishCleanToolDrag(event)) return;
    if (finishEquipmentMenu(event)) return;
    if (equipmentMenuTimer && event.pointerId === equipmentMenuTimer.pointerId) {
      const pending = equipmentMenuTimer;
      cancelEquipmentMenuTimer();
      if (harvestHold && event.pointerId === harvestHold.pointerId) harvestHold = null;
      if (handleFacilityEquipmentTap(pending.source, event)) {
        suppressClickUntil = Date.now() + 220;
        event.preventDefault();
        return;
      }
      suppressClickUntil = Date.now() + 180;
      return;
    }
    if (harvestHold && event.pointerId === harvestHold.pointerId) {
      harvestHold = null;
      suppressClickUntil = Date.now() + 120;
      return;
    }
    if (harvestSwipe && event.pointerId === harvestSwipe.pointerId) {
      suppressClickUntil = Date.now() + 180;
      harvestSwipe = null;
      return;
    }
    if (pendingSeedDrag && event.pointerId === pendingSeedDrag.pointerId) {
      pendingSeedDrag = null;
      return;
    }
    if (facilityPan && event.pointerId === facilityPan.pointerId) {
      const shell = document.querySelector(".facility-grid-shell");
      if (shell) shell.classList.remove("panning");
      if (facilityPan.moved) suppressClickUntil = Date.now() + 120;
      facilityPan = null;
      return;
    }
    if (!pointerDrag || !dragPayload || event.pointerId !== pointerDrag.pointerId) return;
    if (!pointerDrag.moved) {
      clearDragState();
      return;
    }
    const payload = { ...dragPayload };
    const ignoredItem = payload.type === "equipment" ? pointerDrag.source : null;
    const hovered = interactiveElementFromPoint(event.clientX, event.clientY, ignoredItem);
    const slot = hovered && hovered.closest("[data-shelf][data-slot]");
    const cell = payload.type === "equipment"
      ? gridCellAtPoint(event.clientX, event.clientY)
      : hovered && hovered.closest("[data-grid-x][data-grid-y]");
    const validSeedDrop = payload.type === "seed" && slot && slot.classList.contains("drop-target");
    const seedUnitId = pointerDrag.dropUnitId;
    const validUnitSeedDrop = payload.type === "seed" && Boolean(seedUnitId);
    const equipmentOrigin = pointerDrag.dropOrigin ? { ...pointerDrag.dropOrigin } : null;
    const validEquipmentDrop = payload.type === "equipment" && Boolean(equipmentOrigin);
    suppressClickUntil = Date.now() + 250;
    clearDragState();
    if (validSeedDrop) {
      selectedSeed = payload.cropId;
      plantSeed(Number(slot.dataset.shelf), Number(slot.dataset.slot), payload.cropId, slot);
    } else if (validUnitSeedDrop) {
      const shelfIndex = currentShelves().findIndex((unit) => unit.id === seedUnitId);
      const slotIndex = currentShelves()[shelfIndex]?.slots.findIndex((plant) => !plant);
      if (shelfIndex >= 0 && slotIndex >= 0) {
        selectedSeed = payload.cropId;
        plantSeed(shelfIndex, slotIndex, payload.cropId, document.querySelector(`[data-select-unit="${seedUnitId}"]`));
      }
    } else if (validEquipmentDrop) {
      placeItemAt(payload.kind, payload.id, equipmentOrigin.x, equipmentOrigin.y, cell, { selectAfterPlace: false });
    } else {
      rejectFeedback();
    }
  });

  document.addEventListener("pointercancel", (event) => {
    endFacilityPointer(event);
    if (cleanToolDrag && event.pointerId === cleanToolDrag.pointerId) clearCleanToolDrag();
    if (equipmentMenu && event.pointerId === equipmentMenu.pointerId) clearEquipmentMenu();
    if (equipmentMenuTimer && event.pointerId === equipmentMenuTimer.pointerId) cancelEquipmentMenuTimer();
    if (pendingSeedDrag && event.pointerId === pendingSeedDrag.pointerId) pendingSeedDrag = null;
    if (harvestHold && event.pointerId === harvestHold.pointerId) harvestHold = null;
    if (harvestSwipe && event.pointerId === harvestSwipe.pointerId) harvestSwipe = null;
    if (facilityPan && event.pointerId === facilityPan.pointerId) {
      const shell = document.querySelector(".facility-grid-shell");
      if (shell) shell.classList.remove("panning");
      facilityPan = null;
    }
  });

  document.addEventListener("wheel", (event) => {
    if (isCommsBlocking() && !isCommsInteractionTarget(event.target)) {
      event.preventDefault();
      return;
    }
    const shell = event.target.closest(".facility-grid-shell");
    if (!shell) return;
    if (event.target.closest(".selected-unit-panel")) return;
    event.preventDefault();
    zoomFacility(event.deltaY > 0 ? -FACILITY_ZOOM_STEP : FACILITY_ZOOM_STEP);
    renderFarm();
  }, { passive: false });

  document.addEventListener("contextmenu", (event) => {
    if (isCommsBlocking() && !isCommsInteractionTarget(event.target)) {
      event.preventDefault();
      return;
    }
    const equipment = equipmentItemAtSpritePoint(event.clientX, event.clientY) || event.target.closest(".facility-item[data-drag-kind][data-drag-id]");
    if (!equipment || !equipment.classList.contains("facility-item") || !isOpaqueEquipmentPointer(equipment, event)) return;
    event.preventDefault();
    clearDragState();
    clearEquipmentMenu();
    openEquipmentMenu(equipment, {
      pointerId: "contextmenu",
      clientX: event.clientX,
      clientY: event.clientY,
      pointerType: "mouse",
      preventDefault() {}
    }, { persistent: true });
  });

  document.addEventListener("pointercancel", clearDragState);
  document.addEventListener("dragstart", (event) => {
    if (event.target.closest("[data-drag-kind], [data-drag-crop]")) event.preventDefault();
  });

  document.getElementById("end-day-button").addEventListener("click", togglePause);
  document.getElementById("refresh-properties").addEventListener("click", refreshPropertyListings);
  document.getElementById("reset-button").addEventListener("click", requestExitToStart);
  document.getElementById("modal-reset").addEventListener("click", requestNewGame);
  document.getElementById("start-continue").addEventListener("click", handleStartPrimary);
  document.getElementById("start-day30")?.addEventListener("click", requestSelectedModeGame);
  document.getElementById("start-new").addEventListener("click", requestSelectedModeGame);
  document.getElementById("start-mode-toggle").addEventListener("click", toggleStartModeView);
  document.getElementById("start-title")?.addEventListener("click", handleStartTitleTap);
  document.getElementById("record-export-button").addEventListener("click", requestRecordExport);
  document.getElementById("confirm-cancel").addEventListener("click", closeConfirmWidget);
  document.getElementById("confirm-ok").addEventListener("click", confirmWidgetAction);
  document.getElementById("confirm-danger").addEventListener("click", confirmWidgetDangerAction);
  document.getElementById("confirm-extra").addEventListener("click", confirmWidgetExtraAction);
  document.getElementById("modal-close").addEventListener("click", () => {
    document.getElementById("modal-backdrop").classList.add("hidden");
  });

  document.addEventListener("keydown", (event) => {
    if (isCommsBlocking()) {
      const targetInComms = isCommsInteractionTarget(event.target) || isCommsInteractionTarget(document.activeElement);
      if (!targetInComms || !["Enter", " ", "Tab"].includes(event.key)) {
        event.preventDefault();
        return;
      }
    }
    if (event.key === "Escape" && !document.getElementById("news-history-panel")?.classList.contains("hidden")) {
      closeNewsHistory();
      return;
    }
    if (event.key === "Escape" && !document.getElementById("confirm-widget")?.classList.contains("hidden")) {
      closeConfirmWidget();
      return;
    }
    if (event.key === "Escape" && placementSelection) {
      cancelPlacementSelection();
      return;
    }
    if (event.key === "1") switchTab("farm");
    if (event.key === "2") switchTab("market");
    if (event.key === "3") switchTab("shop");
    if (event.key === "4") switchTab("schedule");
    if (event.key === "5") switchTab("broker");
    if (event.key === "6") switchTab("radio");
  });
}

function clearDragState() {
  dragPayload = null;
  pendingSeedDrag = null;
  if (pointerDrag && pointerDrag.ghost) pointerDrag.ghost.remove();
  pointerDrag = null;
  document.body.classList.remove("drag-active", "equipment-drag-active");
  document.querySelectorAll(".dragging, .drop-target, .drop-footprint, .seed-drop-target").forEach((element) => {
    element.classList.remove("dragging", "drop-target", "drop-footprint", "seed-drop-target");
  });
}

async function bootstrap() {
  setBootLoadingProgress(0, 1, "CSVデータを読み込んでいます...");
  await loadExternalData();
  await preloadBootAssets();
  startModeView = safeStorageGet(START_MODE_PREF_KEY) === "free" ? "free" : "day30";
  loadGame();
  bindEvents();
  render();
  openStartScreen({ persist: false });
  hideBootLoading();
  window.setInterval(realtimeTick, 200);
}

function showBootstrapError(error) {
  console.error(error);
  const isFile = window.location.protocol === "file:";
  const message = isFile
    ? "Direct file launch cannot load the CSV data in Chrome. Start a local server and open http://127.0.0.1:8766/index.html."
    : `Game data failed to load: ${error.message}`;
  const status = document.getElementById("status-text");
  if (status) status.textContent = message;
  const news = document.getElementById("news-text");
  if (news) news.textContent = message;
  const modal = document.getElementById("modal-backdrop");
  if (modal) {
    document.getElementById("modal-kicker").textContent = "BOOT ERROR";
    document.getElementById("modal-title").textContent = "Game data could not be loaded";
    document.getElementById("modal-content").innerHTML = `<p class="modal-copy">${message}</p>`;
    document.getElementById("modal-close").style.display = "";
    modal.classList.remove("hidden");
  }
}

bootstrap().catch(showBootstrapError);
