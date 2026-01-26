"use client";

import { useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function AuthModal() {
  const { authModalOpen, closeAuthModal } = useAuth();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  const supabase = getSupabaseClient();

  if (!authModalOpen) return null;

  // Step 1: Send OTP code
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (error) throw error;

      setCodeSent(true);
    } catch (err) {
      console.error("Error sending code:", err);
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code,
        type: "email",
      });

      if (error) throw error;

      // Success! Auth context will detect the session change
      handleClose();
    } catch (err) {
      console.error("Error verifying code:", err);
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    closeAuthModal();
    // Reset state after animation
    setTimeout(() => {
      setEmail("");
      setCode("");
      setError(null);
      setCodeSent(false);
    }, 200);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-[100] w-full max-w-md -translate-x-1/2 -translate-y-1/2 animate-in fade-in zoom-in-95 duration-200">
        <div className="glass-panel overflow-hidden">
          {/* Header */}
          <div className="border-b border-foreground/10 px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="font-mono text-sm uppercase tracking-wide text-foreground">
                {codeSent ? "Enter Code" : "Sign In"}
              </h2>
              <button
                onClick={handleClose}
                className="text-foreground/40 transition-colors hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {codeSent ? (
              // OTP verification form
              <form onSubmit={handleVerifyCode}>
                <div className="mb-4 text-center">
                  <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10">
                    <svg
                      className="h-5 w-5 text-accent"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm text-foreground/90">
                    Code sent to <strong>{email}</strong>
                  </p>
                </div>

                <div className="mb-4">
                  <label
                    htmlFor="code"
                    className="mb-2 block font-mono text-xs uppercase text-foreground/70"
                  >
                    8-Digit Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="00000000"
                    required
                    autoFocus
                    autoComplete="one-time-code"
                    className="w-full rounded-md border border-foreground/20 bg-background/50 px-4 py-3 text-center font-mono text-2xl tracking-widest text-foreground placeholder:text-foreground/30 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || code.length !== 8}
                  className="w-full rounded-md bg-accent px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-white transition-all hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying..." : "Verify Code"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCodeSent(false);
                    setCode("");
                    setError(null);
                  }}
                  className="mt-3 w-full text-xs text-foreground/50 hover:text-foreground/70"
                >
                  ← Change email
                </button>
              </form>
            ) : (
              // Email input form
              <form onSubmit={handleSendCode}>
                <div className="mb-4">
                  <label
                    htmlFor="email"
                    className="mb-2 block font-mono text-xs uppercase text-foreground/70"
                  >
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    disabled={loading}
                    className="w-full rounded-md border border-foreground/20 bg-background/50 px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/40 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                  />
                </div>

                {error && (
                  <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full rounded-md bg-accent px-4 py-2.5 font-mono text-xs uppercase tracking-wide text-white transition-all hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Sending..." : "Send Code"}
                </button>

                <p className="mt-4 text-center text-xs text-foreground/50">
                  No password needed. We&apos;ll email you an 8-digit code.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
