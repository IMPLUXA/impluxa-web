import { ImageResponse } from "next/og";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#0a0a0a",
        color: "#e8dcc4",
        fontFamily: "Georgia, serif",
        fontSize: 18,
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      IXA
    </div>,
    { ...size },
  );
}
