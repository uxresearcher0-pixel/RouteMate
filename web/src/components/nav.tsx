"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3, Bus, Home, LogOut, Settings2, Ticket,
} from "lucide-react";
import { logout } from "@/app/actions";

export type NavUser = { name: string; role: string; routeCode?: string } | null;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Admin",
  ROUTE_MANAGER: "Route Manager",
  EMPLOYEE: "Employee",
};

function navLinks(user: NonNullable<NavUser>) {
  return [
    { href: "/", label: "Home", icon: Home, show: true },
    {
      href: user.routeCode ? `/routes/${user.routeCode}` : "/",
      label: "My Trip",
      icon: Ticket,
      show: Boolean(user.routeCode),
    },
    { href: "/reports", label: "Reports", icon: BarChart3, show: true },
    { href: "/admin", label: "Admin", icon: Settings2, show: user.role === "ADMIN" },
  ].filter((l) => l.show);
}

export function TopNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/95 backdrop-blur supports-[backdrop-filter]:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-5 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-900/40">
            <Bus size={16} strokeWidth={2.2} />
          </span>
          <span className="text-sm font-bold tracking-tight text-white">
            RouteMate
          </span>
        </Link>

        {/* inline links: desktop only — mobile uses the bottom tab bar */}
        {user && (
          <nav className="hidden items-center gap-1 md:flex">
            {navLinks(user).map(({ href, label, icon: Icon }) => {
              const active =
                href === "/" ? pathname === "/" : pathname.startsWith(href);
              return (
                <Link
                  key={label}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </Link>
              );
            })}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-3">
          {user ? (
            <>
              <span className="text-right">
                <span className="block text-xs font-semibold text-white">{user.name}</span>
                <span className="block text-[10px] text-slate-400">
                  {ROLE_LABEL[user.role] ?? user.role}
                </span>
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  title="Sign out"
                  className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut size={15} />
                </button>
              </form>
            </>
          ) : (
            <span className="hidden text-xs text-slate-500 sm:block">Banani 11 · Dhaka</span>
          )}
        </div>
      </div>
    </header>
  );
}

/** App-style bottom tab bar — mobile only. */
export function BottomNav({ user }: { user: NavUser }) {
  const pathname = usePathname();
  if (!user) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/70 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around">
        {navLinks(user).map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              className={`flex min-w-16 flex-col items-center gap-0.5 px-3 py-2 text-[10px] font-semibold transition ${
                active ? "text-indigo-600" : "text-slate-400 active:text-slate-600"
              }`}
            >
              <span
                className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                  active ? "bg-indigo-50" : ""
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.4 : 2} />
              </span>
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
