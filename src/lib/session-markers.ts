// Recovery markers are optional. Answers and feedback never go into storage.
export function readSessionMarker(key: "ignite-stage" | "ignite-question") {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeSessionMarker(
  key: "ignite-stage" | "ignite-question",
  value: string,
) {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Continue in memory. */
  }
}
export function clearSessionMarkers() {
  for (const key of ["ignite-stage", "ignite-question"]) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      /* Still end authentication. */
    }
  }
}
