// Re-export del sub-nav de site (B-Fase2): el layout compartido computa su
// basePath del host (getAdminBasePath) — funciona en ambos árboles. El check
// host-vs-claim NO va en layouts (no re-corren en soft nav); vive en las pages.
export { default } from "@/app/app/site/layout";
