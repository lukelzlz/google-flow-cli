# Google Flow CLI (`flow`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-green.svg)](https://nodejs.org/)

A powerful, high-performance automated Command Line Interface (CLI) for generating **Images** and **Videos** via [Google Flow](https://flow.google.com/).

English | [中文说明](#中文说明)

---

## ✨ Features

- **Unified CLI (`flow`)**: Support for both Image and Video generation with unified syntax.
- **Full Parameter Control**:
  - **Aspect Ratios**: `16:9`, `4:3`, `1:1`, `3:4`, `9:16`, `10:16`.
  - **Candidate Batches**: Generate `1` to `4` candidates simultaneously.
  - **Models**: `Nano Banana 2`, `Nano Banana Pro`, `Nano Banana 2 Lite`, `Gemini Omni 1.1 Flash`, `Veo 3.1 - Quality/Fast/Lite`.
  - **Video Resolutions**: `720p`, `360p`, `1080p`.
- **Zero-Latency Direct Generation**: Automatically disables Agent approval mode for instant zero-prompt-approval execution.
- **Context-Aware Output**: Media is generated directly in the current working directory (`./downloads/` in CWD or custom `-o`).
- **Auto Archive Unpack**: Automatically downloads zip archives, unpacks media, and organizes outputs.
- **Media Introspection**: Automatically executes `ffprobe` stream validation and generates video preview thumbnails (`preview_frame.png`).
- **Zero Configuration Linux Support**: Automatic Xvfb display server wrapping and Chrome profile lock cleanup on headless Linux systems.

---

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/lukelzlz/google-flow-cli.git
cd google-flow-cli

# Install dependencies
npm install

# Link global command
npm link
```

---

## 🚀 Quick Start

### 1. Image Generation (`flow image` / `flow-image`)

```bash
# Generate 4 candidate images with 16:9 widescreen ratio
flow image -p "Cyberpunk rooftop garden at sunset, Makoto Shinkai style, 4k" -a 16:9 -c 4

# Generate 1:1 avatar image directly in current directory
flow image -p "Pixel art indie game developer chibi avatar" -a 1:1 -c 2 -o .

# Attach a local reference character sheet
flow image -p "Anime character standing in magical forest" -r ./character.png -a 9:16
```

### 2. Video Generation (`flow video` / `flow-video`)

```bash
# Generate high-definition 8s video with Omni Flash
flow video -p "Cinematic camera fly-through over glowing enchanted neon crystal forest at midnight, 4k" -a 16:9

# Generate video with custom Veo model and quality
flow video -p "Space rocket launching to stars, dramatic cinematic lighting" -m "Veo 3.1 - Quality" -q 1080p
```

```bash
# Check environment health & Google Flow login state
flow status

# Quick local-only status check
flow status --quick

# Machine-readable JSON output
flow status --quick --json
```

---

## 🛠️ Command-Line Options

```text
Usage:
  flow <subcommand> [options]
  flow [options]

Subcommands:
  image                        Generate images (alias: flow-image)
  video                        Generate videos (alias: flow-video)
  status                       Check authentication & system health (alias: flow-status)

Options:
  -p, --prompt <string>        (Required for generation) Prompt describing image or video
  -t, --type <image|video>     Generation mode (Default: 'image' or based on subcommand)
  -a, --aspect-ratio <ratio>   Aspect ratio:
                               • Image: '16:9', '4:3', '1:1', '3:4', '9:16' (Default: '16:9')
                               • Video: '16:9', '4:3', '1:1', '9:16', '10:16' (Default: '16:9')
  -c, --count <number>         Candidate count: 1, 2, 3, 4 (Default: 4 for image, 1 for video)
  -m, --model <name>           Model selection:
                               • Image: 'Nano Banana 2' (Default), 'Nano Banana Pro', 'Nano Banana 2 Lite'
                               • Video: 'Omni 1.1 Flash' (Default), 'Veo 3.1 - Quality', 'Veo 3.1 - Fast'
  -q, --quality <res>          Video quality/resolution: '720p' (Default), '360p', '1080p'
      --agent                  Enable Agent approval mode (Default: disabled / direct generation)
  -r, --reference <path>       Path to local reference image to attach
  -o, --output-dir <dir>       Directory to save results (Default: './downloads' in CWD)
  -u, --project-url <url>      Google Flow Project Canvas URL
      --timeout <seconds>      Maximum timeout (Default: 300s for image, 600s for video)
      --json                   Output status in JSON format (for status subcommand)
      --quick                  Fast local-only status check without launching browser
  -h, --help                   Display help message
```

---

## 📂 Output Structure

Results are saved in timestamped folders in your execution directory:

```text
./downloads/flow_image_2026-09-22T12-57-37-139Z/
├── candidate_1.jpg          # High-resolution image (300 DPI)
├── candidate_2.jpg          # High-resolution candidate 2
├── canvas_result.png        # Canvas visual screenshot
└── metadata.json            # Task parameters & execution metadata
```

For video generation:

```text
./downloads/flow_video_2026-09-22T12-59-37-389Z/
├── generated_video.mp4      # 8s HD video (H.264 / AAC 24fps)
├── preview_frame.png        # Extracted video preview frame
├── canvas_result.png        # Canvas visual screenshot
└── metadata.json            # Full video stream info (codec, fps, duration)
```

---

## 🔒 Security & Privacy

This CLI tool uses a localized browser profile (`~/.google-flow-creator/browser-profile`) to automate interactions with Google Flow. **No passwords, tokens, or credentials are stored in the repository or transmitted to third parties.**

---

<a name="中文说明"></a>

## 中文说明

Google Flow 统一自动化命令行工具（支持生图与生视频）。

### 特性亮点

1. **统一指令**：`flow image`（生图）与 `flow video`（生视频）双模式，并支持快捷命令 `flow-image` 与 `flow-video`。
2. **全参数支持**：自由配置画面比例（`16:9` / `4:3` / `1:1` / `3:4` / `9:16`）、模型（`Nano Banana` / `Omni Flash` / `Veo 3.1`）、备选张数（`x1`~`x4`）及视频清晰度（`720p` / `1080p`）。
3. **免审批直出**：默认自动关闭 Agent 审批流，提示词提交后零等待直接出图出片。
4. **即时落盘与解包**：在哪里执行命令，结果直接保存在当前目录下的 `./downloads/`，自动解压 Zip 并执行 `ffprobe` 质检与封面抽帧。
5. **Linux 无头开箱即用**：自动检测并包装 Xvfb 虚拟显示服务，自动清理 Chrome 锁文件。

### 常用命令示例

```bash
# 1. 批量生成 4 张 16:9 候选原图
flow image -p "赛博朋克雨夜霓虹街道，新海诚唯美画风，8k" -a 16:9 -c 4

# 2. 生成电影级 8 秒高清视频（自动提取封面帧）
flow video -p "Cinematic drone shot soaring over mystical waterfalls in neon cyberpunk city, 4k" -a 16:9

# 3. 绑定角色立绘生成 1:1 头像
flow image -p "二次元少年独立开发者工作台头像" -r ./character.png -a 1:1 -c 2 -o .
```

---

## 📄 License

[MIT License](LICENSE) © 2026 lukelzlz
