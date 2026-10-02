import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Iniciar sesión — JAV Wireless" }, { name: "description", content: "Inicia sesión en tu cuenta de JAV Wireless." }, { property: "og:title", content: "Iniciar sesión — JAV Wireless" }, { property: "og:description", content: "Accede a tu cuenta de JAV Wireless." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

async function goAfterLogin(navigate: ReturnType<typeof useNavigate>) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
  navigate({ to: isAdmin === true ? "/panel" : "/" });
}

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onGoogle() {
    setMsg(""); setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    setBusy(false);
    if (result.error) return setMsg("No se pudo iniciar sesión con Google.");
    if (result.redirected) return;
    await goAfterLogin(navigate);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg("Correo o contraseña incorrectos.");
      await goAfterLogin(navigate);
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth` } });
      setBusy(false);
      if (error) return setMsg(error.message);
      if (data.session) await goAfterLogin(navigate);
      else setMsg("Te enviamos un correo para confirmar tu cuenta.");
    }
  }

  return (
    <section className="section-pad"><div className="container-page max-w-md">
      <form onSubmit={onSubmit} className="card-soft space-y-4 p-8">
        <Lock className="size-8 text-primary" />
        <h1 className="font-display text-3xl font-bold text-primary">{mode === "in" ? "Iniciar sesión" : "Crear cuenta"}</h1>
        <p className="text-sm text-muted-foreground">Accede a tu cuenta de JAV Wireless.</p>
        <Button type="button" variant="outline" className="w-full border-primary text-primary" disabled={busy} onClick={onGoogle}>
          <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true"><path fill="currentColor" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3zM12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22zM6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9zM12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10C7.2 7.8 9.4 6 12 6z"/></svg>
          Continuar con Google
        </Button>
        <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />o con tu correo<span className="h-px flex-1 bg-border" /></div>
        <label className="grid gap-1.5 text-sm font-semibold">Correo<input required type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Contraseña<input required type="password" minLength={8} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <p className="text-sm font-semibold text-accent">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Procesando..." : mode === "in" ? "Entrar" : "Crear cuenta"}</Button>
        <button type="button" className="w-full text-sm font-semibold text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta"}</button>
      </form>
    </div></section>
  );
}
