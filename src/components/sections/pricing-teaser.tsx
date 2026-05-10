const EXAMPLES = [
  {
    rubro: "Salón infantil",
    base: 70,
    addons: [["Reservas", 30]] as const,
    total: 100,
  },
  {
    rubro: "Distribuidora",
    base: 70,
    addons: [
      ["Pagos MP", 20],
      ["Chatbot", 20],
    ] as const,
    total: 110,
  },
  {
    rubro: "Restaurante",
    base: 70,
    addons: [
      ["Reservas", 30],
      ["Pagos MP", 20],
      ["Chatbot", 20],
    ] as const,
    total: 140,
  },
] as const;

export function PricingTeaser() {
  return (
    <section id="precio" className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Precios
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          Armá tu plan.
        </h2>
        <div className="mt-16 grid gap-6 md:grid-cols-3">
          {EXAMPLES.map((e) => (
            <div
              key={e.rubro}
              className="border-stone/30 bg-marble rounded-lg border p-6"
            >
              <h3 className="font-display text-bone text-xl">{e.rubro}</h3>
              <ul className="mt-6 space-y-2 text-sm">
                <li className="flex justify-between">
                  <span className="text-bone/70">Landing builder</span>
                  <span className="text-bone font-mono">${e.base}k</span>
                </li>
                {e.addons.map(([n, p]) => (
                  <li key={n} className="flex justify-between">
                    <span className="text-bone/70">{n}</span>
                    <span className="text-bone font-mono">+${p}k</span>
                  </li>
                ))}
              </ul>
              <div className="border-stone/30 mt-6 flex justify-between border-t pt-4">
                <span className="font-display text-bone">Total</span>
                <span className="text-bone font-mono">${e.total}.000 ARS</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-bone/60 mt-8 text-center text-sm">
          ¿Otro rubro o presupuesto?{" "}
          <a href="#contacto" className="text-bone underline">
            Charlemos
          </a>
          .
        </p>
      </div>
    </section>
  );
}
