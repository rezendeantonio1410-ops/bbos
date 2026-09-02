"use client";

import {useState} from "react";
import styles from "./page.module.css";
import media from "./DocumentaryHero.module.css";

export default function DocumentaryHero(){
  const [photoReady,setPhotoReady]=useState(false);
  const [videoReady,setVideoReady]=useState(false);
  const ready=videoReady||photoReady;
  return <div className={styles.authorityVisual}>
    <div className={media.frame}>
      <img
        src="/media/bispo/hero-cupping.jpg"
        alt="Seleção e prova de café Bispo Coffees"
        className={`${media.photo} ${photoReady&&!videoReady?media.ready:""}`}
        onLoad={()=>setPhotoReady(true)}
        onError={()=>setPhotoReady(false)}
      />
      <video
        className={`${media.film} ${videoReady?media.ready:""}`}
        autoPlay muted loop playsInline preload="metadata"
        poster="/media/bispo/hero-cupping.jpg"
        onCanPlay={()=>setVideoReady(true)}
        onError={()=>setVideoReady(false)}
        aria-label="José Rezende e Suzi Ninov avaliando cafés"
      >
        <source src="/media/bispo/hero-documentary.mp4" type="video/mp4"/>
      </video>
      <div className={`${media.veil} ${ready?media.ready:""}`}/>
      <div className={`${media.fallback} ${ready?media.hidden:""}`} aria-hidden="true">
        <div className={styles.branch}><b className={styles.leafOne}/><b className={styles.leafTwo}/><b className={styles.leafThree}/><i className={styles.cherryOne}/><i className={styles.cherryTwo}/><i className={styles.cherryThree}/></div>
      </div>
      <div className={`${media.pulse} ${ready?media.ready:""}`} aria-hidden="true"/>
      <div className={media.words}><span>campo</span><span>prova</span><span>xícara</span></div>
      <div className={media.signature}><strong>Bispo</strong><span>José Rezende</span></div>
    </div>
  </div>
}
