/* ============================================================
   Admin Settings — edit & persist default catalogs and rules.
   Rates are optional defaults; margins stay blank.
   ============================================================ */

function AdminSettings({ onClose, onSettingsSaved }) {
  const [s, setS] = useState(() => JSON.parse(JSON.stringify(loadSettings())));
  const [saved, setSaved] = useState("idle"); // idle | loading | saving | cloud | local | error
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSaved("loading");
    loadSettingsFromCloud()
      .then((cloudSettings) => {
        if (cancelled) return;
        setS(JSON.parse(JSON.stringify(cloudSettings)));
        setSaved("cloud");
        setError("");
        if (onSettingsSaved) onSettingsSaved();
      })
      .catch((e) => {
        if (cancelled) return;
        setSaved("local");
        setError(e.message || "Could not load cloud settings");
      });
    return () => { cancelled = true; };
  }, []);

  const set = (k, v) => { setS(prev => ({ ...prev, [k]: v })); setSaved("idle"); };
  const setCompany = (k, v) => { setS(prev => ({ ...prev, company: { ...prev.company, [k]: v } })); setSaved("idle"); };

  const save = async () => {
    const next = JSON.parse(JSON.stringify(s));
    persistSettings(next);
    setSaved("saving");
    setError("");
    try {
      await saveSettingsToCloud(next);
      setSaved("cloud");
      if (onSettingsSaved) onSettingsSaved();
    } catch (e) {
      setSaved("local");
      setError(e.message || "Cloud save failed. Saved only in this browser.");
      alert("Settings saved only in this browser. Cloud save failed: " + (e.message || e));
    }
  };

  const reset = async () => {
    if (!window.confirm("Reset all settings to factory defaults for everyone? This will overwrite cloud settings.")) return;
    const f = resetSettings();
    setS(JSON.parse(JSON.stringify(f)));
    setSaved("saving");
    setError("");
    try {
      await saveSettingsToCloud(f);
      setSaved("cloud");
      if (onSettingsSaved) onSettingsSaved();
    } catch (e) {
      setSaved("local");
      setError(e.message || "Cloud reset failed. Reset only in this browser.");
      alert("Settings reset only in this browser. Cloud save failed: " + (e.message || e));
    }
  };

  // generic catalog editors
  const editCatalog = (key, idx, field, val) => {
    setS(prev => {
      const arr = prev[key].map((row, i) => i === idx ? { ...row, [field]: val } : row);
      return { ...prev, [key]: arr };
    });
    setSaved("idle");
  };
  const addCatalogRow = (key, blank) => { setS(prev => ({ ...prev, [key]: [...prev[key], blank] })); setSaved("idle"); };
  const delCatalogRow = (key, idx) => { setS(prev => ({ ...prev, [key]: prev[key].filter((_, i) => i !== idx) })); setSaved("idle"); };

  // Import the accessories/hardware catalog from an Excel sheet.
  // Expected columns: Source Sheet (category), Item Name, Unit, Quote (price), Weight (kg).
  const importExcel = async (file) => {
    if (!file) return;
    if (!window.XLSX) { window.alert("Excel reader still loading — try again in a second."); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = window.XLSX.utils.sheet_to_json(ws, { defval: null });
      const norm = (k) => String(k || "").trim().toLowerCase();
      const pick = (row, names) => { for (const k of Object.keys(row)) { if (names.includes(norm(k))) return row[k]; } return null; };
      const items = json.map(r => {
        const name = pick(r, ["item name", "item", "name"]);
        if (name == null || String(name).trim() === "") return null;
        const q = pick(r, ["quote", "price", "rate", "base price"]);
        const w = pick(r, ["weight", "weight (kg)", "kg"]);
        const u = String(pick(r, ["unit"]) || "pc").trim().toLowerCase();
        return {
          name: String(name).trim(),
          category: String(pick(r, ["source sheet", "category", "group"]) || "").trim(),
          unit: u === "ft" ? "ft" : "pc",
          basePrice: q == null || q === "" ? 0 : (Number(q) || 0),
          weightKg: w == null || w === "" ? "" : (Number(w) || ""),
        };
      }).filter(Boolean);
      if (!items.length) { window.alert("No rows found. The sheet needs an 'Item Name' column (plus Unit / Quote / Weight)."); return; }
      if (!window.confirm("Import " + items.length + " items?\n\nThis REPLACES the current Accessories & Hardware catalog (prices and weights come from the sheet).")) return;
      setS(prev => ({ ...prev, accessories: cleanAccessoriesList(items) }));
      setSaved("idle");
      window.alert("Imported " + cleanAccessoriesList(items).length + " accessories. Profile extras like L Patti / C Channel / Tube are kept in the Profile Extras section.");
    } catch (e) {
      window.alert("Import failed: " + e.message);
    }
  };


  // Import catalog rows from Excel for Settings sections.
  // Each section accepts simple column names so the team can upload practical master sheets.
  const importCatalogExcel = async (file, key) => {
    if (!file) return;
    if (!window.XLSX) { window.alert("Excel reader still loading — try again in a second."); return; }
    try {
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = window.XLSX.utils.sheet_to_json(ws, { defval: null });

      const norm = (k) => String(k || "").trim().toLowerCase()
        .replace(/₹/g, "")
        .replace(/rs\.?/g, "")
        .replace(/\s+/g, " ");
      const pick = (row, names) => {
        const wanted = names.map(norm);
        for (const k of Object.keys(row)) {
          if (wanted.includes(norm(k))) return row[k];
        }
        return null;
      };
      const clean = (v) => v == null ? "" : String(v).trim();
      const numberOr = (v, fallback) => {
        if (v === "" || v == null) return fallback;
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };
      const parseThicknessOptions = (v, fallback) => {
        if (Array.isArray(v)) return v;
        const nums = String(v == null ? "" : v)
          .split(/[,/|; ]+/)
          .map(x => Number(x))
          .filter(Number.isFinite);
        return nums.length ? nums : fallback;
      };

      const configs = {
        panelMaterials: {
          label: "Panel Materials",
          needed: "Material / Name, Sheet W, Sheet L, Thickness, Base Rate",
          map: (r) => {
            const name = clean(pick(r, ["material", "panel material", "item name", "item", "name"]));
            if (!name) return null;
            const thickness = numberOr(pick(r, ["thickness", "default thickness", "thickness mm"]), 4);
            return {
              name,
              sheetW: numberOr(pick(r, ["sheet w", "sheet width", "sheet w mm", "sheet width mm", "width"]), 1220),
              sheetL: numberOr(pick(r, ["sheet l", "sheet length", "sheet l mm", "sheet length mm", "length"]), 2440),
              thicknessOptions: parseThicknessOptions(pick(r, ["thickness options", "available thickness", "options"]), [thickness]),
              thickness,
              baseRate: numberOr(pick(r, ["base rate", "base rate /sqft", "base rate sqft", "rate", "quote", "price"]), 0),
              margin: "",
              overlay: clean(pick(r, ["overlay"])) || "",
              cutMargin: numberOr(pick(r, ["cut margin", "cutting margin"]), 20),
            };
          },
        },
        foamTypes: {
          label: "Foam Types",
          needed: "Foam / Name, Sheet W, Sheet L, Thickness, Rate, Adhesive",
          map: (r) => {
            const name = clean(pick(r, ["foam", "foam type", "material", "item name", "item", "name"]));
            if (!name) return null;
            return {
              name,
              sheetW: numberOr(pick(r, ["sheet w", "sheet width", "sheet w mm", "sheet width mm", "width"]), 1000),
              sheetL: numberOr(pick(r, ["sheet l", "sheet length", "sheet l mm", "sheet length mm", "length"]), 2000),
              thickness: numberOr(pick(r, ["thickness", "thickness mm"]), 30),
              rate: numberOr(pick(r, ["rate /mm", "rate per mm", "rate", "base rate", "quote", "price"]), 0),
              margin: "",
              adhesive: numberOr(pick(r, ["adhesive", "adhesive price", "adhesive rs"]), 40),
              cutMargin: numberOr(pick(r, ["cut margin", "cutting margin"]), 15),
            };
          },
        },
        mfSets: {
          label: "MF Profile Sets",
          needed: "Set Name / Name, Male, Female",
          map: (r) => {
            const name = clean(pick(r, ["set name", "profile set", "mf set", "item name", "item", "name"]));
            if (!name) return null;
            return {
              name,
              male: numberOr(pick(r, ["male", "male /ft", "male rate", "male price"]), 0),
              female: numberOr(pick(r, ["female", "female /ft", "female rate", "female price"]), ""),
            };
          },
        },
        edgeOptions: {
          label: "Edge Profiles",
          needed: "Option / Name, Mode, Rate",
          map: (r) => {
            const name = clean(pick(r, ["option", "edge profile", "profile", "item name", "item", "name"]));
            if (!name) return null;
            const rawMode = clean(pick(r, ["mode", "type", "calculation mode"])).toLowerCase();
            return {
              name,
              mode: rawMode.includes("manual") ? "manual" : "auto",
              rate: numberOr(pick(r, ["rate", "rate /ft", "base rate", "quote", "price"]), 0),
            };
          },
        },
        profileExtras: {
          label: "Profile Extras",
          needed: "Item / Name, Rate",
          map: (r) => {
            const name = clean(pick(r, ["profile extra", "extra", "item name", "item", "name"]));
            if (!name) return null;
            return {
              name,
              unit: "mm",
              basePrice: numberOr(pick(r, ["rate", "rate /ft", "base rate", "quote", "price"]), 0),
            };
          },
        },
        weights: {
          label: "Weights",
          needed: "Item / Name, Weight / kg",
          map: (r) => {
            const item = clean(pick(r, ["item", "item name", "name"]));
            if (!item) return null;
            return {
              item,
              kg: numberOr(pick(r, ["weight", "weight kg", "weight (kg)", "kg"]), ""),
            };
          },
        },
      };

      const config = configs[key];
      if (!config) throw new Error("Unknown catalog: " + key);
      const items = json.map(config.map).filter(Boolean);
      if (!items.length) {
        window.alert("No rows found for " + config.label + ". Required columns: " + config.needed + ".");
        return;
      }
      if (!window.confirm("Import " + items.length + " rows into " + config.label + "?\n\nThis REPLACES the current " + config.label + " catalog. Review it after import, then click Save Settings.")) return;
      setS(prev => ({ ...prev, [key]: items }));
      setSaved("idle");
      window.alert("Imported " + items.length + " rows into " + config.label + ". Review them, then click Save Settings.");
    } catch (e) {
      window.alert("Import failed: " + e.message);
    }
  };

  const setTerm = (i, v) => { setS(prev => ({ ...prev, terms: prev.terms.map((t, idx) => idx === i ? v : t) })); setSaved("idle"); };
  const addTerm = () => { setS(prev => ({ ...prev, terms: [...prev.terms, ""] })); setSaved("idle"); };
  const delTerm = (i) => { setS(prev => ({ ...prev, terms: prev.terms.filter((_, idx) => idx !== i) })); setSaved("idle"); };

  return (
    <div className="container">
      <div className="preview-bar">
        <button className="btn btn-ghost btn-sm" onClick={onClose}><Icon name="back" /> Dashboard</button>
        <div className="spacer" />
        {saved === "loading" && <span className="badge" style={{ marginRight: 4 }}>Settings: loading cloud</span>}
        {saved === "saving" && <span className="badge" style={{ marginRight: 4 }}>Saving to cloud...</span>}
        {saved === "cloud" && <span className="badge approved" style={{ marginRight: 4 }}><Icon name="check" style={{ width: 12, height: 12 }} /> Cloud Saved</span>}
        {saved === "local" && <span className="badge" style={{ marginRight: 4, background: "#fff3cd", color: "#7a4f00" }}>Local only</span>}
        {error && <span className="note" style={{ marginRight: 8, color: "#b42318" }}>{error}</span>}
        <button className="btn btn-ghost" onClick={reset} disabled={saved === "saving"}>Reset to defaults</button>
        <button className="btn btn-red" onClick={save} disabled={saved === "saving"}><Icon name="save" /> {saved === "saving" ? "Saving..." : "Save Settings"}</button>
      </div>

      <div className="page-head" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Admin</div>
          <h1>Settings &amp; Defaults</h1>
          <div className="sub">These defaults seed every new quotation. Base rates are optional starting points — they can be overridden per quote. Margins stay blank. Settings now save to the shared cloud database for all team members.</div>
        </div>
      </div>

      {/* Company */}
      <Card title="Company Details" num="A">
        <div className="grid grid-2">
          <Field label="Company Name"><input value={s.company.name} onChange={e => setCompany("name", e.target.value)} /></Field>
          <Field label="Tagline"><input value={s.company.tagline} onChange={e => setCompany("tagline", e.target.value)} /></Field>
        </div>
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <Field label="Address"><input value={s.company.address} onChange={e => setCompany("address", e.target.value)} /></Field>
          <Field label="GSTIN"><input className="mono" value={s.company.gstin} onChange={e => setCompany("gstin", e.target.value)} /></Field>
        </div>
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <Field label="Phone"><input value={s.company.phone} onChange={e => setCompany("phone", e.target.value)} /></Field>
          <Field label="Email"><input value={s.company.email} onChange={e => setCompany("email", e.target.value)} /></Field>
        </div>
      </Card>

      {/* Global rules */}
      <Card title="Global Rules" num="B">
        <div className="grid grid-4">
          <Field label="GST %"><NumInput value={s.gstPercent} unit="%" onChange={v => set("gstPercent", v)} /></Field>
          <Field label="Panel Cutting Margin"><NumInput value={s.cutMargin} unit="mm" onChange={v => set("cutMargin", v)} /></Field>
          <Field label="Foam Cutting Margin"><NumInput value={s.foamCutMargin} unit="mm" onChange={v => set("foamCutMargin", v)} /></Field>
          <Field label="Quote Validity"><NumInput value={s.validityDays} unit="days" onChange={v => set("validityDays", v)} /></Field>
        </div>
        <div className="grid grid-2" style={{ marginTop: 14 }}>
          <Field label="Default ACP Sheet Width"><NumInput value={s.acpSheetW} unit="mm" onChange={v => set("acpSheetW", v)} /></Field>
          <Field label="Default ACP Sheet Length"><NumInput value={s.acpSheetL} unit="mm" onChange={v => set("acpSheetL", v)} /></Field>
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>Default Payment Terms</label>
          <textarea value={s.paymentTerms} onChange={e => set("paymentTerms", e.target.value)} />
        </div>
      </Card>

      {/* Panel materials */}
      <CatalogCard title="Panel Materials" num="C"
        importHint="Excel columns: Material, Sheet W, Sheet L, Thickness, Base Rate. Optional: Thickness Options, Cut Margin."
        onImport={file => importCatalogExcel(file, "panelMaterials")}
        cols={["Material", "Sheet W", "Sheet L", "Thickness", "Base Rate ₹/sqft"]}
        rows={s.panelMaterials}
        render={(m, i) => (
          <>
            <td><input value={m.name} onChange={e => editCatalog("panelMaterials", i, "name", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={m.sheetW} onChange={e => editCatalog("panelMaterials", i, "sheetW", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={m.sheetL} onChange={e => editCatalog("panelMaterials", i, "sheetL", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={m.thickness} onChange={e => editCatalog("panelMaterials", i, "thickness", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={m.baseRate} onChange={e => editCatalog("panelMaterials", i, "baseRate", e.target.value)} /></td>
          </>
        )}
        onAdd={() => addCatalogRow("panelMaterials", { name: "New material", sheetW: 1220, sheetL: 2440, thicknessOptions: [3, 4, 6], thickness: 4, baseRate: 0, margin: "", overlay: "", cutMargin: 20 })}
        onDel={i => delCatalogRow("panelMaterials", i)} />

      {/* Foam types */}
      <CatalogCard title="Foam Types" num="D"
        importHint="Excel columns: Foam, Sheet W, Sheet L, Thickness, Rate, Adhesive. Optional: Cut Margin."
        onImport={file => importCatalogExcel(file, "foamTypes")}
        cols={["Foam", "Sheet W", "Sheet L", "Thickness", "Rate /mm", "Adhesive ₹"]}
        rows={s.foamTypes}
        render={(f, i) => (
          <>
            <td><input value={f.name} onChange={e => editCatalog("foamTypes", i, "name", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={f.sheetW} onChange={e => editCatalog("foamTypes", i, "sheetW", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={f.sheetL} onChange={e => editCatalog("foamTypes", i, "sheetL", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={f.thickness} onChange={e => editCatalog("foamTypes", i, "thickness", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" step="0.05" value={f.rate} onChange={e => editCatalog("foamTypes", i, "rate", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={f.adhesive} onChange={e => editCatalog("foamTypes", i, "adhesive", e.target.value)} /></td>
          </>
        )}
        onAdd={() => addCatalogRow("foamTypes", { name: "New foam", sheetW: 1000, sheetL: 2000, thickness: 30, rate: 1, margin: "", adhesive: 40, cutMargin: 15 })}
        onDel={i => delCatalogRow("foamTypes", i)} />

      {/* MF sets */}
      <CatalogCard title="MF Profile Sets" num="E"
        importHint="Excel columns: Set Name, Male, Female."
        onImport={file => importCatalogExcel(file, "mfSets")}
        cols={["Set Name", "Male ₹/ft", "Female ₹/ft", "Combined"]}
        rows={s.mfSets}
        render={(m, i) => (
          <>
            <td><input value={m.name} onChange={e => editCatalog("mfSets", i, "name", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" step="0.25" value={m.male} onChange={e => editCatalog("mfSets", i, "male", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" step="0.25" placeholder="0" value={m.female} onChange={e => editCatalog("mfSets", i, "female", e.target.value)} /></td>
            <td className="num mono" style={{ color: "var(--navy)", fontWeight: 600 }}>₹{(toNumberSafe(m.male, 0) + toNumberSafe(m.female, 0)).toFixed(2)}</td>
          </>
        )}
        onAdd={() => addCatalogRow("mfSets", { name: "New MF Set", male: 0, female: "" })}
        onDel={i => delCatalogRow("mfSets", i)} />

      {/* Edge Profiles */}
      <CatalogCard title="Edge Profiles" num="F"
        importHint="Excel columns: Option, Mode, Rate. Mode can be Auto edges or Manual ft."
        onImport={file => importCatalogExcel(file, "edgeOptions")}
        cols={["Option", "Mode", "Rate ₹/ft"]}
        rows={s.edgeOptions || []}
        render={(o, i) => (
          <>
            <td><input value={o.name} onChange={e => editCatalog("edgeOptions", i, "name", e.target.value)} /></td>
            <td style={{ width: 120 }}>
              <select value={o.mode || "auto"} onChange={e => editCatalog("edgeOptions", i, "mode", e.target.value)}>
                <option value="auto">Auto edges</option>
                <option value="manual">Manual ft</option>
              </select>
            </td>
            <td className="num"><input className="num-input" type="number" value={o.rate} onChange={e => editCatalog("edgeOptions", i, "rate", e.target.value)} /></td>
          </>
        )}
        onAdd={() => addCatalogRow("edgeOptions", { name: "New Edge Profile", mode: "auto", rate: 0 })}
        onDel={i => delCatalogRow("edgeOptions", i)} />

      {/* Profile Extras */}
      <CatalogCard title="Profile Extras" num="G"
        importHint="Excel columns: Item, Rate. These appear in the Profile Extras quote section and users enter required mm there."
        onImport={file => importCatalogExcel(file, "profileExtras")}
        cols={["Item", "Rate ₹/ft"]}
        rows={s.profileExtras || []}
        render={(o, i) => (
          <>
            <td><input value={o.name} onChange={e => editCatalog("profileExtras", i, "name", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" value={o.basePrice} onChange={e => editCatalog("profileExtras", i, "basePrice", e.target.value)} /></td>
          </>
        )}
        onAdd={() => addCatalogRow("profileExtras", { name: "New Profile Extra", unit: "mm", basePrice: 0 })}
        onDel={i => delCatalogRow("profileExtras", i)} />

      {/* Accessories */}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, margin: "0 0 -6px" }}>
        <span className="hint" style={{ marginRight: "auto", color: "var(--ink-4)", fontSize: 12 }}>
          Tip: import your master price &amp; weight list (.xlsx) — columns Item Name, Unit, Quote, Weight.
        </span>
        <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
          <Icon name="cloudup" /> Import from Excel
          <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
            onChange={e => { importExcel(e.target.files[0]); e.target.value = ""; }} />
        </label>
      </div>
      <CatalogCard title="Accessories & Hardware" num="H"
        cols={["Item", "Category", "Unit", "Base Price ₹", "Weight (kg)"]}
        rows={s.accessories}
        render={(a, i) => (
          <>
            <td><input value={a.name} onChange={e => editCatalog("accessories", i, "name", e.target.value)} /></td>
            <td style={{ width: 130 }}><input value={a.category || ""} onChange={e => editCatalog("accessories", i, "category", e.target.value)} /></td>
            <td style={{ width: 84 }}>
              <select value={a.unit} onChange={e => editCatalog("accessories", i, "unit", e.target.value)}>
                <option value="pc">pc</option>
                <option value="ft">ft</option>
              </select>
            </td>
            <td className="num"><input className="num-input" type="number" value={a.basePrice} onChange={e => editCatalog("accessories", i, "basePrice", e.target.value)} /></td>
            <td className="num"><input className="num-input" type="number" step="0.0001" value={a.weightKg == null ? "" : a.weightKg} onChange={e => editCatalog("accessories", i, "weightKg", e.target.value)} /></td>
          </>
        )}
        onAdd={() => addCatalogRow("accessories", { name: "New item", category: "", unit: "pc", basePrice: 0, weightKg: "" })}
        onDel={i => delCatalogRow("accessories", i)} />

      {/* Weights — added to every quotation total weight */}
      <CatalogCard title="Weights (kg)" num="I"
        importHint="Excel columns: Item, Weight."
        onImport={file => importCatalogExcel(file, "weights")}
        cols={["Item", "Weight (kg)"]}
        rows={s.weights || []}
        render={(w, i) => (
          <>
            <td><input value={w.item} onChange={e => editCatalog("weights", i, "item", e.target.value)} placeholder="e.g. Empty case body" /></td>
            <td className="num"><input className="num-input" type="number" step="0.01" value={w.kg} onChange={e => editCatalog("weights", i, "kg", e.target.value)} placeholder="0" /></td>
          </>
        )}
        onAdd={() => addCatalogRow("weights", { item: "New item", kg: "" })}
        onDel={i => delCatalogRow("weights", i)} />

      {/* Terms */}
      <Card title="Default Terms & Conditions" num="J">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {s.terms.map((t, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span className="mono" style={{ color: "var(--ink-4)", fontSize: 12, paddingTop: 10, width: 20 }}>{i + 1}.</span>
              <textarea style={{ minHeight: 44 }} value={t} onChange={e => setTerm(i, e.target.value)} />
              <button className="btn btn-danger-ghost" onClick={() => delTerm(i)} title="Remove"><Icon name="trash" /></button>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <button className="btn-addrow" onClick={addTerm}><Icon name="plus" /> Add term</button>
        </div>
      </Card>

      <div className="formfoot">
        <div className="spacer" />
        <button className="btn btn-red" onClick={save}><Icon name="save" /> Save Settings</button>
      </div>
    </div>
  );
}

function Card({ title, num, children }) {
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">{num}</span><h3>{title}</h3></div>
      <div className="section-body">{children}</div>
    </div>
  );
}

function CatalogCard({ title, num, cols, rows, render, onAdd, onDel, onImport, importHint }) {
  return (
    <div className="card section-card">
      <div className="section-head"><span className="num">{num}</span><h3>{title}</h3>
        <span className="hint">{rows.length} item{rows.length === 1 ? "" : "s"}</span>
        {onImport && (
          <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer", marginLeft: 8 }}>
            <Icon name="cloudup" /> Import Excel
            <input type="file" accept=".xlsx,.xls" style={{ display: "none" }}
              onChange={e => { onImport(e.target.files[0]); e.target.value = ""; }} />
          </label>
        )}
      </div>
      {importHint && <div className="note" style={{ padding: "10px 24px 0", color: "var(--ink-3)", fontSize: 12 }}>{importHint}</div>}
      <div className="table-wrap">
        <table className="tbl">
          <thead>
            <tr>{cols.map((c, i) => <th key={i} className={i === 0 ? "" : "num"}>{c}</th>)}<th></th></tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>{render(row, i)}<td><button className="btn btn-danger-ghost" onClick={() => onDel(i)} title="Remove"><Icon name="trash" /></button></td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-add"><button className="btn-addrow" onClick={onAdd}><Icon name="plus" /> Add row</button></div>
    </div>
  );
}
