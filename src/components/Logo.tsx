import logo from "../assets/grupo-total-logo.png";

export function Logo({
  compact = false,
  variant = "nav",
}: {
  compact?: boolean;
  variant?: "nav" | "hero";
}) {
  const imageClass =
    variant === "hero"
      ? "mx-auto h-20 w-auto max-w-full object-contain"
      : compact
        ? "h-10 w-auto max-w-[180px] object-contain"
        : "h-20 w-full object-contain";

  return (
    <div
      className={
        variant === "hero"
          ? "flex flex-col items-center gap-2"
          : compact
            ? "flex items-center"
            : "flex flex-col gap-1.5"
      }
    >
      <img src={logo} alt="Grupo Total" className={imageClass} />
    </div>
  );
}
