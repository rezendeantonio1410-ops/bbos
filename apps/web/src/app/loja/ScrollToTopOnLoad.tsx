"use client";

import { useEffect } from "react";

const PROVISIONAL_HERO = "https://images.unsplash.com/photo-1663551385068-dd078fd85888?auto=format&fit=crop&fm=jpg&q=82&w=1800";

export default function ScrollToTopOnLoad(){
  useEffect(()=>{
    if("scrollRestoration" in window.history){
      window.history.scrollRestoration="manual";
    }
    window.scrollTo({top:0,left:0,behavior:"auto"});
    requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:"auto"}));

    const applyHero = () => {
      const hero = document.querySelector('[data-photo-slot="hero-chemex-ceramic-nature"] img') as HTMLImageElement | null;
      if(hero){
        hero.src = PROVISIONAL_HERO;
        hero.style.objectFit = "cover";
        hero.style.objectPosition = "center center";
        hero.style.width = "100%";
        hero.style.height = "100%";
      }
    };

    applyHero();
    requestAnimationFrame(applyHero);
    const timer = window.setTimeout(applyHero, 250);
    return () => window.clearTimeout(timer);
  },[]);

  return null;
}
