import { redirect } from "next/navigation";
import { AlertCircle, Bus, KeyRound, User } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { login } from "@/app/actions";
import { Card } from "@/components/ui";
import { SubmitButton } from "@/components/pending";

export const dynamic = "force-dynamic";

const INPUT =
  "w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const current = await getCurrentUser();
  if (current) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <div className="flex flex-col items-center pt-8 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-xl shadow-indigo-200">
          <Bus size={26} />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">RouteMate</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sign in to manage routes, attendance, and seat plans.
        </p>
      </div>

      <Card className="mt-6 p-5">
        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800 ring-1 ring-inset ring-rose-200">
            <AlertCircle size={15} className="mt-0.5 shrink-0" />
            Wrong employee ID / mobile number or password. Please try again.
          </div>
        )}
        <form action={login} className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Employee ID or mobile number
            </span>
            <span className="relative block">
              <User
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                name="identifier"
                required
                autoComplete="username"
                placeholder="E001 or 01710000001"
                className={INPUT}
              />
            </span>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-500">
              Password
            </span>
            <span className="relative block">
              <KeyRound
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className={INPUT}
              />
            </span>
          </label>
          <SubmitButton className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
            Sign in
          </SubmitButton>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        Forgot your password? Contact the transport admin to reset it.
      </p>
    </div>
  );
}
