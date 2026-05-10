import { ImageResponse } from "next/og";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default async function OG() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#0a0a0a",
        color: "#e8dcc4",
        fontFamily: "Georgia, serif",
      }}
    >
      <div style={{ fontSize: 200, fontWeight: 700, letterSpacing: 6 }}>
        IMPLUXA
      </div>
      <div
        style={{
          fontSize: 32,
          fontStyle: "italic",
          opacity: 0.7,
          marginTop: 24,
        }}
      >
        Infraestructura para los negocios del mañana.
      </div>
    </div>,
    { ...size },
  );
}
