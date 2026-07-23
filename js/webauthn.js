// Biometric unlock (Face ID / Touch ID / Windows Hello / Android biometrics)
// using the real browser WebAuthn API — no simulation, this is the actual
// platform authenticator prompt.
//
// Honest limitation: full production WebAuthn requires a server to issue
// unpredictable challenges and verify attestation/assertion signatures
// (so a compromised client can't forge a login). This app has no accounts
// server, so the challenge is generated client-side and the credential ID
// is simply checked for a match — that's enough to gate the local UI and
// prove "the device's biometric sensor approved," but it is not a
// server-verified auth flow. See README for how to harden this behind a
// real backend.

const MoneyOSWebAuthn = (() => {
  const supported = () =>
    typeof window !== 'undefined' &&
    window.PublicKeyCredential &&
    navigator.credentials;

  function randomChallenge() {
    return crypto.getRandomValues(new Uint8Array(32));
  }

  async function platformAuthenticatorAvailable() {
    if (!supported()) return false;
    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  async function register(username) {
    if (!supported()) throw new Error('WebAuthn is not supported in this browser.');
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: randomChallenge(),
        rp: { name: 'MoneyOS' },
        user: { id: userId, name: username, displayName: username },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },   // ES256
          { type: 'public-key', alg: -257 }  // RS256
        ],
        authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
        timeout: 60000,
        attestation: 'none'
      }
    });
    if (!cred) throw new Error('Registration was cancelled.');
    const credIdB64 = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    return credIdB64;
  }

  async function verify(credIdB64) {
    if (!supported()) throw new Error('WebAuthn is not supported in this browser.');
    const rawId = Uint8Array.from(atob(credIdB64), c => c.charCodeAt(0));
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomChallenge(),
        allowCredentials: [{ id: rawId, type: 'public-key' }],
        userVerification: 'required',
        timeout: 60000
      }
    });
    return !!assertion;
  }

  return { supported, platformAuthenticatorAvailable, register, verify };
})();
