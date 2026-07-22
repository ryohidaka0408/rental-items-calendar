"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NavHeader } from "./NavHeader";

const PUBLIC_PATHS = new Set(["/login"]);

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = PUBLIC_PATHS.has(pathname ?? "");

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPath) {
      router.replace("/login");
    } else if (user && isPublicPath) {
      router.replace("/");
    }
  }, [loading, user, isPublicPath, router]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return isPublicPath ? <>{children}</> : null;
  }

  if (isPublicPath) {
    return null;
  }

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <NavHeader />
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
