import ThemeToggle from "../ThemeToggle";

// Full-bleed splash background with a floating, elevated auth card on top.
// The background image lives at /background.jpg (client/public). If it's
// missing the page still renders cleanly on the token background color.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Splash image */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/background.jpg')" }}
        aria-hidden
      />
      {/* Theme-aware scrim for contrast: light wash in light mode, darken in dark */}
      <div className="absolute inset-0 bg-white/30 dark:bg-slate-950/65" aria-hidden />

      <div className="absolute right-4 top-4 z-10">
        <ThemeToggle />
      </div>

      <div className="animate-fade-in relative z-10 w-full max-w-sm rounded-card border border-[var(--surface-border)] bg-[var(--surface-card)] p-8 shadow-xl shadow-black/10 backdrop-blur-sm">
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
              W
            </div>
            <span className="text-xl font-extrabold tracking-tight text-[var(--surface-text)]">
              Whitebored
            </span>
          </div>
          <h1 className="text-2xl font-bold text-[var(--surface-text)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--surface-muted)]">{subtitle}</p>
        </div>
        {children}
        {footer && (
          <p className="mt-5 text-center text-sm text-[var(--surface-muted)]">
            {footer}
          </p>
        )}
      </div>
    </div>
  );
}
