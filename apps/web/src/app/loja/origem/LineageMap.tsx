"use client";
import {useState} from "react";
import styles from "./page.module.css";
const steps=[
["acenpp","ACENPP","Norte Pioneiro · 2009–2013","Produtor · qualidade · origem","Registros públicos do período mostram José como superintendente da ACENPP no projeto de cafés especiais do Norte Pioneiro, trabalhando com produtores, qualidade, Fairtrade, Indicação Geográfica e acesso a mercados. Em 2012, também aparece ministrando capacitação de controle de qualidade como Q-Grader."],
["capricornio","CAPRICORNIO","2015 · Trópico","Território ganha linguagem","A trajetória pública posterior conecta José à Capricornio Coffees e à valorização comercial de cafés próximos ao Trópico de Capricórnio. Aqui interessa a continuidade da leitura de origem — não um currículo."],
["longitude","LONGITUDE","2024 · origem → mercados","José + Suzi · campo + mercado","A própria Longitude registra José vindo da assistência técnica e dos negócios de café e Suzi com trabalho de nutrição, sustentabilidade e orientação a cafeicultores. Cafés do projeto aparecem hoje em torrefações europeias ligados ao Paraná."],
["bispo","BISPO","origem → torra → xícara","Conhecimento vira escolha","Na Bispo, esses elementos se reencontram: território, produtor, cultivo, prova, mercado e torra. A página não precisa contar cargos; ela deixa o visitante perceber a continuidade do conhecimento."]
] as const;
export default function LineageMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.lineageMap}><header><p className={styles.kicker}>BISPO · UMA HISTÓRIA CONSTRUÍDA NO CAFÉ</p><h2>A Bispo começa muito antes do nome.</h2><p>Anos de território, produtores, prova e mercados reunidos em uma mesma forma de escolher café. Toque para conhecer os rastros.</p></header><div className={styles.lineageRail}>{steps.map(([id,_label,meta,title,copy],i)=><button type="button" key={id} className={styles.lineageNode} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><span className={`${styles.lineageGlyph} ${styles["lineage_"+id]}`} aria-hidden="true"><i/><i/><i/></span><small>{meta}</small><strong>{id==="bispo"?"BISPO":title}</strong><b>{id==="bispo"?title:meta}</b>{open===id&&<em>{copy}</em>}{i<steps.length-1&&<u aria-hidden="true">→</u>}</button>)}</div></section>
}