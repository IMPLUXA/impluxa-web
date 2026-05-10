const STEPS = [
  {
    n: "I",
    title: "Elegís tu rubro",
    body: "Eventos, restaurante, distribuidora, gimnasio…",
  },
  {
    n: "II",
    title: "Activás módulos",
    body: "Landing, reservas, pagos, chatbot, dashboard.",
  },
  {
    n: "III",
    title: "Lanzás en 48hs",
    body: "Con tu propio dominio o subdominio en impluxa.com.",
  },
];
export function HowItWorks() {
  return (
    <section id="producto" className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-5xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Cómo funciona
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          Tres pasos
        </h2>
        <div className="mt-16 grid gap-12 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="font-display text-bone/30 text-7xl">{s.n}</div>
              <h3 className="font-display text-bone mt-4 text-2xl">
                {s.title}
              </h3>
              <p className="text-bone/70 mt-2 text-sm">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
