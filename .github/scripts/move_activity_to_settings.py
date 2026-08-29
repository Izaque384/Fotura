from pathlib import Path

menu = Path('app/app/MenuFotografo.tsx')
s = menu.read_text()
s = s.replace('type T="painel"|"galerias"|"selecoes"|"clientes"|"atividade"|"config"|"sair"|"menu"|"fechar";', 'type T="painel"|"galerias"|"selecoes"|"clientes"|"config"|"sair"|"menu"|"fechar";')
atividade_icon = 'if(tipo==="atividade")return <svg {...common} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/><circle cx="4" cy="7" r="1.3"/><circle cx="10" cy="3" r="1.3"/><circle cx="16" cy="10" r="1.3"/></svg>;'
s = s.replace(atividade_icon, '')
s = s.replace(',{rota:"/dashboard/atividade",label:"Atividade",tipo:"atividade"}', '')
menu.write_text(s)

cfg = Path('app/app/configuracoes/page.tsx')
s = cfg.read_text()
old = '''          {mensagem && (\n            <p style={{ fontSize: 13, textAlign: "center", marginTop: 16, color: erro ? "#ef4444" : "#22c55e" }}>\n              {mensagem}\n            </p>\n          )}\n        </div>'''
new = '''          {mensagem && (\n            <p style={{ fontSize: 13, textAlign: "center", marginTop: 16, color: erro ? "#ef4444" : "#22c55e" }}>\n              {mensagem}\n            </p>\n          )}\n\n          <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid #2a2d40" }}>\n            <p style={{ fontSize: 14, fontWeight: 600, color: "#f0f0f5", margin: 0 }}>Segurança e atividade</p>\n            <p style={{ fontSize: 12, color: "#7a7f9a", lineHeight: 1.6, margin: "7px 0 14px" }}>\n              Consulte o histórico de ações importantes da sua conta, galerias, clientes e seleções.\n            </p>\n            <button\n              type="button"\n              onClick={() => router.push("/dashboard/atividade")}\n              style={{ width: "100%", padding: "11px 13px", fontSize: 13, fontWeight: 600, color: "#cfd5ea", background: "#111124", border: "1px solid #2a2d40", borderRadius: 10, cursor: "pointer" }}\n            >\n              Ver histórico de atividades\n            </button>\n          </div>\n        </div>'''
if old not in s:
    raise SystemExit('settings anchor not found')
s = s.replace(old, new, 1)
cfg.write_text(s)
