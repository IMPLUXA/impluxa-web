import { LeadForm } from "@/components/lead-form/lead-form";
export function Contact() {
  return (
    <section id="contacto" className="border-stone/30 border-t px-6 py-32">
      <div className="mx-auto max-w-2xl">
        <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
          Contacto
        </p>
        <h2 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
          Hablemos.
        </h2>
        <p className="text-bone/70 mt-4">
          Te respondemos en menos de 24 horas, en horario de Bariloche.
        </p>
        <div className="mt-12">
          <LeadForm />
        </div>
      </div>
    </section>
  );
}
