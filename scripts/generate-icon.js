#!/usr/bin/env node
/**
 * Generates icon PNG files from build/icon.svg using Playwright.
 * Outputs: build/icon.png (1024x1024), build/icon-512.png (512x512)
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');
const SVG_PATH = path.join(ROOT, 'build', 'icon.svg');
const PNG_1024 = path.join(ROOT, 'build', 'icon.png');

async function main() {
  const svgContent = fs.readFileSync(SVG_PATH, 'utf8');

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; }
  html, body { width: 1024px; height: 1024px; background: transparent; overflow: hidden; }
  svg { display: block; }
</style>
</head>
<body>${svgContent.replace(/width="512" height="512"/, 'width="1024" height="1024"')}</body>
</html>`;

  const htmlPath = path.join(ROOT, 'build', '_icon_render.html');
  fs.writeFileSync(htmlPath, html);

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1024, height: 1024 });
  await page.goto(`file://${htmlPath}`);
  await page.waitForTimeout(300); // let filters render

  await page.screenshot({
    path: PNG_1024,
    clip: { x: 0, y: 0, width: 1024, height: 1024 },
    omitBackground: true,
  });

  await browser.close();
  fs.unlinkSync(htmlPath);

  console.log(`✓ Written ${PNG_1024}`);
}

main().catch(e => { console.error(e); process.exit(1); });
