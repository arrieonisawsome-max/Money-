/* MoneyOS — boot sequence, security gates, PWA wiring */

let deferredInstallPrompt = null;

function openSidebar() { document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebar-overlay').classList.add('open'); }
function closeSidebarMobile() { document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebar-overlay').classList.remove('open'); }

function startApp(state) {
  STATE = state;
  logDailyActivity(STATE);
  ensureWeeklyMissions(STATE);
  checkDueAutopay(STATE);
  runNotificationChecks(STATE);
  checkBadges(STATE);
  document.documentElement.setAttribute('data-theme', STATE.profile.theme || 'dark');
  document.getElementById('boot-gate').style.display = 'none';
  document.getElementById('app-root').style.display = 'flex';
  document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  renderSidebar();
  renderPage();
  save();
  updateOnlineStatus();
  handleShortcutParams();
}

function handleShortcutParams() {
  const params = new URLSearchParams(location.search);
  const page = params.get('page');
  if (page) navigate(page);
  if (params.get('action') === 'add-transaction') openAddTransaction();
  if (page || params.get('action')) history.replaceState({}, '', location.pathname);
}

async function boot() {
  const lockedBlob = localStorage.getItem(LOCK_KEY);
  if (lockedBlob) {
    showPassphraseGate(JSON.parse(lockedBlob));
    return;
  }
  const plain = localStorage.getItem(STATE_KEY);
  const state = plain ? JSON.parse(plain) : seedState();
  postDecryptGates(state);
}

function showPassphraseGate(blob) {
  const gate = document.getElementById('boot-gate');
  gate.innerHTML = `
    <div class="lock-card">
      <div class="logo-text">MoneyOS</div>
      <p>Enter your passphrase to unlock your data.</p>
      <input type="password" id="unlock-pass" placeholder="Passphrase" />
      <button class="btn-primary" onclick="tryUnlock()">Unlock</button>
      <div id="unlock-error" style="color:var(--red);margin-top:8px;font-size:12px"></div>
    </div>`;
  window.__lockedBlob = blob;
}
async function tryUnlock() {
  const pass = document.getElementById('unlock-pass').value;
  try {
    const state = await MoneyOSCrypto.decryptJSON(window.__lockedBlob, pass);
    window.__moneyosPass = pass;
    postDecryptGates(state);
  } catch {
    document.getElementById('unlock-error').textContent = 'Wrong passphrase.';
  }
}

async function postDecryptGates(state) {
  if (state.security.totpEnabled) {
    const ok = await gateTotp(state);
    if (!ok) return;
  }
  if (state.security.biometricEnabled) {
    const ok = await gateBiometric(state);
    if (!ok) return;
  }
  startApp(state);
}

function gateTotp(state) {
  return new Promise((resolve) => {
    const gate = document.getElementById('boot-gate');
    gate.innerHTML = `<div class="lock-card"><div class="logo-text">MoneyOS</div><p>Enter your 6-digit 2FA code.</p><input id="totp-code" placeholder="123456" /><button class="btn-primary" onclick="__totpSubmit()">Verify</button><div id="totp-error" style="color:var(--red);margin-top:8px;font-size:12px"></div></div>`;
    window.__totpSubmit = async () => {
      const code = document.getElementById('totp-code').value;
      const ok = await MoneyOSCrypto.verifyTotp(state.security.totpSecret, code);
      if (ok) resolve(true); else document.getElementById('totp-error').textContent = 'Invalid code.';
    };
  });
}
function gateBiometric(state) {
  return new Promise((resolve) => {
    const gate = document.getElementById('boot-gate');
    gate.innerHTML = `<div class="lock-card"><div class="logo-text">MoneyOS</div><p>Confirm with Face ID / Touch ID / Windows Hello.</p><button class="btn-primary" onclick="__bioSubmit()">Unlock</button><div id="bio-error" style="color:var(--red);margin-top:8px;font-size:12px"></div></div>`;
    window.__bioSubmit = async () => {
      try { const ok = await MoneyOSWebAuthn.verify(state.security.biometricCredId); if (ok) resolve(true); }
      catch { document.getElementById('bio-error').textContent = 'Biometric check failed or was cancelled.'; }
    };
  });
}

function updateOnlineStatus() {
  const el = document.getElementById('online-status');
  if (el) el.textContent = navigator.onLine ? '🟢 Online' : '🔴 Offline — money data still fully usable.';
}
window.addEventListener('online', updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('install-btn');
  if (btn) btn.style.display = 'inline-block';
});
function installPWA() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  deferredInstallPrompt = null;
}

if (window.Notification && Notification.permission === 'default') {
  window.addEventListener('click', function requestOnce() {
    Notification.requestPermission();
    window.removeEventListener('click', requestOnce);
  }, { once: true });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}

document.addEventListener('DOMContentLoaded', boot);
