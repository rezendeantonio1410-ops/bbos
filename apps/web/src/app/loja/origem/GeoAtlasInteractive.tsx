"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import styles from "./page.module.css";

type Layer = "localizar" | "latitude" | "clima" | "relevo" | "solo" | "cultivo" | "pesquisa" | "xicara" | "torra";
const layers: Array<{id:Layer; label:string; title:string; copy:string}> = [
{id:"localizar",label:"LOCALIZAR",title:"Do mundo ao Norte do Paraná",copy:"O mapa aproxima mundo, Brasil e Paraná sem perder a linha que organiza a história: o Trópico de Capricórnio."},
{id:"latitude",label:"LATITUDE",title:"23°26′ S · Trópico de Capricórnio",copy:"Latitude situa norte e sul; longitude, leste e oeste. A posição ajuda a descrever o ambiente, mas não determina sozinha a qualidade ou o sabor."},
{id:"clima",label:"CLIMA",title:"Dia · noite · amplitude térmica",copy:"A diferença entre máxima e mínima participa das condições vividas pela planta. Água, manejo, relevo e estágio de maturação precisam ser lidos junto."},
{id:"relevo",label:"RELEVO",title:"Altitude · face de exposição · luz",copy:"Altitude não trabalha sozinha. Inclinação e orientação da encosta mudam exposição solar, vento e microambiente da lavoura."},
{id:"solo",label:"SOLO",title:"Basalto → terra roxa → argilas → raízes",copy:"Textura, estrutura e tipologia da argila interferem na dinâmica de água, aeração e raízes. A cor do solo, isoladamente, não prevê a xícara."},
{id:"cultivo",label:"CULTIVO",title:"O lugar não trabalha sozinho",copy:"Nutrição, água, sanidade, manejo, colheita e cuidado com o solo influenciam o desenvolvimento da planta e o potencial do fruto."},
{id:"pesquisa",label:"PESQUISA",title:"Olhar dentro da argila",copy:"O trabalho de Diego Siqueira e outros pesquisadores ajuda a formular perguntas sobre solo, relevo e zonas de manejo. Pesquisa orienta relações; não oferece atalhos sensoriais."},
{id:"xicara",label:"XÍCARA",title:"Sentir e medir contam histórias diferentes",copy:"Acidez, doçura, aroma, sabor e corpo são percebidos como conjunto. Nomear um composto específico exige análise do lote; uma sensação sensorial não deve ser atribuída automaticamente a uma única molécula."},
{id:"torra",label:"TORRA",title:"Observar · interpretar · provar",copy:"A torra é uma leitura do lote. Umidade, tamanho, densidade, processamento e composição mudam a transferência de calor; tempo e energia são ajustados e a decisão volta à prova sensorial."}
];
export default function GeoAtlasInteractive(){
 const [active,setActive]=useState<Layer>("localizar"); const [started,setStarted]=useState(false); const [hour,setHour]=useState(8); const [season,setSeason]=useState<"verao"|"outono"|"inverno"|"primavera">("inverno");
 useEffect(()=>{const t=window.setTimeout(()=>setStarted(true),250);return()=>window.clearTimeout(t)},[]);
 const item=layers.find(x=>x.id===active)!;
 const light=Math.max(.18,Math.sin(((hour-6)/12)*Math.PI));
 return <section className={styles.geoExperience} aria-label="Mapa interativo da geografia na xícara">
  <div className={styles.geoStage} style={{"--daylight":light} as CSSProperties}>
   <div className={started ? styles.geoWorldLive : styles.geoWorld}>
    <Image src="/brand/story/mapa-mundi-parana.svg" alt="Mapa-múndi com o Trópico de Capricórnio e a localização do Paraná" fill sizes="(max-width:900px) 100vw, 58vw" unoptimized/>
    <i className={styles.tropicLine}/><b className={styles.tropicLabel}>23°26′ S · TRÓPICO DE CAPRICÓRNIO</b>
   </div>
   <div className={styles.geoParana}><Image src="/brand/story/parana-nortes.svg" alt="Paraná com Norte Central, Norte Pioneiro e cidades de referência" fill sizes="(max-width:900px) 100vw, 42vw" unoptimized/></div>
  </div>
  <nav className={styles.geoLayers} aria-label="Camadas do território">{layers.map(x=><button key={x.id} type="button" aria-pressed={active===x.id} onClick={()=>setActive(x.id)}><span aria-hidden="true">{x.id==="localizar"?"◎":x.id==="latitude"?"23°":x.id==="clima"?"☀↔☾":x.id==="relevo"?"△":x.id==="solo"?"⌁":x.id==="cultivo"?"♧":x.id==="pesquisa"?"⌕":x.id==="xicara"?"◡":"◌"}</span><b>{x.label}</b></button>)}</nav>
  <div className={styles.geoReveal} key={active}><small>{item.label} · BISPO LÊ O TERRITÓRIO</small><h3>{item.title}</h3><p>{item.copy}</p>
   {active==="clima"&&<><div className={styles.climateControls}><label><span>{String(hour).padStart(2,"0")}:00 · deslize o dia</span><input aria-label="Horário do dia" type="range" min="0" max="23" value={hour} onChange={e=>setHour(Number(e.target.value))}/></label><div>{(["verao","outono","inverno","primavera"] as const).map(s=><button type="button" key={s} aria-pressed={season===s} onClick={()=>setSeason(s)}>{s}</button>)}</div></div><div className={styles.dayNight}><span>☀ DIA</span><i/><strong>AMPLITUDE TÉRMICA</strong><i/><span>NOITE ☾</span></div><p className={styles.climateWhisper}>{season==="inverno"&&hour>=5&&hour<=8?"Manhã fria: em condições favoráveis, o orvalho pode aparecer sobre folhas e solo.":hour>=18||hour<=5?"A luz cai e a temperatura tende a recuar. A noite faz parte do ambiente térmico vivido pela planta.":"A luz e a temperatura mudam ao longo do dia. O efeito real depende também de água, relevo, manejo e estágio da planta."}</p></>}
   {active==="solo"&&<div className={styles.soilCut}><span>BASALTO</span><span>TERRA ROXA</span><span>ARGILAS</span><span>ÁGUA + RAÍZES</span></div>}
   {active==="cultivo"&&<div className={styles.careTrail}><span>NUTRIÇÃO</span><span>MANEJO</span><span>ÁGUA</span><span>SANIDADE</span><span>COLHEITA</span></div>}
   {active==="xicara"&&<div className={styles.cupScience}><span>PROVA<br/><b>acidez · aroma · doçura · sabor · corpo</b></span><i>↔</i><span>ANÁLISE<br/><b>ácidos · compostos · concentrações</b></span></div>}
   {active==="torra"&&<div className={styles.roastTrail}><span>GRÃO</span><i>→</i><span>CALOR + TEMPO</span><i>→</i><span>PROVA</span><i>→</i><span>AJUSTE</span></div>}
  </div>
  <p className={styles.geoConclusion}><strong>Uma origem. Muitas relações.</strong> Não há uma única variável que explique a xícara.</p>
 </section>
}