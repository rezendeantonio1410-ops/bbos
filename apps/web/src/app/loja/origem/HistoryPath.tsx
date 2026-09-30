"use client";
import {useState} from "react";
import origin from "./page.module.css";
const items=[
 {id:"1929",eyebrow:"1929 · LONDRINA",title:"Uma cidade nasce no Norte do Paraná",visual:"city",copy:"A formação de Londrina está ligada ao processo de colonização do Norte do Paraná. O café se tornaria uma das forças que transformaram população, trabalho, paisagem e infraestrutura da região."},
 {id:"1950",eyebrow:"ANOS 1950 · CAFÉ",title:"A paisagem muda com a cafeicultura",visual:"coffee",copy:"Em meados do século XX, a cafeicultura marcou profundamente o Norte do Paraná. Lavouras, produtores, trabalhadores, armazéns e ferrovias passaram a fazer parte de uma economia e de uma paisagem em rápida transformação."},
 {id:"hoje",eyebrow:"HOJE · ORIGEM VIVA",title:"O território continua mudando",visual:"today",copy:"A origem não ficou congelada no passado. Cultivares, manejo, clima, pesquisa, processamento, produtores e mercados continuam transformando a forma como o Norte do Paraná produz e interpreta seus cafés."}
] as const;
export default function HistoryPath(){
 const [open,setOpen]=useState<string|null>(null);
 return <div className={origin.historyInteractive} aria-label="História cafeeira do Norte do Paraná">{items.map(x=><button type="button" key={x.id} className={origin.historyMoment} aria-expanded={open===x.id} onClick={()=>setOpen(open===x.id?null:x.id)}><span className={`${origin.historyScene} ${origin["historyScene_"+x.visual]}`} aria-hidden="true"><i/><i/><i/><em/></span><small>{x.eyebrow}</small><strong>{x.title}</strong><b>{open===x.id?"fechar ×":"descobrir +"}</b>{open===x.id&&<span className={origin.historyStory}>{x.copy}</span>}</button>)}</div>
}