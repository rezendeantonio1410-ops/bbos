"use client";

import {useEffect,useRef,useState} from "react";
import styles from "./page.module.css";
import media from "./DocumentaryHero.module.css";

type Scene={kind:"video"|"photo";src:string;start?:number;seconds:number;label:string};
const scenes:Scene[]=[
  {kind:"photo",src:"/WhatsApp Image 2026-09-01 at 21.36.46 (1).jpeg",seconds:3.2,label:"campo"},
  {kind:"photo",src:"/WhatsApp Image 2026-09-01 at 21.36.46.jpeg",seconds:3.2,label:"origem"},
  {kind:"video",src:"/WhatsApp Video 2026-09-01 at 15.05.46.mp4",start:1,seconds:4,label:"prova"},
  {kind:"video",src:"/WhatsApp Video 2026-09-01 at 15.05.42.mp4",start:1,seconds:4,label:"escolha"},
  {kind:"video",src:"/WhatsApp Video 2026-09-01 at 14.15.16.mp4",start:1,seconds:4,label:"xícara"},
  {kind:"video",src:"/WhatsApp Video 2026-09-01 at 15.22.13.mp4",start:1,seconds:4,label:"critério"}
];
const fallback:Scene={kind:"photo",src:"/WhatsApp Image 2026-09-01 at 21.36.46 (1).jpeg",seconds:3.2,label:"campo"};
const poster="/WhatsApp Image 2026-09-01 at 14.11.25.jpeg";

export default function DocumentaryHero(){
  const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const [scene,setScene]=useState(0);
  const [ready,setReady]=useState(false);
  const current:Scene=scenes[scene]??fallback;
  const next=()=>{if(timer.current)clearTimeout(timer.current);setReady(false);setScene(i=>(i+1)%scenes.length)};
  const schedule=(seconds:number)=>{if(timer.current)clearTimeout(timer.current);timer.current=setTimeout(next,seconds*1000)};
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current)},[]);
  return <div className={styles.authorityVisual}><div className={media.frame}>
    <img src={poster} alt="Prova de café Bispo Coffees" className={`${media.photo} ${!ready?media.ready:""}`}/>
    {current.kind==="video"?<video key={current.src} className={`${media.film} ${ready?media.ready:""}`} autoPlay muted playsInline preload="metadata" poster={poster}
      onLoadedMetadata={e=>{const v=e.currentTarget;v.currentTime=Math.min(current.start??0,Math.max(0,v.duration-.5))}}
      onCanPlay={e=>{setReady(true);void e.currentTarget.play().catch(()=>undefined);schedule(current.seconds)}}
      onTimeUpdate={e=>{if(e.currentTarget.currentTime>=(current.start??0)+current.seconds)next()}}
      onEnded={next} onError={next} aria-label={`Bispo Coffees — ${current.label}`}><source src={current.src} type="video/mp4"/></video>
    :<img key={current.src} src={current.src} alt={`Bispo Coffees — ${current.label}`} className={`${media.film} ${ready?media.ready:""}`} onLoad={()=>{setReady(true);schedule(current.seconds)}}/>}
    <div className={`${media.veil} ${ready?media.ready:""}`}/><div className={media.words}><span>{current.label}</span></div><div className={media.counter}>{String(scene+1).padStart(2,"0")} / {String(scenes.length).padStart(2,"0")}</div>
  </div></div>
}
