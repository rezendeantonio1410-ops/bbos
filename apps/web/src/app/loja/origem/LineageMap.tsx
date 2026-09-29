"use client";
import {useState} from "react";
import styles from "./page.module.css";
const steps=[
["acenpp","ACENPP","Norte Pioneiro · 2009–2013","Trabalho com produtores","Registros públicos do período mostram José como superintendente da ACENPP no projeto de cafés especiais do Norte Pioneiro, trabalhando com produtores, qualidade, Fairtrade, Indicação Geográfica e acesso a mercados. Em 2012, também aparece ministrando capacitação de controle de qualidade como Q-Grader."],
["capricornio","CAPRICORNIO","2015 · Trópico","Origem e mercado","A trajetória pública posterior conecta José à Capricornio Coffees e à valorização comercial de cafés próximos ao Trópico de Capricórnio. Aqui interessa a continuidade da leitura de origem — não um currículo."],
["longitude","LONGITUDE","2024 · origem → mercados","Campo e mercado","A própria Longitude registra José vindo da assistência técnica e dos negócios de café e Suzi com trabalho de nutrição, sustentabilidade e orientação a cafeicultores. Cafés do projeto aparecem hoje em torrefações europeias ligados ao Paraná."],
["bispo","BISPO","hoje","A leitura continua","Na Bispo, esses elementos se reencontram: território, produtor, cultivo, prova, mercado e torra. A página não precisa contar cargos; ela deixa o visitante perceber a continuidade do conhecimento."]
] as const;
export default function LineageMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.lineageMap}><header><p className={styles.kicker}>EXPERIÊNCIA ACUMULADA</p><h2>O conhecimento não começou com a marca.</h2><p>Alguns trabalhos anteriores ajudam a explicar perguntas que continuamos fazendo hoje sobre território, produtores, prova e mercado. Toque apenas se quiser conhecer esses rastros.</p></header><div className={styles.lineageRail}>{steps.map(([id,_label,meta,title,copy],i)=><button type="button" key={id} className={styles.lineageNode} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><span className={`${styles.lineageGlyph} ${styles["lineage_"+id]}`} aria-hidden="true"><i/><i/><i/></span><small>{meta}</small><strong>{title}</strong><b>{meta}</b>{open===id&&<em>{copy}</em>}{i<steps.length-1&&<u aria-hidden="true">→</u>}</button>)}</div></section>
}