"use client";

import { useEffect, useState } from "react";
import { FieldDay } from "@/components/field-day";
import { VisitsTabs } from "@/components/visits-tabs";
import { fetchSessionIdentity, getApiRoot } from "@/lib/auth-session";

export default function CampoPage() {
  const [firstName, setFirstName] = useState("");
  useEffect(() => {
    fetchSessionIdentity(getApiRoot(), { retryDelaysMs: [0] })
      .then((me) => setFirstName(me.name.split(" ")[0] ?? ""))
      .catch(() => undefined);
  }, []);
  return (
    <div className="px-4 py-4 sm:px-6">
      <VisitsTabs />
      <FieldDay firstName={firstName} />
    </div>
  );
}
