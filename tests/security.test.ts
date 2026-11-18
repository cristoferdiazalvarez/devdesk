import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  digest,
  hashPassword,
  scope,
  verifyPassword,
} from "../apps/api/src/security";

describe("seguridad", () => {
  it("deriva hashes con sal única y comprueba credenciales", async () => {
    const password = randomUUID();
    const first = await hashPassword(password);
    expect(await hashPassword(password)).not.toBe(first);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("secreto erróneo", first)).toBe(false);
    expect(await verifyPassword(password)).toBe(false);
    expect(digest("token")).toHaveLength(64);
  });
  it("limita el ámbito según el rol", () => {
    expect(scope({ id: "x", role: "CUSTOMER" })).toEqual({ ownerId: "x" });
    expect(scope({ id: "x", role: "AGENT" })).toEqual({ assigneeId: "x" });
    expect(scope({ id: "x", role: "ADMIN" })).toEqual({});
  });
});
