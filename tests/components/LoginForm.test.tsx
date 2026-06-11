// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const signInWithOtp = vi.fn();
const verifyOtp = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseBrowserClient: () => ({
    auth: { signInWithOtp, verifyOtp },
  }),
}));

import { LoginForm } from "@/app/login/LoginForm";

// F-UI-BRANDED corte 1 — el login es SOLO-OTP (decisión CEO v2): este test
// fija esa decisión como regresión. Si alguien re-introduce el path password
// en la UI, el primer assert lo caza.

beforeEach(() => {
  signInWithOtp.mockReset();
  verifyOtp.mockReset();
});

describe("LoginForm (solo-OTP)", () => {
  it("NO expone ningún path de password en la UI", () => {
    render(<LoginForm postLoginPath="/" brandedTenantName={null} />);
    expect(screen.queryByText(/contraseña/i)).not.toBeNull(); // el hint "Sin contraseñas." existe
    expect(screen.queryByLabelText(/password|contraseña/i)).toBeNull();
    expect(
      screen.queryByRole("button", { name: /password|contraseña/i }),
    ).toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });

  it("paso email → envía OTP (shouldCreateUser false) y muestra el paso del código", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(
      <LoginForm
        postLoginPath="/admin/dashboard"
        brandedTenantName="Patagonia Viva"
      />,
    );

    fireEvent.change(screen.getByLabelText("Tu email"), {
      target: { value: "duena@patagonia.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código de acceso" }),
    );

    await waitFor(() =>
      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "duena@patagonia.test",
        options: { shouldCreateUser: false },
      }),
    );
    expect(
      await screen.findByRole("group", { name: /código de 6 dígitos/i }),
    ).toBeTruthy();
    expect(screen.getByText(/panel de Patagonia Viva/)).toBeTruthy();
  });

  it("verificar con 6 dígitos llama verifyOtp type email", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    render(
      <LoginForm postLoginPath="/admin/dashboard" brandedTenantName={null} />,
    );

    fireEvent.change(screen.getByLabelText("Tu email"), {
      target: { value: "a@b.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código de acceso" }),
    );
    await screen.findByRole("group", { name: /código de 6 dígitos/i });

    // pegar el código entero en la primera celda lo distribuye
    fireEvent.change(screen.getByLabelText("dígito 1"), {
      target: { value: "482913" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar y entrar" }));

    await waitFor(() =>
      expect(verifyOtp).toHaveBeenCalledWith({
        email: "a@b.test",
        token: "482913",
        type: "email",
      }),
    );
  });

  it("el botón Verificar queda deshabilitado con código incompleto", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    render(<LoginForm postLoginPath="/" brandedTenantName={null} />);
    fireEvent.change(screen.getByLabelText("Tu email"), {
      target: { value: "a@b.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código de acceso" }),
    );
    await screen.findByRole("group", { name: /código de 6 dígitos/i });
    fireEvent.change(screen.getByLabelText("dígito 1"), {
      target: { value: "4" },
    });
    const btn = screen.getByRole("button", {
      name: "Verificar y entrar",
    }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("error de verify vuelve al paso código y lo muestra", async () => {
    signInWithOtp.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired" } });
    render(<LoginForm postLoginPath="/" brandedTenantName={null} />);
    fireEvent.change(screen.getByLabelText("Tu email"), {
      target: { value: "a@b.test" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Enviar código de acceso" }),
    );
    await screen.findByRole("group", { name: /código de 6 dígitos/i });
    fireEvent.change(screen.getByLabelText("dígito 1"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verificar y entrar" }));
    expect(await screen.findByText("Token has expired")).toBeTruthy();
  });
});
