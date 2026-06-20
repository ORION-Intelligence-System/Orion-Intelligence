// ─── ORION SECURITY MODULE ─────────────────────────────────────────────────
import { getSetting, setSetting } from './db.js';
import { playType, playUnlock, playError, playPanic } from './audio.js';

let unlocked = false;
let inactivityTimer = null;

export async function initSecurity() {
  const pin = await getSetting('pin');
  if (!pin) {
    // First run — no PIN set, unlock directly
    unlocked = true;
    hideLockScreen();
    return;
  }
  showLockScreen();
  setupInactivityTimer();
}

export function setupInactivityTimer() {
  const resetTimer = () => {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(async () => {
      const pin = await getSetting('pin');
      if (pin) lock();
    }, 5 * 60 * 1000); // 5 minutes
  };
  document.addEventListener('mousemove', resetTimer);
  document.addEventListener('keydown', resetTimer);
  resetTimer();
}

export function lock() {
  unlocked = false;
  showLockScreen();
}

export function isUnlocked() {
  return unlocked;
}

// ─── Lock Screen UI ────────────────────────────────────────────────────────
let pinBuffer = '';

export function showLockScreen() {
  const el = document.getElementById('lock-screen');
  if (el) {
    el.style.display = 'flex';
    pinBuffer = '';
    renderPinDots();
  }
}

export function hideLockScreen() {
  const el = document.getElementById('lock-screen');
  if (el) el.style.display = 'none';
}

function renderPinDots() {
  const dots = document.querySelectorAll('.lock-pin-dot');
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinBuffer.length));
}

function showLockError() {
  const err = document.getElementById('lock-error');
  if (err) {
    err.textContent = 'ZUGANG VERWEIGERT';
    err.style.display = 'block';
    setTimeout(() => { err.style.display = 'none'; }, 2000);
  }
  playError();
  pinBuffer = '';
  renderPinDots();
}

window.lockKeyPress = async function(val) {
  if (val === 'del') {
    pinBuffer = pinBuffer.slice(0, -1);
    renderPinDots();
    playType();
    return;
  }
  if (pinBuffer.length >= 6) return;
  pinBuffer += val;
  renderPinDots();
  playType();

  if (pinBuffer.length === 6) {
    const savedPin = await getSetting('pin');
    if (!savedPin) {
      // First time setup: save this as PIN
      await setSetting('pin', pinBuffer);
      unlocked = true;
      hideLockScreen();
      playUnlock();
      showToast('PIN gesetzt. App gesperrt bei Inaktivität.', 'cyan');
      pinBuffer = '';
      return;
    }
    if (pinBuffer === savedPin) {
      unlocked = true;
      hideLockScreen();
      playUnlock();
      pinBuffer = '';
    } else {
      showLockError();
    }
  }
};

// ─── Panic Mode ────────────────────────────────────────────────────────────
export function initPanicMode() {
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'X') {
      activatePanic();
    }
    // Ctrl+Shift+Z to deactivate panic (secret key)
    if (e.ctrlKey && e.shiftKey && e.key === 'Z') {
      deactivatePanic();
    }
  });
}

function activatePanic() {
  const el = document.getElementById('panic-screen');
  if (el) el.classList.add('active');
  playPanic();
}

function deactivatePanic() {
  const el = document.getElementById('panic-screen');
  if (el) el.classList.remove('active');
}

// ─── PIN Management ────────────────────────────────────────────────────────
export async function changePin(newPin) {
  await setSetting('pin', newPin);
  showToast('PIN geändert', 'cyan');
}

export async function removePin() {
  await setSetting('pin', null);
  showToast('PIN entfernt', 'gold');
}

// ─── Toast helper (used across app) ───────────────────────────────────────
export function showToast(msg, type = 'cyan') {
  const colors = { cyan: 'var(--cyan)', red: 'var(--red)', gold: 'var(--gold)', green: 'var(--green)' };
  const el = document.createElement('div');
  el.style.cssText = `
    position:fixed;bottom:24px;right:24px;z-index:10000;
    background:var(--bg-panel);border:1px solid ${colors[type]||colors.cyan};
    color:${colors[type]||colors.cyan};padding:10px 18px;border-radius:6px;
    font-size:12px;font-family:var(--font-mono);letter-spacing:1px;
    box-shadow:0 0 20px ${colors[type]}40;
    animation:slide-up 0.2s ease;
  `;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}
