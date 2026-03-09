export interface DebtOverview {
  totalDebt: number;
  totalAccounts: number;
  averageDebt: number;
  collectionRate: number;
  activeNotices: number;
  pendingHandovers: number;
}

export interface AgingAnalysis {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days120: number;
  days150: number;
  days180Plus: number;
}

export interface RecoveryStats {
  totalRecovered: number;
  recoveryRate: number;
  byPeriod: { period: string; rate: number; amount: number }[];
  byChannel: { channel: string; recovered: number; count: number }[];
}

export interface LegalPipelineStage {
  stage: string;
  count: number;
  amount: number;
}

export interface AttorneyPerformance {
  attorneyName: string;
  handedOverCount: number;
  handedOverAmount: number;
  recoveredAmount: number;
  recoveryRate: number;
}

export interface RiskDistributionItem {
  category: string;
  count: number;
  amount: number;
  percentage: number;
}

export interface GeoItem {
  name: string;
  totalDebt: number;
  accountCount: number;
  avgDebt: number;
  avgRiskScore: number;
  riskCounts: Record<string, number>;
  dominantRisk: string;
}

export interface ForecastScenario {
  name: string;
  description: string;
  impact: string;
  predictedRecovery: number;
  confidence: number;
  timeframe: string;
  factors: { name: string; weight: number; trend: string }[];
}

export interface ForecastData {
  currentRecoveryRate: number;
  predictedRecoveryRate: number;
  confidence: number;
  trends: { period: string; rate: number }[];
  scenarios: ForecastScenario[];
  recommendations: { title: string; description: string; impact: string; priority: string }[];
}

export type ViewTab = 'ward' | 'suburb' | 'town' | 'propertyType';
export type SortField = 'name' | 'totalDebt' | 'accountCount' | 'avgDebt' | 'avgRiskScore';
export type SortDir = 'asc' | 'desc';
