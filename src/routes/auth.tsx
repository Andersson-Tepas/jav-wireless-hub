import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PasswordField } from "@/components/password-field";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — JAV Wireless" },
      {
        name: "description",
        content: "Sign in to your JAV Wireless account.",
      },
      {
        property: "og:title",
        content: "Sign in — JAV Wireless",
      },
      {
        property: "og:description",
        content: "Access your JAV Wireless account.",
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
  component: AuthPage,
});

async function goAfterLogin(
  navigate: ReturnType<typeof useNavigate>
) {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) return;

  const { data: isAdmin } = await supabase.rpc("has_role", {
    _user_id: data.user.id,
    _role: "admin",
  });

  navigate({
    to: isAdmin === true ? "/panel" : "/",
  });
}

function AuthPage() {
  const navigate = useNavigate();

  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  /*
   * Detect an existing session.
   * This is also what catches the user after Google redirects
   * back to /auth.
   */
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (mounted && session) {
        await goAfterLogin(navigate);
      }
    }

    void checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        session &&
        (event === "SIGNED_IN" || event === "INITIAL_SESSION")
      ) {
        void goAfterLogin(navigate);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  /*
   * Google login
   */
  async function onGoogle() {
    setMsg("");
    setBusy(true);

    const { lovable } = await import("@/integrations/lovable");
    const { error } = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });

    if (error) {
      console.error("Google login error:", error);
      setBusy(false);
      setMsg("Could not sign in with Google.");
    }
  }

  /*
   * Email login / account creation
   */
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    setMsg("");
    setBusy(true);

    if (mode === "in") {
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      setBusy(false);

      if (error) {
        setMsg("Incorrect email or password.");
        return;
      }

      await goAfterLogin(navigate);
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });

    setBusy(false);

    if (error) {
      setMsg(error.message);
      return;
    }

    if (data.session) {
      await goAfterLogin(navigate);
    } else {
      setMsg("We sent you an email to confirm your account.");
    }
  }

  return (
    <section className="section-pad">
      <div className="container-page max-w-md">
        <form
          onSubmit={onSubmit}
          className="card-soft space-y-4 p-8"
        >
          <Lock className="size-8 text-primary" />

          <h1 className="font-display text-3xl font-bold text-primary">
            {mode === "in" ? "Sign in" : "Create account"}
          </h1>

          <p className="text-sm text-muted-foreground">
            Access your JAV Wireless account.
          </p>

          {/* Google */}
          <Button
            type="button"
            variant="outline"
            className="w-full border-primary text-primary"
            disabled={busy}
            onClick={onGoogle}
          >
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              aria-hidden="true"
            >
              <path
                fill="currentColor"
                d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.8 9.4 6 12 6z"
              />
            </svg>

            Continue with Google
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or with your email
            <span className="h-px flex-1 bg-border" />
          </div>

          {/* Email */}
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

          {/* Password */}
          <PasswordField
            id="auth-password"
            label="Password"
            autoComplete={mode === "in" ? "current-password" : "new-password"}
            minLength={8}
            value={password}
            onChange={setPassword}
          />

          {/* Messages */}
          {msg && (
            <p className="text-sm font-semibold text-accent">
              {msg}
            </p>
          )}

          {/* Login/Create */}
          <Button
            type="submit"
            className="w-full"
            disabled={busy}
          >
            {busy
              ? "Processing..."
              : mode === "in"
                ? "Sign in"
                : "Create account"}
          </Button>

          {/* Switch login / register */}
          <button
            type="button"
            className="w-full text-sm font-semibold text-muted-foreground hover:text-primary"
            onClick={() => {
              setMsg("");
              setMode(mode === "in" ? "up" : "in");
            }}
          >
            {mode === "in"
              ? "Don’t have an account? Create one"
              : "I already have an account"}
          </button>

          {/* Forgot password */}
          <Link
            to="/forgot-password"
            className="block w-full text-center text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            Forgot your password?
          </Link>
        </form>
      </div>
    </section>
  );
}