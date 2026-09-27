"use client";

import { useEffect } from "react";

const SERVICE_CACHE_KEY = "dink-promotion-service-cache-v2";
const UX_VERSION_KEY = "dink-promotion-ui-v4";

export function MiniAppUxEnhancer() {
  useEffect(() => {
    if (localStorage.getItem(UX_VERSION_KEY) !== "1") {
      localStorage.removeItem(SERVICE_CACHE_KEY);
      localStorage.setItem(UX_VERSION_KEY, "1");
    }

    const nativeScrollTo = window.scrollTo.bind(window);
    const patchedScrollTo = ((arg1?: number | ScrollToOptions, arg2?: number) => {
      if (typeof arg1 === "object" && arg1 !== null) {
        nativeScrollTo({ ...arg1, behavior: "auto" });
        return;
      }
      if (typeof arg1 === "number" && typeof arg2 === "number") {
        nativeScrollTo(arg1, arg2);
        return;
      }
      nativeScrollTo(0, 0);
    }) as typeof window.scrollTo;
    window.scrollTo = patchedScrollTo;

    return () => {
      window.scrollTo = nativeScrollTo as typeof window.scrollTo;
    };
  }, []);

  return null;
}
