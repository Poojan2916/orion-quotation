/* ============================================================
   Live Calculation Summary — sticky panel
   ============================================================ */

function CalcSummary({ quote, onSave, onPreview }) {
  const c = useMemo(() => calcQuote(quote), [quote]);

  const panelRows = [
    { k: c.acp.main.material + " panels", v: c.acp.main.cost, dot: "#1f4d79", sub: c.acp.main.totalSheets.toFixed(2) + " sheets" },
  ];
  if (c.acp.abs) {
    panelRows.push({ k: "ABS Silver layer", v: c.acp.abs.cost, dot: "#8a6fd0", sub: c.acp.abs.totalSheets.toFixed(2) + " sheets" });
    panelRows.push({ k: "= Total panel cost", v: c.acp.cost, isTotal: true });
  }

  const rows = [
    ...panelRows,
    { k: "Foam inserts", v: c.foamCost,   dot: "#d8232a", sub: c.foam.layers.length + " layer" + (c.foam.layers.length === 1 ? "" : "s") },
    ...(c.customFoamCost > 0 ? [{ k: "Custom foam add-ons", v: c.customFoamCost, dot: "#c98a1e", sub: c.customFoam.rows.length + " size" + (c.customFoam.rows.length === 1 ? "" : "s") }] : []),
    { k: "Profiles", v: c.profileCost, dot: "#7a5cc0", sub: "MF + Edge" + (c.extrasCost > 0 ? " + Extras" : "") },
    { k: "Accessories & hardware",  v: c.accCost,    dot: "#1f8a52", sub: quote.accessories.length + " item" + (quote.accessories.length === 1 ? "" : "s") },
    { k: "Labour",       v: c.labourCost, dot: "#5b7088", sub: "incl. margin" },
  ];

  const shipLabel = SHIPPING_TYPES.find(s => s.key === c.shipping.type).label;

  return (
    <div className="card summary">
      <div className="sum-head">
        <div className="label">Calculation Summary</div>
        <h3>Cost Breakdown</h3>
      </div>
      <div className="sum-rows">
        {rows.map(r => r.isTotal ? (
          <div className="sum-row sum-row-total" key={r.k}>
            <span className="k">{r.k}</span>
            <span className="v"><Money value={r.v} dp={0} /></span>
          </div>
        ) : (
          <div className="sum-row" key={r.k}>
            <span className="k"><span className="dot" style={{ background: r.dot }} />{r.k}</span>
            <span style={{ textAlign: "right" }}>
              <span className="v"><Money value={r.v} dp={0} /></span>
              <div className="sub">{r.sub}</div>
            </span>
          </div>
        ))}
      </div>

      <div className="sum-divider" />
      <div className="sum-subtotal">
        <span className="k">Subtotal / box</span>
        <span className="v"><Money value={c.subtotalPerBox} /></span>
      </div>
      <div className="sum-gst">
        <span>× {c.quantity} box{c.quantity === 1 ? "" : "es"}</span>
        <span className="v">₹ {inr(c.boxesTotal)}</span>
      </div>
      <div className="sum-gst">
        <span>Packaging Cost ({shipLabel})</span>
        <span className="v">₹ {inr(c.shippingValue)}</span>
      </div>
      <div className="sum-gst">
        <span>Base before final margin</span>
        <span className="v">₹ {inr(c.beforeFinalMargin)}</span>
      </div>
      <div className="sum-gst">
        <span>Final quote margin @ {c.finalMarginPercent}%</span>
        <span className="v">₹ {inr(c.finalMarginValue)}</span>
      </div>
      <div className="sum-divider" />
      <div className="sum-subtotal">
        <span className="k">Total before GST</span>
        <span className="v"><Money value={c.totalBeforeGst} /></span>
      </div>
      <div className="sum-gst">
        <span>GST @ 18%</span>
        <span className="v">₹ {inr(c.gst)}</span>
      </div>

      <div className="sum-total">
        <span className="k">Grand Total</span>
        <span className="v"><small>₹</small>{inrShort(c.grand)}</span>
      </div>

      <div style={{ padding: "0 14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={onPreview}>
          <Icon name="eye" /> Preview Quotation
        </button>
        <button className="btn btn-ghost" style={{ justifyContent: "center" }} onClick={onSave}>
          <Icon name="save" /> Save Draft
        </button>
      </div>
    </div>
  );
}
