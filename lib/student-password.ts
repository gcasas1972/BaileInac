import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const keyLength = 64;

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keyLength, (error, key) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(Buffer.from(key));
    });
  });
}

export async function hashStudentPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export async function verifyStudentPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, keyHex, ...extraParts] = storedHash.split(":");
  if (
    extraParts.length > 0 ||
    !/^[0-9a-f]{32}$/i.test(saltHex || "") ||
    !/^[0-9a-f]{128}$/i.test(keyHex || "")
  ) {
    return false;
  }

  const expectedKey = Buffer.from(keyHex, "hex");
  const actualKey = await deriveKey(password, Buffer.from(saltHex, "hex"));
  return timingSafeEqual(actualKey, expectedKey);
}
