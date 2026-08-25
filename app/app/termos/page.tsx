"use client";

import Link from "next/link";

export default function TermosPage() {
  const s: React.CSSProperties = {
    minHeight: "100vh",
    background: "linear-gradient(180deg, #0b0b1a 0%, #111126 100%)",
    color: "#c8cad4",
    fontFamily: "sans-serif",
    padding: "48px 24px",
  };
  const card: React.CSSProperties = {
    maxWidth: 720,
    margin: "0 auto",
    background: "#16162a",
    borderRadius: 16,
    border: "1px solid #2a2d40",
    padding: "40px 36px",
  };
  const h1: React.CSSProperties = { fontSize: 24, fontWeight: 700, color: "#f0f0f5", marginBottom: 8 };
  const h2: React.CSSProperties = { fontSize: 17, fontWeight: 600, color: "#e0e0ea", marginTop: 28, marginBottom: 8 };
  const p: React.CSSProperties = { fontSize: 14, lineHeight: 1.8, marginBottom: 12 };
  const dataAtual = "25 de agosto de 2026";

  return (
    <div style={s}>
      <div style={card}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 22, fontWeight: 700, letterSpacing: 4, color: "#f0f0f5", textDecoration: "none" }}>FOTURA</Link>
        </div>

        <h1 style={h1}>Termos de Uso</h1>
        <p style={{ ...p, color: "#7a7f9a" }}>Última atualização: {dataAtual}</p>

        <h2 style={h2}>1. Aceitação</h2>
        <p style={p}>
          Ao criar uma conta na plataforma Fotura, você declara que leu, compreendeu e concorda
          com estes Termos de Uso e com a nossa Política de Privacidade. Se não concordar, não
          utilize o serviço.
        </p>

        <h2 style={h2}>2. Descrição do serviço</h2>
        <p style={p}>
          O Fotura é uma plataforma online que permite a fotógrafos profissionais criar galerias de
          fotos, enviar imagens e compartilhar links personalizados com seus clientes para
          visualização, comentários e download.
        </p>

        <h2 style={h2}>3. Cadastro e conta</h2>
        <p style={p}>
          Para utilizar o Fotura como fotógrafo, é necessário criar uma conta com e-mail válido e
          senha. Você é responsável por manter suas credenciais seguras e por todas as atividades
          realizadas em sua conta.
        </p>

        <h2 style={h2}>4. Conteúdo e propriedade intelectual</h2>
        <p style={p}>
          Você mantém todos os direitos autorais e de propriedade intelectual sobre as fotos e
          logotipos que envia ao Fotura. Ao usar a plataforma, você concede ao Fotura uma licença
          limitada, não exclusiva e revogável para armazenar, processar (gerar miniaturas e
          marca-d'água) e exibir o conteúdo exclusivamente para a prestação do serviço.
        </p>
        <p style={p}>
          Você declara que possui os direitos sobre todo o conteúdo enviado e que este não viola
          direitos de terceiros nem a legislação vigente.
        </p>

        <h2 style={h2}>5. Uso aceitável</h2>
        <p style={p}>
          É proibido utilizar o Fotura para armazenar, transmitir ou compartilhar conteúdo ilegal,
          ofensivo, difamatório, pornográfico envolvendo menores, ou que viole direitos de terceiros.
          O Fotura reserva-se o direito de suspender ou encerrar contas que violem esta cláusula.
        </p>

        <h2 style={h2}>6. Disponibilidade e limitações</h2>
        <p style={p}>
          O Fotura se esforça para manter o serviço disponível, mas não garante disponibilidade
          ininterrupta. Manutenções programadas, atualizações ou problemas técnicos podem causar
          interrupções temporárias. Não nos responsabilizamos por perdas decorrentes de
          indisponibilidade.
        </p>

        <h2 style={h2}>7. Armazenamento</h2>
        <p style={p}>
          O espaço de armazenamento pode ser limitado conforme o plano contratado. Galerias e
          fotos podem ser removidas pelo fotógrafo a qualquer momento. Em caso de encerramento
          da conta, os dados serão excluídos após o período previsto na Política de Privacidade.
        </p>

        <h2 style={h2}>8. Planos e pagamento</h2>
        <p style={p}>
          O Fotura pode oferecer planos gratuitos e pagos. Os valores, recursos e limites de cada
          plano serão apresentados na plataforma. Alterações nos planos serão comunicadas com
          antecedência razoável.
        </p>

        <h2 style={h2}>9. Rescisão</h2>
        <p style={p}>
          Você pode encerrar sua conta a qualquer momento. O Fotura também pode encerrar ou
          suspender sua conta em caso de violação destes Termos, com aviso prévio quando possível.
        </p>

        <h2 style={h2}>10. Alterações nos termos</h2>
        <p style={p}>
          Podemos atualizar estes Termos periodicamente. Mudanças significativas serão comunicadas
          por e-mail ou aviso na plataforma. O uso continuado do serviço após as alterações
          constitui aceitação dos novos termos.
        </p>

        <h2 style={h2}>11. Legislação aplicável</h2>
        <p style={p}>
          Estes Termos são regidos pela legislação da República Federativa do Brasil. Eventuais
          disputas serão submetidas ao foro da comarca do domicílio do usuário.
        </p>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/privacidade" style={{ fontSize: 13, color: "#4a6cf7", textDecoration: "underline" }}>
            Política de Privacidade
          </Link>
          <span style={{ margin: "0 12px", color: "#3a3d50" }}>•</span>
          <Link href="/login" style={{ fontSize: 13, color: "#4a6cf7", textDecoration: "underline" }}>
            Voltar ao login
          </Link>
        </div>
      </div>
    </div>
  );
}