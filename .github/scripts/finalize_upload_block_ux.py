from pathlib import Path
p=Path('app/app/upload/page.tsx')
s=p.read_text()
s=s.replace('setArquivos(validos);setArquivosRejeitados(rejeitados);setMensagem("");setErro(false)}','setArquivos(validos);setArquivosRejeitados(rejeitados);setLink("");setMensagem("");setErro(false)}',1)
s=s.replace('{nomeTravado?"Enviar mais fotos":"Nova galeria"}','{galeriaDestinoId?"Enviar mais fotos":"Nova galeria"}',1)
s=s.replace('{nomeTravado?tituloTravado:"Dê um nome, vincule o cliente e escolha as fotos"}','{galeriaDestinoId?tituloTravado:"Dê um nome, vincule o cliente e escolha as fotos"}',1)
p.write_text(s)
