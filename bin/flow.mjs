#!/usr/bin/env node

/**
 * Google Flow CLI (Unified Image & Video Generator & Status Health Checker)
 * 
 * An automated, high-performance command-line tool for Google Flow.
 * 
 * Features:
 *  - Supports Image, Video generation & System Status (`flow image`, `flow video`, `flow status`)
 *  - Full parameter control (aspect ratio, candidate count, models, quality)
 *  - Direct generation by default (bypasses Agent approval flow)
 *  - Localized output (generates results directly in CWD `./downloads/` or `-o`)
 *  - Auto unzips batch archives and organizes media
 *  - Automatically inspects video streams (ffprobe) & extracts preview thumbnails
 *  - Headless Linux ready (auto Xvfb wrapping & Chrome lock clearing)
 *  - Comprehensive status inspection (auth, profile, browser, ffmpeg, quota)
 */

import { parseArgs } from 'node:util';
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Skip xvfb wrapper for help or quick status checks
const rawArgs = process.argv.slice(2);
const isHelp = rawArgs.includes('--help') || rawArgs.includes('-h');
const isQuickStatus = (rawArgs[0] === 'status' || rawArgs[0] === 'health') && rawArgs.includes('--quick');

// Auto-wrap with xvfb-run on headless Linux if DISPLAY is not present
if (!isHelp && !isQuickStatus && process.platform === 'linux' && !process.env.DISPLAY && !process.env.INSIDE_XVFB) {
  const result = spawnSync('xvfb-run', [
    '-a',
    '--server-args=-screen 0 1400x900x24 -ac',
    process.execPath,
    ...process.argv.slice(1)
  ], {
    stdio: 'inherit',
    env: { ...process.env, INSIDE_XVFB: '1' }
  });
  process.exit(result.status ?? 0);
}

const DEFAULT_PROFILE = process.env.FLOW_PROFILE_DIR || path.join(os.homedir(), '.google-flow-creator', 'browser-profile');
const DEFAULT_PROJECT_URL = process.env.FLOW_PROJECT_URL || 'https://flow.google.com/';

function printHelp() {
  console.log(`
Google Flow CLI
===============
Automated Image & Video Generation Tool for Google Flow.

Usage:
  flow <subcommand> [options]
  flow [options]

Subcommands:
  image                        Generate images (alias: flow-image)
  video                        Generate videos (alias: flow-video)
  status                       Check Google Flow authentication & system environment (alias: flow-status)

Options:
  -p, --prompt <string>        (Required for generation) Prompt describing the image or video
  -t, --type <image|video>     Generation mode (Default: 'image' or based on subcommand)
  -a, --aspect-ratio <ratio>   Aspect ratio:
                               • Image: '16:9', '4:3', '1:1', '3:4', '9:16' (Default: '16:9')
                               • Video: '16:9', '4:3', '1:1', '9:16', '10:16' (Default: '16:9')
  -c, --count <number>         Candidate count: 1, 2, 3, 4 (Default: 4 for image, 1 for video)
  -m, --model <name>           Model selection:
                               • Image: 'Nano Banana 2' (Default), 'Nano Banana Pro', 'Nano Banana 2 Lite'
                               • Video: 'Omni 1.1 Flash' / 'Gemini Omni Flash' (Default),
                                        'Veo 3.1 - Quality', 'Veo 3.1 - Fast', 'Veo 3.1 - Lite'
  -q, --quality <res>          Video quality/resolution: '720p' (Default), '360p', '1080p'
      --agent                  Enable Agent approval mode (Default: disabled / direct generation)
  -r, --reference <path>       Path to local reference image to attach
  -o, --output-dir <dir>       Directory to save results (Default: './downloads' in current directory)
  -u, --project-url <url>      Google Flow Project Canvas URL
      --timeout <seconds>      Maximum timeout in seconds (Default: 300 for image, 600 for video)
      --json                   Output status results in JSON format (status subcommand only)
      --quick                  Perform quick local-only status check without launching browser
  -h, --help                   Display this help message

Examples:
  # Check Google Flow environment & account login status
  flow status

  # Generate 4 candidate images (16:9)
  flow image -p "Cyberpunk rooftop garden at sunset, Makoto Shinkai style" -a 16:9 -c 4

  # Generate a cinematic video (8s HD)
  flow video -p "Cinematic drone shot soaring over mystical waterfalls in neon cyberpunk city, 4k" -a 16:9

  # Generate 1:1 avatar image directly in current directory
  flow image -p "Pixel art indie game dev chibi avatar" -a 1:1 -c 2 -o .
`);
}

function cleanChromeLocks(profileDir) {
  try {
    if (!fs.existsSync(profileDir)) return;
    const files = fs.readdirSync(profileDir);
    for (const file of files) {
      if (file.startsWith('Singleton') || file === 'DevToolsActivePort') {
        try {
          fs.unlinkSync(path.join(profileDir, file));
        } catch (e) {}
      }
    }
  } catch (e) {}
}

async function handleStatus(values) {
  const isJson = values.json;
  const isQuick = values.quick;

  // 1. Check Node.js
  const nodeVersion = process.version;

  // 2. Check Chrome
  const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome';
  let chromeVersion = 'Not found';
  let chromeOk = false;
  if (fs.existsSync(chromePath)) {
    const res = spawnSync(chromePath, ['--version'], { encoding: 'utf-8' });
    if (res.status === 0) {
      chromeVersion = res.stdout.trim();
      chromeOk = true;
    }
  }

  // 3. Check Xvfb
  let xvfbPath = null;
  const xvfbRes = spawnSync('which', ['xvfb-run'], { encoding: 'utf-8' });
  if (xvfbRes.status === 0) {
    xvfbPath = xvfbRes.stdout.trim();
  }

  // 4. Check FFmpeg & FFprobe
  let ffmpegVersion = 'Not found';
  let ffprobeVersion = 'Not found';
  const ffRes = spawnSync('ffmpeg', ['-version'], { encoding: 'utf-8' });
  if (ffRes.status === 0) {
    ffmpegVersion = ffRes.stdout.split('\n')[0];
  }
  const ffpRes = spawnSync('ffprobe', ['-version'], { encoding: 'utf-8' });
  if (ffpRes.status === 0) {
    ffprobeVersion = ffpRes.stdout.split('\n')[0];
  }

  // 5. Check Profile Directory
  const profileDir = DEFAULT_PROFILE;
  const profileExists = fs.existsSync(profileDir);
  let profileSizeMB = 0;
  if (profileExists) {
    const duRes = spawnSync('du', ['-sm', profileDir], { encoding: 'utf-8' });
    if (duRes.status === 0) {
      profileSizeMB = parseInt(duRes.stdout.split('\t')[0], 10) || 0;
    }
  }

  // 6. Check Local Downloads
  const cwdDownloads = path.resolve(process.cwd(), 'downloads');
  let recentJobs = [];
  if (fs.existsSync(cwdDownloads)) {
    try {
      recentJobs = fs.readdirSync(cwdDownloads)
        .filter(f => f.startsWith('flow_'))
        .sort().reverse().slice(0, 5);
    } catch (e) {}
  }

  // 7. Online Google Flow Inspection (unless --quick)
  let flowOnline = null;
  if (!isQuick && chromeOk) {
    cleanChromeLocks(profileDir);
    try {
      const context = await chromium.launchPersistentContext(profileDir, {
        executablePath: chromePath,
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--window-size=1400,900'
        ],
        viewport: { width: 1400, height: 900 },
        ignoreDefaultArgs: ['--enable-automation']
      });

      const page = context.pages()[0] || await context.newPage();
      await page.goto(DEFAULT_PROJECT_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(4000);

      flowOnline = await page.evaluate(() => {
        const url = window.location.href;
        const title = document.title;
        const text = document.body.innerText || '';
        const isAuth = !url.includes('accounts.google.com');
        const isPro = text.includes('PRO') || text.includes('Pro');
        const hasCanvas = !!document.querySelector('flow-prompt-box, .prompt-bar, .canvas-container, [contenteditable="true"]');
        return { url, title, isAuth, isPro, hasCanvas };
      });

      await context.close();
    } catch (err) {
      flowOnline = { error: err.message, isAuth: false };
    }
  }

  const resultData = {
    status: (chromeOk && profileExists && (!flowOnline || flowOnline.isAuth)) ? 'HEALTHY' : 'NEEDS_ATTENTION',
    environment: {
      node: nodeVersion,
      chrome: { path: chromePath, version: chromeVersion, ok: chromeOk },
      xvfb: { installed: !!xvfbPath, path: xvfbPath },
      ffmpeg: { installed: ffmpegVersion !== 'Not found', version: ffmpegVersion },
      ffprobe: { installed: ffprobeVersion !== 'Not found', version: ffprobeVersion }
    },
    profile: {
      path: profileDir,
      exists: profileExists,
      sizeMB: profileSizeMB
    },
    googleFlow: flowOnline ? {
      authenticated: flowOnline.isAuth,
      proTier: flowOnline.isPro,
      canvasReady: flowOnline.hasCanvas,
      activeUrl: flowOnline.url
    } : { checked: false, note: 'Skipped online check (use without --quick to verify)' },
    localWorkspace: {
      cwd: process.cwd(),
      downloadsDir: cwdDownloads,
      recentBatches: recentJobs
    }
  };

  if (isJson) {
    console.log(JSON.stringify(resultData, null, 2));
    return;
  }

  // Terminal Dashboard Formatter
  console.log('\n======================================================');
  console.log('            Google Flow CLI - System Status           ');
  console.log('======================================================');
  
  const statusColor = resultData.status === 'HEALTHY' ? '\x1b[32m● HEALTHY\x1b[0m' : '\x1b[33m▲ NEEDS ATTENTION\x1b[0m';
  console.log(`Overall Health:    ${statusColor}\n`);

  console.log('📦 System & Toolchains:');
  console.log(`  • Node.js:       ${nodeVersion}`);
  console.log(`  • Google Chrome: ${chromeOk ? `\x1b[32m✓\x1b[0m ${chromeVersion}` : '\x1b[31m✗ Not Installed / Not Found\x1b[0m'}`);
  console.log(`  • Xvfb Server:   ${xvfbPath ? `\x1b[32m✓\x1b[0m ${xvfbPath}` : '\x1b[33m▲ Missing (Required for headless Linux)\x1b[0m'}`);
  console.log(`  • FFmpeg:        ${ffmpegVersion !== 'Not found' ? `\x1b[32m✓\x1b[0m Ready (Video Encoding)` : '\x1b[33m▲ Missing\x1b[0m'}`);
  console.log(`  • FFprobe:       ${ffprobeVersion !== 'Not found' ? `\x1b[32m✓\x1b[0m Ready (Stream Analysis)` : '\x1b[33m▲ Missing\x1b[0m'}`);

  console.log('\n👤 Google Flow Profile:');
  console.log(`  • Profile Path:  ${profileDir}`);
  console.log(`  • Status:        ${profileExists ? `\x1b[32m✓\x1b[0m Active (${profileSizeMB} MB)` : '\x1b[31m✗ Profile Directory Missing\x1b[0m'}`);

  if (flowOnline) {
    console.log('\n🌐 Google Flow Session:');
    console.log(`  • Auth State:    ${flowOnline.isAuth ? '\x1b[32m✓ Authenticated (Logged In)\x1b[0m' : '\x1b[31m✗ Not Logged In\x1b[0m'}`);
    console.log(`  • Subscription:  ${flowOnline.isPro ? '\x1b[32m★ Google Flow Pro\x1b[0m' : 'Standard / Free'}`);
    console.log(`  • Canvas Access: ${flowOnline.hasCanvas ? '\x1b[32m✓ Prompt & Canvas Available\x1b[0m' : 'Ready'}`);
  }

  console.log('\n📁 Local Execution Workspace:');
  console.log(`  • Working Dir:   ${process.cwd()}`);
  console.log(`  • Downloads:     ${cwdDownloads}`);
  if (recentJobs.length > 0) {
    console.log(`  • Recent Tasks:  ${recentJobs.join(', ')}`);
  }
  console.log('======================================================\n');
}

async function run() {
  const args = process.argv.slice(2);
  let inferredType = null;

  if (args[0] === 'status' || args[0] === 'health' || args[0] === 'info') {
    inferredType = 'status';
    process.argv.splice(2, 1);
  } else if (args[0] === 'image' || args[0] === 'img') {
    inferredType = 'image';
    process.argv.splice(2, 1);
  } else if (args[0] === 'video' || args[0] === 'vid') {
    inferredType = 'video';
    process.argv.splice(2, 1);
  } else {
    const execName = path.basename(process.argv[1]);
    if (execName.includes('status')) inferredType = 'status';
    if (execName.includes('image')) inferredType = 'image';
    if (execName.includes('video')) inferredType = 'video';
  }

  const options = {
    prompt: { type: 'string', short: 'p' },
    type: { type: 'string', short: 't', default: inferredType || 'image' },
    'aspect-ratio': { type: 'string', short: 'a', default: '16:9' },
    count: { type: 'string', short: 'c' },
    model: { type: 'string', short: 'm' },
    quality: { type: 'string', short: 'q', default: '720p' },
    agent: { type: 'boolean', default: false },
    reference: { type: 'string', short: 'r' },
    'output-dir': { type: 'string', short: 'o', default: 'downloads' },
    'project-url': { type: 'string', short: 'u', default: DEFAULT_PROJECT_URL },
    timeout: { type: 'string' },
    json: { type: 'boolean', default: false },
    quick: { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false }
  };

  let values;
  try {
    const parsed = parseArgs({ options, allowPositionals: true });
    values = parsed.values;
  } catch (err) {
    console.error(`\x1b[31m[Error]\x1b[0m ${err.message}`);
    printHelp();
    process.exit(1);
  }

  if (values.help) {
    printHelp();
    return;
  }

  // If status command
  if (values.type === 'status' || inferredType === 'status') {
    await handleStatus(values);
    return;
  }

  if (!values.prompt) {
    printHelp();
    console.error('\x1b[31m[Error]\x1b[0m --prompt is required for image and video generation!\n');
    process.exit(1);
  }

  const genType = values.type === 'video' || values.type === 'vid' ? 'video' : 'image';
  const promptText = values.prompt;
  const aspectRatio = values['aspect-ratio'];
  const count = parseInt(values.count, 10) || (genType === 'image' ? 4 : 1);
  const defaultModel = genType === 'image' ? 'Nano Banana 2' : 'Omni 1.1 Flash';
  const modelName = values.model || defaultModel;
  const quality = values.quality;
  const enableAgent = values.agent;
  const referencePath = values.reference ? path.resolve(process.cwd(), values.reference) : null;
  const outputBaseDir = path.resolve(process.cwd(), values['output-dir']);
  const projectUrl = values['project-url'];
  const defaultTimeout = genType === 'image' ? 300 : 600;
  const maxWaitMs = (parseInt(values.timeout, 10) || defaultTimeout) * 1000;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const taskOutputDir = path.join(outputBaseDir, `flow_${genType}_${timestamp}`);
  fs.mkdirSync(taskOutputDir, { recursive: true });

  console.log('\n======================================================');
  console.log(`       Google Flow Automated ${genType.toUpperCase()} Generator          `);
  console.log('======================================================');
  console.log(`• Mode:          ${genType.toUpperCase()}`);
  console.log(`• Prompt:        "${promptText.length > 80 ? promptText.slice(0, 80) + '...' : promptText}"`);
  console.log(`• Model:         ${modelName}`);
  console.log(`• Aspect Ratio:  ${aspectRatio}`);
  console.log(`• Candidates:    x${count}`);
  if (genType === 'video') console.log(`• Quality:       ${quality}`);
  console.log(`• Agent Mode:    ${enableAgent ? 'Enabled' : 'Disabled (Direct Generation)'}`);
  if (referencePath) console.log(`• Reference:     ${referencePath}`);
  console.log(`• Output Dir:    ${taskOutputDir}`);
  console.log('======================================================\n');

  cleanChromeLocks(DEFAULT_PROFILE);

  console.log('🚀 [1/6] Launching Persistent Browser Context...');
  const context = await chromium.launchPersistentContext(DEFAULT_PROFILE, {
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      '--window-size=1400,900'
    ],
    viewport: { width: 1400, height: 900 },
    ignoreDefaultArgs: ['--enable-automation'],
    acceptDownloads: true
  });

  const page = context.pages()[0] || await context.newPage();
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });

  try {
    console.log(`🌐 [2/6] Navigating to Google Flow Project (${projectUrl})...`);
    await page.goto(projectUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await page.waitForTimeout(6000);

    // If on landing page, click create or first project
    if (page.url() === 'https://flow.google.com/' || page.url().endsWith('/home')) {
      const createBtn = page.locator('button:has-text("使用 Google Flow 建立"), button:has-text("Create"), button:has-text("新增專案")').first();
      if (await createBtn.isVisible().catch(() => false)) {
        console.log('Clicking Create button on landing page...');
        await createBtn.click();
        await page.waitForTimeout(6000);
      }
    }

    // Close any overlay / side drawer if present
    const closeDrawerBtn = page.locator('button[aria-label="關閉"], button[aria-label="Close"]').first();
    if (await closeDrawerBtn.isVisible().catch(() => false)) {
      await closeDrawerBtn.click().catch(() => {});
      await page.waitForTimeout(500);
    }

    // Agent Mode Management
    console.log(`🤖 [3/6] Setting Agent Mode to: ${enableAgent ? 'ON' : 'OFF'}...`);
    const agentChip = page.locator('.agent-mode-chip, button:has-text("Agent"), button[aria-label*="代理" i]').first();
    if (await agentChip.isVisible().catch(() => false)) {
      const isAgentActive = await agentChip.evaluate(el => 
        el.classList.contains('agent-mode-chip-checked') || el.getAttribute('aria-checked') === 'true'
      ).catch(() => false);

      if (enableAgent && !isAgentActive) {
        console.log('Enabling Agent mode...');
        await agentChip.click();
        await page.waitForTimeout(800);
      } else if (!enableAgent && isAgentActive) {
        console.log('Disabling Agent mode for direct zero-latency generation...');
        await agentChip.click();
        await page.waitForTimeout(800);
      }
    }

    // Open Settings Popup & Configure Parameters
    console.log(`⚙️ [4/6] Configuring ${genType.toUpperCase()} Parameters (${aspectRatio}, x${count}, ${modelName})...`);
    const settingsBtn = page.locator('flow-prompt-box button.settings-trigger-button, button:has-text("影片 ·"), button:has-text("圖片 ·"), button:has-text("🍌"), button:has-text("Flash"), button.settings-trigger-button').last();
    await settingsBtn.waitFor({ state: 'visible', timeout: 15000 });
    await settingsBtn.click();
    
    // Wait for popover to render
    const settingsPanel = page.locator('flow-prompt-box-settings').first();
    await settingsPanel.waitFor({ state: 'visible', timeout: 8000 });
    await page.waitForTimeout(600);

    // 1. Switch Mode (圖片 vs 影片)
    const targetModeLabel = genType === 'video' ? '影片' : '圖片';
    const modeToggle = page.locator(`flow-prompt-box-settings mat-button-toggle:has-text("${targetModeLabel}") button, flow-prompt-box-settings button:has-text("${targetModeLabel}")`).first();
    if (await modeToggle.isVisible().catch(() => false)) {
      await modeToggle.click();
      await page.waitForTimeout(800);
      console.log(`✓ Switched mode to: ${targetModeLabel}`);
    }

    // 2. Select Aspect Ratio
    const ratioToggle = page.locator(`flow-prompt-box-settings mat-button-toggle:has-text("${aspectRatio}") button, flow-prompt-box-settings button:has-text("${aspectRatio}")`).first();
    if (await ratioToggle.isVisible().catch(() => false)) {
      await ratioToggle.click();
      await page.waitForTimeout(400);
      console.log(`✓ Aspect ratio set to: ${aspectRatio}`);
    }

    // 3. Select Candidate Count (x1, x2, x3, x4)
    const countToggle = page.locator(`flow-prompt-box-settings mat-button-toggle:has-text("x ${count}") button, flow-prompt-box-settings mat-button-toggle:has-text("x${count}") button, flow-prompt-box-settings button:has-text("x ${count}")`).first();
    if (await countToggle.isVisible().catch(() => false)) {
      await countToggle.click();
      await page.waitForTimeout(400);
      console.log(`✓ Candidate count set to: x${count}`);
    }

    // 4. Video Quality Selection (if applicable)
    if (genType === 'video' && quality) {
      const qualityToggle = page.locator(`flow-prompt-box-settings mat-button-toggle:has-text("${quality}") button, flow-prompt-box-settings button:has-text("${quality}")`).first();
      if (await qualityToggle.isVisible().catch(() => false)) {
        await qualityToggle.click();
        await page.waitForTimeout(400);
        console.log(`✓ Video resolution set to: ${quality}`);
      }
    }

    // 5. Select Model
    const modelDropdown = page.locator('flow-prompt-box-settings button[aria-label="選取模型系列"], flow-prompt-box-settings .mat-mdc-menu-trigger').first();
    if (await modelDropdown.isVisible().catch(() => false)) {
      const currentModelText = await modelDropdown.innerText();
      if (!currentModelText.toLowerCase().includes(modelName.toLowerCase())) {
        await modelDropdown.click();
        await page.waitForTimeout(800);

        const targetOption = page.locator(`[role="menuitem"]:has-text("${modelName}"), .mat-mdc-menu-item:has-text("${modelName}")`).first();
        if (await targetOption.isVisible().catch(() => false)) {
          await targetOption.click();
          await page.waitForTimeout(500);
          console.log(`✓ Model switched to: ${modelName}`);
        } else {
          console.warn(`⚠️ Specific model option "${modelName}" not in dropdown list. Using: ${currentModelText.trim().replace(/\n+/g, ' ')}`);
          await page.keyboard.press('Escape');
        }
      } else {
        console.log(`✓ Model is set to: ${currentModelText.trim().replace(/\n+/g, ' ')}`);
      }
    }

    // Close settings popup
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Optional: Attach Reference Image
    if (referencePath && fs.existsSync(referencePath)) {
      console.log(`📎 Uploading reference asset: ${referencePath}...`);
      const addMediaBtn = page.locator('button[aria-label*="素材" i], button[aria-label*="add" i], button:has-text("新增素材")').first();
      if (await addMediaBtn.isVisible().catch(() => false)) {
        await addMediaBtn.click();
        await page.waitForTimeout(1000);
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.count() > 0) {
          await fileInput.setInputFiles(referencePath);
          await page.waitForTimeout(3000);
          console.log('✓ Reference asset uploaded successfully.');
        }
      }
    }

    // Enter Prompt
    console.log(`✍️ [5/6] Entering ${genType.toUpperCase()} Prompt & Triggering Generation...`);
    const promptInput = page.locator('div.ProseMirror, textarea, [contenteditable="true"]').first();
    await promptInput.waitFor({ state: 'visible', timeout: 10000 });
    await promptInput.click();
    await page.waitForTimeout(300);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type(promptText, { delay: 4 });
    await page.waitForTimeout(800);

    // Submit Generation
    const submitBtn = page.locator('button[aria-label="開始生成"], button.generate-icon-button, button:has-text("生成")').first();
    if (await submitBtn.isVisible().catch(() => false)) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }
    console.log(`🚀 ${genType.toUpperCase()} generation task submitted to Google Flow! Polling for completion...`);

    // Wait and Poll for Completion
    console.log('⏳ [6/6] Monitoring Canvas & Awaiting High-Res Output...');
    const startTime = Date.now();
    let downloadSucceeded = false;
    let downloadedFiles = [];

    while (Date.now() - startTime < maxWaitMs) {
      await page.waitForTimeout(5000);
      const elapsed = Math.round((Date.now() - startTime) / 1000);

      const status = await page.evaluate(() => {
        const text = document.body.innerText || '';
        const isPercentage = text.match(/\d+%/);
        const isGenerating = text.includes('正在產生') || text.includes('Generating') || text.includes('產生片段') || !!isPercentage;
        const dlButtons = document.querySelectorAll('button[aria-label*="下載" i]');
        return { 
          isGenerating, 
          progress: isPercentage ? isPercentage[0] : null,
          downloadButtonCount: dlButtons.length 
        };
      });

      const progressLabel = status.progress ? `Progress: ${status.progress}` : (status.isGenerating ? 'Generating ⏳' : 'Completed ✨');
      process.stdout.write(`\r[${elapsed}s] Status: ${progressLabel} | Canvas Download Buttons: ${status.downloadButtonCount}   `);

      if (!status.isGenerating && elapsed >= 10) {
        console.log(`\n\n🎉 ${genType.toUpperCase()} Generation Completed in ${elapsed}s! Initiating Download...`);

        // Find the latest node's download button
        const downloadBtn = page.locator('button[aria-label*="下載" i]').first();
        if (await downloadBtn.isVisible().catch(() => false)) {
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 25000 }).catch(() => null),
            downloadBtn.click()
          ]);

          if (download) {
            const zipFile = path.join(taskOutputDir, `flow_${genType}_batch.zip`);
            await download.saveAs(zipFile);
            console.log(`✓ Downloaded batch archive to: ${zipFile}`);

            // Unzip archive
            const unzipRes = spawnSync('unzip', ['-o', zipFile, '-d', taskOutputDir], { encoding: 'utf-8' });
            if (unzipRes.status === 0) {
              const files = fs.readdirSync(taskOutputDir).filter(f => !f.endsWith('.zip') && !f.endsWith('.json') && !f.endsWith('.png'));
              downloadedFiles = files.map(f => path.join(taskOutputDir, f));
              downloadSucceeded = true;
              console.log(`✓ Successfully unpacked ${downloadedFiles.length} output file(s):`);
              for (const f of downloadedFiles) {
                const stat = fs.statSync(f);
                console.log(`   - ${path.basename(f)} (${Math.round(stat.size / 1024)} KB)`);
              }
            }
            break;
          }
        }

        // Fallback: If image and zip event wasn't captured, extract CDN URLs from DOM
        if (genType === 'image') {
          console.log('Extracting candidate image URLs directly from DOM as fallback...');
          const candidateUrls = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('img'))
              .map(img => img.src)
              .filter(src => src && src.includes('flow-content.google/image/'));
          });

          if (candidateUrls.length > 0) {
            let idx = 1;
            for (const url of candidateUrls) {
              try {
                const resp = await page.request.get(url);
                const imgPath = path.join(taskOutputDir, `candidate_${idx}.jpg`);
                fs.writeFileSync(imgPath, await resp.body());
                downloadedFiles.push(imgPath);
                console.log(`✓ Saved candidate ${idx}: ${imgPath}`);
                idx++;
              } catch (e) {}
            }
            if (downloadedFiles.length > 0) {
              downloadSucceeded = true;
              break;
            }
          }
        }
      }
    }

    // Save final canvas screenshot
    const finalScreenshot = path.join(taskOutputDir, 'canvas_result.png');
    await page.screenshot({ path: finalScreenshot });

    // Video Post-processing & FFprobe Validation
    let videoMeta = null;
    if (genType === 'video' && downloadedFiles.length > 0) {
      const mp4File = downloadedFiles.find(f => f.endsWith('.mp4'));
      if (mp4File) {
        console.log('\n🔍 Inspecting Video Stream & Extracting Preview Frame...');
        const probeRes = spawnSync('ffprobe', [
          '-v', 'error',
          '-show_entries', 'format=duration,size,bit_rate:stream=codec_name,codec_type,width,height,r_frame_rate',
          '-of', 'json',
          mp4File
        ], { encoding: 'utf-8' });

        if (probeRes.status === 0) {
          try {
            videoMeta = JSON.parse(probeRes.stdout);
            const stream = videoMeta.streams?.find(s => s.codec_type === 'video');
            console.log(`✓ Video Stream: ${stream?.width}x${stream?.height}, ${stream?.codec_name}, ${videoMeta.format?.duration}s, ${stream?.r_frame_rate} fps`);
          } catch (e) {}
        }

        const previewFramePath = path.join(taskOutputDir, 'preview_frame.png');
        spawnSync('ffmpeg', ['-y', '-i', mp4File, '-ss', '00:00:02', '-vframes', '1', previewFramePath]);
        if (fs.existsSync(previewFramePath)) {
          console.log(`✓ Extracted preview frame: ${previewFramePath}`);
        }
      }
    }

    // Save Metadata JSON
    const metadata = {
      timestamp: new Date().toISOString(),
      type: genType,
      prompt: promptText,
      model: modelName,
      aspectRatio,
      candidatesCount: count,
      quality: genType === 'video' ? quality : undefined,
      agentMode: enableAgent,
      outputDir: taskOutputDir,
      files: downloadedFiles,
      videoStream: videoMeta,
      status: downloadSucceeded ? 'SUCCESS' : 'TIMEOUT_OR_FAILED'
    };
    fs.writeFileSync(path.join(taskOutputDir, 'metadata.json'), JSON.stringify(metadata, null, 2));

    console.log('\n======================================================');
    if (downloadSucceeded) {
      console.log(`✅ ${genType.toUpperCase()} GENERATED & DOWNLOADED SUCCESSFULLY!`);
      console.log(`📁 Destination Folder: ${taskOutputDir}`);
      console.log(`📊 Metadata Saved:    ${path.join(taskOutputDir, 'metadata.json')}`);
    } else {
      console.log('⚠️ Process finished with warnings or timeout. Check canvas_result.png');
    }
    console.log('======================================================\n');

  } finally {
    await context.close();
  }
}

run().catch((err) => {
  console.error('\n\x1b[31m[Fatal Error]\x1b[0m', err);
  process.exit(1);
});
