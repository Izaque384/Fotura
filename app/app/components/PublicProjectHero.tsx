type PublicProjectHeroProps={
  color:string;
  imageUrl:string|null;
  studioName:string|null;
  title:string;
  description:string|null;
};

export default function PublicProjectHero({color,imageUrl,studioName,title,description}:PublicProjectHeroProps){
  return <header className="pph-hero" style={{backgroundColor:color}}>
    <style>{css}</style>
    {imageUrl&&<div className="pph-bg" style={{backgroundImage:`url("${imageUrl}")`}}/>}
    <div className="pph-wrap">
      <div className="pph-info">
        <div>{studioName||"PROJETO"}</div>
        <h1>{title}</h1>
        {description&&<p>{description}</p>}
      </div>
    </div>
  </header>;
}

const css=`
.pph-hero{position:relative;overflow:hidden;background:#F0EDF7}
.pph-bg{position:absolute;inset:0;background-size:cover;background-position:center center;background-repeat:no-repeat;transform:none}
.pph-bg:after{content:"";position:absolute;inset:0;background:rgba(7,7,16,.58)}
.pph-wrap{position:relative;max-width:1120px;min-height:34vh;box-sizing:border-box;margin:auto;padding:44px 32px;display:flex;align-items:center}
.pph-info{flex:1;color:#fff}
.pph-info>div{opacity:.72}
.pph-info h1{margin:12px 0;font-size:clamp(30px,5vw,58px);font-weight:500;letter-spacing:-.035em}
.pph-info p{max-width:620px;margin:0;font-size:12px;line-height:1.55;opacity:.82}
@media(max-width:720px){
  .pph-wrap{min-height:34vh;padding:44px 20px;text-align:center}
  .pph-info h1{font-size:clamp(30px,9vw,46px)}
  .pph-info p{margin-inline:auto}
}
`;
