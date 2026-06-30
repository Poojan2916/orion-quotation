/* ============================================================
   WO / Work Order Sheet — production use only, no prices
   Cosanta WO logic active when ACP thickness is 2 / 4 / 8 mm.
   ============================================================ */

function BomSheet({ quote, onBack, onEdit, onCustomer, onInternal }) {
  const c = useMemo(() => calcQuote(quote), [quote]);

  const fmtDate = (ds) => {
    if (!ds) return "—";
    return new Date(ds + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const d    = quote.caseDims;
  const ID_L = num(d.length);
  const ID_W = num(d.width);
  const BH   = num(d.height);      // body height
  const TH   = num(d.lidHeight);   // lid height
  const ID_H = BH + TH;            // total closed height
  const OD_L = ID_L + 20;
  const OD_W = ID_W + 45;
  const OD_H = ID_H + 30;

  // Case-type detection
  const thickness  = num(quote.acp && quote.acp.thickness);
  const edgeOpt    = ((quote.profiles && quote.profiles.edge && quote.profiles.edge.option) || "").toLowerCase();
  const isDL       = edgeOpt.includes("double angle");
  const isPlywood  = ((quote.acp && quote.acp.material) || "").toLowerCase().includes("plywood");

  let caseType = null;
  if (isPlywood || thickness === 8)  caseType = "9MM DL";
  else if (thickness === 4 && isDL)  caseType = "4MM DL";
  else if (thickness === 4)          caseType = "4MM R";
  else if (thickness === 2)          caseType = "2MM R";
  const isWO = caseType !== null;

  // Cosanta panel cut list
  const woPanels = (() => {
    if (!isWO) return [];
    const isR   = caseType === "4MM R" || caseType === "2MM R";
    const isDLt = caseType === "4MM DL";
    const is9   = caseType === "9MM DL";
    if (isR) return [
      { code: "BLxH", desc: "Body long x height",    L: ID_L-8, D: BH-9,    qty: 2 },
      { code: "TLxH", desc: "Lid long x height",     L: ID_L-8, D: TH-10,   qty: 2 },
      { code: "BWxH", desc: "Body short x height",   L: ID_W-8, D: BH-9,    qty: 2 },
      { code: "TWxH", desc: "Lid short x height",    L: ID_W-8, D: TH-10,   qty: 2 },
      { code: "TB",   desc: "Top / bottom base",     L: ID_L-8, D: ID_W-10, qty: 4 },
    ];
    if (isDLt) return [
      { code: "BLxH", desc: "Body long x height",    L: ID_L,   D: BH,      qty: 2 },
      { code: "TLxH", desc: "Lid long x height",     L: ID_L,   D: TH,      qty: 2 },
      { code: "BWxH", desc: "Body short x height",   L: ID_W,   D: BH,      qty: 2 },
      { code: "TWxH", desc: "Lid short x height",    L: ID_W,   D: TH,      qty: 2 },
      { code: "TB",   desc: "Top / bottom base",     L: ID_L,   D: ID_W,    qty: 2 },
    ];
    if (is9) return [
      { code: "BLxH", desc: "Body long x height",    L: ID_L+5, D: BH-1,    qty: 2 },
      { code: "TLxH", desc: "Lid long x height",     L: ID_L+5, D: TH-1,    qty: 2 },
      { code: "BWxH", desc: "Body short x height",   L: ID_W+5, D: BH-1,    qty: 2 },
      { code: "TWxH", desc: "Lid short x height",    L: ID_W+5, D: TH-1,    qty: 2 },
      { code: "TB",   desc: "Top / bottom base",     L: ID_L+5, D: ID_W+5,  qty: 2 },
    ];
    return [];
  })();
  const totalWoSqft = woPanels.reduce((s, p) => s + (p.L * p.D * p.qty) / SQMM_PER_SQFT, 0);
  const orderSqft   = Math.ceil(totalWoSqft);

  // Cosanta profile calculations
  const woProfiles = (() => {
    if (!isWO) return null;
    const isR = caseType === "4MM R" || caseType === "2MM R";
    const mOff = isR ? -22 : (caseType === "4MM DL" ? 15 : 29);
    const mProMM      = 2*(ID_L + mOff) + 2*(ID_W + mOff);
    const mProFtExact = mProMM / 304.8;
    const mProBom     = isR ? Math.ceil(mProFtExact / 0.5) * 0.5 : Math.ceil(mProFtExact);

    const roMap = { "4MM R": [-22,-22,-15,-15], "2MM R": [-22,-22,-15,-15], "4MM DL": [10,10,0,0], "9MM DL": [25,25,-1,-1] };
    const ro = roMap[caseType];
    const rProMM      = 4 * ((ID_L+ro[0]) + (ID_W+ro[1]) + (BH+ro[2]) + (TH+ro[3]));
    const rProFtExact = rProMM / 304.8;
    const rProBom     = Math.ceil(rProFtExact);

    const lPattiBom = isR ? Math.ceil(mProMM / 304.8) : 0;

    const namesMap = {
      "4MM R":  { m: "Male Profile Silver 4mm",          f: "Female Profile Silver 4mm",   r: "R Profile Silver 4mm" },
      "2MM R":  { m: "Male Profile Silver 2mm",          f: "Female Profile Silver 2mm",   r: "R Profile Without Coating 2mm" },
      "4MM DL": { m: "Double Angle Profile Silver 4mm",  f: null,                          r: null },
      "9MM DL": { m: "Female Profile 9mm (Body)",        f: "Female Profile 9mm (Lid)",    r: "Female Profile 9mm (Corner)" },
    };
    const names = namesMap[caseType];
    return { mProMM, mProFtExact, mProBom, fProBom: mProBom,
             rProMM, rProFtExact, rProBom, lPattiBom, isR, ...names };
  })();

  const woBox = isWO ? { L: OD_L + OD_W + 295, W: OD_W + OD_H + 215 } : null;

  // Regular WO fields
  const mainRows       = (c.acp.main.rows || []).filter(r => r.qty > 0);
  const absRows        = c.acp.abs ? (c.acp.abs.rows || []).filter(r => r.qty > 0) : [];
  const totalMainSqft  = mainRows.reduce((s, r) => s + (r.a * r.b * r.qty) / SQMM_PER_SQFT, 0);
  const totalAbsSqft   = absRows.reduce((s,  r) => s + (r.a * r.b * r.qty) / SQMM_PER_SQFT, 0);
  const mf     = c.profiles.mf;
  const edge   = c.profiles.edge;
  const extras = ((c.profiles.extras && c.profiles.extras.rows) || []).filter(r => r.ft > 0);
  const foamLayers     = c.foam.layers.filter(l => (l.rows || []).some(r => r.qty > 0));
  const customFoamRows = (c.customFoam.rows || []).filter(r => num(r.qty) > 0);
  const accRows        = (c.acc.rows || []).filter(r => num(r.qty) > 0);

  const CODES = { LxH: "BLxH", LxH1: "TLxH", WxH: "BWxH", WxH1: "TWxH", LxW: "TB" };
  const DESCS = { LxH: "Body long x height", LxH1: "Lid long x height", WxH: "Body short x height", WxH1: "Lid short x height", LxW: "Top / bottom base" };

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

      <div className="preview-bar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" /> Edit</button>
        <div className="spacer" />
        <div className="view-toggle">
          <button onClick={onCustomer}>Customer</button>
          <button onClick={onInternal}>Internal</button>
          <button className="active">WO</button>
        </div>
        <span className="tag-chip" style={{ background: "var(--surface-2)", color: "var(--navy)" }}>
          {isWO ? "Production WO · " + caseType : "Production Work Order"}
        </span>
        <button className="btn btn-primary" onClick={() => window.print()}><Icon name="download" /> Print WO</button>
      </div>

      <div className="doc-wrap">
        <div className="doc bom-doc" id="bom-doc">
          <div className="doc-inner">

            <div className="bom-head">
              <div className="bom-logo-wrap">
                <img src="assets/orion-logo.png" alt="Orion Flexipack" />
              </div>
              <div className="bom-title-wrap">
                <h2>Work Order</h2>
                <div className="bom-tag">
                  {isWO ? caseType + " · Cosanta formula · No pricing" : "Production use · No pricing"}
                </div>
              </div>
            </div>

            <div className="bom-meta-grid">
              <div><span>WO / Quote No.</span><b>{quote.quoteNo}</b></div>
              <div><span>Customer</span><b>{quote.customer.company || quote.customer.name || "—"}</b></div>
              <div><span>Product</span><b>{quote.product.name || "—"}</b></div>
              <div><span>Date</span><b>{fmtDate(quote.date)}</b></div>
              <div><span>Quantity</span><b>{qty} box{qty === 1 ? "" : "es"}</b></div>
              {quote.product.ref && <div><span>Drawing Ref</span><b className="mono">{quote.product.ref}</b></div>}
            </div>

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
                  <td className="num mono">{ID_L} mm</td>
                  <td className="num mono">{ID_W} mm</td>
                  <td className="num mono">{ID_H} mm</td>
                  <td className="num mono">{BH} mm</td>
                  <td className="num mono">{TH} mm</td>
                </tr>
                <tr>
                  <td><b>OD (outer)</b></td>
                  <td className="num mono">{OD_L} mm</td>
                  <td className="num mono">{OD_W} mm</td>
                  <td className="num mono">{OD_H} mm</td>
                  <td className="num mono">{"—"}</td>
                  <td className="num mono">{"—"}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="3" className="bom-tol-note">All dims in mm · Tolerance ±2 mm · OD = ID +20L / +45W / +30H</td>
                  <td className="num" colSpan="3" style={{ color: "var(--green,#1a7a1a)" }}>{BH} + {TH} = {ID_H} ✓</td>
                </tr>
              </tfoot>
            </table>

            {isWO ? (
              <>
                <div className="bom-section-title">
                  {"2 · Panel Cutting List — " + c.acp.main.material + " " + thickness + "mm · " + caseType}
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
                    {woPanels.map(p => (
                      <tr key={p.code}>
                        <td className="mono bom-code">{p.code}</td>
                        <td>{p.desc}</td>
                        <td className="num mono">{p.L}</td>
                        <td className="num mono">{p.D}</td>
                        <td className="num">{p.qty}</td>
                        <td className="num">{(p.L * p.D * p.qty / SQMM_PER_SQFT).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5"><b>Total area → Order qty</b></td>
                      <td className="num"><b>{totalWoSqft.toFixed(3)} sqft → {orderSqft} sqft</b></td>
                    </tr>
                  </tfoot>
                </table>
              </>
            ) : (
              <>
                <div className="bom-section-title">
                  {"2 · Panel Cutting List — " + c.acp.main.material + " " + thickness + "mm · cut margin +" + c.acp.cut + " mm"}
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
                        <td>{"ABS Silver — " + (DESCS[r.key] || r.key)}</td>
                        <td className="num mono">{r.a}</td>
                        <td className="num mono">{r.b}</td>
                        <td className="num">{r.qty}</td>
                        <td className="num">{(r.a * r.b * r.qty / SQMM_PER_SQFT).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan="5"><b>{"Total " + c.acp.main.material + " panel area"}</b></td>
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
              </>
            )}

            <div className="bom-section-title">3 · Profile Lengths</div>
            {isWO ? (
              <table className="bom-tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Item</th>
                    <th className="num">Total (mm)</th>
                    <th className="num">Exact (ft)</th>
                    <th className="num">Order qty (ft)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>M / Frame</td>
                    <td>{woProfiles.m}</td>
                    <td className="num mono">{Math.round(woProfiles.mProMM)}</td>
                    <td className="num">{woProfiles.mProFtExact.toFixed(2)}</td>
                    <td className="num bom-ft">{woProfiles.mProBom}</td>
                  </tr>
                  {woProfiles.f && (
                    <tr>
                      <td>F / Female</td>
                      <td>{woProfiles.f}</td>
                      <td className="num mono">{Math.round(woProfiles.mProMM)}</td>
                      <td className="num">{woProfiles.mProFtExact.toFixed(2)}</td>
                      <td className="num bom-ft">{woProfiles.fProBom}</td>
                    </tr>
                  )}
                  {woProfiles.r && (
                    <tr>
                      <td>R / Corner</td>
                      <td>{woProfiles.r}</td>
                      <td className="num mono">{Math.round(woProfiles.rProMM)}</td>
                      <td className="num">{woProfiles.rProFtExact.toFixed(2)}</td>
                      <td className="num bom-ft">{woProfiles.rProBom}</td>
                    </tr>
                  )}
                  {woProfiles.isR && woProfiles.lPattiBom > 0 && (
                    <tr>
                      <td>L Patti</td>
                      <td>L Patti 12mm</td>
                      <td className="num mono">{"—"}</td>
                      <td className="num">{"—"}</td>
                      <td className="num bom-ft">{woProfiles.lPattiBom}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : (
              <table className="bom-tbl">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Profile Name</th>
                    <th className="num">Exact (ft)</th>
                    <th className="num">Required (ft)</th>
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
            )}

            <div className="bom-section-title">4 · Bill of Materials</div>
            <table className="bom-tbl bom-main-tbl">
              <thead>
                <tr>
                  <th style={{ width: 86 }}>Category</th>
                  <th>Item</th>
                  <th className="num">Unit</th>
                  <th className="num">Qty / box</th>
                  <th className="num">{"Total × " + qty}</th>
                </tr>
              </thead>
              <tbody>

                <tr className="bom-cat-row"><td colSpan="5">Panel</td></tr>
                {isWO ? (
                  <tr>
                    <td></td>
                    <td>{c.acp.main.material + " " + thickness + "mm"}</td>
                    <td className="num">sqft</td>
                    <td className="num">{orderSqft}</td>
                    <td className="num">{orderSqft * qty}</td>
                  </tr>
                ) : (
                  <>
                    <tr>
                      <td></td>
                      <td>{c.acp.main.material + " " + thickness + "mm"}</td>
                      <td className="num">sqft</td>
                      <td className="num">{totalMainSqft.toFixed(2)}</td>
                      <td className="num">{(totalMainSqft * qty).toFixed(2)}</td>
                    </tr>
                    {c.acp.abs && (
                      <tr>
                        <td></td>
                        <td>{"ABS Silver " + (num(quote.acp && quote.acp.absLayer && quote.acp.absLayer.thickness) || 2) + "mm"}</td>
                        <td className="num">sqft</td>
                        <td className="num">{totalAbsSqft.toFixed(2)}</td>
                        <td className="num">{(totalAbsSqft * qty).toFixed(2)}</td>
                      </tr>
                    )}
                  </>
                )}

                <tr className="bom-cat-row"><td colSpan="5">Profile</td></tr>
                {isWO ? (
                  <>
                    <tr><td></td><td>{woProfiles.m}</td><td className="num">ft</td><td className="num">{woProfiles.mProBom}</td><td className="num">{woProfiles.mProBom * qty}</td></tr>
                    {woProfiles.f && <tr><td></td><td>{woProfiles.f}</td><td className="num">ft</td><td className="num">{woProfiles.fProBom}</td><td className="num">{woProfiles.fProBom * qty}</td></tr>}
                    {woProfiles.r && <tr><td></td><td>{woProfiles.r}</td><td className="num">ft</td><td className="num">{woProfiles.rProBom}</td><td className="num">{woProfiles.rProBom * qty}</td></tr>}
                    {woProfiles.isR && woProfiles.lPattiBom > 0 && <tr><td></td><td>L Patti 12mm</td><td className="num">ft</td><td className="num">{woProfiles.lPattiBom}</td><td className="num">{woProfiles.lPattiBom * qty}</td></tr>}
                  </>
                ) : (
                  <>
                    {mf.ft > 0 && <tr><td></td><td>{mf.set || "MF Profile Set"}</td><td className="num">ft</td><td className="num">{mf.ft}</td><td className="num">{mf.ft * qty}</td></tr>}
                    {edge.ft > 0 && <tr><td></td><td>{edge.option || "Edge Profile"}</td><td className="num">ft</td><td className="num">{edge.ft}</td><td className="num">{edge.ft * qty}</td></tr>}
                    {extras.map((r, i) => <tr key={i}><td></td><td>{r.name}</td><td className="num">ft</td><td className="num">{r.ft}</td><td className="num">{r.ft * qty}</td></tr>)}
                    {mf.ft === 0 && edge.ft === 0 && extras.length === 0 && <tr><td></td><td colSpan="4" className="bom-empty">No profiles</td></tr>}
                  </>
                )}

                {isWO && woBox && (
                  <>
                    <tr className="bom-cat-row"><td colSpan="5">Packaging Box</td></tr>
                    <tr>
                      <td></td>
                      <td>{"Cardboard box"}<span className="mono bom-dim-note">{" (" + woBox.L + " x " + woBox.W + " mm)"}</span></td>
                      <td className="num">pc</td>
                      <td className="num">1</td>
                      <td className="num">{qty}</td>
                    </tr>
                  </>
                )}

                {(foamLayers.length > 0 || customFoamRows.length > 0) && (
                  <tr className="bom-cat-row"><td colSpan="5">Foam</td></tr>
                )}
                {foamLayers.map((l, i) => (
                  <tr key={i}>
                    <td></td>
                    <td>{l.type + " " + l.thk + "mm"}</td>
                    <td className="num">pc</td>
                    <td className="num">1</td>
                    <td className="num">{qty}</td>
                  </tr>
                ))}
                {customFoamRows.map((r, i) => (
                  <tr key={"cfa"+i}>
                    <td></td>
                    <td>{r.name}<span className="mono bom-dim-note">{" (" + r.type + " " + num(r.thickness) + "mm · " + num(r.length) + "x" + num(r.width) + " mm)"}</span></td>
                    <td className="num">pc</td>
                    <td className="num">{num(r.qty)}</td>
                    <td className="num">{num(r.qty) * qty}</td>
                  </tr>
                ))}

                {accRows.length > 0 && <tr className="bom-cat-row"><td colSpan="5">{"Hardware & Accessories"}</td></tr>}
                {accRows.map((r, i) => (
                  <tr key={i}>
                    <td className="bom-acc-cat">{accCat(r.name)}</td>
                    <td>{r.name}</td>
                    <td className="num">{r.unit}</td>
                    <td className="num">{num(r.qty)}</td>
                    <td className="num">{num(r.qty) * qty}</td>
                  </tr>
                ))}

                <tr className="bom-cat-row"><td colSpan="5">Production</td></tr>
                <tr>
                  <td></td><td>Labour</td>
                  <td className="num">{"—"}</td><td className="num">1</td><td className="num">{qty}</td>
                </tr>
                {!isWO && quote.shipping && quote.shipping !== "none" && (
                  <tr>
                    <td></td><td>Packaging / Shipping box</td>
                    <td className="num">{"—"}</td><td className="num">1</td><td className="num">{qty}</td>
                  </tr>
                )}

              </tbody>
            </table>

            {c.weightPerBox > 0 && (
              <div className="bom-weight">
                <span>Approx. case weight:</span>
                <b>{inr(c.weightPerBox, 3)} kg / box</b>
                {qty > 1 && <><span className="bom-dot">·</span><span>Total batch:</span><b>{inr(c.totalWeight, 3)} kg</b></>}
              </div>
            )}

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
