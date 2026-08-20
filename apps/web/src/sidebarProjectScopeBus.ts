// Lets project-selection flows keep the sidebar focused on the project where
// they create a thread without coupling those flows to Sidebar's local state.
const SIDEBAR_PROJECT_SCOPE_EVENT = "t3code:select-sidebar-project-scope";

export function selectSidebarProjectScope(projectKey: string): void {
  window.dispatchEvent(
    new CustomEvent<string>(SIDEBAR_PROJECT_SCOPE_EVENT, { detail: projectKey }),
  );
}

export function onSidebarProjectScope(listener: (projectKey: string) => void): () => void {
  const handler = (event: Event) => listener((event as CustomEvent<string>).detail);
  window.addEventListener(SIDEBAR_PROJECT_SCOPE_EVENT, handler);
  return () => window.removeEventListener(SIDEBAR_PROJECT_SCOPE_EVENT, handler);
}
