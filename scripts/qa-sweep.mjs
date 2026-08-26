#!/usr/bin/env node
/**
 * Frozen camera sweep of named ?shot= views.
 * Writes PNGs + a luminance report to qa/out (gitignored).
 * Fails the process if a canvas is black / empty so CI catches WebGL death.
 *
 * QA_GL=auto (default) uses NVIDIA when nvidia-smi is present, else SwiftShader.
 * QA_GL=gpu requires hardware WebGL (the 2070 Super runner).
 * QA_GL=swiftshader forces software GL.
 */
import { spawn, execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream, existsSync } from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

export const SHOTS = [
  "home-wide",
  "home-shore",
  "house",
  "cottage",
  "boat",
  "coral-front",
  "palm-shore",
  "pebble-door",
  "reef",
  "harbor",
  "meadow",
  "lookout",
  "night-shore",
];

const PORT = Number(process.env.QA_PORT || 4173);
const BASE = (process.env.QA_BASE || `http://127.0.0.1:${PORT}`).replace(/\/$/, "");
const OUT = process.env.QA_OUT || "qa/out";
const START_PREVIEW = process.env.QA_BASE ? false : process.env.QA_NO_PREVIEW !== "1";
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|microsoft basic render|gdi generic|mesa offscreen/i;

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForOk(url, timeoutMs = 90000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: "manual" });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await wait(300);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function startPreview() {
  const log = createWriteStream(path.join(OUT, "preview.log"));
  const bin = path.join(process.cwd(), "node_modules", ".bin", "vite");
  const child = spawn(bin, ["preview", "--host", "127.0.0.1", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, BROWSER: "none" },
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  return child;
}

function nvidiaSmiList() {
  const bins = ["nvidia-smi"];
  if (process.platform === "win32") {
    bins.push("C:\\Windows\\System32\\nvidia-smi.exe");
    bins.push("C:\\Program Files\\NVIDIA Corporation\\NVSMI\\nvidia-smi.exe");
  } else {
    bins.push("/usr/bin/nvidia-smi");
  }
  for (const bin of bins) {
    try {
      if (bin !== "nvidia-smi" && !existsSync(bin)) continue;
      return execFileSync(bin, ["-L"], { encoding: "utf8", timeout: 8000 }).trim();
    } catch {
      /* try next */
    }
  }
  return null;
}

function glMode() {
  const forced = (process.env.QA_GL || "auto").toLowerCase();
  if (forced === "gpu" || forced === "swiftshader") return forced;
  // NVIDIA box, or a Mac with Metal. Linux cloud VMs stay on SwiftShader.
  if (nvidiaSmiList()) return "gpu";
  if (process.platform === "darwin") return "gpu";
  return "swiftshader";
}

function softwareArgs() {
  return ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"];
}

function hardwareArgs() {
  const args = [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--ignore-gpu-blocklist",
    "--enable-webgl",
    "--enable-webgl2",
    "--enable-gpu",
    "--enable-gpu-rasterization",
    "--in-process-gpu",
    "--disable-gpu-sandbox",
  ];
  if (process.platform === "linux") {
    args.push(
      "--use-gl=angle",
      "--use-angle=vulkan",
      "--enable-features=Vulkan",
      "--disable-vulkan-surface",
    );
  } else if (process.platform === "win32") {
    args.push("--use-gl=angle", "--use-angle=d3d11");
  } else {
    args.push("--use-gl=angle", "--use-angle=metal");
  }
  return args;
}

function launchOptions(mode) {
  if (mode === "swiftshader") {
    return { headless: true, args: softwareArgs() };
  }
  return {
    // Full Chromium, new headless — the headless shell cannot use an NVIDIA GPU.
    channel: process.env.QA_CHANNEL || "chromium",
    headless: true,
    args: hardwareArgs(),
  };
}

async function probeGpu(browser) {
  const page = await browser.newPage();
  try {
    return await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      const attrs = { failIfMajorPerformanceCaveat: true };
      const hw = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
      const any = hw || canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!any) return { webgl: false, hardware: false, vendor: "", renderer: "" };
      const ext = any.getExtension("WEBGL_debug_renderer_info");
      return {
        webgl: true,
        webgl2: any instanceof WebGL2RenderingContext,
        hardware: !!hw,
        vendor: ext ? String(any.getParameter(ext.UNMASKED_VENDOR_WEBGL)) : String(any.getParameter(any.VENDOR)),
        renderer: ext
          ? String(any.getParameter(ext.UNMASKED_RENDERER_WEBGL))
          : String(any.getParameter(any.RENDERER)),
      };
    });
  } finally {
    await page.close();
  }
}

function isSoftwareGl(info) {
  if (!info?.webgl) return true;
  if (!info.hardware) return true;
  return SOFTWARE_RENDERER.test(`${info.vendor} ${info.renderer}`);
}

async function canvasMean(page) {
  return page.evaluate(() => {
    const src = document.querySelector("#game-canvas");
    if (!(src instanceof HTMLCanvasElement) || src.width < 8) return 0;
    const tmp = document.createElement("canvas");
    tmp.width = 16;
    tmp.height = 16;
    const ctx = tmp.getContext("2d");
    if (!ctx) return 0;
    ctx.drawImage(src, 0, 0, 16, 16);
    const data = ctx.getImageData(0, 0, 16, 16).data;
    let sum = 0;
    for (let i = 0; i < data.length; i += 4) sum += data[i] + data[i + 1] + data[i + 2];
    return sum / (16 * 16 * 3);
  });
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const mode = glMode();
  const gpus = nvidiaSmiList();
  console.log(`QA_GL=${mode}${gpus ? `\n${gpus}` : ""}`);

  let preview = null;
  if (START_PREVIEW) preview = startPreview();
  try {
    await waitForOk(BASE);
    const options = launchOptions(mode);
    const browser = await chromium.launch(options);
    const gpu = await probeGpu(browser);
    console.log(
      `WebGL vendor=${gpu.vendor || "none"} renderer=${gpu.renderer || "none"} hardware=${!!gpu.hardware}`,
    );
    if (mode === "gpu" && isSoftwareGl(gpu)) {
      await browser.close();
      throw new Error(
        `Wanted NVIDIA hardware WebGL on this runner, got ${JSON.stringify(gpu)}. ` +
          `Chromium is still on software GL — check drivers, and that the runner user can see the 2070 Super.`,
      );
    }
    const report = [];
    let failed = 0;
    for (const shot of SHOTS) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const url = `${BASE}/?shot=${encodeURIComponent(shot)}`;
      const row = { shot, url, ok: false, mean: 0, error: null };
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
        await page.waitForFunction(() => window.__tibuReady === true, null, { timeout: 20000 });
        await wait(250);
        row.mean = await canvasMean(page);
        const file = path.join(OUT, `${shot}.png`);
        await page.screenshot({ path: file, type: "png" });
        row.ok = row.mean >= 14;
        if (!row.ok) {
          row.error = `canvas too dark (mean ${row.mean.toFixed(1)}) — WebGL likely failed`;
          failed++;
        }
      } catch (err) {
        row.error = err instanceof Error ? err.message : String(err);
        failed++;
        try {
          await page.screenshot({ path: path.join(OUT, `${shot}.png`), type: "png" });
        } catch {
          /* page may already be dead */
        }
      }
      report.push(row);
      await page.close();
      const mark = row.ok ? "ok" : "FAIL";
      console.log(`${mark.padEnd(4)} ${shot.padEnd(14)} mean=${row.mean.toFixed(1)}${row.error ? `  ${row.error}` : ""}`);
    }
    await browser.close();
    await writeFile(
      path.join(OUT, "report.json"),
      JSON.stringify({ base: BASE, gl: mode, gpus, gpu, failed, report }, null, 2),
    );
    if (failed) {
      console.error(`\n${failed} shot(s) failed. PNGs are in ${OUT}/`);
      process.exitCode = 1;
    } else {
      console.log(`\n${SHOTS.length} shots wrote to ${OUT}/`);
    }
  } finally {
    if (preview && preview.pid) {
      try {
        process.kill(preview.pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
