import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("inicio de sesión, ticket, comentario, filtros, tema y cierre", async ({
  page,
}, testInfo) => {
  const password = process.env.LOCAL_DEMO_PASSWORD;
  if (!password)
    throw new Error("Configura LOCAL_DEMO_PASSWORD y ejecuta el seed.");
  const subject = "Impresora de prueba " + randomUUID().slice(0, 8);
  await page.goto("/");
  await page.getByLabel("Correo electrónico").fill("cliente@devdesk.example");
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByRole("heading", { name: "Hola, Leo." })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Actividad reciente" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("resumen.png"),
    fullPage: true,
  });
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Activar tema oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("link", { name: "Nuevo ticket" }).click();
  await page.getByLabel("Asunto").fill(subject);
  await page
    .getByLabel("Descripción")
    .fill("La impresora no responde desde el lunes.");
  await page.getByLabel("Prioridad").selectOption("HIGH");
  await page.getByRole("button", { name: "Crear ticket" }).click();
  await expect(page.getByRole("heading", { name: subject })).toBeVisible();
  await page.getByLabel("Comentario").fill("He comprobado la conexión local.");
  await page.getByRole("button", { name: "Enviar comentario" }).click();
  await expect(
    page.getByText("He comprobado la conexión local."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Volver a tickets" }).click();
  await page.getByLabel("Buscar").fill(subject);
  await page.getByLabel("Estado").selectOption("OPEN");
  await page.getByRole("button", { name: "Filtrar" }).click();
  await expect(page.getByText("1 ticket · Página 1")).toBeVisible();
  await expect(page.getByRole("link", { name: subject })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    )
    .toBe(true);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(
    page.getByRole("heading", { name: "Iniciar sesión" }),
  ).toBeVisible();
});
