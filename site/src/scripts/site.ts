import { initializeHomeMode } from "./story-home";

let cleanupPage: (() => void) | undefined;

function markCurrent(links: HTMLAnchorElement[], id: string) {
  links.forEach(link => {
    if (link.dataset.caseNav === id) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function initializePage() {
  cleanupPage?.();

  const cleanups: Array<() => void> = [];
  cleanups.push(initializeHomeMode());
  const progress = document.querySelector<HTMLElement>(".reading-progress");
  const caseNavigation = Array.from(document.querySelectorAll<HTMLAnchorElement>("[data-case-nav]"));
  const indexedSections = caseNavigation
    .map(link => document.getElementById(link.dataset.caseNav || ""))
    .filter((section): section is HTMLElement => section instanceof HTMLElement);

  let frameRequested = false;
  const updateProgress = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) {
      const ratio = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
      progress.style.transform = `scaleX(${ratio})`;
    }
    const active = indexedSections.filter(section => section.getBoundingClientRect().top <= 180).at(-1);
    markCurrent(caseNavigation, active?.id || "");
    frameRequested = false;
  };
  const requestProgress = () => {
    if (frameRequested) return;
    frameRequested = true;
    requestAnimationFrame(updateProgress);
  };

  addEventListener("scroll", requestProgress, { passive: true });
  addEventListener("resize", requestProgress);
  cleanups.push(() => {
    removeEventListener("scroll", requestProgress);
    removeEventListener("resize", requestProgress);
  });
  updateProgress();

  const revealTargets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    }, { rootMargin: "0px 0px -9% 0px", threshold: 0.08 });
    revealTargets.forEach(target => observer.observe(target));
    document.documentElement.classList.add("reveal-ready");
    cleanups.push(() => observer.disconnect());
  } else {
    revealTargets.forEach(target => target.classList.add("is-visible"));
  }

  const copyButton = document.querySelector<HTMLButtonElement>("[data-copy-email]");
  const copyStatus = document.querySelector<HTMLElement>(".copy-status");
  let copyTimer: ReturnType<typeof setTimeout> | undefined;
  if (copyButton && copyStatus) {
    copyButton.hidden = false;
    const copyEmail = async () => {
      try {
        await navigator.clipboard.writeText(copyButton.dataset.copyEmail || "");
        copyButton.textContent = "已复制";
        copyStatus.textContent = "邮箱已复制到剪贴板。";
      } catch {
        copyStatus.textContent = "未能访问剪贴板，请选中上方邮箱复制。";
      }
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => {
        copyButton.textContent = "复制邮箱";
        copyStatus.textContent = "";
      }, 3000);
    };
    copyButton.addEventListener("click", copyEmail);
    cleanups.push(() => {
      copyButton.removeEventListener("click", copyEmail);
      clearTimeout(copyTimer);
    });
  }

  const printButton = document.querySelector<HTMLButtonElement>("[data-print-page]");
  if (printButton) {
    printButton.hidden = false;
    const printPage = () => window.print();
    printButton.addEventListener("click", printPage);
    cleanups.push(() => printButton.removeEventListener("click", printPage));
  }

  cleanupPage = () => {
    cleanups.forEach(cleanup => cleanup());
    document.documentElement.classList.remove("reveal-ready");
  };
}

document.addEventListener("astro:page-load", initializePage);
initializePage();
