"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";
import {
  CONSENT_KEY,
  GA_MEASUREMENT_ID,
  GOOGLE_ADS_ID,
  META_PIXEL_ID,
  analyticsConfigured,
} from "@/lib/storefront-analytics";
import styles from "./storefront-analytics.module.css";

type Choice = "accepted" | "declined" | null;

/** Cookie notice (LGPD) + Meta Pixel / Google tags, loaded only after "Aceitar". */
export default function StorefrontAnalytics() {
  const [choice, setChoice] = useState<Choice>("declined");

  useEffect(() => {
    try {
      setChoice((localStorage.getItem(CONSENT_KEY) as Choice) ?? null);
    } catch {
      setChoice(null);
    }
  }, []);

  if (!analyticsConfigured()) return null;

  const decide = (value: "accepted" | "declined") => {
    try {
      localStorage.setItem(CONSENT_KEY, value);
    } catch {}
    setChoice(value);
  };

  const googleId = GA_MEASUREMENT_ID || GOOGLE_ADS_ID;

  return (
    <>
      {choice === "accepted" && META_PIXEL_ID && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
        </Script>
      )}
      {choice === "accepted" && googleId && (
        <>
          <Script
            id="google-tag"
            src={`https://www.googletagmanager.com/gtag/js?id=${googleId}`}
            strategy="afterInteractive"
          />
          <Script id="google-tag-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());${GA_MEASUREMENT_ID ? `gtag('config','${GA_MEASUREMENT_ID}');` : ""}${GOOGLE_ADS_ID ? `gtag('config','${GOOGLE_ADS_ID}');` : ""}`}
          </Script>
        </>
      )}
      {choice === null && (
        <div className={styles.banner} role="dialog" aria-label="Cookies">
          <p>
            Usamos cookies para medir visitas e anúncios e melhorar a loja.{" "}
            <Link href="/aviso-privacidade">Saiba mais</Link>
          </p>
          <div>
            <button type="button" onClick={() => decide("declined")}>
              Recusar
            </button>
            <button type="button" data-primary onClick={() => decide("accepted")}>
              Aceitar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
