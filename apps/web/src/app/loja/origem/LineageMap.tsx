"use client";
import {useState} from "react";
import styles from "./page.module.css";
const steps=[
["acenpp","ACENPP","Norte Pioneiro","Antes da marca, o território","José Rezende já trabalhava a leitura e a valorização dos cafés do Norte do Paraná desde o período da ACENPP. A experiência com produtores antecede as marcas."],
["capricornio","CAPRICORNIO","2015 · Trópico","Uma latitude ganha voz","Como cofundador da Capricornio Coffees, José ajudou a dar visibilidade a cafés de São Paulo e do Paraná próximos ao Trópico de Capricórnio."],
["longitude","LONGITUDE","origem → mercados","Do território para fora","José e Suzi reuniram origem, orientação a produtores e conexão com mercados internacionais no conceito Longitude Coffees."],
["bispo","BISPO","Brasil → Europa → mundo","Conhecimento vira escolha","Na Bispo, a trajetória converge em curadoria, torra, prova e uma forma própria de traduzir a origem para quem bebe."]
] as const;
export default function LineageMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.lineageMap}><header><p className={styles.kicker}>UMA LEITURA CONSTRUÍDA NO TEMPO</p><h2>Antes da marca, o território.</h2><p>Role para entender. Toque para aprofundar.</p></header><div className={styles.lineageRail}>{steps.map(([id,label,meta,title,copy],i)=><button type="button" key={id} className={styles.lineageNode} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><span className={`${styles.lineageGlyph} ${styles["lineage_"+id]}`} aria-hidden="true"><i/><i/><i/></span><small>{meta}</small><strong>{label}</strong><b>{title}</b>{open===id&&<em>{copy}</em>}{i<steps.length-1&&<u aria-hidden="true">→</u>}</button>)}</div></section>
}