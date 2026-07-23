// Real client-side crypto utilities: AES-256-GCM at-rest encryption for the
// local data blob, and RFC 6238 TOTP for two-factor authentication.
// No external libraries — everything here uses the browser's native
// SubtleCrypto (Web Crypto API).

const MoneyOSCrypto = (() => {
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  // ---------- AES-GCM at-rest encryption (Security > App Lock) ----------

  async function deriveKey(passphrase, saltB64) {
    const salt = saltB64 ? b64ToBuf(saltB64) : crypto.getRandomValues(new Uint8Array(16));
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    return { key, salt };
  }

  async function encryptJSON(obj, passphrase) {
    const { key, salt } = await deriveKey(passphrase);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = enc.encode(JSON.stringify(obj));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
      v: 1,
      salt: bufToB64(salt),
      iv: bufToB64(iv),
      data: bufToB64(cipher)
    };
  }

  async function decryptJSON(payload, passphrase) {
    const { key } = await deriveKey(passphrase, payload.salt);
    const iv = b64ToBuf(payload.iv);
    const cipherBuf = b64ToBuf(payload.data);
    const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipherBuf);
    return JSON.parse(dec.decode(plainBuf));
  }

  function bufToB64(buf) {
    return btoa(String.fromCharCode(...new Uint8Array(buf)));
  }
  function b64ToBuf(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
  }

  // ---------- TOTP (RFC 6238) for 2FA ----------

  const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function randomBase32Secret(length = 20) {
    const bytes = crypto.getRandomValues(new Uint8Array(length));
    let out = '';
    for (let i = 0; i < bytes.length; i++) out += BASE32_ALPHABET[bytes[i] % 32];
    return out;
  }

  function base32ToBytes(base32) {
    const clean = base32.replace(/=+$/, '').toUpperCase();
    let bits = '';
    for (const ch of clean) {
      const idx = BASE32_ALPHABET.indexOf(ch);
      if (idx === -1) continue;
      bits += idx.toString(2).padStart(5, '0');
    }
    const bytes = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    return new Uint8Array(bytes);
  }

  async function hotp(secretBase32, counter) {
    const keyBytes = base32ToBytes(secretBase32);
    const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const counterBuf = new ArrayBuffer(8);
    const view = new DataView(counterBuf);
    // JS numbers are safe up to 2^53; counter (time-based) fits comfortably.
    view.setUint32(4, counter >>> 0);
    view.setUint32(0, Math.floor(counter / 2 ** 32));
    const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBuf));
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code =
      ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 1000000).padStart(6, '0');
  }

  async function totp(secretBase32, forTime = Date.now(), step = 30) {
    const counter = Math.floor(forTime / 1000 / step);
    return hotp(secretBase32, counter);
  }

  // Accept a code within +/- 1 time step to tolerate clock drift.
  async function verifyTotp(secretBase32, code) {
    const now = Date.now();
    for (let drift = -1; drift <= 1; drift++) {
      const candidate = await totp(secretBase32, now + drift * 30000);
      if (candidate === String(code).trim()) return true;
    }
    return false;
  }

  function otpauthUri(secretBase32, accountLabel, issuer = 'MoneyOS') {
    return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}?secret=${secretBase32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }

  return { encryptJSON, decryptJSON, randomBase32Secret, totp, verifyTotp, otpauthUri };
})();
