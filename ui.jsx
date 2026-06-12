/* ============================================================
   Shared UI: icons + small components
   ============================================================ */
const { useState, useEffect, useMemo, useRef } = React;

// --- Icon set (stroke, 24 viewBox) ---
const Icon = ({ name, ...rest }) => {
  const paths = {
    plus: <path d="M12 5v14M5 12h14" />,
    file: <><path d="M14 3v5h5" /><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>,
    copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
    download: <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 21h14" /></>,
    back: <path d="M15 18l-6-6 6-6" />,
    check: <path d="M20 6 9 17l-5-5" />,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="M3 8l9 5 9-5M12 13v8" /></>,
    layers: <><path d="m12 2 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 17l9 5 9-5" /></>,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    sliders: <><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
    rupee: <><path d="M6 4h12M6 8h12M6 13c5 0 8-1 8-4.5M6 4c8 0 8 9 0 9l7 7" /></>,
    print: <><path d="M6 9V3h12v6" /><rect x="6" y="14" width="12" height="7" /><path d="M6 17H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" /></>,
    save: <><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" /><path d="M17 21v-8H7v8M7 3v5h8" /></>,
    mail: <><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m2 7 10 6 10-6" /></>,
    cloudup: <><path d="M17.5 19a4.5 4.5 0 0 0 .5-9 6 6 0 0 0-11.6-1.5A4 4 0 0 0 6.5 19" /><path d="M12 19v-7m-3 3 3-3 3 3" /></>,
    send: <><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4z" /></>,
    link: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></>,
    truck: <><path d="M10 17h4V5H2v12h3" /><path d="M14 8h4l3 3v6h-3" /><circle cx="7.5" cy="17.5" r="1.5" /><circle cx="17.5" cy="17.5" r="1.5" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name]}
    </svg>
  );
};

// --- Currency display: ₹ symbol + tabular number ---
const Money = ({ value, dp }) => (
  <span className="mono"><span style={{ opacity: 0.55, marginRight: 1 }}>₹</span>{inr(value, dp)}</span>
);

// --- Labeled field wrapper ---
const Field = ({ label, opt, unit, children }) => (
  <div className="field">
    {label && <label>{label}{opt && <span className="opt">  ({opt})</span>}</label>}
    {unit ? (
      <div className="unit-row">{children}<span className="unit">{unit}</span></div>
    ) : children}
  </div>
);

// A controlled number input that allows clean typing
const NumInput = ({ value, onChange, unit, step, min, className, placeholder }) => {
  const inner = (
    <input
      type="number"
      className={"num-input has-unit-maybe " + (unit ? "has-unit " : "") + (className || "")}
      value={value}
      step={step || "any"}
      min={min}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value === "" ? "" : e.target.value)}
      onFocus={e => e.target.select()}
    />
  );
  if (unit) return <div className="unit-row">{inner}<span className="unit">{unit}</span></div>;
  return inner;
};
