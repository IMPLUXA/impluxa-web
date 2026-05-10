import Link from "next/link";

export function Nav() {
  return (
    <nav className="border-stone/30 bg-onyx/80 fixed top-0 z-50 flex w-full items-center justify-between border-b px-6 py-4 backdrop-blur-md">
      <Link
        href="/"
        className="font-display text-bone text-2xl font-bold tracking-wider"
        aria-label="Impluxa home"
      >
        IXA
      </Link>
      <div className="hidden items-center gap-8 md:flex">
        <Link
          href="#producto"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          Producto
        </Link>
        <Link
          href="#industrias"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          Industrias
        </Link>
        <Link
          href="#precio"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          Precio
        </Link>
        <Link
          href="#contacto"
          className="text-bone/80 hover:text-bone text-sm transition"
        >
          Contacto
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-ash font-mono text-xs">ES | EN</span>
        <Link
          href="#contacto"
          className="bg-bone text-onyx hover:bg-cream rounded-md px-4 py-2 text-sm font-medium transition"
        >
          Empezar
        </Link>
      </div>
    </nav>
  );
}
