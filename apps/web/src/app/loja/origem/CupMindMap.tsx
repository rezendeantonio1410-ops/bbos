"use client";
import {useState} from "react";
import type {CSSProperties} from "react";
import styles from "./page.module.css";

const senses=[
["docura","DOÇURA","conforto e equilíbrio","A doçura percebida participa do equilíbrio da xícara e conversa com aroma, acidez, corpo, torra e preparo."],
["acidez","ACIDEZ","viva · limpa · brilhante","Acidez é uma sensação construída por diferentes compostos e pelo contexto da bebida. A prova, sozinha, não identifica uma molécula."],
["aroma","AROMA","antes e durante o gole","Fragrância e aroma ajudam a construir a identidade percebida do café e mudam com matéria-prima, torra e preparo."],
["corpo","CORPO","peso e textura","Corpo descreve sensações táteis da bebida. Não é sinônimo de força ou qualidade."],
["sabor","SABOR","o conjunto na boca","Sabor emerge da integração entre gosto, aroma e sensações táteis; descritores organizam a percepção, não substituem a experiência."],
["final","FINALIZAÇÃO","o que permanece","A finalização descreve as sensações que permanecem depois do gole e ajuda a completar a leitura do perfil."]
] as const;
export default function CupMindMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.cupMind} aria-label="Mapa sensorial da xícara">
  <header><p className={styles.kicker}>DA TORRA PARA A PROVA</p><h2>A xícara devolve informação.</h2><p>Olhe primeiro. Toque apenas no que quiser aprofundar.</p></header>
  <div className={styles.cupHub}><div className={styles.cupCenter} aria-hidden="true"><i/><i/><b>XÍCARA</b></div>
   {senses.map(([id,label,short,copy],i)=><button key={id} type="button" className={styles.cupNode} style={{"--i":i} as CSSProperties} onClick={()=>setOpen(open===id?null:id)} aria-expanded={open===id}><span className={`${styles.cupGlyph} ${styles["cupGlyph_"+id]}`} aria-hidden="true"><i/><i/><i/></span><strong>{label}</strong><small>{short}</small>{open===id&&<em><b>{label}</b>{copy}{id==="acidez"&&<u>Sentir ↔ medir: nomear um ácido específico pede análise compatível do lote.</u>}</em>}</button>)}
  </div>
  <details className={styles.cupLibrary}><summary>Biblioteca sensorial · ciência, prova e análise <span>+</span></summary><div><h3>E a acidez fosfórica?</h3><p>Alguns lotes da região podem apresentar uma acidez viva, limpa ou brilhante, às vezes descrita na prova como fosfórica. O ácido fosfórico é um dos compostos que pode ser medido na bebida, mas a sensação de acidez resulta do conjunto de ácidos, aromas, torra e preparo. Atribuir essa sensação a uma molécula específica em um café da Bispo exige análise do lote e avaliação sensorial compatível.</p><p><strong>PROVA ↔ ANÁLISE.</strong> Sentir e medir oferecem informações diferentes sobre o mesmo café.</p></div></details>
 </section>
}