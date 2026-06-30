/* ============================================================
   Defaults & reference data
   ============================================================ */

// ACP panel categories — dims auto-derived from case dimensions.
// dimA / dimB are keys into caseDims: L=length, W=width, H=height, H1=lidHeight
const PANEL_CATEGORIES = [
  { key: "LxH",  label: "L × H  (body long sides)",  dimA: "length", dimB: "height",    qty: 2 },
  { key: "LxH1", label: "L × H1 (lid long sides)",    dimA: "length", dimB: "lidHeight", qty: 2 },
  { key: "WxH",  label: "W × H  (body short sides)", dimA: "width",  dimB: "height",    qty: 2 },
  { key: "WxH1", label: "W × H1 (lid short sides)",   dimA: "width",  dimB: "lidHeight", qty: 2 },
  { key: "LxW",  label: "L × W  (base + lid)",        dimA: "length", dimB: "width",     qty: 2 },
];

const ACP_THICKNESS = [3, 4, 6]; // mm
const ACP_SHEET = { w: 1220, h: 2420 }; // mm standard sheet (fallback)

// Panel materials — all priced by the SAME sheet-cutting function.
// Only these properties change per material. Margin is intentionally blank ("") =
// optional, treated as 0 unless the user enters one. baseRate is an optional default.
// densityKgPerM3 drives the live weight calc (Section 4). Sensible factory defaults below — admin can override per material in Settings.
const PANEL_MATERIALS = [
  { name: "ACP",        sheetW: 1220, sheetL: 2420, thicknessOptions: [3, 4, 6],      thickness: 4,  baseRate: 38, margin: "", overlay: "", cutMargin: 20, densityKgPerM3: 1500 },
  { name: "MDF",        sheetW: 1220, sheetL: 2440, thicknessOptions: [6, 9, 12, 18], thickness: 12, baseRate: 25, margin: "", overlay: "", cutMargin: 20, densityKgPerM3: 750 },
  { name: "Plywood",    sheetW: 1220, sheetL: 2440, thicknessOptions: [6, 8, 12, 18], thickness: 12, baseRate: 35, margin: "", overlay: "", cutMargin: 20, densityKgPerM3: 650 },
  { name: "ABS Silver", sheetW: 1220, sheetL: 2440, thicknessOptions: [1.5, 2, 3],    thickness: 2,  baseRate: 55, margin: "", overlay: "", cutMargin: 20, densityKgPerM3: 1050 },
];
function panelMaterial(name) { return SETTINGS.panelMaterials.find(m => m.name === name) || SETTINGS.panelMaterials[0]; }

// Foam types — sheet-cut like panels, but sheet cost is thickness-based.
// Each carries: sheet size, default thickness, rate/mm, margin, adhesive, cut margin.
// densityKgPerM3 drives the live weight calc (Section 4). Sensible factory defaults below — admin can override per material in Settings.
const FOAM_TYPES = [
  { name: "EPE foam",       sheetW: 1400, sheetL: 2000, thickness: 40, rate: 0.85, margin: "",  adhesive: 40, cutMargin: 20, densityKgPerM3: 25 },
  { name: "XLPE foam",      sheetW: 1000, sheetL: 2000, thickness: 25, rate: 1.40, margin: "",  adhesive: 40, cutMargin: 20, densityKgPerM3: 60 },
  { name: "PU foam",        sheetW: 1000, sheetL: 2000, thickness: 50, rate: 0.65, margin: "",  adhesive: 40, cutMargin: 20, densityKgPerM3: 30 },
  { name: "Charcoal foam",  sheetW: 1000, sheetL: 2000, thickness: 20, rate: 1.10, margin: "",  adhesive: 40, cutMargin: 20, densityKgPerM3: 28 },
  { name: "Egg-crate foam", sheetW: 1000, sheetL: 2000, thickness: 30, rate: 0.95, margin: "",  adhesive: 40, cutMargin: 20, densityKgPerM3: 25 },
];
function foamType(name) { return SETTINGS.foamTypes.find(f => f.name === name) || SETTINGS.foamTypes[0]; }

// Foam now mirrors panels: same 5 categories derived from case dims, default qty 2 each.
const FOAM_CATEGORY_DEFAULTS = [
  { key: "LxH",  qty: 2 },
  { key: "LxH1", qty: 2 },
  { key: "WxH",  qty: 2 },
  { key: "WxH1", qty: 2 },
  { key: "LxW",  qty: 2 },
];
function makeFoamConfig(typeName) {
  const t = foamType(typeName);
  return {
    id: uid("fl"),
    type: typeName,
    sheetW: t.sheetW, sheetL: t.sheetL,
    thickness: t.thickness, rate: t.rate,
    margin: "", adhesive: t.adhesive,
    cutMargin: Math.max(20, typeof SETTINGS !== "undefined" ? toNumberSafe(SETTINGS.foamCutMargin, t.cutMargin) : t.cutMargin),
    panels: FOAM_CATEGORY_DEFAULTS.map(c => ({ ...c })),
  };
}

function makeCustomFoamAddon(typeName, overrides) {
  const t = foamType(typeName || "EPE foam");
  const o = overrides || {};
  return {
    id: uid("cfa"),
    name: o.name || "Custom foam piece",
    type: typeName || t.name,
    length: o.length == null ? "" : o.length,
    width: o.width == null ? "" : o.width,
    thickness: o.thickness == null ? t.thickness : o.thickness,
    qty: o.qty == null ? 1 : o.qty,
    rate: o.rate == null ? t.rate : o.rate,
    margin: o.margin == null ? "" : o.margin,
    adhesive: o.adhesive == null ? 0 : o.adhesive,
  };
}
function normalizeCustomFoamAddon(row) {
  const t = foamType((row && row.type) || "EPE foam");
  return {
    id: (row && row.id) || uid("cfa"),
    name: (row && row.name) || "Custom foam piece",
    type: (row && row.type) || t.name,
    length: row && row.length != null ? row.length : "",
    width: row && row.width != null ? row.width : "",
    thickness: row && row.thickness != null ? row.thickness : t.thickness,
    qty: row && row.qty != null ? row.qty : 1,
    rate: row && row.rate != null ? row.rate : t.rate,
    margin: row && row.margin != null ? row.margin : "",
    adhesive: row && row.adhesive != null ? row.adhesive : 0,
  };
}

// Custom panel add-ons mirror Custom Foam Add-ons exactly — extra panel pieces
// at arbitrary sizes priced per sqft (area × rate × qty + margin/overlay added per sqft).
function makeCustomPanelAddon(materialName, overrides) {
  const m = (typeof panelMaterial === "function") ? panelMaterial(materialName || "ACP") : { name: materialName || "ACP", thickness: 4, baseRate: 38 };
  const o = overrides || {};
  return {
    id: uid("cpa"),
    name: o.name || "Custom panel piece",
    material: materialName || m.name,
    length: o.length == null ? "" : o.length,
    width: o.width == null ? "" : o.width,
    thickness: o.thickness == null ? m.thickness : o.thickness,
    qty: o.qty == null ? 1 : o.qty,
    rate: o.rate == null ? m.baseRate : o.rate,    // ₹/sqft
    margin: o.margin == null ? "" : o.margin,       // ₹/sqft, optional
    overlay: o.overlay == null ? "" : o.overlay,    // ₹/sqft, optional
  };
}
function normalizeCustomPanelAddon(row) {
  const m = (typeof panelMaterial === "function") ? panelMaterial((row && row.material) || "ACP") : { name: "ACP", thickness: 4, baseRate: 38 };
  return {
    id: (row && row.id) || uid("cpa"),
    name: (row && row.name) || "Custom panel piece",
    material: (row && row.material) || m.name,
    length: row && row.length != null ? row.length : "",
    width: row && row.width != null ? row.width : "",
    thickness: row && row.thickness != null ? row.thickness : m.thickness,
    qty: row && row.qty != null ? row.qty : 1,
    rate: row && row.rate != null ? row.rate : m.baseRate,
    margin: row && row.margin != null ? row.margin : "",
    overlay: row && row.overlay != null ? row.overlay : "",
  };
}

// Profiles. Three independent profile types, each priced per running foot
// (ft rounded UP for MF & R). finalRate = baseRate + optional margin (blank = 0).
//
// MF Profile Set = one combined male + female set (no separate rows).
const MF_PROFILE_SETS = [
  { name: "Silver MF Profile Set 2mm", male: 5.25, female: 5.00,  weightKgPerFt: 0 },
  { name: "Black MF Profile Set 2mm",  male: 5.25, female: 5.00,  weightKgPerFt: 0 },
  { name: "Silver MF Profile Set 4mm", male: 10.00, female: 13.00, weightKgPerFt: 0 },
  { name: "Black MF Profile Set 4mm",  male: 10.00, female: 13.00, weightKgPerFt: 0 },
  { name: "MF Profile Set 9mm",        male: 28.00, female: 28.00, weightKgPerFt: 0 },
  { name: "MF Profile Set 9mm New",    male: 28.00, female: "",    weightKgPerFt: 0 },   // female editable/blank
];
function mfSet(name) { return SETTINGS.mfSets.find(m => m.name === name) || SETTINGS.mfSets[0]; }

const R_PROFILE_OPTIONS = [
  { name: "R Profile Silver 2mm", rate: 17, weightKgPerFt: 0 },
  { name: "R Profile Black 2mm",  rate: 17, weightKgPerFt: 0 },
];
function rOption(name) { return SETTINGS.rOptions.find(o => o.name === name) || SETTINGS.rOptions[0]; }

const DOUBLE_ANGLE_OPTIONS = [
  { name: "Double Angle Profile Silver 4mm", rate: 23, weightKgPerFt: 0 },
  { name: "Double Angle Profile Black 4mm",  rate: 23, weightKgPerFt: 0 },
  { name: "Double Angle Profile 9mm",        rate: 54, weightKgPerFt: 0 },
];
function daOption(name) { return SETTINGS.daOptions.find(o => o.name === name) || SETTINGS.daOptions[0]; }

// Edge Profile combines the earlier R Profile and Double Angle Profile choices.
// mode "auto" = length is calculated from L/W/H/H1 edge quantities.
// mode "manual" = user enters length in ft, like the earlier Double Angle Profile.
const EDGE_PROFILE_OPTIONS = [
  { name: "R Profile Silver 2mm", rate: 17, mode: "auto",   weightKgPerFt: 0 },
  { name: "R Profile Black 2mm",  rate: 17, mode: "auto",   weightKgPerFt: 0 },
  { name: "Double Angle Profile Silver 4mm", rate: 23, mode: "manual", weightKgPerFt: 0 },
  { name: "Double Angle Profile Black 4mm",  rate: 23, mode: "manual", weightKgPerFt: 0 },
  { name: "Double Angle Profile 9mm",        rate: 54, mode: "manual", weightKgPerFt: 0 },
];
function edgeOption(name) {
  const list = (SETTINGS && Array.isArray(SETTINGS.edgeOptions)) ? SETTINGS.edgeOptions : EDGE_PROFILE_OPTIONS;
  return list.find(o => o.name === name) || list[0] || EDGE_PROFILE_OPTIONS[0];
}
function combinedEdgeOptionsFrom(settings) {
  const rList = Array.isArray(settings && settings.rOptions) ? settings.rOptions : R_PROFILE_OPTIONS;
  const daList = Array.isArray(settings && settings.daOptions) ? settings.daOptions : DOUBLE_ANGLE_OPTIONS;
  return [
    ...rList.map(o => ({ ...o, mode: o.mode || "auto" })),
    ...daList.map(o => ({ ...o, mode: o.mode || "manual" })),
  ];
}

const PROFILE_DEFAULTS = {
  mf: { set: "Silver MF Profile Set 2mm", male: 5.25, female: 5.00, qL: 4, qW: 4, margin: "" },
  edge: { option: "R Profile Silver 2mm", rate: 17, mode: "auto", qL: 4, qW: 4, qH: 4, qH1: 4, lengthFt: 0, margin: "" },
  // Kept only so older saved quotations still open without breaking. New quotations use edge.
  r:  { option: "R Profile Silver 2mm", rate: 17, qL: 2, qW: 2, qH: 4, qH1: 4, margin: "" },
  da: { enabled: false, option: "Double Angle Profile Silver 4mm", rate: 23, lengthFt: 0, margin: "" },
};

// Add-ons removed for now. Kept as an empty preset list so old code/data stays safe.
const ADDON_PRESETS = [];

// Shipping options. Local uses the packaging formula; International keeps the previous multiplier.
const SHIPPING_TYPES = [
  { key: "none",  label: "None" },
  { key: "local", label: "Local" },
  { key: "intl",  label: "International" },
];

// Profile extras are profile-related ft-rate items entered by required millimetres.
// The form converts required mm → ft automatically and costs by ₹/ft.
const PROFILE_EXTRA_PRESETS = [
  { name: "L Patti 20mm", unit: "mm", basePrice: 29, weightKgPerFt: 0 },
  { name: "L Patti 12mm", unit: "mm", basePrice: 9 , weightKgPerFt: 0 },
  { name: "C Channel",    unit: "mm", basePrice: 7 , weightKgPerFt: 0 },
  { name: "Tube 12x12",   unit: "mm", basePrice: 19, weightKgPerFt: 0 },
];
function isProfileExtraName(name) { return /^(L Patti|C Channel|Tube)/i.test(String(name || "").trim()); }
function profileExtraPreset(name) {
  const list = (SETTINGS && Array.isArray(SETTINGS.profileExtras)) ? SETTINGS.profileExtras : PROFILE_EXTRA_PRESETS;
  return list.find(a => a.name === name);
}
function profileExtrasFromSettings(s) {
  const byName = new Map();
  PROFILE_EXTRA_PRESETS.forEach(x => byName.set(x.name, { ...x }));
  if (Array.isArray(s && s.accessories)) {
    s.accessories.filter(a => isProfileExtraName(a.name)).forEach(a => {
      byName.set(a.name, { name: a.name, unit: "mm", basePrice: a.basePrice || 0 });
    });
  }
  if (Array.isArray(s && s.profileExtras)) {
    s.profileExtras.forEach(a => {
      if (a && a.name) byName.set(a.name, { name: a.name, unit: "mm", basePrice: a.basePrice || 0 });
    });
  }
  return Array.from(byName.values());
}
function cleanAccessoriesList(list) {
  return (Array.isArray(list) ? list : []).filter(a => !isProfileExtraName(a && a.name));
}

// Customer-facing quotations should hide internal construction/profile hardware.
// These items are still fully costed in internal calculations; this only controls display.
function isCustomerHiddenAccessoryName(name) {
  const n = String(name || "").trim().toLowerCase();
  if (!n) return false;
  return (
    n.includes("m/f") ||
    n.includes("m-f") ||
    n.includes("mf profile") ||
    n.includes("m profile") ||
    n.includes("f profile") ||
    n.includes("r profile") ||
    n.includes("r pro") ||
    n.includes("r support") ||
    n.includes("plastic connector") ||
    n.includes("double angle") ||
    n.includes("edge profile") ||
    n.includes("l patti") ||
    n.includes("c channel") ||
    n.includes("tube") ||
    n.includes("corner set") ||
    n.includes("regular corner") ||
    n.includes("ball corner") ||
    n.includes("dl profile corner")
  );
}
function customerVisibleAccessoryRows(rows) {
  return (Array.isArray(rows) ? rows : []).filter(a => !isCustomerHiddenAccessoryName(a && a.name));
}

// Accessory & hardware presets. unit is "pc" or "ft".
//   pc-based: total = qty × (base + optional margin)
//   ft-based: total = lengthFt × (base + optional margin)
// Group keywords (for the quote-form split view):
//   Corners: name contains "corner"
//   Locks:   name contains "lock"
//   Hinges:  name contains "hinge"
//   Feet, Wheels & Support: wheel/trolley/castor/foot/rubber bush/support leg/leg
//   Extra / Other Hardware: everything else (handles, rivets, adhesive, brackets, profiles…)
const ACCESSORY_PRESETS = [
  // ── Corners ────────────────────────────────────────────────────────────────
  { name: "Corner set",                      unit: "pc", basePrice: 120 },
  { name: "MF MS corner bracket",            unit: "pc", basePrice: 50  },
  // ── Locks ──────────────────────────────────────────────────────────────────
  { name: "Regular Lock Orion",              unit: "pc", basePrice: 450 },
  // ── Hinges ─────────────────────────────────────────────────────────────────
  { name: "Big Hinges",                      unit: "pc", basePrice: 640 },
  // ── Feet, Wheels & Support ─────────────────────────────────────────────────
  { name: "Rubber Bush",                     unit: "pc", basePrice: 25  },
  { name: "Rubber Foot",                     unit: "pc", basePrice: 40  },
  { name: "Support Leg",                     unit: "pc", basePrice: 120 },
  { name: "Castor Wheel",                    unit: "pc", basePrice: 400 },
  { name: "Castor Wheel with Brake",         unit: "pc", basePrice: 550 },
  { name: "Trolley",                         unit: "pc", basePrice: 2200 },
  { name: "Wheels",                          unit: "pc", basePrice: 350 },
  // ── Extra / Other Hardware ─────────────────────────────────────────────────
  { name: "Black Silver Handle",             unit: "pc", basePrice: 1200 },
  { name: "Rivets",                          unit: "pc", basePrice: 200 },
  { name: "Adhesive",                        unit: "pc", basePrice: 250 },
  { name: "Plastic connector for R profile", unit: "pc", basePrice: 32 },
  { name: "R Pro support clip",              unit: "pc", basePrice: 56  },
  { name: "M Profile Black - 720mm - 4mm",   unit: "pc", basePrice: 13 },
  { name: "F Profile Black - 720mm - 4mm",   unit: "pc", basePrice: 13 },
  { name: "Square Tube Black 12x12 1370mm",  unit: "pc", basePrice: 19 },
  { name: "Square Tube Black 12x12 1300mm",  unit: "pc", basePrice: 19 },
  { name: "Square Tube Black 12x12 702mm",   unit: "pc", basePrice: 19 },
];
function accessoryPreset(name) { return SETTINGS.accessories.find(a => a.name === name); }

const GST_RATE = 0.18;

const DEFAULT_TERMS = [
  "Prices are quoted in INR and are exclusive of transportation & installation unless specified.",
  "GST @ 18% is applicable as shown above.",
  "This quotation is valid for 15 days from the date of issue.",
  "Delivery: 7–10 working days from confirmation of order and receipt of advance.",
  "Payment terms: 50% advance along with purchase order, balance before dispatch.",
  "Custom dimensions and foam cut-outs are made to order and are non-returnable.",
];

const COMPANY = {
  name: "Orion Flexipack",
  tagline: "AN ISO 9001 : 2015 CERTIFIED",
  address: "Plot 14, MIDC Industrial Area, Pune – 411026, Maharashtra, India",
  gstin: "27ABCDE1234F1Z5",
  phone: "+91 98220 00000",
  email: "sales@orionflexipack.com",
};

const DEFAULT_PAYMENT_TERMS = "50% advance along with purchase order; balance before dispatch.";

const PRODUCT_CASE_NAMES = [
  "Aluminum Flight Case, Empty, Branding",
  "Aluminum Flight Case, Empty",
  "Aluminum Flight Case - With Foam Insert",
  "Aluminum Flight Case, Foam Insert and Branding",
  "Heavy Duty Flight Case",
];

/* ============================================================
   Admin Settings — editable defaults, persisted locally + cloud.
   Catalogs here drive the form dropdowns & default rates; rates
   are optional defaults that can still be overridden per quote.
   ============================================================ */
const SETTINGS_KEY = "orion_settings_v1";
const SETTINGS_UPDATED_EVENT = "orion-settings-updated";
window.ORION_BACKEND_API = window.ORION_BACKEND_API || "https://orionquotes.netlify.app/.netlify/functions";

function factorySettings() {
  return {
    company: { ...COMPANY },
    gstPercent: 18,
    cutMargin: 20,        // default panel cutting margin (mm)
    foamCutMargin: 20,    // default foam cutting margin (mm)
    acpSheetW: 1220,
    acpSheetL: 2420,
    validityDays: 15,
    paymentTerms: DEFAULT_PAYMENT_TERMS,
    terms: DEFAULT_TERMS.slice(),
    panelMaterials: PANEL_MATERIALS.map(m => ({ ...m })),
    foamTypes: FOAM_TYPES.map(f => ({ ...f })),
    mfSets: MF_PROFILE_SETS.map(s => ({ ...s })),
    rOptions: R_PROFILE_OPTIONS.map(o => ({ ...o })),
    daOptions: DOUBLE_ANGLE_OPTIONS.map(o => ({ ...o })),
    edgeOptions: EDGE_PROFILE_OPTIONS.map(o => ({ ...o })),
    profileExtras: PROFILE_EXTRA_PRESETS.map(a => ({ ...a })),
    accessories: ACCESSORY_PRESETS.map(a => ({ ...a })),
    // Weight line-items (kg) added to every quotation. Editable in Settings.
    weights: [],
  };
}

let SETTINGS = factorySettings();

function mergeSettings(input) {
  const base = factorySettings();
  const s = input && typeof input === "object" ? input : {};

  // Backfill weight-related fields onto any saved catalogs missing them, using factory defaults by name.
  const factoryByName = (list) => { const m = {}; list.forEach(x => { if (x && x.name) m[x.name] = x; }); return m; };
  const fillField = (rows, factoryList, field) => {
    if (!Array.isArray(rows)) return rows;
    const fac = factoryByName(factoryList);
    return rows.map(r => {
      if (!r || typeof r !== "object") return r;
      if (r[field] != null && r[field] !== "") return r;
      const f = fac[r.name];
      return { ...r, [field]: (f && f[field] != null) ? f[field] : 0 };
    });
  };

  const merged = {
    ...base,
    ...s,
    company: { ...base.company, ...(s.company || {}) },
    terms: Array.isArray(s.terms) ? s.terms : base.terms,
    panelMaterials: fillField(Array.isArray(s.panelMaterials) ? s.panelMaterials : base.panelMaterials, base.panelMaterials, "densityKgPerM3"),
    foamTypes:      fillField(Array.isArray(s.foamTypes)      ? s.foamTypes      : base.foamTypes,      base.foamTypes,      "densityKgPerM3"),
    mfSets:         fillField(Array.isArray(s.mfSets)         ? s.mfSets         : base.mfSets,         base.mfSets,         "weightKgPerFt"),
    rOptions:       fillField(Array.isArray(s.rOptions)       ? s.rOptions       : base.rOptions,       base.rOptions,       "weightKgPerFt"),
    daOptions:      fillField(Array.isArray(s.daOptions)      ? s.daOptions      : base.daOptions,      base.daOptions,      "weightKgPerFt"),
    edgeOptions:    fillField(Array.isArray(s.edgeOptions)    ? s.edgeOptions    : combinedEdgeOptionsFrom(s), base.edgeOptions, "weightKgPerFt"),
    profileExtras:  fillField(profileExtrasFromSettings(s),   base.profileExtras, "weightKgPerFt"),
    accessories:    cleanAccessoriesList(Array.isArray(s.accessories) ? s.accessories : base.accessories),
    weights:        Array.isArray(s.weights) ? s.weights : base.weights,
  };
  return merged;
}

function emitSettingsUpdated() {
  try { window.dispatchEvent(new CustomEvent(SETTINGS_UPDATED_EVENT, { detail: SETTINGS })); } catch (e) { /* ignore */ }
}

function storeSettingsLocal(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) SETTINGS = mergeSettings(JSON.parse(raw));
  } catch (e) { /* ignore */ }
  return SETTINGS;
}

function persistSettings(s, opts) {
  SETTINGS = mergeSettings(s);
  storeSettingsLocal(SETTINGS);
  if (!opts || !opts.silent) emitSettingsUpdated();
  return SETTINGS;
}

function resetSettings(opts) {
  SETTINGS = factorySettings();
  try { localStorage.removeItem(SETTINGS_KEY); } catch (e) { /* ignore */ }
  if (!opts || !opts.silent) emitSettingsUpdated();
  return SETTINGS;
}

async function loadSettingsFromCloud() {
  const res = await fetch(window.ORION_BACKEND_API + "/load-settings", {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load settings from cloud");
  if (data.settings) persistSettings(data.settings);
  return SETTINGS;
}

async function saveSettingsToCloud(settings) {
  const finalSettings = persistSettings(settings, { silent: true });
  const res = await fetch(window.ORION_BACKEND_API + "/save-settings", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ settings: finalSettings }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save settings to cloud");
  emitSettingsUpdated();
  return data;
}

function gstRate() { return toNumberSafe(SETTINGS.gstPercent, 18) / 100; }
function toNumberSafe(v, f) { if (v === "" || v == null) return f; const n = Number(v); return Number.isFinite(n) ? n : f; }

loadSettings();

let _uid = 0;
function uid(prefix) { _uid += 1; return (prefix || "id") + "-" + Date.now().toString(36) + "-" + _uid; }

// Backfill any missing fields so quotes saved under an older structure still work.
function normalizeQuote(q) {
  const base = makeBlankQuote(1);
  const out = { ...base, ...q };
  out.acp = { ...base.acp, ...(q.acp || {}) };
  if (!out.acp.panels) out.acp.panels = base.acp.panels;
  if (out.acp.overlay == null) out.acp.overlay = 0;
  if (out.acp.cutMargin == null) out.acp.cutMargin = 20;
  if (!out.acp.material) out.acp.material = "ACP";
  if (out.acp.sheetW == null) out.acp.sheetW = ACP_SHEET.w;
  if (out.acp.sheetL == null) out.acp.sheetL = ACP_SHEET.h;
  if (!out.acp.absLayer) out.acp.absLayer = { sheetW: 1220, sheetL: 2440, thickness: 2, baseRate: 55, margin: "" };
  const srcProfiles = (!q.profiles || Array.isArray(q.profiles)) ? {} : q.profiles;
  const oldR = srcProfiles.r || {};
  const oldDa = srcProfiles.da || {};
  const oldEdge = srcProfiles.edge;
  const derivedEdge = oldEdge ? oldEdge : (oldDa.enabled ? {
    option: oldDa.option || PROFILE_DEFAULTS.da.option,
    rate: oldDa.rate || PROFILE_DEFAULTS.da.rate,
    mode: "manual",
    lengthFt: oldDa.lengthFt || 0,
    margin: oldDa.margin || "",
  } : {
    option: oldR.option || PROFILE_DEFAULTS.r.option,
    rate: oldR.rate || PROFILE_DEFAULTS.r.rate,
    mode: "auto",
    qL: oldR.qL == null ? PROFILE_DEFAULTS.edge.qL : oldR.qL,
    qW: oldR.qW == null ? PROFILE_DEFAULTS.edge.qW : oldR.qW,
    qH: oldR.qH == null ? PROFILE_DEFAULTS.edge.qH : oldR.qH,
    qH1: oldR.qH1 == null ? PROFILE_DEFAULTS.edge.qH1 : oldR.qH1,
    margin: oldR.margin || "",
  });
  out.profiles = {
    mf: { ...PROFILE_DEFAULTS.mf, ...(srcProfiles.mf || {}) },
    edge: { ...PROFILE_DEFAULTS.edge, ...derivedEdge },
    r:  { ...PROFILE_DEFAULTS.r,  ...oldR },
    da: { ...PROFILE_DEFAULTS.da, ...oldDa },
  };
  out.addons = [];
  const migratedProfileExtras = Array.isArray(q.accessories) ? q.accessories
    .filter(a => isProfileExtraName(a && a.name))
    .map(a => ({ id: a.id || uid("px"), name: a.name, unit: "mm", requiredMm: toNumberSafe(a.qty, 0) * 304.8, basePrice: a.basePrice || 0, margin: a.margin || "" })) : [];
  out.profileExtras = Array.isArray(q.profileExtras) ? q.profileExtras.map(x => ({ unit: "mm", ...x })) : (migratedProfileExtras.length ? migratedProfileExtras : base.profileExtras);
  if (out.quantity == null) out.quantity = 1;
  if (!out.shipping) out.shipping = "none";
  if (out.shippingCost == null) out.shippingCost = "";
  if (out.finalMarginPercent == null) out.finalMarginPercent = 20;
  out.customerDisplay = {
    showFoamLayers: false,
    foamLayerName: "Custom foam insert",
    foamLayerLines: "Custom foam insert",
    ...(q.customerDisplay || {}),
  };
  // Foam: an array of layers, each a full 5-category config (same logic for all)
  function toFoamLayer(src) {
    const layer = { ...makeFoamConfig((src && src.type) || "EPE foam"), ...(src || {}) };
    layer.id = (src && src.id) || uid("fl");
    if (!Array.isArray(layer.panels)) layer.panels = FOAM_CATEGORY_DEFAULTS.map(c => ({ ...c }));
    return layer;
  }
  if (Array.isArray(out.foam) && out.foam.length && out.foam[0] && out.foam[0].panels) {
    // already new-shape list of category configs
    out.foam = out.foam.map(toFoamLayer);
  } else if (out.foam && !Array.isArray(out.foam) && out.foam.panels) {
    // single new-shape config → wrap in list, append any old extraFoam as layers
    out.foam = [toFoamLayer(out.foam)];
  } else {
    // legacy: foam was an array of custom inserts (or missing)
    const oldArr = Array.isArray(q.foam) ? q.foam : [];
    const base = toFoamLayer({ type: (oldArr[0] && oldArr[0].type) || "EPE foam" });
    out.foam = [base];
  }
  delete out.extraFoam;
  const oldCustomFoam = Array.isArray(q.customFoamAddons) ? q.customFoamAddons : (Array.isArray(q.foamCustomAddons) ? q.foamCustomAddons : []);
  out.customFoamAddons = oldCustomFoam.map(normalizeCustomFoamAddon);
  const oldCustomPanel = Array.isArray(q.customPanelAddons) ? q.customPanelAddons : [];
  out.customPanelAddons = oldCustomPanel.map(normalizeCustomPanelAddon);
  if (!Array.isArray(out.accessories)) out.accessories = base.accessories;
  else out.accessories = out.accessories
    .filter(a => !isProfileExtraName(a && a.name))
    .map(a => ({ unit: "pc", ...a, unit: a.unit || (accessoryPreset(a.name) ? accessoryPreset(a.name).unit : "pc") }));
  if (out.validityDays == null) out.validityDays = toNumberSafe(SETTINGS.validityDays, 15);
  if (!out.paymentTerms) out.paymentTerms = SETTINGS.paymentTerms || DEFAULT_PAYMENT_TERMS;
  if (out.docType !== "invoice") out.docType = "quotation";
  out.delivery = { ...blankDelivery(), ...(q.delivery || {}) };
  return out;
}

// ----- factory: a fresh blank quotation (seeded from SETTINGS) -----
function makeBlankQuote(seq) {
  const acpMat = panelMaterial("ACP");
  const quoteNo = "ORION-" + String(seq || 1).padStart(4, "0");
  return {
    id: uid("q"),
    quoteNo,
    status: "draft",
    date: new Date().toISOString().slice(0, 10),
    customer: { name: "", company: "", address: "", gstin: "", phone: "", email: "" },
    product: { name: PRODUCT_CASE_NAMES[2], ref: "" },
    caseDims: { length: 600, width: 400, height: 350, lidHeight: 120 },
    acp: {
      material: "ACP",
      sheetW: acpMat.sheetW,
      sheetL: acpMat.sheetL,
      thickness: acpMat.thickness,
      baseRate: acpMat.baseRate,   // ₹ per sqft (optional default — user can override)
      margin: "",     // optional, blank = 0
      overlay: "",    // optional overlay/lamination rate, blank = 0
      cutMargin: toNumberSafe(SETTINGS.cutMargin, 20),
      // Linked layer auto-applied only when material === "MDF":
      absLayer: (function () { const m = panelMaterial("ABS Silver"); return { sheetW: m.sheetW, sheetL: m.sheetL, thickness: m.thickness, baseRate: m.baseRate, margin: "" }; })(),
      panels: PANEL_CATEGORIES.map(p => ({ key: p.key, qty: p.qty })),
    },
    foam: [makeFoamConfig("EPE foam")],
    customFoamAddons: [],
    customPanelAddons: [],
    customerDisplay: { showFoamLayers: false, foamLayerName: "Custom foam insert", foamLayerLines: "Custom foam insert" },
    profiles: {
      mf: { ...PROFILE_DEFAULTS.mf, ...mfSeed() },
      edge: { ...PROFILE_DEFAULTS.edge, ...edgeSeed() },
      r:  { ...PROFILE_DEFAULTS.r, ...rSeed() },
      da: { ...PROFILE_DEFAULTS.da, ...daSeed() },
    },
    profileExtras: PROFILE_EXTRA_PRESETS.map(p => seedProfileExtra(p.name, 0)),
    accessories: [
      seedAcc("Corner set", 8),
      seedAcc("Regular Lock Orion", 2),
      seedAcc("Black Silver Handle", 2),
      seedAcc("Big Hinges", 2),
    ],
    addons: [],
    labour: { cost: 1500, margin: "" },
    quantity: 1,
    shipping: "none",
    shippingCost: "",
    finalMarginPercent: 20,
    validityDays: toNumberSafe(SETTINGS.validityDays, 15),
    paymentTerms: SETTINGS.paymentTerms || DEFAULT_PAYMENT_TERMS,
    terms: (SETTINGS.terms && SETTINGS.terms.length ? SETTINGS.terms.slice() : DEFAULT_TERMS.slice()),
    docType: "quotation",   // "quotation" | "invoice"
    delivery: blankDelivery(),
  };
}

// Delivery / Google Workspace record — populated when a quote is finalized.
function blankDelivery() {
  return {
    externalPdfName: "",
    internalPdfName: "",
    externalDriveLink: "",
    internalDriveLink: "",
    driveSavedAt: "",      // ISO timestamp of last Drive save
    emailSent: false,
    sentAt: "",            // ISO timestamp the customer copy was emailed
    emailTo: "",
  };
}

function seedFoam(typeName, length, width) {
  const t = foamType(typeName);
  return { id: uid("f"), type: typeName, length, width, thickness: t.thickness, qty: 1, sheetW: t.sheetW, sheetL: t.sheetL, rate: t.rate, margin: "", adhesive: t.adhesive, cutMargin: toNumberSafe(SETTINGS.foamCutMargin, t.cutMargin) };
}
function seedProfileExtra(name, requiredMm) {
  const p = profileExtraPreset(name) || { unit: "mm", basePrice: 0 };
  return { id: uid("px"), name, unit: "mm", requiredMm, basePrice: p.basePrice, margin: "" };
}
function seedAcc(name, qty) {
  const p = accessoryPreset(name) || { unit: "pc", basePrice: 0 };
  return { id: uid("a"), name, unit: p.unit, qty, basePrice: p.basePrice, margin: "" };
}
function mfSeed() { const s = SETTINGS.mfSets[0]; return { set: s.name, male: s.male, female: s.female }; }
function edgeSeed() { const o = edgeOption("R Profile Silver 2mm"); return { option: o.name, rate: o.rate, mode: o.mode || "auto" }; }
function rSeed() { const o = SETTINGS.rOptions[0]; return { option: o.name, rate: o.rate }; }
function daSeed() { const o = SETTINGS.daOptions[0]; return { option: o.name, rate: o.rate }; }
