import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/use-session";
import { fetchMyRoom } from "@/lib/zeel";

/**
 * Once a session exists, send the user to their existing room (if any),
 * otherwise to the setup flow. Reacts to auth state changes immediately.
 */
export function useRoomRedirect(fallback: "/create" | null = "/create") {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    setResolving(true);
    void fetchMyRoom(user.id)
      .then((room) => {
        if (!active) return;
        if (room) void navigate({ to: "/chat", replace: true });
        else if (fallback) void navigate({ to: fallback, replace: true });
        else setResolving(false);
      })
      .catch(() => {
        if (active) setResolving(false);
      });
    return () => {
      active = false;
    };
  }, [user, loading, navigate, fallback]);

  return { user, loading, resolving };
}
