import type { Metadata } from "next";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description:
    "Política de Privacidad de Impluxa — qué datos recabamos, con qué finalidad, terceros que intervienen y tus derechos.",
  alternates: {
    canonical: "https://impluxa.com/privacy",
  },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <>
      <article className="px-6 py-24">
        <div className="mx-auto max-w-3xl">
          <p className="text-ash mb-4 font-mono text-xs tracking-[0.3em] uppercase">
            Legal
          </p>
          <h1 className="font-display text-bone text-4xl tracking-wide uppercase md:text-5xl">
            Política de Privacidad
          </h1>
          <p className="text-ash mt-4 font-mono text-xs">
            Última actualización: 12 de mayo de 2026
          </p>

          <div className="text-bone/80 mt-12 space-y-12 text-sm leading-relaxed">
            <p>
              En Impluxa nos tomamos en serio la privacidad. Este documento
              describe qué datos recabamos, con qué finalidad los usamos, con
              qué terceros los compartimos y qué derechos tenés sobre ellos.
              Aplica a impluxa.com y a los subdominios operados por Impluxa para
              clientes (por ejemplo, <code>nombre.impluxa.com</code>).
            </p>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                1. Datos que recabamos
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>
                  Datos de contacto que ingresás voluntariamente en formularios:
                  nombre, correo electrónico, teléfono, nombre de la empresa o
                  evento.
                </li>
                <li>
                  Datos técnicos generados automáticamente al visitar el sitio:
                  dirección IP, tipo de navegador, sistema operativo, páginas
                  visitadas y tiempo de permanencia.
                </li>
                <li>
                  Cookies necesarias para el funcionamiento del sitio y, si
                  corresponde, cookies de analítica anónima.
                </li>
                <li>
                  Datos de facturación cuando contratás un plan: razón social,
                  CUIT/CUIL u otro identificador fiscal, domicilio fiscal y
                  comprobantes emitidos.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                2. Finalidad del tratamiento
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>Prestar el servicio contratado y operar el sitio.</li>
                <li>
                  Responder consultas, enviar presupuestos y mantener la
                  comunicación comercial.
                </li>
                <li>Emitir facturación y cumplir obligaciones fiscales.</li>
                <li>
                  Asegurar la integridad del sistema, detectar fraude y
                  responder a incidentes de seguridad.
                </li>
                <li>
                  Mejorar el producto mediante métricas agregadas y anónimas.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                3. Terceros que intervienen
              </h2>
              <p className="mt-4">
                Para prestar el servicio compartimos datos estrictamente
                necesarios con los siguientes proveedores:
              </p>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>
                  <strong className="text-bone">Supabase</strong> — base de
                  datos y autenticación.
                </li>
                <li>
                  <strong className="text-bone">Vercel</strong> — hosting y
                  entrega del sitio.
                </li>
                <li>
                  <strong className="text-bone">Cloudflare</strong> — DNS y CDN.
                </li>
                <li>
                  <strong className="text-bone">MercadoPago</strong> —
                  procesamiento de pagos.
                </li>
                <li>
                  <strong className="text-bone">Resend</strong> — envío de
                  correos transaccionales.
                </li>
                <li>
                  <strong className="text-bone">Sentry</strong> — monitoreo de
                  errores en producción.
                </li>
                <li>
                  <strong className="text-bone">UptimeRobot</strong> — monitoreo
                  de disponibilidad.
                </li>
                <li>
                  <strong className="text-bone">Plausible</strong> — analítica
                  web anónima (si está habilitada en el sitio).
                </li>
              </ul>
              <p className="mt-4">
                Cada proveedor trata los datos conforme a su propia política de
                privacidad y a un acuerdo de tratamiento de datos cuando
                corresponde.
              </p>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                4. Plazos de conservación
              </h2>
              <ul className="mt-4 list-disc space-y-2 pl-6">
                <li>
                  <strong className="text-bone">Leads y consultas:</strong> 24
                  meses desde el último contacto.
                </li>
                <li>
                  <strong className="text-bone">Datos de facturación:</strong>{" "}
                  10 años, según las obligaciones fiscales aplicables en
                  Argentina.
                </li>
                <li>
                  <strong className="text-bone">Logs técnicos:</strong> 90 días.
                </li>
                <li>
                  Pasados estos plazos, los datos se eliminan o se anonimizan.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                5. Derechos del usuario
              </h2>
              <p className="mt-4">
                Conforme a la Ley 25.326 de Protección de los Datos Personales
                de Argentina, podés ejercer los derechos de acceso,
                rectificación, actualización y supresión de tus datos
                personales. La autoridad de aplicación es la{" "}
                <strong className="text-bone">
                  Agencia de Acceso a la Información Pública (AAIP)
                </strong>
                .
              </p>
              <p className="mt-4">
                Si residís en Brasil, la Ley General de Protección de Datos
                (LGPD, Art. 18) te reconoce derechos equivalentes. La versión en
                portugués de esta política se publicará en una próxima
                actualización.
              </p>
              <p className="mt-4">
                Para ejercer cualquiera de estos derechos, escribinos a{" "}
                <a
                  href="mailto:pablo@impluxa.com"
                  className="text-bone underline"
                >
                  pablo@impluxa.com
                </a>
                .
              </p>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                6. Cookies
              </h2>
              <p className="mt-4">
                Usamos cookies estrictamente necesarias para que el sitio
                funcione (por ejemplo, sesión y preferencia de idioma). Cuando
                está habilitada, la analítica web se realiza con Plausible, que
                no instala cookies de seguimiento ni recolecta datos personales.
                No usamos cookies de publicidad ni perfilado.
              </p>
              <p className="mt-4">
                Podés bloquear o eliminar cookies desde la configuración de tu
                navegador; algunas funcionalidades pueden dejar de operar
                correctamente.
              </p>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                7. Contacto del responsable
              </h2>
              <p className="mt-4">
                Responsable del tratamiento:{" "}
                <strong className="text-bone">Impluxa</strong>, Bariloche, Río
                Negro, Argentina.
              </p>
              <p className="mt-2">
                Contacto de privacidad (DPO):{" "}
                <a
                  href="mailto:pablo@impluxa.com"
                  className="text-bone underline"
                >
                  pablo@impluxa.com
                </a>
                .
              </p>
              <p className="mt-4 text-xs">
                Designaremos un DPO formal y publicaremos sus datos de contacto
                en una próxima versión de esta política.
              </p>
            </section>

            <section>
              <h2 className="font-display text-bone text-2xl tracking-wide uppercase">
                8. Cambios en esta política
              </h2>
              <p className="mt-4">
                Podemos actualizar esta política para reflejar cambios legales o
                en el servicio. La fecha de la última actualización se indica al
                inicio del documento. Si los cambios son sustantivos, te
                avisaremos por los medios de contacto que tengamos disponibles.
              </p>
            </section>
          </div>
        </div>
      </article>
      <Footer />
    </>
  );
}
