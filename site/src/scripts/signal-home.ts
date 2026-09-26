type HomeMode = "archive" | "signal";

type TransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

function initializeSignalCanvas(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>("[data-signal-canvas]");
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-signal-node]"));
  const state = root.querySelector<HTMLElement>("[data-signal-state]");
  const detailTitle = root.querySelector<HTMLElement>("[data-signal-detail-title]");
  const detailStatement = root.querySelector<HTMLElement>("[data-signal-detail-statement]");
  const detailEvidence = root.querySelector<HTMLElement>("[data-signal-detail-evidence]");
  const detailLink = root.querySelector<HTMLAnchorElement>("[data-signal-detail-link]");
  if (!canvas || !buttons.length) return () => {};

  const context = canvas.getContext("2d");
  if (!context) return () => {};

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let activeIndex = 0;
  let width = 0;
  let height = 0;
  let frame = 0;
  let running = false;
  let pointer = { x: -1000, y: -1000 };

  const coordinates = () => {
    if (width < 640) {
      return [
        { x: .16, y: .24 },
        { x: .48, y: .13 },
        { x: .81, y: .31 },
        { x: .68, y: .68 },
        { x: .28, y: .78 },
      ];
    }
    return [
      { x: .15, y: .30 },
      { x: .43, y: .15 },
      { x: .78, y: .28 },
      { x: .70, y: .69 },
      { x: .29, y: .78 },
    ];
  };

  const setActive = (index: number) => {
    activeIndex = Math.max(0, Math.min(buttons.length - 1, index));
    buttons.forEach((button, buttonIndex) => {
      const active = buttonIndex === activeIndex;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    const selected = buttons[activeIndex];
    if (state) state.textContent = `ACTIVE / C${activeIndex + 1}`;
    if (detailTitle) detailTitle.textContent = selected.dataset.title || "";
    if (detailStatement) detailStatement.textContent = selected.dataset.statement || "";
    if (detailEvidence) detailEvidence.textContent = selected.dataset.evidence || "";
    if (detailLink) detailLink.href = selected.dataset.href || "/";
    draw(performance.now());
  };

  const draw = (time: number) => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const points = coordinates().map((point, index) => ({
      x: point.x * width,
      y: point.y * height,
      label: `C${index + 1}`,
    }));
    const links = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [1, 3], [0, 3]];

    context.lineWidth = 1;
    links.forEach(([from, to], linkIndex) => {
      const start = points[from];
      const end = points[to];
      const active = from === activeIndex || to === activeIndex;
      context.strokeStyle = active ? "rgba(72, 139, 255, .72)" : "rgba(116, 139, 174, .22)";
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.lineTo(end.x, end.y);
      context.stroke();

      if (!reduceMotion.matches && active) {
        const progress = ((time / 1250) + linkIndex * .19) % 1;
        const x = start.x + (end.x - start.x) * progress;
        const y = start.y + (end.y - start.y) * progress;
        context.fillStyle = "#d8ff63";
        context.beginPath();
        context.arc(x, y, 2.2, 0, Math.PI * 2);
        context.fill();
      }
    });

    points.forEach((point, index) => {
      const selected = index === activeIndex;
      const nearPointer = Math.hypot(pointer.x - point.x, pointer.y - point.y) < 58;
      const pulse = reduceMotion.matches ? 0 : (Math.sin(time / 520 + index) + 1) * 2;

      context.fillStyle = selected ? "rgba(40, 95, 211, .20)" : "rgba(216, 255, 99, .05)";
      context.beginPath();
      context.arc(point.x, point.y, (selected ? 22 : 13) + pulse, 0, Math.PI * 2);
      context.fill();

      context.lineWidth = selected || nearPointer ? 2 : 1;
      context.strokeStyle = selected ? "#d8ff63" : nearPointer ? "#69a1ff" : "rgba(169, 187, 214, .65)";
      context.beginPath();
      context.arc(point.x, point.y, selected ? 10 : 7, 0, Math.PI * 2);
      context.stroke();

      context.fillStyle = selected ? "#d8ff63" : "#dfe7f4";
      context.font = '500 10px "IBM Plex Mono", monospace';
      context.textAlign = "center";
      context.fillText(point.label, point.x, point.y - 22);
    });
  };

  const animate = (time: number) => {
    draw(time);
    if (running) frame = requestAnimationFrame(animate);
  };

  const syncAnimation = () => {
    running = document.documentElement.dataset.homeMode === "signal" && !reduceMotion.matches;
    cancelAnimationFrame(frame);
    if (running) frame = requestAnimationFrame(animate);
    else draw(performance.now());
  };

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    width = rect.width;
    height = rect.height;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    draw(performance.now());
  };

  const activateFromButton = (event: Event) => {
    const button = event.currentTarget as HTMLButtonElement;
    setActive(Number(button.dataset.signalNode || 0));
  };
  buttons.forEach(button => {
    button.addEventListener("click", activateFromButton);
    button.addEventListener("focus", activateFromButton);
    button.addEventListener("pointerenter", activateFromButton);
  });

  const onPointerMove = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const points = coordinates();
    let nearest = activeIndex;
    let distance = 72;
    points.forEach((point, index) => {
      const nextDistance = Math.hypot(pointer.x - point.x * width, pointer.y - point.y * height);
      if (nextDistance < distance) {
        nearest = index;
        distance = nextDistance;
      }
    });
    if (nearest !== activeIndex) setActive(nearest);
  };
  const onPointerLeave = () => {
    pointer = { x: -1000, y: -1000 };
  };
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerleave", onPointerLeave);

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  const onModeChange = () => syncAnimation();
  addEventListener("home-mode-change", onModeChange);
  reduceMotion.addEventListener("change", syncAnimation);
  resize();
  setActive(0);
  syncAnimation();

  return () => {
    running = false;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    canvas.removeEventListener("pointermove", onPointerMove);
    canvas.removeEventListener("pointerleave", onPointerLeave);
    buttons.forEach(button => {
      button.removeEventListener("click", activateFromButton);
      button.removeEventListener("focus", activateFromButton);
      button.removeEventListener("pointerenter", activateFromButton);
    });
    removeEventListener("home-mode-change", onModeChange);
    reduceMotion.removeEventListener("change", syncAnimation);
  };
}

export function initializeHomeMode() {
  const switcher = document.querySelector<HTMLElement>("[data-home-mode-switch]");
  const surfaces = Array.from(document.querySelectorAll<HTMLElement>("[data-home-surface]"));
  const signalRoot = document.querySelector<HTMLElement>(".signal-home");
  if (!switcher || surfaces.length !== 2 || !signalRoot) return () => {};

  const buttons = Array.from(switcher.querySelectorAll<HTMLButtonElement>("[data-home-mode]"));
  const status = switcher.querySelector<HTMLElement>(".mode-switch-status");
  const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  const initialMode = document.documentElement.dataset.homeMode === "signal" ? "signal" : "archive";

  const applyMode = (mode: HomeMode, announce = false) => {
    document.documentElement.dataset.homeMode = mode;
    surfaces.forEach(surface => {
      const active = surface.dataset.homeSurface === mode;
      surface.setAttribute("aria-hidden", String(!active));
      surface.inert = !active;
    });
    buttons.forEach(button => button.setAttribute("aria-pressed", String(button.dataset.homeMode === mode)));
    if (theme) theme.content = mode === "signal" ? "#171c24" : "#f8fafc";
    if (announce && status) status.textContent = mode === "signal" ? "已切换到信号模式" : "已切换到档案模式";
    try { localStorage.setItem("lxy-home-mode", mode); } catch {}
    dispatchEvent(new CustomEvent("home-mode-change", { detail: { mode } }));
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
  const cleanupCanvas = initializeSignalCanvas(signalRoot);

  return () => {
    buttons.forEach(button => button.removeEventListener("click", onModeClick));
    cleanupCanvas();
  };
}
