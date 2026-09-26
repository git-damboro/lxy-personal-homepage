type HomeMode = "archive" | "story";

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function initializeTokenLedger(root: HTMLElement) {
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-token-source]"));
  const ledger = root.querySelector<HTMLElement>(".token-ledger");
  const unit = root.querySelector<HTMLElement>("[data-token-unit]");
  const status = root.querySelector<HTMLElement>("[data-token-status]");
  const description = root.querySelector<HTMLElement>("[data-token-description]");
  const selected = root.querySelector<HTMLElement>("[data-token-selected]");
  const visibility = root.querySelector<HTMLElement>("[data-token-visibility]");
  if (!buttons.length || !ledger) return () => {};

  const selectSource = (button: HTMLButtonElement) => {
    buttons.forEach(item => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-pressed", String(active));
    });
    ledger.dataset.tokenActive = button.dataset.tokenSource || "";
    if (unit) unit.textContent = button.dataset.unit || "";
    if (status) status.textContent = button.dataset.status || "";
    if (description) description.textContent = button.dataset.description || "";
    if (selected) selected.textContent = button.dataset.name || "";
    if (visibility) visibility.textContent = button.dataset.visibility || "";
    ledger.classList.remove("source-changed");
    requestAnimationFrame(() => ledger.classList.add("source-changed"));
  };

  const listeners = buttons.map(button => {
    const listener = () => selectSource(button);
    button.addEventListener("click", listener);
    return { button, listener };
  });
  selectSource(buttons[0]);

  return () => listeners.forEach(({ button, listener }) => button.removeEventListener("click", listener));
}

export function initializeHomeMode() {
  const switcher = document.querySelector<HTMLElement>("[data-home-mode-switch]");
  const surfaces = Array.from(document.querySelectorAll<HTMLElement>("[data-home-surface]"));
  const storyRoot = document.querySelector<HTMLElement>(".story-home");
  if (!switcher || surfaces.length !== 2 || !storyRoot) return () => {};

  const buttons = Array.from(switcher.querySelectorAll<HTMLButtonElement>("[data-home-mode]"));
  const status = switcher.querySelector<HTMLElement>(".mode-switch-status");
  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const initialMode = document.documentElement.dataset.homeMode === "story" ? "story" : "archive";

  const applyMode = (mode: HomeMode, announce = false) => {
    document.documentElement.dataset.homeMode = mode;
    surfaces.forEach(surface => {
      const active = surface.dataset.homeSurface === mode;
      surface.setAttribute("aria-hidden", String(!active));
      surface.inert = !active;
    });
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.homeMode === mode)));
    if (theme) theme.content = mode === "story" ? "#eef7f4" : "#f8fafc";
    if (announce && status) status.textContent = mode === "story" ? "已切换到叙事模式" : "已切换到档案模式";
    try { localStorage.setItem("lxy-home-mode", mode); } catch {}
  };

  const onModeClick = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const mode = button.dataset.homeMode as HomeMode;
    if (mode === document.documentElement.dataset.homeMode) return;
    const commit = () => applyMode(mode, true);
    const transitionDocument = document as TransitionDocument;
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches && transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(commit);
    } else {
      commit();
    }
  };

  buttons.forEach(button => button.addEventListener("click", onModeClick));
  applyMode(initialMode);
  const cleanupLedger = initializeTokenLedger(storyRoot);

  return () => {
    buttons.forEach(button => button.removeEventListener("click", onModeClick));
    cleanupLedger();
  };
}
