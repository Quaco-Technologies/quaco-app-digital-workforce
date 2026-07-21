export default function SiteFooter() {
  return (
    <footer className="landing-dark border-t border-white/10 px-6 py-12 md:px-12 lg:px-24">
      <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <img
            src="/birdog-logo-white.png"
            alt="Birdog"
            className="h-12 w-auto object-contain"
          />
          <div className="text-xs text-white/40">
            © {new Date().getFullYear()} Birdog Inc. Atlanta · remote.
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/55">
          <a href="/#pipeline" className="hover:text-white">Pipeline</a>
          <a href="/waitlist" className="hover:text-white">Apply</a>
          <a href="/login" className="hover:text-white">Sign in</a>
          <a href="mailto:hello@birdog.ai" className="hover:text-white">
            hello@birdog.ai
          </a>
        </nav>
      </div>
    </footer>
  );
}
