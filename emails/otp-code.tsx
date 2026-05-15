import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";

/**
 * OtpCode — magic-link / OTP email template for Impluxa auth flows
 * (W3.G3.T2, FR-AUTH-3, decisiones D11 + D18).
 *
 * Rendered by `src/app/api/auth/email-hook/route.ts` (W3.G3.T3) when the
 * Supabase Send Email Hook fires for `email_action_type === "magiclink"`.
 *
 * Props are kept minimal so the same template covers both code-based OTP
 * and magic-link flows (when used as a magic link, pass the URL as `code`
 * and the link copy is rendered above).
 *
 * Preview locally with the react-email CLI installed in W1.T4:
 *   npx email dev   # http://localhost:3000
 */

export interface OtpCodeProps {
  /** The OTP code or magic-link token to display. Monospace styled. */
  code: string;
  /** Minutes until the code expires. Defaults to 5 (D11). */
  minutes?: number;
  /** Optional recipient email — included as visible confirmation. */
  email?: string;
}

OtpCode.PreviewProps = {
  code: "482913",
  minutes: 5,
  email: "rey@impluxa.com",
} satisfies OtpCodeProps;

export default function OtpCode({ code, minutes = 5, email }: OtpCodeProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Tu código de acceso a Impluxa</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={brand}>IMPLUXA</Heading>

          <Text style={leadParagraph}>
            {email ? (
              <>
                Pediste un código de acceso para <strong>{email}</strong>.
              </>
            ) : (
              <>Pediste un código de acceso a tu cuenta de Impluxa.</>
            )}
          </Text>

          <Section style={codeBox}>
            <Text style={codeText}>{code}</Text>
          </Section>

          <Text style={hint}>
            Ingresalo en la pantalla de acceso para terminar de entrar.
          </Text>

          <Hr style={hr} />

          <Text style={meta}>
            Este código vence en {minutes}{" "}
            {minutes === 1 ? "minuto" : "minutos"}. Si no lo pediste vos, podés
            ignorar este mail con tranquilidad — tu cuenta sigue segura.
          </Text>

          <Text style={footer}>
            Impluxa — sitios web para tu emprendimiento. Hecho en Argentina.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body: React.CSSProperties = {
  backgroundColor: "#0a0a0a",
  color: "#fafafa",
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  margin: 0,
  padding: 0,
};

const container: React.CSSProperties = {
  maxWidth: "560px",
  margin: "0 auto",
  padding: "40px 24px",
};

const brand: React.CSSProperties = {
  fontSize: "20px",
  letterSpacing: "4px",
  fontWeight: 700,
  textAlign: "center",
  color: "#fafafa",
  margin: "0 0 32px 0",
};

const leadParagraph: React.CSSProperties = {
  fontSize: "15px",
  lineHeight: 1.6,
  color: "#e5e5e5",
  margin: "0 0 24px 0",
};

const codeBox: React.CSSProperties = {
  backgroundColor: "#171717",
  borderRadius: "8px",
  padding: "24px",
  textAlign: "center",
  margin: "24px 0",
};

const codeText: React.CSSProperties = {
  fontSize: "36px",
  letterSpacing: "8px",
  fontFamily:
    "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace",
  fontWeight: 700,
  color: "#fafafa",
  margin: 0,
};

const hint: React.CSSProperties = {
  fontSize: "14px",
  color: "#a3a3a3",
  textAlign: "center",
  margin: "8px 0 24px 0",
};

const hr: React.CSSProperties = {
  borderColor: "#262626",
  margin: "24px 0",
};

const meta: React.CSSProperties = {
  fontSize: "13px",
  lineHeight: 1.6,
  color: "#a3a3a3",
  margin: "0 0 24px 0",
};

const footer: React.CSSProperties = {
  fontSize: "12px",
  color: "#737373",
  textAlign: "center",
  margin: "32px 0 0 0",
};
