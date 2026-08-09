const JUDE_CREATE_PROJECT_EVENT = "t3code:create-jude-project";

export function openCreateJudeProject(): void {
  window.dispatchEvent(new CustomEvent(JUDE_CREATE_PROJECT_EVENT));
}

export function onCreateJudeProject(listener: () => void): () => void {
  window.addEventListener(JUDE_CREATE_PROJECT_EVENT, listener);
  return () => window.removeEventListener(JUDE_CREATE_PROJECT_EVENT, listener);
}
