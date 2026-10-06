export const LOCALES = ["pt", "en", "es"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pt";
export const LOCALE_COOKIE = "fotura_locale";

const labels: Record<Locale, string> = { pt: "PT", en: "EN", es: "ES" };
export function localeLabel(locale: Locale) { return labels[locale]; }
export function htmlLang(locale: Locale) { return locale === "pt" ? "pt-BR" : locale; }
export function ogLocale(locale: Locale) { return locale === "pt" ? "pt_BR" : locale === "en" ? "en_US" : "es_ES"; }

export function normalizeLocale(value: unknown): Locale {
  const raw = String(value ?? "").toLowerCase().replace("_", "-");
  if (raw === "pt" || raw.startsWith("pt-")) return "pt";
  if (raw === "es" || raw.startsWith("es-")) return "es";
  if (raw === "en" || raw.startsWith("en-")) return "en";
  return DEFAULT_LOCALE;
}

export function localeFromPath(pathname: string): Locale | null {
  const match = pathname.match(/^\/(pt|en|es)(?:\/|$)/);
  return match ? (match[1] as Locale) : null;
}

export function stripLocalePrefix(pathname: string) {
  const stripped = pathname.replace(/^\/(pt|en|es)(?=\/|$)/, "");
  return stripped || "/";
}

export function withLocalePath(path: string, locale: Locale) {
  if (!path || /^(?:https?:|mailto:|tel:|#)/i.test(path)) return path;
  const hashIndex = path.indexOf("#");
  const hash = hashIndex >= 0 ? path.slice(hashIndex) : "";
  const beforeHash = hashIndex >= 0 ? path.slice(0, hashIndex) : path;
  const queryIndex = beforeHash.indexOf("?");
  const query = queryIndex >= 0 ? beforeHash.slice(queryIndex) : "";
  const pathname = queryIndex >= 0 ? beforeHash.slice(0, queryIndex) : beforeHash;
  const clean = stripLocalePrefix(pathname.startsWith("/") ? pathname : "/" + pathname);
  return "/" + locale + (clean === "/" ? "" : clean) + query + hash;
}

export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const langs = header.split(",").map((item) => item.trim().split(";")[0]).filter(Boolean);
  for (const lang of langs) {
    const resolved = normalizeLocale(lang);
    if (/^(pt|es|en)(?:-|$)/i.test(lang)) return resolved;
  }
  return "en";
}

export function localeFromCookieHeader(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const match = header.match(/(?:^|;\s*)fotura_locale=(pt|en|es)(?:;|$)/);
  return match ? (match[1] as Locale) : null;
}

type Pair = { en: string; es: string };

const messages: Record<string, Pair> = {
  "Grátis": { en: "Free", es: "Gratis" },
  "Essencial": { en: "Essential", es: "Esencial" },
  "Profissional": { en: "Professional", es: "Profesional" },
  "Plano grátis disponível · seu cliente não precisa criar conta": { en: "Free plan available · your client does not need an account", es: "Plan gratuito disponible · tu cliente no necesita crear una cuenta" },
  "Galerias de entrega e prova online": { en: "Online delivery and proofing galleries", es: "Galerías online de entrega y selección" },
  "Galeria": { en: "Gallery", es: "Galería" },
  "Galerias": { en: "Galleries", es: "Galerías" },
  "Como funciona": { en: "How it works", es: "Cómo funciona" },
  "Planos": { en: "Plans", es: "Planes" },
  "Dúvidas": { en: "Questions", es: "Preguntas" },
  "Entrar": { en: "Sign in", es: "Entrar" },
  "Criar conta": { en: "Create account", es: "Crear cuenta" },
  "Abrir Fotura": { en: "Open Fotura", es: "Abrir Fotura" },
  "Ir para o painel": { en: "Go to dashboard", es: "Ir al panel" },
  "Criar galeria grátis": { en: "Create a free gallery", es: "Crear galería gratis" },
  "Ver como funciona": { en: "See how it works", es: "Ver cómo funciona" },
  "Sua fotografia merece uma": { en: "Your photography deserves a", es: "Tu fotografía merece una" },
  "entrega": { en: "delivery", es: "entrega" },
  "à altura.": { en: "worthy delivery.", es: "a su altura." },
  "Um único link para apresentar o ensaio, receber favoritas e comentários e concluir a seleção — com a sua identidade no centro da experiência.": { en: "One link to present the shoot, receive favorites and comments, and complete the selection — with your identity at the center of the experience.", es: "Un solo enlace para presentar la sesión, recibir favoritas y comentarios y completar la selección — con tu identidad en el centro de la experiencia." },
  "Do clique à entrega": { en: "From capture to delivery", es: "Del clic a la entrega" },
  "Do upload à escolha final.": { en: "From upload to final choice.", es: "De la carga a la elección final." },
  "No mesmo fluxo.": { en: "In the same flow.", es: "En el mismo flujo." },
  "Monte a galeria, compartilhe um único link e receba a seleção sem reconstruir o processo em mensagens, planilhas ou listas de nomes de arquivo.": { en: "Build the gallery, share one link, and receive the selection without rebuilding the process in messages, spreadsheets, or filename lists.", es: "Crea la galería, comparte un solo enlace y recibe la selección sin reconstruir el proceso en mensajes, hojas de cálculo o listas de archivos." },
  "Crie a galeria e envie as fotos": { en: "Create the gallery and upload the photos", es: "Crea la galería y sube las fotos" },
  "A mesma tela do Fotura reúne nome da galeria, cliente e seleção dos arquivos para o upload.": { en: "The same Fotura screen brings together the gallery name, client, and files selected for upload.", es: "La misma pantalla de Fotura reúne el nombre de la galería, el cliente y los archivos seleccionados para subir." },
  "Gerencie e compartilhe": { en: "Manage and share", es: "Gestiona y comparte" },
  "Em Galerias, acompanhe o estágio do trabalho e compartilhe por link, WhatsApp ou e-mail.": { en: "In Galleries, track each job stage and share it by link, WhatsApp, or email.", es: "En Galerías, sigue cada etapa del trabajo y compártelo por enlace, WhatsApp o correo." },
  "O cliente faz a seleção": { en: "The client makes the selection", es: "El cliente hace la selección" },
  "Na galeria pública, ele marca as fotos, comenta e finaliza a prova sem precisar criar uma conta.": { en: "In the public gallery, the client marks photos, comments, and finishes proofing without creating an account.", es: "En la galería pública, el cliente marca fotos, comenta y finaliza la selección sin crear una cuenta." },
  "Acompanhe em Seleções": { en: "Track it in Selections", es: "Síguelo en Selecciones" },
  "Escolhidas, comentários e status aparecem no painel do fotógrafo para seguir até a entrega final.": { en: "Chosen photos, comments, and status appear in the photographer dashboard through final delivery.", es: "Las fotos elegidas, los comentarios y el estado aparecen en el panel del fotógrafo hasta la entrega final." },
  "A experiência do seu cliente": { en: "Your client's experience", es: "La experiencia de tu cliente" },
  "Seu cliente vê o ensaio. Não o sistema.": { en: "Your client sees the shoot. Not the software.", es: "Tu cliente ve la sesión. No el sistema." },
  "A experiência foi desenhada para deixar as imagens respirarem. Favoritas e comentários aparecem quando são necessários e saem do caminho quando não são.": { en: "The experience is designed to let the images breathe. Favorites and comments appear when needed and stay out of the way when they are not.", es: "La experiencia está diseñada para dejar respirar las imágenes. Favoritas y comentarios aparecen cuando hacen falta y desaparecen cuando no." },
  "fotos selecionadas nesta demonstração.": { en: "photos selected in this demo.", es: "fotos seleccionadas en esta demo." },
  "Clique nas imagens para testar.": { en: "Click the images to try it.", es: "Haz clic en las imágenes para probarlo." },
  "Comece leve.": { en: "Start light.", es: "Empieza ligero." },
  "Escale quando precisar.": { en: "Scale when you need to.", es: "Escala cuando lo necesites." },
  "por mês": { en: "per month", es: "por mes" },
  "Começar grátis": { en: "Start free", es: "Empezar gratis" },
  "O essencial, antes de começar.": { en: "The essentials, before you start.", es: "Lo esencial, antes de empezar." },
  "Sem letras miúdas no fluxo principal.": { en: "No fine print in the core workflow.", es: "Sin letra pequeña en el flujo principal." },
  "Meu cliente precisa criar uma conta?": { en: "Does my client need an account?", es: "¿Mi cliente necesita crear una cuenta?" },
  "Não. Ele acessa a galeria pelo link enviado por você e, quando necessário, informa apenas a senha da galeria.": { en: "No. They access the gallery through the link you send and, when needed, only enter the gallery password.", es: "No. Accede a la galería mediante el enlace que envías y, cuando hace falta, solo introduce la contraseña de la galería." },
  "Posso usar o Fotura para prova de fotos?": { en: "Can I use Fotura for photo proofing?", es: "¿Puedo usar Fotura para selección de fotos?" },
  "Sim. Você pode habilitar seleção, definir limite de favoritas e receber comentários por foto.": { en: "Yes. You can enable selections, set a favorites limit, and receive comments per photo.", es: "Sí. Puedes habilitar la selección, definir un límite de favoritas y recibir comentarios por foto." },
  "Minha marca aparece na experiência?": { en: "Does my brand appear in the experience?", es: "¿Mi marca aparece en la experiencia?" },
  "Sim. O Fotura permite personalizar a apresentação do estúdio e manter sua identidade no centro da entrega.": { en: "Yes. Fotura lets you customize your studio presentation and keep your identity at the center of delivery.", es: "Sí. Fotura permite personalizar la presentación de tu estudio y mantener tu identidad en el centro de la entrega." },
  "Posso cancelar quando quiser?": { en: "Can I cancel anytime?", es: "¿Puedo cancelar cuando quiera?" },
  "Sim. A assinatura é gerenciada pelo portal de cobrança e pode ser cancelada para o fim do período vigente.": { en: "Yes. Your subscription is managed through the billing portal and can be canceled for the end of the current period.", es: "Sí. La suscripción se gestiona desde el portal de facturación y puede cancelarse al final del período vigente." },
  "A entrega também faz parte da fotografia.": { en: "Delivery is part of the photography too.", es: "La entrega también forma parte de la fotografía." },
  "Apresente o trabalho, receba a escolha do cliente e continue o processo sem perder o contexto de cada foto.": { en: "Present the work, receive the client's choices, and keep moving without losing the context of each photo.", es: "Presenta el trabajo, recibe la elección del cliente y continúa el proceso sin perder el contexto de cada foto." },
  "Painel": { en: "Dashboard", es: "Panel" },
  "Seleções": { en: "Selections", es: "Selecciones" },
  "Clientes": { en: "Clients", es: "Clientes" },
  "Vendas": { en: "Sales", es: "Ventas" },
  "Configurações": { en: "Settings", es: "Configuración" },
  "Ajuda e feedback": { en: "Help & feedback", es: "Ayuda y comentarios" },
  "Conta e suporte": { en: "Account & support", es: "Cuenta y soporte" },
  "Navegação do fotógrafo": { en: "Photographer navigation", es: "Navegación del fotógrafo" },
  "Fechar menu": { en: "Close menu", es: "Cerrar menú" },
  "Ir para o painel": { en: "Go to dashboard", es: "Ir al panel" },
  "Administração": { en: "Administration", es: "Administración" },
  "Sair": { en: "Sign out", es: "Salir" },
  "Abrir perfil": { en: "Open profile", es: "Abrir perfil" },
  "Fotógrafo": { en: "Photographer", es: "Fotógrafo" },
  "Olá": { en: "Hello", es: "Hola" },
  "Entre na sua conta": { en: "Sign in to your account", es: "Entra en tu cuenta" },
  "Crie sua conta": { en: "Create your account", es: "Crea tu cuenta" },
  "E-mail": { en: "Email", es: "Correo electrónico" },
  "Senha": { en: "Password", es: "Contraseña" },
  "Mínimo de 8 caracteres.": { en: "Minimum 8 characters.", es: "Mínimo 8 caracteres." },
  "Esqueci minha senha": { en: "Forgot my password", es: "Olvidé mi contraseña" },
  "Li e aceito os": { en: "I have read and accept the", es: "He leído y acepto los" },
  "Termos de Uso": { en: "Terms of Use", es: "Términos de Uso" },
  "Política de Privacidade": { en: "Privacy Policy", es: "Política de Privacidad" },
  "Aguarde...": { en: "Please wait...", es: "Espera..." },
  "Não tem conta?": { en: "Don't have an account?", es: "¿No tienes cuenta?" },
  "Já tem conta?": { en: "Already have an account?", es: "¿Ya tienes cuenta?" },
  "Cadastre-se": { en: "Sign up", es: "Regístrate" },
  "Fazer login": { en: "Sign in", es: "Iniciar sesión" },
  "Conta encerrada com segurança. O conteúdo público foi bloqueado.": { en: "Account closed securely. Public content has been blocked.", es: "Cuenta cerrada de forma segura. El contenido público fue bloqueado." },
  "Erro: Esta conta está suspensa. Entre em contato com o suporte se precisar de ajuda.": { en: "Error: This account is suspended. Contact support if you need help.", es: "Error: Esta cuenta está suspendida. Contacta con soporte si necesitas ayuda." },
  "E-mail confirmado. Entre para continuar.": { en: "Email confirmed. Sign in to continue.", es: "Correo confirmado. Inicia sesión para continuar." },
  "Erro: Preencha e-mail e senha.": { en: "Error: Enter your email and password.", es: "Error: Introduce tu correo y contraseña." },
  "Erro: Você precisa aceitar os Termos de Uso e a Política de Privacidade.": { en: "Error: You need to accept the Terms of Use and Privacy Policy.", es: "Error: Debes aceptar los Términos de Uso y la Política de Privacidad." },
  "Erro: Use uma senha com pelo menos 8 caracteres.": { en: "Error: Use a password with at least 8 characters.", es: "Error: Usa una contraseña de al menos 8 caracteres." },
  "Erro: Não foi possível criar a conta. Verifique os dados ou tente entrar.": { en: "Error: We couldn't create the account. Check your details or try signing in.", es: "Error: No pudimos crear la cuenta. Revisa los datos o intenta iniciar sesión." },
  "Conta criada! Verifique seu e-mail para confirmar.": { en: "Account created! Check your email to confirm it.", es: "¡Cuenta creada! Revisa tu correo para confirmarla." },
  "Erro: E-mail ou senha inválidos.": { en: "Error: Invalid email or password.", es: "Error: Correo o contraseña no válidos." },
  "Recuperação de senha": { en: "Password recovery", es: "Recuperación de contraseña" },
  "E-mail da sua conta": { en: "Your account email", es: "Correo de tu cuenta" },
  "Enviar link de recuperação": { en: "Send recovery link", es: "Enviar enlace de recuperación" },
  "Enviando...": { en: "Sending...", es: "Enviando..." },
  "Voltar ao login": { en: "Back to sign in", es: "Volver al inicio de sesión" },
  "Se existir uma conta com esse e-mail, enviaremos um link de recuperação. Verifique também a caixa de spam.": { en: "If an account exists for this email, we'll send a recovery link. Check your spam folder too.", es: "Si existe una cuenta con este correo, enviaremos un enlace de recuperación. Revisa también la carpeta de spam." },
  "Use pelo menos 8 caracteres.": { en: "Use at least 8 characters.", es: "Usa al menos 8 caracteres." },
  "As senhas não coincidem.": { en: "The passwords do not match.", es: "Las contraseñas no coinciden." },
  "Senha redefinida com sucesso!": { en: "Password reset successfully!", es: "¡Contraseña restablecida correctamente!" },
  "Verificando link de recuperação…": { en: "Checking recovery link…", es: "Verificando enlace de recuperación…" },
  "Link inválido ou expirado.": { en: "Invalid or expired link.", es: "Enlace no válido o caducado." },
  "Defina sua nova senha": { en: "Set your new password", es: "Define tu nueva contraseña" },
  "Não foi possível redefinir a senha. Solicite um novo link e tente novamente.": { en: "We couldn't reset the password. Request a new link and try again.", es: "No pudimos restablecer la contraseña. Solicita un nuevo enlace e inténtalo de nuevo." },
  "Sua visão geral": { en: "Your overview", es: "Tu resumen" },
  "O que aconteceu desde suas últimas visitas": { en: "What happened since your last visits", es: "Qué ocurrió desde tus últimas visitas" },
  "Nenhuma atividade recente.": { en: "No recent activity.", es: "Sin actividad reciente." },
  "Últimas galerias": { en: "Latest galleries", es: "Últimas galerías" },
  "Nenhuma galeria criada ainda.": { en: "No gallery created yet.", es: "Todavía no hay galerías creadas." },
  "+ Nova galeria": { en: "+ New gallery", es: "+ Nueva galería" },
  "Buscar por galeria ou cliente": { en: "Search by gallery or client", es: "Buscar por galería o cliente" },
  "Carregando galerias…": { en: "Loading galleries…", es: "Cargando galerías…" },
  "Crie sua primeira galeria": { en: "Create your first gallery", es: "Crea tu primera galería" },
  "Envie as fotos, vincule um cliente e depois compartilhe tudo por link, WhatsApp ou e-mail.": { en: "Upload the photos, link a client, then share everything by link, WhatsApp, or email.", es: "Sube las fotos, vincula un cliente y después comparte todo por enlace, WhatsApp o correo." },
  "Nenhuma galeria corresponde à busca atual.": { en: "No gallery matches the current search.", es: "Ninguna galería coincide con la búsqueda actual." },
  "Escolha como deseja compartilhar este trabalho.": { en: "Choose how you want to share this job.", es: "Elige cómo quieres compartir este trabajo." },
  "Você ainda pode copiar o link da galeria.": { en: "You can still copy the gallery link.", es: "Aún puedes copiar el enlace de la galería." },
  "Link copiado.": { en: "Link copied.", es: "Enlace copiado." },
  "Não foi possível copiar automaticamente.": { en: "We couldn't copy it automatically.", es: "No pudimos copiarlo automáticamente." },
  "Não foi possível enviar o e-mail.": { en: "We couldn't send the email.", es: "No pudimos enviar el correo." },
  "Mensagem do WhatsApp preparada.": { en: "WhatsApp message prepared.", es: "Mensaje de WhatsApp preparado." },
  "Não foi possível enviar a galeria.": { en: "We couldn't send the gallery.", es: "No pudimos enviar la galería." },
  "Configurações opcionais.": { en: "Optional settings.", es: "Configuración opcional." },
  "Salvar alterações": { en: "Save changes", es: "Guardar cambios" },
  "Excluir galeria?": { en: "Delete gallery?", es: "¿Eliminar galería?" },
  "Galeria excluída.": { en: "Gallery deleted.", es: "Galería eliminada." },
  "Carregando clientes…": { en: "Loading clients…", es: "Cargando clientes…" },
  "Você ainda não cadastrou clientes.": { en: "You haven't added any clients yet.", es: "Todavía no has añadido clientes." },
  "Cliente cadastrado.": { en: "Client added.", es: "Cliente añadido." },
  "Excluir cliente?": { en: "Delete client?", es: "¿Eliminar cliente?" },
  "Sem interação": { en: "No interaction", es: "Sin interacción" },
  "Seleção finalizada": { en: "Selection completed", es: "Selección finalizada" },
  "Cliente ainda não interagiu": { en: "Client has not interacted yet", es: "El cliente aún no ha interactuado" },
  "Comentários": { en: "Comments", es: "Comentarios" },
  "Ver seleção": { en: "View selection", es: "Ver selección" },
  "Conta e cobrança": { en: "Account & billing", es: "Cuenta y facturación" },
  "Carregando assinatura…": { en: "Loading subscription…", es: "Cargando suscripción…" },
  "Cobrança": { en: "Billing", es: "Facturación" },
  "Próximo ciclo": { en: "Next cycle", es: "Próximo ciclo" },
  "Fotos por galeria ilimitadas": { en: "Unlimited photos per gallery", es: "Fotos ilimitadas por galería" },
  "Prova, comentários, senha e entrega final": { en: "Proofing, comments, password, and final delivery", es: "Selección, comentarios, contraseña y entrega final" },
  "Carregando vendas…": { en: "Loading sales…", es: "Cargando ventas…" },
  "Nenhuma venda de fotos extras registrada ainda.": { en: "No extra-photo sales yet.", es: "Todavía no hay ventas de fotos extra." },
  "Histórico da conta": { en: "Account history", es: "Historial de la cuenta" },
  "Buscar no histórico": { en: "Search history", es: "Buscar en el historial" },
  "Carregando atividade…": { en: "Loading activity…", es: "Cargando actividad…" },
  "Nenhum evento encontrado para este filtro.": { en: "No event found for this filter.", es: "No se encontró ningún evento para este filtro." },
  "As próximas ações importantes aparecerão aqui.": { en: "The next important actions will appear here.", es: "Las próximas acciones importantes aparecerán aquí." },
  "Preparando entrega…": { en: "Preparing delivery…", es: "Preparando entrega…" },
  "Entrega indisponível.": { en: "Delivery unavailable.", es: "Entrega no disponible." },
  "01 · Baixar seleção": { en: "01 · Download selection", es: "01 · Descargar selección" },
  "02 · Enviar fotos finais": { en: "02 · Upload final photos", es: "02 · Subir fotos finales" },
  "03 · Publicar entrega": { en: "03 · Publish delivery", es: "03 · Publicar entrega" },
  "✓ Concluída": { en: "✓ Completed", es: "✓ Completada" },
  "Baixar seleção": { en: "Download selection", es: "Descargar selección" },
  "Cliente notificado por e-mail": { en: "Client notified by email", es: "Cliente notificado por correo" },
  "Abrir link do cliente": { en: "Open client link", es: "Abrir enlace del cliente" },
  "Dê um nome pra galeria.": { en: "Give the gallery a name.", es: "Ponle un nombre a la galería." },
  "Não foi possível criar a galeria.": { en: "We couldn't create the gallery.", es: "No pudimos crear la galería." },
  "Nenhuma foto válida selecionada": { en: "No valid photo selected", es: "Ninguna foto válida seleccionada" },
  "Carregando galeria…": { en: "Loading gallery…", es: "Cargando galería…" },
  "Galeria não encontrada.": { en: "Gallery not found.", es: "Galería no encontrada." },
  "Galeria indisponível.": { en: "Gallery unavailable.", es: "Galería no disponible." },
  "O prazo de acesso a esta galeria terminou. Entre em contato com o fotógrafo para reabri-la.": { en: "Access to this gallery has expired. Contact the photographer to reopen it.", es: "El acceso a esta galería ha caducado. Contacta con el fotógrafo para reabrirla." },
  "Digite a senha para ver as fotos.": { en: "Enter the password to view the photos.", es: "Introduce la contraseña para ver las fotos." },
  "Esta galeria ainda não tem fotos.": { en: "This gallery has no photos yet.", es: "Esta galería todavía no tiene fotos." },
  "Finalizar seleção": { en: "Finish selection", es: "Finalizar selección" },
  "Finalizar seleção?": { en: "Finish selection?", es: "¿Finalizar selección?" },
  "Depois de finalizar, não será possível alterar a seleção.": { en: "After finishing, you won't be able to change the selection.", es: "Después de finalizar, no podrás cambiar la selección." },
  "Carregando foto em alta qualidade": { en: "Loading high-quality photo", es: "Cargando foto en alta calidad" },
  "Próxima foto": { en: "Next photo", es: "Siguiente foto" },
  "Sem comentário nesta foto.": { en: "No comment on this photo.", es: "Sin comentarios en esta foto." },
  "Comente nesta foto…": { en: "Comment on this photo…", es: "Comenta esta foto…" },
  "Conteúdo protegido": { en: "Protected content", es: "Contenido protegido" },
  "Sua galeria está disponível": { en: "Your gallery is ready", es: "Tu galería está disponible" },
  "Ver galeria": { en: "View gallery", es: "Ver galería" },
  "Prazo para seleção:": { en: "Selection deadline:", es: "Fecha límite de selección:" },
  "Link disponível até:": { en: "Link available until:", es: "Enlace disponible hasta:" },
  "Entrega realizada com Fotura": { en: "Delivered with Fotura", es: "Entrega realizada con Fotura" },
  "Sua entrega está pronta": { en: "Your delivery is ready", es: "Tu entrega está lista" },
  "Ver e baixar fotos": { en: "View and download photos", es: "Ver y descargar fotos" },
  "Sua visão geral": { en: "Your overview", es: "Tu resumen" },
  "Perfil do estúdio": { en: "Studio profile", es: "Perfil del estudio" },
  "Sua marca no Fotura": { en: "Your brand on Fotura", es: "Tu marca en Fotura" },
  "Nome do estúdio": { en: "Studio name", es: "Nombre del estudio" },
  "Logo do estúdio": { en: "Studio logo", es: "Logo del estudio" },
  "Salvar perfil": { en: "Save profile", es: "Guardar perfil" },
  "Carregando perfil…": { en: "Loading profile…", es: "Cargando perfil…" },
  "Termos de Uso": { en: "Terms of Use", es: "Términos de Uso" },
  "Política de Privacidade": { en: "Privacy Policy", es: "Política de Privacidad" },
  "Última atualização:": { en: "Last updated:", es: "Última actualización:" }
};

const dynamicPatterns: Array<{ re: RegExp; en: (...m: string[]) => string; es: (...m: string[]) => string }> = [
  { re: /^há (\d+) min$/, en: (n) => `${n} min ago`, es: (n) => `hace ${n} min` },
  { re: /^há (\d+) dias?$/, en: (n) => `${n} day${n === "1" ? "" : "s"} ago`, es: (n) => `hace ${n} día${n === "1" ? "" : "s"}` },
  { re: /^(\d+) selecionadas$/, en: (n) => `${n} selected`, es: (n) => `${n} seleccionadas` },
  { re: /^(\d+) fotos selecionadas nesta demonstração\.$/, en: (n) => `${n} photos selected in this demo.`, es: (n) => `${n} fotos seleccionadas en esta demo.` },
  { re: /^(\d+) comentários?$/, en: (n) => `${n} comment${n === "1" ? "" : "s"}`, es: (n) => `${n} comentario${n === "1" ? "" : "s"}` },
  { re: /^(\d+) novas?$/, en: (n) => `${n} new`, es: (n) => `${n} nueva${n === "1" ? "" : "s"}` },
];

export function translate(locale: Locale, source: string) {
  if (locale === "pt" || !source) return source;
  const exact = messages[source];
  if (exact) return exact[locale];
  for (const pattern of dynamicPatterns) {
    const match = source.match(pattern.re);
    if (match) return pattern[locale](...match.slice(1));
  }
  return source;
}

export function translatePreservingWhitespace(locale: Locale, source: string) {
  if (locale === "pt") return source;
  const leading = source.match(/^\s*/)?.[0] ?? "";
  const trailing = source.match(/\s*$/)?.[0] ?? "";
  const core = source.trim();
  if (!core) return source;
  const translated = translate(locale, core);
  return leading + translated + trailing;
}

export function hasTranslation(source: string) {
  return Boolean(messages[source]) || dynamicPatterns.some((item) => item.re.test(source));
}
