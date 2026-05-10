const PAINS = [
  {
    kicker: "01",
    title: "Vendés por WhatsApp",
    body: "Pero perdés clientes que querían algo más profesional.",
  },
  {
    kicker: "02",
    title: "Tu sitio web cuesta mucho",
    body: "Y cuando lo querés cambiar, dependés de un programador.",
  },
  {
    kicker: "03",
    title: "Los módulos están dispersos",
    body: "Reservas en una app, pagos en otra, catálogo en Excel.",
  },
];
export function Problem() {
  return (
    <section id="problema" className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          El problema
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-6xl">
          Tu negocio vive en WhatsApp.
          <br />
          <span className="text-bone/60 italic">
            Tus clientes lo merecen mejor.
          </span>
        </h2>
        <div className="mt-16 grid gap-8 md:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.kicker} className="border-stone/40 border-l pl-6">
              <span className="text-ash font-mono text-xs">{p.kicker}</span>
              <h3 className="font-display text-bone mt-2 text-2xl">
                {p.title}
              </h3>
              <p className="text-bone/70 mt-3 text-sm">{p.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
