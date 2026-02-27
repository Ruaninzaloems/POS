# Municipal POS Receipting System V2

## Overview

This project is a **Municipal Point-of-Sale (POS) Receipting System** prototype, implemented as a React/Express/PostgreSQL web application. It aims to provide a unified cashier interface for various municipal payments, including consumer services, multi-account payments, prepaid recharges, direct income, clearance, and direct deposit allocations. The primary purpose is to validate business logic, UI flows, and data models for a future Angular production environment.

Key capabilities include a unified POS screen with automatic transaction type detection, support for split payments, comprehensive cashier session management, float tracking, day-end reconciliation, and a supervisor dashboard. It also features robust direct deposit allocation, receipt management (print, email, SMS), permit/certificate generation, and a Client Communications module. The system is designed for high concurrency and integrates exclusively with the Platinum Inzalo EMS API for all real-time account data access.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend (React + TypeScript)
The frontend uses React 18 with TypeScript, powered by Vite, and `wouter` for routing. Styling is handled by Tailwind CSS, leveraging `shadcn/ui` for components. State management relies on the React Context API (`PosProvider`), and data fetching is done via TanStack React Query with a custom `apiRequest` helper. The architecture emphasizes separating business logic from UI components, with all data being API-driven. Error handling is robust, ensuring critical failures block session initialization.

### Backend (Express + Node.js)
The backend is an Express 5 application with TypeScript, acting as an authenticated proxy to the Platinum Inzalo EMS API. It uses `express-session` for user session management, storing JWT tokens and user data. Concurrency is managed through a global request queue, user-aware response caching, and in-flight GET request deduplication. Importantly, the backend does not use a local database for business data; all operational data is managed through the Platinum API.

### Database (PostgreSQL)
A local PostgreSQL database is present but **explicitly not used** for any business logic or data persistence. All operational data is handled by the Platinum API.

### Web Component / Angular Integration
The React application is designed as a self-contained Web Component (`<pos-app>`) for seamless embedding into existing Angular applications. It utilizes Shadow DOM for style isolation and routes all API calls through a centralized URL resolver. It adheres to strict guidelines for integration, including configuration via HTML attributes and generating a single ES module bundle.

### Design System — Colour Palettes & CSS Variables
The application supports multi-site theming via CSS custom properties defined in `index.css`. The accent color system uses `--pos-accent`, `--pos-accent-dark`, `--pos-accent-light`, `--pos-accent-shadow`, `--pos-accent-tint`, and `--pos-accent-tint-strong` variables. These are set in `:root` for the Platinum/George theme (peach palette) and overridden in `.theme-site02` for Inzalo EMS (teal palette). All component files reference these variables (e.g., `from-[var(--pos-accent)]`, `text-[var(--pos-accent)]`) instead of hardcoded hex values, so theme switching is fully automatic via the CSS class on `<body>`.

| Variable | George (default) | EMS Site02 |
|---|---|---|
| `--pos-accent` | `#E6A57E` | `#2FB5AD` |
| `--pos-accent-dark` | `#D18E65` | `#249E97` |
| `--pos-accent-light` | `#F0C3A7` | `#8DD8D3` |
| `--pos-accent-shadow` | `rgba(230,165,126,0.20)` | `rgba(47,181,173,0.20)` |
| `--pos-accent-tint` | `rgba(240,195,167,0.20)` | `rgba(47,181,173,0.15)` |
| `--pos-accent-tint-strong` | `rgba(240,195,167,0.30)` | `rgba(47,181,173,0.25)` |

**Important:** Do NOT hardcode `#E6A57E`, `#D18E65`, or `#F0C3A7` in component files. Always use the CSS variable equivalents. Only the login page's site-specific config and pos-layout's header overlay retain hardcoded Site02 teal values behind `isSite02` conditionals (structural, not color-only differences).

### Page Layout Standards
All pages follow a mandatory, consistent layout comprising a sticky header with an icon, title, and description, and a scrollable content area. Key rules include full-width content (no `max-w-* mx-auto`), full-height layout, consistent header styling, specific background colors for content areas, and predefined styles for cards, stat cards, and empty states.

## External Dependencies

### Multi-Site Support
The application is designed to support multiple EMS sites, each with its own API endpoint and visual branding. Site selection occurs at login, and the API base URL is managed per-session. Currently configured sites include **George Municipality** and **Inzalo EMS (Site02)**, each with distinct API URLs and theme classes.

### External APIs
-   **Platinum Inzalo EMS API** (multi-site): This is the central dependency, providing all core POS operations such as payments, prepaid services, clearance, day-end processes, and direct deposits. It handles authentication via JWT tokens and integrates key modules like `ReceiptPrepaid`, `billing-payment`, `auth-day-end-reconcile`, `billing-direct-deposit-allocation`, `BillingEnquiry`, and `BillingDashboard`.

### Frontend Libraries
-   `shadcn/ui` + `Radix UI`: For robust and customizable UI components.
-   `TanStack React Query`: For efficient server state management.
-   `date-fns`: For date manipulation.
-   `react-to-print`: For client-side printing.