import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["es-LA", "en"],
  defaultLocale: "es-LA",
  localePrefix: { mode: "as-needed" },
});
export const { Link, redirect, usePathname, useRouter } =
  createNavigation(routing);
