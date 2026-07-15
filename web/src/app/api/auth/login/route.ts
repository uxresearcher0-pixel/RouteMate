import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { dbConnect } from "@/lib/db";
import { Employee, Route } from "@/lib/models";
import { userJson } from "@/lib/api-auth";

/** POST { identifier, password } → { token, user } — same rules as web login:
 *  identifier is an employee code or phone number. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const identifier = String(body.identifier ?? "").trim();
  const password = String(body.password ?? "");
  if (!identifier || !password) {
    return Response.json({ error: "missing credentials" }, { status: 400 });
  }

  await dbConnect();
  const emp = await Employee.findOne({
    $or: [{ empCode: identifier.toUpperCase() }, { phone: identifier }],
  }).select("+passwordHash +apiToken");
  if (!emp?.passwordHash || !(await bcrypt.compare(password, emp.passwordHash))) {
    return Response.json({ error: "invalid credentials" }, { status: 401 });
  }

  if (!emp.apiToken) {
    emp.apiToken = randomBytes(32).toString("hex");
    await emp.save();
  }
  const myRoute = await Route.findOne({ "passengers.employeeId": emp._id });
  return Response.json({
    token: emp.apiToken,
    user: { ...userJson(emp), routeCode: myRoute?.code ?? null },
  });
}
