"use client";

import { useEffect, useState } from "react";

/**
 * Derive a value from the viewport width and keep it in sync on window resize.
 *
 * `resolve` must be a STABLE reference (declare it at module scope) so the
 * resize listener is bound once. `initial` is the SSR / first-render value used
 * before the mount effect runs — pass the same value the component previously
 * used as its `useState` seed so first paint is unchanged.
 */
export function useResponsiveValue<T>(resolve: (width: number) => T, initial: T): T {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    const update = () => setValue(resolve(window.innerWidth));
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [resolve]);

  return value;
}
