# Municipal POS Receipting System V2

## Overview
This project is a React/Express/PostgreSQL web application prototype for a **Municipal Point-of-Sale (POS) Receipting System**. Its main purpose is to provide a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The system validates business logic, UI flows, and data models for a future Angular production environment. Key capabilities include a unified POS screen, split payments, cashier session management, float tracking, day-end reconciliation, supervisor dashboard, direct deposit allocation, receipt management (print, email, SMS), permit/certificate generation, and a Client Communications module. It is designed for high concurrency and integrates exclusively with the Platinum Inzalo EMS API.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Core Design Principles
The system is built on a React 18 frontend with TypeScript, Vite, and `wouter` for routing, styled with Tailwind CSS and `shadcn/ui`. State management uses React Context API, and data fetching relies on TanStack React Query. The Express 5 backend acts as an authenticated proxy to the Platinum Inzalo EMS API, managing user sessions with `express-session` and implementing concurrency features like a global request queue (MAX_CONCURRENT_REQUESTS=20) and response caching. A local PostgreSQL database is present but not used for business data; all operational data is managed via the Platinum API. The entire application is designed as a self-contained Web Component (`<pos-app>`) for embedding into existing Angular applications.

### UI/UX and Theming
The application supports multi-site theming via CSS custom properties, utilizing an accent color system (e.g., `--pos-accent`) for dynamic theme switching. Page layouts are standardized with sticky headers, scrollable content areas, and consistent styling for various components.

### API as Single Source of Truth
The Platinum Inzalo EMS API is the sole source of truth for all data. No fallbacks, mock data, or hardcoded values are used for business logic. All data must originate from the API, and explicit error handling is implemented for API call failures.

### Key Features and Implementations

#### Direct Deposit Allocation
The system supports direct deposit allocation, where submissions are batched server-side (`POST /api/dd-allocation/submit-batch`) and processed sequentially against the Platinum API in the background. Clients poll for progress. Specific payload specifications exist for various `BillType`s (Consumer Services, Clearance, Miscellaneous). A "Generic Import" tab allows CSV uploads for bulk direct deposit allocation, with client-side parsing, validation, and server-side batch submission.

The unmatched queue page features bulk selection (checkboxes with Select All for unmatched items), an "Auto-Match Page" function that runs smart suggestion analysis for all visible items in parallel batches of 5, and an inline Match column showing the best account match with confidence indicators (green 80%+, amber 60-79%). A floating dark-glass toolbar appears when items are selected, offering Auto-Match and Allocate Next actions. A floating progress bar (portaled to `document.body`) shows auto-match progress with live ETA, dynamically positioned above the selection toolbar when items are selected.

**AI-Enhanced Matching**: Each description is parsed by OpenAI (`POST /api/ai/parse-description`) in parallel with regex-based parsing. The AI extracts account numbers, ERF numbers, old account codes, meter numbers, person/company names, area keywords, and reference numbers. AI-identified identifiers that weren't already found by regex are then searched against all Platinum API endpoints (DD autocomplete, billing enquiry, old account autocomplete, payment accounts name search). This dual approach (regex for speed + AI for intelligence) ensures maximum match coverage. The OpenAI integration uses the standard `openai` npm package — for production Angular deployment, just swap the `AI_INTEGRATIONS_OPENAI_*` env vars to point to your own OpenAI API key.

**Institution/Payment Group Matching**: Institutions are cached via `loadInstitutionsCache()` (from `fetchInstitutions`). Description keywords are matched against institution names. Suggestions rendered in teal, clicking opens the full allocate-transaction page. Uses negative accountIds `-(100000 + inst.id)` to avoid collision.

**Clearance/Cost Schedule Matching**: Parses description for clearance IDs (CLR/CLEAR/CLEARANCE + number) and cost schedule IDs (CS/SCHEDULE + number). Also searches using account numbers and ERF numbers from clues. Uses `platinumDDClearanceAutocomplete` to find clearance records, then `platinumGetClearanceData` to load cost schedule details. Confidence boosted when: cost schedule status is approved/active (+10), transaction amount matches remaining amount exactly (+30) or closely (+20), clearance ID found in description (+15). Suggestions rendered in cyan, showing amount due and status badge. Uses negative accountIds `-(200000 + costScheduleID)`.

**Balance Enrichment**: After top 5 suggestions are selected, accounts missing balance data are enriched via `getAccountBalance()` in parallel. Balance shown color-coded: red (positive/owing), green (negative/credit), grey (zero).

**No hardcoded municipality data**: All area names, town codes, and SG code formats were removed. The system uses API autocomplete endpoints for SG code matching (padded ERF numbers), letting the API determine matches regardless of municipality structure. ERF numbers are also searched as old account codes. Name-based matching detects person names in descriptions using token-boundary comparisons, searches via `platinumSearchAccountsPayment({ name })` and `platinumDDAccountAutocomplete`, and assigns confidence scores based on exact surname matches and multi-token overlap. Banking descriptions also extract embedded names after stripping banking keywords. Number/name slash patterns (e.g. `69211/DHONDT`) extract both account numbers and surnames for parallel search.

**Comprehensive ERF Parsing**: 9 regex patterns handle: `ERF 234/12` (portion), `ERF158 PTN19 GEORGE` (PTN), `ERF 22468 UNIT 27 GE` (unit), `ERF 24982 - GEORG` (dash), `ERF69GEORGE` (glued area), `Erf: 19481` (colon), `ERF NO 14783` / `ERF NR 5031` (keywords), and `ACC NO- 31927 ERF 286` (combined). Area normalization maps abbreviations (GRG→George, HB→Herold Bay, HA→Haarlem, GE→George, PACALTS→Pacaltsdorp, BLANC→Blanco) and strips trailing noise (DEPOSIT/DEPO/WATER/DEP/CONN). Multi-word areas detected: Le Grand Estate, Herold Bay. Tested against 202 real bank descriptions.

**ERF Search Timeout Handling**: `fetchAccounts` (BillingEnquiry/EnquiryResults) wrapped in `timedFetchAccounts` with 20s timeout (returns `[]` on timeout). `platinumSearchAccountsPayment` runs in parallel as faster alternative. History enrichment calls `addResult` immediately with raw data, then attempts 10s-bounded enrichment asynchronously. Overall 45s search timeout bounds all searches.

**Dual Fetch Pipelines**: The codebase has two fetch systems: `enquiries-service.ts` (`fetchWithTimeout`, 15s AbortController) used by the General Enquiries page, and `external-api.ts` (`platinumFetch`, 60s timeout) used by DD auto-match and other operational calls. Auto-match must use `platinumBillingAutocomplete` from `external-api.ts` (not the `autocomplete` from `enquiries-service.ts`) because the browser's 6-connection-per-origin limit queues fast requests behind slow API calls, causing the 15s AbortController to fire before requests even start.

Page/page-size changes abort any running auto-match searches and reset all state via `cancelAutoMatch()`.

#### Account Enquiry
A reusable `AccountEnquiryDialog` component provides comprehensive account enquiry functionalities, integrating various account-related tabs and accessible from different parts of the application.

#### Receipt Processing and Performance
Receipt generation is optimized by separating printing from payment processing. Lookup strategies for unreconciled receipts are prioritized, and performance enhancements include parallelization of API calls and suppression of session polling during transactions.

#### Multi-Account Payment Handling
For large multi-account payments, the system implements dynamic timeout scaling at the server proxy, client API, and UI levels. Payments exceeding a `CHUNK_SIZE` (25 accounts) are split into parallel batches (up to 3 concurrent chunks) to improve performance and handle partial failures gracefully.

#### Day-End Reconciliation
The day-end process involves a multi-step submission and approval workflow with distinct statuses (`NOT_SUBMITTED`, `PENDING_APPROVAL`, `RETURNED`, `COMPLETED`). The system manages cashier sessions based on reconciliation status to allow re-submission or block further transactions.

#### SA 10c Cash Rounding
Cash payments are rounded up to the nearest 10c (South African standard). The UI provides explicit user interaction for rounding, adjusting the first basket item's amount to pay, and updating the cash tender.

## External Dependencies

### Multi-Site Support
The application supports multiple EMS sites (e.g., George Municipality, Inzalo EMS (Site02)), each with its own API endpoint and branding, selected at login.

### External APIs
-   **Platinum Inzalo EMS API**: The central dependency for all core POS operations, including payments, prepaid services, clearance, day-end processes, direct deposits, and authentication (via JWT). It integrates modules such as `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.