import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock, MailCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Forgot password — JAV Wireless" },
      {
        name: "description",
        content: "Request a password reset email for your JAV Wireless account.",
      },
      {
        property: "og:title",
        content: "Forgot password — JAV Wireless",
      },
      {
        property: "og:description",
        content: "Request a password reset email for your JAV Wireless account.",
      },
      {
        property: "og:type",
        content: "website",
      },
      {
        name: "twitter:card",
        content: "summary",
      },
      {
        name: "robots",
        content: "noindex",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMsg("");
    setBusy(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    setSent(true);
  }

  return (
    <section className="section-pad">
      <div className="container-page max-w-md">
        <div className="card-soft space-y-4 p-8">
          <Lock className="size-8 text-primary" />

          <h1 className="font-display text-3xl font-bold text-primary">
            Forgot password
          </h1>

          {sent ? (
            <>
              <MailCheck className="size-8 text-primary" />

              <p className="text-sm text-muted-foreground">
                If an account exists for{" "}
                <span className="font-semibold text-foreground">{email}</span>,
                we just sent a password reset link. Check your inbox (and spam
                folder) and open the link to set a new password.
              </p>

              <Link
                to="/auth"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Back to sign in
              </Link>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Enter the email on your account and we'll send you a link to
                reset your password.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="grid gap-1.5 text-sm font-semibold">
                  Email

                  <input
                    required
                    type="email"
                    className="field"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>

                {msg && (
                  <p className="text-sm font-semibold text-accent">{msg}</p>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending..." : "Send reset link"}
                </Button>
              </form>

              <Link
                to="/auth"
                className="block w-full text-sm font-semibold text-muted-foreground hover:text-primary"
              >
                Back to sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
