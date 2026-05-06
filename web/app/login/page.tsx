"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [from, setFrom] = useState("/");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("from");
    if (fromParam && fromParam.startsWith("/")) setFrom(fromParam);
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passcode || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const status = res.status;
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (status === 503 || data.error === "auth-not-configured") {
          setError(
            "Auth isn't configured on this server (no APP_PASSCODE set).",
          );
        } else {
          setError("Wrong passcode.");
        }
        setSubmitting(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error — try again.");
      setSubmitting(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">AIEvalLearnPath</h1>
        <p className="login-subtitle">28-lesson curriculum on LLM evaluation</p>
        <label htmlFor="passcode" className="login-label">
          Passcode
        </label>
        <input
          id="passcode"
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          className="login-input"
          autoComplete="current-password"
          inputMode="text"
          spellCheck={false}
        />
        <button
          type="submit"
          className="login-button"
          disabled={submitting || passcode.length === 0}
        >
          {submitting ? "Checking…" : "Enter"}
        </button>
        {error && <p className="login-error">{error}</p>}
      </form>
    </div>
  );
}
