import { NextResponse } from "next/server";
import type { PostgrestError } from "@supabase/supabase-js";

// Maps a Postgres/PostgREST error to an HTTP response.
// RLS denial on write (vendedor escribiendo catálogo, o cross-tenant) llega
// como SQLSTATE 42501 ("new row violates row-level security policy") → 403.
// Cualquier otro error → 500 sin filtrar detalle (no PII / no enum leak).
export function pgErrorResponse(error: PostgrestError): NextResponse {
  if (error.code === "42501") {
    return NextResponse.json(
      { ok: false, error: "forbidden", code: "E_RLS" },
      { status: 403 },
    );
  }
  // Violación de unicidad (ej. code duplicado) → 409 accionable.
  if (error.code === "23505") {
    return NextResponse.json(
      { ok: false, error: "conflict", code: "E_DUPLICATE" },
      { status: 409 },
    );
  }
  // Violación de FK / CHECK → 400 (body inconsistente con el schema DB).
  if (error.code === "23503" || error.code === "23514") {
    return NextResponse.json(
      { ok: false, error: "invalid_reference", code: "E_CONSTRAINT" },
      { status: 400 },
    );
  }
  console.error(
    JSON.stringify({
      level: "error",
      event: "agency_pg_error",
      code: error.code,
      message: error.message,
    }),
  );
  return NextResponse.json(
    { ok: false, error: "server_error" },
    { status: 500 },
  );
}

export function badRequest(errors: unknown): NextResponse {
  return NextResponse.json({ ok: false, errors }, { status: 400 });
}
