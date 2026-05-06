"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";

export function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith("/owner")) return;

    trackAnalyticsEvent({
      eventName: "page_view",
      gameId: getGameIdFromPath(pathname),
      metadata: {
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        language: navigator.language
      }
    });
  }, [pathname]);

  return null;
}

function getGameIdFromPath(pathname: string) {
  const match = pathname.match(/^\/game\/([^/]+)/);
  return match?.[1] ?? null;
}
