"use client";

import {useRef,useState} from "react";
import styles from "./page.module.css";
import media from "./DocumentaryHero.module.css";

const clips=[
  "/WhatsApp Video 2026-09-01 at 15.05.46.mp4",
  "/WhatsApp Video 2026-09-01 at 15.05.42.mp4",
  "/WhatsApp Video 2026-09-01 at 15.05.49.mp4",
  "/WhatsApp Video 2026-09-01 at 15.22.13.mp4",
  "/WhatsApp Video 2026-09-01 at 14.15.16.mp4"
];
const poster="/WhatsApp Image 2026-09-01 at 14.11.25.jpeg";

export default function DocumentaryHero(){
  const video=useRef<HTMLVideoElement>(null);
  const [clip,setClip]=useState(0);
  const [photoReady,setPhotoReady]=useState(false);
  const [videoReady,setVideoReady]=useState(false);
  const ready=videoReady||photoReady;
  const next=()=>{setVideoReady(false);setClip(i=>(i+1)%clips.length)};
  return <div className={styles.authorityVisual}>
    <div className={media.frame}>
      <img src={poster} alt="José Rezende em prova de café" className={`${media.photo} ${photoReady&&!videoReady?media.ready:""}`} onLoad={()=>setPhotoReady(true)}/>
      <video ref={video} key={clips[clip]} className={`${media.film} ${videoReady?media.ready:""}`} autoPlay muted playsInline preload="metadata" poster={poster} onCanPlay={()=>setVideoReady(true)} onEnded={next} onError={next} aria-label="Trajetória Bispo Coffees: campo, prova e escolha">
        <source src={clips[clip]} type="video/mp4"/>
      </video>
      <div className={`${media.veil} ${ready?media.ready:""}`}/>
      <div className={`${media.fallback} ${ready?media.hidden:""}`} aria-hidden="true"><div className={styles.branch}><b className={styles.leafOne}/><b className={styles.leafTwo}/><b className={styles.leafThree}/><i className={styles.cherryOne}/><i className={styles.cherryTwo}/><i className={styles.cherryThree}/></div></div>
      <div className={`${media.pulse} ${ready?media.ready:""}`} aria-hidden="true"/>
      <div className={media.words}><span>campo</span><span>prova</span><span>xícara</span></div>
      <div className={media.signature}><strong>Bispo</strong><span>José Rezende</span></div>
      <div className={media.counter}>{String(clip+1).padStart(2,"0")} / {String(clips.length).padStart(2,"0")}</div>
    </div>
  </div>
}
