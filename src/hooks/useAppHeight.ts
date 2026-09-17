import { useEffect } from "react";

export function useAppHeight() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const height = Math.round(window.visualViewport?.height ?? window.innerHeight);
      root.style.setProperty("--app-height", `${height}px`);
      window.scrollTo(0, 0);
    };
    sync();
    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", sync);
    viewport?.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      viewport?.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
    };
  }, []);
}
