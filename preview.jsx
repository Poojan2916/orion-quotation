/* ============================================================
   Quotation Preview — print-ready document
   ============================================================ */

function Preview({ quote, onBack, onEdit, onInternal, onDeliver }) {
  const c = useMemo(() => calcQuote(quote), [quote]);
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const cu = quote.customer;

  // Scope of supply — customer-facing names only, NO internal construction details.
  // Panels/profiles/internal hardware are still costed, but hidden from the customer quote.
  const display = quote.customerDisplay || {};
  const scope = [];
  if (display.showFoamLayers) {
    const foamLines = String(display.foamLayerLines != null ? display.foamLayerLines : (display.foamLayerName || "Custom foam insert"))
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);
    scope.push(...(foamLines.length ? foamLines : ["Custom foam insert"]));
  }

  // Accessories & hardware — show only customer-friendly items.
  const accItems = customerVisibleAccessoryRows(c.acc.rows).map(a => ({ name: a.name, qty: a.qty, unit: a.unit }));

  return (
    <div className="container">
      <div className="preview-bar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" /> Edit</button>
        <div className="spacer" />
        <div className="view-toggle">
          <button className="active">Customer</button>
          <button onClick={onInternal}>Internal</button>
        </div>
        <span className="tag-chip">{quote.quoteNo}</span>
        {onDeliver && <button className="btn btn-primary" onClick={onDeliver}><Icon name="send" /> Finalize &amp; Deliver</button>}
        <button className="btn btn-red" onClick={() => window.print()}><Icon name="download" /> Customer PDF</button>
      </div>

      <div className="doc-wrap">
        <div className="doc" id="quotation-doc">
          <div className="doc-inner">

            {/* Header */}
            <div className="doc-head">
              <div className="logo">
                <img src="assets/orion-logo.png" alt="Orion Flexipack" />
                <div className="tag">
                  {SETTINGS.company.address}<br />
                  GSTIN {SETTINGS.company.gstin} &nbsp;|&nbsp; {SETTINGS.company.phone}<br />
                  {SETTINGS.company.email}
                </div>
              </div>
              <div className="qtitle">
                <h2>QUOTATION</h2>
                <div className="meta">
                  No. <b>{quote.quoteNo}</b><br />
                  Date: <b>{fmtDate(quote.date)}</b><br />
                  Valid till: {fmtDate(addDays(quote.date, toNumber(quote.validityDays, 15)))}
                </div>
              </div>
            </div>

            {/* Parties */}
            <div className="doc-parties">
              <div className="blk">
                <h4>Quotation For</h4>
                <div className="name">{cu.company || cu.name || "Customer Name"}</div>
                <div className="lines">
                  {cu.company && cu.name && <>{cu.name}<br /></>}
                  {cu.address && <>{cu.address}<br /></>}
                  {cu.gstin && <span className="mono">GSTIN {cu.gstin}<br /></span>}
                  {cu.phone && <>{cu.phone}</>}{cu.phone && cu.email && " · "}{cu.email}
                </div>
              </div>
              <div className="blk">
                <h4>Product</h4>
                <div className="name">{quote.product.name}</div>
                <div className="lines">
                  {quote.product.ref && <span className="mono">Ref: {quote.product.ref}</span>}
                </div>
              </div>
            </div>

            {/* Specs */}
            <div className="doc-section-title">Case Specification</div>
            <div className="spec-grid">
              <div className="spec"><div className="l">Length</div><div className="v">{quote.caseDims.length} mm</div></div>
              <div className="spec"><div className="l">Width</div><div className="v">{quote.caseDims.width} mm</div></div>
              <div className="spec"><div className="l">Total Height (H + H1)</div><div className="v">{(Number(quote.caseDims.height) || 0) + (Number(quote.caseDims.lidHeight) || 0)} mm</div></div>
              <div className="spec"><div className="l">Panel Material</div><div className="v">{c.acp.material}</div></div>
              <div className="spec"><div className="l">Quantity</div><div className="v">{c.quantity} box{c.quantity === 1 ? "" : "es"}</div></div>
              {c.weightPerBox > 0 && <div className="spec"><div className="l">Approx. Weight</div><div className="v">{inr(c.totalWeight, 2)} kg</div></div>}
            </div>

            {/* Scope of supply (no per-item pricing) */}
            {(scope.length > 0 || accItems.length > 0) && (
              <>
                <div className="doc-section-title">Scope of Supply</div>
                <ul className="scope-list">
                  {scope.map((s, i) => <li key={i}>{s}</li>)}
                  {accItems.length > 0 && (
                    <li>
                      <span className="scope-acc-head">Accessories &amp; hardware</span>
                      <ul>
                        {accItems.map((a, i) => (
                          <li key={i}>{a.name} <span className="qty">× {a.qty}{a.unit === "ft" ? " ft" : ""}</span></li>
                        ))}
                      </ul>
                    </li>
                  )}
                </ul>
              </>
            )}

            <div className="doc-totals">
              <table>
                <tbody>
                  <tr><td className="k">Subtotal / box</td><td className="v">₹ {inr(c.subtotalPerBox)}</td></tr>
                  <tr><td className="k">× {c.quantity} box{c.quantity === 1 ? "" : "es"}</td><td className="v">₹ {inr(c.boxesTotal)}</td></tr>
                  {c.shippingValue > 0 && <tr><td className="k">Shipping ({SHIPPING_TYPES.find(s => s.key === c.shipping.type).label})</td><td className="v">₹ {inr(c.shippingValue)}</td></tr>}
                  <tr><td className="k">Total before GST</td><td className="v">₹ {inr(c.totalBeforeGst)}</td></tr>
                  <tr><td className="k">GST @ {SETTINGS.gstPercent}%</td><td className="v">₹ {inr(c.gst)}</td></tr>
                  <tr className="grand"><td className="k">Grand Total</td><td className="v">₹ {inr(c.grand)}</td></tr>
                </tbody>
              </table>
            </div>

            {/* Payment + validity + terms */}
            <div className="doc-terms">
              <div className="doc-section-title" style={{ border: "none", margin: "0 0 2px" }}>Payment &amp; Validity</div>
              <ol>
                <li>Payment terms: {quote.paymentTerms}</li>
                <li>This quotation is valid for {toNumber(quote.validityDays, 15)} days from the date of issue ({fmtDate(addDays(quote.date, toNumber(quote.validityDays, 15)))}).</li>
              </ol>
              <div className="doc-section-title" style={{ border: "none", margin: "14px 0 2px" }}>Terms &amp; Conditions</div>
              <ol>
                {quote.terms.map((t, i) => <li key={i}>{t}</li>)}
              </ol>
            </div>

            {/* Footer */}
            <div className="doc-foot">
              <div className="thanks">
                Thank you for your enquiry.<br />
                We look forward to your valued order.
              </div>
              <div className="sign">
                <div className="line" />
                <div className="who">For {SETTINGS.company.name}</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
