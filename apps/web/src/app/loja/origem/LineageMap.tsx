"use client";
import {useState} from "react";
import styles from "./page.module.css";
const steps=[
["acenpp","CAMPO","desde 2003 · Paraná","José · território","José Rezende trabalha diretamente com produtores desde 2003. A convivência com diferentes áreas cafeeiras do Paraná ajudou a construir uma leitura de território feita no campo: produtor, origem, qualidade e xícara observados em conjunto."],
["capricornio","TERRITÓRIO","Norte do Paraná","Ler o lugar","Anos de campo conectam relevo, clima, solo, planta, manejo e produtor. O território não é uma explicação isolada da xícara; é o contexto onde essas relações acontecem."],
["longitude","CAMPO","desde 2006 · Paraná","Suzi · território","Suzi Ninov trabalha com produtores desde 2006. Sua leitura aproxima planta, nutrição, solo, manejo e produtor — outra forma de conhecer o mesmo território por dentro."],
["bispo","BISPO","hoje · Norte do Paraná","A leitura continua","Na Bispo, essas experiências ajudam a ler o Norte do Paraná com mais contexto. As pessoas não são o centro desta história: servem para aproximar quem visita a página do território, de seus produtores e de seus cafés."]
] as const;
export default function LineageMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.lineageMap}><header><p className={styles.kicker}>PESSOAS · TERRITÓRIO</p><h2>Conhecer um lugar leva tempo.</h2><p>José e Suzi aparecem aqui apenas como parte dessa leitura construída no campo. Toque somente se quiser conhecer os rastros.</p></header><div className={styles.lineageRail}>{steps.map(([id,_label,meta,title,copy],i)=><button type="button" key={id} className={styles.lineageNode} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><span className={`${styles.lineageGlyph} ${styles["lineage_"+id]}`} aria-hidden="true"><i/><i/><i/></span><small>{meta}</small><strong>{title}</strong><b>{meta}</b>{open===id&&<em>{copy}</em>}{i<steps.length-1&&<u aria-hidden="true">→</u>}</button>)}</div></section>
}