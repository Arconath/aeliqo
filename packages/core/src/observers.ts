/** Observers report committed work; their failures must never change its outcome. */
export function notifyObserver(notify: () => void): void {
  try {
    notify();
  } catch (error) {
    // Keep diagnostics visible, even though delivery to other observers continues.
    try { console.error("Aeliqo observer failed", error); } catch { /* A diagnostic sink cannot reject a commit either. */ }
  }
}
