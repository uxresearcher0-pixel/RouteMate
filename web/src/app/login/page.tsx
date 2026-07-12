import { redirect } from "next/navigation";
import { Bus, ShieldCheck, UserCog, User } from "lucide-react";
import { dbConnect } from "@/lib/db";
import { Employee, type IEmployee } from "@/lib/models";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { Avatar, Badge, Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const ROLE_META = {
  ADMIN: { label: "Admin", icon: ShieldCheck, color: "red" as const },
  ROUTE_MANAGER: { label: "Route Manager", icon: UserCog, color: "blue" as const },
  EMPLOYEE: { label: "Employee", icon: User, color: "slate" as const },
};

function UserGroup({
  title,
  users,
  needsCode,
}: {
  title: string;
  users: IEmployee[];
  needsCode: boolean;
}) {
  if (users.length === 0) return null;
  return (
    <div>
      <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        {title}
      </h2>
      <ul className="mt-2 space-y-1.5">
        {users.map((u) => {
          const meta = ROLE_META[u.role];
          return (
            <li key={String(u._id)}>
              <form action={login} className="flex items-center gap-1.5">
                <input type="hidden" name="employeeId" value={String(u._id)} />
                {needsCode && (
                  <input
                    type="password"
                    name="accessCode"
                    required
                    placeholder="Access code"
                    className="w-28 shrink-0 rounded-lg border border-slate-200 px-2 py-2 text-xs outline-none focus:border-indigo-400"
                  />
                )}
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:border-indigo-300 hover:bg-indigo-50/40"
                >
                  <Avatar name={u.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{u.name}</span>
                    <span className="text-xs text-slate-400">{u.empCode}</span>
                  </span>
                  <Badge color={meta.color}>
                    <meta.icon size={11} />
                    {meta.label}
                  </Badge>
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default async function LoginPage() {
  const current = await getCurrentUser();
  if (current) redirect("/");

  await dbConnect();
  const employees = await Employee.find().sort({ role: 1, empCode: 1 });
  const admins = employees.filter((e) => e.role === "ADMIN");
  const managers = employees.filter((e) => e.role === "ROUTE_MANAGER");
  const staff = employees.filter((e) => e.role === "EMPLOYEE").slice(0, 6);
  const needsCode = Boolean(process.env.ACCESS_CODE);

  return (
    <div className="mx-auto max-w-md">
      <div className="flex flex-col items-center pt-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-200">
          <Bus size={26} />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">RouteMate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to manage routes, attendance, and seat plans.
        </p>
      </div>

      <Card className="mt-6 space-y-5 p-5">
        <UserGroup title="Admin" users={admins} needsCode={needsCode} />
        <UserGroup title="Route Managers" users={managers} needsCode={needsCode} />
        <UserGroup title="Employees (sample)" users={staff} needsCode={needsCode} />
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        {needsCode
          ? "Enter the access code shared by the transport admin."
          : "Demo sign-in — password/SSO authentication arrives with production rollout."}
      </p>
    </div>
  );
}
