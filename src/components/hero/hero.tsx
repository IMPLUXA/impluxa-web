export function Hero() {
  return (
    <section className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-6">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(232,220,196,0.06),transparent_60%)]" />
      <div className="relative z-10 max-w-4xl text-center">
        <p className="text-ash mb-6 font-mono text-xs tracking-[0.3em] uppercase">
          Infrastructure
        </p>
        <h1 className="font-display text-bone text-6xl font-bold tracking-wider uppercase md:text-8xl lg:text-9xl">
          IMPLUXA
        </h1>
        <p className="font-display text-bone/70 mt-8 text-xl italic md:text-2xl">
          Infraestructura para los negocios del mañana.
        </p>
        <div className="mt-12 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#contacto"
            className="bg-bone text-onyx hover:bg-cream rounded-md px-8 py-3 text-sm font-medium transition"
          >
            Solicitar demo
          </a>
          <a
            href="#producto"
            className="text-bone/80 hover:text-bone text-sm transition"
          >
            Ver cómo funciona →
          </a>
        </div>
      </div>
    </section>
  );
}
