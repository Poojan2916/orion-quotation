/* ============================================================
   BOM / Work Order Sheet — production use only, no prices
   ============================================================ */

function BomSheet({ quote, onBack, onEdit, onCustomer, onInternal }) {
  const c = useMemo(() => calcQuote(quote), [quote]);

  const fmtDate = (ds) => {
    if (!ds) return "—";
    return new Date(ds + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const d  = quote.caseDims;
  const L  = num(d.length),    W  = num(d.width);
  const H  = num(d.height),    H1 = num(d.lidHeight);

  // OD formula (Cosanta standard: +20L / +45W / +30H)
  const OD_L = L + 20, OD_W = W + 45, OD_H = (H + H1) + 30;

  // Panel cutting — Cosanta-style codes + descriptions
  const CODES = { LxH: "BLxH", LxH1: "TLxH", WxH: "BWxH", WxH1: "TWxH", LxW: "TB" };
  const DESCS = {
    LxH:  "Body long × height",
    LxH1: "Lid long × height",
    WxH:  "Body short × height",
    WxH1: "Lid short × height",
    LxW:  "Top / bottom base",
  };

  const mainRows = (c.acp.main.rows || []).filter(r => r.qty > 0);
  const absRows  = c.acp.abs ? (c.acp.abs.rows || []).filter(r => r.qty > 0) : [];

  const totalMainSqft = mainRows.reduce((s, r) => s + (r.a * r.b * r.qty) / SQMM_PER_SQFT, 0);
  const totalAbsSqft  = absRows.reduce((s,  r) => s + (r.a * r.b * r.qty) / SQMM_PER_SQFT, 0);

  // Profiles
  const mf     = c.profiles.mf;
  const edge   = c.profiles.edge;
  const extras = ((c.profiles.extras && c.profiles.extras.rows) || []).filter(r => r.ft > 0);

  // Foam
  const foamLayers     = c.foam.layers.filter(l => (l.rows || []).some(r => r.qty > 0));
  const customFoamRows = (c.customFoam.rows || []).filter(r => num(r.qty) > 0);

  // Accessories (qty > 0 only)
  const accRows = (c.acc.rows || []).filter(r => num(r.qty) > 0);
  function accCat(name) {
    const n = (name || "").toLowerCase();
    if (n.includes("corner"))                                            return "Corner";
    if (n.includes("lock"))                                              return "Lock";
    if (n.includes("hinge"))                                             return "Hinges";
    if (n.includes("handle"))                                            return "Handle";
    if (n.includes("wheel"))                                             return "Wheels";
    if (n.includes("trolley"))                                           return "Trolleys";
    if (n.includes("bush") || n.includes("leg") || n.includes("foot"))  return "Bush / Foot";
    return "Extra";
  }

  const qty = c.quantity;

  return (
    <div className="container">

      {/* ── Top bar ──────────────────────────────────────────────── */}
      <div className="preview-bar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" /> Edit</button>
        <div className="spacer" />
        <div className="view-toggle">
          <button onClick={onCustomer}>Customer</button>
          <button onClick={onInternal}>Internal</button>
          <button className="active">BOM</button>
        </div>
        <span className="tag-chip" style={{ background: "var(--surface-2)", color: "var(--navy)" }}>Production Work Order</span>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="download" /> Print WO</button>
      </div>

      {/* ── Document ─────────────────────────────────────────────── */}
      <div className="doc-wrap">
        <div className="doc bom-doc" id="bom-doc">
          <div className="doc-inner">

            {/* Header */}
            <div className="bom-head">
              <div className="bom-logo-wrap">
                <img src="assets/orion-logo.png" alt="Orion Flexipack" />
              </div>
              <div className="bom-title-wrap">
                <h2>Work Order + BOM</h2>
                <div className="bom-tag">Production use · No pricing</div>
              </div>
            </div>

            {/* WO meta */}
            <div className="bom-meta-grid">
              <div><span>WO / Quote No.</span><b>{quote.quoteNo}</b></div>
              <div><span>Customer</span><b>{quote.customer.company || quote.customer.name || "—"}</b></div>
              <div><span>Product</span><b>{quote.product.name || "—"}</b></div>
              <div><span>Date</span><b>{fmtDate(quote.date)}</b></div>
              <div><span>Quantity</span><b>{qty} box{qty === 1 ? "" : "es"}</b></div>
              {quote.product.ref && <div><span>Drawing Ref</span><b className="mono">{quote.product.ref}</b></div>}
            </div>

            {/* ── 1. Case Geometry ─────────────────────────────────── */}
            <div className="bom-section-title">1 · Case Geometry</div>
            <table className="bom-tbl bom-geo-tbl">
              <thead>
                <tr>
                  <th></th>
                  <th className="num">Length</th>
                  <th className="num">Width</th>
                  <th className="num">Total H</th>
                  <th className="num">Body H</th>
                  <th className="num">Lid H</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>ID (usable)</b></td>
                  <td className="num mono">{L} mm</td>
                  <td className="num mono">{W} mm</td>
                  <td className="num mono">{H + H1} mm</td>
                  <td className="num mono">{H} mm</td>
                  <td className="num mono">{H1} mm</td>
                </tr>
                <tr>
                  <td><b>OD (outer)</b></td>
                  <td className="num mono">{OD_L} mm</td>
                  <td className="num mono">{OD_W} mm</td>
                  <td className="num mono">{OD_H} mm</td>
                  <td className="num mono">—</td>
                  <td className="num mono">—</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" className="bom-tol-note">All dims in mm · Tolerance ±2mm · OD = ID +20L / +45W / +30H</td>
                  <td className="num" colSpan="3" style={{ color: "var(--green, #1a7a1a)" }}>
                    {H} + {H1} = {H + H1} ✓
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* ── 2. Panel Cutting List ────────────────────────────── */}
            <div className="bom-section-title">
              2 · Panel Cutting List — {c.acp.main.material} {num(quote.acp.thickness)}mm · cut margin +{c.acp.cut} mm
            </div>
            <table className="bom-tbl">
              <thead>
                <tr>
                  <th style={{ width: 66 }}>Code</th>
                  <th>Description</th>
                  <th className="num">Length (mm)</th>
                  <th className="num">H / W (mm)</th>
                  <th className="num">Pcs</th>
                  <th className="num">Area (sqft)</th>
                </tr>
              </thead>
              <tbody>
                {mainRows.map(r => (
                  <tr key={r.key}>
                    <td className="mono bom-code">{CODES[r.key] || r.key}</td>
                    <td>{DESCS[r.key] || r.key}</td>
                    <td className="num mono">{r.a}</td>
                    <td className="num mono">{r.b}</td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{(r.a * r.b * r.qty / SQMM_PER_SQFT).toFixed(3)}</td>
                  </tr>
                ))}
                {absRows.map(r => (
                  <tr key={"abs-" + r.key} className="bom-abs-row">
                    <td className="mono bom-code">{CODES[r.key] || r.key}</td>
                    <td>ABS Silver — {DESCS[r.key] || r.key}</td>
                    <td className="num mono">{r.a}</td>
                    <td className="num mono">{r.b}</td>
                    <td className="num">{r.qty}</td>
                    <td className="num">{(r.a * r.b * r.qty / SQMM_PER_SQFT).toFixed(3)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5"><b>Total {c.acp.main.material} panel area</b></td>
                  <td className="num"><b>{totalMainSqft.toFixed(3)} sqft</b></td>
                </tr>
                {absRows.length > 0 && (
                  <tr>
                    <td colSpan="5"><b>Total ABS Silver area</b></td>
                    <td className="num"><b>{totalAbsSqft.toFixed(3)} sqft</b></td>
                  </tr>
                )}
              </tfoot>
            </table>

            {/* ── 3. Profile Lengths ───────────────────────────────── */}
            <div className="bom-section-title">3 · Profile Lengths</div>
            <table className="bom-tbl">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Profile Name</th>
                  <th className="num">Exact (ft)</th>
                  <th className="num">Required ↑ceil (ft)</th>
                </tr>
              </thead>
              <tbody>
                {mf.ft > 0 && (
                  <tr>
                    <td>MF Profile Set</td>
                    <td>{mf.set || "—"}</td>
                    <td className="num">{mf.ftExact.toFixed(2)}</td>
                    <td className="num bom-ft">{mf.ft}</td>
                  </tr>
                )}
                {edge.ft > 0 && (
                  <tr>
                    <td>Edge Profile</td>
                    <td>{edge.option || "—"}</td>
                    <td className="num">{edge.ftExact.toFixed(2)}</td>
                    <td className="num bom-ft">{edge.ft}</td>
                  </tr>
                )}
                {extras.map((r, i) => (
                  <tr key={i}>
                    <td>Profile Extra</td>
                    <td>{r.name}</td>
                    <td className="num">{(r.ftExact || 0).toFixed(2)}</td>
                    <td className="num bom-ft">{r.ft}</td>
                  </tr>
                ))}
                {mf.ft === 0 && edge.ft === 0 && extras.length === 0 && (
                  <tr><td colSpan="4" className="bom-empty">No profiles configured</td></tr>
                )}
              </tbody>
            </table>

            {/* ── 4. Bill of Materials ─────────────────────────────── */}
            <div className="bom-section-title">4 · Bill of Materials</div>
            <table className="bom-tbl bom-main-tbl">
              <thead>
                <tr>
                  <th style={{ width: 86 }}>Category</th>
                  <th>Item</th>
                  <th className="num">Unit</th>
                  <th className="num">Qty / box</th>
                  <th className="num">Total × {qty}</th>
                </tr>
              </thead>
              <tbody>

                {/* Panel */}
                <tr className="bom-cat-row"><td colSpan="5">Panel</td></tr>
                <tr>
                  <td></td>
                  <td>{c.acp.main.material} {num(quote.acp.thickness)}mm</td>
                  <td className="num">sqft</td>
                  <td className="num">{totalMainSqft.toFixed(2)}</td>
                  <td className="num">{(totalMainSqft * qty).toFixed(2)}</td>
                </tr>
                {c.acp.abs && (
                  <tr>
                    <td></td>
                    <td>ABS Silver {num(quote.acp && quote.acp.absLayer && quote.acp.absLayer.thickness) || 2}mm</td>
                    <td className="num">sqft</td>
                    <td className="num">{totalAbsSqft.toFixed(2)}</td>
                    <td className="num">{(totalAbsSqft * qty).toFixed(2)}</td>
                  </tr>
                )}

                {/* Profile */}
                <tr className="bom-cat-row"><td colSpan="5">Profile</td></tr>
                {mf.ft > 0 && (
                  <tr>
                    <td></td>
                    <td>{mf.set || "MF Profile Set"}</td>
                    <td className="num">ft</td>
                    <td className="num">{mf.ft}</td>
                    <td className="num">{mf.ft * qty}</td>
                  </tr>
                )}
                {edge.ft > 0 && (
                  <tr>
                    <td></td>
                    <td>{edge.option || "Edge Profile"}</td>
                    <td className="num">ft</td>
                    <td className="num">{edge.ft}</td>
                    <td className="num">{edge.ft * qty}</td>
                  </tr>
                )}
                {extras.map((r, i) => (
                  <tr key={i}>
                    <td></td>
                    <td>{r.name}</td>
                    <td className="num">ft</td>
                    <td className="num">{r.ft}</td>
                    <td className="num">{r.ft * qty}</td>
                  </tr>
                ))}
                {mf.ft === 0 && edge.ft === 0 && extras.length === 0 && (
                  <tr><td></td><td colSpan="4" className="bom-empty">No profiles</td></tr>
                )}

                {/* Foam */}
                {(foamLayers.length > 0 || customFoamRows.length > 0) && (
                  <tr className="bom-cat-row"><td colSpan="5">Foam</td></tr>
                )}
                {foamLayers.map((l, i) => (
                  <tr key={i}>
                    <td></td>
                    <td>{l.type} {l.thk}mm</td>
                    <td className="num">pc</td>
                    <td className="num">1</td>
                    <td className="num">{qty}</td>
                  </tr>
                ))}
                {customFoamRows.map((r, i) => (
                  <tr key={"cfa" + i}>
                    <td></td>
                    <td>
                      {r.name}
                      <span className="mono bom-dim-note"> ({r.type} {num(r.thickness)}mm · {num(r.length)}×{num(r.width)} mm)</span>
                    </td>
                    <td className="num">pc</td>
                    <td className="num">{num(r.qty)}</td>
                    <td className="num">{num(r.qty) * qty}</td>
                  </tr>
                ))}

                {/* Hardware */}
                {accRows.length > 0 && (
                  <tr className="bom-cat-row"><td colSpan="5">Hardware &amp; Accessories</td></tr>
                )}
                {accRows.map((r, i) => (
                  <tr key={i}>
                    <td className="bom-acc-cat">{accCat(r.name)}</td>
                    <td>{r.name}</td>
                    <td className="num">{r.unit}</td>
                    <td className="num">{num(r.qty)}</td>
                    <td className="num">{num(r.qty) * qty}</td>
                  </tr>
                ))}

                {/* Production */}
                <tr className="bom-cat-row"><td colSpan="5">Production</td></tr>
                <tr>
                  <td></td>
                  <td>Labour</td>
                  <td className="num">—</td>
                  <td className="num">1</td>
                  <td className="num">{qty}</td>
                </tr>
                {quote.shipping && quote.shipping !== "none" && (
                  <tr>
                    <td></td>
                    <td>Packaging / Shipping box</td>
                    <td className="num">—</td>
                    <td className="num">1</td>
                    <td className="num">{qty}</td>
                  </tr>
                )}

              </tbody>
            </table>

            {/* Weight summary */}
            {c.weightPerBox > 0 && (
              <div className="bom-weight">
                <span>Approx. case weight:</span>
                <b>{inr(c.weightPerBox, 3)} kg / box</b>
                {qty > 1 && (
                  <><span className="bom-dot">·</span><span>Total batch:</span><b>{inr(c.totalWeight, 3)} kg</b></>
                )}
              </div>
            )}

            {/* Sign-off row */}
            <div className="bom-signoff">
              <div><span>Prepared by</span><div className="bom-line" /></div>
              <div><span>Checked by</span><div className="bom-line" /></div>
              <div><span>Date</span><div className="bom-line" /></div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
