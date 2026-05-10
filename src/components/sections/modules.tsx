const MODULES = [
  {
    name: "Landing builder",
    price: "70.000",
    desc: "Tu sitio con tu marca, dominio y CTAs.",
    base: true,
  },
  {
    name: "Reservas",
    price: "30.000",
    desc: "Calendario, confirmaciones, recordatorios.",
  },
  {
    name: "Pagos MercadoPago",
    price: "20.000",
    desc: "Cobros online, links, suscripciones.",
  },
  {
    name: "Chatbot IA",
    price: "20.000",
    desc: "Atención 24/7 con tu contexto y catálogo.",
  },
  {
    name: "Dashboard cliente + admin",
    price: "20.000",
    desc: "Métricas, leads, edición sin código.",
  },
];
export function Modules() {
  return (
    <section id="modulos" className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Módulos
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          Pagás solo por lo que usás.
        </h2>
        <div className="divide-stone/30 border-stone/30 mt-16 divide-y border-y">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="grid grid-cols-12 items-center gap-4 py-6"
            >
              <div className="col-span-12 md:col-span-5">
                <h3 className="font-display text-bone text-xl">
                  {m.name}{" "}
                  {m.base && (
                    <span className="text-ash ml-2 font-mono text-xs">
                      BASE
                    </span>
                  )}
                </h3>
              </div>
              <p className="text-bone/70 col-span-12 text-sm md:col-span-5">
                {m.desc}
              </p>
              <div className="col-span-12 md:col-span-2 md:text-right">
                <span className="text-bone font-mono text-sm">${m.price}</span>
                <span className="text-ash ml-1 font-mono text-xs">ARS/mes</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-ash mt-6 text-xs">
          * Precios en pesos argentinos. Otros módulos (delivery, AFIP, menú QR,
          WhatsApp bot) próximamente.
        </p>
      </div>
    </section>
  );
}
