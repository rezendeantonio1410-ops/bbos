"use client";
import {useState} from "react";
import type {CSSProperties} from "react";
import Image from "next/image";
import styles from "./page.module.css";

const nodes=[
["densidade","DENSIDADE","Massa · volume · estrutura","A densidade ajuda a ler como o lote pode receber energia. É uma informação de partida, não uma receita de torra."],
["umidade","UMIDADE","Água dentro do grão","A umidade participa da transferência de calor. Ela é medida antes da torra e lida junto com densidade, tamanho, processo e composição do lote."],
["tamanho","TAMANHO","Calibre · distribuição","Tamanho e distribuição dos grãos ajudam a compreender como o lote responde ao calor."],
["energia","ENERGIA","Entrada de calor → grão","A energia é ajustada ao longo do processo. O objetivo não é perseguir um número isolado, mas conduzir a transformação do lote."],
["tempo","TEMPO","Evolução ao longo da torra","Tempo e temperatura são acompanhados juntos. Perfis diferentes podem produzir resultados diferentes; não há uma temperatura universal para o Paraná."],
["olhos","OBSERVAR","Trier · cor · aroma · curva","Curva e sensores orientam. O trier, o aroma, a cor e a experiência humana ajudam a interpretar o que está acontecendo."],
["prova","PROVAR","Quebrar · cheirar · colher · provar","Doçura, corpo, acidez, aroma e equilíbrio são provados. A xícara devolve informação para o próximo ajuste."],
["perfil","AJUSTAR","Prova → leitura → próximo perfil","A escolha é guiada por testes e prova sensorial de cada lote, não apenas por altitude ou por uma curva."]
] as const;

export default function RoastMindMap(){
 const [open,setOpen]=useState<string|null>(null);
 return <section className={styles.roastMind} aria-label="Mapa cognitivo da torra">
  <header><p className={styles.kicker}>A ÚLTIMA LEITURA DA ORIGEM</p><h2>Na torra, cada lote pede uma leitura própria.</h2><p>A curva orienta. Os olhos observam. A prova decide.</p></header>
  <div className={styles.roastOrbit}><div className={styles.roastFlow} aria-hidden="true"><span>LER O GRÃO</span><i>→</i><span>CONDUZIR</span><i>→</i><span>OBSERVAR</span><i>→</i><span>PROVAR</span><i>↺</i></div>
   <figure className={styles.roastCenter}><Image src="/brand/story/torrador-linhas-sem-barba.webp" alt="Ilustração editorial de uma pessoa observando grãos no amostrador de um torrador" fill sizes="(max-width:700px) 78vw, 390px" unoptimized/><figcaption>TORRA <small>observar · interpretar · provar</small></figcaption></figure>
   {nodes.map(([id,label,short,copy],i)=><button key={id} type="button" className={styles.roastNode} style={{"--i":i} as CSSProperties} aria-expanded={open===id} onClick={()=>setOpen(open===id?null:id)}><i className={styles.roastNumber}>{String(i+1).padStart(2,"0")}</i><span className={`${styles.roastGlyph} ${styles["roastGlyph_"+id]}`} aria-hidden="true"><u/><u/><u/><em/></span><strong>{label}</strong><small className={styles.roastHint}>{short}</small><span className={styles.roastCue} aria-hidden="true">toque para aprofundar</span>{open===id&&<span><b>{label}</b>{copy}<em>fechar ×</em></span>}</button>)}
  </div>
  <details className={styles.roastLong}><summary>Como se lê um lote? <span>+</span></summary><div><p>José desenvolve e prova perfis para cada lote do Paraná. Em seu trabalho pelo mundo, mostra como ler o grão, ajustar o calor e revelar o potencial de cafés de altitudes mais baixas, inclusive nos arredores do Trópico de Capricórnio.</p><p>Em lavouras entre aproximadamente 600 e 800 m, não basta importar uma receita desenvolvida para cafés acima de 1.600 m. Umidade, tamanho, densidade, processamento e composição do lote mudam a transferência de calor. O torrador acompanha tempo e energia, prova amostras e ajusta o perfil para preservar as qualidades daquele café.</p><p>Há pesquisas em que um perfil mais quente e curto recebeu melhor avaliação para os cafés de menor altitude estudados; outras mostram que a torra altera compostos da bebida. <strong>Isso não estabelece uma temperatura universal para o Paraná.</strong> A escolha é guiada por testes e prova sensorial de cada lote.</p></div></details>
 </section>
}