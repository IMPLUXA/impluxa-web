const FAQS = [
  [
    "¿Necesito un programador?",
    "No. Configurás todo desde tu dashboard. Si necesitás algo más, te ayudamos sin costo extra el primer mes.",
  ],
  [
    "¿Puedo cancelar cuando quiera?",
    "Sí. Es mensual sin permanencia. Te llevás tu dominio si lo querés.",
  ],
  [
    "¿Custom domain o subdominio?",
    "Las dos. Podés ir con `tunegocio.impluxa.com` o conectar tu propio dominio (te lo tramitamos).",
  ],
  [
    "¿Facturación AFIP?",
    "Llega como módulo en FASE 2 (próximas semanas). Mientras, te integramos con tu actual sistema.",
  ],
  [
    "¿Soporte?",
    "Sí. WhatsApp directo en horario comercial (Bariloche). Hablás con personas, no con bots de tickets.",
  ],
  [
    "¿Qué pasa con mis datos?",
    "Son tuyos. Podés exportar todo en CSV o JSON cuando quieras.",
  ],
] as const;

export function FAQ() {
  return (
    <section className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-3xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Preguntas frecuentes
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          FAQ
        </h2>
        <div className="divide-stone/30 border-stone/30 mt-12 divide-y border-y">
          {FAQS.map(([q, a]) => (
            <details key={q} className="group py-6">
              <summary className="font-display text-bone flex cursor-pointer list-none items-center justify-between text-xl">
                {q}
                <span className="text-bone/60 font-mono transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="text-bone/70 mt-3 text-sm">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
