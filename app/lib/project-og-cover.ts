/**
 * Decide if a selected project cover may be published as a social preview.
 * This image is visible to messaging bots before authentication: never
 * expose images from password-protected projects by default.
 */
export function podeExibirCapaOG({
  temSenha,
  autorizada,
  expirada,
  capaConfigurada,
  pastaPublicada,
}: {
  temSenha: boolean;
  autorizada: boolean;
  expirada: boolean;
  capaConfigurada: boolean;
  pastaPublicada: boolean;
}): boolean {
  return capaConfigurada && pastaPublicada && !expirada && (!temSenha || autorizada);
}
