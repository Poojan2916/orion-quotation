/* ============================================================
   Calculation engine — sheet-cutting (yield) based pricing
   ============================================================ */

const SQMM_PER_SQFT = 92903.04;
const MM_PER_FT = 304.8;

// Canonical numeric coercion — blank / null / undefined / non-finite => fallback (0).
// Used for EVERY numeric input so optional margin boxes left blank are treated as 0.
function toNumber(value, fallback = 0) {
  if (value === "" || value === null || value === undefined) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
// num() is the in-engine alias used across all costing functions.
function num(v) { return toNumber(v, 0); }

function inr(v, dp) {
  const d = dp == null ? 2 : dp;
  return num(v).toLocaleString("en-IN", { minimumFractionDigits: d, maximumFractionDigits: d });
}
function inrShort(v) {
  return num(v).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

// ---- Grid nesting: how many (pl x pw) pieces fit in (sl x sw) sheet,
//      laying out by rows x cols, allowing 90° rotation. Returns max yield.
function piecesPerSheet(pl, pw, sl, sw) {
  pl = num(pl); pw = num(pw); sl = num(sl); sw = num(sw);
  if (pl <= 0 || pw <= 0 || sl <= 0 || sw <= 0) return 0;
  const a = Math.floor(sl / pl) * Math.floor(sw / pw); // piece as-is
  const b = Math.floor(sl / pw) * Math.floor(sw / pl); // piece rotated 90°
  return Math.max(a, b);
}

// ---- Panel material (sheet-cutting, Excel logic) ----
// One reusable layer function for ACP / MDF / Plywood / ABS Silver.
// Sheet dims, thickness, rates and cut margin are supplied per material.
function calcPanelLayer(cfg, panels, caseDims, cut) {
  const sw = num(cfg.sheetW) || ACP_SHEET.w;
  const sl = num(cfg.sheetL) || ACP_SHEET.h;
  const sheetSqftExact = (sw * sl) / SQMM_PER_SQFT;
  const sheetSqft = Math.round(sheetSqftExact);
  const finalRate = num(cfg.baseRate) + num(cfg.margin) + num(cfg.overlay);
  const sheetCost = sheetSqft * finalRate;

  const rows = panels.map(p => {
    const cat = PANEL_CATEGORIES.find(c => c.key === p.key) || {};
    const a = num(caseDims[cat.dimA]);
    const b = num(caseDims[cat.dimB]);
    const qty = num(p.qty);
    const cutA = a + cut;
    const cutB = b + cut;
    const fit = piecesPerSheet(cutA, cutB, sl, sw);
    const costPerPiece = fit > 0 ? sheetCost / fit : sheetCost;
    const costRaw = costPerPiece * qty;          // unrounded category cost
    const cost = Math.round(costRaw);            // rounded for display
    const sheetsUsed = fit > 0 ? qty / fit : qty;
    return { key: p.key, label: cat.label, a, b, cutA, cutB, qty, fit, costPerPiece, costRaw, cost, sheetsUsed };
  });
  // Total = sum of UNROUNDED category costs, rounded once (matches Excel master sheet).
  const cost = Math.round(rows.reduce((s, r) => s + r.costRaw, 0));
  const totalSheets = rows.reduce((s, r) => s + r.sheetsUsed, 0);
  return { material: cfg.material, thickness: cfg.thickness, sheetW: sw, sheetL: sl, sheetSqftExact, sheetSqft, finalRate, sheetCost, rows, cost, totalSheets };
}

// Main panel + (for MDF only) an auto-linked ABS Silver layer.
// Both layers share L/W/H/H1, panel categories, quantities and cutting margin.
function calcAcp(quote) {
  const a = quote.acp;
  const cut = a.cutMargin == null ? 20 : num(a.cutMargin);
  const main = calcPanelLayer(
    { material: a.material || "ACP", sheetW: a.sheetW, sheetL: a.sheetL, baseRate: a.baseRate, margin: a.margin, overlay: a.overlay, thickness: a.thickness },
    a.panels, quote.caseDims, cut
  );
  let abs = null;
  if (a.material === "MDF") {
    const al = a.absLayer || {};
    abs = calcPanelLayer(
      { material: "ABS Silver", sheetW: al.sheetW, sheetL: al.sheetL, baseRate: al.baseRate, margin: al.margin, overlay: 0, thickness: al.thickness },
      a.panels, quote.caseDims, cut
    );
  }
  const cost = main.cost + (abs ? abs.cost : 0);
  const totalSheets = main.totalSheets + (abs ? abs.totalSheets : 0);
  // Spread main for backward-compatible fields; cost/totalSheets are the COMBINED totals.
  return { ...main, cut, main, abs, cost, totalSheets };
}

// ---- Foam: a list of layers, EACH using the same 5-category sheet-cut logic ----
// Per layer: sheetCost = (W/1000)·(L/1000)·thk·rate + margin + adhesive
//   category: cutA=a+cut, cutB=b+cut ; pcs/sheet (90° rotation) ;
//   categoryCost = round(sheetCost/pcs × qty) ; layer cost = round(Σ unrounded)
function foamSheetCost(cfg) {
  const sw = num(cfg.sheetW) || 1000;
  const sl = num(cfg.sheetL) || 2000;
  return (sw / 1000) * (sl / 1000) * num(cfg.thickness) * num(cfg.rate) + num(cfg.margin) + num(cfg.adhesive);
}
function calcFoamLayer(layer, d) {
  const sw = num(layer.sheetW) || 1000;
  const sl = num(layer.sheetL) || 2000;
  const cut = layer.cutMargin == null ? 15 : num(layer.cutMargin);
  const sheetCost = foamSheetCost(layer);
  const rows = (layer.panels || []).map(p => {
    const cat = PANEL_CATEGORIES.find(c => c.key === p.key) || {};
    const a = num(d[cat.dimA]);
    const b = num(d[cat.dimB]);
    const qty = num(p.qty);
    const cutA = a + cut;
    const cutB = b + cut;
    const fit = piecesPerSheet(cutA, cutB, sl, sw);
    const costPerPiece = fit > 0 ? sheetCost / fit : sheetCost;
    const costRaw = costPerPiece * qty;
    return { key: p.key, label: cat.label, a, b, cutA, cutB, qty, fit, costPerPiece, costRaw, cost: Math.round(costRaw) };
  });
  const cost = Math.round(rows.reduce((s, r) => s + r.costRaw, 0));
  return { id: layer.id, type: layer.type, thk: num(layer.thickness), sheetW: sw, sheetL: sl, cut, sheetCost, rows, cost };
}
function calcFoam(quote) {
  const d = quote.caseDims;
  const list = Array.isArray(quote.foam) ? quote.foam : [];
  const layers = list.map(l => calcFoamLayer(l, d));
  const cost = layers.reduce((s, l) => s + l.cost, 0);
  return { layers, cost };
}

function calcCustomFoamAddons(quote) {
  const rows = (Array.isArray(quote.customFoamAddons) ? quote.customFoamAddons : []).map(row => {
    const length = num(row.length);
    const width = num(row.width);
    const thickness = num(row.thickness);
    const qty = num(row.qty);
    const rate = num(row.rate);
    const margin = num(row.margin);
    const adhesive = num(row.adhesive);
    // Custom foam size cost: (L/1000) × (W/1000) × thickness(mm) × rate + margin + adhesive, then × qty.
    const pieceCost = (length / 1000) * (width / 1000) * thickness * rate + margin + adhesive;
    const total = pieceCost * qty;
    return { ...row, length, width, thickness, qty, rate, margin, adhesive, pieceCost, total };
  });
  const cost = rows.reduce((s, r) => s + r.total, 0);
  return { rows, cost };
}

// Custom panel add-ons — arbitrary panel pieces priced per sqft.
// piece cost = (L/1000) × (W/1000) m²-equivalent × (rate + margin + overlay) ₹/sqft × qty
// (uses the same sqft-via-sqmm conversion as the main panel layer for consistency)
function calcCustomPanelAddons(quote) {
  const rows = (Array.isArray(quote.customPanelAddons) ? quote.customPanelAddons : []).map(row => {
    const length = num(row.length);
    const width = num(row.width);
    const thickness = num(row.thickness);
    const qty = num(row.qty);
    const rate = num(row.rate);
    const margin = num(row.margin);
    const overlay = num(row.overlay);
    const sqft = (length * width) / SQMM_PER_SQFT;
    const finalRate = rate + margin + overlay;
    const pieceCost = sqft * finalRate;
    const total = pieceCost * qty;
    return { ...row, length, width, thickness, qty, rate, margin, overlay, sqft, finalRate, pieceCost, total };
  });
  const cost = rows.reduce((s, r) => s + r.total, 0);
  return { rows, cost };
}

// ---- Profiles: MF Profile Set + Edge Profile ----
// MF set: totalMm = L*qL + W*qW ; ft = ceil(mm/25.4/12) ; cost = ft*(male+female+margin)
// Edge profile: R-style options use auto L/W/H/H1 length; Double Angle options use manual ft length.
const MM_PER_FT_EXACT = 25.4 * 12;
function calcProfiles(quote) {
  const d = quote.caseDims;
  const p = quote.profiles || {};
  const mf = p.mf || {};

  const mfMm = num(d.length) * num(mf.qL) + num(d.width) * num(mf.qW);
  const mfFtExact = mfMm / MM_PER_FT_EXACT;
  const mfFt = Math.ceil(mfFtExact);
  const mfCombined = num(mf.male) + num(mf.female);
  const mfCost = mfFt * (mfCombined + num(mf.margin));

  // Backward compatible edge source. New quotes use profiles.edge.
  let edge = p.edge || null;
  if (!edge) {
    if (p.da && p.da.enabled) edge = { option: p.da.option, rate: p.da.rate, mode: "manual", lengthFt: p.da.lengthFt, margin: p.da.margin };
    else edge = { ...(p.r || {}), mode: "auto" };
  }
  const opt = (typeof edgeOption === "function") ? edgeOption(edge.option) : null;
  const mode = edge.mode || (opt && opt.mode) || (/double angle/i.test(edge.option || "") ? "manual" : "auto");
  const edgeRateBase = edge.rate !== undefined && edge.rate !== "" ? num(edge.rate) : num(opt && opt.rate);
  const edgeRate = edgeRateBase + num(edge.margin);

  let edgeMm = 0;
  let edgeFtExact = 0;
  let edgeFt = 0;
  if (mode === "manual") {
    edgeFt = num(edge.lengthFt);
    edgeFtExact = edgeFt;
    edgeMm = edgeFt * MM_PER_FT_EXACT;
  } else {
    edgeMm = num(d.length) * num(edge.qL) + num(d.width) * num(edge.qW)
           + num(d.height) * num(edge.qH) + num(d.lidHeight) * num(edge.qH1);
    edgeFtExact = edgeMm / MM_PER_FT_EXACT;
    edgeFt = Math.ceil(edgeFtExact);
  }
  const edgeCost = edgeFt * edgeRate;
  const extras = calcProfileExtras(quote);

  const edgeOut = {
    option: edge.option || (opt && opt.name) || "R Profile Silver 2mm",
    mode,
    mm: edgeMm,
    ftExact: edgeFtExact,
    ft: edgeFt,
    rate: edgeRateBase,
    margin: num(edge.margin),
    finalRate: edgeRate,
    cost: edgeCost,
    qL: edge.qL, qW: edge.qW, qH: edge.qH, qH1: edge.qH1,
    lengthFt: edge.lengthFt,
  };

  const rCost = mode === "auto" ? edgeCost : 0;
  const daCost = mode === "manual" ? edgeCost : 0;
  const cost = mfCost + edgeCost + extras.cost;
  return {
    mf: { mm: mfMm, ftExact: mfFtExact, ft: mfFt, combined: mfCombined, male: num(mf.male), female: num(mf.female), margin: num(mf.margin), cost: mfCost, set: mf.set },
    edge: edgeOut,
    // Compatibility objects for older display code and saved quotations.
    r:  mode === "auto" ? edgeOut : { mm: 0, ftExact: 0, ft: 0, rate: 0, margin: 0, finalRate: 0, cost: 0, option: edgeOut.option },
    da: mode === "manual" ? { on: true, ft: edgeFt, rate: edgeRateBase, margin: num(edge.margin), finalRate: edgeRate, cost: edgeCost, option: edgeOut.option } : { on: false, ft: 0, rate: 0, margin: 0, finalRate: 0, cost: 0, option: "" },
    extras, extrasCost: extras.cost, mfCost, edgeCost, rCost, daCost, cost,
  };
}

// ---- Profile extras: L Patti / C Channel / Tube entered in required mm ----
// Each row: requiredMm -> exact ft -> ceil ft; total = ft × (base + margin)
function calcProfileExtras(quote) {
  const rows = (Array.isArray(quote.profileExtras) ? quote.profileExtras : []).map(a => {
    const requiredMm = num(a.requiredMm);
    const ftExact = requiredMm / MM_PER_FT_EXACT;
    const ft = requiredMm > 0 ? Math.ceil(ftExact) : 0;
    const finalUnit = num(a.basePrice) + num(a.margin);
    const total = ft * finalUnit;
    return { ...a, unit: "mm", requiredMm, ftExact, ft, finalUnit, total };
  });
  const cost = rows.reduce((sum, row) => sum + row.total, 0);
  return { rows, cost };
}

// ---- Accessories & hardware: pc or ft based ----
//   total = multiplier × (base + optional margin)   (multiplier = qty for pc, lengthFt for ft)
function calcAccessories(quote) {
  const rows = quote.accessories.map(a => {
    const qty = num(a.qty);
    const unit = a.unit || "pc";
    const finalUnit = num(a.basePrice) + num(a.margin);
    const total = qty * finalUnit;
    const weight = qty * num(a.weightKg);   // per-unit weight (kg) × qty
    return { ...a, unit, qty, finalUnit, total, weight };
  });
  const cost = rows.reduce((s, r) => s + r.total, 0);
  const weight = rows.reduce((s, r) => s + r.weight, 0);
  return { rows, cost, weight };
}

// ---- Add-ons: only enabled ones, qty × price ----
function calcAddons(quote) {
  const rows = (quote.addons || []).map(a => {
    const qty = num(a.qty);
    const total = a.enabled ? qty * num(a.price) : 0;
    return { ...a, qty, total };
  });
  const cost = rows.reduce((s, r) => s + r.total, 0);
  return { rows, cost };
}

// ---- Labour ----
function calcLabour(quote) {
  return num(quote.labour.cost) + num(quote.labour.margin);
}

// ---- Packaging / shipping ----
// Packaging formula: ((((L+130)+(W+130)+100) * ((W+130)+(H+H1+130)+30) / 1,000,000) * 1.08) * 140
// Local uses this packaging value; International keeps the previous multiplier for now.
function calcShipping(quote) {
  const d = quote.caseDims;
  const packaging = ((((num(d.length) + 130) + (num(d.width) + 130) + 100) *
                      ((num(d.width) + 130) + (num(d.height) + num(d.lidHeight) + 130) + 30) / 1000000) * 1.08) * 140;
  const type = quote.shipping || "none";
  let value = 0;
  if (type === "local") value = packaging;
  else if (type === "intl") value = packaging * 500;
  return { type, local: packaging, packaging, intl: packaging * 500, value };
}

// ---- Full quotation ----
function calcQuote(quote) {
  const acp = calcAcp(quote);
  const foam = calcFoam(quote);
  const customFoam = calcCustomFoamAddons(quote);
  const customPanel = calcCustomPanelAddons(quote);
  const profiles = calcProfiles(quote);
  const acc = calcAccessories(quote);
  const addons = calcAddons(quote); // kept for old saved data; no add-ons are shown or costed in new quotes
  const labour = calcLabour(quote);
  const shipping = calcShipping(quote);

  const subtotalPerBox = acp.cost + foam.cost + customFoam.cost + customPanel.cost + profiles.cost + acc.cost + labour;
  const quantity = Math.max(1, num(quote.quantity) || 1);
  const boxesTotal = subtotalPerBox * quantity;
  const beforeFinalMargin = boxesTotal + shipping.value;
  const finalMarginPercent = Math.max(20, Math.min(80, num(quote.finalMarginPercent || 20)));
  const finalMarginValue = beforeFinalMargin * finalMarginPercent / 100;
  const totalBeforeGst = beforeFinalMargin + finalMarginValue;
  const gst = totalBeforeGst * gstRate();
  const grand = totalBeforeGst + gst;

  // ---- Live weight: density × geometry per source, summed.
  // Catalog density lookups by name; missing entries contribute 0 (safe degrade).
  const panelMatByName = (typeof SETTINGS !== "undefined" && Array.isArray(SETTINGS.panelMaterials)) ? SETTINGS.panelMaterials : [];
  const foamMatByName  = (typeof SETTINGS !== "undefined" && Array.isArray(SETTINGS.foamTypes))      ? SETTINGS.foamTypes      : [];
  const lookupDensity = (list, name) => { const r = list.find(x => x && x.name === name); return r ? num(r.densityKgPerM3) : 0; };
  // mm × mm × mm × kg/m³  →  kg :  divide by 1e9 (mm³ → m³)
  const KG_PER_MM3_PER_KGM3 = 1 / 1e9;

  // Panel weight = sum over rows of cutA × cutB × thickness × density × qty.
  // Main material + (for MDF) auto-linked ABS Silver layer share the same cut dims.
  const mainDensity = lookupDensity(panelMatByName, acp.material);
  const mainPanelKg = (acp.rows || []).reduce((s, r) => s + (num(r.cutA) * num(r.cutB) * num(acp.thickness) * mainDensity * num(r.qty)) * KG_PER_MM3_PER_KGM3, 0);
  let absLayerKg = 0;
  if (acp.abs) {
    const absDensity = lookupDensity(panelMatByName, "ABS Silver");
    absLayerKg = (acp.abs.rows || []).reduce((s, r) => s + (num(r.cutA) * num(r.cutB) * num(acp.abs.thickness) * absDensity * num(r.qty)) * KG_PER_MM3_PER_KGM3, 0);
  }
  const panelsWeight = mainPanelKg + absLayerKg;

  // Foam weight = sum over each foam layer × its rows × density.
  const foamWeight = (foam.layers || []).reduce((s, l) => {
    const d = lookupDensity(foamMatByName, l.type);
    const layerKg = (l.rows || []).reduce((s2, r) => s2 + (num(r.cutA) * num(r.cutB) * num(l.thk) * d * num(r.qty)) * KG_PER_MM3_PER_KGM3, 0);
    return s + layerKg;
  }, 0);

  // Custom foam pieces — use given L/W/thickness × density of the chosen foam type.
  const customFoamWeight = (customFoam.rows || []).reduce((s, r) => {
    const d = lookupDensity(foamMatByName, r.type);
    return s + (num(r.length) * num(r.width) * num(r.thickness) * d * num(r.qty)) * KG_PER_MM3_PER_KGM3;
  }, 0);

  // Custom panel pieces — same idea against the panel material density.
  const customPanelWeight = (customPanel.rows || []).reduce((s, r) => {
    const d = lookupDensity(panelMatByName, r.material);
    return s + (num(r.length) * num(r.width) * num(r.thickness) * d * num(r.qty)) * KG_PER_MM3_PER_KGM3;
  }, 0);

  // Profile weight = ft × kg/ft for MF and Edge profiles, plus profile extras.
  const mfWeightPerFt   = (function () { const m = (SETTINGS && SETTINGS.mfSets || []).find(x => x.name === (profiles.mf && profiles.mf.set)); return m ? num(m.weightKgPerFt) : 0; })();
  const edgeWeightPerFt = (function () {
    const list = (SETTINGS && SETTINGS.edgeOptions) || [];
    const e = list.find(x => x.name === (profiles.edge && profiles.edge.option));
    return e ? num(e.weightKgPerFt) : 0;
  })();
  const mfWeight = num(profiles.mf && profiles.mf.ft) * mfWeightPerFt;
  const edgeWeight = num(profiles.edge && profiles.edge.ft) * edgeWeightPerFt;
  const extrasWeight = ((profiles.extras && profiles.extras.rows) || []).reduce((s, r) => {
    const list = (SETTINGS && SETTINGS.profileExtras) || [];
    const px = list.find(x => x.name === r.name);
    const wpf = px ? num(px.weightKgPerFt) : 0;
    return s + num(r.ft) * wpf;
  }, 0);
  const profilesWeight = mfWeight + edgeWeight + extrasWeight;

  // Accessories weight (existing): per-unit weightKg × qty.
  const accessoriesWeight = acc.weight;

  // Section I "Additional fixed weights" — flat kg list summed in.
  const weightRows = (typeof SETTINGS !== "undefined" && Array.isArray(SETTINGS.weights)) ? SETTINGS.weights : [];
  const baseWeight = weightRows.reduce((s, w) => s + num(w.kg), 0);

  const weightPerBox = panelsWeight + foamWeight + customFoamWeight + customPanelWeight + profilesWeight + accessoriesWeight + baseWeight;
  const totalWeight = weightPerBox * quantity;

  // Per-source breakdown (shown internally; customer sees only the single rolled-up figure).
  const weightBreakdown = [
    { key: "panels",       label: "Panels",                kg: panelsWeight },
    { key: "foam",         label: "Foam",                  kg: foamWeight },
    { key: "customFoam",   label: "Custom foam add-ons",   kg: customFoamWeight },
    { key: "customPanel",  label: "Custom panel add-ons",  kg: customPanelWeight },
    { key: "profiles",     label: "Profiles (MF + Edge)",  kg: profilesWeight },
    { key: "accessories",  label: "Accessories & hardware",kg: accessoriesWeight },
    { key: "additional",   label: "Additional fixed",      kg: baseWeight },
  ].filter(r => r.kg > 0);

  return {
    acp, foam, customFoam, customPanel, profiles, acc, addons, shipping,
    acpCost: acp.cost,
    foamCost: foam.cost,
    customFoamCost: customFoam.cost,
    customPanelCost: customPanel.cost,
    mfCost: profiles.mfCost,
    rCost: profiles.rCost,
    edgeCost: profiles.edgeCost,
    extrasCost: profiles.extrasCost,
    profileCost: profiles.cost,
    accCost: acc.cost,
    addonCost: 0,
    labourCost: labour,
    subtotalPerBox,
    quantity,
    boxesTotal,
    shippingValue: shipping.value,
    beforeFinalMargin,
    finalMarginPercent,
    finalMarginValue,
    totalBeforeGst,
    gst,
    grand,
    weightRows,
    baseWeight,
    accessoriesWeight,
    panelsWeight,
    foamWeight,
    customFoamWeight,
    customPanelWeight,
    profilesWeight,
    weightBreakdown,
    weightPerBox,
    totalWeight,
  };
}
