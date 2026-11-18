import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Prisma, Role } from "./generated/client.js";

const derive = (password: string, salt: Buffer) =>
  new Promise<Buffer>((resolve, reject) => {
    scrypt(
      password,
      salt,
      64,
      { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  return (
    salt.toString("hex") + ":" + (await derive(password, salt)).toString("hex")
  );
}
export async function verifyPassword(password: string, stored?: string) {
  const valid = stored && /^[a-f0-9]{32}:[a-f0-9]{128}$/.test(stored);
  const [salt, key] = valid
    ? stored.split(":")
    : ["0".repeat(32), "0".repeat(128)];
  const derived = await derive(password, Buffer.from(salt, "hex"));
  return timingSafeEqual(derived, Buffer.from(key, "hex")) && Boolean(valid);
}
export const digest = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export function scope(user: {
  id: string;
  role: Role;
}): Prisma.TicketWhereInput {
  if (user.role === "ADMIN") return {};
  if (user.role === "AGENT") return { assigneeId: user.id };
  return { ownerId: user.id };
}
