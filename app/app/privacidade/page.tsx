"use client";

import Link from "next/link";
import { useI18n } from "../components/I18nProvider";
import { type Locale, withLocalePath } from "../../lib/i18n";

type Section = { title: string; paragraphs: Array<string | { lead: string; body: string }> };
type LegalCopy = { title: string; updated: string; terms: string; back: string; sections: Section[] };

const COPY: Record<Locale, LegalCopy> = {
  pt: {
    title: "Política de Privacidade",
    updated: "Última atualização: 30 de setembro de 2026",
    terms: "Termos de Uso",
    back: "Voltar ao login",
    sections: [
      { title: "", paragraphs: ["Esta Política descreve como o Fotura trata dados pessoais em conformidade com a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD)."] },
      { title: "1. Dados tratados", paragraphs: [
        { lead: "Fotógrafos:", body: "dados de autenticação, nome do estúdio, logotipo, fotos, configurações de galerias e dados necessários ao funcionamento e segurança da plataforma." },
        { lead: "Clientes cadastrados pelo fotógrafo:", body: "nome e, opcionalmente, e-mail e telefone, além do vínculo com galerias. No link público, o cliente não precisa informar esses dados ao Fotura para visualizar a galeria. Seleções e comentários feitos na galeria também são processados para prestar o serviço." },
      ]},
      { title: "2. Papéis no tratamento de dados de clientes", paragraphs: ["Quando um fotógrafo cadastra dados pessoais de seus clientes, o fotógrafo determina a finalidade e os meios essenciais desse tratamento e atua como controlador. O Fotura processa esses dados para disponibilizar as funcionalidades contratadas, atuando como operador, nos limites das instruções do fotógrafo e da legislação aplicável."] },
      { title: "3. Finalidades e bases legais", paragraphs: ["Os dados da conta são tratados para autenticação, segurança, prestação e melhoria do serviço e comunicações relacionadas à plataforma, conforme as bases legais aplicáveis, incluindo execução de contrato e outras hipóteses previstas na LGPD. Cabe ao fotógrafo definir e manter base legal adequada para os dados de terceiros que cadastrar no Fotura."] },
      { title: "4. Compartilhamento", paragraphs: ["Não vendemos dados pessoais. Para operar o serviço, dados podem ser processados por fornecedores de infraestrutura, incluindo Supabase (banco de dados e armazenamento) e Vercel (hospedagem), observadas as medidas contratuais e de segurança aplicáveis."] },
      { title: "5. Segurança", paragraphs: ["As fotos são armazenadas em bucket privado e disponibilizadas por links assinados temporários. A comunicação utiliza HTTPS e são adotados controles de acesso e isolamento entre contas."] },
      { title: "6. Retenção, exportação e encerramento", paragraphs: [
        "Dados da conta são mantidos enquanto necessários à prestação do serviço e pelo tempo exigido por obrigações legais. O fotógrafo pode editar ou excluir registros de clientes cadastrados por ele. Ao excluir um cliente, suas galerias podem permanecer existentes, mas sem o vínculo cadastral com esse cliente. Dados podem ser conservados quando houver obrigação legal ou outra hipótese permitida pela LGPD.",
        "O titular da conta pode solicitar uma exportação estruturada dos seus dados em Configurações. Também pode iniciar o encerramento da própria conta. O encerramento possui período de segurança e etapa de confirmação antes do bloqueio do acesso e do conteúdo público; a exclusão física definitiva é tratada separadamente para reduzir o risco de perda acidental e respeitar retenções legalmente necessárias."
      ]},
      { title: "7. Direitos dos titulares", paragraphs: [
        "A LGPD assegura, conforme aplicável, direitos de confirmação, acesso, correção, anonimização, bloqueio, eliminação, portabilidade, informação e revogação do consentimento. Para titulares de contas Fotura, os recursos de exportação e encerramento disponíveis em Configurações facilitam o exercício de acesso, portabilidade e eliminação, sem prejuízo do contato direto indicado nesta Política.",
        "Para dados de clientes cadastrados por um fotógrafo, solicitações relativas a esses dados devem ser dirigidas inicialmente ao fotógrafo responsável, que é o controlador. O Fotura prestará a assistência tecnicamente cabível ao fotógrafo para atendimento da solicitação. Titulares também podem utilizar o contato abaixo para questões relacionadas ao tratamento realizado pelo Fotura."
      ]},
      { title: "8. Cookies", paragraphs: ["O Fotura utiliza cookies essenciais para autenticação e funcionamento da sessão. Não utiliza cookies de publicidade no fluxo atualmente disponibilizado."] },
      { title: "9. Alterações", paragraphs: ["Esta política pode ser atualizada para refletir mudanças no serviço ou requisitos legais. Alterações relevantes poderão ser comunicadas pelos meios disponíveis na plataforma."] },
      { title: "10. Contato", paragraphs: ["Dúvidas e solicitações relacionadas à privacidade podem ser enviadas para izaqueandrade384@gmail.com."] },
    ],
  },
  en: {
    title: "Privacy Policy",
    updated: "Last updated: September 30, 2026",
    terms: "Terms of Use",
    back: "Back to sign in",
    sections: [
      { title: "", paragraphs: ["This Policy describes how Fotura processes personal data in accordance with Brazil's General Data Protection Law (Law No. 13,709/2018 — LGPD)."] },
      { title: "1. Data we process", paragraphs: [
        { lead: "Photographers:", body: "authentication data, studio name, logo, photos, gallery settings, and data needed for the platform to operate securely." },
        { lead: "Clients added by photographers:", body: "name and, optionally, email address and phone number, plus links to galleries. On a public link, clients do not need to provide this data to Fotura to view the gallery. Selections and comments made in a gallery are also processed to provide the service." },
      ]},
      { title: "2. Roles in processing client data", paragraphs: ["When a photographer adds personal data about clients, the photographer determines the purpose and essential means of that processing and acts as controller. Fotura processes that data to provide the contracted features and acts as processor within the photographer's instructions and applicable law."] },
      { title: "3. Purposes and legal bases", paragraphs: ["Account data is processed for authentication, security, service delivery and improvement, and platform-related communications under applicable legal bases, including performance of a contract and other bases available under the LGPD. Photographers are responsible for establishing and maintaining an appropriate legal basis for third-party data they add to Fotura."] },
      { title: "4. Sharing", paragraphs: ["We do not sell personal data. To operate the service, data may be processed by infrastructure providers including Supabase (database and storage) and Vercel (hosting), subject to applicable contractual and security measures."] },
      { title: "5. Security", paragraphs: ["Photos are stored in a private bucket and made available through temporary signed links. Communications use HTTPS, and access controls and account isolation measures are applied."] },
      { title: "6. Retention, export, and account closure", paragraphs: [
        "Account data is kept while needed to provide the service and for periods required by legal obligations. Photographers can edit or delete client records they created. If a client record is deleted, its galleries may remain but without the registered link to that client. Data may be retained when a legal obligation or another basis permitted by the LGPD applies.",
        "Account holders can request a structured export of their data in Settings. They can also start account closure. Closure includes a safety period and a confirmation step before account access and public content are blocked; final physical deletion is handled separately to reduce accidental data-loss risk and respect legally required retention."
      ]},
      { title: "7. Data-subject rights", paragraphs: [
        "Where applicable, the LGPD provides rights including confirmation, access, correction, anonymization, blocking, deletion, portability, information, and withdrawal of consent. For Fotura account holders, export and closure tools available in Settings support access, portability, and deletion requests without limiting the direct contact described in this Policy.",
        "For client data entered by a photographer, requests concerning that data should first be directed to the responsible photographer, who is the controller. Fotura will provide technically appropriate assistance to the photographer. Data subjects may also use the contact below for questions related to processing carried out by Fotura."
      ]},
      { title: "8. Cookies", paragraphs: ["Fotura uses essential cookies for authentication and session operation. It does not use advertising cookies in the currently available flow."] },
      { title: "9. Changes", paragraphs: ["This Policy may be updated to reflect changes to the service or legal requirements. Material changes may be communicated through available channels."] },
      { title: "10. Contact", paragraphs: ["Privacy questions and requests can be sent to izaqueandrade384@gmail.com."] },
    ],
  },
  es: {
    title: "Política de Privacidad",
    updated: "Última actualización: 30 de septiembre de 2026",
    terms: "Términos de Uso",
    back: "Volver al inicio de sesión",
    sections: [
      { title: "", paragraphs: ["Esta Política describe cómo Fotura trata datos personales de conformidad con la Ley General de Protección de Datos Personales de Brasil (Ley n.º 13.709/2018 — LGPD)."] },
      { title: "1. Datos tratados", paragraphs: [
        { lead: "Fotógrafos:", body: "datos de autenticación, nombre del estudio, logotipo, fotos, configuración de galerías y datos necesarios para el funcionamiento y la seguridad de la plataforma." },
        { lead: "Clientes registrados por el fotógrafo:", body: "nombre y, opcionalmente, correo electrónico y teléfono, además de la vinculación con galerías. En el enlace público, el cliente no necesita proporcionar estos datos a Fotura para ver la galería. Las selecciones y comentarios realizados en la galería también se procesan para prestar el servicio." },
      ]},
      { title: "2. Roles en el tratamiento de datos de clientes", paragraphs: ["Cuando un fotógrafo registra datos personales de sus clientes, el fotógrafo determina la finalidad y los medios esenciales del tratamiento y actúa como responsable. Fotura procesa esos datos para ofrecer las funcionalidades contratadas, actuando como encargado dentro de las instrucciones del fotógrafo y la legislación aplicable."] },
      { title: "3. Finalidades y bases jurídicas", paragraphs: ["Los datos de la cuenta se tratan para autenticación, seguridad, prestación y mejora del servicio y comunicaciones relacionadas con la plataforma, conforme a las bases jurídicas aplicables, incluida la ejecución de un contrato y otras hipótesis previstas en la LGPD. Corresponde al fotógrafo definir y mantener una base jurídica adecuada para los datos de terceros que registre en Fotura."] },
      { title: "4. Compartición", paragraphs: ["No vendemos datos personales. Para operar el servicio, los datos pueden ser procesados por proveedores de infraestructura, incluidos Supabase (base de datos y almacenamiento) y Vercel (alojamiento), observando las medidas contractuales y de seguridad aplicables."] },
      { title: "5. Seguridad", paragraphs: ["Las fotos se almacenan en un bucket privado y se proporcionan mediante enlaces firmados temporales. La comunicación utiliza HTTPS y se aplican controles de acceso y aislamiento entre cuentas."] },
      { title: "6. Retención, exportación y cierre", paragraphs: [
        "Los datos de la cuenta se mantienen mientras sean necesarios para prestar el servicio y durante los plazos exigidos por obligaciones legales. El fotógrafo puede editar o eliminar los registros de clientes que haya creado. Al eliminar un cliente, sus galerías pueden seguir existiendo, pero sin el vínculo registral con ese cliente. Los datos pueden conservarse cuando exista una obligación legal u otra base permitida por la LGPD.",
        "El titular de la cuenta puede solicitar una exportación estructurada de sus datos en Configuración. También puede iniciar el cierre de la cuenta. El cierre incluye un período de seguridad y una etapa de confirmación antes de bloquear el acceso y el contenido público; la eliminación física definitiva se gestiona por separado para reducir el riesgo de pérdida accidental y respetar las retenciones exigidas legalmente."
      ]},
      { title: "7. Derechos de los titulares", paragraphs: [
        "Cuando corresponda, la LGPD garantiza derechos de confirmación, acceso, corrección, anonimización, bloqueo, eliminación, portabilidad, información y revocación del consentimiento. Para titulares de cuentas Fotura, las herramientas de exportación y cierre disponibles en Configuración facilitan el ejercicio de acceso, portabilidad y eliminación, sin perjuicio del contacto directo indicado en esta Política.",
        "Para los datos de clientes registrados por un fotógrafo, las solicitudes relacionadas con esos datos deben dirigirse inicialmente al fotógrafo responsable, que actúa como responsable del tratamiento. Fotura prestará la asistencia técnicamente adecuada al fotógrafo. Los titulares también pueden utilizar el contacto indicado abajo para cuestiones relacionadas con el tratamiento realizado por Fotura."
      ]},
      { title: "8. Cookies", paragraphs: ["Fotura utiliza cookies esenciales para la autenticación y el funcionamiento de la sesión. No utiliza cookies publicitarias en el flujo disponible actualmente."] },
      { title: "9. Cambios", paragraphs: ["Esta Política puede actualizarse para reflejar cambios en el servicio o requisitos legales. Los cambios relevantes podrán comunicarse mediante los canales disponibles."] },
      { title: "10. Contacto", paragraphs: ["Las dudas y solicitudes relacionadas con la privacidad pueden enviarse a izaqueandrade384@gmail.com."] },
    ],
  },
};

export default function PrivacidadePage() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const s: React.CSSProperties = { minHeight:"100vh",background:"linear-gradient(180deg,#F0EDF7 0%,#ECE8F4 100%)",color:"#596079",padding:"48px 24px" };
  const card: React.CSSProperties = { maxWidth:720,margin:"0 auto",background:"#FAF8FD",borderRadius:16,border:"1px solid #D7D0E7",padding:"40px 36px" };
  const h1: React.CSSProperties = { fontSize:24,fontWeight:700,color:"#21253A" };
  const h2: React.CSSProperties = { fontSize:17,fontWeight:600,color:"#34394F",marginTop:28 };
  const p: React.CSSProperties = { fontSize:14,lineHeight:1.8,marginBottom:12 };

  return <div style={s}><div style={card}>
    <div style={{textAlign:"center",marginBottom:32}}>
      <Link href={withLocalePath("/", locale)} style={{fontSize:22,fontWeight:700,letterSpacing:4,color:"#21253A",textDecoration:"none"}}>FOTURA</Link>
    </div>
    <h1 style={h1}>{copy.title}</h1>
    <p style={{...p,color:"#7a7f9a"}}>{copy.updated}</p>
    {copy.sections.map((section, sectionIndex) => <section key={section.title || sectionIndex}>
      {section.title && <h2 style={h2}>{section.title}</h2>}
      {section.paragraphs.map((paragraph, index) => <p key={index} style={p}>
        {typeof paragraph === "string" ? paragraph : <><strong>{paragraph.lead}</strong> {paragraph.body}</>}
      </p>)}
    </section>)}
    <div style={{marginTop:32,textAlign:"center"}}>
      <Link href={withLocalePath("/termos", locale)} style={{color:"#4a6cf7"}}>{copy.terms}</Link>
      <span style={{margin:"0 12px"}}>•</span>
      <Link href={withLocalePath("/login", locale)} style={{color:"#4a6cf7"}}>{copy.back}</Link>
    </div>
  </div></div>;
}
