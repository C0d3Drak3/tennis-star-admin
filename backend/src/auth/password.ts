import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

const HASH_VERSION = "1";
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const SCRYPT_PARAMETERS = {
  N: 16_384,
  r: 8,
  p: 1,
};

function deriveKey(
  password: string,
  salt: Buffer,
  keyLength: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(key);
    });
  });
}

function parsePasswordHash(hash: string) {
  const parts = hash.split("$");
  if (parts.length !== 8) {
    return null;
  }

  const [
    algorithm,
    version,
    nValue,
    rValue,
    pValue,
    keyLengthValue,
    saltHex,
    keyHex,
  ] = parts;

  if (
    algorithm !== "scrypt" ||
    version !== HASH_VERSION ||
    !nValue ||
    !rValue ||
    !pValue ||
    !keyLengthValue ||
    !saltHex ||
    !keyHex
  ) {
    return null;
  }

  const N = Number(nValue);
  const r = Number(rValue);
  const p = Number(pValue);
  const keyLength = Number(keyLengthValue);

  if (
    !Number.isInteger(N) ||
    N < 16_384 ||
    N > 65_536 ||
    (N & (N - 1)) !== 0 ||
    !Number.isInteger(r) ||
    r < 1 ||
    r > 8 ||
    !Number.isInteger(p) ||
    p < 1 ||
    p > 4 ||
    !Number.isInteger(keyLength) ||
    keyLength < 32 ||
    keyLength > 128 ||
    !/^[\da-f]{32}$/i.test(saltHex) ||
    keyHex.length !== keyLength * 2 ||
    !/^[\da-f]+$/i.test(keyHex)
  ) {
    return null;
  }

  return {
    N,
    r,
    p,
    keyLength,
    salt: Buffer.from(saltHex, "hex"),
    expectedKey: Buffer.from(keyHex, "hex"),
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const options = { ...SCRYPT_PARAMETERS, maxmem: 32 * 1024 * 1024 };
  const key = await deriveKey(password, salt, KEY_LENGTH, options);

  return [
    "scrypt",
    HASH_VERSION,
    SCRYPT_PARAMETERS.N,
    SCRYPT_PARAMETERS.r,
    SCRYPT_PARAMETERS.p,
    KEY_LENGTH,
    salt.toString("hex"),
    key.toString("hex"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash);
  if (!parsed) {
    return false;
  }

  const maxmem = Math.max(
    32 * 1024 * 1024,
    128 * parsed.N * parsed.r + 128 * parsed.r * parsed.p + 1024,
  );
  const actualKey = await deriveKey(password, parsed.salt, parsed.keyLength, {
    N: parsed.N,
    r: parsed.r,
    p: parsed.p,
    maxmem,
  });

  return (
    actualKey.length === parsed.expectedKey.length &&
    timingSafeEqual(actualKey, parsed.expectedKey)
  );
}
