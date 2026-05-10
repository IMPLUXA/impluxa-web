export function Footer() {
  return (
    <footer className="border-stone/30 bg-onyx border-t px-6 py-16">
      <div className="mx-auto flex max-w-5xl flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <div className="font-display text-bone text-3xl font-bold">IXA</div>
          <p className="text-ash mt-2 max-w-sm text-xs">
            Impluxa · Bariloche, Río Negro · Argentina
          </p>
        </div>
        <div className="text-bone/70 flex flex-wrap items-center gap-6 text-xs">
          <a href="https://github.com/IMPLUXA" className="hover:text-bone">
            GitHub
          </a>
          <a href="/legal/privacidad" className="hover:text-bone">
            Privacidad
          </a>
          <a href="/legal/terminos" className="hover:text-bone">
            Términos
          </a>
          <span className="text-ash font-mono">ES | EN</span>
        </div>
      </div>
      <div className="border-stone/30 text-ash mx-auto mt-12 max-w-5xl border-t pt-6 text-xs">
        © {new Date().getFullYear()} Impluxa. Todos los derechos reservados.
      </div>
    </footer>
  );
}
