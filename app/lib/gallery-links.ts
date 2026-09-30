export function publicGalleryRef(slug: string | null | undefined, id: string) {
  const base = (slug || "galeria")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "") || "galeria";
  const curto = id.replace(/-/g, "").slice(0, 8).toLowerCase();
  return `${base}-${curto}`;
}

export function isGalleryUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
