"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import styles from "./page.module.css";

type Choice = { id: string; label: string; hint: string; tone: string; symbol: string };
type Answers = { flavors: string[]; descriptors: string[]; memories: string[]; acidity?: string; body?: string; moments: string[] };

const families: Choice[] = [
  { id:"sweet", label:"Doce", hint:"Chocolate, caramelo, mel", tone:"#C87324", symbol:"◐" },
  { id:"fruit", label:"Frutado", hint:"Frutas maduras e suculentas", tone:"#B6434B", symbol:"●" },
  { id:"citrus", label:"Cítrico", hint:"Laranja, tangerina, limão", tone:"#E8A72B", symbol:"◒" },
  { id:"floral", label:"Floral", hint:"Flores e delicadeza", tone:"#9B7C8D", symbol:"✣" },
  { id:"nuts", label:"Castanhas", hint:"Amêndoas, nozes, cacau", tone:"#73513B", symbol:"◆" },
];
const descriptors: Record<string, Choice[]> = {
  sweet:[{id:"chocolate",label:"Chocolate",hint:"Cremoso e familiar",tone:"#6B4334",symbol:"■"},{id:"caramel",label:"Caramelo",hint:"Doce e tostado",tone:"#C87324",symbol:"●"},{id:"dulce",label:"Doce de leite",hint:"Cremoso e afetivo",tone:"#D9A15B",symbol:"◉"},{id:"honey",label:"Mel",hint:"Doçura delicada",tone:"#E2B23D",symbol:"⬟"}],
  fruit:[{id:"strawberry",label:"Morango",hint:"Fruta fresca ou geleia",tone:"#C94852",symbol:"♥"},{id:"cherry",label:"Cereja",hint:"Doce, viva, persistente",tone:"#A82E3A",symbol:"●"},{id:"berries",label:"Frutas vermelhas",hint:"Suculentas e complexas",tone:"#8F3E5A",symbol:"●"},{id:"peach",label:"Pêssego",hint:"Macio e perfumado",tone:"#E7A074",symbol:"◒"}],
  citrus:[{id:"tangerine",label:"Tangerina",hint:"Doce e luminosa",tone:"#ED8A2B",symbol:"◉"},{id:"orange",label:"Laranja",hint:"Fresca e familiar",tone:"#E79A31",symbol:"◒"},{id:"lemon",label:"Limão",hint:"Vivo e refrescante",tone:"#D7C93E",symbol:"●"},{id:"apple",label:"Maçã",hint:"Frescor delicado",tone:"#8DA54A",symbol:"◐"}],
  floral:[{id:"jasmine",label:"Jasmim",hint:"Leve e elegante",tone:"#A68EA1",symbol:"✣"},{id:"orangeblossom",label:"Flor de laranjeira",hint:"Perfumada e fresca",tone:"#E6B17A",symbol:"✤"}],
  nuts:[{id:"almond",label:"Amêndoas",hint:"Doce e aconchegante",tone:"#A77B55",symbol:"◆"},{id:"walnut",label:"Nozes",hint:"Profundo e persistente",tone:"#76513B",symbol:"◆"},{id:"cocoa",label:"Cacau",hint:"Intenso e seco",tone:"#5E4035",symbol:"■"}],
};
const memories: Choice[] = [
  {id:"home",label:"Casa",hint:"Algo familiar",tone:"#D79B65",symbol:"⌂"},{id:"childhood",label:"Infância",hint:"Uma lembrança doce",tone:"#E7B94B",symbol:"✦"},{id:"dessert",label:"Sobremesa",hint:"Prazer e recompensa",tone:"#C96E59",symbol:"◉"},{id:"pause",label:"Uma pausa",hint:"Um momento só seu",tone:"#6E9480",symbol:"☕"},{id:"travel",label:"Viagem",hint:"Algo que surpreendeu",tone:"#5D7E8B",symbol:"↗"},{id:"justlike",label:"Só gostei",hint:"Sem precisar explicar",tone:"#9B8877",symbol:"♡"},
];
const acidity: Choice[] = [
  {id:"low",label:"Suave",hint:"Pouco frescor",tone:"#D6C7A4",symbol:"○"},{id:"balanced",label:"Equilibrada",hint:"Frescor presente",tone:"#E0A73A",symbol:"◐"},{id:"citrica",label:"Cítrica",hint:"Como laranja",tone:"#E58A2E",symbol:"◒"},{id:"malica",label:"Málica",hint:"Como maçã",tone:"#799A46",symbol:"◉"},{id:"vibrant",label:"Vibrante",hint:"Cheia de energia",tone:"#B83A31",symbol:"●"},
];
const bodies: Choice[] = [
  {id:"light",label:"Leve",hint:"Fluido e delicado",tone:"#C7D8D5",symbol:"≈"},{id:"silky",label:"Sedoso",hint:"Macio e elegante",tone:"#95B3A8",symbol:"∿"},{id:"round",label:"Envolvente",hint:"Presente e confortável",tone:"#B87843",symbol:"◯"},{id:"structured",label:"Estruturado",hint:"Mais corpo e persistência",tone:"#5F4738",symbol:"⬤"},
];
const moments: Choice[] = [
  {id:"daily",label:"Começar o dia",hint:"Algo para reencontrar",tone:"#F4D54A",symbol:"☀"},{id:"pause",label:"Minha pausa",hint:"Conforto e presença",tone:"#E78A38",symbol:"☕"},{id:"meal",label:"Depois de comer",hint:"Um final gostoso",tone:"#C87324",symbol:"◒"},{id:"discover",label:"Quero descobrir",hint:"Algo diferente",tone:"#387D50",symbol:"✦"},{id:"special",label:"Algo especial",hint:"Fora da curva",tone:"#B83A31",symbol:"★"},
];

const recommendations = {
  essencial:{name:"Essencial",line:"GOURMET",notes:"Equilibrado · Suave · Versátil",price:"R$ 48",tone:"#F4D54A"},
  caramelo:{name:"Caramelo",line:"CLÁSSICOS",notes:"Caramelo · Chocolate · Corpo envolvente",price:"R$ 68",tone:"#E78A38"},
  doce:{name:"Doce de Leite",line:"CLÁSSICOS",notes:"Mascavo · Doce de leite · Alfajor",price:"R$ 74",tone:"#D99B3C"},
  tangerina:{name:"Tangerina",line:"CLÁSSICOS",notes:"Cítrico · Doce · Fresco",price:"R$ 68",tone:"#E8892F"},
  singular:{name:"Singular",line:"ÉPICOS",notes:"Frutado · Complexo · Evolutivo",price:"R$ 85",tone:"#387D50"},
  raro:{name:"Microlote Raro",line:"RAROS",notes:"Floral · Frutas vermelhas · Único",price:"R$ 53",tone:"#B83A31"},
};

export default function DescobrirCafePage(){
 const [step,setStep]=useState(0); const [openFamily,setOpenFamily]=useState<string>(); const [finished,setFinished]=useState(false);
 const [answers,setAnswers]=useState<Answers>({flavors:[],descriptors:[],memories:[],moments:[]});
 const toggle=(key:"flavors"|"descriptors"|"memories"|"moments",id:string)=>setAnswers(a=>({...a,[key]:a[key].includes(id)?a[key].filter(x=>x!==id):[...a[key],id]}));
 const resultKey=useMemo(()=>{ const d=answers.descriptors; if(answers.moments.includes("special")||d.some(x=>["jasmine","orangeblossom"].includes(x)))return"raro"; if(answers.moments.includes("discover")||d.some(x=>["strawberry","cherry","berries","peach"].includes(x)))return"singular"; if(d.some(x=>["tangerine","orange","lemon","apple"].includes(x))||["citrica","malica","vibrant"].includes(answers.acidity||""))return"tangerina"; if(d.includes("dulce")||((d.includes("chocolate")||d.includes("caramel"))&&answers.body==="structured"))return"doce"; if(d.some(x=>["chocolate","caramel","honey","almond","cocoa"].includes(x))||answers.body==="round")return"caramelo"; return"essencial";},[answers]);
 const result=recommendations[resultKey as keyof typeof recommendations];
 const next=()=>{if(step<4)setStep(s=>s+1);else setFinished(true)};
 const back=()=>{if(openFamily)setOpenFamily(undefined);else setStep(s=>Math.max(0,s-1))};
 const selectedWords=[...answers.descriptors,...answers.memories].slice(0,5).map(id=>[...Object.values(descriptors).flat(),...memories].find(x=>x.id===id)?.label).filter(Boolean);
 if(finished)return <main className={styles.page}><header className={styles.header}><Link href="/loja" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees" priority/></Link><div className={styles.headerCopy}><span>SEU PALADAR BISPO</span><small>O que você escolheu virou uma direção.</small></div><Link className={styles.close} href="/loja">×</Link></header><section className={styles.resultPage}><div className={styles.resultLead}><p>OLHA O QUE VOCÊ ACABOU DE DESCOBRIR.</p><h1>Seu café tem um jeito.</h1><span>{selectedWords.join(" · ")}</span></div><div className={styles.resultGrid}><TastePortrait answers={answers} tone={result.tone}/><article className={styles.recommendation} style={{"--tone":result.tone} as React.CSSProperties}><div className={styles.resultBag}><span>BISPO</span><i/></div><div className={styles.resultCopy}><p>{result.line}</p><h2>{result.name}</h2><strong>{result.notes}</strong><span>Suas escolhas de sabor, sensação e memória apontaram para este caminho.</span><div className={styles.resultBuy}><b>{result.price} <small>· 500 g</small></b><button>Quero experimentar →</button></div><button className={styles.why} onClick={()=>{setFinished(false);setStep(0)}}>Explorar de novo</button></div></article></div></section></main>;
 return <main className={styles.page}><header className={styles.header}><Link href="/loja" className={styles.brand}><Image src="/brand/logo/bispo-logo-official-transparent.png" width={150} height={50} alt="Bispo Coffees" priority/></Link><div className={styles.headerCopy}><span>DESCUBRA O SEU CAFÉ</span><small>Uma pequena viagem pelo que você gosta.</small></div><Link className={styles.close} href="/loja">×</Link></header><section className={styles.experience}>
 <div className={styles.softProgress}><i className={step>=0?styles.on:""}/><i className={step>=1?styles.on:""}/><i className={step>=2?styles.on:""}/><i className={step>=3?styles.on:""}/><i className={step>=4?styles.on:""}/><span>{step<2?"Estamos conhecendo seu paladar.":step<4?"Já temos algumas pistas...":"Falta pouco."}</span></div>
 <div className={styles.intro}><p>{step===0?"COMECE POR UMA LEMBRANÇA.":step===1?"MEMÓRIA TAMBÉM PROVA CAFÉ.":step===2?"AGORA IMAGINE A SENSAÇÃO.":step===3?"COMO ELE FICA NA BOCA?":"E ONDE ESSA XÍCARA ENTRA NA SUA VIDA?"}</p><h1>{step===0?(openFamily?"Entre um pouco mais nesse sabor.":"O que chama você?"):step===1?"Isso te leva para algum lugar?":step===2?"Quanto de frescor combina com você?":step===3?"Como você gosta de sentir o café?":"Quando você quer esse café?"}</h1><span>{step===0?"Pode ser um sabor, uma fruta, uma sobremesa ou só algo que deu vontade. Marque quantos quiser.":step===1?"Casa, infância, uma sobremesa, uma pausa. Pode marcar mais de uma — ou nenhuma.":"Não existe resposta certa. Escolha pela sensação."}</span></div>
 <div className={styles.journeyStage}>{step===0&&<><SensoryWheel active={openFamily} onOpen={id=>{setOpenFamily(id);if(!answers.flavors.includes(id))toggle("flavors",id)}}/><div className={styles.memoryChoices}>{(openFamily?descriptors[openFamily]:families).map(c=><ChoiceButton key={c.id} choice={c} selected={(openFamily?answers.descriptors:answers.flavors).includes(c.id)} onClick={()=>openFamily?toggle("descriptors",c.id):setOpenFamily(c.id)}/>)}</div></>}{step===1&&<div className={styles.memoryChoices}>{memories.map(c=><ChoiceButton key={c.id} choice={c} selected={answers.memories.includes(c.id)} onClick={()=>toggle("memories",c.id)}/>)}</div>}{step===2&&<><AcidityMandala selected={answers.acidity}/><div className={styles.memoryChoices}>{acidity.map(c=><ChoiceButton key={c.id} choice={c} selected={answers.acidity===c.id} onClick={()=>setAnswers(a=>({...a,acidity:c.id}))}/>)}</div></>}{step===3&&<><BodyPulse selected={answers.body}/><div className={styles.memoryChoices}>{bodies.map(c=><ChoiceButton key={c.id} choice={c} selected={answers.body===c.id} onClick={()=>setAnswers(a=>({...a,body:c.id}))}/>)}</div></>}{step===4&&<div className={styles.memoryChoices}>{moments.map(c=><ChoiceButton key={c.id} choice={c} selected={answers.moments.includes(c.id)} onClick={()=>toggle("moments",c.id)}/>)}</div>}</div>
 {selectedWords.length>0&&<div className={styles.memoryTrail}><small>SUAS PISTAS</small>{selectedWords.map(x=><span key={x}>{x}</span>)}</div>}
 <div className={styles.bispoWhisper}><strong>Dica do Bispo</strong><span>{step===0?"Não pense demais. A primeira lembrança costuma dizer bastante.":step===1?"Às vezes reconhecemos uma sensação antes de conseguirmos dar nome a ela.":step===2?"Acidez no café pode ser frescor — como numa fruta.":"Escolha o que dá vontade. A técnica fica por nossa conta."}</span></div>
 <div className={styles.mobileNav}>{(step>0||openFamily)&&<button onClick={back}>← Voltar</button>}<button className={styles.continueButton} onClick={openFamily?()=>setOpenFamily(undefined):next}>{openFamily?"Outros sabores":"Continuar"} →</button></div>
 </section></main>;
}
function ChoiceButton({choice,selected,onClick}:{choice:Choice;selected:boolean;onClick:()=>void}){return <button className={`${styles.memoryChoice} ${selected?styles.selected:""}`} style={{"--tone":choice.tone} as