/* ============================================================
   Dashboard — saved quotations + stats
   ============================================================ */

function Dashboard({ quotes, onNew, onOpen, onPreview, onInternal, onDelete, onDuplicate, onDeliver }) {
  const [q, setQ] = useState("");

  const enriched = useMemo(() =>
    quotes.map(quote => ({ quote, total: calcQuote(quote).grand }))
  , [quotes]);

  const filtered = enriched.filter(({ quote }) => {
    const s = q.trim().toLowerCase();
    if (!s) return true;
    return (quote.quoteNo + " " + quote.customer.name + " " + quote.customer.company)
      .toLowerCase().includes(s);
  });

  const totalValue = enriched.reduce((s, e) => s + e.total, 0);
  const thisMonth = enriched.filter(e => e.quote.date.slice(0, 7) === new Date().toISOString().slice(0, 7));
  const monthValue = thisMonth.reduce((s, e) => s + e.total, 0);
  const drafts = quotes.filter(x => x.status === "draft").length;

  const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

  return (
    <div className="container">
      <div className="page-head">
        <div>
          <div className="eyebrow">Orion Flexipack</div>
          <h1>Quotation Dashboard</h1>
          <div className="sub">Custom flight cases &amp; foam inserts — generate, price and track customer quotations.</div>
        </div>
        <button className="btn btn-red" onClick={onNew}>
          <Icon name="plus" /> New Quotation
        </button>
      </div>

      <div className="stat-grid">
        <div className="card stat">
          <div className="label">Total Quotations</div>
          <div className="value">{quotes.length}</div>
          <div className="delta">{drafts} draft{drafts === 1 ? "" : "s"} in progress</div>
        </div>
        <div className="card stat">
          <div className="label">Total Quoted Value</div>
          <div className="value"><small>₹</small>{inrShort(totalValue)}</div>
          <div className="delta">incl. 18% GST</div>
        </div>
        <div className="card stat">
          <div className="label">This Month</div>
          <div className="value">{thisMonth.length}</div>
          <div className="delta">₹{inrShort(monthValue)} value</div>
        </div>
        <div className="card stat">
          <div className="label">Avg. Quote Value</div>
          <div className="value"><small>₹</small>{inrShort(quotes.length ? totalValue / quotes.length : 0)}</div>
          <div className="delta">across all quotes</div>
        </div>
      </div>

      <div className="toolbar">
        <div className="search">
          <Icon name="search" />
          <input placeholder="Search by quote no, customer or company" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div style={{ flex: 1 }} />
        <span className="note">{filtered.length} of {quotes.length} shown</span>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty">
            <Icon name="file" />
            <h3>{quotes.length === 0 ? "No quotations yet" : "No matches"}</h3>
            <p>{quotes.length === 0 ? "Create your first quotation to get started." : "Try a different search term."}</p>
            {quotes.length === 0 && (
              <div style={{ marginTop: 16 }}>
                <button className="btn btn-primary" onClick={onNew}><Icon name="plus" /> New Quotation</button>
              </div>
            )}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Quote No.</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Total Amount</th>
                  <th style={{ width: 1 }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ quote, total }) => (
                  <tr key={quote.id} className="quote-row" onClick={() => onOpen(quote.id)}>
                    <td><span className="qno">{quote.quoteNo}</span></td>
                    <td>
                      <span className="cust">{quote.customer.name || <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>Unnamed customer</span>}
                        {quote.customer.company && <small>{quote.customer.company}</small>}
                      </span>
                    </td>
                    <td className="mono" style={{ color: "var(--ink-2)", fontSize: 13 }}>{fmtDate(quote.date)}</td>
                    <td><StatusBadge status={quote.status} /></td>
                    <td className="num total"><Money value={total} dp={0} /></td>
                    <td>
                      <div className="row-actions" onClick={e => e.stopPropagation()}>
                        <button className="btn btn-subtle btn-sm" onClick={() => onPreview(quote.id)} title="Customer quote"><Icon name="eye" /></button>
                        <button className="btn btn-subtle btn-sm" onClick={() => onInternal(quote.id)} title="Internal costing"><Icon name="layers" /></button>
                        <button className="btn btn-subtle btn-sm" onClick={() => onDeliver(quote.id)} title="Finalize & deliver"><Icon name="send" /></button>
                        <button className="btn btn-subtle btn-sm" onClick={() => onOpen(quote.id)} title="Edit"><Icon name="edit" /></button>
                        <button className="btn btn-subtle btn-sm" onClick={() => onDuplicate(quote.id)} title="Duplicate"><Icon name="copy" /></button>
                        <button className="btn btn-danger-ghost" onClick={() => onDelete(quote.id)} title="Delete"><Icon name="trash" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { draft: "Draft", sent: "Sent", approved: "Approved", rejected: "Rejected" };
  return <span className={"badge " + status}>{map[status] || status}</span>;
}
