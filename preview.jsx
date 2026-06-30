/* ============================================================
   Quotation Preview â€” print-ready document
   ============================================================ */



function CaseBoxDiagram({ odL, odW, odH, bh, hardware }) {
  const COS = 0.866, SIN = 0.5;
  const maxD = Math.max(odL, odW, odH, 1);
  const S = 150 / maxD;
  const iso = (x, y, z) => [(x - y) * COS * S, (x + y) * SIN * S - z * S];

  const pts = {
    bfl: iso(0,   0,   0),    bfr: iso(odL, 0,   0),
    bbr: iso(odL, odW, 0),    bbl: iso(0,   odW, 0),
    tfl: iso(0,   0,   odH),  tfr: iso(odL, 0,   odH),
    tbr: iso(odL, odW, odH),  tbl: iso(0,   odW, odH),
    lfl: iso(0,   0,   bh),   lfr: iso(odL, 0,   bh),
    lbr: iso(odL, odW, bh),
  };

  const pp = arr => arr.map(v => v[0] + "," + v[1]).join(" ");
  const allVals = Object.values(pts);
  const xs = allVals.map(v => v[0]);
  const ys = allVals.map(v => v[1]);
  const pad = 52;
  const vx = Math.min(...xs) - pad;
  const vy = Math.min(...ys) - pad;
  const vw = Math.max(...xs) - vx + pad * 2;
  const vh = Math.max(...ys) - vy + pad * 1.5 + 20;

  const hw = n => (hardware || []).some(a => (a || "").toLowerCase().includes(n));
  const hasLock   = hw("lock");
  const hasHinge  = hw("hinge");
  const hasHandle = hw("handle");
  const hasFeet   = hw("feet") || hw("rubber") || hw("bush") || hw("foot");

  const TH = odH - bh;

  const dimL = (() => {
    const dy = 24;
    const a = [pts.bfl[0], pts.bfl[1] + dy];
    const b = [pts.bfr[0], pts.bfr[1] + dy];
    return { a, b, mx: (a[0]+b[0])/2, my: (a[1]+b[1])/2 - 5 };
  })();
  const dimW = (() => {
    const dx = 20*COS, dy = 20*SIN;
    const a = [pts.bfr[0]+dx, pts.bfr[1]+dy];
    const b = [pts.bbr[0]+dx, pts.bbr[1]+dy];
    return { a, b, mx: (a[0]+b[0])/2+5, my: (a[1]+b[1])/2 };
  })();
  const dimH = (() => {
    const dx = -28;
    const a = [pts.bfl[0]+dx, pts.bfl[1]];
    const b = [pts.tfl[0]+dx, pts.tfl[1]];
    return { a, b, mx: (a[0]+b[0])/2-4, my: (a[1]+b[1])/2 };
  })();

  const shadowCx = [pts.bfl,pts.bfr,pts.bbr,pts.bbl].reduce((s,p)=>s+p[0],0)/4;
  const shadowCy = [pts.bfl,pts.bfr,pts.bbr,pts.bbl].reduce((s,p)=>s+p[1],0)/4 + 10;
  const shadowRx = (Math.max(pts.bfr[0],pts.bbr[0]) - Math.min(pts.bfl[0],pts.bbl[0])) * 0.56;
  const shadowRy = shadowRx * 0.28;

  const legItems = [
    { shape: "corner", label: "Corner protectors (x8)", always: true },
    { shape: "lock",   label: "Recessed lock (x2)",      show: hasLock },
    { shape: "hinge",  label: "Butterfly hinges (x2)",   show: hasHinge },
    { shape: "handle", label: "Aluminium handle (x1)",   show: hasHandle },
    { shape: "feet",   label: "Rubber feet (x4)",         show: hasFeet },
  ].filter(it => it.always || it.show);

  return (
    <svg viewBox={vx+" "+vy+" "+vw+" "+vh}
      style={{ width:"100%", maxWidth:460, display:"block", margin:"18px auto" }}
      aria-label="Flight case box diagram">
      <defs>
        <linearGradient id="cbGTop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#eaf2f8" />
          <stop offset="55%"  stopColor="#cad8e4" />
          <stop offset="100%" stopColor="#aec0cc" />
        </linearGradient>
        <linearGradient id="cbGFB" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%"   stopColor="#c8d8e4" />
          <stop offset="100%" stopColor="#96aebe" />
        </linearGradient>
        <linearGradient id="cbGFL" x1="0" y1="0" x2="0.15" y2="1">
          <stop offset="0%"   stopColor="#d4e4f0" />
          <stop offset="100%" stopColor="#aac0cc" />
        </linearGradient>
        <linearGradient id="cbGRB" x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0%"   stopColor="#88a0ae" />
          <stop offset="100%" stopColor="#6a8492" />
        </linearGradient>
        <linearGradient id="cbGRL" x1="0" y1="0" x2="0.1" y2="1">
          <stop offset="0%"   stopColor="#98b2c0" />
          <stop offset="100%" stopColor="#7a98a8" />
        </linearGradient>
        <radialGradient id="cbGCorner" cx="32%" cy="28%" r="72%">
          <stop offset="0%"   stopColor="#ffe070" />
          <stop offset="45%"  stopColor="#d4a010" />
          <stop offset="100%" stopColor="#8a6008" />
        </radialGradient>
        <radialGradient id="cbGShadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#000000" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0" />
        </radialGradient>
        <marker id="cbArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="#555" />
        </marker>
        <marker id="cbArrowL" markerWidth="6" markerHeight="6" refX="1" refY="3" orient="auto">
          <path d="M6,0 L0,3 L6,6 Z" fill="#555" />
        </marker>
      </defs>

      {/* Ground shadow */}
      <ellipse cx={shadowCx} cy={shadowCy} rx={shadowRx} ry={shadowRy} fill="url(#cbGShadow)" />

      {/* Body faces — bottom portion */}
      <polygon points={pp([pts.bfl,pts.lfl,pts.lfr,pts.bfr])} fill="url(#cbGFB)" stroke="#5a7280" strokeWidth="0.9" />
      <polygon points={pp([pts.bfr,pts.lfr,pts.lbr,pts.bbr])} fill="url(#cbGRB)" stroke="#5a7280" strokeWidth="0.9" />

      {/* Lid faces — upper portion */}
      <polygon points={pp([pts.lfl,pts.tfl,pts.tfr,pts.lfr])} fill="url(#cbGFL)" stroke="#5a7280" strokeWidth="0.9" />
      <polygon points={pp([pts.lfr,pts.tfr,pts.tbr,pts.lbr])} fill="url(#cbGRL)" stroke="#5a7280" strokeWidth="0.9" />
      <polygon points={pp([pts.tfl,pts.tfr,pts.tbr,pts.tbl])} fill="url(#cbGTop)" stroke="#5a7280" strokeWidth="0.9" />

      {/* Edge highlights — simulate aluminum extrusion shine */}
      <line x1={pts.tfl[0]} y1={pts.tfl[1]} x2={pts.tfr[0]} y2={pts.tfr[1]} stroke="white" strokeWidth="2" opacity="0.65" />
      <line x1={pts.tfl[0]} y1={pts.tfl[1]} x2={pts.tbl[0]} y2={pts.tbl[1]} stroke="white" strokeWidth="1.5" opacity="0.48" />
      <line x1={pts.tfr[0]} y1={pts.tfr[1]} x2={pts.tbr[0]} y2={pts.tbr[1]} stroke="#c8d8e0" strokeWidth="1" opacity="0.5" />
      <line x1={pts.bfl[0]} y1={pts.bfl[1]} x2={pts.tfl[0]} y2={pts.tfl[1]} stroke="#c0ccd4" strokeWidth="1" opacity="0.6" />

      {/* Lid/body split — dashed gap line + subtle glow */}
      <line x1={pts.lfl[0]} y1={pts.lfl[1]+0.8} x2={pts.lfr[0]} y2={pts.lfr[1]+0.8} stroke="#000" strokeWidth="1" opacity="0.15" />
      <line x1={pts.lfl[0]} y1={pts.lfl[1]} x2={pts.lfr[0]} y2={pts.lfr[1]} stroke="#1e3850" strokeWidth="1.8" strokeDasharray="4.5,3" />
      <line x1={pts.lfr[0]} y1={pts.lfr[1]+0.8} x2={pts.lbr[0]} y2={pts.lbr[1]+0.8} stroke="#000" strokeWidth="1" opacity="0.15" />
      <line x1={pts.lfr[0]} y1={pts.lfr[1]} x2={pts.lbr[0]} y2={pts.lbr[1]} stroke="#1e3850" strokeWidth="1.8" strokeDasharray="4.5,3" />
      <line x1={pts.lfl[0]} y1={pts.lfl[1]-0.6} x2={pts.lfr[0]} y2={pts.lfr[1]-0.6} stroke="white" strokeWidth="0.8" opacity="0.38" />

      {/* BH / TH labels */}
      <text x={pts.lfr[0]+5} y={(pts.lfr[1]+pts.bfr[1])/2+3} fontSize="8" fill="#1a4060" fontFamily="monospace">BH {bh}mm</text>
      <text x={pts.lfr[0]+5} y={(pts.lfr[1]+pts.tfr[1])/2+3} fontSize="8" fill="#1a4060" fontFamily="monospace">TH {TH}mm</text>

      {/* Corner protectors — metallic gold sphere */}
      {[pts.bfl,pts.bfr,pts.bbr,pts.bbl,pts.tfl,pts.tfr,pts.tbr,pts.tbl].map((v,i) => (
        <g key={i}>
          <circle cx={v[0]} cy={v[1]} r={4.8} fill="url(#cbGCorner)" stroke="#7a5808" strokeWidth="0.8" />
          <circle cx={v[0]-1.4} cy={v[1]-1.4} r={1.3} fill="white" opacity="0.42" />
        </g>
      ))}

      {/* Lock */}
      {hasLock && (() => {
        const lk = iso(odL/2, 0, bh/2);
        return (
          <g>
            <rect x={lk[0]-10} y={lk[1]-7} width="20" height="14" rx="3" fill="#222" stroke="#111" strokeWidth="0.8" />
            <rect x={lk[0]-10} y={lk[1]-7} width="20" height="6" rx="3" fill="#333" />
            <circle cx={lk[0]} cy={lk[1]+2} r="4" fill="#555" stroke="#2a2a2a" strokeWidth="0.6" />
            <circle cx={lk[0]} cy={lk[1]+1.5} r="1.5" fill="#1a1a1a" />
            <rect x={lk[0]-0.9} y={lk[1]+1.5} width="1.8" height="2.8" fill="#1a1a1a" />
            <rect x={lk[0]-9} y={lk[1]-6.2} width="18" height="2" rx="1" fill="white" opacity="0.12" />
          </g>
        );
      })()}

      {/* Butterfly hinges */}
      {hasHinge && [odL*0.25, odL*0.75].map((x, i) => {
        const hg = iso(x, 0, bh);
        return (
          <g key={i}>
            <rect x={hg[0]-5} y={hg[1]}   width="10" height="8" rx="2" fill="#9aa0a8" stroke="#5a6068" strokeWidth="0.7" />
            <rect x={hg[0]-5} y={hg[1]-8} width="10" height="8" rx="2" fill="#b0b8c0" stroke="#5a6068" strokeWidth="0.7" />
            <circle cx={hg[0]} cy={hg[1]} r="2.2" fill="#d0d8e0" stroke="#6a7880" strokeWidth="0.6" />
            {[-2.8,2.8].map((dx,j) => (
              <g key={j}>
                <circle cx={hg[0]+dx} cy={hg[1]+4}  r={1.1} fill="#c0c8d0" />
                <circle cx={hg[0]+dx} cy={hg[1]-4}  r={1.1} fill="#c0c8d0" />
              </g>
            ))}
          </g>
        );
      })}

      {/* Handle — aluminum bar with end caps */}
      {hasHandle && (() => {
        const hd = iso(odL/2, odW/3.5, odH);
        const hw2 = 15;
        return (
          <g>
            <rect x={hd[0]-hw2-5} y={hd[1]-1} width="6" height="9" rx="1.5" fill="#888" stroke="#555" strokeWidth="0.5" />
            <rect x={hd[0]+hw2-1} y={hd[1]-1} width="6" height="9" rx="1.5" fill="#888" stroke="#555" strokeWidth="0.5" />
            <path d={"M "+(hd[0]-hw2)+" "+(hd[1]+4.5)+" Q "+hd[0]+" "+(hd[1]-10)+" "+(hd[0]+hw2)+" "+(hd[1]+4.5)}
              fill="none" stroke="#1a1a1a" strokeWidth="6" strokeLinecap="round" />
            <path d={"M "+(hd[0]-hw2)+" "+(hd[1]+4.5)+" Q "+hd[0]+" "+(hd[1]-10)+" "+(hd[0]+hw2)+" "+(hd[1]+4.5)}
              fill="none" stroke="#787878" strokeWidth="4.5" strokeLinecap="round" />
            <path d={"M "+(hd[0]-hw2+2)+" "+(hd[1]+3)+" Q "+hd[0]+" "+(hd[1]-8)+" "+(hd[0]+hw2-2)+" "+(hd[1]+3)}
              fill="none" stroke="#c8c8c8" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          </g>
        );
      })()}

      {/* Rubber feet */}
      {hasFeet && [[0.1,0.1],[0.9,0.1],[0.1,0.9],[0.9,0.9]].map(([fx,fy],i) => {
        const ft = iso(odL*fx, odW*fy, 0);
        return (
          <g key={i}>
            <ellipse cx={ft[0]} cy={ft[1]+1} rx="4.5" ry="2.5" fill="#0a0a0a" opacity="0.4" />
            <ellipse cx={ft[0]} cy={ft[1]} rx="4.5" ry="2.8" fill="#181818" stroke="#000" strokeWidth="0.4" />
            <ellipse cx={ft[0]} cy={ft[1]-0.5} rx="3" ry="1.6" fill="#323232" />
          </g>
        );
      })}

      {/* Dimension: Length */}
      <line x1={pts.bfl[0]} y1={pts.bfl[1]} x2={dimL.a[0]} y2={dimL.a[1]} stroke="#aaa" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={pts.bfr[0]} y1={pts.bfr[1]} x2={dimL.b[0]} y2={dimL.b[1]} stroke="#aaa" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={dimL.a[0]} y1={dimL.a[1]} x2={dimL.b[0]} y2={dimL.b[1]} stroke="#444" strokeWidth="1" markerStart="url(#cbArrowL)" markerEnd="url(#cbArrow)" />
      <text x={dimL.mx} y={dimL.my} textAnchor="middle" fontSize="9" fill="#222" fontFamily="monospace" fontWeight="600">{odL} mm</text>

      {/* Dimension: Width */}
      <line x1={pts.bfr[0]} y1={pts.bfr[1]} x2={dimW.a[0]} y2={dimW.a[1]} stroke="#aaa" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={pts.bbr[0]} y1={pts.bbr[1]} x2={dimW.b[0]} y2={dimW.b[1]} stroke="#aaa" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={dimW.a[0]} y1={dimW.a[1]} x2={dimW.b[0]} y2={dimW.b[1]} stroke="#444" strokeWidth="1" markerStart="url(#cbArrowL)" markerEnd="url(#cbArrow)" />
      <text x={dimW.mx} y={dimW.my} textAnchor="start" fontSize="9" fill="#222" fontFamily="monospace" fontWeight="600">{odW} mm</text>

      {/* Dimension: Height */}
      <line x1={pts.bfl[0]} y1={pts.bfl[1]} x2={dimH.a[0]} y2={dimH.a[1]} stroke="#aaa" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={pts.tfl[0]} y1={pts.tfl[1]} x2={dimH.b[0]} y2={dimH.b[1]} stroke="#aaa" strokeWidth="0.6" strokeDasharray="2,2" />
      <line x1={dimH.a[0]} y1={dimH.a[1]} x2={dimH.b[0]} y2={dimH.b[1]} stroke="#444" strokeWidth="1" markerStart="url(#cbArrowL)" markerEnd="url(#cbArrow)" />
      <text x={dimH.mx} y={dimH.my} textAnchor="middle" fontSize="9" fill="#222" fontFamily="monospace" fontWeight="600"
        transform={"rotate(-90,"+dimH.mx+","+dimH.my+")"}>{odH} mm</text>

      {/* Hardware legend */}
      {(() => {
        const lx = vx + 6, ly = vy + 6;
        const boxH = legItems.length * 18 + 12;
        return (
          <g>
            <rect x={lx} y={ly} width="128" height={boxH} fill="white" fillOpacity="0.92" rx="4" stroke="#ddd" strokeWidth="0.8" />
            {legItems.map((it, idx) => {
              const iy = ly + 15 + idx * 18;
              return (
                <g key={idx}>
                  {it.shape === "corner" && (
                    <g>
                      <circle cx={lx+11} cy={iy-3} r={4.8} fill="url(#cbGCorner)" stroke="#7a5808" strokeWidth="0.7" />
                      <circle cx={lx+9.5} cy={iy-4.5} r={1.3} fill="white" opacity="0.42" />
                    </g>
                  )}
                  {it.shape === "lock" && (
                    <g>
                      <rect x={lx+5} y={iy-9} width="12" height="9" rx="2" fill="#222" />
                      <circle cx={lx+11} cy={iy-1} r="3" fill="#555" />
                      <circle cx={lx+11} cy={iy-1.5} r="1.2" fill="#1a1a1a" />
                    </g>
                  )}
                  {it.shape === "hinge" && (
                    <g>
                      <rect x={lx+6} y={iy-9} width="10" height="7" rx="2" fill="#b0b8c0" />
                      <rect x={lx+6} y={iy-2} width="10" height="7" rx="2" fill="#9aa0a8" />
                      <circle cx={lx+11} cy={iy-2} r="2" fill="#d0d8e0" />
                    </g>
                  )}
                  {it.shape === "handle" && (
                    <g>
                      <path d={"M "+(lx+3)+" "+iy+" Q "+(lx+11)+" "+(iy-9)+" "+(lx+19)+" "+iy}
                        fill="none" stroke="#1a1a1a" strokeWidth="5" strokeLinecap="round" />
                      <path d={"M "+(lx+3)+" "+iy+" Q "+(lx+11)+" "+(iy-9)+" "+(lx+19)+" "+iy}
                        fill="none" stroke="#787878" strokeWidth="3.5" strokeLinecap="round" />
                    </g>
                  )}
                  {it.shape === "feet" && (
                    <g>
                      <ellipse cx={lx+11} cy={iy-2} rx="5.5" ry="3.2" fill="#181818" />
                      <ellipse cx={lx+11} cy={iy-2.5} rx="3.8" ry="2" fill="#323232" />
                    </g>
                  )}
                  <text x={lx+24} y={iy} fontSize="7.5" fill="#444">{it.label}</text>
                </g>
              );
            })}
          </g>
        );
      })()}
    </svg>
  );
}


function Preview({ quote, onBack, onEdit, onInternal, onDeliver, onBom }) {
  const c = useMemo(() => calcQuote(quote), [quote]);
  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const cu = quote.customer;

  // Scope of supply â€” customer-facing names only, NO internal construction details.
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

  // Accessories & hardware â€” show only customer-friendly items.
  const accItems = customerVisibleAccessoryRows(c.acc.rows).map(a => ({ name: a.name, qty: a.qty, unit: a.unit }));

  // Selling price per box (excl. shipping) â€” never exposes raw cost or margin
  const sellPerBox = c.quantity > 0 ? (c.totalBeforeGst - (c.shippingValue || 0)) / c.quantity : 0;

  const h  = Number(quote.caseDims.height)    || 0;
  const h1 = Number(quote.caseDims.lidHeight) || 0;
  const diagOdL = Number(quote.caseDims.length || 0) + 20;
  const diagOdW = Number(quote.caseDims.width  || 0) + 45;
  const diagOdH = (h + h1) + 30;
  const diagHw  = accItems.map(a => a.name);

  return (
    <div className="container">
      <div className="preview-bar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <button className="btn btn-ghost btn-sm" onClick={onEdit}><Icon name="edit" /> Edit</button>
        <div className="spacer" />
        <div className="view-toggle">
          <button className="active">Customer</button>
          <button onClick={onInternal}>Internal</button>
          <button onClick={onBom}>BOM</button>
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
                  {cu.phone && <>{cu.phone}</>}{cu.phone && cu.email && " Â· "}{cu.email}
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
              <div className="spec"><div className="l">Total Height (H + H1)</div><div className="v">{h} + {h1} = {h + h1} mm</div></div>
              <div className="spec"><div className="l">Panel Material</div><div className="v">{c.acp.material}</div></div>
              <div className="spec"><div className="l">Quantity</div><div className="v">{c.quantity} box{c.quantity === 1 ? "" : "es"}</div></div>
              {c.weightPerBox > 0 && <div className="spec"><div className="l">Approx. Weight</div><div className="v">{inr(c.totalWeight, 2)} kg</div></div>}
            </div>

            {/* Box diagram */}
            <div className="doc-section-title">Case Drawing</div>
            <CaseBoxDiagram odL={diagOdL} odW={diagOdW} odH={diagOdH} bh={h} hardware={diagHw} />

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
                          <li key={i}>{a.name} <span className="qty">&times; {a.qty}{a.unit === "ft" ? " ft" : ""}</span></li>
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
                  {c.quantity > 1 && <tr><td className="k">Rate / box</td><td className="v">&#x20B9; {inr(sellPerBox)}</td></tr>}
                  {c.quantity > 1 && <tr><td className="k">&times; {c.quantity} boxes</td><td className="v">&#x20B9; {inr(sellPerBox * c.quantity)}</td></tr>}
                  <tr><td className="k">Total before GST</td><td className="v">&#x20B9; {inr(c.totalBeforeGst)}</td></tr>
                  <tr><td className="k">GST @ {SETTINGS.gstPercent}%</td><td className="v">&#x20B9; {inr(c.gst)}</td></tr>
                  <tr className="grand"><td className="k">Grand Total</td><td className="v">&#x20B9; {inr(c.grand)}</td></tr>
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
