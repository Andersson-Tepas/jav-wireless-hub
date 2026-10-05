import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  LogOut,
  Package,
  Route as RouteIcon,
  User,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { User as SbUser } from "@supabase/supabase-js";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function GoogleIcon({
  className = "size-4",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"
      />

      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />

      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />

      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"
      />
    </svg>
  );
}

export function AccountMenu() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [user, setUser] = useState<SbUser | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await qc.cancelQueries();

    qc.clear();

    await supabase.auth.signOut();

    navigate({
      to: "/",
      replace: true,
    });
  }

  if (!user) {
    return (
      <Link
        to="/auth"
        className="
          inline-flex
          h-10
          shrink-0
          items-center
          gap-2
          rounded-md
          border
          border-border
          bg-background
          px-3
          text-sm
          font-semibold
          text-foreground
          transition
          hover:border-primary
          hover:text-primary
          disabled:opacity-60
        "
        aria-label="Sign in with Google"
      >
        <GoogleIcon />

        <span className="hidden whitespace-nowrap 2xl:inline">
          {busy ? "Signing in..." : "Sign in with Google"}
        </span>

        <span className="hidden whitespace-nowrap md:inline 2xl:hidden">
          {busy ? "Signing in..." : "Sign in"}
        </span>
      </button>
    );
  }

  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    name?: string;
    avatar_url?: string;
    picture?: string;
  };

  const name =
    meta.full_name ||
    meta.name ||
    user.email?.split("@")[0] ||
    "My account";

  const avatar =
    meta.avatar_url ||
    meta.picture;

  const itemCls =
    "cursor-pointer gap-2";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="
          inline-flex
          h-10
          items-center
          gap-2
          rounded-md
          border
          border-border
          px-2
          text-sm
          font-semibold
          text-foreground
          outline-none
          hover:border-primary
          hover:text-primary
        "
        aria-label="Account menu"
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="size-7 rounded-full object-cover"
          />
        ) : (
          <span
            className="
              grid
              size-7
              place-items-center
              rounded-full
              bg-primary
              text-xs
              font-bold
              text-primary-foreground
            "
          >
            {name.charAt(0).toUpperCase()}
          </span>
        )}

        <span className="hidden max-w-28 truncate md:inline">
          {name.split(" ")[0]}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-52"
      >
        <DropdownMenuLabel className="truncate">
          {user.email}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          asChild
          className={itemCls}
        >
          <Link to="/cuenta">
            <User className="size-4" />
            My account
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className={itemCls}
        >
          <Link to="/mis-pedidos">
            <Package className="size-4" />
            My orders
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem
          asChild
          className={itemCls}
        >
          <Link to="/seguimiento">
            <RouteIcon className="size-4" />
            Tracking
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className={itemCls}
          onSelect={signOut}
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}