"use client";

import { useEffect, useState } from "react";
import { useMemo } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type Layer = "localizar" | "latitude" | "clima" | "relevo" | "solo" | "cultivo" | "pesquisa";
type Detail = "basalto"|"terra"|"argilas"|"raizes"|"nutricao"|"manejo"|"agua"|"sanidade"|"colheita"|null;
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
 const now=useMemo(()=>new Date(),[]); const initialHour=now.getHours(); const [active,setActive]=useState<Layer>("localizar"); const [detail,setDetail]=useState<Detail>(null); const [started,setStarted]=useState(false); const [focus,setFocus]=useState<"world"|"brazil"|"parana">("world"); const [city,setCity]=useState<string|null>(null); const [hour,setHour]=useState(initialHour); const [season,setSeason]=useState<"verao"|"outono"|"inverno"|"primavera">(()=>{const m=now.getMonth()+1;return m>=9&&m<=11?"primavera":m===12||m<=2?"verao":m<=5?"outono":"inverno"});
 useEffect(()=>{const t=window.setTimeout(()=>setStarted(true),250);const a=window.setTimeout(()=>setFocus("brazil"),1200);const b=window.setTimeout(()=>setFocus("parana"),2600);return()=>{window.clearTimeout(t);window.clearTimeout(a);window.clearTimeout(b)}},[]);
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
 const daylight=Math.max(0,Math.sin(((hour-6)/12)*Math.PI)); const night=1-daylight; const lunarAge=((now.getTime()-Date.UTC(2000,0,6,18,14))/(86400000))%29.530588; const moon=Math.round((1-Math.cos(2*Math.PI*lunarAge/29.530588))*50);
 return <section className={styles.geoExperience} aria-label="Mapa interativo da geografia na xícara">
  <div className={`${styles.geoStage} ${focus==="brazil"?styles.geoStageBrazil:""} ${focus==="parana"?styles.geoStageParana:""}`} style={{"--daylight":daylight,"--night":night} as CSSProperties}>{night>.55&&<div className={styles.moon} style={{"--moon":moon} as CSSProperties}><i/><span>Lua · {moon}% iluminada</span></div>}
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
 </section>
}