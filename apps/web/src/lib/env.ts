"use client";

import { useEffect, useState } from "react";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

/**
 * True only when the app is running on the developer's own machine.
 *
 * Gates demo-only affordances (sample logins, the customer-app shortcut) so they
 * never reach a deployed console.
 *
 * Covers both `next dev` and a production build served on localhost. Resolved
 * after mount rather than during render: `window` doesn't exist while Next
 * pre-renders these client components, and branching on it during render would
 * desync from the server-rendered HTML. The cost is that the affordances appear
 * a tick late locally — the safe direction to fail, since the default is hidden.
 */
export function useIsLocal(): boolean {
  const [local, setLocal] = useState(false);
  useEffect(() => {
    setLocal(
      process.env.NODE_ENV === "development" ||
        LOCAL_HOSTS.has(window.location.hostname),
    );
  }, []);
  return local;
}
