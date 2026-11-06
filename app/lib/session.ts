import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export type Session = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string };
};
const name = "kanban_session";
const lifetime = 60 * 60 * 24 * 30;

export class SessionConfigurationError extends Error {}

export function validateSessionConfiguration() {
  key();
}

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || !/^[a-f\d]{64}$/i.test(secret)) {
    throw new SessionConfigurationError(
      "Set SESSION_SECRET to 64 hexadecimal characters in .env.local",
    );
  }
  return Buffer.from(secret, "hex");
}

export function parseSession(value: unknown): Session {
  const s = value as Partial<Session> & { expires_in?: number };
  const expires =
    s?.expires_at ??
    (typeof s?.expires_in === "number" ? Math.floor(Date.now() / 1000) + s.expires_in : NaN);
  if (
    !s ||
    typeof s.access_token !== "string" ||
    !s.access_token ||
    typeof s.refresh_token !== "string" ||
    !s.refresh_token ||
    !Number.isFinite(expires) ||
    typeof s.user?.id !== "string" ||
    !s.user.id
  ) {
    throw new Error("Invalid session");
  }
  return {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    expires_at: expires,
    user: { id: s.user.id },
  };
}

export async function readSession(): Promise<Session | null> {
  const value = (await cookies()).get(name)?.value;
  if (!value) return null;
  const secret = key();
  try {
    const [iv, tag, data] = value.split(".").map((v) => Buffer.from(v, "base64url"));
    const decipher = createDecipheriv("aes-256-gcm", secret, iv);
    decipher.setAuthTag(tag);
    return parseSession(
      JSON.parse(Buffer.concat([decipher.update(data), decipher.final()]).toString()),
    );
  } catch {
    // A present but invalid cookie must not silently create a different guest.
    throw new Error("Invalid session cookie");
  }
}

export async function writeSession(session: Session) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(session)), cipher.final()]);
  const value = [iv, cipher.getAuthTag(), data].map((v) => v.toString("base64url")).join(".");
  if (value.length > 3800) throw new Error("Session exceeds cookie size limit");
  (await cookies()).set(name, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: lifetime,
  });
}
