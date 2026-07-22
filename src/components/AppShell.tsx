"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { NavHeader } from "./NavHeader";

const PUBLIC_PATHS = new Set(["/login"]);

export function AppShell({ children }: { children: ReactNode }) {
  const { user, loading, authorization, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = PUBLIC_PATHS.has(pathname ?? "");
  const isAuthorized = authorization === "authorized";

  useEffect(() => {
    if (loading) return;
    if (!user && !isPublicPath) {
      router.replace("/login");
    } else if (user && isAuthorized && isPublicPath) {
      router.replace("/");
    }
  }, [loading, user, isAuthorized, isPublicPath, router]);

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

  if (authorization === "checking") {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        権限を確認しています...
      </div>
    );
  }

  if (authorization === "denied") {
    return (
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-xl border border-line bg-paper p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-rust">アクセス権がありません</h1>
          <p className="mt-2 text-sm text-muted">
            このアカウントには本システムの利用権限が付与されていません。
            管理者に利用申請を行ってください。
          </p>
          <button
            type="button"
            onClick={() => logout()}
            className="mt-6 rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface"
          >
            別のアカウントでログインする
          </button>
        </div>
      </div>
    );
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
