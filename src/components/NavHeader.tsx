"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getUserLabel, useAuth } from "@/lib/auth-context";

const NAV_ITEMS = [
  { href: "/", label: "カレンダー" },
  { href: "/equipment", label: "機器一覧" },
];

export function NavHeader() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-paper">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <span className="text-lg font-semibold text-ink">機器レンタル管理</span>
          <nav className="flex gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    active ? "bg-brand text-white" : "text-muted hover:bg-surface hover:text-ink"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {user && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-ink">{getUserLabel(user)}</span>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-md border border-line px-3 py-1.5 font-medium text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              ログアウト
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
