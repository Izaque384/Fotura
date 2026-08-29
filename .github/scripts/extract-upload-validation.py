from pathlib import Path

p = Path('app/app/upload/page.tsx')
s = p.read_text()

old_import = 'import * as tus from "tus-js-client";\n'
new_import = 'import * as tus from "tus-js-client";\nimport { ACCEPT_FOTOS, MAX_ARQUIVOS_POR_LOTE, validarArquivo } from "../../lib/upload-validation";\n'
if old_import not in s:
    raise SystemExit('tus import anchor not found')
s = s.replace(old_import, new_import, 1)

old_block = '''const MAX_ARQUIVOS_POR_LOTE = 500;
const MAX_TAMANHO_ARQUIVO = 50 * 1024 * 1024;
const MIME_POR_EXTENSAO: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
const ACCEPT_FOTOS = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";

function validarArquivo(arquivo:File):string|null{const nome=arquivo.name.trim();if(!nome)return "arquivo sem nome";if(nome.length>180)return "nome do arquivo muito longo";if(/[\\/\\\\\\u0000-\\u001f\\u007f]/.test(nome))return "nome do arquivo inválido";const ponto=nome.lastIndexOf(".");if(ponto<=0||ponto===nome.length-1)return "extensão ausente ou inválida";const extensao=nome.slice(ponto+1).toLowerCase(),mimeEsperado=MIME_POR_EXTENSAO[extensao];if(!mimeEsperado)return "formato não aceito (use JPG, PNG ou WebP)";if(arquivo.type.toLowerCase()!==mimeEsperado)return "tipo do arquivo não corresponde à extensão";if(arquivo.size===0)return "arquivo vazio";if(arquivo.size>MAX_TAMANHO_ARQUIVO)return "arquivo maior que 50 MB";return null}

'''
if old_block not in s:
    raise SystemExit('validation block not found')
s = s.replace(old_block, '', 1)

p.write_text(s)
