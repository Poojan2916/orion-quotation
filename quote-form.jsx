/* ============================================================
   New / Edit Quotation form
   ============================================================ */

function QuoteForm({ quote, onChange, onSave, onPreview, onBack }) {
  // ---- update helpers ----
  const patch = (obj) => onChange({ ...quote, ...obj });
  const patchCustomer = (k, v) => patch({ customer: { ...quote.customer, [k]: v } });
  const patchProduct = (k, v) => patch({ product: { ...quote.product, [k]: v } });
  const patchDim = (k, v) => patch({ caseDims: { ...quote.caseDims, [k]: v } });
  const patchAcp = (k, v) => patch({ acp: { ...quote.acp, [k]: v } });
  const patchLabour = (k, v) => patch({ labour: { ...quote.labour, [k]: v } });

  const c = useMemo(() => calcQuote(quote), [quote]);

  return (
    <div className="container">
      <div className="preview-bar">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <div className="spacer" />
        <span className="tag-chip">{quote.quoteNo}</span>
      </div>

      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">New Quotation</div>
          <h1>{quote.customer.name ? quote.customer.name : "Build Quotation"}</h1>
          <div className="sub">Enter case specs and pricing — totals update live in the summary panel.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <select value={quote.status} onChange={e => patch({ status: e.target.value })} style={{ width: 130 }}>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="builder">
        <div className="builder-main">
          <CustomerSection quote={quote} patchCustomer={patchCustomer} patchProduct={patchProduct} patch={patch} />
          <DimensionsSection quote={quote} patchDim={patchDim} />
          <AcpSection quote={quote} patchAcp={patchAcp} patch={patch} calc={c.acp} />
          <FoamSection quote={quote} patch={patch} calc={c.foam} customCalc={c.customFoam} />
          <ProfilesSection quote={quote} patch={patch} calc={c.profiles} />
          <AccessoriesSection quote={quote} patch={patch} calc={c.acc} />
          <CustomerDisplaySection quote={quote} patch={patch} />
          <LabourSection quote={quote} patchLabour={patchLabour} total={c.labourCost} />
          <OrderSection quote={quote} patch={patch} calc={c} />

          <div className="formfoot">
            <button className="btn btn-ghost" onClick={onBack}>Cancel</button>
            <div className="spacer" />
            <button className="btn btn-ghost" onClick={onSave}><Icon name="save" /> Save Draft</button>
            <button className="btn btn-red" onClick={onPreview}><Icon name="eye" /> Preview &amp; Generate</button>
          </div>
        </div>

        <CalcSummary quote={quote} onSave={onSave} onPreview={onPreview} />
      </div>
    </div>
  );
}

/* ---------- 1. Customer ---------- */
function CustomerSection({ quote, patchCustomer, patchProduct }) {
  const cu = quote.customer;
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">1</span><h3>Customer &amp; Product Details</h3></div>
      <div className="section-body">
        <div className="grid grid-2">
          <Field label="Customer Name"><input type="text" value={cu.name} placeholder="e.g. Rohit Mehta" onChange={e => patchCustomer("name", e.target.value)} /></Field>
          <Field label="Company"><input type="text" value={cu.company} placeholder="e.g. Skyline Audio Pvt. Ltd." onChange={e => patchCustomer("company", e.target.value)} /></Field>
        </div>
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <Field label="Phone"><input type="tel" value={cu.phone} placeholder="+91 ..." onChange={e => patchCustomer("phone", e.target.value)} /></Field>
          <Field label="Email"><input type="email" value={cu.email} placeholder="name@company.com" onChange={e => patchCustomer("email", e.target.value)} /></Field>
        </div>
        <div className="grid grid-2" style={{ marginTop: 16 }}>
          <Field label="GSTIN" opt="optional"><input type="text" className="mono" value={cu.gstin} placeholder="22AAAAA0000A1Z5" onChange={e => patchCustomer("gstin", e.target.value)} /></Field>
          <Field label="Billing Address"><input type="text" value={cu.address} placeholder="City, State" onChange={e => patchCustomer("address", e.target.value)} /></Field>
        </div>
        <div className="hsep" />
        <div className="grid grid-2">
          <Field label="Product / Case Name">
            <select value={quote.product.name} onChange={e => patchProduct("name", e.target.value)}>
              {!PRODUCT_CASE_NAMES.includes(quote.product.name) && quote.product.name && <option value={quote.product.name}>{quote.product.name}</option>}
              {PRODUCT_CASE_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </Field>
          <Field label="Drawing / Ref No." opt="optional"><input type="text" className="mono" value={quote.product.ref} placeholder="DWG-000" onChange={e => patchProduct("ref", e.target.value)} /></Field>
        </div>
      </div>
    </div>
  );
}

/* ---------- 2. Dimensions ---------- */
function DimensionsSection({ quote, patchDim }) {
  const d = quote.caseDims;
  const fields = [
    { k: "length", l: "Length (L)" },
    { k: "width", l: "Width (W)" },
    { k: "height", l: "Body Height (H)" },
    { k: "lidHeight", l: "Lid Height (H1)" },
  ];
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">2</span><h3>Case Dimensions</h3>
        <span className="hint">internal, mm</span>
      </div>
      <div className="section-body">
        <div className="grid grid-4">
          {fields.map(f => (
            <Field key={f.k} label={f.l}>
              <NumInput value={d[f.k]} unit="mm" onChange={v => patchDim(f.k, v)} />
            </Field>
          ))}
        </div>
        <p className="note" style={{ marginTop: 14 }}>
          Panel areas below are derived automatically from these dimensions. Lid height (H1) drives the lid-side panels.
        </p>
      </div>
    </div>
  );
}

/* ---------- Shared panel breakdown table (same for every material) ---------- */
function PanelBreakdownTable({ rows, cut, editableQty, onQty, rawQty }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>Panel</th>
            <th className="num">Piece (mm)</th>
            <th className="num">Cut +{cut} (mm)</th>
            <th className="num">Qty</th>
            <th className="num">Pcs / sheet</th>
            <th className="num">Cost / pc</th>
            <th className="num">Total</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key}>
              <td style={{ fontWeight: 500 }}>{r.label}</td>
              <td className="num mono">{inr(r.a, 0)} × {inr(r.b, 0)}</td>
              <td className="num mono">{inr(r.cutA, 0)} × {inr(r.cutB, 0)}</td>
              <td className="num">
                {editableQty
                  ? <input className="num-input cell-input" style={{ maxWidth: 60 }} type="number" min="0"
                      value={rawQty(r.key)}
                      onChange={e => onQty(r.key, e.target.value === "" ? "" : e.target.value)} onFocus={e => e.target.select()} />
                  : <span className="mono">{r.qty}</span>}
              </td>
              <td className="num mono">{r.fit || <span style={{ color: "var(--red)" }}>—</span>}</td>
              <td className="num mono" style={{ color: "var(--ink-2)" }}>₹{inr(r.costPerPiece, 0)}</td>
              <td className="num row-total">₹{inr(r.cost, 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- 3. Panel Material ---------- */
function AcpSection({ quote, patchAcp, patch, calc }) {
  const acp = quote.acp;
  const mat = panelMaterial(acp.material);
  const setPanelQty = (key, v) => {
    patchAcp("panels", acp.panels.map(p => p.key === key ? { ...p, qty: v } : p));
  };
  const setMaterial = (name) => {
    const m = panelMaterial(name);
    patch({ acp: { ...acp, material: name, sheetW: m.sheetW, sheetL: m.sheetL, thickness: m.thickness, baseRate: m.baseRate, margin: m.margin, overlay: m.overlay, cutMargin: m.cutMargin } });
  };
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">3</span><h3>Panel Material</h3>
        <span className="hint">sheet-cut · {inr(acp.sheetW, 0)}×{inr(acp.sheetL, 0)} mm = {calc.sheetSqft} sqft</span>
      </div>
      <div className="section-body">
        <div className="grid grid-4" style={{ marginBottom: 16 }}>
          <Field label="Material">
            <select value={acp.material} onChange={e => setMaterial(e.target.value)}>
              {SETTINGS.panelMaterials.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Sheet Width"><NumInput value={acp.sheetW} unit="mm" onChange={v => patchAcp("sheetW", v)} /></Field>
          <Field label="Sheet Length"><NumInput value={acp.sheetL} unit="mm" onChange={v => patchAcp("sheetL", v)} /></Field>
          <Field label="Thickness">
            <select value={acp.thickness} onChange={e => patchAcp("thickness", parseFloat(e.target.value))}>
              {mat.thicknessOptions.map(t => <option key={t} value={t}>{t} mm</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-4" style={{ marginBottom: 18 }}>
          <Field label="Base Rate"><NumInput value={acp.baseRate} unit="₹/sqft" onChange={v => patchAcp("baseRate", v)} /></Field>
          <Field label="Margin" opt="optional"><NumInput value={acp.margin} unit="₹/sqft" placeholder="0" onChange={v => patchAcp("margin", v)} /></Field>
          <Field label="Overlay Rate" opt="optional"><NumInput value={acp.overlay} unit="₹/sqft" placeholder="0" onChange={v => patchAcp("overlay", v)} /></Field>
          <Field label="Cutting Margin"><NumInput value={acp.cutMargin} unit="mm" onChange={v => patchAcp("cutMargin", v)} /></Field>
        </div>

        {acp.material === "MDF" && (
          <div className="layer-banner">
            <span className="dot" /> <b>Main Panel:</b> MDF <span className="sep">+</span> <b>Auto-added Layer:</b> ABS Silver
          </div>
        )}

        <PanelBreakdownTable rows={calc.rows} cut={calc.cut} editableQty onQty={setPanelQty}
          rawQty={k => quote.acp.panels.find(p => p.key === k).qty} />

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
          <span className="subtotal-pill">Final rate <b>₹{calc.finalRate.toFixed(0)}/sqft</b></span>
          <span className="subtotal-pill">Sheet cost <b>₹{inr(calc.sheetCost, 0)}</b></span>
          <span className="subtotal-pill">{calc.sheetSqft} sqft × ₹{calc.finalRate.toFixed(0)}</span>
          <div style={{ flex: 1 }} />
          <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>{acp.material} Cost <b style={{ color: "#fff" }}>₹{inr(calc.main.cost, 0)}</b></span>
        </div>

        {calc.abs && (
          <AbsLayer acp={acp} patch={patch} calc={calc.abs} />
        )}

        {calc.abs && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--border)", flexWrap: "wrap" }}>
            <span className="note">Total panel cost = {acp.material} + ABS Silver layer</span>
            <div style={{ flex: 1 }} />
            <span className="subtotal-pill" style={{ background: "var(--red)", color: "#fff" }}>Total Panel Cost <b style={{ color: "#fff" }}>₹{inr(calc.cost, 0)}</b></span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Auto-linked ABS Silver layer (MDF only) ---------- */
function AbsLayer({ acp, patch, calc }) {
  const al = acp.absLayer || {};
  const absOpts = panelMaterial("ABS Silver").thicknessOptions;
  const setAbs = (k, v) => patch({ acp: { ...acp, absLayer: { ...al, [k]: v } } });
  return (
    <div className="abs-layer">
      <div className="abs-head">
        <span className="abs-tag">Auto-added layer</span>
        <h4>ABS Silver</h4>
        <span className="note" style={{ marginLeft: "auto" }}>shares case dims, categories, qty &amp; {acp.cutMargin}mm cut margin</span>
      </div>
      <div className="grid grid-4" style={{ marginBottom: 14 }}>
        <Field label="Sheet Width"><NumInput value={al.sheetW} unit="mm" onChange={v => setAbs("sheetW", v)} /></Field>
        <Field label="Sheet Length"><NumInput value={al.sheetL} unit="mm" onChange={v => setAbs("sheetL", v)} /></Field>
        <Field label="Thickness">
          <select value={al.thickness} onChange={e => setAbs("thickness", parseFloat(e.target.value))}>
            {absOpts.map(t => <option key={t} value={t}>{t} mm</option>)}
          </select>
        </Field>
        <div className="grid grid-2" style={{ gap: 10 }}>
          <Field label="Base Rate"><NumInput value={al.baseRate} unit="₹" onChange={v => setAbs("baseRate", v)} /></Field>
          <Field label="Margin" opt="optional"><NumInput value={al.margin} unit="₹" placeholder="0" onChange={v => setAbs("margin", v)} /></Field>
        </div>
      </div>
      <PanelBreakdownTable rows={calc.rows} cut={acp.cutMargin} editableQty={false} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
        <span className="subtotal-pill">Final rate <b>₹{calc.finalRate.toFixed(0)}/sqft</b></span>
        <span className="subtotal-pill">Sheet {inr(calc.sheetW, 0)}×{inr(calc.sheetL, 0)} = {calc.sheetSqft} sqft</span>
        <span className="subtotal-pill">Sheet cost <b>₹{inr(calc.sheetCost, 0)}</b></span>
        <div style={{ flex: 1 }} />
        <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>ABS Silver Cost <b style={{ color: "#fff" }}>₹{inr(calc.cost, 0)}</b></span>
      </div>
    </div>
  );
}

/* ---------- 4. Foam Inserts — list of layers, each 5 categories (same logic) ---------- */
function FoamSection({ quote, patch, calc, customCalc }) {
  const layers = quote.foam;
  const setLayer = (id, k, v) => patch({ foam: layers.map(l => l.id === id ? { ...l, [k]: v } : l) });
  const setPanelQty = (id, key, v) => patch({ foam: layers.map(l => l.id === id ? { ...l, panels: l.panels.map(p => p.key === key ? { ...p, qty: v } : p) } : l) });
  const onType = (id, name) => {
    const t = foamType(name);
    patch({ foam: layers.map(l => l.id === id ? { ...l, type: name, sheetW: t.sheetW, sheetL: t.sheetL, thickness: t.thickness, rate: t.rate, adhesive: t.adhesive } : l) });
  };
  const addLayer = () => patch({ foam: [...layers, makeFoamConfig("XLPE foam")] });
  const delLayer = (id) => patch({ foam: layers.filter(l => l.id !== id) });

  const customRows = Array.isArray(quote.customFoamAddons) ? quote.customFoamAddons : [];
  const setCustomRow = (id, k, v) => patch({ customFoamAddons: customRows.map(r => r.id === id ? { ...r, [k]: v } : r) });
  const delCustomRow = (id) => patch({ customFoamAddons: customRows.filter(r => r.id !== id) });
  const addCustomRow = () => patch({ customFoamAddons: [
    ...customRows,
    makeCustomFoamAddon("EPE foam", {
      name: "Additional foam piece",
      length: quote.caseDims.length,
      width: quote.caseDims.width,
      thickness: quote.caseDims.height,
      qty: 1,
    })
  ] });
  const onCustomType = (id, typeName) => {
    const t = foamType(typeName);
    patch({ customFoamAddons: customRows.map(r => r.id === id ? { ...r, type: typeName, rate: t.rate, thickness: r.thickness || t.thickness } : r) });
  };
  const customCalcRows = (customCalc && Array.isArray(customCalc.rows)) ? customCalc.rows : [];
  const customTotal = customCalc ? customCalc.cost : 0;

  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">4</span><h3>Foam Inserts</h3>
        <span className="hint">5 categories per layer · sheet cost = W·L·thk·rate + margin + adhesive</span>
      </div>
      <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {calc.layers.map((lc, idx) => {
          const l = layers.find(x => x.id === lc.id) || layers[idx];
          return (
            <div className="foam-layer" key={lc.id}>
              <div className="foam-layer-head">
                <h4>Foam Layer {idx + 1}</h4>
                <span className="note">{lc.type} {lc.thk}mm · sheet ₹{inr(lc.sheetCost, 0)}</span>
                <div style={{ flex: 1 }} />
                <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>Layer {idx + 1} <b style={{ color: "#fff" }}>₹{inr(lc.cost, 0)}</b></span>
                {layers.length > 1 && <button className="btn btn-danger-ghost" onClick={() => delLayer(lc.id)} title="Remove layer"><Icon name="trash" /></button>}
              </div>

              <div className="grid grid-4" style={{ marginBottom: 12 }}>
                <Field label="Foam Type">
                  <select value={l.type} onChange={e => onType(lc.id, e.target.value)}>
                    {SETTINGS.foamTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </select>
                </Field>
                <Field label="Thickness"><NumInput value={l.thickness} unit="mm" onChange={v => setLayer(lc.id, "thickness", v)} /></Field>
                <Field label="Rate /mm"><NumInput value={l.rate} unit="₹" onChange={v => setLayer(lc.id, "rate", v)} /></Field>
                <Field label="Cutting Margin"><NumInput value={l.cutMargin} unit="mm" onChange={v => setLayer(lc.id, "cutMargin", v)} /></Field>
              </div>
              <div className="grid grid-4" style={{ marginBottom: 14 }}>
                <Field label="Sheet Width"><NumInput value={l.sheetW} unit="mm" onChange={v => setLayer(lc.id, "sheetW", v)} /></Field>
                <Field label="Sheet Length"><NumInput value={l.sheetL} unit="mm" onChange={v => setLayer(lc.id, "sheetL", v)} /></Field>
                <Field label="Margin" opt="optional"><NumInput value={l.margin} unit="₹" placeholder="0" onChange={v => setLayer(lc.id, "margin", v)} /></Field>
                <Field label="Adhesive"><NumInput value={l.adhesive} unit="₹" onChange={v => setLayer(lc.id, "adhesive", v)} /></Field>
              </div>

              <PanelBreakdownTable rows={lc.rows} cut={lc.cut} editableQty
                onQty={(key, v) => setPanelQty(lc.id, key, v)}
                rawQty={k => l.panels.find(p => p.key === k).qty} />
            </div>
          );
        })}

        <div style={{ display: "flex", alignItems: "center" }}>
          <button className="btn-addrow" onClick={addLayer}><Icon name="plus" /> Add foam layer</button>
          <div style={{ flex: 1 }} />
          <span className="subtotal-pill" style={{ background: "var(--red)", color: "#fff" }}>Main Foam Cost <b style={{ color: "#fff" }}>₹{inr(calc.cost, 0)}</b></span>
        </div>

        <div className="foam-layer">
          <div className="foam-layer-head">
            <h4>Custom Foam Size Add-ons</h4>
            <span className="note">extra foam blocks/slabs with different sizes · L×W×thickness</span>
            <div style={{ flex: 1 }} />
            <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>Custom Foam <b style={{ color: "#fff" }}>₹{inr(customTotal, 0)}</b></span>
          </div>
          <div className="table-wrap" style={{ paddingBottom: 6 }}>
            <table className="tbl" style={{ minWidth: 1220 }}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Foam Type</th>
                  <th className="num">L</th>
                  <th className="num">W</th>
                  <th className="num">Thk / H</th>
                  <th className="num">Qty</th>
                  <th className="num">Rate/mm</th>
                  <th className="num">Margin</th>
                  <th className="num">Adhesive</th>
                  <th className="num">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {customCalcRows.map(r => (
                  <tr key={r.id}>
                    <td style={{ minWidth: 230 }}><input value={r.name} placeholder="Additional foam" onChange={e => setCustomRow(r.id, "name", e.target.value)} /></td>
                    <td style={{ minWidth: 180 }}>
                      <select value={r.type} onChange={e => onCustomType(r.id, e.target.value)}>
                        {SETTINGS.foamTypes.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                      </select>
                    </td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 105 }} type="number" value={r.length} onChange={e => setCustomRow(r.id, "length", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 105 }} type="number" value={r.width} onChange={e => setCustomRow(r.id, "width", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 105 }} type="number" value={r.thickness} onChange={e => setCustomRow(r.id, "thickness", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 80 }} type="number" value={r.qty} onChange={e => setCustomRow(r.id, "qty", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 95 }} type="number" step="0.05" value={r.rate} onChange={e => setCustomRow(r.id, "rate", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 95 }} type="number" placeholder="0" value={r.margin} onChange={e => setCustomRow(r.id, "margin", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ width: "100%", minWidth: 95 }} type="number" placeholder="0" value={r.adhesive} onChange={e => setCustomRow(r.id, "adhesive", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num row-total">₹{inr(r.total, 0)}</td>
                    <td><button className="btn btn-danger-ghost" onClick={() => delCustomRow(r.id)} title="Remove"><Icon name="trash" /></button></td>
                  </tr>
                ))}
                {customCalcRows.length === 0 && <tr><td colSpan="11" style={{ textAlign: "center", color: "var(--ink-4)", padding: 14 }}>No custom foam add-ons added</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row-add" style={{ display: "flex", alignItems: "center" }}>
            <button className="btn-addrow" onClick={addCustomRow}><Icon name="plus" /> Add custom foam size</button>
            <div style={{ flex: 1 }} />
            <span className="note">Scroll sideways if needed · Cost = (L/1000 × W/1000 × thickness × rate + margin + adhesive) × qty</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <span className="subtotal-pill" style={{ background: "var(--red)", color: "#fff" }}>Total Foam Cost <b style={{ color: "#fff" }}>₹{inr(calc.cost + customTotal, 0)}</b></span>
        </div>
      </div>
    </div>
  );
}

/* ---------- 5. Accessories ---------- */
function AccessoriesSection({ quote, patch, calc }) {
  const setRow = (id, k, v) => patch({ accessories: quote.accessories.map(a => a.id === id ? { ...a, [k]: v } : a) });
  const delRow = (id) => patch({ accessories: quote.accessories.filter(a => a.id !== id) });
  const firstPreset = SETTINGS.accessories[0] || { name: "Custom item", unit: "pc", basePrice: 0, weightKg: "" };
  const addRow = () => patch({ accessories: [...quote.accessories, { id: uid("a"), name: firstPreset.name, unit: firstPreset.unit || "pc", qty: 1, basePrice: firstPreset.basePrice || 0, weightKg: firstPreset.weightKg || "", margin: "" }] });
  const onName = (id, name) => {
    const preset = accessoryPreset(name);
    patch({ accessories: quote.accessories.map(a => a.id === id ? { ...a, name, basePrice: preset ? preset.basePrice : a.basePrice, unit: preset ? preset.unit : a.unit, weightKg: preset ? (preset.weightKg || "") : a.weightKg } : a) });
  };

  const groupOf = (name) => {
    const n = String(name || "").toLowerCase();
    if (n.includes("corner")) return "Corners";
    if (n.includes("lock")) return "Locks";
    if (n.includes("handle")) return "Handles";
    if (n.includes("hinge")) return "Hinges";
    return "Other Hardware";
  };
  const groupOrder = ["Corners", "Locks", "Handles", "Hinges", "Other Hardware"];
  const grouped = groupOrder
    .map(label => ({ label, rows: calc.rows.filter(r => groupOf(r.name) === label) }))
    .filter(g => g.rows.length);

  const renderRow = (r) => (
    <tr key={r.id}>
      <td style={{ minWidth: 190 }}>
        <select value={SETTINGS.accessories.some(p => p.name === r.name) ? r.name : "__custom"} onChange={e => { if (e.target.value === "__custom") return; onName(r.id, e.target.value); }} style={{ marginBottom: SETTINGS.accessories.some(p => p.name === r.name) ? 0 : 4 }}>
          {SETTINGS.accessories.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
          <option value="__custom">Custom item…</option>
        </select>
        {!SETTINGS.accessories.some(p => p.name === r.name) && (
          <input type="text" value={r.name} placeholder="Item name" onChange={e => setRow(r.id, "name", e.target.value)} />
        )}
      </td>
      <td>
        <div className="segmented unit-seg">
          <button className={r.unit === "pc" ? "active" : ""} onClick={() => setRow(r.id, "unit", "pc")}>pc</button>
          <button className={r.unit === "ft" ? "active" : ""} onClick={() => setRow(r.id, "unit", "ft")}>ft</button>
        </div>
      </td>
      <td className="num"><input className="num-input cell-input" style={{ maxWidth: 60 }} type="number" value={r.qty} onChange={e => setRow(r.id, "qty", e.target.value)} onFocus={e => e.target.select()} /></td>
      <td className="num"><input className="num-input cell-input" style={{ maxWidth: 80 }} type="number" value={r.basePrice} onChange={e => setRow(r.id, "basePrice", e.target.value)} onFocus={e => e.target.select()} /></td>
      <td className="num"><input className="num-input cell-input" style={{ maxWidth: 72 }} type="number" placeholder="0" value={r.margin} onChange={e => setRow(r.id, "margin", e.target.value)} onFocus={e => e.target.select()} /></td>
      <td className="num mono" style={{ color: "var(--ink-2)" }}>₹{inr(r.finalUnit, 0)}</td>
      <td className="num row-total">₹{inr(r.total, 0)}</td>
      <td><button className="btn btn-danger-ghost" onClick={() => delRow(r.id)} title="Remove"><Icon name="trash" /></button></td>
    </tr>
  );

  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">6</span><h3>Accessories &amp; Hardware</h3>
        <span className="hint">view split: corners · locks · handles · hinges</span>
      </div>
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th>Unit</th>
              <th className="num">Qty / Ft</th>
              <th className="num">Base Price</th>
              <th className="num">Margin</th>
              <th className="num">Final Unit</th>
              <th className="num">Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {grouped.map(g => (
              <React.Fragment key={g.label}>
                <tr className="acc-group-row"><td colSpan="8">{g.label}</td></tr>
                {g.rows.map(renderRow)}
              </React.Fragment>
            ))}
            {calc.rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center", color: "var(--ink-4)", padding: 18 }}>No accessories added</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="row-add" style={{ display: "flex", alignItems: "center" }}>
        <button className="btn-addrow" onClick={addRow}><Icon name="plus" /> Add accessory / hardware</button>
        <div style={{ flex: 1 }} />
        <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>Accessories &amp; Hardware <b style={{ color: "#fff" }}>₹{inr(calc.cost, 0)}</b></span>
      </div>
    </div>
  );
}

/* ---------- 7. Customer Display ---------- */
function CustomerDisplaySection({ quote, patch }) {
  const display = quote.customerDisplay || { showFoamLayers: false, foamLayerName: "Custom foam insert", foamLayerLines: "Custom foam insert" };
  const displayLines = display.foamLayerLines != null ? display.foamLayerLines : (display.foamLayerName || "Custom foam insert");
  const setDisplay = (k, v) => patch({ customerDisplay: { ...display, [k]: v } });
  const setFoamLines = (v) => patch({ customerDisplay: { ...display, foamLayerLines: v, foamLayerName: String(v || "").split(/\r?\n/).find(line => line.trim()) || "" } });

  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">7</span><h3>Customer Display</h3>
        <span className="hint">controls only what appears in customer quote/PDF</span>
      </div>
      <div className="section-body">
        <label className="addon on" style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <input type="checkbox" checked={!!display.showFoamLayers} onChange={e => setDisplay("showFoamLayers", e.target.checked)} />
          <span className="addon-name">Display foam lines in Scope of Supply</span>
        </label>
        <div className="grid grid-2">
          <Field label="Customer-facing foam / scope lines">
            <textarea value={displayLines} placeholder={"Custom foam insert\nProtective foam lining\nCNC cut foam as per product"} onChange={e => setFoamLines(e.target.value)} />
          </Field>
          <div className="note" style={{ alignSelf: "end", paddingBottom: 8 }}>
            Enter one customer-facing line per row. Foam cost is always calculated; this only decides what text is shown to the customer.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 8. Labour ---------- */
function LabourSection({ quote, patchLabour, total }) {
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">8</span><h3>Labour &amp; Assembly</h3></div>
      <div className="section-body">
        <div className="grid grid-3" style={{ alignItems: "end" }}>
          <Field label="Labour Cost"><NumInput value={quote.labour.cost} unit="₹" onChange={v => patchLabour("cost", v)} /></Field>
          <Field label="Margin" opt="optional"><NumInput value={quote.labour.margin} unit="₹" placeholder="0" onChange={v => patchLabour("margin", v)} /></Field>
          <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff", justifySelf: "start" }}>Labour Total <b style={{ color: "#fff" }}>₹{inr(total, 0)}</b></span>
        </div>
      </div>
    </div>
  );
}

/* ---------- 5. Profiles (MF Set + Edge + Profile Extras) ---------- */
function ProfilesSection({ quote, patch, calc }) {
  const profiles = quote.profiles || {};
  const mf = profiles.mf || PROFILE_DEFAULTS.mf;
  const edge = profiles.edge || PROFILE_DEFAULTS.edge;
  const profileExtras = Array.isArray(quote.profileExtras) ? quote.profileExtras : [];

  const setMf = (k, v) => patch({ profiles: { ...profiles, mf: { ...mf, [k]: v } } });
  const setEdge = (k, v) => patch({ profiles: { ...profiles, edge: { ...edge, [k]: v } } });
  const setExtra = (id, k, v) => patch({ profileExtras: profileExtras.map(x => x.id === id ? { ...x, [k]: v } : x) });
  const delExtra = (id) => patch({ profileExtras: profileExtras.filter(x => x.id !== id) });
  const addExtra = () => {
    const p = SETTINGS.profileExtras[0] || { name: "L Patti 20mm", basePrice: 0 };
    patch({ profileExtras: [...profileExtras, { id: uid("px"), name: p.name, unit: "mm", requiredMm: 0, basePrice: p.basePrice || 0, margin: "" }] });
  };
  const onExtraName = (id, name) => {
    const p = profileExtraPreset(name);
    patch({ profileExtras: profileExtras.map(x => x.id === id ? { ...x, name, unit: "mm", basePrice: p ? p.basePrice : x.basePrice } : x) });
  };

  const onMfSet = (name) => {
    const s = mfSet(name);
    patch({ profiles: { ...profiles, mf: { ...mf, set: name, male: s.male, female: s.female } } });
  };

  const onEdgeOpt = (name) => {
    const o = edgeOption(name);
    patch({
      profiles: {
        ...profiles,
        edge: {
          ...edge,
          option: name,
          rate: o.rate,
          mode: o.mode || (/double angle/i.test(name) ? "manual" : "auto"),
        },
      },
    });
  };

  const isManualEdge = (calc.edge.mode === "manual");

  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">5</span><h3>Profiles</h3>
        <span className="hint">per running foot · ceil to whole ft</span>
      </div>
      <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>

        {/* MF Profile Set */}
        <div className="profile-card">
          <div className="profile-head"><h4>MF Profile Set</h4><span className="note">one combined male + female set</span></div>
          <div className="profile-grid" style={{ gridTemplateColumns: "1.6fr repeat(3, 1fr)" }}>
            <Field label="Profile Set">
              <select value={mf.set} onChange={e => onMfSet(e.target.value)}>
                {SETTINGS.mfSets.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Male rate"><NumInput value={mf.male} unit="₹/ft" onChange={v => setMf("male", v)} /></Field>
            <Field label="Female rate"><NumInput value={mf.female} unit="₹/ft" placeholder="0" onChange={v => setMf("female", v)} /></Field>
            <Field label="Combined"><input className="num-input" value={"₹" + (calc.mf.combined).toFixed(2)} readOnly tabIndex={-1} style={{ background: "var(--surface-3)", color: "var(--navy)", fontWeight: 600 }} /></Field>
          </div>
          <div className="profile-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
            <Field label="L qty"><NumInput value={mf.qL} onChange={v => setMf("qL", v)} /></Field>
            <Field label="W qty"><NumInput value={mf.qW} onChange={v => setMf("qW", v)} /></Field>
            <Field label="Margin" opt="optional"><NumInput value={mf.margin} unit="₹/ft" placeholder="0" onChange={v => setMf("margin", v)} /></Field>
          </div>
          <div className="profile-calc">
            <span>L×{num(mf.qL)} + W×{num(mf.qW)} = <b className="mono">{inr(calc.mf.mm, 0)} mm</b></span>
            <span>= {calc.mf.ftExact.toFixed(2)} ft → ceil <b className="mono">{calc.mf.ft} ft</b></span>
            <span>{calc.mf.ft} ft × ₹{(calc.mf.combined + calc.mf.margin).toFixed(2)}</span>
            <span className="profile-total">MF Set ₹{inr(calc.mfCost, 0)}</span>
          </div>
        </div>

        {/* Edge Profile */}
        <div className="profile-card">
          <div className="profile-head"><h4>Edge Profile</h4><span className="note">R profile + double angle options combined</span></div>
          <div className="profile-grid" style={{ gridTemplateColumns: "1.8fr repeat(3, 1fr)" }}>
            <Field label="Edge Profile">
              <select value={edge.option} onChange={e => onEdgeOpt(e.target.value)}>
                {SETTINGS.edgeOptions.map(o => <option key={o.name} value={o.name}>{o.name}</option>)}
              </select>
            </Field>
            {isManualEdge ? (
              <Field label="Length"><NumInput value={edge.lengthFt} unit="ft" onChange={v => setEdge("lengthFt", v)} /></Field>
            ) : (
              <Field label="Length"><input value="Auto from case edges" readOnly tabIndex={-1} /></Field>
            )}
            <Field label="Rate"><input className="num-input" value={calc.edge.rate} readOnly tabIndex={-1} style={{ background: "var(--surface-3)" }} /></Field>
            <Field label="Margin" opt="optional"><NumInput value={edge.margin} unit="₹/ft" placeholder="0" onChange={v => setEdge("margin", v)} /></Field>
          </div>

          {!isManualEdge && (
            <div className="profile-grid" style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
              <Field label="L qty"><NumInput value={edge.qL} onChange={v => setEdge("qL", v)} /></Field>
              <Field label="W qty"><NumInput value={edge.qW} onChange={v => setEdge("qW", v)} /></Field>
              <Field label="H qty"><NumInput value={edge.qH} onChange={v => setEdge("qH", v)} /></Field>
              <Field label="H1 qty"><NumInput value={edge.qH1} onChange={v => setEdge("qH1", v)} /></Field>
            </div>
          )}

          <div className="profile-calc">
            {isManualEdge ? (
              <span>{num(edge.lengthFt)} ft × ₹{calc.edge.finalRate}{num(edge.margin) > 0 ? " (rate " + num(calc.edge.rate) + " + margin " + num(edge.margin) + ")" : ""}</span>
            ) : (
              <span>L×{num(edge.qL)} + W×{num(edge.qW)} + H×{num(edge.qH)} + H1×{num(edge.qH1)} = <b className="mono">{inr(calc.edge.mm, 0)} mm</b></span>
            )}
            {!isManualEdge && <span>= {calc.edge.ftExact.toFixed(2)} ft → ceil <b className="mono">{calc.edge.ft} ft</b></span>}
            <span>{calc.edge.ft} ft × ₹{calc.edge.finalRate}</span>
            <span className="profile-total">Edge Profile ₹{inr(calc.edgeCost, 0)}</span>
          </div>
        </div>

        {/* Profile Extras */}
        <div className="profile-card">
          <div className="profile-head"><h4>Profile Extras</h4><span className="note">L Patti, C Channel, Tube — enter required mm, auto converted to ft</span></div>
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="num">Required mm</th>
                  <th className="num">Ft exact</th>
                  <th className="num">Ft charged</th>
                  <th className="num">Rate ₹/ft</th>
                  <th className="num">Margin</th>
                  <th className="num">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {calc.extras.rows.map(r => (
                  <tr key={r.id}>
                    <td style={{ minWidth: 180 }}>
                      <select value={SETTINGS.profileExtras.some(p => p.name === r.name) ? r.name : "__custom"} onChange={e => { if (e.target.value === "__custom") return; onExtraName(r.id, e.target.value); }} style={{ marginBottom: SETTINGS.profileExtras.some(p => p.name === r.name) ? 0 : 4 }}>
                        {SETTINGS.profileExtras.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                        <option value="__custom">Custom profile extra…</option>
                      </select>
                      {!SETTINGS.profileExtras.some(p => p.name === r.name) && (
                        <input type="text" value={r.name} placeholder="Item name" onChange={e => setExtra(r.id, "name", e.target.value)} />
                      )}
                    </td>
                    <td className="num"><input className="num-input cell-input" style={{ maxWidth: 90 }} type="number" value={r.requiredMm} onChange={e => setExtra(r.id, "requiredMm", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num mono">{r.ftExact.toFixed(2)}</td>
                    <td className="num mono">{r.ft}</td>
                    <td className="num"><input className="num-input cell-input" style={{ maxWidth: 80 }} type="number" value={r.basePrice} onChange={e => setExtra(r.id, "basePrice", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num"><input className="num-input cell-input" style={{ maxWidth: 72 }} type="number" placeholder="0" value={r.margin} onChange={e => setExtra(r.id, "margin", e.target.value)} onFocus={e => e.target.select()} /></td>
                    <td className="num row-total">₹{inr(r.total, 0)}</td>
                    <td><button className="btn btn-danger-ghost" onClick={() => delExtra(r.id)} title="Remove"><Icon name="trash" /></button></td>
                  </tr>
                ))}
                {calc.extras.rows.length === 0 && <tr><td colSpan="8" style={{ textAlign: "center", color: "var(--ink-4)", padding: 14 }}>No profile extras added</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row-add" style={{ display: "flex", alignItems: "center" }}>
            <button className="btn-addrow" onClick={addExtra}><Icon name="plus" /> Add profile extra</button>
            <div style={{ flex: 1 }} />
            <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>Profile Extras <b style={{ color: "#fff" }}>₹{inr(calc.extrasCost, 0)}</b></span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <span className="note">Total profile cost = MF Set + Edge Profile + Profile Extras</span>
          <div style={{ flex: 1 }} />
          <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>Profiles <b style={{ color: "#fff" }}>₹{inr(calc.cost, 0)}</b></span>
        </div>
      </div>
    </div>
  );
}

/* ---------- 8. Optional add-ons ---------- */
function AddonsSection({ quote, patch, calc }) {
  const setRow = (id, obj) => patch({ addons: quote.addons.map(a => a.id === id ? { ...a, ...obj } : a) });
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">8</span><h3>Optional Add-ons</h3>
        <span className="hint">tick to include</span>
      </div>
      <div className="section-body" style={{ paddingTop: 8, paddingBottom: 8 }}>
        <div className="addon-grid">
          {calc.rows.map(a => (
            <label key={a.id} className={"addon " + (a.enabled ? "on" : "")}>
              <input type="checkbox" checked={a.enabled} onChange={e => setRow(a.id, { enabled: e.target.checked })} />
              <span className="addon-name">{a.name}</span>
              <input className="num-input addon-qty" type="number" min="1" value={a.qty} disabled={!a.enabled}
                onChange={e => setRow(a.id, { qty: e.target.value })} onFocus={e => e.target.select()} title="Qty" />
              <span className="addon-x">×</span>
              <div className="unit-row addon-price">
                <input className="num-input has-unit" type="number" value={a.price} disabled={!a.enabled}
                  onChange={e => setRow(a.id, { price: e.target.value })} onFocus={e => e.target.select()} />
                <span className="unit">₹</span>
              </div>
              <span className="addon-total mono">₹{inr(a.total, 0)}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="row-add" style={{ display: "flex", alignItems: "center", paddingTop: 4 }}>
        <div style={{ flex: 1 }} />
        <span className="subtotal-pill" style={{ background: "var(--navy)", color: "#fff" }}>Add-ons <b style={{ color: "#fff" }}>₹{inr(calc.cost, 0)}</b></span>
      </div>
    </div>
  );
}

/* ---------- 9. Order & shipping ---------- */
function OrderSection({ quote, patch, calc }) {
  const sh = calc.shipping;
  const shipLabel = SHIPPING_TYPES.find(s => s.key === sh.type).label;
  const finalMarginPercent = Math.max(20, Math.min(80, toNumber(quote.finalMarginPercent || 20)));

  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">9</span><h3>Order, Packaging &amp; Final Margin</h3></div>
      <div className="section-body">
        <div className="grid grid-2" style={{ alignItems: "end" }}>
          <Field label="Quantity (boxes)">
            <NumInput value={quote.quantity} unit="nos" onChange={v => patch({ quantity: v })} />
          </Field>
          <Field label="Packaging Cost">
            <div className="segmented" style={{ display: "flex" }}>
              {SHIPPING_TYPES.map(s => (
                <button key={s.key} className={quote.shipping === s.key ? "active" : ""} style={{ flex: 1 }} onClick={() => patch({ shipping: s.key })}>{s.label}</button>
              ))}
            </div>
          </Field>
        </div>

        <div className="order-recap">
          <div className="order-line"><span>Subtotal / box</span><b className="mono">₹{inr(calc.subtotalPerBox)}</b></div>
          <div className="order-line"><span>× {calc.quantity} box{calc.quantity === 1 ? "" : "es"}</span><b className="mono">₹{inr(calc.boxesTotal)}</b></div>
          <div className="order-line"><span>Packaging Cost ({shipLabel})</span><b className="mono">₹{inr(sh.value)}</b></div>
          <div className="order-line"><span>Base before final margin</span><b className="mono">₹{inr(calc.beforeFinalMargin)}</b></div>
        </div>

        <div style={{ marginTop: 16 }}>
          <Field label="Final quote margin">
            <NumInput value={finalMarginPercent} unit="%" onChange={v => patch({ finalMarginPercent: Math.max(20, Math.min(80, toNumber(v, 20))) })} />
          </Field>
          <div className="note" style={{ marginTop: 6 }}>Allowed range: 20% to 80%.</div>
          <div className="order-recap" style={{ marginTop: 10 }}>
            <div className="order-line"><span>Final quote margin ({calc.finalMarginPercent}%)</span><b className="mono">₹{inr(calc.finalMarginValue)}</b></div>
            <div className="order-line tot"><span>Total before GST</span><b className="mono">₹{inr(calc.totalBeforeGst)}</b></div>
          </div>
        </div>

        {sh.type !== "none" && (
          <p className="note" style={{ marginTop: 10 }}>
            Packaging formula: (((L+130)+(W+130)+100)×((W+130)+(H+H1+130)+30)/1,000,000)×1.08 = {sh.packaging.toFixed(2)}{sh.type === "intl" ? "  × 500 = ₹" + inr(sh.intl, 0) : " → ₹" + inr(sh.local, 0)}
          </p>
        )}
      </div>
    </div>
  );
}