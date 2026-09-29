"use client";
import {useState} from "react";
import styles from "./page.module.css";
const steps=[
["acenpp","CAMPO","desde 2003","José · produtores","José Rezende trabalha diretamente com produtores de café desde 2003. No Norte Pioneiro, essa experiência passou por qualidade, organização da origem, prova e acesso a mercados — uma leitura construída no campo e na relação com quem produz."],
["capricornio","TERRITÓRIO","anos de campo","Origem · território","A experiência acumulada aproximou território, qualidade e mercado. O interesse aqui não é uma sequência de empresas ou cargos, mas a permanência das mesmas perguntas: de onde vem o café, como foi cultivado e o que cada lote pode expressar."],
["longitude","SUZI","Paraná · campo","Suzi · planta e produtor","Suzi Ninov construiu no Paraná um trabalho próximo aos cafeicultores, com atenção à nutrição, ao solo, à produtividade, à sustentabilidade e à qualidade. Em 2017, um cafeicultor orientado por ela recebeu reconhecimento nacional por seu café — um exemplo de como acompanhamento técnico e cuidado no campo podem caminhar juntos."],
["bispo","BISPO","hoje","José + Suzi · uma leitura","Na Bispo, duas experiências de campo se encontram: José na relação com produtores, origem, prova e mercado; Suzi na leitura da planta, nutrição, solo e manejo. O resultado não é um currículo — é a forma como a Bispo observa, escolhe e trabalha cada café."]
] as const;
export default function LineageMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.lineageMap}><header><p className={styles.kicker}>EXPERIÊNCIA ACUMULADA</p><h2>O conhecimento não começou com a marca.</h2><p>Anos de campo ajudam a explicar a forma como José e Suzi leem hoje território, planta, produtor e xícara. Toque apenas se quiser conhecer essas experiências.</p></header><div className={styles.lineageRail}>{steps.map(([id,_label,meta,title,copy],i)=><button type="button" key={id} className={styles.lineageNode} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><span className={`${styles.lineageGlyph} ${styles["lineage_"+id]}`} aria-hidden="true"><i/><i/><i/></span><small>{meta}</small><strong>{title}</strong><b>{meta}</b>{open===id&&<em>{copy}</em>}{i<steps.length-1&&<u aria-hidden="true">→</u>}</button>)}</div></section>
}