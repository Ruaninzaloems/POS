import { Injectable, signal, computed } from '@angular/core';
import {
  BasketItem,
  BasketItemType,
  PROCESSING_ORDER,
  SplitTenderAllocation,
} from '../models/pos-basket.models';

@Injectable({ providedIn: 'root' })
export class PosBasketService {
  items = signal<BasketItem[]>([]);

  orderedItems = computed(() => {
    return [...this.items()].sort(
      (a, b) => PROCESSING_ORDER[a.type] - PROCESSING_ORDER[b.type]
    );
  });

  totalDue = computed(() =>
    this.items().reduce((sum, item) => sum + item.amountDue, 0)
  );

  totalToPay = computed(() =>
    this.items().reduce((sum, item) => sum + item.amountToPay, 0)
  );

  itemCount = computed(() => this.items().length);

  hasItems = computed(() => this.items().length > 0);

  hasZeroAmountItems = computed(() => this.items().some(i => i.amountToPay <= 0));

  itemsByType = computed(() => {
    const grouped: Record<BasketItemType, BasketItem[]> = {
      account: [],
      clearance: [],
      prepaid: [],
      misc: [],
    };
    for (const item of this.items()) {
      grouped[item.type].push(item);
    }
    return grouped;
  });

  addItem(item: BasketItem): void {
    const existing = this.items().find((i) => i.id === item.id);
    if (existing) return;
    this.items.update((items) => [...items, item]);
  }

  removeItem(id: string): void {
    this.items.update((items) => items.filter((i) => i.id !== id));
  }

  updateAmount(id: string, amount: number): void {
    this.items.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, amountToPay: Math.max(0, amount || 0) } : item
      )
    );
  }

  payFullAmount(id: string): void {
    this.items.update((items) =>
      items.map((item) =>
        item.id === id ? { ...item, amountToPay: Math.max(0, item.amountDue) } : item
      )
    );
  }

  payAllFull(): void {
    this.items.update((items) =>
      items.map((item) => ({ ...item, amountToPay: Math.max(0, item.amountDue) }))
    );
  }

  clearAll(): void {
    this.items.set([]);
  }

  roundToNearest10c(amount: number): number {
    return Math.round(amount * 10) / 10;
  }

  applyCashRounding(cashAmount: number): { roundedCash: number; adjustment: number } {
    const rounded = this.roundToNearest10c(cashAmount);
    const adjustment = rounded - cashAmount;
    return { roundedCash: rounded, adjustment };
  }

  adjustFirstItemForRounding(roundedTotal: number): void {
    const items = this.items();
    if (items.length === 0) return;
    const currentTotal = items.reduce((s, i) => s + i.amountToPay, 0);
    const diff = roundedTotal - currentTotal;
    if (Math.abs(diff) < 0.001) return;
    const orderedByPriority = [...items].sort(
      (a, b) => PROCESSING_ORDER[a.type] - PROCESSING_ORDER[b.type]
    );
    const firstId = orderedByPriority[0].id;
    this.items.update((all) =>
      all.map((item) =>
        item.id === firstId
          ? { ...item, amountToPay: Math.round((item.amountToPay + diff) * 100) / 100 }
          : item
      )
    );
  }

  allocateSplitTender(cashAmount: number, cardAmount: number): SplitTenderAllocation {
    const ordered = this.orderedItems();
    const cashItems: BasketItem[] = [];
    const cardItems: BasketItem[] = [];
    let remainingCash = cashAmount;

    for (const item of ordered) {
      if (item.amountToPay <= 0) continue;
      if (remainingCash >= item.amountToPay) {
        cashItems.push(item);
        remainingCash -= item.amountToPay;
      } else if (remainingCash > 0) {
        const cashPortion = { ...item, amountToPay: Math.round(remainingCash * 100) / 100 };
        const cardPortion = { ...item, id: item.id + '-card', amountToPay: Math.round((item.amountToPay - remainingCash) * 100) / 100 };
        cashItems.push(cashPortion);
        cardItems.push(cardPortion);
        remainingCash = 0;
      } else {
        cardItems.push(item);
      }
    }

    return {
      cashItems,
      cardItems,
      cashTotal: cashItems.reduce((s, i) => s + i.amountToPay, 0),
      cardTotal: cardItems.reduce((s, i) => s + i.amountToPay, 0),
    };
  }
}
