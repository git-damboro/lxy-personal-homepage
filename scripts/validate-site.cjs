const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer-core");

const base = process.env.PREVIEW_URL || "http://127.0.0.1:4321";
const chrome = process.env.PREVIEW_CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const output = path.resolve(__dirname, "../screenshots");
const routes = [
  { path: "/", page: "home", count: [".experience-link", 4] },
  { path: "/work", page: "work", count: [".case-study", 7] },
  { path: "/notes", page: "notes", count: [".note-article", 3] },
  { path: "/about", page: "about", count: [".method-list article", 4] },
];
const viewports = [
  { width: 1440, height: 900 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
  { width: 320, height: 844 },
];

async function settle(page) {
  await page.evaluate(() => Promise.race([
    document.fonts.ready,
    new Promise(resolve => setTimeout(resolve, 2500)),
  ]));
  await page.evaluate(async () => {
    for (const target of document.querySelectorAll("[data-reveal]")) {
      target.scrollIntoView({ behavior: "instant", block: "center" });
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }
    scrollTo({ top: 0, behavior: "instant" });
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

async function inspect(page, route, viewport) {
  const result = await page.evaluate(({ expectedPage, countSelector }) => {
    const visible = element => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    };
    const header = document.querySelector(".header");
    const activeNav = document.querySelector('.header nav a[aria-current="page"]');
    const revealTargets = [...document.querySelectorAll("[data-reveal]")];
    return {
      page: document.body.dataset.page,
      title: document.title,
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      headerRight: header?.getBoundingClientRect().right,
      activeHref: activeNav?.getAttribute("href"),
      count: document.querySelectorAll(countSelector).length,
      emptyLinks: [...document.querySelectorAll("a")].filter(link => !link.getAttribute("href") || link.getAttribute("href") === "#").length,
      hiddenRevealText: revealTargets.filter(element => visible(element) && Number(getComputedStyle(element).opacity) === 0).length,
      bodyText: document.body.textContent || "",
      heroBottom: document.querySelector(".hero-band")?.getBoundingClientRect().bottom || null,
      selectedWorkTop: document.querySelector(".selected-work-band")?.getBoundingClientRect().top || null,
      internships: [...document.querySelectorAll(".experience-link")].map(link => link.textContent?.trim() || ""),
      companySourceLinks: document.querySelectorAll('[data-company="bytedance"] a[href*="github.com"]').length,
    };
  }, { expectedPage: route.page, countSelector: route.count[0] });

  assert.equal(result.page, route.page, `Wrong page marker for ${route.path}`);
  assert.equal(result.width, viewport.width);
  assert(result.scrollWidth <= viewport.width, `Horizontal overflow on ${route.path} at ${viewport.width}px`);
  assert(result.headerRight <= viewport.width + 0.5, `Header overflow on ${route.path} at ${viewport.width}px`);
  assert.equal(result.activeHref, route.path);
  assert.equal(result.count, route.count[1]);
  assert.equal(result.emptyLinks, 0);
  assert.equal(result.hiddenRevealText, 0, `Visible content remained hidden on ${route.path}`);
  assert(!/100%|字段召回|Recall/.test(result.bodyText), "Unscoped recall claim is public");

  if (route.path === "/") {
    assert.deepEqual(result.internships.map(text => text.match(/字节跳动|蔚来|上海蕴万|上海艺栢/)?.[0]), ["字节跳动", "蔚来", "上海蕴万", "上海艺栢"]);
    assert(result.selectedWorkTop <= viewport.height - 12, `Next section hint is outside the first viewport at ${viewport.width}px`);
  }
  if (route.path === "/work") assert.equal(result.companySourceLinks, 0);
  return result;
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
  const report = [];
  try {
    for (const viewport of viewports) {
      for (const route of routes) {
        const page = await browser.newPage();
        const pageErrors = [];
        page.on("pageerror", error => pageErrors.push(error.message));
        await page.setViewport(viewport);
        await page.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded" });
        await settle(page);
        const result = await inspect(page, route, viewport);
        assert.deepEqual(pageErrors, [], `Page errors on ${route.path}`);
        if ((viewport.width === 1440 || viewport.width === 390)) {
          const name = route.page === "home" ? "home" : route.page;
          await page.screenshot({ path: path.join(output, `${name}-${viewport.width}.png`), fullPage: true });
          await page.screenshot({ path: path.join(output, `${name}-${viewport.width}-top.png`) });
        }
        report.push({ route: route.path, viewport, ...result });
        await page.close();
      }
    }

    const motionPage = await browser.newPage();
    await motionPage.setViewport({ width: 1440, height: 900 });
    await motionPage.goto(base, { waitUntil: "domcontentloaded" });
    const motion = await motionPage.evaluate(() => ({
      hero: getComputedStyle(document.querySelector(".hero-reveal")).animationDuration,
      section: getComputedStyle(document.querySelector("[data-reveal]")).transitionDuration,
    }));
    assert.equal(motion.hero, "0.45s");
    assert(motion.section.includes("0.32s"));
    await motionPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
    const reduced = await motionPage.evaluate(() => ({
      hero: parseFloat(getComputedStyle(document.querySelector(".hero-reveal")).animationDuration),
      section: parseFloat(getComputedStyle(document.querySelector("[data-reveal]")).transitionDuration),
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
    }));
    assert(reduced.hero <= 0.001);
    assert(reduced.section === 0);
    assert.equal(reduced.scroll, "auto");

    await motionPage.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
    await motionPage.click('.header nav a[href="/work"]');
    await motionPage.waitForFunction(() => location.pathname === "/work");
    assert.equal(await motionPage.$eval('.header nav a[aria-current="page"]', link => link.getAttribute("href")), "/work");
    report.push({ motion, reducedMotion: reduced, clientNavigation: "home -> work" });
    await motionPage.close();

    const noScript = await browser.newPage();
    await noScript.setJavaScriptEnabled(false);
    await noScript.setViewport({ width: 390, height: 844 });
    for (const route of routes) {
      await noScript.goto(`${base}${route.path}`, { waitUntil: "domcontentloaded" });
      const state = await noScript.evaluate(() => ({
        textLength: document.querySelector("main")?.textContent?.trim().length || 0,
        opacity: getComputedStyle(document.querySelector("main section")).opacity,
      }));
      assert(state.textLength > 250, `No-JS content missing on ${route.path}`);
      assert.equal(state.opacity, "1");
    }
    const privatePath = await noScript.goto(`${base}/research/design-brief.md`);
    assert.equal(privatePath.status(), 404);
    report.push({ javascriptDisabled: routes.map(route => route.path), privatePaths: "404" });
    await noScript.close();

    await fs.writeFile(path.join(output, "site-validation.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({
      routes: routes.length,
      viewports: viewports.length,
      screenshots: 8,
      noJavaScript: true,
      reducedMotion: true,
      clientNavigation: true,
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
