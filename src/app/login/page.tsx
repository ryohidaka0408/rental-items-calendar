"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/lib/auth-context";

function translateAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "メールアドレスまたはパスワードが正しくありません";
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません";
      default:
        return "認証に失敗しました。時間を置いて再度お試しください";
    }
  }
  return "認証に失敗しました。時間を置いて再度お試しください";
}

export default function LoginPage() {
  const { user, loading, signInWithEmail } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/");
    }
  }, [loading, user, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await signInWithEmail(email, password);
      router.replace("/");
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading || user) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-xl border border-line bg-paper p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-ink">機器レンタル管理システム</h1>
        <p className="mt-1 text-sm text-muted">ログインしてください</p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">メールアドレス</span>
            <input
              type="email"
              required
              className="rounded-md border border-line px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink">パスワード</span>
            <input
              type="password"
              required
              minLength={6}
              className="rounded-md border border-line px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>

          {error && <p className="text-sm text-rust">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            ログイン
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          利用には管理者による事前の利用登録が必要です。
          アカウントをお持ちでない場合は管理者にお問い合わせください。
        </p>
      </div>
    </div>
  );
}
