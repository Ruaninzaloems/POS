# Platinum SCM — Complete Design System & Style Guide

**Purpose**: This document captures every CSS variable, color, typography rule, spacing token, component pattern, and layout structure used in the Platinum SCM application. Use this as a prompt reference to replicate the exact same visual language in another project.

**Framework**: Angular 21 + Angular Material (Material 3)
**CSS Preprocessor**: SCSS
**Icon Library**: Material Icons (Google)
**Font Stack**: `'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif`
**Monospace Font**: `'SF Mono', 'JetBrains Mono', ui-monospace, monospace`

---

## 1. CSS Variables (Design Tokens)

Place these on `:root` in your global stylesheet.

```css
:root {
  /* ── Brand Colors ── */
  --platinum-primary: #0f2b46;
  --platinum-primary-light: #1a3a5c;
  --platinum-primary-dark: #091d30;
  --platinum-accent: #c9a84c;
  --platinum-accent-light: #d5b866;
  --platinum-accent-dark: #a97d24;

  /* ── Surface / Background ── */
  --platinum-surface: #f8f9fb;
  --platinum-surface-alt: #f1f5f9;
  --platinum-surface-warm: #fafbfc;

  /* ── Text ── */
  --platinum-text: #1e293b;
  --platinum-text-secondary: #64748b;
  --platinum-text-muted: #94a3b8;

  /* ── Functional: Success ── */
  --platinum-success: #4caf50;
  --platinum-success-light: #e8f5e9;
  --platinum-success-pastel: #c8e6c9;

  /* ── Functional: Warning ── */
  --platinum-warning: #f59e0b;
  --platinum-warning-light: #fff8e1;
  --platinum-warning-pastel: #ffecb3;

  /* ── Functional: Danger ── */
  --platinum-danger: #ef5350;
  --platinum-danger-light: #ffebee;
  --platinum-danger-pastel: #ffcdd2;

  /* ── Functional: Info ── */
  --platinum-info: #42a5f5;
  --platinum-info-light: #e3f2fd;
  --platinum-info-pastel: #bbdefb;

  /* ── Extended Palette ── */
  --platinum-teal: #26a69a;
  --platinum-teal-light: #e0f2f1;
  --platinum-purple: #7e57c2;
  --platinum-purple-light: #ede7f6;
  --platinum-indigo: #5c6bc0;
  --platinum-indigo-light: #e8eaf6;
  --platinum-pink: #ec407a;
  --platinum-pink-light: #fce4ec;
  --platinum-amber: #ffb300;
  --platinum-amber-light: #fff8e1;
  --platinum-cyan: #26c6da;
  --platinum-cyan-light: #e0f7fa;

  /* ── Borders ── */
  --platinum-border: #e8ecf1;
  --platinum-border-light: #f0f3f7;

  /* ── Shadows ── */
  --platinum-card-shadow: 0 1px 3px rgba(15, 43, 70, 0.04), 0 1px 2px rgba(15, 43, 70, 0.02);
  --platinum-card-shadow-hover: 0 4px 12px rgba(15, 43, 70, 0.08), 0 2px 4px rgba(15, 43, 70, 0.04);

  /* ── Radius ── */
  --platinum-card-radius: 12px;

  /* ── Gradients ── */
  --platinum-gradient-blue: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%);
  --platinum-gradient-green: linear-gradient(135deg, #e8f5e9 0%, #e0f7fa 100%);
  --platinum-gradient-warm: linear-gradient(135deg, #fff8e1 0%, #fce4ec 100%);
  --platinum-gradient-cool: linear-gradient(135deg, #e8eaf6 0%, #e3f2fd 100%);
}
```

---

## 2. Global Base Styles

```css
html {
  height: 100%;
}

body {
  color-scheme: light;
  background-color: var(--platinum-surface);
  color: var(--platinum-text);
  font-family: 'Inter', 'Roboto', -apple-system, BlinkMacSystemFont, sans-serif;
  margin: 0;
  height: 100%;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  line-height: 1.5;
}

* {
  box-sizing: border-box;
}

a {
  text-decoration: none;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
```

---

## 3. Typography Scale

| Element | Size | Weight | Color | Letter Spacing | Notes |
|---------|------|--------|-------|----------------|-------|
| Page Title (h1) | 28px | 700 | `--platinum-text` | — | Dashboard headers |
| Section Title (h2) | 18-22px | 600-700 | `--platinum-text` | — | Card/section headers |
| Card Title (h3) | 14-16px | 600-700 | `--platinum-text` | — | `display: flex; align-items: center; gap: 8px` |
| Body Text | 13-14px | 400-500 | `--platinum-text` | — | General content |
| Subtitle / Description | 14px | 400 | `--platinum-text-muted` | — | Below headings |
| Table Header | 11px | 600 | `--platinum-text-muted` | 0.5px | `text-transform: uppercase` |
| Label (form/field) | 11px | 500 | `#64748b` | 0.5px | `text-transform: uppercase` |
| Badge / Tag | 10-11px | 600-700 | varies | 0.3-0.5px | Often `text-transform: uppercase` |
| KPI Value (large) | 22-24px | 700-800 | `--platinum-text` | — | Dashboard numbers |
| KPI Label | 11-13px | 500 | `--platinum-text-secondary` | 0.5px | `text-transform: uppercase` |
| Monospace (amounts, refs) | 13-14px | 600 | varies | — | `font-family: 'SF Mono', 'JetBrains Mono', ui-monospace, monospace` |
| Version / Footer | 11px | 400 | `--platinum-text-muted` | — | Sidebar footer |
| Breadcrumb | 13px | 500-600 | varies | — | Current = `--platinum-text`, parent = `#64748b` |
| Brand Name | 17px | 700 | `#1e293b` | 1.5px | Sidebar branding |
| Brand Sub | 10px | 500 | `#64748b` | 0.5px | "SCM" after brand name |

---

## 4. Layout Architecture

### 4.1 Application Shell

```
┌─────────────────────────────────────────────────────┐
│  Toolbar (56px, sticky, white, border-bottom)       │
├──────────┬──────────────────────────────────────────┤
│          │  Breadcrumb Bar (#f8fafc, 10px 24px pad) │
│  Sidebar │──────────────────────────────────────────│
│  (240px) │                                          │
│  white   │  Content Area                            │
│  border- │  (padding: 24px, bg: #ffffff)            │
│  right   │  max-width: 1440px (dashboards)          │
│          │  min-height: calc(100vh - 56px)          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### 4.2 Sidebar (240px)

```css
.app-sidenav {
  width: 240px;
  background: #ffffff;
  border-right: 1px solid #e8ecf1;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
}

.sidenav-header {
  padding: 20px 16px;
  border-bottom: 1px solid #e8ecf1;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: #2e7d32;
  display: flex;
  align-items: center;
  justify-content: center;
}
.brand-icon mat-icon {
  color: white;
  font-size: 20px;
}

.brand-name {
  font-size: 17px;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: 1.5px;
}

.brand-sub {
  font-size: 10px;
  font-weight: 500;
  color: #64748b;
  letter-spacing: 0.5px;
}
```

### 4.3 Navigation Links

```css
.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  color: #334155;
  text-decoration: none;
  font-size: 13px;
  font-weight: 400;
  border-radius: 6px;
  transition: all 0.15s ease;
  border-left: 3px solid transparent;
  cursor: pointer;
}
.nav-link:hover {
  color: #1e293b;
  background: #f1f5f9;
}
.nav-link.active-link {
  color: #2563eb;
  background: #eef6ff;
  border-left-color: #3b82f6;
}
.nav-icon {
  font-size: 20px;
  width: 20px;
  height: 20px;
  color: #94a3b8;
}
.nav-link.active-link .nav-icon {
  color: #2563eb;
}
```

### 4.4 Navigation Groups (Collapsible)

```css
.group-header {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 10px 16px 10px 12px;
  background: none;
  border: none;
  color: #334155;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  gap: 10px;
}
.group-header:hover {
  color: #1e293b;
  background: #f1f5f9;
}
.group-icon {
  font-size: 20px;
  color: #94a3b8;
}
.group-chevron {
  font-size: 18px;
  color: #94a3b8;
}
.sub-item {
  padding-left: 48px !important;
  font-size: 13px;
  border-radius: 0;
}
```

### 4.5 Toolbar (56px)

```css
.app-toolbar {
  background: white;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  height: 56px;
  position: sticky;
  top: 0;
  z-index: 10;
  padding: 0 8px;
  display: flex;
  align-items: center;
}

.municipality-name {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.period-badge {
  display: inline-flex;
  align-items: center;
  background: #e8f5e9;
  color: #2e7d32;
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 16px;
  white-space: nowrap;
}

.audit-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #fef3c7;
  color: #92400e;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.user-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #0f2b46;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
}
```

### 4.6 Breadcrumb Bar

```css
.breadcrumb-bar {
  background: #f8fafc;
  border-bottom: 1px solid #e8ecf1;
  padding: 10px 24px;
}
.breadcrumb-trail {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
}
.breadcrumb-home { color: #64748b; }
.breadcrumb-home:hover { color: #3b82f6; }
.breadcrumb-separator { color: #cbd5e1; font-size: 16px; }
.breadcrumb-group { color: #64748b; font-weight: 500; }
.breadcrumb-current { color: #1e293b; font-weight: 600; }
.breadcrumb-current-icon { color: #3b82f6; font-size: 18px; }
```

### 4.7 Content Area

```css
.content-area {
  padding: 24px;
  background: #ffffff;
  min-height: calc(100vh - 56px);
}
```

### 4.8 Mobile Responsive (768px)

```css
@media (max-width: 768px) {
  .municipality-name, .period-badge, .user-name-toolbar, .toolbar-center {
    display: none;
  }
  .content-area {
    padding: 16px;
  }
}
```

---

## 5. Component Patterns

### 5.1 KPI Cards (Dashboard)

```css
.kpi-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
@media (max-width: 1100px) { .kpi-row { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 700px) { .kpi-row { grid-template-columns: repeat(2, 1fr); } }

.kpi-card {
  background: white;
  border: 1px solid var(--platinum-border);
  border-radius: var(--platinum-card-radius);
  box-shadow: var(--platinum-card-shadow);
  padding: 20px;
  display: flex;
  align-items: flex-start;
  gap: 14px;
  transition: transform 0.2s, box-shadow 0.2s;
}
.kpi-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--platinum-card-shadow-hover);
}

.kpi-icon-wrap {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.kpi-icon-wrap.icon-blue   { background: var(--platinum-info-light);    color: var(--platinum-info); }
.kpi-icon-wrap.icon-green  { background: var(--platinum-success-light); color: var(--platinum-success); }
.kpi-icon-wrap.icon-red    { background: var(--platinum-danger-light);  color: var(--platinum-danger); }
.kpi-icon-wrap.icon-amber  { background: var(--platinum-warning-light); color: var(--platinum-warning); }
.kpi-icon-wrap.icon-teal   { background: var(--platinum-teal-light);    color: var(--platinum-teal); }
.kpi-icon-wrap.icon-purple { background: var(--platinum-purple-light);  color: var(--platinum-purple); }

.kpi-label { font-size: 13px; color: var(--platinum-text-secondary); margin-bottom: 4px; font-weight: 500; }
.kpi-value { font-size: 22px; font-weight: 700; color: var(--platinum-text); line-height: 1.2; margin-bottom: 4px; }
.kpi-count { font-size: 12px; color: var(--platinum-text-muted); }
.kpi-change { display: flex; align-items: center; gap: 3px; font-size: 12px; }
.kpi-change.positive { color: var(--platinum-success); }
.kpi-change.negative { color: var(--platinum-danger); }
```

### 5.2 KPI Tiles (Module Pages — Requisitions, Orders, Inventory)

```css
.kpi-strip {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.kpi-tile {
  flex: 1;
  min-width: 150px;
  padding: 16px 18px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  border-left: 3px solid #3b82f6;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.kpi-tile .kpi-value { font-size: 24px; font-weight: 700; color: #1e293b; }
.kpi-tile .kpi-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
```

Color variants for the left border:
```css
.kpi-blue   { border-left-color: #3b82f6; }
.kpi-green  { border-left-color: #10b981; }
.kpi-amber  { border-left-color: #f59e0b; }
.kpi-purple { border-left-color: #8b5cf6; }
.kpi-teal   { border-left-color: #06b6d4; }
.kpi-red    { border-left-color: #ef4444; }
```

### 5.3 Gradient KPI Cards (Supplier Portal Dashboard)

```css
.kpi-card.kpi-gradient-blue   { background: linear-gradient(135deg, #3b82f6, #2563eb); }
.kpi-card.kpi-gradient-purple { background: linear-gradient(135deg, #8b5cf6, #7c3aed); }
.kpi-card.kpi-gradient-amber  { background: linear-gradient(135deg, #f59e0b, #d97706); }
.kpi-card.kpi-gradient-green  { background: linear-gradient(135deg, #10b981, #059669); }
.kpi-card.kpi-gradient-teal   { background: linear-gradient(135deg, #06b6d4, #0891b2); }

/* Icon wrap on gradient cards */
.kpi-card .kpi-icon-wrap {
  background: rgba(255,255,255,0.2);
}
.kpi-card .kpi-icon-wrap mat-icon { color: #fff; }
.kpi-card .kpi-amount { color: #fff; font-size: 22px; font-weight: 800; }
.kpi-card .kpi-title { color: rgba(255,255,255,0.7); font-size: 12px; text-transform: uppercase; letter-spacing: 0.8px; }
.kpi-card .kpi-badge { background: rgba(255,255,255,0.2); color: #fff; padding: 4px 10px; border-radius: 20px; font-size: 13px; font-weight: 700; }

/* Decorative circle on gradient cards */
.kpi-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  transform: translate(20px, -20px);
}
```

### 5.4 Content Cards

```css
.card-container {
  background: white;
  border: 1px solid var(--platinum-border);
  border-radius: var(--platinum-card-radius);
  box-shadow: var(--platinum-card-shadow);
  overflow: hidden;
  margin-bottom: 24px;
}

.card-title-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  border-bottom: 1px solid var(--platinum-border);
}
.card-title-bar h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--platinum-text);
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.detail-card h3 {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-card h3 mat-icon {
  font-size: 20px;
  color: #3b82f6;
}
```

### 5.5 Data Tables

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table thead th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: #64748b;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  border-bottom: 2px solid #e2e8f0;
  background: #f8fafc;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
}
.data-table thead th:hover { color: #1e293b; }

.data-table tbody td {
  padding: 12px 16px;
  font-size: 13px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
}

.data-table tbody tr {
  cursor: pointer;
  transition: background 0.15s;
}
.data-table tbody tr:hover { background: #f8fafc; }

/* Special cell types */
.ref-cell   { font-weight: 600; color: #3b82f6; white-space: nowrap; }
.value-cell { font-weight: 600; font-family: 'SF Mono', ui-monospace, monospace; white-space: nowrap; }
.desc-cell  { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.date-cell  { color: #94a3b8; font-size: 12px; white-space: nowrap; }
.empty-state { text-align: center; padding: 40px 16px; color: #64748b; }

/* Table wrapper */
.table-wrapper {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: white;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
```

### 5.6 Status Badges

All status badges share this base:
```css
.status-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
```

| Status | Background | Text Color | Class |
|--------|-----------|------------|-------|
| Draft | `#f1f5f9` | `#64748b` | `.status-draft` |
| Saved | `#e8eaf6` | `#283593` | `.status-saved` |
| Submitted | `#e3f2fd` | `#1565c0` | `.status-submitted` |
| Pending / Supervisor Review | `#fff3e0` | `#ef6c00` | `.status-pending` |
| Approved / Completed | `#e8f5e9` | `#1b5e20` | `.status-approved` |
| Final Approved | `#e8f5e9` | `#1b5e20` | `.status-final_approved` |
| HOD Review | `#f3e5f5` | `#6a1b9a` | `.status-hod_review` |
| Rejected | `#ffebee` | `#c62828` | `.status-rejected` |
| Returned | `#fff8e1` | `#e65100` | `.status-returned` |
| Voided | `#fce4ec` | `#880e4f` | `.status-voided` |
| Routed | `#e0f2f1` | `#00695c` | `.status-routed` |
| Cancelled | `#ffebee` | `#c62828` | `.status-cancelled` |
| Amendment Draft | `#f5f3ff` | `#7c3aed` | `.status-amendment_draft` |
| Active (supplier) | `#ecfdf5` | `#065f46` | `.status-active` |
| Suspended | `#fff7ed` | `#9a3412` | `.status-suspended` |
| Blacklisted | `#fef2f2` | `#991b1b` | `.status-blacklisted` |

### 5.7 Type Badges

```css
.type-badge {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

/* Module type variants */
.type-requisition { background: var(--platinum-info-light);    color: var(--platinum-info); }
.type-order       { background: var(--platinum-teal-light);    color: var(--platinum-teal); }
.type-invoice     { background: var(--platinum-purple-light);  color: var(--platinum-purple); }
.type-payment     { background: var(--platinum-success-light); color: var(--platinum-success); }
.type-contract    { background: var(--platinum-amber-light);   color: var(--platinum-amber); }

/* Requisition type variants */
.type-operational        { background: #e3f2fd; color: #1565c0; }
.type-capital            { background: #f3e5f5; color: #6a1b9a; }
.type-financial_position { background: #e0f2f1; color: #00695c; }
.type-inventory_external { background: #fff8e1; color: #e65100; }
.type-deviation          { background: #ffebee; color: #c62828; }
.type-maintenance        { background: #e8f5e9; color: #2e7d32; }
.type-emergency          { background: #fff3e0; color: #ef6c00; }
```

### 5.8 Route Badges (Procurement)

```css
.route-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.route-direct_purchase    { background: #e8f5e9; color: #2e7d32; }
.route-informal_quotation { background: #fff8e1; color: #e65100; }
.route-formal_quotation   { background: #e3f2fd; color: #1565c0; }
.route-competitive_bid    { background: #f3e5f5; color: #6a1b9a; }
.route-deviation          { background: #ffebee; color: #c62828; }
.route-unrouted           { background: #f1f5f9; color: #94a3b8; }
```

### 5.9 Priority Badges

```css
.priority-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}
.priority-low    { background: #f1f5f9; color: #64748b; }
.priority-medium { background: #e3f2fd; color: #1565c0; }
.priority-high   { background: #fff3e0; color: #ef6c00; }
.priority-urgent { background: #ffebee; color: #c62828; }
```

### 5.10 Severity Badges (Fraud/Compliance)

```css
.fraud-severity {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 12px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.sev-low      { background: var(--platinum-success-light); color: var(--platinum-success); }
.sev-medium   { background: var(--platinum-warning-light); color: var(--platinum-warning); }
.sev-high     { background: var(--platinum-danger-light);  color: var(--platinum-danger); }
.sev-critical { background: #f3e5f5; color: #7b1fa2; }
.sev-info     { background: var(--platinum-info-light);    color: var(--platinum-info); }
```

### 5.11 Chip / Tag Variants

```css
.chip {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}
.chip-blue   { background: #eff6ff; color: #1d4ed8; }
.chip-green  { background: #ecfdf5; color: #065f46; }
.chip-teal   { background: #ecfeff; color: #0e7490; }
.chip-purple { background: #f5f3ff; color: #6d28d9; }
.chip-amber  { background: #fffbeb; color: #92400e; }
.chip-red    { background: #fef2f2; color: #991b1b; }
```

---

## 6. Tabs

### 6.1 Dashboard Tab Strip (Pill Style)

```css
.tab-strip {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  border: 1px solid var(--platinum-border);
  border-radius: 10px;
  background: white;
  color: var(--platinum-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}
.tab-btn:hover {
  border-color: var(--platinum-info);
  color: var(--platinum-info);
}
.tab-btn.active {
  background: var(--platinum-info-light);
  border-color: var(--platinum-info);
  color: var(--platinum-info);
  font-weight: 600;
}
```

### 6.2 Module Page Tabs (Underline Style)

```css
.tab-nav {
  display: flex;
  gap: 0;
  border-bottom: 2px solid #e2e8f0;
  margin-bottom: 16px;
  background: white;
  border-radius: 12px 12px 0 0;
  padding: 0 8px;
}
.tab-btn {
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  cursor: pointer;
  border: none;
  background: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition: all 0.2s;
}
.tab-btn:hover { color: #1e293b; }
.tab-btn.active {
  color: #3b82f6;
  border-bottom-color: #3b82f6;
  font-weight: 600;
}
```

---

## 7. Pipeline / Workflow Visualisation

### 7.1 Pipeline Flow

```css
.pipeline-flow {
  display: flex;
  align-items: center;
  padding: 28px 22px;
  overflow-x: auto;
}

.pipeline-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 100px;
  padding: 16px 12px;
  border: 1px solid var(--platinum-border);
  border-radius: 12px;
  background: white;
  transition: transform 0.2s, box-shadow 0.2s;
}
.pipeline-stage:hover {
  transform: translateY(-3px);
  box-shadow: var(--platinum-card-shadow-hover);
}
.stage-name  { font-size: 12px; font-weight: 600; color: var(--platinum-text-secondary); text-align: center; }
.stage-count { font-size: 24px; font-weight: 700; color: var(--platinum-text); }
.stage-bar   { width: 40px; height: 4px; border-radius: 2px; }
.stage-bar.on-track    { background: var(--platinum-success); }
.stage-bar.near-target { background: var(--platinum-warning); }
.stage-bar.exceeding   { background: var(--platinum-danger); }

.pipeline-arrow { color: var(--platinum-text-muted); padding: 0 4px; }
```

### 7.2 Workflow Stepper (Detail View)

```css
.workflow-stepper {
  display: flex;
  align-items: center;
  padding: 16px 20px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow-x: auto;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 12px;
  min-width: 70px;
}
.step-indicator mat-icon { font-size: 24px; color: #cbd5e1; }
.step.completed .step-indicator mat-icon { color: #2e7d32; }
.step.current .step-indicator mat-icon { color: #3b82f6; }
.step-label {
  font-size: 11px;
  font-weight: 500;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
.step.completed .step-label { color: #2e7d32; }
.step.current .step-label { color: #3b82f6; font-weight: 700; }
.step-connector { flex: 1; height: 2px; background: #e2e8f0; min-width: 20px; }
.step-connector.completed { background: #2e7d32; }
```

### 7.3 Approval Timeline (Vertical)

```css
.approval-timeline { display: flex; flex-direction: column; }
.approval-step { display: flex; gap: 16px; }
.approval-indicator { display: flex; flex-direction: column; align-items: center; }
.approval-indicator mat-icon { font-size: 24px; }
.approval-line { width: 2px; flex: 1; background: #e2e8f0; min-height: 20px; }
.approval-step:last-child .approval-line { display: none; }

.approval-approved { color: #2e7d32 !important; }
.approval-rejected { color: #c62828 !important; }
.approval-returned { color: #ef6c00 !important; }
.approval-pending  { color: #94a3b8 !important; }

.approval-role { font-size: 13px; font-weight: 600; color: #1e293b; }
.approval-assignee { font-size: 13px; color: #1e293b; }
.approval-date { font-size: 11px; color: #94a3b8; }
.approval-comments {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12px;
  color: #334155;
  background: #f8fafc;
  padding: 8px 12px;
  border-radius: 8px;
}
```

---

## 8. Forms

### 8.1 Form Cards

```css
.form-card {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.form-card h3 {
  font-size: 14px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.form-card h3 mat-icon { font-size: 20px; color: #3b82f6; }
```

### 8.2 Form Grid

```css
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.form-field-full { grid-column: 1 / -1; }

@media (max-width: 768px) {
  .form-grid { grid-template-columns: 1fr; }
}
```

### 8.3 Detail Grid (Read-Only Fields)

```css
.detail-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.detail-field label {
  display: block;
  font-size: 11px;
  font-weight: 500;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}
.detail-field span {
  font-size: 14px;
  color: #1e293b;
  font-weight: 500;
}
```

### 8.4 Line Items

```css
.line-item-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  margin-bottom: 10px;
}
.line-item-number {
  width: 28px;
  height: 28px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}
.line-items-total {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 12px;
  padding: 16px 0 0;
  border-top: 2px solid #e2e8f0;
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
}
.total-amount { font-family: 'SF Mono', ui-monospace, monospace; color: #3b82f6; }
```

### 8.5 Filters Bar

```css
.filters-bar {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 12px 16px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
```

---

## 9. Buttons

### 9.1 Global Material Override

```css
.mat-mdc-button, .mat-mdc-flat-button {
  border-radius: 8px !important;
}
.mat-mdc-icon-button {
  --mdc-icon-button-state-layer-size: 40px;
}
```

### 9.2 Action Buttons

```css
.btn-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--platinum-border) !important;
  border-radius: 8px !important;
  color: var(--platinum-text-secondary) !important;
  font-size: 13px;
  padding: 6px 14px;
  background: white !important;
}

.btn-export {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--platinum-primary) !important;
  color: white !important;
  border-radius: 8px !important;
  font-size: 13px;
  padding: 6px 16px;
}
```

### 9.3 Login Button

```css
.login-button {
  width: 100%;
  height: 48px;
  font-size: 15px;
  font-weight: 500;
  background: linear-gradient(135deg, #0f2b46, #1a3a5c) !important;
  color: white !important;
  border-radius: 8px;
  letter-spacing: 0.5px;
  transition: all 0.2s;
}
.login-button:hover:not(:disabled) {
  box-shadow: 0 4px 14px rgba(15,43,70,0.3);
  transform: translateY(-1px);
}
```

---

## 10. AI Insight Cards

```css
.insights-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  padding: 20px 22px;
}
@media (max-width: 900px) { .insights-grid { grid-template-columns: 1fr; } }

.insight-card {
  display: flex;
  gap: 14px;
  padding: 16px;
  border: 1px solid var(--platinum-border-light);
  border-radius: 10px;
  background: var(--platinum-surface-warm);
  transition: box-shadow 0.2s;
}
.insight-card:hover { box-shadow: var(--platinum-card-shadow-hover); }

.insight-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.insight-icon.severity-info     { background: var(--platinum-info-light);    color: var(--platinum-info); }
.insight-icon.severity-warning  { background: var(--platinum-warning-light); color: var(--platinum-warning); }
.insight-icon.severity-critical { background: var(--platinum-danger-light);  color: var(--platinum-danger); }

.insight-title { font-size: 14px; font-weight: 600; color: var(--platinum-text); }
.insight-message { font-size: 13px; color: var(--platinum-text-secondary); line-height: 1.5; }
.insight-link { font-size: 12px; font-weight: 600; color: var(--platinum-info); cursor: pointer; }
.insight-time { font-size: 11px; color: var(--platinum-text-muted); }
.insight-confidence { font-size: 11px; color: var(--platinum-text-muted); font-style: italic; }

.insight-recommendation {
  font-size: 12px;
  color: var(--platinum-teal);
  background: var(--platinum-teal-light);
  padding: 6px 10px;
  border-radius: 6px;
  line-height: 1.4;
}

.legislation-ref {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: #f3e8ff;
  color: #7c3aed;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
}
```

---

## 11. Progress Bars & Budget Bars

```css
/* Simple progress bar */
.budget-track {
  height: 6px;
  background: #f1f5f9;
  border-radius: 3px;
  overflow: hidden;
}
.budget-fill {
  height: 100%;
  background: var(--platinum-info);
  border-radius: 3px;
  transition: width 0.5s;
}

/* Stacked budget bar (committed + spent + this request) */
.budget-bar-wrapper {
  width: 100%;
  height: 12px;
  background: #f1f5f9;
  border-radius: 6px;
  overflow: hidden;
  display: flex;
}
.budget-bar { height: 100%; transition: width 0.5s ease; }
.budget-committed { background: #90caf9; }
.budget-spent     { background: #ef9a9a; }
.budget-this      { background: #a5d6a7; }

/* Budget legend */
.budget-legend { display: flex; gap: 16px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #64748b; }
.legend-dot { width: 8px; height: 8px; border-radius: 50%; }
```

---

## 12. Alert & Notification Bars

```css
.notification-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: #e8f5e9;
  border: 1px solid #a5d6a7;
  border-radius: 10px;
  margin-bottom: 16px;
  color: #2e7d32;
  font-size: 13px;
  font-weight: 500;
}

.alert-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}
.alert-danger  { background: #fef2f2; color: #991b1b; }
.alert-warning { background: #fffbeb; color: #92400e; }
.alert-success { background: #ecfdf5; color: #065f46; }

/* Action panel (approval required) */
.action-panel {
  background: #fffde7;
  border: 1px solid #fff176;
  border-radius: 12px;
  margin-bottom: 16px;
  overflow: hidden;
}
.action-panel-header {
  padding: 12px 20px;
  background: #fff9c4;
  font-size: 14px;
  font-weight: 600;
  color: #e65100;
}

/* Void panel */
.void-panel {
  background: #fce4ec;
  border: 1px solid #ef9a9a;
  border-radius: 12px;
  padding: 16px 20px;
}
```

---

## 13. Dialogs / Modals

```css
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.dialog-content {
  background: #fff;
  border-radius: 16px;
  width: 560px;
  max-width: 95vw;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0,0,0,0.2);
}
.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px 12px;
}
.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.dialog-body { padding: 0 24px 16px; }
.dialog-footer {
  padding: 12px 24px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #f1f5f9;
}
```

---

## 14. Login / Auth Pages

### 14.1 Split Layout

```css
.login-container { display: flex; height: 100vh; }

.login-left {
  flex: 0 0 42%;
  background: linear-gradient(135deg, #0f2b46 0%, #1a3a5c 50%, #0f2b46 100%);
  color: white;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 48px;
}

.login-right {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  padding: 48px;
}
```

### 14.2 Logo / Brand Block

```css
.logo-icon {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: linear-gradient(135deg, #c9a84c, #e0c373);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
}
.shield-icon { font-size: 40px; color: #0f2b46; }
.tagline { font-size: 15px; color: #c9a84c; font-weight: 500; letter-spacing: 0.5px; }
.divider { width: 60px; height: 3px; background: #c9a84c; border-radius: 2px; }
```

### 14.3 Feature List (Login Left)

```css
.feature-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  font-size: 14px;
  color: rgba(255,255,255,0.9);
}
.feature-item mat-icon { color: #c9a84c; }
```

### 14.4 Registration Step Indicator

```css
.step-indicator {
  display: flex;
  align-items: center;
  gap: 0;
  margin-bottom: 28px;
  justify-content: center;
}
.step .step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e2e8f0;
  color: #94a3b8;
  font-size: 13px;
  font-weight: 700;
}
.step.active .step-num { background: #0f2b46; color: #fff; }
.step.done .step-num { background: #10b981; color: #fff; }
.step-line { width: 40px; height: 2px; background: #e2e8f0; margin: 0 8px; }
.step-line.active { background: #10b981; }
```

---

## 15. Supplier Portal Hero Banner

```css
.dash-hero {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px 28px;
  background: linear-gradient(135deg, #1e293b 0%, #334155 60%, #475569 100%);
  border-radius: 16px;
  margin-bottom: 24px;
  color: #fff;
}

.hero-avatar {
  width: 64px;
  height: 64px;
  border-radius: 14px;
  background: linear-gradient(135deg, #c9a84c, #d4b662);
}
.hero-avatar mat-icon { font-size: 32px; color: #1e293b; }

.meta-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 500;
  background: rgba(255,255,255,0.15);
  color: rgba(255,255,255,0.9);
}
.meta-chip.bee-chip { background: rgba(201,168,76,0.3); color: #fcd34d; }
.meta-chip.status-active { background: rgba(16,185,129,0.25); color: #6ee7b7; }
```

---

## 16. Compliance Score Ring (SVG)

```css
.score-ring { position: relative; width: 130px; height: 130px; }
.score-ring-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}
.score-value { font-size: 26px; font-weight: 700; color: var(--platinum-text); }

.comp-row { display: flex; align-items: center; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f8f9fb; }
.comp-label { font-size: 13px; color: var(--platinum-text); }
.comp-bar-track { flex: 1; height: 6px; background: #f1f5f9; border-radius: 3px; overflow: hidden; }
.comp-bar-fill { height: 100%; border-radius: 3px; transition: width 0.5s; }
.comp-bar-fill.comp-green { background: var(--platinum-success); }
.comp-bar-fill.comp-amber { background: var(--platinum-warning); }
.comp-bar-fill.comp-red   { background: var(--platinum-danger); }
.comp-score { font-size: 13px; font-weight: 600; min-width: 40px; text-align: right; }
```

---

## 17. Upload Area

```css
.upload-area {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 24px;
  text-align: center;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s;
}
.upload-area:hover {
  border-color: #3b82f6;
  background: #f8fafc;
}
```

---

## 18. Audit Trail

```css
.audit-list { list-style: none; padding: 0; margin: 0; }
.audit-item { display: flex; gap: 12px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
.audit-dot { width: 8px; height: 8px; border-radius: 50%; background: #3b82f6; margin-top: 6px; }
.audit-dot.dot-approval  { background: #2e7d32; }
.audit-dot.dot-rejection { background: #c62828; }
.audit-dot.dot-system    { background: #94a3b8; }
.audit-dot.dot-action    { background: #3b82f6; }
.audit-action { font-size: 13px; font-weight: 500; color: #1e293b; }
.audit-detail { font-size: 12px; color: #64748b; }
.audit-date   { font-size: 11px; color: #94a3b8; }
```

---

## 19. Document List

```css
.doc-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  background: #f8fafc;
}
.doc-icon { color: #3b82f6; font-size: 20px; }
.doc-name { font-size: 13px; font-weight: 500; color: #1e293b; }
.doc-meta { font-size: 11px; color: #94a3b8; }
```

---

## 20. Pagination

```css
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  margin-top: 8px;
}
.page-info { font-size: 13px; color: #64748b; }
.page-num { font-size: 13px; color: #1e293b; font-weight: 500; }
```

---

## 21. SLA Indicators

```css
.sla-strip { display: flex; gap: 12px; margin-bottom: 16px; overflow-x: auto; }
.sla-indicator {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 10px 14px;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  min-width: 140px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.sla-label { font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
.sla-actual { font-size: 18px; font-weight: 700; }
.sla-target { font-size: 12px; color: #94a3b8; }
.sla-good { color: #2e7d32; }
.sla-warn { color: #ef6c00; }
.sla-bad  { color: #c62828; }
.sla-bar  { height: 4px; border-radius: 2px; margin-top: 4px; }
```

---

## 22. mSCOA Tags

```css
.mscoa-strip { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.mscoa-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.3px; }
.mscoa-tag {
  display: inline-block;
  padding: 2px 8px;
  background: #e3f2fd;
  color: #1565c0;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'SF Mono', ui-monospace, monospace;
}
```

---

## 23. B-BBEE Badge (Supplier)

```css
.sup-bbbee {
  background: var(--platinum-teal-light);
  color: var(--platinum-teal);
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 8px;
  white-space: nowrap;
}
```

---

## 24. Mini Timeline Dots (Invoice)

```css
.mini-timeline { display: flex; gap: 3px; align-items: center; }
.mini-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #e2e8f0;
  transition: all 0.2s;
}
.mini-dot.completed { background: #10b981; }
.mini-dot.current { background: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.2); }
.mini-dot.rejected { background: #ef4444; }
```

---

## 25. Print Styles

```css
@media print {
  .pipeline-strip, .summary-strip, .filters-bar, .pagination,
  .detail-actions-bar, .action-panel, .tab-nav, .form-actions,
  .void-panel, .notification-bar, .sla-strip, button {
    display: none !important;
  }
  .detail-header, .workflow-stepper, .detail-content, .detail-card {
    break-inside: avoid;
  }
  .detail-card {
    border: 1px solid #ccc !important;
    box-shadow: none !important;
  }
}
```

---

## 26. Angular Material Overrides

```css
/* Card shape */
.mat-mdc-card {
  --mdc-elevated-card-container-shape: 12px;
  --mdc-elevated-card-container-elevation: 0;
  border: 1px solid var(--platinum-border);
}

/* Form fields full width */
.mat-mdc-form-field { width: 100%; }

/* Tooltip */
.mat-mdc-tooltip {
  --mdc-plain-tooltip-container-color: #1e293b;
  font-size: 12px !important;
}

/* Button radius */
.mat-mdc-button, .mat-mdc-flat-button { border-radius: 8px !important; }
.mat-mdc-icon-button { --mdc-icon-button-state-layer-size: 40px; }

/* Hide form field subscript in dense layouts */
.form-grid ::ng-deep .mat-mdc-form-field-subscript-wrapper { display: none; }
```

---

## 27. Design Principles Summary

| Principle | Rule |
|-----------|------|
| **Background** | Content on pure white `#ffffff`, shell surface `#f8f9fb` |
| **Cards** | White, 1px border `#e8ecf1`, 12px radius, subtle shadow |
| **Hover** | `translateY(-2px)` + shadow upgrade |
| **Borders** | `#e8ecf1` standard, `#e2e8f0` for tables/forms, `#f1f5f9` for row dividers |
| **Active State** | Blue `#3b82f6` bg tint `#eef6ff`, 3px left border |
| **Color Coding** | Blue=info, Green=success, Amber=warning, Red=danger, Purple=special, Teal=B-BBEE |
| **Spacing** | 4px base, 8/12/16/20/24px scale |
| **Font Sizes** | 10-11px labels, 12-13px body, 14-16px headings, 18-28px display |
| **Icon Size** | Standard 20px, small 14-16px, large 24px |
| **Transition** | `all 0.15s ease` for nav, `0.2s` for cards/buttons, `0.5s` for progress bars |
| **Status Pattern** | Pastel bg + dark text of same hue, pill-shaped `border-radius: 20px` |
| **Monospace** | Financial amounts, reference numbers, mSCOA codes |
| **Brand Gradient** | `linear-gradient(135deg, #0f2b46, #1a3a5c)` for login/hero |
| **Gold Accent** | `#c9a84c` for branding, premium touches, taglines |

---

*This document was extracted from the Platinum SCM Angular 21 application source code. Use it as a complete prompt reference to replicate the exact visual language in any new project.*
