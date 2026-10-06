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
  "à altura.": { en: "worthy of it.", es: "a su altura." },
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
  "Perfil do estúdio": { en: "Studio profile", es: "Perfil del estudio" },
  "Sua marca no Fotura": { en: "Your brand on Fotura", es: "Tu marca en Fotura" },
  "Nome do estúdio": { en: "Studio name", es: "Nombre del estudio" },
  "Logo do estúdio": { en: "Studio logo", es: "Logo del estudio" },
  "Salvar perfil": { en: "Save profile", es: "Guardar perfil" },
  "Carregando perfil…": { en: "Loading profile…", es: "Cargando perfil…" },,
  "Seleção editorial de fotografias": { en: "Editorial photography selection", es: "Selección editorial de fotografías" },
  "Galeria de prova": { en: "Proofing gallery", es: "Galería de selección" },
  "selecionadas": { en: "selected", es: "seleccionadas" },
  "Galerias, clientes e fotos por galeria são ilimitados. Você escolhe o plano pelo armazenamento e pelo nível de apresentação.": { en: "Galleries, clients, and photos per gallery are unlimited. Choose your plan based on storage and presentation level.", es: "Las galerías, los clientes y las fotos por galería son ilimitados. Elige tu plan según el almacenamiento y el nivel de presentación." },
  "Mais indicado": { en: "Recommended", es: "Recomendado" },
  "Escolher": { en: "Choose", es: "Elegir" },
  "Abrir meu painel": { en: "Open my dashboard", es: "Abrir mi panel" },
  "Termos": { en: "Terms", es: "Términos" },
  "Privacidade": { en: "Privacy", es: "Privacidad" },
  "Fotos demonstrativas via Unsplash": { en: "Demo photos via Unsplash", es: "Fotos de demostración vía Unsplash" },
  "1 GB de armazenamento": { en: "1 GB of storage", es: "1 GB de almacenamiento" },
  "10 GB de armazenamento": { en: "10 GB of storage", es: "10 GB de almacenamiento" },
  "50 GB de armazenamento": { en: "50 GB of storage", es: "50 GB de almacenamiento" },
  "100 GB de armazenamento": { en: "100 GB of storage", es: "100 GB de almacenamiento" },
  "Galerias, clientes e fotos ilimitados": { en: "Unlimited galleries, clients, and photos", es: "Galerías, clientes y fotos ilimitados" },
  "Seleção, comentários, senha e entrega": { en: "Selections, comments, password, and delivery", es: "Selección, comentarios, contraseña y entrega" },
  "Identidade básica do estúdio": { en: "Basic studio branding", es: "Identidad básica del estudio" },
  "Hero Minimal com logo, nome e cor": { en: "Minimal hero with logo, name, and color", es: "Hero Minimal con logo, nombre y color" },
  "Prova, comentários, senha e entrega": { en: "Proofing, comments, password, and delivery", es: "Selección, comentarios, contraseña y entrega" },
  "Heroes Minimal, Premium e Tech": { en: "Minimal, Premium, and Tech heroes", es: "Heroes Minimal, Premium y Tech" },
  "Foto da galeria no fundo do hero": { en: "Gallery photo as the hero background", es: "Foto de la galería como fondo del hero" },
  "Mesmos recursos visuais do Profissional": { en: "Same visual features as Professional", es: "Los mismos recursos visuales que Profesional" },
  "Para operações com alto volume": { en: "For high-volume operations", es: "Para operaciones de alto volumen" },
  "Casamentos": { en: "Weddings", es: "Bodas" },
  "Retratos": { en: "Portraits", es: "Retratos" },
  "Eventos": { en: "Events", es: "Eventos" },
  "Comercial": { en: "Commercial", es: "Comercial" },
  "Autorais": { en: "Personal work", es: "Autorales" },
  "O carregamento demorou mais que o esperado. Atualize a página ou tente novamente.": { en: "Loading is taking longer than expected. Refresh the page or try again.", es: "La carga está tardando más de lo esperado. Actualiza la página o inténtalo de nuevo." },
  "Não foi possível carregar as seleções agora.": { en: "We couldn't load selections right now.", es: "No pudimos cargar las selecciones ahora." },
  "Não foi possível carregar seu painel agora.": { en: "We couldn't load your dashboard right now.", es: "No pudimos cargar tu panel ahora." },
  "Não foi possível marcar as notificações como lidas.": { en: "We couldn't mark notifications as read.", es: "No pudimos marcar las notificaciones como leídas." },
  "Sem atualização": { en: "No update", es: "Sin actualización" },
  "Todas as galerias, da prova à entrega final": { en: "All galleries, from proofing to final delivery", es: "Todas las galerías, desde la selección hasta la entrega final" },
  "Nenhuma seleção aguardando cliente.": { en: "No selection is waiting for a client.", es: "Ninguna selección está esperando al cliente." },
  "Aguardando primeira interação do cliente": { en: "Waiting for the client's first interaction", es: "Esperando la primera interacción del cliente" },
  "Não foi possível carregar suas galerias agora.": { en: "We couldn't load your galleries right now.", es: "No pudimos cargar tus galerías ahora." },
  "Não foi possível salvar as configurações.": { en: "We couldn't save the settings.", es: "No pudimos guardar la configuración." },
  "Não foi possível remover a senha.": { en: "We couldn't remove the password.", es: "No pudimos eliminar la contraseña." },
  "Não foi possível atualizar a capa.": { en: "We couldn't update the cover.", es: "No pudimos actualizar la portada." },
  "Sua sessão expirou. Entre novamente.": { en: "Your session expired. Sign in again.", es: "Tu sesión caducó. Inicia sesión de nuevo." },
  "Vincule um cliente para compartilhar por WhatsApp ou e-mail. O link ainda pode ser copiado.": { en: "Link a client to share by WhatsApp or email. You can still copy the link.", es: "Vincula un cliente para compartir por WhatsApp o correo. Aún puedes copiar el enlace." },
  "O cliente não possui telefone válido para WhatsApp.": { en: "The client does not have a valid WhatsApp phone number.", es: "El cliente no tiene un teléfono válido para WhatsApp." },
  "O cliente não possui e-mail cadastrado.": { en: "The client does not have an email address on file.", es: "El cliente no tiene un correo registrado." },
  "Conteúdo e prova": { en: "Content and proofing", es: "Contenido y selección" },
  "Baixar a seleção, enviar as versões finais e publicar.": { en: "Download the selection, upload final versions, and publish.", es: "Descarga la selección, sube las versiones finales y publica." },
  "Cliente, prova, prazos, vendas, limite e senha.": { en: "Client, proofing, deadlines, sales, limit, and password.", es: "Cliente, selección, plazos, ventas, límite y contraseña." },
  "Remove permanentemente a galeria e seus arquivos.": { en: "Permanently removes the gallery and its files.", es: "Elimina permanentemente la galería y sus archivos." },
  "Fechar configuração": { en: "Close settings", es: "Cerrar configuración" },
  "Ativa seleção e comentários do cliente.": { en: "Enables client selections and comments.", es: "Activa la selección y los comentarios del cliente." },
  "Limite de seleção": { en: "Selection limit", es: "Límite de selección" },
  "Venda de fotos extras": { en: "Extra photo sales", es: "Venta de fotos extra" },
  "Disponível nos planos pagos do Fotura.": { en: "Available on Fotura paid plans.", es: "Disponible en los planes de pago de Fotura." },
  "Preço por foto extra (R$)": { en: "Price per extra photo (R$)", es: "Precio por foto extra (R$)" },
  "Fechar escolha de capa": { en: "Close cover selection", es: "Cerrar selección de portada" },
  "Preparando fotos…": { en: "Preparing photos…", es: "Preparando fotos…" },
  "Não foi possível carregar seus clientes agora.": { en: "We couldn't load your clients right now.", es: "No pudimos cargar tus clientes ahora." },
  "Não foi possível cadastrar o cliente.": { en: "We couldn't add the client.", es: "No pudimos añadir el cliente." },
  "Atualize os dados de contato e salve as alterações.": { en: "Update the contact details and save your changes.", es: "Actualiza los datos de contacto y guarda los cambios." },
  "Cadastre os dados essenciais para vincular galerias e facilitar o contato.": { en: "Add the essential details to link galleries and make contact easier.", es: "Añade los datos esenciales para vincular galerías y facilitar el contacto." },
  "Edição": { en: "Edit", es: "Edición" },
  "Nenhum cliente corresponde aos filtros atuais.": { en: "No client matches the current filters.", es: "Ningún cliente coincide con los filtros actuales." },
  "não informado": { en: "not provided", es: "no informado" },
  "Sem atualização registrada": { en: "No update recorded", es: "Sin actualización registrada" },
  "Ciclo de prova e preparação": { en: "Proofing and preparation cycle", es: "Ciclo de selección y preparación" },
  "Nenhuma seleção encontrada neste filtro.": { en: "No selection found for this filter.", es: "No se encontró ninguna selección con este filtro." },
  "Período de teste": { en: "Trial period", es: "Período de prueba" },
  "Não paga": { en: "Unpaid", es: "No pagado" },
  "Não foi possível carregar os dados da assinatura agora.": { en: "We couldn't load subscription data right now.", es: "No pudimos cargar los datos de la suscripción ahora." },
  "Não foi possível iniciar o checkout.": { en: "We couldn't start checkout.", es: "No pudimos iniciar el pago." },
  "Não foi possível abrir o gerenciamento da assinatura.": { en: "We couldn't open subscription management.", es: "No pudimos abrir la gestión de la suscripción." },
  "Escolha o espaço que combina com seu volume de trabalho": { en: "Choose the storage that fits your workload", es: "Elige el espacio que se adapta a tu volumen de trabajo" },
  "Todos incluem galerias, clientes e fotos por galeria ilimitados.": { en: "All plans include unlimited galleries, clients, and photos per gallery.", es: "Todos incluyen galerías, clientes y fotos por galería ilimitados." },
  "/mês": { en: "/month", es: "/mes" },
  "Não foi possível carregar suas vendas agora.": { en: "We couldn't load your sales right now.", es: "No pudimos cargar tus ventas ahora." },
  "Buscar vendas por galeria": { en: "Search sales by gallery", es: "Buscar ventas por galería" },
  "Ações": { en: "Actions", es: "Acciones" },
  "Nenhuma venda corresponde à busca ou ao filtro.": { en: "No sale matches the search or filter.", es: "Ninguna venta coincide con la búsqueda o el filtro." },
  "Não foi possível carregar o histórico de atividade agora.": { en: "We couldn't load account activity right now.", es: "No pudimos cargar el historial de actividad ahora." },
  "Acompanhe alterações importantes em galerias, clientes e seleções.": { en: "Track important changes in galleries, clients, and selections.", es: "Sigue cambios importantes en galerías, clientes y selecciones." },
  "Você": { en: "You", es: "Tú" },
  "Sessão expirada": { en: "Session expired", es: "Sesión caducada" },
  "Não foi possível publicar a entrega.": { en: "We couldn't publish the delivery.", es: "No pudimos publicar la entrega." },
  "Entrega publicada e cliente notificado por e-mail.": { en: "Delivery published and client notified by email.", es: "Entrega publicada y cliente notificado por correo." },
  "Entrega publicada. O mesmo link agora mostra as fotos finais.": { en: "Delivery published. The same link now shows the final photos.", es: "Entrega publicada. El mismo enlace ahora muestra las fotos finales." },
  "← Voltar para Seleções": { en: "← Back to Selections", es: "← Volver a Selecciones" },
  "A mesma galeria acompanha o trabalho da prova até a entrega final.": { en: "The same gallery follows the job from proofing through final delivery.", es: "La misma galería acompaña el trabajo desde la selección hasta la entrega final." },
  "Depois do tratamento, envie aqui as versões finais. Elas ficam separadas das fotos de prova.": { en: "After editing, upload the final versions here. They stay separate from proofing photos.", es: "Después de editar, sube aquí las versiones finales. Se mantienen separadas de las fotos de selección." },
  "Quando publicar, o mesmo link do cliente passa a exibir as fotos finais com download.": { en: "When you publish, the same client link starts showing the final photos with download.", es: "Cuando publiques, el mismo enlace del cliente mostrará las fotos finales con descarga." },
  "Publicada; notificação por e-mail não registrada": { en: "Published; email notification not recorded", es: "Publicada; notificación por correo no registrada" },
  "Ex: Casamento Ana e João": { en: "Ex: Ana and João Wedding", es: "Ej.: Boda de Ana y João" },
  "Sem conexão.": { en: "Offline.", es: "Sin conexión." },
  "O Fotura mantém o upload resumível e tentará continuar quando a internet voltar. Não feche esta página enquanto houver envio em andamento.": { en: "Fotura keeps uploads resumable and will try to continue when your connection returns. Don't close this page while uploads are in progress.", es: "Fotura mantiene la carga reanudable e intentará continuar cuando vuelva la conexión. No cierres esta página mientras haya cargas en curso." },
  "Não foi possível carregar as fotos.": { en: "We couldn't load the photos.", es: "No pudimos cargar las fotos." },
  "Sua sessão de acesso expirou. Digite a senha novamente.": { en: "Your access session expired. Enter the password again.", es: "Tu sesión de acceso caducó. Introduce la contraseña de nuevo." },
  "Pagamento cancelado. Sua seleção continua salva.": { en: "Payment canceled. Your selection remains saved.", es: "Pago cancelado. Tu selección sigue guardada." },
  "Não foi possível salvar.": { en: "We couldn't save.", es: "No pudimos guardar." },
  "Link expirado.": { en: "Link expired.", es: "Enlace caducado." },
  "Não foi possível salvar a seleção.": { en: "We couldn't save the selection.", es: "No pudimos guardar la selección." },
  "Não foi possível iniciar o pagamento.": { en: "We couldn't start payment.", es: "No pudimos iniciar el pago." },
  "Não foi possível preparar os arquivos para download.": { en: "We couldn't prepare the files for download.", es: "No pudimos preparar los archivos para descargar." },
  "Download interrompido. Os arquivos já baixados foram mantidos.": { en: "Download interrupted. Files already downloaded were kept.", es: "Descarga interrumpida. Los archivos ya descargados se conservaron." },
  "Link da galeria copiado.": { en: "Gallery link copied.", es: "Enlace de la galería copiado." },
  "Não foi possível copiar o link.": { en: "We couldn't copy the link.", es: "No pudimos copiar el enlace." }
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
