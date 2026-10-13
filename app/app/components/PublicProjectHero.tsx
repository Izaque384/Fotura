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
.pph-bg:after{content:"";position:absolute;inset:0;background:rgba(7,7,16,.5)}
.pph-wrap{position:relative;min-height:clamp(520px,64vh,760px);box-sizing:border-box;margin:auto;padding:72px clamp(32px,6vw,96px);display:flex;align-items:center;justify-content:center;text-align:center}
.pph-info{width:min(1120px,100%);color:#fff}
.pph-info>div{font-size:clamp(18px,1.35vw,24px);font-weight:500;opacity:.78}
.pph-info h1{max-width:1180px;margin:24px auto 28px;font-size:clamp(54px,5vw,82px);line-height:1.04;font-weight:500;letter-spacing:-.045em}
.pph-info p{max-width:900px;margin:0 auto;font-size:clamp(14px,.95vw,17px);line-height:1.55;opacity:.88}
@media(max-width:720px){
  .pph-wrap{min-height:34vh;padding:44px 20px;text-align:center}
  .pph-info>div{font-size:clamp(18px,4.2vw,24px)}
  .pph-info h1{margin:16px auto 20px;font-size:clamp(30px,9vw,46px);line-height:1.08}
  .pph-info p{max-width:560px;margin-inline:auto;font-size:clamp(13px,3.2vw,16px);line-height:1.55}
}
`;
