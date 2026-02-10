export interface Account {
  accountNo: string;
  name: string;
  idNo: string;
  sgNo: string; // Surveyor General No
  address: string;
  outstandingAmount: number;
  prepaidMeterNo?: string;
  prepaidType?: "Electricity" | "Water";
  email: string;
  mobile: string;
  linkedToClearance?: string; // Clearance ID if linked
  // New fields from screenshot
  unitId?: string;
  oldCode?: string;
  accountType?: string;
  status?: string;
  deliveryAddress?: string;
  valuationCategory?: string;
  marketValue?: number;
  agingBreakdown?: AgingItem[];
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
  section118_1_Breakdown: { item: string; amount: number }[];
  section118_3_Breakdown: { item: string; amount: number }[];
}

// SEED DATA

export const ACCOUNTS: Account[] = [
  {
    accountNo: "000000000030",
    name: "Eden Dm",
    idNo: "8001015009087",
    sgNo: "C077/0001/00000846/00000",
    address: "846 Berlyn Street, Haarlem, Uniondale",
    outstandingAmount: 13436.54,
    prepaidMeterNo: "14253647586",
    prepaidType: "Electricity",
    email: "gmoemailadres@gmail.com",
    mobile: "+27821234567",
    unitId: "42001",
    oldCode: "59231",
    accountType: "Consumer (Occupier)",
    status: "Active",
    deliveryAddress: "Posbus 12, George, 6530",
    valuationCategory: "Individual Use",
    marketValue: 146000.00,
    agingBreakdown: [
      {
        serviceDescription: "Waste Disposal",
        totalOutstanding: 7996.32,
        newCharge: 0.00,
        currentAccount: 100.94,
        days30: 100.94,
        days60: 100.94,
        days90: 0.00,
        days120: 0.00,
        days150: 0.00,
        days180Plus: 7693.50
      },
      {
        serviceDescription: "Sewer/Stank/Conv - Grg Sewer Stank Conv",
        totalOutstanding: 865.99,
        newCharge: 0.00,
        currentAccount: 7.21,
        days30: 7.21,
        days60: 7.21,
        days90: 0.00,
        days120: 0.00,
        days150: 0.00,
        days180Plus: 844.36
      },
      {
        serviceDescription: "Sewer/Treat/Conv - Grg Sewer Treat Conv",
        totalOutstanding: 4574.23,
        newCharge: 0.00,
        currentAccount: 31.26,
        days30: 31.26,
        days60: 31.26,
        days90: 0.00,
        days120: 0.00,
        days150: 0.00,
        days180Plus: 4480.45
      }
    ]
  },
  {
    accountNo: "ACC-1002",
    name: "Jane Smith",
    idNo: "8205050019081",
    sgNo: "SG-002-B",
    address: "45 Oak Avenue, Suburbia",
    outstandingAmount: 250.00,
    prepaidMeterNo: "W-987654321",
    prepaidType: "Water",
    email: "jane.smith@example.com",
    mobile: "+27839876543",
    accountType: "Consumer",
    status: "Active",
    unitId: "42005",
    valuationCategory: "Individual Use",
    marketValue: 950000.00,
    agingBreakdown: [
        {
        serviceDescription: "Water Usage",
        totalOutstanding: 250.00,
        newCharge: 50.00,
        currentAccount: 50.00,
        days30: 50.00,
        days60: 50.00,
        days90: 50.00,
        days120: 0.00,
        days150: 0.00,
        days180Plus: 0.00
      }
    ]
  },
  {
    accountNo: "ACC-1003",
    name: "ABC Trading PTY LTD",
    idNo: "2015/000123/07",
    sgNo: "SG-003-C",
    address: "Unit 5, Industrial Park",
    outstandingAmount: 12500.75,
    email: "accounts@abctrading.co.za",
    mobile: "+27110000000",
    accountType: "Business",
    status: "Active",
    marketValue: 2500000.00
  },
  {
    accountNo: "ACC-1004",
    name: "Michael Brown",
    idNo: "7503125009082",
    sgNo: "SG-004-D",
    address: "78 Pine Street, Hilltop",
    outstandingAmount: 0.00,
    prepaidMeterNo: "25364758697",
    prepaidType: "Electricity",
    email: "mike.brown@example.com",
    mobile: "+27841112222",
    accountType: "Consumer",
    status: "Active"
  },
  {
    accountNo: "ACC-1005",
    name: "Sarah Connor",
    idNo: "8501010000000",
    sgNo: "SG-005-E",
    address: "99 Future Road",
    outstandingAmount: 500.00,
    email: "sarah@skynet.com",
    mobile: "+27820000000",
    accountType: "Consumer",
    status: "Active"
  }
];

export const DIRECT_INCOME_ITEMS: DirectIncomeItem[] = [
  {
    id: "DI-001",
    groupName: "Traffic Fines",
    description: "Traffic Fine Payment",
    scoaItem: "SCOA-TF-001",
    vatRate: 0
  },
  {
    id: "DI-002",
    groupName: "Licensing",
    description: "Dog License Renewal",
    scoaItem: "SCOA-LIC-002",
    vatRate: 15,
    price: 150.00
  },
  {
    id: "DI-003",
    groupName: "Town Planning",
    description: "Building Plan Approval Fee",
    scoaItem: "SCOA-TP-003",
    vatRate: 15
  },
  {
    id: "DI-004",
    groupName: "Community",
    description: "Hall Rental Deposit",
    scoaItem: "SCOA-COM-004",
    vatRate: 0,
    price: 500.00
  }
];

export const ACCOUNT_GROUPS: AccountGroup[] = [
  {
    id: "GRP-001",
    name: "Sunset Body Corporate",
    memberAccountNos: ["ACC-1001", "ACC-1002"]
  },
  {
    id: "GRP-002",
    name: "Hilltop Business Park",
    memberAccountNos: ["ACC-1003", "ACC-1004", "ACC-1005"]
  }
];

export const CLEARANCES: ClearanceCostSchedule[] = [
  {
    scheduleNo: "CLR-2023-001",
    status: "Pending",
    totalDue: 5000.00,
    linkedAccounts: [ACCOUNTS[0]], // Linked to John Doe
    section118_1_Breakdown: [
      { item: "Rates & Taxes (2 years)", amount: 3500.00 },
      { item: "Water & Lights", amount: 1000.00 }
    ],
    section118_3_Breakdown: [
      { item: "Historical Debt", amount: 500.00 }
    ]
  }
];

export const CURRENT_CASHIER = {
  id: "CSH-01",
  name: "Sarah Jenkins",
  cashOffice: "Main Civic Center",
  receiptRange: {
    start: 50000,
    end: 60000,
    current: 50042
  },
  float: 500.00
};
