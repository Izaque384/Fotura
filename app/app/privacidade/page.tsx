"use client";

import Link from "next/link";

export default function PrivacidadePage() {
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

        <h1 style={h1}>Política de Privacidade</h1>
        <p style={{ ...p, color: "#7a7f9a" }}>Última atualização: {dataAtual}</p>

        <p style={p}>
          Esta Política de Privacidade descreve como o Fotura coleta, utiliza, armazena e protege
          os dados pessoais dos usuários, em conformidade com a Lei Geral de Proteção de Dados
          Pessoais (Lei nº 13.709/2018 — LGPD).
        </p>

        <h2 style={h2}>1. Dados coletados</h2>

        <p style={{ ...p, fontWeight: 600, color: "#e0e0ea" }}>Fotógrafos (titulares da conta):</p>
        <p style={p}>
          E-mail e senha (para autenticação); nome do estúdio e logotipo (opcionais, para
          personalização); fotos enviadas às galerias; configurações de galerias (títulos, prazos,
          senhas); dados de uso da plataforma (acessos, ações realizadas).
        </p>

        <p style={{ ...p, fontWeight: 600, color: "#e0e0ea" }}>Clientes (visitantes das galerias):</p>
        <p style={p}>
          Comentários por foto; senha de acesso à galeria (quando
          configurada pelo fotógrafo). Não coletamos nome, e-mail ou qualquer dado de identificação
          dos clientes — o acesso se dá exclusivamente por link.
        </p>

        <h2 style={h2}>2. Finalidade do tratamento</h2>
        <p style={p}>
          Os dados são utilizados exclusivamente para: prestação e melhoria do serviço;
          autenticação e segurança da conta; geração de miniaturas e marca-d'água;
          notificações sobre atividade nas galerias (push e e-mail quando habilitado);
          comunicação sobre o serviço (atualizações, alertas de segurança).
        </p>

        <h2 style={h2}>3. Base legal</h2>
        <p style={p}>
          O tratamento de dados pessoais é realizado com base no consentimento do titular
          (Art. 7º, I da LGPD), manifestado pela aceitação destes termos no momento do cadastro,
          e na execução de contrato (Art. 7º, V), para a prestação do serviço contratado.
        </p>

        <h2 style={h2}>4. Compartilhamento de dados</h2>
        <p style={p}>
          Não vendemos, alugamos ou compartilhamos seus dados pessoais com terceiros para fins
          comerciais. Os dados podem ser compartilhados com: Supabase (infraestrutura de banco de
          dados e armazenamento); Vercel (hospedagem da aplicação). Esses provedores atuam como
          operadores de dados sob nossas instruções e políticas de segurança.
        </p>

        <h2 style={h2}>5. Armazenamento e segurança</h2>
        <p style={p}>
          As fotos são armazenadas em bucket privado com acesso controlado via links assinados
          temporários. Senhas de conta são criptografadas. A comunicação é protegida por HTTPS.
          Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados contra
          acesso não autorizado, perda ou destruição.
        </p>

        <h2 style={h2}>6. Retenção de dados</h2>
        <p style={p}>
          Os dados são mantidos enquanto sua conta estiver ativa. Após a exclusão da conta, os
          dados pessoais e fotos serão removidos em até 30 (trinta) dias, exceto quando houver
          obrigação legal de retenção.
        </p>

        <h2 style={h2}>7. Direitos do titular (LGPD)</h2>
        <p style={p}>
          Conforme a LGPD, você tem direito a: confirmação da existência de tratamento;
          acesso aos seus dados; correção de dados incompletos ou desatualizados; anonimização,
          bloqueio ou eliminação de dados desnecessários ou excessivos; portabilidade dos dados;
          eliminação dos dados tratados com consentimento; informação sobre compartilhamento;
          revogação do consentimento.
        </p>
        <p style={p}>
          Para exercer qualquer desses direitos, entre em contato pelo e-mail indicado na seção
          de contato abaixo.
        </p>

        <h2 style={h2}>8. Cookies</h2>
        <p style={p}>
          O Fotura utiliza apenas cookies essenciais para autenticação e funcionamento da sessão.
          Não utilizamos cookies de rastreamento, analytics de terceiros ou publicidade.
        </p>

        <h2 style={h2}>9. Alterações nesta política</h2>
        <p style={p}>
          Esta política pode ser atualizada periodicamente. Mudanças significativas serão
          comunicadas por e-mail ou aviso na plataforma. A data de atualização será sempre
          indicada no topo do documento.
        </p>

        <h2 style={h2}>10. Contato</h2>
        <p style={p}>
          Para dúvidas, solicitações ou exercício de direitos relacionados a dados pessoais,
          entre em contato pelo e-mail: <strong style={{ color: "#f0f0f5" }}>izaqueandrade384@gmail.com</strong>
        </p>

        <div style={{ marginTop: 32, textAlign: "center" }}>
          <Link href="/termos" style={{ fontSize: 13, color: "#4a6cf7", textDecoration: "underline" }}>
            Termos de Uso
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