/* ============================================================
   Custom login (FRONTEND ONLY)
   ------------------------------------------------------------
   NOTE: This is a client-side gate. It stops casual access but
   is not strong security — the page is downloadable and the
   backend functions are not protected by it. For real access
   control, verify the login on the backend too.
   ============================================================ */

/* ----- USER ACCOUNTS -------------------------------------------------
   To add a team member: open the app's login screen, expand
   "Add a user (generate hash)", type their password, copy the hash,
   and add a new line below. Then redeploy. Passwords are never stored
   in plain text here — only their SHA-256 hash.

   Starter account (CHANGE THIS):  username "admin"  password "Orion@123"
--------------------------------------------------------------------- */
const AUTH_SALT = "orion-qg";
const APP_USERS = [
  { username: "admin", name: "Administrator", hash: "59861b075e0f104e38e8bc5069d4b84e6052b432afac97d6ac2e0ead90d00f8a" },
  // { username: "poojan", name: "Poojan", hash: "<paste hash here>" },
  // { username: "sales",  name: "Sales Desk", hash: "<paste hash here>" },
];

const AUTH_KEY = "orion_auth_user";

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function verifyLogin(username, password) {
  const uname = String(username || "").trim().toLowerCase();
  const u = APP_USERS.find(x => x.username.toLowerCase() === uname);
  if (!u) return null;
  const h = await sha256Hex(AUTH_SALT + ":" + password);
  return h === u.hash ? { username: u.username, name: u.name || u.username } : null;
}

function getSession() {
  try { const raw = localStorage.getItem(AUTH_KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function setSession(user) { try { localStorage.setItem(AUTH_KEY, JSON.stringify(user)); } catch (e) {} }
function clearSession() { try { localStorage.removeItem(AUTH_KEY); } catch (e) {} }

function LoginGate({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTool, setShowTool] = useState(false);
  const [toolPwd, setToolPwd] = useState("");
  const [toolHash, setToolHash] = useState("");

  const submit = async () => {
    setError(""); setBusy(true);
    try {
      const user = await verifyLogin(username, password);
      if (!user) { setError("Incorrect username or password."); setBusy(false); return; }
      setSession(user);
      onLogin(user);
    } catch (e) {
      setError("Login error: " + e.message); setBusy(false);
    }
  };

  const genHash = async () => {
    if (!toolPwd) { setToolHash(""); return; }
    setToolHash(await sha256Hex(AUTH_SALT + ":" + toolPwd));
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <img className="login-logo" src="assets/orion-logo.png" alt="Orion Flexipack" />
        <div className="login-title">Quotation Generator</div>
        <div className="login-sub">Sign in to continue</div>

        <label className="login-label">Username</label>
        <input className="login-input" value={username} autoFocus
          onChange={e => setUsername(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="username" />

        <label className="login-label">Password</label>
        <input className="login-input" type="password" value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()} placeholder="password" />

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-red login-btn" onClick={submit} disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button className="login-tool-toggle" onClick={() => setShowTool(!showTool)}>
          {showTool ? "− Hide" : "+ Add a user (generate hash)"}
        </button>
        {showTool && (
          <div className="login-tool">
            <p>Type a password to get its hash, then add a line to <code>APP_USERS</code> in <code>auth.jsx</code> and redeploy.</p>
            <input className="login-input" value={toolPwd} onChange={e => setToolPwd(e.target.value)}
              onKeyUp={genHash} placeholder="password to hash" />
            {toolHash && <code className="login-hash">{toolHash}</code>}
          </div>
        )}
      </div>
    </div>
  );
}
