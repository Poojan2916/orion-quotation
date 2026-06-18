/* ============================================================
   Internal Costing View — company use only.
   Shows every base rate, margin, sheet calc and per-piece cost.
   ============================================================ */

function InternalCosting({ quote, onBack, onEdit, onCustomer }) {
  const c = useMemo(() => calcQuote(quote), [quote]);
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  const Row = ({ label, value, strong }) => (
    <div className={"ic-line" + (strong ? " strong" : "")}><span>{label}</span><b className="mono">₹{inr(value, strong ? 2 : 0)}</b></div>
  );

  return (
    <div className="container">
      <div className="preview-bar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" /> Edit</button>
        <div className="spacer" />
        <div className="view-toggle">
          <button onClick={onCustomer}>Customer</button>
          <button className="active">Internal</button>
        </div>
        <span className="tag-chip" style={{ background: "#fbe9ea", color: "var(--red-700)" }}>Internal — confidential</span>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="print" /> Internal PDF</button>
      </div>

      <div className="doc-wrap">
        <div className="doc internal-doc" id="internal-doc">
          <div className="doc-inner">
            <div className="ic-head">
              <div>
                <div className="ic-tag">Internal Costing Sheet</div>
                <h2>{quote.quoteNo}</h2>
                <div className="note">{quote.customer.company || quote.customer.name || "—"} · {fmtDate(quote.date)}</div>
              </div>
              <div className="ic-grand">
                <span>Grand Total (incl. GST)</span>
                <b className="mono">₹{inr(c.grand)}</b>
              </div>
            </div>

            {/* Case + meta */}
            <div className="ic-meta">
              <span><i>Dimensions</i> {quote.caseDims.length}×{quote.caseDims.width}×{quote.caseDims.height} (+{quote.caseDims.lidHeight}) mm</span>
              <span><i>Quantity</i> {c.quantity} box{c.quantity === 1 ? "" : "es"}</span>
              <span><i>Material</i> {c.acp.main.material} {quote.acp.thickness}mm</span>
              <span><i>Cut margin</i> {c.acp.cut}mm</span>
            </div>

            {/* Panel breakdown */}
            <div className="ic-section">
              <h3>{c.acp.main.material} Panels — sheet {inr(c.acp.main.sheetW, 0)}×{inr(c.acp.main.sheetL, 0)} mm = {c.acp.main.sheetSqft} sqft · final ₹{c.acp.main.finalRate.toFixed(2)}/sqft · sheet cost ₹{inr(c.acp.main.sheetCost, 0)}</h3>
              <PieceTable layer={c.acp.main} />
              {c.acp.abs && (
                <>
                  <h3 style={{ marginTop: 14 }}>ABS Silver Layer (linked to MDF) — sheet {inr(c.acp.abs.sheetW, 0)}×{inr(c.acp.abs.sheetL, 0)} mm = {c.acp.abs.sheetSqft} sqft · final ₹{c.acp.abs.finalRate.toFixed(2)}/sqft</h3>
                  <PieceTable layer={c.acp.abs} />
                </>
              )}
            </div>

            {c.customPanel && c.customPanel.rows.length > 0 && (
              <div className="ic-section">
                <h3>Custom Panel Add-ons</h3>
                <table className="ic-tbl">
                  <thead><tr><th>Name</th><th>Material</th><th className="num">Size (L×W×Thk)</th><th className="num">Qty</th><th className="num">Sqft</th><th className="num">Rate ₹/sqft</th><th className="num">Margin</th><th className="num">Overlay</th><th className="num">Piece cost</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {c.customPanel.rows.map(r => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.material}</td>
                        <td className="num">{inr(r.length, 0)}×{inr(r.width, 0)}×{inr(r.thickness, 0)} mm</td>
                        <td className="num">{r.qty}</td>
                        <td className="num">{r.sqft.toFixed(2)}</td>
                        <td className="num">{r.rate}</td>
                        <td className="num">{r.margin || "—"}</td>
                        <td className="num">{r.overlay || "—"}</td>
                        <td className="num">{inr(r.pieceCost, 0)}</td>
                        <td className="num strong">{inr(r.total, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Foam breakdown — one block per layer, same 5-category logic */}
            {c.foam.layers.map((l, idx) => (
              <div className="ic-section" key={l.id}>
                <h3>Foam Layer {idx + 1}: {l.type} {l.thk}mm · sheet {inr(l.sheetW, 0)}×{inr(l.sheetL, 0)} mm · sheet cost ₹{inr(l.sheetCost, 0)} · cut +{l.cut}mm</h3>
                <table className="ic-tbl">
                  <thead><tr><th>Category</th><th className="num">Piece (mm)</th><th className="num">Cut (mm)</th><th className="num">Qty</th><th className="num">Pcs/sht</th><th className="num">₹/pc</th><th className="num">Category total</th></tr></thead>
                  <tbody>
                    {l.rows.map(r => (
                      <tr key={r.key}>
                        <td>{r.label}</td>
                        <td className="num">{inr(r.a, 0)}×{inr(r.b, 0)}</td>
                        <td className="num">{inr(r.cutA, 0)}×{inr(r.cutB, 0)}</td>
                        <td className="num">{r.qty}</td>
                        <td className="num">{r.fit}</td>
                        <td className="num">{inr(r.costPerPiece, 0)}</td>
                        <td className="num strong">{inr(r.cost, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

            {c.customFoam && c.customFoam.rows.length > 0 && (
              <div className="ic-section">
                <h3>Custom Foam Size Add-ons</h3>
                <table className="ic-tbl">
                  <thead><tr><th>Name</th><th>Type</th><th className="num">Size (L×W×Thk)</th><th className="num">Qty</th><th className="num">Rate/mm</th><th className="num">Margin</th><th className="num">Adhesive</th><th className="num">Piece cost</th><th className="num">Total</th></tr></thead>
                  <tbody>
                    {c.customFoam.rows.map(r => (
                      <tr key={r.id}>
                        <td>{r.name}</td>
                        <td>{r.type}</td>
                        <td className="num">{inr(r.length, 0)}×{inr(r.width, 0)}×{inr(r.thickness, 0)} mm</td>
                        <td className="num">{r.qty}</td>
                        <td className="num">{r.rate}</td>
                        <td className="num">{r.margin || "—"}</td>
                        <td className="num">{r.adhesive || "—"}</td>
                        <td className="num">{inr(r.pieceCost, 0)}</td>
                        <td className="num strong">{inr(r.total, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Profiles */}
            <div className="ic-section">
              <h3>Profiles</h3>
              <table className="ic-tbl">
                <thead><tr><th>Profile</th><th className="num">Length</th><th className="num">Ft (ceil)</th><th className="num">Rate ₹/ft</th><th className="num">Margin</th><th className="num">Total</th></tr></thead>
                <tbody>
                  <tr><td>{c.profiles.mf.set} (M {c.profiles.mf.male} + F {c.profiles.mf.female})</td><td className="num">{inr(c.profiles.mf.mm, 0)} mm</td><td className="num">{c.profiles.mf.ft}</td><td className="num">{c.profiles.mf.combined.toFixed(2)}</td><td className="num">{c.profiles.mf.margin || "—"}</td><td className="num strong">{inr(c.profiles.mfCost, 0)}</td></tr>
                  <tr><td>{c.profiles.edge.option}</td><td className="num">{c.profiles.edge.mode === "manual" ? c.profiles.edge.ft + " ft" : inr(c.profiles.edge.mm, 0) + " mm"}</td><td className="num">{c.profiles.edge.ft}</td><td className="num">{c.profiles.edge.rate}</td><td className="num">{c.profiles.edge.margin || "—"}</td><td className="num strong">{inr(c.profiles.edgeCost, 0)}</td></tr>
                  {c.profiles.extras.rows.map(x => (
                    <tr key={x.id}><td>{x.name}</td><td className="num">{inr(x.requiredMm, 0)} mm</td><td className="num">{x.ft}</td><td className="num">{inr(x.basePrice, 0)}</td><td className="num">{x.margin === "" || x.margin == null ? "—" : inr(x.margin, 0)}</td><td className="num strong">{inr(x.total, 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Accessories */}
            <div className="ic-section">
              <h3>Accessories &amp; Hardware</h3>
              <table className="ic-tbl">
                <thead><tr><th>Item</th><th className="num">Unit</th><th className="num">Qty/Ft</th><th className="num">Base ₹</th><th className="num">Margin</th><th className="num">Final ₹</th><th className="num">Total</th></tr></thead>
                <tbody>
                  {c.acc.rows.map(a => (
                    <tr key={a.id}><td>{a.name}</td><td className="num">{a.unit}</td><td className="num">{a.qty}</td><td className="num">{inr(a.basePrice, 0)}</td><td className="num">{a.margin === "" || a.margin == null ? "—" : inr(a.margin, 0)}</td><td className="num">{inr(a.finalUnit, 0)}</td><td className="num strong">{inr(a.total, 0)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="ic-totals">
              <Row label={c.acp.main.material + " panels" + (c.acp.abs ? " + ABS Silver" : "")} value={c.acpCost} />
              {c.customPanelCost > 0 && <Row label="Custom panel add-ons" value={c.customPanelCost} />}
              <Row label="Foam inserts" value={c.foamCost} />
              {c.customFoamCost > 0 && <Row label="Custom foam add-ons" value={c.customFoamCost} />}
              <Row label="MF profile set" value={c.mfCost} />
              <Row label="Edge profile" value={c.edgeCost} />
              {c.extrasCost > 0 && <Row label="Profile extras" value={c.extrasCost} />}
              <Row label="Accessories & hardware" value={c.accCost} />
              <Row label="Labour" value={c.labourCost} />
              <Row label="Subtotal per box" value={c.subtotalPerBox} strong />
              <Row label={"× " + c.quantity + " box" + (c.quantity === 1 ? "" : "es")} value={c.boxesTotal} />
              {c.shippingValue > 0 && <Row label={"Shipping (" + SHIPPING_TYPES.find(x => x.key === c.shipping.type).label + ")"} value={c.shippingValue} />}
              <Row label={"Final quote margin @ " + c.finalMarginPercent + "%"} value={c.finalMarginValue} />
              <Row label="Total before GST" value={c.totalBeforeGst} strong />
              <Row label={"GST @ " + SETTINGS.gstPercent + "%"} value={c.gst} />
              <div className="ic-line grand"><span>Grand Total</span><b className="mono">₹{inr(c.grand)}</b></div>
            </div>

            {/* Weight breakdown — live, density-based */}
            {c.weightPerBox > 0 && (
              <div className="ic-section" style={{ marginTop: 18 }}>
                <h3>Weight Breakdown (live, density-based)</h3>
                <table className="ic-tbl">
                  <thead><tr><th>Source</th><th className="num">kg / box</th><th className="num">kg total ({c.quantity})</th></tr></thead>
                  <tbody>
                    {c.weightBreakdown.map(w => (
                      <tr key={w.key}>
                        <td>{w.label}</td>
                        <td className="num">{inr(w.kg, 3)}</td>
                        <td className="num">{inr(w.kg * c.quantity, 3)}</td>
                      </tr>
                    ))}
                    <tr><td className="strong">Weight per box</td><td className="num strong">{inr(c.weightPerBox, 3)}</td><td className="num strong">{inr(c.totalWeight, 3)}</td></tr>
                  </tbody>
                </table>
                <p className="note" style={{ marginTop: 6 }}>Panels/foam/custom pieces = cut-area × thickness × density. Profiles = ft × kg/ft. Accessories = qty × per-unit weight. Density and kg/ft values come from Settings (sections C, D, E, F, G, H). Section I "Additional Fixed Weights" is added on top.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function PieceTable({ layer }) {
  return (
    <table className="ic-tbl">
      <thead><tr><th>Panel</th><th className="num">Piece (mm)</th><th className="num">Cut (mm)</th><th className="num">Qty</th><th className="num">Pcs/sheet</th><th className="num">₹/piece</th><th className="num">Category total</th></tr></thead>
      <tbody>
        {layer.rows.map(r => (
          <tr key={r.key}>
            <td>{r.label}</td>
            <td className="num">{inr(r.a, 0)}×{inr(r.b, 0)}</td>
            <td className="num">{inr(r.cutA, 0)}×{inr(r.cutB, 0)}</td>
            <td className="num">{r.qty}</td>
            <td className="num">{r.fit}</td>
            <td className="num">{inr(r.costPerPiece, 0)}</td>
            <td className="num strong">{inr(r.cost, 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
