export function HeroFallback() {
  return (
    <div className="absolute inset-0 -z-10 flex items-center justify-center opacity-30">
      <svg viewBox="0 0 400 600" className="h-full w-auto">
        <rect
          x="160"
          y="100"
          width="80"
          height="400"
          fill="#1a1a1a"
          stroke="#e8dcc4"
          strokeWidth="0.5"
        />
        <text
          x="200"
          y="300"
          textAnchor="middle"
          fill="#e8dcc4"
          fontFamily="Georgia, serif"
          fontSize="28"
          fontWeight="700"
        >
          IXA
        </text>
      </svg>
    </div>
  );
}
