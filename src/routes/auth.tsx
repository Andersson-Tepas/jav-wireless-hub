import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceso del personal — JAV Wireless" }, { name: "description", content: "Acceso al panel administrativo de JAV Wireless." }, { property: "og:title", content: "Acceso del personal — JAV Wireless" }, { property: "og:description", content: "Panel administrativo protegido." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault(); setMsg(""); setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg("Correo o contraseña incorrectos.");
      navigate({ to: "/panel" });
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/panel` } });
      setBusy(false);
      if (error) return setMsg(error.message);
      if (data.session) navigate({ to: "/panel" });
      else setMsg("Te enviamos un correo para confirmar tu cuenta.");
    }
  }

  return (
    <section className="section-pad"><div className="container-page max-w-md">
      <form onSubmit={onSubmit} className="card-soft space-y-4 p-8">
        <Lock className="size-8 text-primary" />
        <h1 className="font-display text-3xl font-bold text-primary">{mode === "in" ? "Acceso del personal" : "Crear cuenta de personal"}</h1>
        <p className="text-sm text-muted-foreground">Área exclusiva para el equipo de JAV Wireless.</p>
        <label className="grid gap-1.5 text-sm font-semibold">Correo<input required type="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="grid gap-1.5 text-sm font-semibold">Contraseña<input required type="password" minLength={8} className="field" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <p className="text-sm font-semibold text-accent">{msg}</p>}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? "Procesando..." : mode === "in" ? "Entrar" : "Crear cuenta"}</Button>
        <button type="button" className="w-full text-sm font-semibold text-muted-foreground hover:text-primary" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "¿No tienes cuenta? Crear una" : "Ya tengo cuenta"}</button>
      </form>
    </div></section>
  );
}
