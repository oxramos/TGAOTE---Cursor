#!/usr/bin/env node
/**
 * Frozen camera sweep of named ?shot= views.
 * Writes PNGs + a luminance report to qa/out (gitignored).
 * Fails the process if a canvas is black / empty so CI catches WebGL death.
 */
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { createWriteStream } from "node:fs";
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
  let preview = null;
  if (START_PREVIEW) preview = startPreview();
  try {
    await waitForOk(BASE);
    const browser = await chromium.launch({
      headless: true,
      args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"],
    });
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
    await writeFile(path.join(OUT, "report.json"), JSON.stringify({ base: BASE, failed, report }, null, 2));
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
