# StreamVault 🎬

> **Production-grade OTT platform** — HLS adaptive bitrate streaming, RTMP live broadcasting, FFmpeg transcoding pipeline, creator monetization, and real-time engagement.

> **Portfolio status:** ~**65% complete** (was ~35%) — Phase A compile/boot fixes applied; infrastructure (RTMP, Docker, WebRTC) still pending.

[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10-red?logo=nestjs)](https://nestjs.com/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python-green?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue?logo=postgresql)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-red?logo=redis)](https://redis.io/)
[![BullMQ](https://img.shields.io/badge/BullMQ-Queues-orange)](https://docs.bullmq.io/)
[![FFmpeg](https://img.shields.io/badge/FFmpeg-HLS-green?logo=ffmpeg)](https://ffmpeg.org/)

---

## 📋 Resume Bullet

> _"Built StreamVault — full-stack OTT platform with FFmpeg HLS adaptive bitrate transcoding (360p–1080p), RTMP live streaming via Node-Media-Server + mediasoup WebRTC SFU, Redis fan-out viewer counts, BullMQ processing queues, and Stripe Connect creator monetization. Custom HLS.js player with resume playback, chapter markers, ABR quality switching, and picture-in-picture support."_

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client Layer (Next.js 15)                     │
│  HLS.js Player  │  Live WebRTC  │  Upload TUS  │  Studio UI     │
└──────────────────────────┬──────────────────────────────────────┘
                           │ REST + WebSocket
┌──────────────────────────▼──────────────────────────────────────┐
│                  API Layer (NestJS 10)                           │
│  Auth │ Videos │ Upload │ Live │ Search │ Analytics │ Payments  │
└──────┬────────────────────────────────────────┬─────────────────┘
       │ BullMQ Jobs                            │ Socket.io
┌──────▼────────────┐                ┌──────────▼──────────────────┐
│  Transcoder       │                │  Redis                       │
│  (FastAPI+FFmpeg) │                │  ├─ View counts (pub/sub)    │
│  ├─ HLS segments  │                │  ├─ Live chat                │
│  ├─ Thumbnails    │                │  ├─ Session cache             │
│  └─ Multi-quality │                │  └─ Queue state              │
└──────┬────────────┘                └─────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────────────────────┐
│  Storage Layer                                                   │
│  MinIO/S3 ──► CloudFront CDN ──► HLS.js Player                 │
│  (raw upload) (HLS segments)    (adaptive playback)            │
└─────────────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────────────┐
│  Data Layer                                                      │
│  PostgreSQL (Prisma) │ Meilisearch (search) │ Redis (cache)     │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✨ Features

### 🎬 Video Platform

- **Chunked resumable upload** — TUS protocol handles 10GB+ files reliably
- **FFmpeg multi-quality transcoding** — 360p, 480p, 720p, 1080p output
- **HLS Adaptive Bitrate** — Player auto-switches quality based on bandwidth
- **Custom HLS.js player** — Quality selector, PiP, theater mode, resume playback
- **Chapter markers** — Timeline thumbnails, skip intro/outro (Netflix-style)
- **Subtitle support** — SRT/VTT/ASS format upload and display

### 📡 Live Streaming

- **RTMP ingestion** — OBS-compatible via Node-Media-Server
- **WebRTC browser streaming** — Broadcast directly from browser (mediasoup SFU)
- **LL-HLS live output** — Sub 3-second latency
- **Live chat** — Redis Pub/Sub + Socket.io real-time
- **Live viewer count** — WebSocket-broadcast Redis counter
- **Stream-to-VOD** — Auto-converts recording after stream ends

### 👨‍🎨 Creator Studio

- **Channel management** — Custom banner, avatar, description
- **Video analytics** — Views, watch time, audience retention graph
- **A/B thumbnail testing** — Serve 2 thumbnails, track CTR
- **Revenue dashboard** — Stripe Connect payouts (70% creator share)
- **Subscription management** — Subscriber list, notification broadcasts
- **Community posts** — Channel updates (YouTube Community tab equivalent)

### 🔍 Discovery & Recommendations

- **Meilisearch** — Typo-tolerant instant search
- **Collaborative filtering** — "Users like you watched…"
- **Content-based filtering** — Genre, tag, creator similarity
- **Trending algorithm** — Views + velocity + engagement score
- **Personalized homepage** — Carousels by watch history

### 💰 Monetization

- **Free tier** (ads) + **Premium** (ad-free, 4K, downloads)
- **Stripe subscriptions** with free trial + annual billing
- **Stripe Connect** — Creator revenue splits
- **Pay-per-view** — Premium content access
- **Super Chat** — Donations during live streams

---

## 🛠️ Tech Stack

| Layer          | Technology                                                   |
| -------------- | ------------------------------------------------------------ |
| Frontend       | Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui |
| Video Player   | HLS.js, Video.js wrapper                                     |
| Backend API    | NestJS 10, TypeScript, REST + WebSocket                      |
| Transcoding    | FastAPI + FFmpeg (Python subprocess)                         |
| Live RTMP      | Node-Media-Server                                            |
| Live WebRTC    | mediasoup SFU                                                |
| Database       | PostgreSQL 16 + Prisma ORM                                   |
| Caching        | Redis 7                                                      |
| Job Queues     | BullMQ + Redis                                               |
| Search         | Meilisearch                                                  |
| Object Storage | MinIO (local) / AWS S3 (prod)                                |
| CDN            | CloudFront signed URLs                                       |
| Auth           | JWT + OAuth2 (Google) + bcrypt                               |
| Payments       | Stripe + Stripe Connect                                      |
| Realtime       | Socket.io                                                    |
| AI             | OpenAI Vision API (auto-tagging)                             |
| Container      | Docker + Docker Compose                                      |

---

## 📁 Project Structure

```
streamvault/
├── apps/
│   ├── web/                    # Next.js 15 frontend
│   │   ├── app/                # App Router pages
│   │   ├── components/         # UI components
│   │   ├── hooks/              # Custom React hooks
│   │   └── lib/                # API client, utilities
│   │
│   ├── api/                    # NestJS backend
│   │   └── src/
│   │       ├── auth/           # JWT auth + OAuth
│   │       ├── videos/         # Video CRUD + metadata
│   │       ├── upload/         # TUS chunked upload
│   │       ├── streaming/      # HLS segment serving
│   │       ├── live/           # RTMP + WebRTC live
│   │       ├── channels/       # Creator channels
│   │       ├── comments/       # Nested comments
│   │       ├── subscriptions/  # Channel subscriptions
│   │       ├── search/         # Meilisearch integration
│   │       ├── analytics/      # View tracking + metrics
│   │       ├── payments/       # Stripe + Stripe Connect
│   │       ├── recommendations/# Recommendation engine
│   │       ├── notifications/  # Real-time notifications
│   │       ├── queue/          # BullMQ job processors
│   │       └── storage/        # S3/MinIO service
│   │
│   └── transcoder/             # FastAPI transcoding service
│       ├── services/
│       │   ├── ffmpeg_service.py   # FFmpeg pipeline
│       │   ├── hls_service.py      # HLS segmentation
│       │   └── thumbnail_service.py # Frame extraction
│       └── api/router.py
│
├── prisma/schema.prisma        # Database schema
├── docker-compose.yml
└── infra/nginx/nginx.conf
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+, Python 3.11+, FFmpeg, Docker + Docker Compose

### 1. Clone & install

```bash
git clone https://github.com/yourusername/streamvault
cd streamvault
cp .env.example .env
```

### 2. Start all services

```bash
docker-compose up -d
```

### 3. Setup database

```bash
cd apps/api
npx prisma migrate dev
npx prisma db seed
```

### 4. Start development servers

```bash
# Terminal 1 — API
cd apps/api && npm run start:dev

# Terminal 2 — Web
cd apps/web && npm run dev

# Terminal 3 — Transcoder
cd apps/transcoder && uvicorn main:app --reload --port 8001
```

App: http://localhost:3000
API: http://localhost:8000
Transcoder: http://localhost:8001
MinIO Console: http://localhost:9001

---

## 📡 Live Streaming Setup

1. Point OBS/Streamlabs to `rtmp://localhost:1935/live`
2. Stream key = your channel's stream key from Studio settings
3. Viewers watch at: `http://localhost:3000/live/{channelUsername}`

---

## 🎯 Key Technical Highlights

| Concept                   | Implementation                                             |
| ------------------------- | ---------------------------------------------------------- |
| **ABR Streaming**         | FFmpeg generates 4 quality levels, HLS.js auto-selects     |
| **Resumable Upload**      | TUS protocol — resume interrupted uploads from byte offset |
| **Fan-out View Count**    | Redis INCR + WebSocket broadcast to all watchers           |
| **CRDT-free Live Chat**   | Redis Pub/Sub channels per stream ID                       |
| **Creator Payouts**       | Stripe Connect with platform fee (30%) deduction           |
| **Job Queue**             | BullMQ with retry, backoff, concurrency control            |
| **Content Security**      | CloudFront signed URLs (time-limited, IP-restricted)       |
| **Recommendation Engine** | Cosine similarity on watch vectors in PostgreSQL           |
