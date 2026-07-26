import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export const PIN_KDF_VERSION = 'scrypt-v1';

const SALT_BYTES = 16;
const KEY_LEN = 64;
/** Practical scrypt work factor for a self-hosted single-user app. */
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

const PIN_PATTERN = /^\d{4,8}$/;

export function isValidPinFormat(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

export function hashPin(pin: string): {
  hashHex: string;
  saltHex: string;
  kdf: string;
} {
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(pin, salt, KEY_LEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return {
    hashHex: derived.toString('hex'),
    saltHex: salt.toString('hex'),
    kdf: PIN_KDF_VERSION,
  };
}

export function verifyPin(
  pin: string,
  storedHashHex: string,
  storedSaltHex: string,
): boolean {
  try {
    const salt = Buffer.from(storedSaltHex, 'hex');
    const expected = Buffer.from(storedHashHex, 'hex');
    if (salt.length === 0 || expected.length === 0) {
      return false;
    }

    const actual = scryptSync(pin, salt, expected.length, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    });

    if (actual.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
