/* ============================================================
   Delivery — Zoho WorkDrive + Zoho Mail workflow
   ------------------------------------------------------------
   • Generates TWO real PDFs from a quote:
       - Customer / External  (no costing internals)
       - Company / Internal   (full costing breakdown)
   • Saves PDFs to Zoho WorkDrive and sends customer emails through the live
     Orion Netlify backend.
   ============================================================ */

const DRIVE_ROOT = "Orion Quotations Invoices";
const DRIVE_EXTERNAL = "Customer Copy - External";
const DRIVE_INTERNAL = "Company Copy - Internal";

// Logo for PDFs. The standalone build replaces this path with an inline data URI.
const ORION_LOGO_SRC = "assets/orion-logo.png";
const ORION_LOGO_RATIO = 113 / 247; // height / width

// Live Netlify backend API
const ORION_API = "https://orionquotes.netlify.app/.netlify/functions";

/* ---------- naming ---------- */
function sanitizeName(s) {
  return String(s || "Customer")
    .replace(/[^A-Za-z0-9]+/g, "")   // strip spaces & punctuation
    .slice(0, 40) || "Customer";
}
// ORION-0001  ->  ORION-INV-0001 when the doc is an invoice
function docNumber(quote) {
  const base = quote.quoteNo || "ORION-0000";
  if (quote.docType === "invoice" && !/-INV-/.test(base)) {
    return base.replace(/^ORION-/, "ORION-INV-");
  }
  return base;
}
function pdfFileName(quote, kind /* "External" | "Internal" */) {
  const cust = sanitizeName(quote.customer.company || quote.customer.name);
  return docNumber(quote) + "_" + cust + "_" + kind + ".pdf";
}

/* ---------- shared PDF helpers (jsPDF) ---------- */
function newDoc() {
  const { jsPDF } = window.jspdf;
  return new jsPDF({ unit: "pt", format: "a4", compress: true });
}
const PAGE = { w: 595.28, mx: 40 };
const NAVY = [31, 77, 121];
const RED = [216, 35, 42];
const INK = [33, 41, 54];
const GREY = [120, 130, 145];

function money(v, dp) { return "Rs " + inr(v, dp == null ? 2 : dp); }

function docHeader(doc, quote, title, accent) {
  // Logo top-left
  const logoW = 86, logoH = logoW * ORION_LOGO_RATIO;
  try { doc.addImage(ORION_LOGO_SRC, "PNG", PAGE.mx, 30, logoW, logoH); } catch (e) { /* logo optional */ }
  const cy = 30 + logoH + 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...NAVY);
  doc.text(SETTINGS.company.name, PAGE.mx, cy);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.text(SETTINGS.company.tagline || "", PAGE.mx, cy + 12);
  doc.text(SETTINGS.company.address || "", PAGE.mx, cy + 23);
  doc.text("GSTIN " + (SETTINGS.company.gstin || "") + "   |   " + (SETTINGS.company.phone || ""), PAGE.mx, cy + 34);
  doc.text(SETTINGS.company.email || "", PAGE.mx, cy + 45);

  // title block (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...accent);
  doc.text(title, PAGE.w - PAGE.mx, 44, { align: "right" });
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.setFont("helvetica", "normal");
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  doc.text("No.  " + docNumber(quote), PAGE.w - PAGE.mx, 60, { align: "right" });
  doc.text("Date  " + fmt(quote.date), PAGE.w - PAGE.mx, 72, { align: "right" });

  const lineY = cy + 56;
  doc.setDrawColor(...accent);
  doc.setLineWidth(1.4);
  doc.line(PAGE.mx, lineY, PAGE.w - PAGE.mx, lineY);
  return lineY + 18;
}

function partiesBlock(doc, quote, startY) {
  const cu = quote.customer;
  const colR = PAGE.w / 2 + 6;
  doc.setFontSize(8);
  doc.setTextColor(...GREY);
  doc.setFont("helvetica", "bold");
  doc.text(quote.docType === "invoice" ? "INVOICE TO" : "QUOTATION FOR", PAGE.mx, startY);
  doc.text("PRODUCT", colR, startY);

  doc.setTextColor(...INK);
  doc.setFontSize(10);
  let y = startY + 14;
  doc.text(cu.company || cu.name || "Customer", PAGE.mx, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const left = [];
  if (cu.company && cu.name) left.push(cu.name);
  if (cu.address) left.push(cu.address);
  if (cu.gstin) left.push("GSTIN " + cu.gstin);
  const contact = [cu.phone, cu.email].filter(Boolean).join("  -  ");
  if (contact) left.push(contact);
  left.forEach((t, i) => doc.text(doc.splitTextToSize(t, 230), PAGE.mx, y + 14 + i * 12));

  // product (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(doc.splitTextToSize(quote.product.name || "Custom case", 240), colR, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const pr = [];
  if (quote.product.ref) pr.push("Ref: " + quote.product.ref);
  pr.forEach((t, i) => doc.text(t, colR, y + 14 + i * 12));

  return y + 14 + Math.max(left.length, pr.length) * 12 + 16;
}

function totalsRows(c) {
  const rows = [
    ["Subtotal / box", money(c.subtotalPerBox)],
    ["x " + c.quantity + " box" + (c.quantity === 1 ? "" : "es"), money(c.boxesTotal)],
  ];
  if (c.shippingValue > 0) rows.push(["Shipping", money(c.shippingValue)]);
  rows.push(["Total before GST", money(c.totalBeforeGst)]);
  rows.push(["GST @ " + SETTINGS.gstPercent + "%", money(c.gst)]);
  return rows;
}

/* ---------- CUSTOMER / EXTERNAL PDF ----------
   Shows ONLY: customer, product, specs, quantity, price summary,
   GST, grand total, validity, payment terms, T&C.
   Hides: per-component costing, sheet nesting, rates, margins, cost/piece. */
function buildCustomerPDF(quote) {
  const c = calcQuote(quote);
  const doc = newDoc();
  let y = docHeader(doc, quote, quote.docType === "invoice" ? "INVOICE" : "QUOTATION", NAVY);
  y = partiesBlock(doc, quote, y);

  // Specification (no costs)
  doc.autoTable({
    startY: y,
    head: [["Case Specification", ""]],
    body: [
      ["Dimensions (L x W x Total Height (H + H1))", quote.caseDims.length + " x " + quote.caseDims.width + " x " + ((Number(quote.caseDims.height) || 0) + (Number(quote.caseDims.lidHeight) || 0)) + " mm"],
      ["Panel material", quote.acp.material],
      ["Quantity", c.quantity + " box" + (c.quantity === 1 ? "" : "es")],
      ...(c.weightPerBox > 0 ? [["Approx. weight", inr(c.totalWeight, 2) + " kg"]] : []),
    ],
    theme: "grid",
    headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: INK },
    columnStyles: { 0: { cellWidth: 200, textColor: GREY }, 1: { fontStyle: "bold" } },
    margin: { left: PAGE.mx, right: PAGE.mx },
  });
  y = doc.lastAutoTable.finalY + 16;

  // Scope of supply — customer-facing items only.
  // Panels, profile hardware and internal construction details are costed but hidden.
  const display = quote.customerDisplay || {};
  const scopeRows = [];
  if (display.showFoamLayers) {
    const foamLines = String(display.foamLayerLines != null ? display.foamLayerLines : (display.foamLayerName || "Custom foam insert"))
      .split(/\r?\n/)
      .map(x => x.trim())
      .filter(Boolean);
    (foamLines.length ? foamLines : ["Custom foam insert"]).forEach(line => scopeRows.push([line]));
  }
  const accStr = customerVisibleAccessoryRows(c.acc.rows).map(a => a.name + " x " + a.qty + (a.unit === "ft" ? " ft" : "")).join(", ");
  if (accStr) scopeRows.push(["Accessories & hardware: " + accStr]);

  if (scopeRows.length > 0) {
    doc.autoTable({
      startY: y,
      head: [["Scope of Supply"]],
      body: scopeRows,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 9 },
      bodyStyles: { fontSize: 9, textColor: INK },
      margin: { left: PAGE.mx, right: PAGE.mx },
    });
    y = doc.lastAutoTable.finalY + 12;
  }

  // Totals (right aligned block)
  doc.autoTable({
    startY: y,
    body: totalsRows(c),
    theme: "plain",
    bodyStyles: { fontSize: 9, textColor: INK },
    columnStyles: { 0: { cellWidth: 150, halign: "right", textColor: GREY }, 1: { cellWidth: 110, halign: "right", fontStyle: "bold" } },
    margin: { left: PAGE.w - PAGE.mx - 260, right: PAGE.mx },
  });
  y = doc.lastAutoTable.finalY + 4;

  // Grand total bar
  doc.setFillColor(...NAVY);
  doc.rect(PAGE.w - PAGE.mx - 260, y, 260, 22, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("GRAND TOTAL", PAGE.w - PAGE.mx - 252, y + 15);
  doc.text(money(c.grand), PAGE.w - PAGE.mx - 8, y + 15, { align: "right" });
  y += 38;

  // Validity & payment + terms
  const fmt = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const validTill = (function () { const dd = new Date(quote.date + "T00:00:00"); dd.setDate(dd.getDate() + toNumber(quote.validityDays, 15)); return dd.toISOString().slice(0, 10); })();
  doc.setTextColor(...INK); doc.setFontSize(9);
  doc.setFont("helvetica", "bold"); doc.text("Payment & Validity", PAGE.mx, y);
  doc.setFont("helvetica", "normal");
  const pv = [
    "Payment terms: " + quote.paymentTerms,
    "Valid for " + toNumber(quote.validityDays, 15) + " days from issue (until " + fmt(validTill) + ").",
  ];
  pv.forEach((t, i) => doc.text(doc.splitTextToSize((i + 1) + ". " + t, PAGE.w - 2 * PAGE.mx), PAGE.mx, y + 14 + i * 12));
  y += 14 + pv.length * 12 + 8;

  doc.setFont("helvetica", "bold"); doc.text("Terms & Conditions", PAGE.mx, y);
  doc.setFont("helvetica", "normal");
  let ty = y + 14;
  quote.terms.forEach((t, i) => {
    const lines = doc.splitTextToSize((i + 1) + ". " + t, PAGE.w - 2 * PAGE.mx);
    if (ty + lines.length * 11 > 800) { doc.addPage(); ty = 50; }
    doc.text(lines, PAGE.mx, ty);
    ty += lines.length * 11 + 2;
  });

  // footer note
  doc.setFontSize(8); doc.setTextColor(...GREY);
  doc.text("For " + SETTINGS.company.name + "  -  This is a customer copy. Internal costing is not included.",
    PAGE.mx, 812);
  return doc;
}

/* ---------- COMPANY / INTERNAL PDF ----------
   Full costing: panels, foam, profiles, accessories, labour,
   base rates, margins, cost-per-piece, totals. Never emailed. */
function buildInternalPDF(quote) {
  const c = calcQuote(quote);
  const doc = newDoc();
  let y = docHeader(doc, quote, "INTERNAL COSTING", RED);

  // confidential ribbon
  doc.setFillColor(251, 233, 234);
  doc.rect(PAGE.mx, y - 6, PAGE.w - 2 * PAGE.mx, 18, "F");
  doc.setTextColor(...RED); doc.setFontSize(8); doc.setFont("helvetica", "bold");
  doc.text("CONFIDENTIAL - COMPANY INTERNAL ONLY - DO NOT SEND TO CUSTOMER", PAGE.mx + 6, y + 6);
  y += 24;

  doc.setTextColor(...INK); doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text((quote.customer.company || quote.customer.name || "-") + "   |   Qty " + c.quantity +
    "   |   " + quote.caseDims.length + "x" + quote.caseDims.width + "x" + quote.caseDims.height +
    " (+" + quote.caseDims.lidHeight + ") mm   |   Cut margin " + c.acp.cut + " mm", PAGE.mx, y);
  y += 14;

  const pieceHead = [["Category", "Piece (mm)", "Cut (mm)", "Qty", "Pcs/sht", "Rs/pc", "Total"]];
  const pieceBody = (layer) => layer.rows.map(r => [
    r.label, inr(r.a, 0) + "x" + inr(r.b, 0), inr(r.cutA, 0) + "x" + inr(r.cutB, 0),
    String(r.qty), String(r.fit), inr(r.costPerPiece, 0), inr(r.cost, 0),
  ]);
  const tbl = (title, head, body) => {
    doc.autoTable({
      startY: y,
      head: [[{ content: title, colSpan: head[0].length, styles: { halign: "left", fillColor: [240, 243, 247], textColor: NAVY, fontStyle: "bold" } }]].concat(head),
      body,
      theme: "grid",
      headStyles: { fillColor: NAVY, textColor: 255, fontSize: 7.5 },
      bodyStyles: { fontSize: 7.5, textColor: INK },
      columnStyles: { 0: { halign: "left" } },
      styles: { halign: "right", cellPadding: 2.5 },
      margin: { left: PAGE.mx, right: PAGE.mx },
    });
    y = doc.lastAutoTable.finalY + 10;
  };

  tbl(c.acp.main.material + " Panels - sheet " + inr(c.acp.main.sheetW, 0) + "x" + inr(c.acp.main.sheetL, 0) +
    " mm = " + c.acp.main.sheetSqft + " sqft - final Rs " + c.acp.main.finalRate.toFixed(2) +
    "/sqft - sheet cost Rs " + inr(c.acp.main.sheetCost, 0), pieceHead, pieceBody(c.acp.main));
  if (c.acp.abs) {
    tbl("ABS Silver Layer (linked to MDF) - final Rs " + c.acp.abs.finalRate.toFixed(2) + "/sqft", pieceHead, pieceBody(c.acp.abs));
  }
  c.foam.layers.forEach((l, i) => {
    tbl("Foam Layer " + (i + 1) + ": " + l.type + " " + l.thk + "mm - sheet cost Rs " + inr(l.sheetCost, 0) + " - cut +" + l.cut + "mm",
      pieceHead, pieceBody(l));
  });

  if (c.customFoam && c.customFoam.rows.length > 0) {
    tbl("Custom Foam Size Add-ons",
      [["Name", "Type", "Size (mm)", "Qty", "Rate/mm", "Margin", "Adhesive", "Total"]],
      c.customFoam.rows.map(r => [
        r.name,
        r.type,
        inr(r.length, 0) + "x" + inr(r.width, 0) + "x" + inr(r.thickness, 0),
        String(r.qty),
        String(r.rate),
        r.margin ? inr(r.margin, 0) : "-",
        r.adhesive ? inr(r.adhesive, 0) : "-",
        inr(r.total, 0),
      ]));
  }

  // profiles
  const profBody = [
    [c.profiles.mf.set + " (M " + c.profiles.mf.male + " + F " + c.profiles.mf.female + ")", inr(c.profiles.mf.mm, 0) + " mm", String(c.profiles.mf.ft), c.profiles.mf.combined.toFixed(2), c.profiles.mf.margin || "-", inr(c.profiles.mfCost, 0)],
    [c.profiles.edge.option, c.profiles.edge.mode === "manual" ? c.profiles.edge.ft + " ft" : inr(c.profiles.edge.mm, 0) + " mm", String(c.profiles.edge.ft), String(c.profiles.edge.rate), c.profiles.edge.margin || "-", inr(c.profiles.edgeCost, 0)],
    ...c.profiles.extras.rows.map(x => [x.name, inr(x.requiredMm, 0) + " mm", String(x.ft), inr(x.basePrice, 0), (x.margin === "" || x.margin == null ? "-" : inr(x.margin, 0)), inr(x.total, 0)]),
  ];
  tbl("Profiles", [["Profile", "Length", "Ft", "Rate Rs/ft", "Margin", "Total"]], profBody);

  // accessories
  tbl("Accessories & Hardware",
    [["Item", "Unit", "Qty/Ft", "Base Rs", "Margin", "Final Rs", "Total"]],
    c.acc.rows.map(a => [a.name, a.unit, String(a.qty), inr(a.basePrice, 0), (a.margin === "" || a.margin == null ? "-" : inr(a.margin, 0)), inr(a.finalUnit, 0), inr(a.total, 0)]));

  // totals
  const tRows = [
    [c.acp.main.material + " panels" + (c.acp.abs ? " + ABS" : ""), money(c.acpCost, 0)],
    ["Foam inserts", money(c.foamCost, 0)],
    ...(c.customFoamCost > 0 ? [["Custom foam add-ons", money(c.customFoamCost, 0)]] : []),
    ["MF profile set", money(c.mfCost, 0)],
    ["Edge profile", money(c.edgeCost, 0)],
  ];
  if (c.extrasCost > 0) tRows.push(["Profile extras", money(c.extrasCost, 0)]);
  tRows.push(["Accessories & hardware", money(c.accCost, 0)]);
  tRows.push(["Labour (incl. margin)", money(c.labourCost, 0)]);
  tRows.push(["Subtotal per box", money(c.subtotalPerBox)]);
  tRows.push(["x " + c.quantity + " boxes", money(c.boxesTotal)]);
  if (c.shippingValue > 0) tRows.push(["Shipping", money(c.shippingValue)]);
  tRows.push(["Final quote margin @ " + c.finalMarginPercent + "%", money(c.finalMarginValue)]);
  tRows.push(["Total before GST", money(c.totalBeforeGst)]);
  tRows.push(["GST @ " + SETTINGS.gstPercent + "%", money(c.gst)]);
  tRows.push(["GRAND TOTAL", money(c.grand)]);

  if (y > 660) { doc.addPage(); y = 50; }
  doc.autoTable({
    startY: y,
    body: tRows,
    theme: "plain",
    bodyStyles: { fontSize: 9, textColor: INK },
    columnStyles: { 0: { cellWidth: 320, textColor: GREY }, 1: { halign: "right", fontStyle: "bold" } },
    margin: { left: PAGE.mx, right: PAGE.mx },
    didParseCell: (d) => { if (d.row.index === tRows.length - 1) { d.cell.styles.textColor = RED; d.cell.styles.fontSize = 11; } },
  });
  return doc;
}

/* ---------- download + base64 ---------- */
function downloadDoc(doc, filename) { doc.save(filename); }
function docToBase64(doc) { return doc.output("datauristring").split(",")[1]; }

/* ============================================================
   Delivery Panel component
   ============================================================ */
function DeliveryPanel({ quote, onUpdate, onBack }) {
  const c = useMemo(() => calcQuote(quote), [quote]);
  const d = quote.delivery || {};
  const [toast, setToast] = useState(null);
  const [busy, setBusy] = useState("");
  const [email, setEmail] = useState({
    to: d.emailTo || quote.customer.email || "",
    subject: (quote.docType === "invoice" ? "Invoice " : "Quotation ") + docNumber(quote) + " from " + SETTINGS.company.name,
    body:
      "Dear " + (quote.customer.name || "Customer") + ",\n\n" +
      "Please find attached our " + (quote.docType === "invoice" ? "invoice" : "quotation") + " " + docNumber(quote) +
      " for " + (quote.product.name || "your custom case") + ".\n\n" +
      "The total value is " + money(c.grand) + " (incl. GST). This quotation is valid for " +
      toNumber(quote.validityDays, 15) + " days.\n\n" +
      "Please feel free to reach out with any questions.\n\nBest regards,\n" + SETTINGS.company.name,
  });

  const flash = (msg, kind) => { setToast({ msg, kind: kind || "ok" }); setTimeout(() => setToast(null), 3200); };
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";

  const extName = pdfFileName(quote, "External");
  const intName = pdfFileName(quote, "Internal");

  const genCustomer = () => { downloadDoc(buildCustomerPDF(quote), extName); flash("Customer PDF generated: " + extName); };
  const genInternal = () => { downloadDoc(buildInternalPDF(quote), intName); flash("Internal PDF generated: " + intName); };

  // LIVE Zoho WorkDrive save through Netlify Functions
  const saveToDrive = async () => {
    setBusy("drive");
    try {
      const res = await fetch(ORION_API + "/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalFileName: extName,
          internalFileName: intName,
          externalPdfBase64: docToBase64(buildCustomerPDF(quote)),
          internalPdfBase64: docToBase64(buildInternalPDF(quote)),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "WorkDrive upload failed");

      onUpdate({
        delivery: {
          ...d,
          externalPdfName: extName,
          internalPdfName: intName,
          externalDriveLink: data.externalDriveLink,
          internalDriveLink: data.internalDriveLink,
          driveSavedAt: data.savedAt || new Date().toISOString(),
        },
      });

      flash("Saved to Zoho WorkDrive — both copies filed into their folders");
    } catch (e) {
      flash(e.message || "WorkDrive upload failed", "warn");
    } finally {
      setBusy("");
    }
  };

  // LIVE Zoho Mail send through Netlify Functions
  // Direct attachment mode: WorkDrive saving is optional and NOT required before emailing.
  // The customer PDF is generated in-browser and sent to the backend as base64.
  const sendEmail = async () => {
    if (!email.to.trim()) { flash("Enter a customer email address first", "warn"); return; }

    setBusy("email");
    try {
      const res = await fetch(ORION_API + "/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.to,
          subject: email.subject,
          body: email.body,
          fileName: extName,
          externalPdfBase64: docToBase64(buildCustomerPDF(quote)),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Send failed");

      onUpdate({
        status: "sent",
        delivery: {
          ...d,
          emailTo: email.to,
          emailSent: true,
          sentAt: data.sentAt || new Date().toISOString(),
          emailMode: data.mode || "attachment",
          zohoMailAccountId: data.accountId || d.zohoMailAccountId || "",
        },
      });

      flash("Customer email sent with PDF attached directly — status set to Sent");
    } catch (e) {
      flash(e.message || "Send failed", "warn");
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="container">
      <div className="preview-bar no-print">
        <button className="btn btn-ghost btn-sm" onClick={onBack}><Icon name="back" /> Dashboard</button>
        <div className="spacer" />
        <span className="tag-chip">{docNumber(quote)}</span>
        <StatusBadge status={quote.status} />
      </div>

      {toast && <div className={"deliver-toast " + toast.kind}><Icon name={toast.kind === "warn" ? "mail" : "check"} /> {toast.msg}</div>}

      <div className="deliver-grid">
        {/* LEFT: workflow */}
        <div className="card deliver-main">
          <div className="deliver-head">
            <div>
              <div className="eyebrow">Zoho WorkDrive + Zoho Mail</div>
              <h2>Finalize &amp; Deliver</h2>
            </div>
            <div className="doctype-toggle">
              <button className={quote.docType !== "invoice" ? "active" : ""} onClick={() => onUpdate({ docType: "quotation" })}>Quotation</button>
              <button className={quote.docType === "invoice" ? "active" : ""} onClick={() => onUpdate({ docType: "invoice" })}>Invoice</button>
            </div>
          </div>

          <div className="sim-banner">
            <b>Live Zoho mode.</b> WorkDrive saving and Zoho Mail sending now run through the Orion Netlify backend.
            The customer and internal PDFs are generated in-browser. Email can attach the customer PDF directly; WorkDrive saving is optional.
          </div>

          {/* Step 1 — PDFs */}
          <div className="deliver-step">
            <div className="step-no">1</div>
            <div className="step-body">
              <h3>Generate the two PDF copies</h3>
              <div className="pdf-cards">
                <div className="pdf-card external">
                  <div className="pc-top"><Icon name="file" /><span>Customer / External</span></div>
                  <code>{extName}</code>
                  <ul>
                    <li>Customer &amp; product details, quantity</li>
                    <li>GST, grand total, validity, payment terms</li>
                    <li className="hide">Costing, margins, cost/piece, nesting hidden</li>
                  </ul>
                  <button className="btn btn-red btn-sm" onClick={genCustomer}><Icon name="download" /> Generate customer PDF</button>
                </div>
                <div className="pdf-card internal">
                  <div className="pc-top"><Icon name="layers" /><span>Company / Internal</span></div>
                  <code>{intName}</code>
                  <ul>
                    <li>Full panel, foam &amp; profile calculation</li>
                    <li>Accessories, labour, base rates &amp; margins</li>
                    <li className="warn">Never attached to customer email</li>
                  </ul>
                  <button className="btn btn-primary btn-sm" onClick={genInternal}><Icon name="download" /> Generate internal PDF</button>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 — Optional Drive */}
          <div className="deliver-step">
            <div className="step-no">2</div>
            <div className="step-body">
              <h3>Optional: Save both to Zoho WorkDrive</h3>
              <div className="folder-tree">
                <div className="ft-root"><Icon name="cloud" /> {DRIVE_ROOT}</div>
                <div className="ft-child"><Icon name="file" /> {DRIVE_EXTERNAL} <em>&rarr; {extName}</em></div>
                <div className="ft-child"><Icon name="layers" /> {DRIVE_INTERNAL} <em>&rarr; {intName}</em></div>
              </div>
              <button className="btn btn-primary" onClick={saveToDrive} disabled={busy === "drive"}>
                <Icon name="cloudup" /> {busy === "drive" ? "Saving..." : "Save both to Zoho WorkDrive"}
              </button>
              {d.driveSavedAt && (
                <div className="drive-links">
                  <div className="ok-line"><Icon name="check" /> Filed {fmtTime(d.driveSavedAt)}</div>
                  <a href={d.externalDriveLink} target="_blank" rel="noreferrer"><Icon name="link" /> External copy in WorkDrive</a>
                  <a href={d.internalDriveLink} target="_blank" rel="noreferrer"><Icon name="link" /> Internal copy in WorkDrive</a>
                </div>
              )}
            </div>
          </div>

          {/* Step 3 — Email */}
          <div className="deliver-step">
            <div className="step-no">3</div>
            <div className="step-body">
              <h3>Send customer copy by email</h3>
              <div className="email-form">
                <Field label="To (customer email)">
                  <input className="num-input" value={email.to} onChange={e => setEmail({ ...email, to: e.target.value })} placeholder="customer@company.com" />
                </Field>
                <Field label="Subject">
                  <input className="num-input" value={email.subject} onChange={e => setEmail({ ...email, subject: e.target.value })} />
                </Field>
                <Field label="Message">
                  <textarea className="num-input" rows={7} value={email.body} onChange={e => setEmail({ ...email, body: e.target.value })} />
                </Field>
                <div className="attach-note"><Icon name="file" /> Email attaches the customer PDF directly: <b>{extName}</b>. Internal PDF is never shared.</div>
                <button className="btn btn-red" onClick={sendEmail} disabled={busy === "email"}>
                  <Icon name="send" /> {busy === "email" ? "Sending..." : "Send Customer Copy by Email"}
                </button>
                {d.emailSent && <div className="ok-line"><Icon name="check" /> Sent to {d.emailTo} on {fmtTime(d.sentAt)}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: record */}
        <div className="card deliver-record">
          <div className="sum-head"><div className="label">Saved Record</div><h3>Quotation Record</h3></div>
          <div className="rec-rows">
            <div className="rec"><span>Number</span><b>{docNumber(quote)}</b></div>
            <div className="rec"><span>Customer</span><b>{quote.customer.name || "-"}</b></div>
            <div className="rec"><span>Email</span><b>{quote.customer.email || d.emailTo || "-"}</b></div>
            <div className="rec"><span>Date</span><b>{new Date(quote.date + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</b></div>
            <div className="rec"><span>Total amount</span><b>{money(c.grand, 0)}</b></div>
            <div className="rec"><span>Status</span><b><StatusBadge status={quote.status} /></b></div>
            <div className="rec"><span>External PDF</span><b>{d.externalDriveLink ? <a href={d.externalDriveLink} target="_blank" rel="noreferrer">WorkDrive link</a> : "not saved"}</b></div>
            <div className="rec"><span>Internal PDF</span><b>{d.internalDriveLink ? <a href={d.internalDriveLink} target="_blank" rel="noreferrer">WorkDrive link</a> : "not saved"}</b></div>
            <div className="rec"><span>Email sent</span><b>{d.emailSent ? "Yes" : "No"}</b></div>
            <div className="rec"><span>Sent at</span><b>{d.sentAt ? fmtTime(d.sentAt) : "-"}</b></div>
          </div>
          <div className="rec-foot">This record is stored with the saved quote (the same fields the Node.js backend persists).</div>
        </div>
      </div>
    </div>
  );
}
