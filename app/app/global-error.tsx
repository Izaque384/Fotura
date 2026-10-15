"use client";

export default function GlobalError({reset}:{error:Error&{digest?:string};reset:()=>void}){
  return <html lang="pt-BR"><body>
    <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:24,background:"linear-gradient(180deg,#F0EDF7,#ECE8F4)",fontFamily:"Arial,Helvetica,sans-serif",color:"#21253A"}}>
      <section style={{width:"min(520px,100%)",boxSizing:"border-box",padding:36,border:"1px solid #D7D0E7",borderRadius:16,background:"#FAF8FD",textAlign:"center"}}>
        <div style={{fontSize:18,fontWeight:800,letterSpacing:4,marginBottom:24}}>FOTURA</div>
        <h1 style={{fontSize:28,lineHeight:1.15,margin:"0 0 10px"}}>Não foi possível carregar o Fotura.</h1>
        <p style={{margin:"0 auto",maxWidth:420,color:"#7A7F9A",fontSize:14,lineHeight:1.6}}>Tente recarregar esta tela. Seus arquivos e dados já salvos permanecem na sua conta.</p>
        <button type="button" onClick={reset} style={{marginTop:22,minHeight:42,border:0,borderRadius:10,padding:"0 16px",background:"linear-gradient(90deg,#1196FC,#5D0DFA)",color:"#fff",fontSize:12,fontWeight:700,cursor:"pointer"}}>Tentar novamente</button>
      </section>
    </main>
  </body></html>;
}
