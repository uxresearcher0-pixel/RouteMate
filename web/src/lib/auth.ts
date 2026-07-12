/**
 * Lightweight session for the internal tool: an httpOnly cookie holds the
 * signed-in employee's id ("sign in as" — no passwords in this phase; a real
 * credential/SSO provider slots in here later without touching callers).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Types, type HydratedDocument } from "mongoose";
import { dbConnect } from "./db";
import { Employee, type IEmployee, type IRoute } from "./models";

export type UserDoc = HydratedDocument<IEmployee>;

export const SESSION_COOKIE = "uid";

export async function getCurrentUser(): Promise<UserDoc | null> {
  const store = await cookies();
  const id = store.get(SESSION_COOKIE)?.value;
  if (!id || !Types.ObjectId.isValid(id)) return null;
  await dbConnect();
  return Employee.findById(id);
}

/** Page guard: redirects to /login when signed out. */
export async function requireUser(): Promise<UserDoc> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export function isAdmin(user: IEmployee): boolean {
  return user.role === "ADMIN";
}

/** Manager of THIS route (or admin) — the authority for trip-level actions. */
export function canManageRoute(user: IEmployee, route: IRoute): boolean {
  if (isAdmin(user)) return true;
  return (
    user.role === "ROUTE_MANAGER" &&
    String(route.routeManagerId ?? "") === String(user._id)
  );
}
