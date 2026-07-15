/** Bearer-token auth for the mobile REST API (web sessions use the cookie). */
import type { NextRequest } from "next/server";
import { dbConnect } from "./db";
import { Employee } from "./models";
import type { UserDoc } from "./auth";

export async function getApiUser(req: NextRequest): Promise<UserDoc | null> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (token.length < 32) return null;
  await dbConnect();
  return Employee.findOne({ apiToken: token });
}

export function unauthorized() {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

/** Serialize an employee for API responses (no secrets). */
export function userJson(u: UserDoc) {
  return {
    id: String(u._id),
    empCode: u.empCode,
    name: u.name,
    gender: u.gender,
    role: u.role,
    phone: u.phone ?? null,
    frontSeatPriority: u.frontSeatPriority,
  };
}
