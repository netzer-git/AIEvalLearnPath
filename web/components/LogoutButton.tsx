"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleLogout() {
    if (submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // even if the API call failed, push to /login — middleware will
      // redirect back to /login on next protected request anyway.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      className="logout-button"
      onClick={handleLogout}
      disabled={submitting}
      aria-label="Sign out"
    >
      {submitting ? "…" : "Sign out"}
    </button>
  );
}
