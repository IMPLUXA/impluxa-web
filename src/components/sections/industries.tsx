const INDUSTRIES = [
  {
    slug: "eventos",
    title: "Salones de eventos",
    caso: "Hakuna Matata — Bariloche",
  },
  {
    slug: "distribuidora",
    title: "Distribuidoras",
    caso: "Mihese — Bariloche",
  },
  {
    slug: "foodseller",
    title: "Food sellers (vegano, casero)",
    caso: "Vendedores caseros — Bariloche",
  },
  { slug: "restaurante", title: "Restaurantes", caso: "Próximamente" },
  { slug: "gimnasio", title: "Gimnasios y estudios", caso: "Próximamente" },
  {
    slug: "inmobiliaria",
    title: "Inmobiliarias y clínicas",
    caso: "Próximamente",
  },
];
export function Industries() {
  return (
    <section id="industrias" className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Industrias
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          Hecho para tu rubro.
        </h2>
        <div className="border-stone/30 bg-stone/30 mt-16 grid gap-px overflow-hidden rounded-lg border md:grid-cols-3">
          {INDUSTRIES.map((i) => (
            <div key={i.slug} className="bg-onyx p-8">
              <h3 className="font-display text-bone text-2xl">{i.title}</h3>
              <p className="text-ash mt-4 font-mono text-xs">CASO: {i.caso}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
