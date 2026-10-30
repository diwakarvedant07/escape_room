// Answer protection (spec §8). A deterrent against casual inspection, NOT security:
// everything needed to check an answer ships to the browser.
//  - Gate answers are stored as SHA-256(salt + normalized answer).
//  - Digits are AES-GCM encrypted with a PBKDF2 key derived from the gate's
//    normalized correct answer, so a digit only appears once its gate is passed.
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();
const ITERATIONS = 100000;

function normalize(answer) {
  return String(answer).trim().toLowerCase().replace(/\s+/g, '');
}

function toHex(buf) {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toB64(buf) {
  let s = '';
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(str) {
  const s = atob(str);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function sha256Hex(text) {
  return toHex(await subtle.digest('SHA-256', enc.encode(text)));
}

function hashAnswer(salt, answer) {
  return sha256Hex(salt + normalize(answer));
}

async function checkAnswer(gate, answer) {
  return !!gate && typeof gate.hash === 'string' && gate.hash === (await hashAnswer(gate.salt, answer));
}

// Per-position hashes let the game say "N of M correct" without naming which.
function partHash(salt, index, value) {
  return sha256Hex(salt + ':' + index + '=' + normalize(value));
}

async function countMatches(gate, values) {
  let n = 0;
  for (let i = 0; i < gate.parts.length; i++) {
    if (gate.parts[i] === (await partHash(gate.salt, i, values[i] ?? ''))) n++;
  }
  return n;
}

async function deriveKey(answer, salt) {
  const base = await subtle.importKey('raw', enc.encode(normalize(answer)), 'PBKDF2', false, ['deriveKey']);
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: ITERATIONS, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptText(answer, salt, text) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(answer, salt);
  const ct = await subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text));
  return { salt, iv: toB64(iv), ct: toB64(ct) };
}

async function decryptText(answer, box) {
  try {
    const key = await deriveKey(answer, box.salt);
    const pt = await subtle.decrypt({ name: 'AES-GCM', iv: fromB64(box.iv) }, key, fromB64(box.ct));
    return dec.decode(pt);
  } catch {
    return null;
  }
}

// A gate's digit may have several boxes (stage 5 has two minimal solutions).
async function unlockDigit(gate, answer) {
  if (!gate || !gate.digit) return null;
  const boxes = Array.isArray(gate.digit) ? gate.digit : [gate.digit];
  for (const box of boxes) {
    const text = await decryptText(answer, box);
    if (text !== null) return JSON.parse(text);
  }
  return null;
}

function randomSalt() {
  return toHex(globalThis.crypto.getRandomValues(new Uint8Array(16)));
}

// Canonical answer strings, shared by the game UI and the answer generator.
const keys = {
  sortValues(choices, sceneIds) {
    return sceneIds.map((id) => (choices[id] === 'part' ? 'p' : choices[id] === 'unrelated' ? 'u' : ''));
  },
  sort(choices, sceneIds) {
    return keys.sortValues(choices, sceneIds).map((v, i) => sceneIds[i] + '=' + v).join(',');
  },
  timeline(order) {
    return order.join(',');
  },
  controls(ids) {
    return [...ids].sort().join(',');
  }
};

// The debrief reveal is obfuscated with a fixed passphrase so it is not plain text.
const REVEAL_PASSPHRASE = 'orbit-financial-debrief';

export const protect = {
  ITERATIONS, REVEAL_PASSPHRASE, keys,
  normalize, sha256Hex, hashAnswer, checkAnswer, partHash, countMatches,
  encryptText, decryptText, unlockDigit, randomSalt
};
