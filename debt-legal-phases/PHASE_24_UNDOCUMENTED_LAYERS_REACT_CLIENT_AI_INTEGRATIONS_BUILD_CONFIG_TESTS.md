# Phase 24 — Undocumented Layers: React Client, AI Integrations, Build System, Configuration & Tests

**Document**: Source-Verified Technical Reference  
**Date**: 11 March 2026  
**Scope**: Everything NOT covered in Phases 1–23: React/client parallel frontend (~66K lines, 154 files), Replit AI integrations (chat/audio/image/batch), build system, root configuration files, test suite, API specification files, environment/deployment config, and attached reference assets.

---

## Table of Contents

1. [React Client Layer (Parallel Frontend)](#1-react-client-layer-parallel-frontend)
2. [Replit AI Integrations](#2-replit-ai-integrations)
3. [Root Configuration Files](#3-root-configuration-files)
4. [Build System](#4-build-system)
5. [Test Suite](#5-test-suite)
6. [API Specification Files](#6-api-specification-files)
7. [Environment & Deployment Configuration](#7-environment--deployment-configuration)
8. [Attached Reference Assets](#8-attached-reference-assets)
9. [Shared Chat Model](#9-shared-chat-model)
10. [Complete File Manifest (Previously Undocumented)](#10-complete-file-manifest)

---

## 1. React Client Layer (Parallel Frontend)

**Location**: `client/src/`  
**Total Files**: 154 TypeScript/TSX files  
**Total Lines**: ~76,618  
**Framework**: React 19 + Wouter routing + TanStack React Query + Radix UI + shadcn/ui  
**Status**: Exists alongside the Angular 19 frontend. In development, only Angular runs via the workflow (`ng serve` on port 5000). In production, `server/static.ts` looks for build output in priority order: (1) Angular dist (`angular-client/dist/angular-client/browser/`), (2) `dist/public/` (React Vite build). The `npm run build` script in `script/build.ts` builds the React client to `dist/public/`, so if Angular dist is not present, the React build is served instead. The `.replit` deployment config uses `publicDir = dist/public`.

### 1.1 Architecture Overview

The React client is a full parallel implementation of the POS system using a completely different tech stack from Angular:

| Aspect | Angular (Primary) | React (Parallel) |
|---|---|---|
| Framework | Angular 19 standalone | React 19 |
| Routing | Angular Router (lazy) | Wouter |
| State | Angular signals | React Context + useState |
| HTTP | HttpClient + ApiService | fetch() via `external-api.ts` |
| Components | Separate .ts/.html/.css files | Single .tsx files |
| UI Library | Custom Angular components | shadcn/ui (Radix-based) |
| Styling | Tailwind + CSS variables | Tailwind + shadcn theme |
| Served via | `ng serve` (port 5000) | Vite dev (port 5000, unused) |

### 1.2 Entry Points

| File | Lines | Purpose |
|---|---|---|
| `client/src/main.tsx` | 20 | Standard React DOM root mount with HMR |
| `client/src/App.tsx` | 243 | Wouter router with all routes, ErrorBoundary, PosProvider, QueryClientProvider |
| `client/src/mount.ts` | 49 | Programmatic mount API: `render(container, props)` for embedding as library |
| `client/src/web-component.tsx` | 110 | Web Component wrapper (`<pos-app>`) using Shadow DOM, custom element `PosAppElement` |

**Web Component Export**: The React app can be packaged as a `<pos-app>` custom element via `vite.config.lib.ts`, exposing a Shadow DOM-isolated web component with `api-base-url` and `auth-token` attributes.

### 1.3 Pages (40,060 lines total)

| File | Lines | Route | Purpose |
|---|---|---|---|
| `pages/pos.tsx` | ~2,000+ | `/pos` | Main POS transacting page |
| `pages/enquiries-general.tsx` | 1,943 | `/enquiries` | Multi-tab account enquiry view |
| `pages/enquiries/account-tabs.tsx` | 1,842 | (embedded) | Account, Name, Property, Linked, Contact tabs |
| `pages/enquiries/service-tabs.tsx` | 2,904 | (embedded) | Services, Meters, Consumption tabs |
| `pages/enquiries/transaction-tabs.tsx` | 2,673 | (embedded) | Transactions, Receipts, Deposits, Statements tabs |
| `pages/enquiries/financial-tabs.tsx` | 1,501 | (embedded) | Balance/Debt, Payment Plans, Billed vs Paid tabs |
| `pages/enquiries/other-tabs.tsx` | 3,172 | (embedded) | Clearance, Notes, Section 129, Occupiers, etc. |
| `pages/enquiries/search-components.tsx` | — | (embedded) | Quick/Advanced search forms |
| `pages/enquiries/shared.tsx` | — | (embedded) | Shared enquiry utilities |
| `pages/supervisor-dashboard.tsx` | 2,678 | `/supervisor` | Supervisor dashboard |
| `pages/view-receipts.tsx` | 1,848 | `/receipts` | Receipt search and view |
| `pages/billing-dashboard.tsx` | 988 | `/billing-dashboard` | Billing category dashboard |
| `pages/cashier-setup.tsx` | 843 | `/cashier-setup` | Cashier session setup |
| `pages/cashier-day-end.tsx` | 860 | `/cashier-day-end` | Day-end reconciliation |
| `pages/home.tsx` | — | `/` | Home/landing page |
| `pages/login.tsx` | — | `/login` | Login form |
| `pages/settings.tsx` | — | `/settings` | Settings page |
| `pages/not-found.tsx` | — | `*` | 404 page |
| `pages/placeholder-page.tsx` | — | various | Generic placeholder |
| `pages/client-communications.tsx` | 967 | `/communications` | Client communications |
| `pages/bulk-allocation-progress.tsx` | 1,406 | `/bulk-allocation-progress` | Bulk allocation tracking |
| `pages/third-party/payment-processing.tsx` | 2,817 | `/third-party/payments` | Third-party payment processing |
| `pages/direct-deposits/manual/unmatched-queue.tsx` | — | `/direct-deposits/unmatched` | Unmatched deposit queue |
| `pages/direct-deposits/manual/allocate-transaction.tsx` | — | `/direct-deposits/allocate` | Manual allocation |
| `pages/direct-deposits/manual/allocation-history.tsx` | — | `/direct-deposits/history` | Allocation history |
| `pages/direct-deposits/auto/auto-allocation.tsx` | — | `/direct-deposits/auto` | Auto-allocation with AI |

#### Debt Management Pages (React)

| File | Lines | Route |
|---|---|---|
| `pages/debt/section129-notices.tsx` | 1,018 | `/debt/section129/notices` |
| `pages/debt/section129-config.tsx` | 665 | `/debt/section129/config` |
| `pages/debt/section129-trial-review.tsx` | — | `/debt/section129/trial-review` |
| `pages/debt/section129-authorization.tsx` | — | `/debt/section129/authorization` |
| `pages/debt/section129-report.tsx` | — | `/debt/section129/report` |
| `pages/debt/handover-management.tsx` | 691 | `/debt/handover` |
| `pages/debt/handover-termination.tsx` | — | `/debt/handover/termination` |
| `pages/debt/handover-report.tsx` | — | `/debt/handover/report` |
| `pages/debt/risk-scoring.tsx` | — | `/debt/risk-scoring` |
| `pages/debt/qualification-rules.tsx` | — | `/debt/qualification` |
| `pages/debt/communication-timeline.tsx` | — | `/debt/communication/timeline` |
| `pages/debt/communication-dashboard.tsx` | — | `/debt/communication/dashboard` |
| `pages/debt/sms-log-report.tsx` | — | `/debt/sms-log-report` |
| `pages/debt/batch-processing.tsx` | — | `/debt/batch` |
| `pages/debt/process-monitoring.tsx` | — | `/debt/monitoring` |
| `pages/debt/document-templates.tsx` | — | `/debt/documents` |
| `pages/debt/digital-signatures.tsx` | 540 | `/debt/signatures` |
| `pages/debt/process-engine.tsx` | 873 | `/debt/engine` |

#### Legal & Analytics Pages (React)

| File | Route |
|---|---|
| `pages/legal/rules.tsx` | `/legal/rules` |
| `pages/legal/audit-trail.tsx` | `/legal/audit-trail` |
| `pages/legal/evidence-bundle.tsx` | `/legal/evidence-bundle` |
| `pages/analytics/executive-dashboard.tsx` | `/analytics/executive` |
| `pages/analytics/predictive-forecasting.tsx` | `/analytics/forecasting` |
| `pages/analytics/geographic-mapping.tsx` | `/analytics/geographic` |

### 1.4 Core Libraries (10,309 lines total)

| File | Lines | Purpose |
|---|---|---|
| `lib/external-api.ts` | 3,686 | HTTP API layer — all `fetch()` calls to Express backend, auth headers, response handling, error mapping |
| `lib/pos-state.tsx` | 2,987 | React Context-based POS state: basket, session, payment tracking, signal-equivalent for React |
| `lib/enquiries-service.ts` | 1,376 | Enquiry tab data fetching, search, formatting |
| `lib/property-letters-pdf.ts` | 527 | Section 49/78 property letter PDF generation |
| `lib/receipt-print.ts` | 478 | Receipt printing with jsPDF |
| `lib/excel-export.ts` | 447 | Excel/CSV export using ExcelJS |
| `lib/statement-pdf.ts` | 246 | Statement PDF generation |
| `lib/pos-logic.ts` | 130 | POS business logic (rounding, validation) |
| `lib/category-icons.ts` | 119 | Billing category icon mapping |
| `lib/allocation-logic.ts` | 90 | Direct deposit allocation algorithms |
| `lib/service-lookups.ts` | 77 | Service type lookup helpers |
| `lib/queryClient.ts` | 65 | TanStack React Query client config |
| `lib/pos-config-context.tsx` | 55 | API URL resolution + auth header context |
| `lib/direct-deposits-logic.ts` | 18 | Direct deposit matching helpers |
| `lib/direct-deposits-data.ts` | — | Deposit data types |
| `lib/mock-data.ts` | — | Development mock data |
| `lib/utils.ts` | — | General utilities (cn, classnames) |

### 1.5 POS Components (React-specific)

| File | Purpose |
|---|---|
| `components/pos/unified-search.tsx` | Multi-type search (accounts, prepaid, misc, groups) |
| `components/pos/search-component.tsx` | Account search form |
| `components/pos/consumer-search-form.tsx` | Consumer-specific search |
| `components/pos/payment-drawer.tsx` | Payment tender drawer |
| `components/pos/receipt-modal.tsx` | Post-payment receipt display |
| `components/pos/receipt-template.tsx` | Receipt HTML template |
| `components/pos/pos-receipt-template.tsx` | POS-specific receipt template |
| `components/pos/permit-template.tsx` | Permit/certificate template |
| `components/pos/transaction-panels.tsx` | Transaction detail panels |
| `components/pos/transaction-history-modal.tsx` | Transaction history modal |
| `components/pos/day-end-modal.tsx` | Day-end confirmation modal |
| `components/pos/drop-box-modal.tsx` | Drop-box payment modal |
| `components/pos/easy-pay-modal.tsx` | EasyPay integration modal |
| `components/pos/account-enquiry-view.tsx` | Inline account enquiry |
| `components/account-enquiry-dialog.tsx` | Account enquiry dialog |
| `components/layout/pos-layout.tsx` | POS page layout shell |

### 1.6 UI Component Library (shadcn/ui)

57 Radix-based UI components in `client/src/components/ui/`:

accordion, alert, alert-dialog, aspect-ratio, avatar, badge, breadcrumb, button, button-group, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, date-picker, dialog, drawer, dropdown-menu, empty, field, form, help-tip, hover-card, input, input-group, input-otp, item, kbd, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toast, toaster, toggle, toggle-group, tooltip, virtual-numpad

### 1.7 React Models & Services

| File | Purpose |
|---|---|
| `models/debt.models.ts` | Debt TypeScript interfaces (React-side) |
| `models/legal.models.ts` | Legal TypeScript interfaces (React-side) |
| `models/analytics.models.ts` | Analytics TypeScript interfaces (React-side) |
| `services/debt-config.ts` | Debt configuration constants |
| `services/format.service.ts` | Formatting utilities |
| `services/validation.service.ts` | Validation utilities |
| `hooks/use-toast.ts` | Toast notification hook |
| `hooks/use-mobile.tsx` | Mobile detection hook |
| `hooks/use-municipality-info.ts` | Municipality info hook |

### 1.8 Relationship to Angular

The React client and Angular client are **parallel implementations** of the same POS system:
- Both connect to the same Express backend on port 3000
- Both use the same Platinum API proxy routes
- In development, **only Angular runs on port 5000** via the workflow configuration
- The React Vite dev server is NOT started by the workflow
- `vite.config.lib.ts` can build the React app as a web component bundle (`<pos-app>`)
- **Production serving priority** (`server/static.ts`): Tries Angular dist first (`angular-client/dist/angular-client/browser/`), then falls back to `dist/public/` (React Vite build output). The `.replit` deployment build command (`npm run build`) runs `script/build.ts` which builds the React client to `dist/public/`. So unless Angular is separately built, deployment serves the React frontend.

---

## 2. Replit AI Integrations

**Location**: `server/replit_integrations/`  
**Total Files**: 11 TypeScript files  
**Total Lines**: 870  
**Provider**: OpenAI via Replit AI Integrations (env vars: `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`)

### 2.1 Chat Module

**Files**: `chat/index.ts` (3 lines), `chat/routes.ts` (118 lines), `chat/storage.ts` (43 lines)

**Exports**: `registerChatRoutes`, `chatStorage`, `IChatStorage`

**Routes Registered**:

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/conversations` | List all conversations (newest first) |
| GET | `/api/conversations/:id` | Get conversation with messages |
| POST | `/api/conversations` | Create new conversation `{ title }` |
| DELETE | `/api/conversations/:id` | Delete conversation (cascades messages) |
| POST | `/api/conversations/:id/messages` | Send message, get SSE-streamed AI response |

**Chat SSE Streaming**:
- User message saved to DB → conversation history loaded → sent to OpenAI `gpt-5.1` with `max_completion_tokens: 8192`
- Response streamed via Server-Sent Events: `data: {"content": "..."}\n\n`
- Final assistant message saved to DB → `data: {"done": true}\n\n`
- On error during stream: `data: {"error": "..."}\n\n`

**Storage** (`chatStorage`):
- Uses Drizzle ORM against PostgreSQL (`conversations` and `messages` tables)
- Imported from `../../db` (the shared DB pool)
- Delete cascades: deleting conversation first deletes all its messages

### 2.2 Audio Module

**Files**: `audio/index.ts` (14 lines), `audio/routes.ts` (136 lines), `audio/client.ts` (274 lines)

**Exports**: `registerAudioRoutes`, `openai`, `detectAudioFormat`, `convertToWav`, `ensureCompatibleFormat`, `AudioFormat`, `voiceChat`, `voiceChatStream`, `textToSpeech`, `textToSpeechStream`, `speechToText`, `speechToTextStream`

**Routes**: Registers the same `/api/conversations/*` routes as chat but adds voice message support:
- `POST /api/conversations/:id/messages` accepts `{ audio: base64, voice: "alloy" }` with 50MB body limit
- Flow: Detect audio format → convert to WAV → transcribe (gpt-4o-mini-transcribe) → get conversation history → stream audio response via SSE

**Client Functions**:
- `detectAudioFormat(buffer)` → identifies `wav`, `mp3`, `webm`, `ogg`, `mp4`, `flac` from magic bytes
- `convertToWav(buffer, format)` → spawns `ffmpeg` child process for format conversion
- `ensureCompatibleFormat(buffer)` → auto-detect + convert if needed
- `speechToText(buffer, format)` → OpenAI `gpt-4o-mini-transcribe` transcription
- `speechToTextStream(buffer, format)` → streaming transcription with `transcript.text.delta` events
- `textToSpeech(text, voice, options)` → OpenAI `gpt-4o-mini-tts` with format/speed options
- `textToSpeechStream(text, voice, options)` → streaming TTS
- `voiceChat(messages, voice)` → Full voice conversation response (gpt-4o-audio-preview, modality: text+audio)
- `voiceChatStream(messages, voice)` → Streaming voice response with audio chunks

### 2.3 Image Module

**Files**: `image/index.ts` (3 lines), `image/routes.ts` (31 lines), `image/client.ts` (59 lines)

**Exports**: `registerImageRoutes`, `openai`, `generateImageBuffer`, `editImages`

**Routes**:

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/generate-image` | Generate image from `{ prompt, size }` using `gpt-image-1` |

**Client Functions**:
- `generateImageBuffer(prompt, size)` → Returns `Buffer` of generated image
- `editImages(imageFiles, prompt, outputPath?)` → Composite/edit multiple images, optionally save to disk

### 2.4 Batch Module

**Files**: `batch/index.ts` (7 lines), `batch/utils.ts` (182 lines)

**Exports**: `batchProcess`, `batchProcessWithSSE`, `isRateLimitError`, `BatchOptions`

**No routes** — utility-only module for batch LLM processing.

**`batchProcess(items, processor, options)`**:
- Generic batch processor with `p-limit` concurrency control (default: 2) and `p-retry` rate-limit handling (default: 7 retries)
- Exponential backoff: 2s → 128s max
- Aborts immediately on non-rate-limit errors
- Optional `onProgress` callback

**`batchProcessWithSSE(items, processor, sendEvent, options)`**:
- Sequential processing with SSE progress events
- Events: `started`, `processing`, `progress`, `complete`
- Tracks error count, returns placeholder `undefined` for failed items

### 2.5 Integration Registration

**IMPORTANT**: As of the current codebase, **none of these AI integration routes are actively registered**. `server/routes/index.ts` only registers the POS/billing route modules (auth, pos, billing, clearance, enquiries, dayend, deposits, supervisor, receipts, debt, legal, communications, analytics). No call to `registerChatRoutes`, `registerAudioRoutes`, or `registerImageRoutes` exists in `server/index.ts` or the route registration system. The modules exist as available-but-dormant infrastructure.

The chat and audio modules share the same `/api/conversations/*` endpoint namespace — if both were registered, audio routes would override chat routes (both register identical GET/POST/DELETE conversation endpoints).

### 2.6 Client-Side Audio Hooks

**Location**: `client/replit_integrations/audio/`  
**Total Files**: 6 (5 TypeScript + 1 JavaScript)  
**Total Lines**: ~329 (TypeScript only)

React hooks for voice interaction in the React client:

| File | Lines | Purpose |
|---|---|---|
| `index.ts` | 45 | Re-exports all hooks and utilities |
| `audio-utils.ts` | 36 | Audio format detection and buffer helpers |
| `useAudioPlayback.ts` | 105 | React hook for playing back audio buffers/streams via AudioWorklet |
| `useVoiceRecorder.ts` | 52 | React hook for recording voice input via MediaRecorder API |
| `useVoiceStream.ts` | 91 | React hook for streaming voice chat (record → transcribe → AI response → playback) |
| `audio-playback-worklet.js` | — | AudioWorklet processor for streaming audio playback |

**Status**: Available infrastructure. Only usable if the server-side audio routes are registered (currently dormant, see §2.5).

---

## 3. Root Configuration Files

### 3.1 package.json

**File**: `package.json` (root)  
**Name**: `rest-express`  
**Version**: `1.0.0`  
**Type**: `module` (ESM)

**Scripts**:

| Script | Command | Purpose |
|---|---|---|
| `dev` | `NODE_ENV=development tsx server/index.ts` | Start Express dev server only |
| `dev:client` | `vite dev --port 5000` | Start React Vite dev server (unused by workflow) |
| `build` | `tsx script/build.ts` | Production build (Vite client + esbuild server) |
| `start` | `NODE_ENV=production node dist/index.cjs` | Start production server |
| `check` | `tsc` | TypeScript type checking |
| `db:push` | `drizzle-kit push` | Push schema to database |

**Dependencies (79 packages)**:

| Category | Packages | Used By |
|---|---|---|
| React UI | 25× `@radix-ui/react-*`, `react`, `react-dom`, `wouter`, `@tanstack/react-query`, `@tanstack/react-virtual`, `embla-carousel-react`, `react-resizable-panels`, `react-day-picker`, `react-hook-form`, `@hookform/resolvers`, `react-to-print`, `recharts`, `sonner`, `vaul`, `cmdk`, `input-otp`, `next-themes`, `framer-motion` | React client |
| CSS | `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css`, `class-variance-authority`, `clsx`, `@tailwindcss/postcss` | Both clients |
| Angular | `lucide-angular` | Angular client |
| React Icons | `lucide-react` | React client |
| Express | `express`, `express-session`, `memorystore`, `passport`, `passport-local` | Server |
| Database | `drizzle-orm`, `drizzle-zod`, `pg` | Server |
| PDF | `jspdf`, `jspdf-autotable`, `pdf-lib`, `pdf-parse` | Server + clients |
| Excel | `exceljs`, `xlsx`, `xlsx-js-style` | Server + clients |
| AI | `openai` | Replit integrations |
| Utilities | `concurrently`, `date-fns`, `p-limit`, `p-retry`, `ws`, `zod`, `zod-validation-error` | Various |
| Testing | `vitest`, `@vitest/coverage-v8` | Tests |

**Dev Dependencies (22 packages)**:

| Category | Packages |
|---|---|
| Replit Plugins | `@replit/vite-plugin-cartographer`, `@replit/vite-plugin-dev-banner`, `@replit/vite-plugin-runtime-error-modal` |
| Build | `@vitejs/plugin-react`, `@tailwindcss/vite`, `esbuild`, `vite`, `tsx`, `typescript`, `drizzle-kit` |
| CSS | `autoprefixer`, `postcss`, `tailwindcss` |
| Types | `@types/connect-pg-simple`, `@types/express`, `@types/express-session`, `@types/node`, `@types/passport`, `@types/passport-local`, `@types/react`, `@types/react-dom`, `@types/ws` |

### 3.2 Angular package.json

**File**: `angular-client/package.json`

| Dependency | Version | Purpose |
|---|---|---|
| `@angular/common` | ^21.2.0 | Angular core |
| `@angular/compiler` | ^21.2.0 | Template compiler |
| `@angular/core` | ^21.2.0 | Framework core |
| `@angular/forms` | ^21.2.0 | Reactive/template forms |
| `@angular/platform-browser` | ^21.2.0 | Browser rendering |
| `@angular/router` | ^21.2.0 | Client-side routing |
| `rxjs` | ~7.8.0 | Reactive streams |
| `tslib` | ^2.3.0 | TypeScript helpers |
| `@angular/build` (dev) | ^21.2.1 | Build tooling |
| `@angular/cli` (dev) | ^21.2.1 | CLI tooling |
| `@angular/compiler-cli` (dev) | ^21.2.0 | AOT compilation |
| `typescript` (dev) | ~5.9.2 | TypeScript |
| `prettier` (dev) | ^3.8.1 | Code formatting |

### 3.3 tsconfig.json (Root)

**File**: `tsconfig.json`

```
Target: ES2020
Module: ESNext
Module Resolution: bundler
Strict: true
JSX: preserve
Path aliases: @/* → ./client/src/*, @shared/* → ./shared/*
Includes: client/src/**/* , shared/**/* , server/**/*
Excludes: node_modules, build, dist, **/*.test.ts
```

### 3.4 vite.config.ts (Main)

**File**: `vite.config.ts`

- Plugins: `react()`, `runtimeErrorOverlay()`, `tailwindcss()`, `metaImagesPlugin()`, plus dev-only `cartographer()` and `devBanner()` (Replit plugins)
- Aliases: `@` → `client/src`, `@shared` → `shared`, `@assets` → `attached_assets`
- Root: `client/`
- Build output: `dist/public`
- Server: host `0.0.0.0`, strict FS, deny dotfiles

### 3.5 vite.config.lib.ts (Library Build)

**File**: `vite.config.lib.ts`

Builds the React app as an embeddable library/web component:
- Entry: `client/src/mount.ts`
- Output: `dist/bundle.js` (ESM format)
- Single file: `inlineDynamicImports: true`, `cssCodeSplit: false`
- Produces: `bundle.js` + `bundle.css`

### 3.6 vite-plugin-meta-images.ts

**File**: `vite-plugin-meta-images.ts` (78 lines)

Custom Vite plugin that:
- Detects Replit deployment domain (`REPLIT_INTERNAL_APP_DOMAIN` or `REPLIT_DEV_DOMAIN`)
- Looks for `opengraph.png/jpg/jpeg` in `client/public/`
- Updates `og:image` and `twitter:image` meta tags in `index.html` with full URLs

### 3.7 vitest.config.ts

**File**: `vitest.config.ts`

```
Environment: node
Test files: tests/**/*.test.ts
Timeout: 10,000ms
Setup: tests/setup.ts
Aliases: @, @shared
```

### 3.8 drizzle.config.ts

**File**: `drizzle.config.ts`

```
Schema: ./shared/schema.ts
Dialect: postgresql
Migrations output: ./migrations/
Credentials: DATABASE_URL env var (required)
```

### 3.9 postcss.config.js

**File**: `postcss.config.js`

Plugins: `tailwindcss`, `autoprefixer`

### 3.10 components.json (shadcn/ui)

**File**: `components.json`

shadcn/ui configuration:
- Style: `new-york`
- RSC: `false`
- TSX: `true`
- Base color: `neutral`
- CSS variables: `true`
- Icon library: `lucide`
- Aliases: `@/components`, `@/lib/utils`, `@/components/ui`, `@/lib`, `@/hooks`

---

## 4. Build System

### 4.1 script/build.ts

**File**: `script/build.ts` (64 lines)

Production build process (two-stage):

**Stage 1 — Client Build**:
- `viteBuild()` compiles React client → `dist/public/`
- Uses `vite.config.ts` settings

**Stage 2 — Server Build**:
- `esbuild` bundles `server/index.ts` → `dist/index.cjs` (CJS format, minified)
- Platform: node
- Selected deps bundled (allowlist): express, drizzle-orm, pg, openai, passport, ws, xlsx, zod, etc.
- All other deps externalized (not bundled)

**Allowlist** (deps bundled into server for faster cold starts):
`@google/generative-ai`, `axios`, `connect-pg-simple`, `cors`, `date-fns`, `drizzle-orm`, `drizzle-zod`, `express`, `express-rate-limit`, `express-session`, `jsonwebtoken`, `memorystore`, `multer`, `nanoid`, `nodemailer`, `openai`, `passport`, `passport-local`, `pg`, `stripe`, `uuid`, `ws`, `xlsx`, `zod`, `zod-validation-error`

### 4.2 server/vite.ts (Dev Middleware)

**File**: `server/vite.ts` (50 lines)

Creates Vite dev server in middleware mode (for React HMR in development):
- HMR path: `/vite-hmr`
- Serves transformed `client/index.html` with cache-busting via `nanoid()`
- Only used when Express runs in development mode with React frontend
- **NOT USED** in the current workflow (Angular dev server runs instead)

---

## 5. Test Suite

**Location**: `tests/`  
**Total Files**: 4  
**Total Lines**: 1,092  
**Framework**: Vitest

### 5.1 Test Setup

**File**: `tests/setup.ts` (8 lines)

- Stubs global `fetch` with `vi.fn()`
- Mocks `@/lib/pos-config-context`: `resolveApiUrl` returns `http://localhost:5000{path}`, `getAuthHeaders` returns `{ 'Content-Type': 'application/json' }`

### 5.2 Test Files

| File | Lines | Tests |
|---|---|---|
| `tests/pos-transactions.test.ts` | 541 | POS transaction processing, payment submission, receipt generation |
| `tests/enquiries-service.test.ts` | 353 | Enquiry data fetching, search, tab rendering |
| `tests/allocation-logic.test.ts` | 190 | Direct deposit allocation matching, scoring |

### 5.3 Test Execution

```bash
npx vitest run           # Single run
npx vitest               # Watch mode
npx vitest --coverage    # With V8 coverage
```

---

## 6. API Specification Files

### 6.1 platinum-openapi.json

**File**: `platinum-openapi.json`  
**Size**: 955 KB (954,993 bytes)  
**Format**: OpenAPI 3.0.1

The official Platinum Inzalo EMS API specification:
- Title: "InzaloEms"
- Description: "Municipal Enterprise Management System API"
- Server: `https://georgeplatinumuatapi.azurewebsites.net/`
- Contains full schema definitions for all Platinum controllers, request/response models, and endpoint paths

### 6.2 swagger.json

**File**: `swagger.json`  
**Size**: 129 KB (128,950 bytes)  
**Format**: OpenAPI 3.0.1

Billing microservice API specification:
- Title: "Sebata.Microservice.Billing"
- Contains OData endpoints (`/odata/BillingBillingCycleProcess`, etc.)
- Separate from the main Platinum API spec

---

## 7. Environment & Deployment Configuration

### 7.1 .replit

**File**: `.replit`

```
Modules: nodejs-20, web, postgresql-16
Nix channel: stable-24_05
Nix packages: poppler_utils (for PDF rendering)
Run command: npm run dev
Hidden files: .config, .git, generated-icon.png, node_modules, dist
```

**Port Mapping**:

| Local Port | External Port | Purpose |
|---|---|---|
| 3000 | 3000 | Express API server (dev) |
| 5000 | 80 | Angular dev server / Production server |
| 5001 | 3001 | Reserved (unused) |

**Deployment Configuration**:

| Setting | Value |
|---|---|
| Target | `autoscale` |
| Build command | `npm run build` |
| Public directory | `dist/public` |
| Run command | `node ./dist/index.cjs` |

**Agent Configuration**:

| Setting | Value |
|---|---|
| Stack | `MOCKUP_JS` |
| Mockup state | `FULLSTACK` |
| Integrations | `javascript_openai_ai_integrations:2.0.0` |

### 7.2 Environment Variables

**Shared (non-secret)**:

| Variable | Value | Purpose |
|---|---|---|
| `PORT` | `5000` | Production Express port |
| `TZ` | `Africa/Johannesburg` | Server timezone (SAST) |
| `PLATINUM_API_USERNAME` | `Francois` | Platinum API login user |
| `PLATINUM_API_DBNAME` | `George` | Platinum database name |
| `PLATINUM_API_URL` | `https://georgeplatinumuatapi.azurewebsites.net` | Platinum API base URL |

**Secrets (stored securely)**:

| Secret | Purpose |
|---|---|
| `PLATINUM_API_PASSWORD` | Platinum API password (used for token creation and refresh) |
| `DATABASE_URL` | PostgreSQL connection string (auto-provisioned by Replit) |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | OpenAI API key (via Replit AI Integrations) |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | OpenAI base URL (Replit proxy) |

### 7.3 Angular Entry Files

**`angular-client/src/index.html`**:
- Title: "Municipal POS System"
- OG tags: title + description for George Municipality
- Fonts: Inter (Google Fonts, weights 300-800), Material Icons
- Bootstrap element: `<app-root>`

**`angular-client/src/main.ts`**:
- `bootstrapApplication(App, appConfig)` — Angular standalone bootstrap, no NgModules

---

## 8. Attached Reference Assets

**Location**: `attached_assets/`  
**Contents**: User-uploaded reference materials

### 8.1 Document Templates

| File | Size | Purpose |
|---|---|---|
| `1._Sec_129_-_Letter_of_Demand_-_PART_1_*.docx` | 237 KB | Section 129 letter template Part 1 |
| `2._Sec_129_-_Letter_of_Demand_-_PART_2_*.docx` | 456 KB | Section 129 letter template Part 2 |
| `3._Sec_129_-_Letter_of_Demand_-_PART_3_*.docx` | 1.2 MB | Section 129 letter template Part 3 |
| `4._Sec_129_-_Letter_of_Demand_-_PART_4_*.docx` | 100 KB | Section 129 Final Run template |
| `5._Sec_129_-_Letter_of_Demand_-_PART_5_*.docx` | 366 KB | Section 129 Termination/Enquiries template |

### 8.2 Reference Materials

| File | Size | Purpose |
|---|---|---|
| `Handover_Workflow_V1_*.jpg` | 4.5 MB | Handover process workflow diagram |
| `ems_(1)_*.sql` | 7.6 MB | EMS database schema reference |
| `Example_screenshots_*.docx` | 1.5 MB | UI reference screenshots |

### 8.3 Screenshot References

~80+ PNG images (timestamp-named, e.g., `image_1770711789764.png`) — UI screenshots, design references, and workflow mockups used during development.

---

## 9. Shared Chat Model

**File**: `shared/models/chat.ts` (34 lines)

Drizzle schema for AI chat persistence, shared between server and clients:

**`conversations` table**:

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PRIMARY KEY |
| `title` | text | NOT NULL |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP, NOT NULL |

**`messages` table**:

| Column | Type | Constraints |
|---|---|---|
| `id` | serial | PRIMARY KEY |
| `conversation_id` | integer | NOT NULL, FK → conversations.id (CASCADE DELETE) |
| `role` | text | NOT NULL (`"user"` or `"assistant"`) |
| `content` | text | NOT NULL |
| `created_at` | timestamp | DEFAULT CURRENT_TIMESTAMP, NOT NULL |

**Zod Schemas**:
- `insertConversationSchema` — omits `id`, `createdAt`
- `insertMessageSchema` — omits `id`, `createdAt`

**Types exported**: `Conversation`, `InsertConversation`, `Message`, `InsertMessage`

---

## 10. Complete File Manifest (Previously Undocumented)

### 10.1 Files NOT covered in Phases 1–23

| Category | Files | Lines | Phase Coverage |
|---|---|---|---|
| React Client (`client/src/`) | 154 | ~76,618 | **None** — entirely undocumented |
| Client Audio Hooks (`client/replit_integrations/audio/`) | 6 | ~329 | **None** |
| AI Integrations (`server/replit_integrations/`) | 11 | 870 | Mentioned in Phase 13 (1 line), no detail |
| Shared Chat Model (`shared/models/chat.ts`) | 1 | 34 | **None** |
| Root Config (vite.config.ts, vite.config.lib.ts, vite-plugin-meta-images.ts, vitest.config.ts, drizzle.config.ts, postcss.config.js, components.json, tsconfig.json) | 8 | ~380 | Phase 21 covers angular.json, proxy.conf.json, tsconfig; rest undocumented |
| Build System (script/build.ts, server/vite.ts) | 2 | 114 | **None** |
| Test Suite (tests/) | 4 | 1,092 | **None** |
| API Specs (platinum-openapi.json, swagger.json) | 2 | ~37,000+ | **None** (Phase 22 catalogs used endpoints, not the spec files themselves) |
| .replit | 1 | 55 | **None** |
| package.json (root) | 1 | — | **None** |
| Angular package.json | 1 | — | **None** |
| Angular entry (index.html, main.ts) | 2 | 40 | **None** |
| Attached assets | ~85 | — | **None** |
| **Total Previously Undocumented** | **~276 files** | **~116,000+ lines** | |

### 10.2 Summary: What Phases 1–23 Cover vs Phase 24

| Phases 1–23 | Phase 24 |
|---|---|
| Angular 19 frontend (all components, services, models, routing) | React 19 parallel frontend (154 files, ~66K lines) |
| Express route handlers (13 files, all endpoints) | Replit AI integrations (chat, audio, image, batch) |
| Server infrastructure (platinum-auth, middleware, DB schema) | Build system (esbuild + Vite build, dev middleware) |
| Platinum API endpoint catalog (400 endpoints) | API specification files (OpenAPI/Swagger, 1.1MB) |
| End-to-end business flows (8 flows) | Test suite (3 test files, 1,092 lines) |
| Angular build config (angular.json, proxy.conf.json) | Root config (vite, vitest, drizzle, postcss, shadcn) |
| Theme/styles (styles.css) | Environment/deployment (.replit, package.json) |
| — | Shared chat model, attached reference assets |

---

**End of Phase 24**
