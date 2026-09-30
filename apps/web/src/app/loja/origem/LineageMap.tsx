"use client";
import {useState} from "react";
import styles from "./page.module.css";
const steps=[
["acenpp","CAMPO","desde 2003 · Paraná","José · origem e qualidade","José Rezende trabalha diretamente com produtores desde 2003. A convivência com diferentes áreas cafeeiras construiu uma leitura feita no campo: produtor, processamento, prova, qualidade e mercado observados em conjunto."],
["longitude","CAMPO","desde 2006 · Paraná","Suzi · planta e solo","Suzi Ninov trabalha com produtores no Paraná desde 2006. Sua leitura aproxima planta, nutrição, fertilidade, manejo e produtividade — outra forma de conhecer o mesmo território por dentro."],
["capricornio","MERCADO","desde 2015 · mundo","Origem e mercado","Em 2015, José cofundou a Capricornio Coffees. O trabalho ajudou a conectar cafés do Paraná e de São Paulo, próximos ao Trópico de Capricórnio, a importadores e torrefadores de diferentes países."],
["bispo","BISPO","hoje · José + Suzi","A leitura continua","Na Bispo, as duas experiências chegam à mesma decisão. Suzi lê planta, solo e produção; José lê origem, prova, torra e mercado. O café só entra quando essas leituras concordam."]
] as const;
export default function LineageMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.lineageMap}><header><p className={styles.kicker}>PESSOAS · TERRITÓRIO</p><h2>Conhecer um lugar leva tempo.</h2><p>José e Suzi aparecem aqui apenas como parte dessa leitura construída no campo. Toque somente se quiser conhecer os rastros.</p></header><div className={styles.lineageRail}>{steps.map(([id,,meta,title,copy],i)=><button type="button" key={id} className={styles.lineageNode} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><span className={`${styles.lineageGlyph} ${styles["lineage_"+id]}`} aria-hidden="true"><i/><i/><i/></span><small>{meta}</small><strong>{title}</strong><b>{meta}</b>{open===id&&<em>{copy}</em>}{i<steps.length-1&&<u aria-hidden="true">→</u>}</button>)}</div></section>
}
