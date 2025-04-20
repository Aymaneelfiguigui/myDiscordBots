# myDiscordBots

A collection of Discord bots I've built, each serving a unique purpose—from gaming utilities to entertainment features.

## 📋 Table of Contents

- [Overview](#overview)
- [Bots](#bots)
  - [🎮 Warzone Meta-Loadout Bot](#-warzone-meta-loadout-bot)
  - [🧠 Valorant Prediction Bot](#-valorant-prediction-bot)
  - [🗣️ Voice Phrase Bot](#-voice-phrase-bot)
  - [📡 Twitch/Kick Audio Streamer Bot](#-twitchkick-audio-streamer-bot)
  - [🟩 Wordle Discord Activity](#-wordle-discord-activity)
- [Setup](#setup)
- [Contributing](#contributing)
- [License](#license)

---

## 🧾 Overview

This repository includes multiple standalone Discord bots. Each one is written in JavaScript using `node.js` and can be run individually. Just plug in your bot token and you're good to go!

---

## 🤖 Bots

### 🎮 Warzone Meta-Loadout Bot

Fetches up-to-date Warzone loadouts based on gun names. Aggregates meta data from multiple sources and displays interactive loadouts.

### 🧠 Valorant Prediction Bot

Analyzes data from different esports sources to give you smart betting predictions and match insights for Valorant tournaments.

### 🗣️ Voice Phrase Bot

Speaks user-submitted phrases in real time in a Discord voice channel. Great for fun interactions and meme delivery.

### 📡 Twitch/Kick Audio Streamer Bot

Streams **audio-only** from Twitch and Kick into a Discord VC. Bypasses video buffering and keeps things super lightweight.

### 🟩 Wordle Discord Activity

A real-time multiplayer Wordle game built with [PlayroomKit](https://playroomkit.com). Friends in the same VC can join and compete live.

---

## 🛠 Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/yourusername/myDiscordBots.git
   cd myDiscordBots
Install dependencies (if any):

npm install

Add your Discord bot token:

Each bot script has a placeholder for the bot token.

Replace it with your own from the Discord Developer Portal.

Run the bot:

node botFileName.js
