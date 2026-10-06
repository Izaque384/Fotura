"use client";

import Link from "next/link";
import { useI18n } from "../components/I18nProvider";
import { type Locale, withLocalePath } from "../../lib/i18n";

type Section = { title: string; paragraphs: string[] };
type LegalCopy = { title: string; updated: string; privacy: string; back: string; sections: Section[] };

const COPY: Record<Locale, LegalCopy> = {
  pt: {
    title: "Termos de Uso",
    updated: "Última atualização: 27 de agosto de 2026",
    privacy: "Política de Privacidade",
    back: "Voltar ao login",
    sections: [
      { title: "1. Aceitação", paragraphs: ["Ao criar uma conta no Fotura, você declara que leu e concorda com estes Termos e com a Política de Privacidade."] },
      { title: "2. Serviço", paragraphs: ["O Fotura permite a fotógrafos criar galerias, enviar imagens e compartilhar links com clientes para visualização, seleção, comentários e download, além de organizar informações relacionadas às entregas."] },
      { title: "3. Conta", paragraphs: ["Você é responsável por manter suas credenciais seguras e pelas atividades realizadas em sua conta."] },
      { title: "4. Conteúdo", paragraphs: ["Você mantém os direitos sobre fotos e marcas enviadas. Concede ao Fotura licença limitada para armazenar, processar e exibir esse conteúdo exclusivamente para prestar o serviço e declara possuir os direitos necessários para utilizá-lo."] },
      { title: "5. Dados de clientes e terceiros", paragraphs: [
        "Ao cadastrar nome, e-mail, telefone ou outros dados de clientes ou terceiros no Fotura, o fotógrafo declara possuir fundamento jurídico adequado para realizar esse tratamento e fornecer os dados à plataforma para a prestação do serviço. O fotógrafo é responsável pela exatidão dos dados, pelas informações de privacidade que lhe caibam fornecer e pelo atendimento dos direitos dos titulares quando atuar como controlador.",
        "O Fotura atuará como operador dos dados cadastrados pelo fotógrafo quando processá-los em nome dele, conforme descrito na Política de Privacidade, sem utilizar esses dados para finalidades próprias incompatíveis com a prestação do serviço."
      ]},
      { title: "6. Uso aceitável", paragraphs: ["É proibido utilizar o Fotura para armazenar ou compartilhar conteúdo ilegal, que viole direitos de terceiros ou a legislação aplicável. Contas que violem esta regra podem ser suspensas ou encerradas."] },
      { title: "7. Disponibilidade", paragraphs: ["Buscamos manter o serviço disponível, mas manutenções, atualizações ou incidentes técnicos podem causar interrupções temporárias."] },
      { title: "8. Armazenamento", paragraphs: ["O armazenamento pode variar conforme o plano. Galerias e fotos podem ser removidas pelo fotógrafo e também podem estar sujeitas às regras de expiração configuradas na plataforma."] },
      { title: "9. Planos e pagamento", paragraphs: ["O Fotura pode oferecer planos gratuitos e pagos. Valores, recursos e limites serão apresentados na plataforma quando aplicáveis."] },
      { title: "10. Rescisão", paragraphs: ["O usuário pode deixar de utilizar o serviço e solicitar o encerramento de sua conta. O Fotura poderá suspender ou encerrar contas em caso de violação destes Termos, observadas as regras aplicáveis."] },
      { title: "11. Alterações", paragraphs: ["Estes Termos podem ser atualizados para refletir mudanças no produto ou requisitos legais. Alterações relevantes poderão ser comunicadas pelos meios disponíveis."] },
      { title: "12. Legislação", paragraphs: ["Estes Termos são regidos pela legislação da República Federativa do Brasil, respeitadas as normas de proteção ao consumidor e demais regras de competência aplicáveis."] },
    ],
  },
  en: {
    title: "Terms of Use",
    updated: "Last updated: August 27, 2026",
    privacy: "Privacy Policy",
    back: "Back to sign in",
    sections: [
      { title: "1. Acceptance", paragraphs: ["By creating a Fotura account, you state that you have read and agree to these Terms and the Privacy Policy."] },
      { title: "2. Service", paragraphs: ["Fotura allows photographers to create galleries, upload images, and share links with clients for viewing, selection, comments, and downloads, as well as organize information related to deliveries."] },
      { title: "3. Account", paragraphs: ["You are responsible for keeping your credentials secure and for activities performed through your account."] },
      { title: "4. Content", paragraphs: ["You retain the rights to the photos and brand assets you upload. You grant Fotura a limited license to store, process, and display that content solely to provide the service, and you represent that you have the rights required to use it."] },
      { title: "5. Client and third-party data", paragraphs: [
        "When adding names, email addresses, phone numbers, or other data about clients or third parties to Fotura, the photographer represents that there is an appropriate legal basis for that processing and for providing the data to the platform to deliver the service. The photographer is responsible for data accuracy, for any privacy notices they are required to provide, and for handling data-subject rights when acting as controller.",
        "Fotura acts as a processor for data entered by photographers when processing it on their behalf, as described in the Privacy Policy, and does not use that data for its own purposes incompatible with providing the service."
      ]},
      { title: "6. Acceptable use", paragraphs: ["Fotura may not be used to store or share illegal content, content that infringes third-party rights, or content that violates applicable law. Accounts that violate this rule may be suspended or terminated."] },
      { title: "7. Availability", paragraphs: ["We work to keep the service available, but maintenance, updates, or technical incidents may cause temporary interruptions."] },
      { title: "8. Storage", paragraphs: ["Storage may vary by plan. Galleries and photos may be removed by the photographer and may also be subject to expiration rules configured on the platform."] },
      { title: "9. Plans and payment", paragraphs: ["Fotura may offer free and paid plans. Prices, features, and limits are shown on the platform when applicable."] },
      { title: "10. Termination", paragraphs: ["Users may stop using the service and request account closure. Fotura may suspend or terminate accounts that violate these Terms, subject to applicable rules."] },
      { title: "11. Changes", paragraphs: ["These Terms may be updated to reflect product changes or legal requirements. Material changes may be communicated through available channels."] },
      { title: "12. Governing law", paragraphs: ["These Terms are governed by the laws of the Federative Republic of Brazil, subject to applicable consumer-protection rules and jurisdiction requirements."] },
    ],
  },
  es: {
    title: "Términos de Uso",
    updated: "Última actualización: 27 de agosto de 2026",
    privacy: "Política de Privacidad",
    back: "Volver al inicio de sesión",
    sections: [
      { title: "1. Aceptación", paragraphs: ["Al crear una cuenta en Fotura, declaras que has leído y aceptas estos Términos y la Política de Privacidad."] },
      { title: "2. Servicio", paragraphs: ["Fotura permite a los fotógrafos crear galerías, subir imágenes y compartir enlaces con clientes para visualización, selección, comentarios y descarga, además de organizar información relacionada con las entregas."] },
      { title: "3. Cuenta", paragraphs: ["Eres responsable de mantener seguras tus credenciales y de las actividades realizadas en tu cuenta."] },
      { title: "4. Contenido", paragraphs: ["Conservas los derechos sobre las fotos y los elementos de marca que subes. Concedes a Fotura una licencia limitada para almacenar, procesar y mostrar ese contenido exclusivamente para prestar el servicio y declaras tener los derechos necesarios para utilizarlo."] },
      { title: "5. Datos de clientes y terceros", paragraphs: [
        "Al registrar nombres, correos electrónicos, teléfonos u otros datos de clientes o terceros en Fotura, el fotógrafo declara contar con una base jurídica adecuada para realizar ese tratamiento y proporcionar los datos a la plataforma para prestar el servicio. El fotógrafo es responsable de la exactitud de los datos, de la información de privacidad que deba proporcionar y del ejercicio de los derechos de los titulares cuando actúe como responsable.",
        "Fotura actúa como encargado del tratamiento de los datos registrados por el fotógrafo cuando los procesa en su nombre, conforme a la Política de Privacidad, y no utiliza esos datos para fines propios incompatibles con la prestación del servicio."
      ]},
      { title: "6. Uso aceptable", paragraphs: ["Está prohibido utilizar Fotura para almacenar o compartir contenido ilegal, que infrinja derechos de terceros o la legislación aplicable. Las cuentas que incumplan esta regla pueden ser suspendidas o cerradas."] },
      { title: "7. Disponibilidad", paragraphs: ["Trabajamos para mantener el servicio disponible, pero el mantenimiento, las actualizaciones o los incidentes técnicos pueden causar interrupciones temporales."] },
      { title: "8. Almacenamiento", paragraphs: ["El almacenamiento puede variar según el plan. Las galerías y fotos pueden ser eliminadas por el fotógrafo y también pueden estar sujetas a las reglas de caducidad configuradas en la plataforma."] },
      { title: "9. Planes y pago", paragraphs: ["Fotura puede ofrecer planes gratuitos y de pago. Los precios, recursos y límites se muestran en la plataforma cuando corresponda."] },
      { title: "10. Terminación", paragraphs: ["El usuario puede dejar de utilizar el servicio y solicitar el cierre de su cuenta. Fotura puede suspender o cerrar cuentas en caso de incumplimiento de estos Términos, conforme a las reglas aplicables."] },
      { title: "11. Cambios", paragraphs: ["Estos Términos pueden actualizarse para reflejar cambios en el producto o requisitos legales. Los cambios relevantes podrán comunicarse a través de los medios disponibles."] },
      { title: "12. Legislación aplicable", paragraphs: ["Estos Términos se rigen por las leyes de la República Federativa de Brasil, respetando las normas aplicables de protección al consumidor y competencia jurisdiccional."] },
    ],
  },
};

export default function TermosPage() {
  const { locale } = useI18n();
  const copy = COPY[locale];
  const s: React.CSSProperties = { minHeight:"100vh",background:"linear-gradient(180deg,#F0EDF7,#ECE8F4)",color:"#596079",padding:"48px 24px" };
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
    {copy.sections.map((section) => <section key={section.title}>
      <h2 style={h2}>{section.title}</h2>
      {section.paragraphs.map((paragraph) => <p key={paragraph} style={p}>{paragraph}</p>)}
    </section>)}
    <div style={{marginTop:32,textAlign:"center"}}>
      <Link href={withLocalePath("/privacidade", locale)} style={{color:"#4a6cf7"}}>{copy.privacy}</Link>
      <span style={{margin:"0 12px"}}>•</span>
      <Link href={withLocalePath("/login", locale)} style={{color:"#4a6cf7"}}>{copy.back}</Link>
    </div>
  </div></div>;
}
