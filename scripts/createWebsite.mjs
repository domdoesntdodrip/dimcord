import fs from "fs";
import path from "path";

const iconB64 = fs.readFileSync("C:/Users/domcu/Downloads/dimcord/dimcord-main/browser/icon.png").toString("base64");
const iconDataUri = `data:image/png;base64,${iconB64}`;

const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dimcord — Discord, Refined</title>
    <meta name="description" content="A simplistic, ultra-lightweight, client-side Discord mod. No cloud sync, no tracking, pure standalone speed.">
    <link rel="icon" type="image/png" href="${iconDataUri}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #050505;
            --surface: #0a0a0c;
            --surface-elevated: #121215;
            --surface-hover: #1a1a1f;
            --border: rgba(255, 255, 255, 0.08);
            --border-hover: rgba(255, 255, 255, 0.22);
            --border-strong: rgba(255, 255, 255, 0.4);
            --text-primary: #f5f5f7;
            --text-secondary: #8e8e93;
            --text-tertiary: #52525b;
            --font-sans: 'Geist', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            --font-mono: 'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        body {
            background-color: var(--bg);
            color: var(--text-primary);
            font-family: var(--font-sans);
            line-height: 1.5;
            overflow-x: hidden;
            position: relative;
        }

        /* Ambient interactive cursor spotlight */
        #cursor-glow {
            position: fixed;
            top: 0;
            left: 0;
            width: 700px;
            height: 700px;
            margin-left: -350px;
            margin-top: -350px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.015) 35%, transparent 70%);
            border-radius: 50%;
            pointer-events: none;
            z-index: 1;
            transform: translate3d(-1000px, -1000px, 0);
            transition: opacity 0.3s ease;
            will-change: transform;
        }

        /* Subtle grid background */
        .grid-bg {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: 
                radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 0.08) 0%, transparent 60%),
                linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px);
            background-size: 100% 100%, 36px 36px, 36px 36px;
            pointer-events: none;
            z-index: 0;
        }

        /* Ambient animated particle canvas */
        #particle-canvas {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
            opacity: 0.65;
        }

        .container {
            max-width: 1080px;
            margin: 0 auto;
            padding: 0 24px;
            position: relative;
            z-index: 2;
        }

        /* Nav */
        header {
            padding: 22px 0;
            border-bottom: 1px solid var(--border);
            position: sticky;
            top: 0;
            background: rgba(5, 5, 5, 0.8);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            z-index: 100;
            transition: border-color 0.3s ease;
        }

        .nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo-wrap {
            display: flex;
            align-items: center;
            gap: 12px;
            text-decoration: none;
            color: var(--text-primary);
        }

        .logo-img {
            width: 28px;
            height: 28px;
            border-radius: 6px;
            filter: grayscale(100%) contrast(1.1);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .logo-wrap:hover .logo-img {
            transform: scale(1.12) rotate(-3deg);
        }

        .logo-text {
            font-size: 15px;
            font-weight: 600;
            letter-spacing: -0.02em;
        }

        .nav-links {
            display: flex;
            align-items: center;
            gap: 28px;
            list-style: none;
        }

        .nav-link {
            color: var(--text-secondary);
            font-size: 13px;
            text-decoration: none;
            transition: color 0.2s ease;
            position: relative;
            padding: 4px 0;
        }

        .nav-link::after {
            content: "";
            position: absolute;
            bottom: 0;
            left: 0;
            width: 0%;
            height: 1px;
            background: #ffffff;
            transition: width 0.25s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .nav-link:hover {
            color: var(--text-primary);
        }

        .nav-link:hover::after {
            width: 100%;
        }

        .btn-nav {
            background: var(--text-primary);
            color: var(--bg);
            padding: 8px 16px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            border: 1px solid transparent;
        }

        .btn-nav:hover {
            background: #ffffff;
            box-shadow: 0 0 20px rgba(255, 255, 255, 0.25);
            transform: translateY(-1px);
        }

        /* Hero */
        .hero {
            padding: 105px 0 75px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            padding: 6px 14px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 9999px;
            font-size: 12px;
            font-family: var(--font-mono);
            color: var(--text-secondary);
            margin-bottom: 28px;
            letter-spacing: -0.01em;
            animation: fadeInDown 0.8s cubic-bezier(0.16, 1, 0.3, 1) both;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
            transition: border-color 0.2s ease, transform 0.2s ease;
        }

        .badge:hover {
            border-color: var(--border-hover);
            transform: translateY(-1px);
        }

        .badge-dot {
            width: 6px;
            height: 6px;
            background: #ffffff;
            border-radius: 50%;
            display: inline-block;
            animation: pulseGlow 2.5s infinite;
        }

        @keyframes pulseGlow {
            0%, 100% {
                box-shadow: 0 0 4px rgba(255, 255, 255, 0.7);
                transform: scale(1);
            }
            50% {
                box-shadow: 0 0 12px rgba(255, 255, 255, 1);
                transform: scale(1.3);
            }
        }

        .hero-title {
            font-size: clamp(44px, 7.5vw, 82px);
            font-weight: 700;
            letter-spacing: -0.04em;
            line-height: 1.05;
            max-width: 860px;
            margin-bottom: 22px;
            background: linear-gradient(110deg, #71717a 0%, #ffffff 25%, #ffffff 50%, #a1a1aa 75%, #ffffff 100%);
            background-size: 200% auto;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            animation: textShimmer 9s linear infinite, fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
            animation-delay: 0.1s, 0.1s;
        }

        @keyframes textShimmer {
            0% { background-position: 200% center; }
            100% { background-position: -200% center; }
        }

        .hero-sub {
            font-size: clamp(16px, 2.2vw, 19.5px);
            color: var(--text-secondary);
            max-width: 590px;
            margin-bottom: 40px;
            font-weight: 400;
            letter-spacing: -0.01em;
            animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
            animation-delay: 0.2s;
        }

        .hero-cta {
            display: flex;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
            justify-content: center;
            margin-bottom: 48px;
            animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
            animation-delay: 0.3s;
        }

        .btn-primary {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            background: #ffffff;
            color: #000000;
            padding: 13px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 20px rgba(255, 255, 255, 0.15);
            position: relative;
            overflow: hidden;
        }

        .btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 30px rgba(255, 255, 255, 0.3);
        }

        .btn-primary:active {
            transform: translateY(0);
        }

        .btn-secondary {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            background: var(--surface);
            color: var(--text-primary);
            border: 1px solid var(--border);
            padding: 13px 22px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            text-decoration: none;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .btn-secondary:hover {
            border-color: var(--border-hover);
            background: var(--surface-hover);
            transform: translateY(-2px);
        }

        /* CLI snippet box */
        .cli-box {
            display: flex;
            align-items: center;
            gap: 12px;
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 11px 16px;
            border-radius: 8px;
            font-family: var(--font-mono);
            font-size: 12.5px;
            color: var(--text-secondary);
            max-width: 500px;
            cursor: pointer;
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            position: relative;
            animation: fadeInUp 0.9s cubic-bezier(0.16, 1, 0.3, 1) both;
            animation-delay: 0.4s;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        }

        .cli-box:hover {
            border-color: var(--border-strong);
            color: var(--text-primary);
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6);
        }

        .cli-prompt {
            color: var(--text-tertiary);
            user-select: none;
        }

        .cli-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .cli-copy-icon {
            margin-left: auto;
            color: var(--text-tertiary);
            transition: color 0.2s ease, transform 0.2s ease;
            flex-shrink: 0;
        }

        .cli-box:hover .cli-copy-icon {
            color: var(--text-primary);
            transform: scale(1.1);
        }

        /* Showcase Preview */
        .preview-section {
            padding: 30px 0 95px;
            perspective: 1200px;
        }

        .window-frame {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 32px 80px -16px rgba(0, 0, 0, 0.9), 0 0 0 1px var(--border);
            transition: transform 0.25s cubic-bezier(0.2, 0, 0, 1), border-color 0.3s ease, box-shadow 0.3s ease;
            transform-style: preserve-3d;
        }

        .window-frame:hover {
            border-color: var(--border-hover);
            box-shadow: 0 40px 100px -16px rgba(0, 0, 0, 0.95), 0 0 30px rgba(255, 255, 255, 0.04);
        }

        .window-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 13px 18px;
            background: rgba(255, 255, 255, 0.02);
            border-bottom: 1px solid var(--border);
        }

        .window-controls {
            display: flex;
            gap: 8px;
        }

        .window-dot {
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: var(--border);
            transition: background 0.2s ease;
        }

        .window-frame:hover .window-dot:nth-child(1) { background: #52525b; }
        .window-frame:hover .window-dot:nth-child(2) { background: #71717a; }
        .window-frame:hover .window-dot:nth-child(3) { background: #a1a1aa; }

        .window-title {
            font-size: 11.5px;
            font-family: var(--font-mono);
            color: var(--text-tertiary);
            letter-spacing: -0.01em;
        }

        .window-body {
            padding: 40px;
            display: grid;
            grid-template-columns: 330px 1fr;
            gap: 40px;
            align-items: center;
        }

        @media (max-width: 820px) {
            .window-body {
                grid-template-columns: 1fr;
                padding: 24px;
            }
        }

        .preview-mascot-card {
            background: #000000;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 36px 28px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
            position: relative;
            overflow: hidden;
            transition: border-color 0.3s ease;
        }

        .preview-mascot-card:hover {
            border-color: var(--border-hover);
        }

        .preview-mascot-img {
            width: 135px;
            height: 135px;
            object-fit: contain;
            margin-bottom: 22px;
            filter: drop-shadow(0 16px 28px rgba(0, 0, 0, 0.7));
            animation: mascotFloat 4.5s ease-in-out infinite;
            will-change: transform;
        }

        @keyframes mascotFloat {
            0%, 100% {
                transform: translateY(0px) rotate(0deg);
            }
            50% {
                transform: translateY(-9px) rotate(-1.5deg);
            }
        }

        .preview-badge-status {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-secondary);
            background: var(--surface-elevated);
            padding: 4px 12px;
            border-radius: 9999px;
            border: 1px solid var(--border);
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .preview-badge-status::before {
            content: "";
            width: 5px;
            height: 5px;
            background: #ffffff;
            border-radius: 50%;
            display: inline-block;
        }

        .preview-content {
            display: flex;
            flex-direction: column;
            gap: 22px;
        }

        .preview-heading {
            font-size: 24px;
            font-weight: 600;
            letter-spacing: -0.02em;
        }

        .preview-desc {
            color: var(--text-secondary);
            font-size: 14.5px;
            line-height: 1.65;
        }

        .metric-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 14px;
            margin-top: 6px;
        }

        .metric-card {
            background: var(--surface-elevated);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px 18px;
            transition: all 0.25s ease;
        }

        .metric-card:hover {
            border-color: var(--border-hover);
            transform: translateY(-2px);
        }

        .metric-val {
            font-size: 20px;
            font-weight: 700;
            letter-spacing: -0.03em;
            margin-bottom: 2px;
            color: #ffffff;
        }

        .metric-lbl {
            font-size: 10.5px;
            font-family: var(--font-mono);
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        /* Bento Grid with Spotlight Glow */
        .section-header {
            text-align: center;
            margin-bottom: 54px;
        }

        .section-tag {
            font-family: var(--font-mono);
            font-size: 11.5px;
            color: var(--text-tertiary);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-bottom: 12px;
        }

        .section-title {
            font-size: clamp(28px, 4.2vw, 42px);
            font-weight: 600;
            letter-spacing: -0.03em;
            margin-bottom: 14px;
        }

        .section-sub {
            color: var(--text-secondary);
            font-size: 15px;
            max-width: 530px;
            margin: 0 auto;
        }

        .bento {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 18px;
            margin-bottom: 110px;
        }

        @media (max-width: 820px) {
            .bento {
                grid-template-columns: 1fr;
            }
        }

        .bento-card {
            position: relative;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            padding: 30px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            transition: border-color 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            overflow: hidden;
        }

        /* Dynamic interactive border spotlight */
        .bento-card::before {
            content: "";
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            border-radius: inherit;
            padding: 1px;
            background: radial-gradient(400px circle at var(--mouse-x, 0px) var(--mouse-y, 0px), rgba(255, 255, 255, 0.28), transparent 45%);
            -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
            -webkit-mask-composite: xor;
            mask-composite: exclude;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.35s ease;
        }

        .bento-card:hover::before {
            opacity: 1;
        }

        .bento-card:hover {
            transform: translateY(-3px);
            border-color: rgba(255, 255, 255, 0.16);
        }

        .bento-card.span-2 {
            grid-column: span 2;
        }

        @media (max-width: 820px) {
            .bento-card.span-2 {
                grid-column: span 1;
            }
        }

        .bento-num {
            font-family: var(--font-mono);
            font-size: 11px;
            color: var(--text-tertiary);
            margin-bottom: 24px;
        }

        .bento-title {
            font-size: 18px;
            font-weight: 600;
            letter-spacing: -0.02em;
            margin-bottom: 10px;
        }

        .bento-desc {
            font-size: 13.8px;
            color: var(--text-secondary);
            line-height: 1.62;
        }

        /* Install tab switcher */
        .install-section {
            padding: 85px 0 120px;
            border-top: 1px solid var(--border);
        }

        .tabs {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 34px;
            background: var(--surface);
            border: 1px solid var(--border);
            padding: 5px;
            border-radius: 12px;
            width: fit-content;
            margin-left: auto;
            margin-right: auto;
        }

        .tab-btn {
            background: transparent;
            border: none;
            color: var(--text-secondary);
            font-family: var(--font-sans);
            font-size: 13px;
            font-weight: 500;
            padding: 9px 20px;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .tab-btn:hover {
            color: var(--text-primary);
        }

        .tab-btn.active {
            background: var(--surface-elevated);
            color: #ffffff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        .tab-content {
            display: none;
            max-width: 700px;
            margin: 0 auto;
            animation: fadeIn 0.35s ease;
        }

        .tab-content.active {
            display: block;
        }

        .code-block {
            background: #000000;
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 24px;
            font-family: var(--font-mono);
            font-size: 13px;
            color: var(--text-primary);
            position: relative;
            overflow-x: auto;
            line-height: 1.65;
            box-shadow: 0 16px 40px -10px rgba(0, 0, 0, 0.8);
        }

        .code-block code {
            display: block;
            margin-bottom: 4px;
        }

        .code-step {
            display: flex;
            gap: 14px;
            margin-bottom: 14px;
            align-items: flex-start;
        }

        .code-step:last-child {
            margin-bottom: 0;
        }

        .step-num {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 20px;
            height: 20px;
            background: var(--surface-elevated);
            border: 1px solid var(--border);
            border-radius: 4px;
            font-size: 11px;
            color: var(--text-tertiary);
            flex-shrink: 0;
            margin-top: 1px;
        }

        /* Toast notification */
        .toast {
            position: fixed;
            bottom: 28px;
            right: 28px;
            background: #ffffff;
            color: #000000;
            font-size: 13px;
            font-weight: 600;
            padding: 11px 20px;
            border-radius: 8px;
            box-shadow: 0 16px 40px rgba(0, 0, 0, 0.8);
            opacity: 0;
            transform: translateY(16px) scale(0.95);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            pointer-events: none;
            z-index: 9999;
        }

        .toast.show {
            opacity: 1;
            transform: translateY(0) scale(1);
        }

        /* Scroll reveal animation utilities */
        .reveal {
            opacity: 0;
            transform: translateY(28px);
            transition: opacity 0.8s cubic-bezier(0.16, 1, 0.3, 1), transform 0.8s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .reveal.visible {
            opacity: 1;
            transform: translateY(0);
        }

        @keyframes fadeInUp {
            from {
                opacity: 0;
                transform: translateY(24px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeInDown {
            from {
                opacity: 0;
                transform: translateY(-16px);
            }
            to {
                opacity: 1;
                transform: translateY(0);
            }
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        /* Footer */
        footer {
            border-top: 1px solid var(--border);
            padding: 50px 0;
            color: var(--text-secondary);
            font-size: 13px;
            position: relative;
            z-index: 2;
        }

        .footer-inner {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 20px;
        }

        .footer-left {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .footer-links {
            display: flex;
            gap: 24px;
            list-style: none;
        }

        .footer-link {
            color: var(--text-secondary);
            text-decoration: none;
            transition: color 0.2s ease;
        }

        .footer-link:hover {
            color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="grid-bg"></div>
    <canvas id="particle-canvas"></canvas>
    <div id="cursor-glow"></div>

    <header>
        <div class="container nav">
            <a href="#" class="logo-wrap">
                <img src="${iconDataUri}" alt="Dimcord" class="logo-img">
                <span class="logo-text">Dimcord</span>
            </a>
            <ul class="nav-links">
                <li><a href="#features" class="nav-link">Features</a></li>
                <li><a href="#install" class="nav-link">Install</a></li>
                <li><a href="https://github.com/domdoesntdodrip/dimcord" target="_blank" rel="noopener" class="nav-link">GitHub</a></li>
            </ul>
            <a href="https://github.com/domdoesntdodrip/dimcord/raw/master/DimcordInstaller.exe" class="btn-nav">Download</a>
        </div>
    </header>

    <main class="container">
        <!-- Hero Section -->
        <section class="hero">
            <div class="badge">
                <span class="badge-dot"></span>
                <span>v1.15.18 &bull; Standalone &bull; Zero Cloud Bloat</span>
            </div>
            
            <h1 class="hero-title">Discord, refined to the bone.</h1>
            <p class="hero-sub">A minimalist, lightning-fast client modification. Gutted cloud bloat, pure local performance, and full plugin freedom.</p>
            
            <div class="hero-cta">
                <a href="https://github.com/domdoesntdodrip/dimcord/raw/master/DimcordInstaller.exe" class="btn-primary">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Dimcord (.exe)
                </a>
                <a href="https://github.com/domdoesntdodrip/dimcord" target="_blank" rel="noopener" class="btn-secondary">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/></svg>
                    Source Code
                </a>
            </div>

            <div class="cli-box" onclick="copyCli()" title="Click to copy quick install command">
                <span class="cli-prompt">$</span>
                <span class="cli-text">irm https://raw.githubusercontent.com/domdoesntdodrip/dimcord/master/DimcordInstaller.exe -o DimcordInstaller.exe; .\\DimcordInstaller.exe</span>
                <svg class="cli-copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </div>
        </section>

        <!-- Preview Showcase -->
        <section class="preview-section reveal">
            <div class="window-frame" id="interactive-window">
                <div class="window-header">
                    <div class="window-controls">
                        <div class="window-dot"></div>
                        <div class="window-dot"></div>
                        <div class="window-dot"></div>
                    </div>
                    <div class="window-title">dimcord-desktop &mdash; 64-bit</div>
                    <div style="width: 44px"></div>
                </div>
                <div class="window-body">
                    <div class="preview-mascot-card">
                        <img src="${iconDataUri}" alt="Dimcord Mascot" class="preview-mascot-img">
                        <div class="preview-badge-status">Injected &bull; Active</div>
                    </div>
                    <div class="preview-content">
                        <h3 class="preview-heading">Pure local control. Zero external dependencies.</h3>
                        <p class="preview-desc">
                            Dimcord strips out every remote tracker, cloud sync dependency, and badge watermark. It installs permanently into your local app data and runs with microscopic CPU and RAM footprints.
                        </p>
                        <div class="metric-grid">
                            <div class="metric-card">
                                <div class="metric-val" data-counter="1.6" data-suffix=" MB">1.6 MB</div>
                                <div class="metric-lbl">Installer Size</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-val" data-counter="0" data-suffix=" ms">0 ms</div>
                                <div class="metric-lbl">Cloud Latency</div>
                            </div>
                            <div class="metric-card">
                                <div class="metric-val" data-counter="100" data-suffix="%">100%</div>
                                <div class="metric-lbl">Open Source</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <!-- Bento Features Grid -->
        <section id="features" class="reveal">
            <div class="section-header">
                <div class="section-tag">Architecture</div>
                <h2 class="section-title">Engineered without compromises.</h2>
                <p class="section-sub">Everything you need from a modern client mod, with none of the telemetry you didn't ask for.</p>
            </div>

            <div class="bento">
                <div class="bento-card span-2 spotlight-card">
                    <div class="bento-num">01 / LOCAL FIRST</div>
                    <h3 class="bento-title">Cloud telemetry completely excised.</h3>
                    <p class="bento-desc">All tracking endpoints, remote sync hooks, and cloud storage tabs have been deleted from the codebase. Your settings, plugins, and custom styles remain strictly on your hardware.</p>
                </div>

                <div class="bento-card spotlight-card">
                    <div class="bento-num">02 / STANDALONE</div>
                    <h3 class="bento-title">100% Portable .exe</h3>
                    <p class="bento-desc">A single executable built with native C# WPF. No Node.js runtime, Git binaries, or command prompt required.</p>
                </div>

                <div class="bento-card spotlight-card">
                    <div class="bento-num">03 / ECOSYSTEM</div>
                    <h3 class="bento-title">Extensive Plugin Suite</h3>
                    <p class="bento-desc">Comes packed with hundreds of vetted plugins: message utilities, notification tweaks, themes, visualizers, and performance boosters.</p>
                </div>

                <div class="bento-card span-2 spotlight-card">
                    <div class="bento-num">04 / REPO INTEGRATED</div>
                    <h3 class="bento-title">Native GitHub Changelog & Updater</h3>
                    <p class="bento-desc">Directly checks for commit updates from <code>domdoesntdodrip/dimcord</code> using GitHub's REST API. Inspect new commits, read changelogs, and keep your installation current in real time.</p>
                </div>

                <div class="bento-card spotlight-card">
                    <div class="bento-num">05 / BROWSER READY</div>
                    <h3 class="bento-title">Unpacked Web Extension</h3>
                    <p class="bento-desc">Prefer Discord in Chrome or Firefox? Load Dimcord directly as a Manifest V3 extension with full feature parity.</p>
                </div>

                <div class="bento-card span-2 spotlight-card">
                    <div class="bento-num">06 / PERMANENT INJECTION</div>
                    <h3 class="bento-title">Decoupled AppData Storage</h3>
                    <p class="bento-desc">Injects cleanly into <code>%AppData%\\Dimcord\\dist\\desktop</code>. You can delete or move installer files anytime without breaking your Discord installation.</p>
                </div>
            </div>
        </section>

        <!-- Install Section -->
        <section id="install" class="install-section reveal">
            <div class="section-header">
                <div class="section-tag">Quickstart</div>
                <h2 class="section-title">Install in seconds.</h2>
                <p class="section-sub">Choose your preferred setup method below.</p>
            </div>

            <div class="tabs">
                <button class="tab-btn active" onclick="switchTab('tab-exe', this)">Windows (.exe)</button>
                <button class="tab-btn" onclick="switchTab('tab-browser', this)">Browser Extension</button>
                <button class="tab-btn" onclick="switchTab('tab-source', this)">Build from Source</button>
            </div>

            <div id="tab-exe" class="tab-content active">
                <div class="code-block">
                    <div class="code-step">
                        <span class="step-num">1</span>
                        <span>Download <code>DimcordInstaller.exe</code> from the button above.</span>
                    </div>
                    <div class="code-step">
                        <span class="step-num">2</span>
                        <span>Double-click to launch the native GUI installer.</span>
                    </div>
                    <div class="code-step">
                        <span class="step-num">3</span>
                        <span>Select your Discord installation (Stable, PTB, or Canary) and click <strong>Patch Discord</strong>.</span>
                    </div>
                    <div class="code-step">
                        <span class="step-num">4</span>
                        <span>Relaunch Discord &mdash; Dimcord settings are immediately available under Settings.</span>
                    </div>
                </div>
            </div>

            <div id="tab-browser" class="tab-content">
                <div class="code-block">
                    <div class="code-step">
                        <span class="step-num">1</span>
                        <span>Open <code>chrome://extensions</code> (or <code>edge://extensions</code>) in your browser.</span>
                    </div>
                    <div class="code-step">
                        <span class="step-num">2</span>
                        <span>Toggle <strong>Developer mode</strong> in the upper right.</span>
                    </div>
                    <div class="code-step">
                        <span class="step-num">3</span>
                        <span>Click <strong>Load unpacked</strong> and select the <code>browser</code> folder from the repository.</span>
                    </div>
                    <div class="code-step">
                        <span class="step-num">4</span>
                        <span>Visit <code>discord.com/app</code> &mdash; Dimcord Web initializes automatically.</span>
                    </div>
                </div>
            </div>

            <div id="tab-source" class="tab-content">
                <div class="code-block">
                    <code>git clone https://github.com/domdoesntdodrip/dimcord.git</code>
                    <code>cd dimcord</code>
                    <code>pnpm install</code>
                    <code>pnpm build</code>
                    <code>pnpm inject</code>
                </div>
            </div>
        </section>
    </main>

    <footer>
        <div class="container footer-inner">
            <div class="footer-left">
                <img src="${iconDataUri}" alt="Dimcord" class="logo-img" style="width: 22px; height: 22px;">
                <span>Dimcord &bull; Released under GNU General Public License v3.0</span>
            </div>
            <ul class="footer-links">
                <li><a href="https://github.com/domdoesntdodrip/dimcord" target="_blank" rel="noopener" class="footer-link">GitHub</a></li>
                <li><a href="https://github.com/domdoesntdodrip/dimcord/issues" target="_blank" rel="noopener" class="footer-link">Issues</a></li>
                <li><a href="https://github.com/domdoesntdodrip/dimcord/commits/master" target="_blank" rel="noopener" class="footer-link">Commits</a></li>
            </ul>
        </div>
    </footer>

    <div id="toast" class="toast">Command copied to clipboard</div>

    <script>
        // 1. Ambient Cursor Spotlight Tracking
        const cursorGlow = document.getElementById('cursor-glow');
        let mouseX = -1000, mouseY = -1000;
        let currentX = -1000, currentY = -1000;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animateGlow() {
            currentX += (mouseX - currentX) * 0.15;
            currentY += (mouseY - currentY) * 0.15;
            cursorGlow.style.transform = \`translate3d(\${currentX}px, \${currentY}px, 0)\`;
            requestAnimationFrame(animateGlow);
        }
        animateGlow();

        // 2. Bento Card Interactive Spotlight
        document.querySelectorAll('.spotlight-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', \`\${x}px\`);
                card.style.setProperty('--mouse-y', \`\${y}px\`);
            });
        });

        // 3. 3D Tilt on Window Preview Frame
        const windowFrame = document.getElementById('interactive-window');
        if (windowFrame) {
            windowFrame.addEventListener('mousemove', (e) => {
                const rect = windowFrame.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const centerX = rect.width / 2;
                const centerY = rect.height / 2;
                const rotateX = ((y - centerY) / centerY) * -3.5;
                const rotateY = ((x - centerX) / centerX) * 3.5;
                windowFrame.style.transform = \`rotateX(\${rotateX}deg) rotateY(\${rotateY}deg)\`;
            });
            windowFrame.addEventListener('mouseleave', () => {
                windowFrame.style.transform = 'rotateX(0deg) rotateY(0deg)';
            });
        }

        // 4. Ambient Floating Dust Particles Canvas
        const canvas = document.getElementById('particle-canvas');
        const ctx = canvas.getContext('2d');
        let width = canvas.width = window.innerWidth;
        let height = canvas.height = window.innerHeight;

        window.addEventListener('resize', () => {
            width = canvas.width = window.innerWidth;
            height = canvas.height = window.innerHeight;
        });

        const particles = Array.from({ length: 45 }, () => ({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            radius: Math.random() * 1.2 + 0.5,
            alpha: Math.random() * 0.4 + 0.1
        }));

        function drawParticles() {
            ctx.clearRect(0, 0, width, height);
            ctx.fillStyle = "#ffffff";

            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                p.x += p.vx;
                p.y += p.vy;

                if (p.x < 0) p.x = width;
                if (p.x > width) p.x = 0;
                if (p.y < 0) p.y = height;
                if (p.y > height) p.y = 0;

                ctx.globalAlpha = p.alpha;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();

                // Draw connecting micro-lines if close
                for (let j = i + 1; j < particles.length; j++) {
                    const p2 = particles[j];
                    const dx = p.x - p2.x;
                    const dy = p.y - p2.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 100) {
                        ctx.strokeStyle = "rgba(255, 255, 255, " + (0.07 * (1 - dist / 100)) + ")";
                        ctx.lineWidth = 0.6;
                        ctx.beginPath();
                        ctx.moveTo(p.x, p.y);
                        ctx.lineTo(p2.x, p2.y);
                        ctx.stroke();
                    }
                }
            }

            requestAnimationFrame(drawParticles);
        }
        drawParticles();

        // 5. Scroll Reveal with Intersection Observer
        const revealObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, { threshold: 0.12 });

        document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

        // 6. Interactive CLI copy & Toast
        function copyCli() {
            const cmd = 'irm https://raw.githubusercontent.com/domdoesntdodrip/dimcord/master/DimcordInstaller.exe -o DimcordInstaller.exe; .\\\\DimcordInstaller.exe';
            navigator.clipboard.writeText(cmd).then(() => {
                showToast("Quick-install command copied!");
            });
        }

        function showToast(msg) {
            const toast = document.getElementById("toast");
            toast.textContent = msg;
            toast.classList.add("show");
            setTimeout(() => toast.classList.remove("show"), 2200);
        }

        // 7. Tab Switching
        function switchTab(tabId, el) {
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.getElementById(tabId).classList.add("active");
            el.classList.add("active");
        }
    </script>
</body>
</html>`;

fs.writeFileSync("C:/Users/domcu/Downloads/dimcord/index.html", html, "utf-8");
fs.writeFileSync("C:/Users/domcu/Downloads/dimcord/dimcord-main/index.html", html, "utf-8");
console.log("Animated website generated successfully!");
