export type BasketItemType = 'account' | 'clearance' | 'prepaid' | 'misc';
export type ReceiptDeliveryMethod = 'print' | 'email' | 'whatsapp' | 'sms';
export type TenderType = 'cash' | 'card' | 'cheque' | 'eft' | 'cash+card';
export type SearchMode = 'tabs' | 'unified';

export const PROCESSING_ORDER: Record<BasketItemType, number> = {
  account: 1,
  clearance: 2,
  prepaid: 3,
  misc: 4,
};

export const TYPE_LABELS: Record<BasketItemType, string> = {
  account: 'Consumer Payment',
  clearance: 'Clearance',
  prepaid: 'Prepaid Recharge',
  misc: 'Miscellaneous',
};

export interface AccountItemData {
  accountId: number;
  accountNumber: string;
  name: string;
  address: string;
  accountStatus: string;
  billId: number;
  cutOffID: number;
  cutOffAmount: number;
  debtAmount: number;
  debtArrangementId: number;
  sundryDebtorsId: number;
  billingCycleId: number;
  hasPrepaidMeter: boolean;
  prepaidMeterNo: string;
  prepaidType: string;
  accountBalance: number;
  idNumber?: string;
  registrationNumber?: string;
  sgNumber?: string;
  erfNumber?: string;
  locationAddress?: string;
  ward?: string;
  suburb?: string;
  originalData: any;
}

export interface ClearanceItemData {
  clearanceId: string;
  status: string;
  ownerName: string;
  propertyDesc: string;
  accounts: ClearanceAccountItem[];
}

export interface ClearanceAccountItem {
  accountId: number;
  accountNumber: string;
  name: string;
  amount: number;
  paymentAmount: number;
  serviceType: string;
}

export interface PrepaidItemData {
  meterNumber: string;
  serviceType: string;
  breakdown: any;
  tokenResult: any;
  accountId?: number;
  accountNumber?: string;
}

export type MiscTenderType = 'cash' | 'card';

export interface MiscItemData {
  groupId: number;
  groupName: string;
  scoaItemId: number;
  scoaItemName: string;
  lastName: string;
  initials: string;
  description: string;
  isVatable: boolean;
  vatPercentage: number;
  vatAmount: number;
  tenderType: MiscTenderType;
  cardNumber?: string;
  cardExpiry?: string;
}

export interface BasketItem {
  id: string;
  type: BasketItemType;
  label: string;
  description: string;
  amountDue: number;
  amountToPay: number;
  accountData?: AccountItemData;
  clearanceData?: ClearanceItemData;
  prepaidData?: PrepaidItemData;
  miscData?: MiscItemData;
}

export interface UnifiedSearchResult {
  resultType: BasketItemType | 'group';
  id: string | number;
  label: string;
  description: string;
  balance: number;
  status: string;
  rawData: any;
  groupAccounts?: any[];
}

export interface SplitTenderAllocation {
  cashItems: BasketItem[];
  cardItems: BasketItem[];
  cashTotal: number;
  cardTotal: number;
}

export interface ReceiptResult {
  receiptNumber: string;
  tenderType: TenderType;
  amount: number;
  items: BasketItem[];
  rawResponse: any;
}
