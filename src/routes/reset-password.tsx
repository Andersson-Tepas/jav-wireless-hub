import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a new password — JAV Wireless" },
      {
        name: "description",
        content: "Choose a new password for your JAV Wireless account.",
      },
      {
        property: "og:title",
        content: "Set a new password — JAV Wireless",
      },
      {
        property: "og:description",
        content: "Choose a new password for your JAV Wireless account.",
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
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<
    "checking" | "form" | "invalid" | "done"
  >("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (mounted && event === "PASSWORD_RECOVERY") {
        setPhase("form");
      }
    });

    // The recovery link signs the user in through the URL hash; give the
    // auth client a moment to consume it before declaring the link invalid.
    const timer = setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mounted) return;
        if (session?.user) {
          setPhase("form");
        } else {
          setPhase((p) => (p === "checking" ? "invalid" : p));
        }
      });
    }, 1500);

    return () => {
      mounted = false;
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMsg("");

    if (password.length < 8) {
      setMsg("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMsg("Passwords do not match.");
      return;
    }

    setBusy(true);

    const { error } = await supabase.auth.updateUser({ password });

    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    // The recovery session is temporary; sign out so the user signs in
    // normally with their new password.
    await supabase.auth.signOut();

    setPhase("done");
  }

  return (
    <section className="section-pad">
      <div className="container-page max-w-md">
        <div className="card-soft space-y-4 p-8">
          {phase === "checking" && (
            <p className="text-sm text-muted-foreground">
              Checking your reset link…
            </p>
          )}

          {phase === "invalid" && (
            <>
              <AlertTriangle className="size-8 text-accent" />

              <h1 className="font-display text-3xl font-bold text-primary">
                Link expired
              </h1>

              <p className="text-sm text-muted-foreground">
                This password reset link is invalid or has expired. Request a
                new one and try again.
              </p>

              <Button asChild className="w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
            </>
          )}

          {phase === "form" && (
            <>
              <Lock className="size-8 text-primary" />

              <h1 className="font-display text-3xl font-bold text-primary">
                Set a new password
              </h1>

              <p className="text-sm text-muted-foreground">
                Choose a new password for your account.
              </p>

              <form onSubmit={onSubmit} className="space-y-4">
                <label className="grid gap-1.5 text-sm font-semibold">
                  New password

                  <input
                    required
                    type="password"
                    minLength={8}
                    className="field"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-semibold">
                  Confirm new password

                  <input
                    required
                    type="password"
                    minLength={8}
                    className="field"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </label>

                {msg && (
                  <p className="text-sm font-semibold text-accent">{msg}</p>
                )}

                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Saving..." : "Save new password"}
                </Button>
              </form>
            </>
          )}

          {phase === "done" && (
            <>
              <CheckCircle2 className="size-8 text-primary" />

              <h1 className="font-display text-3xl font-bold text-primary">
                Password updated
              </h1>

              <p className="text-sm text-muted-foreground">
                Your password has been changed. Sign in with your new password.
              </p>

              <Button
                className="w-full"
                onClick={() => navigate({ to: "/auth" })}
              >
                Go to sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
