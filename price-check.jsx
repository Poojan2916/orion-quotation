/* ============================================================
   Price Check — margin analysis & scenario projector
   ------------------------------------------------------------
   Reads only saved quotes. No external service. Surfaces:
     • Margin distribution across all saved quotes
     • Per-quote table: cost basis vs grand total vs margin %
     • Top materials / foam types by frequency
     • +5 / +10 / +15 % scenario projector (effect on grand total
       if the final margin were raised that many points)
   Pure analysis. Does not edit any quote — opens them via the
   same row-click handler as the dashboard.
   ============================================================ */

function PriceCheck({ quotes, onOpen }) {
  const [bumpPts, setBumpPts] = useState(5);

  // Enrich each saved quote with its calc.
  const enriched = useMemo(() => quotes.map(q => {
    const c = calcQuote(q);
    return {
      id: q.id,
      quoteNo: q.quoteNo,
      date: q.date,
      status: q.status,
      customer: q.customer && (q.customer.company || q.customer.name) || "—",
      material: q.acp && q.acp.material || "—",
      product: q.product && q.product.name || "—",
      cost: c.beforeFinalMargin,                       // everything before final margin (incl. shipping)
      marginPct: c.finalMarginPercent,
      marginValue: c.finalMarginValue,
      revenuePreGst: c.totalBeforeGst,
      grand: c.grand,
    };
  }), [quotes]);

  // Quick stats
  const totalQuotes = enriched.length;
  const totalCost = enriched.reduce((s, e) => s + e.cost, 0);
  const totalGrand = enriched.reduce((s, e) => s + e.grand, 0);
  const totalMarginValue = enriched.reduce((s, e) => s + e.marginValue, 0);
  const avgMarginPct = totalQuotes ? (enriched.reduce((s, e) => s + e.marginPct, 0) / totalQuotes) : 0;

  // Margin distribution buckets
  const buckets = [
    { lo: 20, hi: 29, label: "20–29%" },
    { lo: 30, hi: 39, label: "30–39%" },
    { lo: 40, hi: 49, label: "40–49%" },
    { lo: 50, hi: 59, label: "50–59%" },
    { lo: 60, hi: 69, label: "60–69%" },
    { lo: 70, hi: 80, label: "70–80%" },
  ];
  const dist = buckets.map(b => ({ ...b, count: enriched.filter(e => e.marginPct >= b.lo && e.marginPct <= b.hi).length }));
  const maxBucketCount = Math.max(1, ...dist.map(d => d.count));

  // Top materials (panel + product names)
  const matCount = {};
  enriched.forEach(e => { matCount[e.material] = (matCount[e.material] || 0) + 1; });
  const topMaterials = Object.keys(matCount).map(k => ({ name: k, count: matCount[k] })).sort((a, b) => b.count - a.count).slice(0, 5);

  // Low-margin watch list (below average margin AND above-median grand total)
  const sortedByGrand = [...enriched].sort((a, b) => a.grand - b.grand);
  const medianGrand = sortedByGrand.length ? sortedByGrand[Math.floor(sortedByGrand.length / 2)].grand : 0;
  const lowMargin = enriched
    .filter(e => e.marginPct < avgMarginPct && e.grand > medianGrand)
    .sort((a, b) => a.marginPct - b.marginPct)
    .slice(0, 5);

  // Quote-by-quote table sorted by margin % ascending (worst first)
  const sortedQuotes = [...enriched].sort((a, b) => a.marginPct - b.marginPct);

  // Scenario projection: bumping final margin by `bumpPts` percentage points,
  // for every quote whose current margin can absorb the bump (capped at 80%).
  const projection = enriched.map(e => {
    const newPct = Math.min(80, e.marginPct + bumpPts);
    const ptsApplied = newPct - e.marginPct;
    // beforeFinalMargin is cost-side and does not change. New margin amount + new totals:
    const newMarginValue = e.cost * newPct / 100;
    const deltaMargin = newMarginValue - e.marginValue;
    const newRevPreGst = e.cost + newMarginValue;
    const newGrand = newRevPreGst * (1 + (SETTINGS.gstPercent || 18) / 100);
    return { ...e, newPct, ptsApplied, newMarginValue, deltaMargin, newRevPreGst, newGrand };
  });
  const totalNewGrand = projection.reduce((s, p) => s + p.newGrand, 0);
  const totalDeltaMargin = projection.reduce((s, p) => s + p.deltaMargin, 0);
  const totalDeltaGrand = totalNewGrand - totalGrand;

  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  if (totalQuotes === 0) {
    return (
      <div className="container">
        <div className="page-head">
          <div>
            <div className="eyebrow">Orion Flexipack</div>
            <h1>Price Check</h1>
            <div className="sub">Margin analysis and pricing-scenario projections across your saved quotations.</div>
          </div>
        </div>
        <div className="card">
          <div className="empty">
            <Icon name="file" />
            <h3>No saved quotations yet</h3>
            <p>Once you create and save a few quotations, this view will show margin distribution, low-margin watch-list, and scenario projections.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Orion Flexipack</div>
          <h1>Price Check</h1>
          <div className="sub">Margin analysis and pricing-scenario projections across {totalQuotes} saved quotation{totalQuotes === 1 ? "" : "s"}.</div>
        </div>
      </div>

      {/* Top-line stats */}
      <div className="stat-grid">
        <div className="card stat">
          <div className="label">Average Margin</div>
          <div className="value">{avgMarginPct.toFixed(1)}%</div>
          <div className="delta">across {totalQuotes} quote{totalQuotes === 1 ? "" : "s"}</div>
        </div>
        <div className="card stat">
          <div className="label">Total Cost Basis</div>
          <div className="value"><small>₹</small>{inrShort(totalCost)}</div>
          <div className="delta">before margin &amp; GST</div>
        </div>
        <div className="card stat">
          <div className="label">Total Margin Earned</div>
          <div className="value"><small>₹</small>{inrShort(totalMarginValue)}</div>
          <div className="delta">across all quotes (pre-GST)</div>
        </div>
        <div className="card stat">
          <div className="label">Total Quoted Value</div>
          <div className="value"><small>₹</small>{inrShort(totalGrand)}</div>
          <div className="delta">incl. {SETTINGS.gstPercent}% GST</div>
        </div>
      </div>

      {/* Margin distribution + top materials side by side */}
      <div className="grid grid-2" style={{ gap: 16, marginTop: 18 }}>
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Margin Distribution</h3>
          {dist.map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 70, fontSize: 12, color: "var(--ink-2)", fontFamily: "var(--font-mono, monospace)" }}>{b.label}</div>
              <div style={{ flex: 1, height: 18, background: "var(--surface-2, #f1f3f7)", borderRadius: 4, overflow: "hidden" }}>
                <div style={{ width: ((b.count / maxBucketCount) * 100) + "%", height: "100%", background: "linear-gradient(90deg, var(--navy), var(--red))", transition: "width 200ms" }} />
              </div>
              <div style={{ width: 30, textAlign: "right", fontWeight: 600 }}>{b.count}</div>
            </div>
          ))}
          <p className="note" style={{ marginTop: 12 }}>How many of your saved quotes fall into each final-margin band.</p>
        </div>

        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ marginTop: 0, marginBottom: 14 }}>Top Panel Materials</h3>
          {topMaterials.length === 0 ? (
            <p className="note">No data yet.</p>
          ) : topMaterials.map(m => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1, fontWeight: 500 }}>{m.name}</div>
              <div style={{ width: 120, height: 12, background: "var(--surface-2, #f1f3f7)", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: ((m.count / Math.max(1, topMaterials[0].count)) * 100) + "%", height: "100%", background: "var(--navy)" }} />
              </div>
              <div style={{ width: 30, textAlign: "right", fontWeight: 600 }}>{m.count}</div>
            </div>
          ))}
          <p className="note" style={{ marginTop: 12 }}>Frequency across all saved quotations.</p>
        </div>
      </div>

      {/* Low-margin watch list */}
      {lowMargin.length > 0 && (
        <div className="card" style={{ marginTop: 18, padding: 18 }}>
          <h3 style={{ marginTop: 0 }}>Watch List — high-value quotes with below-average margin</h3>
          <p className="note" style={{ marginTop: -6, marginBottom: 12 }}>These quotes are priced above your median grand total but earn below your average margin of {avgMarginPct.toFixed(1)}% — likely candidates for a margin review on the next similar order.</p>
          <div className="table-wrap">
            <table className="tbl">
              <thead><tr><th>Quote No.</th><th>Customer</th><th>Material</th><th className="num">Cost Basis</th><th className="num">Margin %</th><th className="num">Grand Total</th><th></th></tr></thead>
              <tbody>
                {lowMargin.map(e => (
                  <tr key={e.id} className="quote-row" onClick={() => onOpen(e.id)}>
                    <td><span className="qno">{e.quoteNo}</span></td>
                    <td>{e.customer}</td>
                    <td>{e.material}</td>
                    <td className="num mono">₹{inr(e.cost, 0)}</td>
                    <td className="num" style={{ color: "var(--red)", fontWeight: 600 }}>{e.marginPct}%</td>
                    <td className="num total"><Money value={e.grand} dp={0} /></td>
                    <td><button className="btn btn-subtle btn-sm" onClick={(ev) => { ev.stopPropagation(); onOpen(e.id); }} title="Open quote"><Icon name="edit" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Scenario projector */}
      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 4 }}>
          <h3 style={{ margin: 0 }}>Pricing Scenario</h3>
          <div className="segmented" style={{ display: "inline-flex" }}>
            {[5, 10, 15].map(p => (
              <button key={p} className={bumpPts === p ? "active" : ""} onClick={() => setBumpPts(p)}>+{p} pts</button>
            ))}
          </div>
        </div>
        <p className="note" style={{ marginBottom: 12 }}>If every saved quotation's final margin was raised by <b>{bumpPts} percentage points</b> (capped at 80%), the totals would shift like this:</p>

        <div className="grid grid-3" style={{ gap: 12, marginBottom: 16 }}>
          <div style={{ padding: 12, background: "var(--surface-2, #f1f3f7)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>Extra Margin (pre-GST)</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)", marginTop: 4 }}>₹{inrShort(totalDeltaMargin)}</div>
          </div>
          <div style={{ padding: 12, background: "var(--surface-2, #f1f3f7)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>Extra Grand Total</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--red)", marginTop: 4 }}>₹{inrShort(totalDeltaGrand)}</div>
          </div>
          <div style={{ padding: 12, background: "var(--surface-2, #f1f3f7)", borderRadius: 6 }}>
            <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>New Total Quoted Value</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>₹{inrShort(totalNewGrand)}</div>
          </div>
        </div>

        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Quote No.</th><th>Customer</th><th className="num">Cost</th><th className="num">Current</th><th className="num">New</th><th className="num">Δ Grand</th></tr></thead>
            <tbody>
              {projection.slice(0, 12).map(p => (
                <tr key={p.id} className="quote-row" onClick={() => onOpen(p.id)}>
                  <td><span className="qno">{p.quoteNo}</span></td>
                  <td>{p.customer}</td>
                  <td className="num mono">₹{inr(p.cost, 0)}</td>
                  <td className="num mono">{p.marginPct}% → ₹{inrShort(p.grand)}</td>
                  <td className="num mono"><b>{p.newPct}%</b> → ₹{inrShort(p.newGrand)}</td>
                  <td className="num" style={{ color: p.deltaMargin > 0 ? "var(--red)" : "var(--ink-4)", fontWeight: 600 }}>{p.deltaMargin > 0 ? "+" : ""}₹{inrShort(p.newGrand - p.grand)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {projection.length > 12 && <p className="note" style={{ marginTop: 8 }}>Showing first 12 of {projection.length} quotes. Full margin table below.</p>}
      </div>

      {/* Full quote table sorted by margin */}
      <div className="card" style={{ marginTop: 18, padding: 18 }}>
        <h3 style={{ marginTop: 0 }}>All Quotes by Margin (lowest first)</h3>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Quote No.</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Material</th>
                <th className="num">Cost Basis</th>
                <th className="num">Margin %</th>
                <th className="num">Margin ₹</th>
                <th className="num">Grand Total</th>
              </tr>
            </thead>
            <tbody>
              {sortedQuotes.map(e => (
                <tr key={e.id} className="quote-row" onClick={() => onOpen(e.id)}>
                  <td><span className="qno">{e.quoteNo}</span></td>
                  <td>{e.customer}</td>
                  <td className="mono" style={{ color: "var(--ink-2)", fontSize: 13 }}>{fmtDate(e.date)}</td>
                  <td>{e.material}</td>
                  <td className="num mono">₹{inr(e.cost, 0)}</td>
                  <td className="num" style={{ fontWeight: 600, color: e.marginPct < avgMarginPct ? "var(--red)" : "var(--navy)" }}>{e.marginPct}%</td>
                  <td className="num mono">₹{inr(e.marginValue, 0)}</td>
                  <td className="num total"><Money value={e.grand} dp={0} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
