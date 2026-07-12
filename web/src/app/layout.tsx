import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { BottomNav, TopNav } from "@/components/nav";
import { getCurrentUser } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Route } from "@/lib/models";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RouteMate",
  description: "RouteMate — Employee Transport Management System",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#020617",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getCurrentUser();
  let navUser = null;
  if (user) {
    await dbConnect();
    const myRoute = await Route.findOne({ "passengers.employeeId": user._id });
    navUser = {
      name: user.name,
      role: user.role,
      routeCode: myRoute?.code,
    };
  }
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-100/70 text-slate-900">
        <TopNav user={navUser} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 sm:pt-8 md:pb-8">
          <div className="animate-fade-in-up">{children}</div>
        </main>
        <footer className="hidden border-t border-slate-200 py-4 text-center text-xs text-slate-400 md:block">
          Organization Transport Management System · regulars first, guests on
          spare seats, safety up front
        </footer>
        <BottomNav user={navUser} />
      </body>
    </html>
  );
}
