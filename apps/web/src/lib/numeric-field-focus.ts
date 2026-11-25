/**
 * Touch-friendly number fields. On a phone or tablet it is hard to place the
 * cursor and erase "1" or "0,00" before typing. Like SAP and Excel, a numeric
 * field selects its whole content when it gains focus, so the first digit
 * typed replaces the old value.
 */
export function isNumericField(element: EventTarget | null): element is HTMLInputElement {
  if (!element || typeof (element as HTMLElement).tagName !== "string") return false;
  const input = element as HTMLInputElement;
  if (input.tagName !== "INPUT" || input.readOnly || input.disabled) return false;
  if (input.dataset.keepCursor !== undefined) return false;
  const type = (input.getAttribute("type") ?? "text").toLowerCase();
  if (type === "number") return true;
  const mode = (input.getAttribute("inputmode") ?? "").toLowerCase();
  return (type === "text" || type === "tel") && (mode === "numeric" || mode === "decimal");
}

export function selectNumericFieldOnFocus(event: Event) {
  const target = event.target;
  if (!isNumericField(target) || !target.value) return;
  // Safari (iPad/iPhone) clears a selection made inside the focus event;
  // selecting on the next tick keeps it.
  setTimeout(() => {
    if (target.ownerDocument.activeElement !== target) return;
    try {
      target.select();
    } catch {
      /* some browsers refuse selection on number inputs; harmless */
    }
  }, 0);
}

/** Installs the behavior once for the whole document; returns the cleanup. */
export function installNumericFieldFocus(root: Document = document) {
  root.addEventListener("focusin", selectNumericFieldOnFocus);
  return () => root.removeEventListener("focusin", selectNumericFieldOnFocus);
}
