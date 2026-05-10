const REASONS = [
  {
    title: "Modular de verdad",
    body: "Activás y desactivás módulos desde tu dashboard. Sin renegociar contratos.",
  },
  {
    title: "Sin código",
    body: "Configurás todo con clicks. Para cambios profundos, te ayudamos sin costo extra el primer mes.",
  },
  {
    title: "Soporte humano",
    body: "Estamos en Bariloche. Hablás con personas que conocen tu negocio, no con tickets en inglés.",
  },
];
export function WhyImpluxa() {
  return (
    <section className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Por qué Impluxa
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          Diferente desde el día uno.
        </h2>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {REASONS.map((r) => (
            <div key={r.title}>
              <h3 className="font-display text-bone text-2xl">{r.title}</h3>
              <p className="text-bone/70 mt-3 text-sm">{r.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
