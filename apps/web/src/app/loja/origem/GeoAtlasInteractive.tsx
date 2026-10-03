"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type Layer = "localizar" | "latitude" | "clima" | "relevo" | "solo" | "cultivo" | "pesquisa";
type Detail = "basalto"|"terra"|"argilas"|"raizes"|"nutricao"|"manejo"|"agua"|"sanidade"|"colheita"|null;
type Season = "verao" | "outono" | "inverno" | "primavera";
type Arrival = "pending" | "world" | "brazil" | "parana" | "north" | "video" | "done";
type LiveWeather = {
 location:string; observedAt:string|null; temperature:number; apparentTemperature:number|null;
 humidity:number|null; precipitation:number; rain:number; cloudCover:number|null; windSpeed:number|null;
 weatherCode:number; condition:string; isDay:number|null; sunrise:string|null; sunset:string|null; source:string;
};

const paranaClock = new Intl.DateTimeFormat("pt-BR", {
 timeZone:"America/Sao_Paulo", hour:"2-digit", minute:"2-digit", hourCycle:"h23"
});
const paranaParts = new Intl.DateTimeFormat("pt-BR", {
 timeZone:"America/Sao_Paulo", hour:"2-digit", minute:"2-digit", day:"2-digit", month:"2-digit", hourCycle:"h23"
});
function getParanaDate(date:Date){
 const parts=paranaParts.formatToParts(date);
 const get=(type:Intl.DateTimeFormatPartTypes)=>Number(parts.find(part=>part.type===type)?.value ?? 0);
 return {hour:get("hour"),minute:get("minute"),day:get("day"),month:get("month")};
}
function getSouthernSeason(month:number,day:number):Season{
 const value=month*100+day;
 if(value>=1221||value<320)return "verao";
 if(value<620)return "outono";
 if(value<922)return "inverno";
 return "primavera";
}
const layers: Array<{id:Layer; label:string; title:string; copy:string}> = [
{id:"localizar",label:"LOCALIZAR",title:"Do mundo ao Norte do Paraná",copy:"O mapa aproxima mundo, Brasil e Paraná sem perder a linha que organiza a história: o Trópico de Capricórnio."},
{id:"latitude",label:"LATITUDE",title:"23°26′ S · Trópico de Capricórnio",copy:"Latitude situa norte e sul; longitude, leste e oeste. A posição ajuda a descrever o ambiente, mas não determina sozinha a qualidade ou o sabor."},
{id:"clima",label:"CLIMA",title:"Dia · noite · amplitude térmica",copy:"A diferença entre máxima e mínima participa das condições vividas pela planta. Água, manejo, relevo e estágio de maturação precisam ser lidos junto."},
{id:"relevo",label:"RELEVO",title:"Altitude · face de exposição · luz",copy:"Altitude não trabalha sozinha. Inclinação e orientação da encosta mudam exposição solar, vento e microambiente da lavoura."},
{id:"solo",label:"SOLO",title:"Basalto → terra roxa → argilas → raízes",copy:"Textura, estrutura e tipologia da argila interferem na dinâmica de água, aeração e raízes. A cor do solo, isoladamente, não prevê a xícara."},
{id:"cultivo",label:"CULTIVO",title:"O lugar não trabalha sozinho",copy:"Nutrição, água, sanidade, manejo, colheita e cuidado com o solo influenciam o desenvolvimento da planta e o potencial do fruto."},
{id:"pesquisa",label:"PESQUISA",title:"Do Havaí ao Paraná: perguntas sobre a argila",copy:"O Havaí, próximo ao limite norte do cinturão cafeeiro, entra como referência externa para estudos de solo e tipologia da argila. No Paraná, usamos essas pesquisas para formular perguntas — nunca para transferir automaticamente conclusões entre territórios."},
];
export default function GeoAtlasInteractive(){
 const [active,setActive]=useState<Layer>("localizar"); const [detail,setDetail]=useState<Detail>(null); const [started,setStarted]=useState(false); const [focus,setFocus]=useState<"world"|"brazil"|"parana">("world"); const [city,setCity]=useState<string|null>(null); const [hour,setHour]=useState(12); const [season,setSeason]=useState<Season>("primavera"); const [clock,setClock]=useState<Date|null>(null); const [arrival,setArrival]=useState<Arrival>("pending"); const [weather,setWeather]=useState<LiveWeather|null>(null); const [weatherUnavailable,setWeatherUnavailable]=useState(false); const [videoNeedsPlay,setVideoNeedsPlay]=useState(true); const [videoSrc,setVideoSrc]=useState("/brand/story/origem-arrival/campo-desktop.mp4"); const videoRef=useRef<HTMLVideoElement|null>(null);
 useEffect(()=>{
  const current=new Date(); const local=getParanaDate(current); const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches; const saveData=Boolean((navigator as Navigator & {connection?:{saveData?:boolean}}).connection?.saveData);
  const syncClock=()=>{const now=new Date();const parts=getParanaDate(now);setClock(now);setSeason(getSouthernSeason(parts.month,parts.day))};
  setClock(current); setHour(local.hour); setSeason(getSouthernSeason(local.month,local.day));
  if(window.matchMedia("(max-width: 760px) and (orientation: portrait)").matches)setVideoSrc("/brand/story/origem-arrival/campo-mobile.mp4");
  if(reduced||saveData){setStarted(true);setFocus("parana");setArrival("done")} else setArrival("world");
  const tick=window.setInterval(syncClock,30000);
  return()=>window.clearInterval(tick);
 },[]);
 useEffect(()=>{
  let activeRequest=true;
  const loadWeather=async()=>{try{const response=await fetch("/api/storefront/weather/norte-parana",{cache:"no-store"});if(!response.ok)throw new Error("weather");const data=await response.json() as LiveWeather;if(activeRequest){setWeather(data);setWeatherUnavailable(false)}}catch{if(activeRequest)setWeatherUnavailable(true)}};
  void loadWeather(); const refresh=window.setInterval(()=>void loadWeather(),600000);
  return()=>{activeRequest=false;window.clearInterval(refresh)};
 },[]);
 useEffect(()=>{
  if(arrival==="world"){setStarted(true);setFocus("world")}
  if(arrival==="brazil")setFocus("brazil");
  if(arrival==="parana"||arrival==="north"||arrival==="done")setFocus("parana");
  const next:Partial<Record<Arrival,Arrival>>={world:"brazil",brazil:"parana",parana:"north",north:"video"};
  const delay:Partial<Record<Arrival,number>>={world:1500,brazil:1500,parana:1500,north:1800};
  if(!next[arrival])return;
  const timer=window.setTimeout(()=>setArrival(next[arrival]!),delay[arrival]);
  return()=>window.clearTimeout(timer);
 },[arrival]);
 const PR={west:-54.619253929,east:-48.02377828,north:-22.51669133,south:-26.725213854};
 const project=(lat:number,lon:number)=>({left:((lon-PR.west)/(PR.east-PR.west)*100).toFixed(2)+"%",top:((PR.north-lat)/(PR.north-PR.south)*100).toFixed(2)+"%"});
 const cities=[
  ["Londrina",-23.3045,-51.1696],["Maringá",-23.4205,-51.9333],["Mandaguari",-23.5225,-51.6788],["Apucarana",-23.5525,-51.4611],
  ["São Jerônimo da Serra",-23.6871,-50.7899],["Cornélio Procópio",-23.1811,-50.6467],["Congonhinhas",-23.5511,-50.5536],["Pinhalão",-23.7982,-50.0536]
 ] as const;
 const regions=[
  ["Noroeste",25,22,false],["Norte Central",42,18,true],["Norte Pioneiro",66,18,true],["Centro-Ocidental",31,45,false],["Centro-Oriental",61,47,false],
  ["Oeste",16,58,false],["Centro-Sul",48,64,false],["Sudoeste",29,78,false],["Sudeste",60,72,false],["Metropolitana",78,67,false]
 ] as const;
 const item=layers.find(x=>x.id===active)!;
 const localNow=clock?getParanaDate(clock):{hour:12,minute:0,day:1,month:10}; const actualHour=localNow.hour+localNow.minute/60; const isNight=weather?.isDay===0||(weather?.isDay==null&&(actualHour<5||actualHour>=19)); const isEvening=actualHour>=16.5&&actualHour<19; const daylight=Math.max(0,Math.sin(((hour-6)/12)*Math.PI)); const night=1-daylight; const lunarAge=(((clock?.getTime()??Date.now())-Date.UTC(2000,0,6,18,14))/(86400000))%29.530588; const moon=Math.round((1-Math.cos(2*Math.PI*lunarAge/29.530588))*50); const seasonLabel={verao:"verão",outono:"outono",inverno:"inverno",primavera:"primavera"}[getSouthernSeason(localNow.month,localNow.day)]; const mapArrival=arrival==="pending"||arrival==="world"||arrival==="brazil"||arrival==="parana"||arrival==="north"; const arrivalStory={pending:["A GEOGRAFIA NA XÍCARA","Lendo o território…","Aproximando escala, latitude e tempo."],world:["MUNDO · 23°26′ S","O mundo cabe em uma linha.","O Trópico de Capricórnio é o primeiro fio desta história."],brazil:["BRASIL · CINTURÃO DO CAFÉ","Um país. Muitos territórios.","A mesma latitude atravessa paisagens, climas e culturas diferentes."],parana:["PARANÁ · SUL DO BRASIL","O mapa começa a ganhar relevo.","A escala muda. Solo, luz, água e manejo entram em relação."],north:["NORTE DO PARANÁ","Chegamos ao lugar.","Aqui, o Trópico cruza lavouras e histórias construídas no tempo."],video:["DO MAPA AO CAMPO","Agora, o território respira.","Cenas reais transformam coordenadas em presença."],done:["","",""]}[arrival]; const journeySteps=["world","brazil","parana","north"] as const; const activeJourney=arrival==="video"?3:Math.max(0,journeySteps.indexOf(arrival as typeof journeySteps[number])); const timeOnly=(value:string|null)=>value?.split("T")[1]?.slice(0,5)??"--:--";
 const moveArrival=(event:PointerEvent<HTMLDivElement>)=>{const rect=event.currentTarget.getBoundingClientRect();const x=((event.clientX-rect.left)/rect.width-.5)*14;const y=((event.clientY-rect.top)/rect.height-.5)*10;event.currentTarget.style.setProperty("--arrival-x",`${x}px`);event.currentTarget.style.setProperty("--arrival-y",`${y}px`);event.currentTarget.style.setProperty("--arrival-rx",`${-y*.045}deg`);event.currentTarget.style.setProperty("--arrival-ry",`${x*.045}deg`)};
 const resetArrival=(event:PointerEvent<HTMLDivElement>)=>{event.currentTarget.style.setProperty("--arrival-x","0px");event.currentTarget.style.setProperty("--arrival-y","0px");event.currentTarget.style.setProperty("--arrival-rx","0deg");event.currentTarget.style.setProperty("--arrival-ry","0deg")};
 return <section className={styles.geoExperience} aria-label="Mapa interativo da geografia na xícara">
  {arrival!=="done"&&<div className={`${styles.arrival} ${isNight?styles.arrivalNight:""} ${styles[`arrival_${arrival}`]}`} onPointerMove={moveArrival} onPointerLeave={resetArrival} style={{"--arrival-progress":`${activeJourney*33.333}%`} as CSSProperties}>
   {mapArrival&&<div className={styles.arrivalCartography} aria-hidden="true">
    <Image className={styles.arrivalMapWorld} src="/brand/story/mapa-mundi-parana.svg" alt="" fill sizes="100vw" unoptimized/>
    <Image className={styles.arrivalMapBrazil} src="/brand/story/brasil-parana.svg" alt="" fill sizes="100vw" unoptimized/>
    <Image className={styles.arrivalMapParana} src="/brand/story/parana-nortes.svg" alt="" fill sizes="100vw" unoptimized/>
    <span className={styles.arrivalMapPin}/><div className={styles.arrivalLens}><i/><span>{arrival==="world"?"PLANETA":arrival==="brazil"?"PAÍS":arrival==="parana"?"ESTADO":"TERRITÓRIO"}</span></div>
   </div>}
   {arrival==="video"&&<video
    ref={videoRef}
    className={styles.arrivalVideo}
    src={videoSrc}
    autoPlay
    muted
    playsInline
    preload="auto"
    poster={isEvening?"/brand/story/origem-arrival/campo-entardecer.jpg":"/brand/story/origem-arrival/campo-dia.jpg"}
    onCanPlay={event=>void event.currentTarget.play().catch(()=>setVideoNeedsPlay(true))}
    onPlay={()=>setVideoNeedsPlay(false)}
    onPause={event=>{if(!event.currentTarget.ended)setVideoNeedsPlay(true)}}
    onEnded={()=>setArrival("done")}
    onError={()=>setVideoNeedsPlay(true)}
   />}
   {arrival==="video"&&videoNeedsPlay&&<button type="button" className={styles.arrivalPlay} onClick={()=>void videoRef.current?.play()}>Assistir ao território <span>▶</span></button>}
   {isNight&&<div className={styles.arrivalSky} aria-hidden="true"><i/><i/><i/><span style={{"--moon":moon} as CSSProperties}/></div>}
   <div className={styles.arrivalTropic} aria-hidden="true"><i/><span>23°26′ S · TRÓPICO DE CAPRICÓRNIO</span></div>
   <div className={styles.arrivalShade}/>
   <div className={styles.arrivalTop}><span>BISPO · GEOGRAFIA NA XÍCARA</span><span>{clock?paranaClock.format(clock):"--:--"} · {seasonLabel}{weather?` · ${Math.round(weather.temperature)}° · ${weather.condition}`:""}</span></div>
   <div className={styles.arrivalCopy} key={arrival}>
    <p>{arrivalStory[0]}</p>
    <h2>{arrivalStory[1]}</h2>
    <span>{arrivalStory[2]}</span>
   </div>
   <nav className={styles.arrivalJourney} aria-label="Escalas da aproximação">{journeySteps.map((step,index)=><button type="button" key={step} className={activeJourney===index?styles.arrivalJourneyActive:""} aria-current={activeJourney===index?"step":undefined} onClick={()=>setArrival(step)}><small>0{index+1}</small>{["MUNDO","BRASIL","PARANÁ","NORTE"][index]}</button>)}</nav>
   <button type="button" className={styles.arrivalEnter} onClick={()=>setArrival("done")}>Ir ao território <span>→</span></button>
   <small className={styles.arrivalNote}>{arrival==="video"?"Imagens editoriais":"Aproximação cartográfica"} · horário local real</small>
  </div>}
  {arrival==="done"&&<div className={styles.geoAtlasBody}>
  <div className={`${styles.geoStage} ${focus==="brazil"?styles.geoStageBrazil:""} ${focus==="parana"?styles.geoStageParana:""}`} style={{"--daylight":daylight,"--night":night} as CSSProperties}>{night>.55&&<div className={styles.moon} style={{"--moon":moon} as CSSProperties}><i/><span>Lua · {moon}% iluminada</span></div>}
   <aside className={styles.liveTerritory} aria-live="polite">
    <div className={styles.liveTerritoryHeading}><span>AGORA NO NORTE DO PARANÁ</span><strong>{clock?paranaClock.format(clock):"--:--"} · {seasonLabel}</strong></div>
    {weather?<><div className={styles.liveTerritoryWeather}><strong>{Math.round(weather.temperature)}°</strong><div><b>{weather.condition}</b><span>Sensação {weather.apparentTemperature==null?"—":`${Math.round(weather.apparentTemperature)}°`} · umidade {weather.humidity==null?"—":`${Math.round(weather.humidity)}%`}</span></div></div><div className={styles.liveTerritoryFacts}><span>Chuva agora <b>{weather.precipitation.toFixed(1)} mm</b></span><span>Vento <b>{weather.windSpeed==null?"—":`${Math.round(weather.windSpeed)} km/h`}</b></span><span>Sol <b>{timeOnly(weather.sunrise)}–{timeOnly(weather.sunset)}</b></span></div><small>{weather.location} · dados {weather.source} · atualização {timeOnly(weather.observedAt)}</small></>:<div className={styles.liveTerritoryLoading}>{weatherUnavailable?"Condições meteorológicas indisponíveis agora. Horário e estação seguem ativos.":"Lendo temperatura, chuva e céu da região…"}</div>}
    <button type="button" onClick={()=>{setVideoNeedsPlay(true);setArrival("world")}}>Rever a chegada <span>↻</span></button>
   </aside>
   <button type="button" className={`${started ? styles.geoWorldLive : styles.geoWorld} ${styles.geoWorldButton}`} onClick={()=>setFocus(focus==="world"?"brazil":"world")} aria-label={focus==="world"?"Aproximar o Brasil":"Voltar ao mundo"}>
    <Image src="/brand/story/mapa-mundi-parana.svg" alt="Mapa-múndi com o Trópico de Capricórnio e a localização do Paraná" fill sizes="(max-width:900px) 100vw, 58vw" unoptimized/>
    <i className={styles.tropicLine}/><b className={styles.tropicLabel}>23°26′ S · TRÓPICO DE CAPRICÓRNIO</b>
   <span className={styles.worldCue}>{focus==="world"?"entrar no Brasil +":"← mundo"}</span></button>
   <button type="button" className={styles.geoParana} onClick={()=>setFocus(focus==="parana"?"brazil":"parana")} aria-label={focus==="parana"?"Voltar ao Brasil":"Aproximar o Paraná"}><Image src="/brand/story/parana-nortes.svg" alt="Paraná com Norte Central, Norte Pioneiro e cidades de referência" fill sizes="(max-width:900px) 100vw, 42vw" unoptimized/><span>{focus==="parana"?"← voltar ao Brasil":"aproximar o Paraná +"}</span></button>
   {focus==="parana"&&<div className={`${styles.realTerrain} ${active==="solo"||active==="pesquisa"?styles.realTerrainGeology:""} ${active==="relevo"?styles.realTerrainRelief:""}`} aria-hidden="true"><div className={styles.terrainReliefBase}/><div className={styles.terrainGeologyBase}/><div className={styles.terrainShade}/><div className={styles.terrainNorth}><span>NORTE CENTRAL</span><span>NORTE PIONEIRO</span></div><small>Base cartográfica: IAT · MINEROPAR/ITCG · relevo e geologia do Paraná</small></div>}
   {focus==="parana"&&<div className={styles.terrainOverlay} aria-label="Regiões e municípios do Paraná"><div className={styles.terrainHorizon}/><div className={styles.terrainTropic} style={{top:project(-23.4333,-51).top}}>23°26′ S · TRÓPICO DE CAPRICÓRNIO</div><div className={styles.regionLabels}>{regions.map(([name,x,y,focusRegion])=><span key={name} className={focusRegion?styles.regionFocus:""} style={{left:x+"%",top:y+"%"}}>{name}</span>)}</div>{cities.map(([name,lat,lon])=><button key={name} type="button" className={styles.cityPin} style={project(lat,lon)} onClick={e=>{e.stopPropagation();setCity(city===name?null:name)}} aria-expanded={city===name}><i/><b>{name}</b>{city===name&&<span><strong>{name}</strong><small>{lat.toFixed(4)}° · {lon.toFixed(4)}°</small></span>}</button>)}</div>}

  </div>
  <nav className={styles.geoLayers} aria-label="Camadas do território">{layers.map((x)=><button key={x.id} type="button" aria-pressed={active===x.id} onClick={()=>{setActive(x.id);setDetail(null)}}><span className={`${styles.geoGlyph} ${styles["geoGlyph_"+x.id]}`} aria-hidden="true"><i/><i/><i/><em/></span><b>{x.label}</b></button>)}</nav>
  <div className={styles.geoReveal} key={active}><small>{item.label} · BISPO LÊ O TERRITÓRIO</small><h3>{item.title}</h3><p>{item.copy}</p>
   {active==="clima"&&<><div className={styles.climateControls}><label><span>{String(hour).padStart(2,"0")}:00 · deslize o dia</span><input aria-label="Horário do dia" type="range" min="0" max="23" value={hour} onChange={e=>setHour(Number(e.target.value))}/></label><div>{(["verao","outono","inverno","primavera"] as const).map(s=><button type="button" key={s} aria-pressed={season===s} onClick={()=>setSeason(s)}>{s}</button>)}</div></div><div className={styles.dayNight}><span>☀ DIA</span><i/><strong>AMPLITUDE TÉRMICA</strong><i/><span>NOITE ☾</span></div><p className={styles.climateWhisper}>{season==="inverno"&&hour>=5&&hour<=8?"Manhã fria: em condições favoráveis, o orvalho pode aparecer sobre folhas e solo.":hour>=18||hour<=5?"A luz cai e a temperatura tende a recuar. A noite faz parte do ambiente térmico vivido pela planta.":"A luz e a temperatura mudam ao longo do dia. O efeito real depende também de água, relevo, manejo e estágio da planta."}</p></>}
   {active==="solo"&&<div className={styles.soilCut}>{[["basalto","BASALTO"],["terra","TERRA ROXA"],["argilas","ARGILAS"],["raizes","ÁGUA + RAÍZES"]].map(([id,label])=><button type="button" key={id} className={styles["soil_"+id]} onClick={()=>setDetail(id as Detail)}><span className={styles.soilGlyph} aria-hidden="true"><i/><i/><i/><em/></span><b>{label}</b><small>explorar +</small></button>)}</div>}
   {active==="cultivo"&&<div className={styles.careTrail}>{[["nutricao","NUTRIÇÃO"],["manejo","MANEJO"],["agua","ÁGUA"],["sanidade","SANIDADE"],["colheita","COLHEITA"]].map(([id,label])=><button type="button" key={id} className={styles["care_"+id]} onClick={()=>setDetail(id as Detail)}><span className={styles.careGlyph} aria-hidden="true"><i/><i/><i/><em/></span><b>{label}</b><small>ver por dentro +</small></button>)}</div>}
  {detail&&<div className={styles.detailStory}><button type="button" onClick={()=>setDetail(null)}>×</button><div className={`${styles.detailDrawing} ${styles["detail_"+detail]}`} aria-hidden="true">
 {detail==="basalto"&&<><i/><i/><i/><b/><b/></>}
 {detail==="terra"&&<><i/><i/><i/><b/><b/><em/></>}
 {detail==="argilas"&&<><i/><i/><i/><b/><b/><b/><em/></>}
 {detail==="raizes"&&<><i/><i/><i/><b/><b/><em/></>}
 {detail==="nutricao"&&<><i/><i/><i/><b/><b/><em/></>}
 {detail==="manejo"&&<><i/><i/><i/><b/><b/><em/></>}
 {detail==="agua"&&<><i/><i/><i/><b/><b/><b/><em/></>}
 {detail==="sanidade"&&<><i/><i/><i/><b/><b/><em/></>}
 {detail==="colheita"&&<><i/><i/><i/><b/><b/><b/><em/></>}
 </div><small>CAMADA VIVA · {detail.toUpperCase()}</small><h4>{detail==="basalto"?"Da rocha ao solo":detail==="terra"?"Terra Roxa: uma história geológica":detail==="argilas"?"Argila não é uma coisa só":detail==="raizes"?"Água, poros e raízes":detail==="nutricao"?"Nutrir é acompanhar a planta":detail==="manejo"?"Manejo é decisão no tempo certo":detail==="agua"?"A água atravessa todo o sistema":detail==="sanidade"?"Observar antes de corrigir":"Colher é também escolher o momento"}</h4><p>{detail==="terra"?"Solos vermelhos do Norte do Paraná se desenvolveram sobre materiais derivados de rochas basálticas. A cor é parte da história do ferro no solo; textura, estrutura, água e manejo precisam ser lidos junto.":detail==="argilas"?"Diferentes minerais e proporções de argila mudam propriedades físicas e químicas do solo. A pesquisa ajuda a compreender relações; não transforma um tipo de argila em uma promessa de sabor.":detail==="agua"?"Chuva, infiltração, armazenamento no solo e uso pela planta formam uma sequência. Aqui a animação acompanha a água da superfície às raízes.":detail==="colheita"?"Maturação, seleção e momento de colheita preservam ou limitam o potencial construído no campo.":detail==="nutricao"?"Nutrição equilibrada participa do desenvolvimento da planta e do fruto; diagnóstico e manejo importam mais que uma receita única.":detail==="sanidade"?"Folhas, frutos e ambiente são observados continuamente. Sanidade faz parte do cuidado que permite à planta desenvolver seu potencial.":detail==="manejo"?"Poda, cobertura, solo, água e decisões de campo mudam ao longo do ciclo. Manejo é leitura, não automatismo.":detail==="raizes"?"Estrutura e porosidade condicionam o caminho da água, do ar e das raízes. É uma relação física que acontece abaixo do que vemos.":"O basalto faz parte da base geológica que ajuda a contar a formação de muitos solos do Norte do Paraná. A rocha não vira uma nota sensorial: ela é uma camada da história do território."}</p></div>}
  </div>
  <p className={styles.geoConclusion}><strong>Uma origem. Muitas relações.</strong> Não há uma única variável que explique a xícara.</p>
  </div>}
 </section>
}
