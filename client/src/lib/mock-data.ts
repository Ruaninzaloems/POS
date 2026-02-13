
export interface EasyPayBill {
  id: string;
  reference: string;
  billerName: string;
  accountName: string;
  amount: number;
  dueDate: string;
  status: "unpaid" | "paid";
}

export interface Account {
  accountNo: string;
  name: string;
  idNo: string;
  sgNo: string;
  address: string;
  outstandingAmount: number;
  prepaidMeterNo?: string;
  prepaidType?: "Electricity" | "Water";
  email: string;
  mobile: string;
  linkedToClearance?: string;
  unitId?: string;
  oldCode?: string;
  accountType?: string;
  status?: string;
  deliveryAddress?: string;
  valuationCategory?: string;
  marketValue?: number;
  agingBreakdown?: AgingItem[];
  prepaidBlocked?: boolean;
  prepaidBlockReason?: string;
  blockedServices?: string[];
  apiId?: number;
  accountGroup?: string;
  subAccountGroup?: string;
  paymentGroup?: string;
  locationAddress?: string;
  propertyId?: string;
  addName?: string;
  contactDetails?: string;
  unitPartitionId?: number;
  paidDepositAmount?: number;
  billingCycle?: string;
  firstName?: string;
  surname?: string;
  nameId?: number;
  oldPropertyCode?: string;
  registrationStatus?: string;
  allotmentArea?: string;
  propertyType?: string;
  magisterialDistrict?: string;
  propertyTypeOfUse?: string;
  propertyCategory?: string;
  partitionDescription?: string;
  interestWaiverStatus?: string;
  indigentSubsidyStatus?: string;
  consumerRppStatus?: string;
  departmentalAccount?: string;
  rebateStatus?: string;
  handoverStatus?: string;
  loanRppStatus?: string;
  incentiveSchemeCode?: string;
  sectionalTitleScheme?: string;
  farmName?: string;
  propertyStatus?: string;
  accountableOwnerName?: string;
  partitionMarketValue?: number;
}

export interface AgingItem {
  serviceDescription: string;
  totalOutstanding: number;
  newCharge: number;
  currentAccount: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  days150: number;
  days180Plus: number;
}

export interface DirectIncomeItem {
  id: string;
  groupName: string;
  description: string;
  scoaItem: string;
  vatRate: number;
  price?: number;
}

export interface AccountGroup {
  id: string;
  name: string;
  memberAccountNos: string[];
}

export interface ClearanceCostSchedule {
  scheduleNo: string;
  status: string;
  totalDue: number;
  linkedAccounts: Account[];
  section118_1_Breakdown: { item: string; amount: number; accountNo: string }[];
  section118_3_Breakdown: { item: string; amount: number; accountNo: string }[];
}

export interface CashOffice {
  id: string;
  name: string;
  ledgerVote: string;
  maxTransactionLimit: number;
}

export interface CashierProfile {
  id: string;
  name: string;
  role: string;
  cashOffice: string;
  float: number;
}

export const MOCK_TRANSACTIONS: any[] = [];
