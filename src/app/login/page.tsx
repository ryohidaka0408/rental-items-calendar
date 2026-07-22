"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FirebaseError } from "firebase/app";
import { useAuth } from "@/lib/auth-context";

type Mode = "signIn" | "signUp";

function translateAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    switch (error.code) {
      case "auth/invalid-credential":
      case "auth/wrong-password":
      case "auth/user-not-found":
        return "メールアドレスまたはパスワードが正しくありません";
      case "auth/email-already-in-use":
        return "このメールアドレスは既に登録されています";
      case "auth/weak-password":
        return "パスワードは6文字以上で入力してください";
      case "auth/invalid-email":
        return "メールアドレスの形式が正しくありません";
      case "auth/popup-closed-by-user":
        return "ログインがキャンセルされました";
      default:
        return "認証に失敗しました。時間を置いて再度お試しください";
    }
  }
  return "認証に失敗しました。時間を置いて再度お試しください";
}

export default function LoginPage() {
  const { user, loading, signInWithEmail, signUpWithEmail, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
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
      if (mode === "signIn") {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password, displayName);
      }
      router.replace("/");
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setSubmitting(true);
    setError(null);
    try {
      await signInWithGoogle();
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
        <p className="mt-1 text-sm text-muted">
          {mode === "signIn" ? "ログインしてください" : "新しいアカウントを作成します"}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {mode === "signUp" && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-ink">表示名</span>
              <input
                type="text"
                required
                className="rounded-md border border-line px-3 py-2 text-sm"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
          )}
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
            {mode === "signIn" ? "ログイン" : "登録する"}
          </button>
        </form>

        <div className="mt-4 flex items-center gap-3 text-xs text-muted">
          <span className="h-px flex-1 bg-line" />
          または
          <span className="h-px flex-1 bg-line" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting}
          className="mt-4 w-full rounded-md border border-line px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-surface disabled:opacity-50"
        >
          Googleアカウントでログイン
        </button>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signIn" ? "signUp" : "signIn");
            setError(null);
          }}
          className="mt-6 w-full text-center text-sm font-medium text-brand hover:underline"
        >
          {mode === "signIn"
            ? "アカウントをお持ちでない方はこちら"
            : "既にアカウントをお持ちの方はこちら"}
        </button>
      </div>
    </div>
  );
}
