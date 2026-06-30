/* ============================================================
   App — state, routing, persistence
   ============================================================ */

const STORAGE_KEY = "orion_quotations_v1";

function loadQuotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw).map(normalizeQuote);
  } catch (e) { /* ignore */ }
  return null;
}
function saveQuotes(quotes) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes)); } catch (e) { /* ignore */ }
}

// Shared backend API. Quotes are saved to Netlify Database through these functions.
// localStorage remains only as a fast offline/cache fallback.
const ORION_BACKEND_API = "https://orionquotes.netlify.app/.netlify/functions";
window.ORION_BACKEND_API = window.ORION_BACKEND_API || ORION_BACKEND_API;
const CLOUD_SAVE_DELAY_MS = 10000;

async function loadQuotesFromCloud() {
  const res = await fetch(ORION_BACKEND_API + "/load-quotes", {
    method: "GET",
    headers: { "Accept": "application/json" },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not load quotations from cloud");
  return Array.isArray(data.quotes) ? data.quotes.map(normalizeQuote) : [];
}

async function saveQuotesToCloud(quotes) {
  const res = await fetch(ORION_BACKEND_API + "/save-quotes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ quotes }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Could not save quotations to cloud");
  return data;
}

// Seed with a couple of realistic sample quotations on first run
function seedQuotes() {
  const a = makeBlankQuote(1);
  a.customer = { name: "Rohit Mehta", company: "Skyline Audio Pvt. Ltd.", address: "Andheri East, Mumbai", gstin: "27AABCS1234K1Z2", phone: "+91 98200 11223", email: "rohit@skylineaudio.in" };
  a.product.name = "Line-Array Speaker Flight Case";
  a.product.ref = "DWG-1042";
  a.status = "approved";
  a.caseDims = { length: 720, width: 520, height: 480, lidHeight: 140 };
  a.date = new Date(Date.now() - 1000 * 60 * 60 * 24 * 9).toISOString().slice(0, 10);

  const b = makeBlankQuote(2);
  b.customer = { name: "Priya Nair", company: "MedTech Instruments", address: "Whitefield, Bengaluru", gstin: "29AAFCM5678P1Z9", phone: "+91 99000 44556", email: "priya.n@medtech.co.in" };
  b.product.name = "Diagnostic Equipment Transit Case";
  b.product.ref = "DWG-1057";
  b.status = "sent";
  b.caseDims = { length: 560, width: 440, height: 300, lidHeight: 110 };
  b.foam = [
    seedFoam("XLPE foam", 540, 420),
    seedFoam("Charcoal foam", 540, 420),
  ];
  b.date = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString().slice(0, 10);

  const c = makeBlankQuote(3);
  c.customer = { name: "Arjun Desai", company: "Falcon Drones", address: "Hinjewadi, Pune", gstin: "", phone: "+91 90000 77889", email: "arjun@falcondrones.in" };
  c.product.name = "UAV Transport Case w/ Custom Cut-outs";
  c.status = "draft";
  c.caseDims = { length: 640, width: 460, height: 260, lidHeight: 100 };

  return [c, b, a].map(normalizeQuote);
}

function nextSeq(quotes) {
  let max = 0;
  quotes.forEach(q => {
    const m = /(\d+)\s*$/.exec(q.quoteNo || "");
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return max + 1;
}
function orionNo(seq) { return "ORION-" + String(seq).padStart(4, "0"); }

function App({ currentUser, onLogout }) {
  const [quotes, setQuotes] = useState(() => loadQuotes() || seedQuotes());
  const [view, setView] = useState("dashboard"); // dashboard | form | preview
  const [activeId, setActiveId] = useState(null);
  const [draft, setDraft] = useState(null); // working copy in the form
  const [syncState, setSyncState] = useState("loading"); // loading | ready | saving | saved | offline
  const [settingsSyncState, setSettingsSyncState] = useState("loading"); // loading | cloud | local
  const [settingsVersion, setSettingsVersion] = useState(0);
  const [lastCloudSave, setLastCloudSave] = useState(null);
  const cloudLoadedRef = useRef(false);
  const skipNextCloudSaveRef = useRef(true);

  // Load shared settings/material master data from Netlify Database once.
  // localStorage remains only as a backup if cloud is unavailable.
  useEffect(() => {
    let cancelled = false;
    loadSettingsFromCloud()
      .then(() => {
        if (cancelled) return;
        setSettingsSyncState("cloud");
        setSettingsVersion(v => v + 1);
      })
      .catch(() => {
        if (!cancelled) setSettingsSyncState("local");
      });
    const onUpdated = () => setSettingsVersion(v => v + 1);
    window.addEventListener(SETTINGS_UPDATED_EVENT, onUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(SETTINGS_UPDATED_EVENT, onUpdated);
    };
  }, []);

  // Load shared quotations from Netlify Database once. If cloud load fails,
  // the app continues with localStorage so the team can still work.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const cloudQuotes = await loadQuotesFromCloud();
        if (cancelled) return;
        if (cloudQuotes.length > 0) {
          skipNextCloudSaveRef.current = true;
          setQuotes(cloudQuotes);
          saveQuotes(cloudQuotes);
        }
        setSyncState("ready");
      } catch (e) {
        if (!cancelled) setSyncState("offline");
      } finally {
        if (!cancelled) cloudLoadedRef.current = true;
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Always keep a local backup, then debounce cloud saves to avoid rate limits.
  useEffect(() => {
    saveQuotes(quotes);

    if (skipNextCloudSaveRef.current) {
      skipNextCloudSaveRef.current = false;
      return;
    }
    if (!cloudLoadedRef.current) return;

    setSyncState("saving");
    const timer = setTimeout(() => {
      saveQuotesToCloud(quotes)
        .then((data) => {
          setLastCloudSave(data.savedAt || new Date().toISOString());
          setSyncState("saved");
        })
        .catch(() => setSyncState("offline"));
    }, CLOUD_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
  }, [quotes]);

  const activeQuote = quotes.find(q => q.id === activeId);

  // --- navigation / actions ---
  const goDashboard = () => { setView("dashboard"); setDraft(null); };

  const newQuote = () => {
    const q = makeBlankQuote(nextSeq(quotes));
    setDraft(q);
    setActiveId(q.id);
    setView("form");
  };

  const openSettings = () => { setView("settings"); setDraft(null); };
  const showInternal = (id) => { if (draft && draft.id === id) commitDraft(draft); setActiveId(id); setView("internal"); };
  const showBom = (id) => { if (draft && draft.id === id) commitDraft(draft); setActiveId(id); setView("bom"); };

  const openQuote = (id) => {
    const q = quotes.find(x => x.id === id);
    if (!q) return;
    setDraft(JSON.parse(JSON.stringify(q)));
    setActiveId(id);
    setView("form");
  };

  const previewQuote = (id) => {
    // if editing the same draft, commit it first
    if (draft && draft.id === id) commitDraft(draft);
    setActiveId(id);
    setView("preview");
  };

  const commitDraft = (d) => {
    setQuotes(prev => {
      const exists = prev.some(q => q.id === d.id);
      if (exists) return prev.map(q => q.id === d.id ? d : q);
      return [d, ...prev];
    });
  };

  const saveDraft = () => {
    if (draft) commitDraft(draft);
    goDashboard();
  };

  // Merge a patch into a stored quote (used by the delivery workflow)
  const updateQuote = (id, patch) => {
    setQuotes(prev => prev.map(q => q.id === id ? { ...q, ...patch } : q));
  };

  const openDelivery = (id) => {
    if (draft && draft.id === id) { commitDraft(draft); setDraft(null); }
    setActiveId(id);
    setView("delivery");
  };

  const saveAndPreview = () => {
    if (draft) { commitDraft(draft); setActiveId(draft.id); setView("preview"); }
  };

  const deleteQuote = (id) => {
    if (!window.confirm("Delete this quotation? This cannot be undone.")) return;
    const filtered = quotes.filter(q => q.id !== id);
    // Skip the 10-second debounce — destructive actions must save to cloud immediately.
    skipNextCloudSaveRef.current = true;
    setQuotes(filtered);
    saveQuotes(filtered);
    setSyncState("saving");
    saveQuotesToCloud(filtered)
      .then(data => { setLastCloudSave(data.savedAt || new Date().toISOString()); setSyncState("saved"); })
      .catch(() => setSyncState("offline"));
  };

  const duplicateQuote = (id) => {
    const q = quotes.find(x => x.id === id);
    if (!q) return;
    const copy = JSON.parse(JSON.stringify(q));
    copy.id = uid("q");
    copy.quoteNo = orionNo(nextSeq(quotes));
    copy.status = "draft";
    copy.date = new Date().toISOString().slice(0, 10);
    setQuotes(prev => [copy, ...prev]);
  };

  // For preview/internal accessed from dashboard (not from a live draft)
  const previewSource = (draft && (view === "preview" || view === "internal" || view === "bom")) ? draft : activeQuote;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="assets/orion-logo.png" alt="Orion Flexipack" />
          <div className="divider" />
          <div className="app-name">Quotation Generator<span>Flight Cases &amp; Foam Inserts</span></div>
        </div>
        <nav className="topnav">
          <button className={view === "dashboard" ? "active" : ""} onClick={goDashboard}>Dashboard</button>
          <button className={view === "priceCheck" ? "active" : ""} onClick={() => { setDraft(null); setView("priceCheck"); }}>Price Check</button>
          <button className={(view === "form" || view === "preview" || view === "internal" || view === "bom") ? "active" : ""} onClick={() => { if (view === "dashboard" || view === "priceCheck") newQuote(); }}>
            {view === "preview" ? "Customer Quote" : view === "internal" ? "Internal Costing" : view === "bom" ? "Work Order" : "New Quotation"}
          </button>
          <button className={view === "settings" ? "active" : ""} onClick={openSettings}>Settings</button>
        </nav>
        <div className="spacer" />
        <div className="meta">
          <span className="iso">ISO 9001:2015</span>
          <span className="iso" title={lastCloudSave ? "Last quote cloud save: " + new Date(lastCloudSave).toLocaleString("en-IN") : ""}>
            {syncState === "loading" ? "Quotes: loading" : syncState === "saving" ? "Quotes: saving" : syncState === "saved" ? "Quotes: saved" : syncState === "offline" ? "Quotes: local" : "Quotes: cloud"}
          </span>
          <span className="iso" title="Material/settings master data sync">
            {settingsSyncState === "loading" ? "Settings: loading" : settingsSyncState === "cloud" ? "Settings: cloud" : "Settings: local"}
          </span>
          {currentUser && (
            <span className="user-chip">
              <Icon name="user" /> {currentUser.name}
              <button className="logout-btn" onClick={onLogout} title="Sign out"><Icon name="back" /></button>
            </span>
          )}
        </div>
      </header>

      <main className="main" data-settings-version={settingsVersion}>
        {view === "dashboard" && (
          <Dashboard
            quotes={quotes}
            onNew={newQuote}
            onOpen={openQuote}
            onPreview={previewQuote}
            onInternal={showInternal}
            onDelete={deleteQuote}
            onDuplicate={duplicateQuote}
            onDeliver={openDelivery}
          />
        )}

        {view === "form" && draft && (
          <QuoteForm
            quote={draft}
            onChange={setDraft}
            onSave={saveDraft}
            onPreview={saveAndPreview}
            onBack={goDashboard}
          />
        )}

        {view === "preview" && previewSource && (
          <Preview
            quote={previewSource}
            onBack={goDashboard}
            onEdit={() => openQuote(previewSource.id)}
            onInternal={() => { setActiveId(previewSource.id); setView("internal"); }}
            onBom={() => { setActiveId(previewSource.id); setView("bom"); }}
            onDeliver={() => openDelivery(previewSource.id)}
          />
        )}

        {view === "delivery" && activeQuote && (
          <DeliveryPanel
            quote={activeQuote}
            onUpdate={(patch) => updateQuote(activeQuote.id, patch)}
            onBack={goDashboard}
          />
        )}

        {view === "internal" && previewSource && (
          <InternalCosting
            quote={previewSource}
            onBack={goDashboard}
            onEdit={() => openQuote(previewSource.id)}
            onCustomer={() => { setActiveId(previewSource.id); setView("preview"); }}
            onBom={() => { setActiveId(previewSource.id); setView("bom"); }}
          />
        )}

        {view === "bom" && previewSource && (
          <BomSheet
            quote={previewSource}
            onBack={goDashboard}
            onEdit={() => openQuote(previewSource.id)}
            onCustomer={() => { setActiveId(previewSource.id); setView("preview"); }}
            onInternal={() => { setActiveId(previewSource.id); setView("internal"); }}
          />
        )}

        {view === "settings" && (
          <AdminSettings onClose={goDashboard} onSettingsSaved={() => setSettingsVersion(v => v + 1)} />
        )}

        {view === "priceCheck" && (
          <PriceCheck quotes={quotes} onOpen={openQuote} />
        )}
      </main>
    </div>
  );
}

function Root() {
  const [user, setUser] = useState(getSession());
  if (!user) return <LoginGate onLogin={setUser} />;
  return <App currentUser={user} onLogout={() => { clearSession(); setUser(null); }} />;
}

ReactDOM.createRoot(document.getElementById("root")).render(<Root />);
