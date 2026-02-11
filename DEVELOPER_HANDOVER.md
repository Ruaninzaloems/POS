# Developer Handover Guide: Municipal POS System (React Prototype → Angular Production)

This document outlines the architecture, data models, and business logic of the Municipal POS prototype to assist developers in migrating and integrating it into the production Angular/SQL environment.

## 1. Architecture Overview

This prototype is built with **React**, **Tailwind CSS**, and **TypeScript**. 
- **State Management**: React Context (`PosProvider` in `client/src/lib/pos-state.tsx`).
- **Routing**: `wouter` (similar to standard router patterns).
- **Styling**: Tailwind CSS (Utility-first).
- **Logic Layer**: Separated into pure functions where possible.

### Migration Strategy to Angular
Since the target stack is Angular, the migration will involve:
1.  **UI/CSS**: The HTML structure and Tailwind classes are 100% portable. Copy the JSX structure into Angular templates (`.html`).
2.  **Logic**: The TypeScript logic in `pos-logic.ts` can be reused directly or adapted into Angular Services.
3.  **State**: The `PosContext` should be converted into an Angular Service (e.g., `PosService`) using RxJS BehaviorSubjects.

---

## 2. Key Files & Structure

| Prototype File | Angular Equivalent Concept | Description |
| :--- | :--- | :--- |
| `client/src/lib/mock-data.ts` | **Interfaces / Models** | Contains all Type definitions (`Account`, `Transaction`, `Cashier`) and seed data. |
| `client/src/lib/pos-logic.ts` | **Utility Service / Helper** | Pure functions for calculations (totals, change due) and transaction record creation. |
| `client/src/lib/pos-state.tsx` | **State Service (NgRx/RxJS)** | Manages the active session, cart items, and global state. |
| `client/src/pages/pos.tsx` | **Page Component** | The main layout controller for the POS screen. |

---

## 3. Data Models (Schema Reference)

The backend developers should ensure the SQL database schema supports these frontend data structures found in `client/src/lib/mock-data.ts`.

### Core Entities

**1. Cashier Profile**
```typescript
export interface CashierProfile {
    id: string;
    name: string;
    role?: string;
    cashOffice: string;
    float?: number; // Read-only value from backend
}
```

**2. Transaction Item (The Cart)**
```typescript
export interface TransactionItem {
  id: string; 
  type: 'CONSUMER_SERVICES' | 'PREPAID' | 'DIRECT_INCOME' | ...;
  description: string;
  reference: string; // Account No, Meter No, etc.
  amountDue: number;
  amountToPay: number; // Editable by cashier
  originalData: any; // Full backend object ref
}
```

**3. Transaction Record (The Receipt)**
```typescript
export interface TransactionRecord {
  id: string;
  receiptNumber: string;
  timestamp: number;
  items: TransactionItem[];
  totalAmount: number;
  payment: {
    cash: number;
    card: number;
  };
  status: 'COMPLETED' | 'CANCELLED';
  cashierId: string;
}
```

---

## 4. Business Logic Integration Points

### A. Calculation Logic (`client/src/lib/pos-logic.ts`)
The calculation logic is isolated. Developers should implement `calculateTransactionTotals` in the backend (for validation) and frontend (for immediate feedback).

```typescript
// Key function to migrate
export const calculateTransactionTotals = (items: TransactionItem[], payment: { cash: number; card: number }) => {
  const totalToPay = items.reduce((sum, item) => sum + (item.amountToPay || 0), 0);
  const tenderTotal = (payment.cash || 0) + (payment.card || 0);
  const changeDue = tenderTotal - totalToPay;
  return { totalToPay, tenderTotal, changeDue };
};
```

### B. Session Management
- **Current Flow**: Cashier selects office -> Sets Float -> Session Active.
- **Production Requirement**: 
    1.  `POST /api/session/start` with `{ officeId, floatAmount }`.
    2.  Backend validates float against limit.
    3.  Backend returns `sessionId`.

### C. Transaction Submission
- **Current Flow**: `completeTransaction()` adds to local array.
- **Production Requirement**:
    1.  `POST /api/transaction` with the `TransactionRecord` payload.
    2.  Backend performs ledger posting (Vote updates).
    3.  Backend returns `receiptId` and `printData`.

---

## 5. UI Component Migration Guide

### Layouts
- **PosLayout** (`client/src/components/layout/pos-layout.tsx`): 
  - Convert to Angular Main Layout.
  - Sidebar/Header navigation uses `lucide-react` icons. Replicate using Angular wrapper for Lucide or SVG imports.

### Forms & Inputs
- We use **Radix UI** primitives (via shadcn/ui).
- **Angular Equivalent**: Angular Material or PrimeNG are good substitutes, but to keep the *exact* look, standard HTML inputs with the *same Tailwind classes* is the best approach.

**Example: Read-only Input**
*React:*
```jsx
<Input className="bg-slate-100 border-slate-300 text-right" readOnly value={float} />
```
*Angular:*
```html
<input class="bg-slate-100 border-slate-300 text-right ..." readonly [value]="float">
```

---

## 6. API Requirements Checklist
Based on the UI features, the backend team needs to provide:

1.  **`GET /api/accounts/search?q={term}`**: Unified search for Accounts, Meters, and Names.
2.  **`GET /api/cashiers/me`**: Returns current user profile + allowed Float amount.
3.  **`POST /api/payment/process`**: Handles Third-party file uploads (Multipart form data).
4.  **`GET /api/ledger/votes/{officeId}`**: Returns linked vote for the selected cash office.
5.  **`POST /api/receipts/print`**: Returns formatted thermal printer raw data (ESC/POS) or PDF.
