"use client";

import { useEffect } from "react";
import { installNumericFieldFocus } from "@/lib/numeric-field-focus";

/** Mounted once in the root layout: every number field selects its value on tap. */
export function NumericFieldFocus() {
  useEffect(() => installNumericFieldFocus(), []);
  return null;
}
