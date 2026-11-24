import { useEffect, useRef, useState } from "react";
import { useNavigation } from "react-router";
import { useTranslations } from "~/i18n";

const finishDuration = 180;

export function NavigationProgress() {
  const busy = useNavigation().state !== "idle";
  const [phase, setPhase] = useState<"idle" | "loading" | "done">("idle");
  const bar = useRef<HTMLDivElement>(null);
  const animation = useRef<Animation>(null);
  const started = useRef(false);
  const t = useTranslations("common");

  useEffect(() => {
    const fill = bar.current;
    if (!fill) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (busy) {
      started.current = true;
      animation.current?.cancel();
      animation.current = reduced
        ? null
        : fill.animate(
            [{ transform: "scaleX(0)" }, { transform: "scaleX(0.88)" }],
            {
              duration: 2000,
              easing: "cubic-bezier(0.12, 0.7, 0.24, 1)",
              fill: "forwards",
            },
          );
      setPhase("loading");
      return;
    }

    if (!started.current) return;
    started.current = false;
    const from = getComputedStyle(fill).transform;
    animation.current?.cancel();
    animation.current = reduced
      ? null
      : fill.animate([{ transform: from }, { transform: "scaleX(1)" }], {
          duration: finishDuration,
          easing: "ease-out",
          fill: "forwards",
        });
    setPhase("done");

    const timer = window.setTimeout(
      () => setPhase("idle"),
      finishDuration + 100,
    );
    return () => window.clearTimeout(timer);
  }, [busy]);

  useEffect(() => () => animation.current?.cancel(), []);

  return (
    <div
      className="navigation-progress"
      data-phase={phase}
      aria-hidden={!busy}
      role={busy ? "progressbar" : undefined}
      aria-label={busy ? t("common.loadingPage") : undefined}
    >
      <div ref={bar} />
    </div>
  );
}
