import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  MapPin,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Building2,
  Home,
  Factory,
  Landmark,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Users,
  DollarSign,
  AlertTriangle,
} from 'lucide-react';
import { fetchGeographicDistribution } from '@/lib/external-api';

type ViewTab = 'ward' | 'suburb' | 'town' | 'propertyType';
type SortField = 'name' | 'totalDebt' | 'accountCount' | 'avgDebt' | 'avgRiskScore';
type SortDir = 'asc' | 'desc';

interface GeoItem {
  name: string;
  totalDebt: number;
  accountCount: number;
  avgDebt: number;
  avgRiskScore: number;
  riskCounts: Record<string, number>;
  dominantRisk: string;
}

const RISK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  MEDIUM: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  HIGH: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' },
  UNKNOWN: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
};

function RiskBadge({ category }: { category: string }) {
  const c = RISK_COLORS[category] || RISK_COLORS.UNKNOWN;
  return (
    <span data-testid={`badge-risk-${category}`} className={`px-2 py-0.5 rounded text-xs font-semibold ${c.bg} ${c.text} ${c.border} border`}>
      {category}
    </span>
  );
}

function HeatBar({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score));
  const color = clamp >= 60 ? 'bg-red-500' : clamp >= 30 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${clamp}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{clamp.toFixed(1)}</span>
    </div>
  );
}

function formatCurrency(value: number): string {
  return `R ${value.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function sortItems(items: GeoItem[], field: SortField, dir: SortDir): GeoItem[] {
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (field === 'name') cmp = a.name.localeCompare(b.name);
    else cmp = (a[field] as number) - (b[field] as number);
    return dir === 'asc' ? cmp : -cmp;
  });
}

const TAB_CONFIG: Record<ViewTab, { label: string; icon: React.ComponentType<any>; color: string }> = {
  ward: { label: 'By Ward', icon: Landmark, color: 'text-blue-700' },
  suburb: { label: 'By Suburb', icon: Home, color: 'text-emerald-700' },
  town: { label: 'By Town', icon: Building2, color: 'text-purple-700' },
  propertyType: { label: 'By Property Type', icon: Factory, color: 'text-amber-700' },
};

export default function GeographicMapping() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    byWard: GeoItem[];
    bySuburb: GeoItem[];
    byTown: GeoItem[];
    byPropertyType: GeoItem[];
    totalAccounts: number;
  } | null>(null);
  const [tab, setTab] = useState<ViewTab>('ward');
  const [sortField, setSortField] = useState<SortField>('totalDebt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await fetchGeographicDistribution();
      setData(result);
    } catch (err: any) {
      toast({ title: 'Failed to load geographic data', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };

  const currentItems = data ? (() => {
    const map: Record<ViewTab, GeoItem[]> = {
      ward: data.byWard,
      suburb: data.bySuburb,
      town: data.byTown,
      propertyType: data.byPropertyType,
    };
    return sortItems(map[tab] || [], sortField, sortDir);
  })() : [];

  const totalDebtAll = currentItems.reduce((s, i) => s + i.totalDebt, 0);
  const totalAccountsAll = currentItems.reduce((s, i) => s + i.accountCount, 0);
  const avgDebtAll = totalAccountsAll > 0 ? totalDebtAll / totalAccountsAll : 0;
  const highRiskCount = currentItems.filter(i => i.dominantRisk === 'HIGH').length;

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-[#D6D6D6]">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <button onClick={() => setLocation('/')} className="hover:text-foreground transition-colors" data-testid="link-home">Home</button>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-foreground font-medium">Geographic Debt Mapping</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)] flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-semibold text-foreground" data-testid="text-page-title">Geographic Debt Mapping</h1>
              <HelpTip text="Analyze debt distribution across wards, suburbs, towns, and property types. Color-coded risk indicators show severity levels for council planning." />
            </div>
            <div className="flex gap-1">
              {(Object.keys(TAB_CONFIG) as ViewTab[]).map(t => {
                const cfg = TAB_CONFIG[t];
                const Icon = cfg.icon;
                return (
                  <Button
                    key={t}
                    size="sm"
                    variant={tab === t ? 'default' : 'outline'}
                    onClick={() => setTab(t)}
                    className={tab === t ? 'bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm' : 'border-[#D6D6D6] hover:bg-[var(--pos-accent-tint)] text-muted-foreground'}
                    data-testid={`tab-${t}`}
                  >
                    <Icon className="w-3.5 h-3.5 mr-1" />{cfg.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !data ? (
            <div className="text-center py-16 text-muted-foreground" data-testid="text-no-data">No geographic data available.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground" data-testid="text-total-areas">{currentItems.length}</div>
                      <div className="text-xs text-muted-foreground">{TAB_CONFIG[tab].label.replace('By ', '')} Areas</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-foreground" data-testid="text-total-debt">{formatCurrency(totalDebtAll)}</div>
                      <div className="text-xs text-muted-foreground">Total Debt</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center">
                      <Users className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-foreground" data-testid="text-total-accounts">{totalAccountsAll}</div>
                      <div className="text-xs text-muted-foreground">Total Accounts</div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <div className="text-xl font-bold text-red-700" data-testid="text-high-risk-areas">{highRiskCount}</div>
                      <div className="text-xs text-muted-foreground">High Risk Areas</div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-foreground" data-testid="text-table-title">
                      {TAB_CONFIG[tab].label} Breakdown
                    </h3>
                    <span className="text-xs text-muted-foreground">{currentItems.length} entries</span>
                  </div>

                  {currentItems.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm" data-testid="text-empty-table">
                      No data available for this view. Score accounts with geographic metadata to populate this breakdown.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-[#F7F7F7] border-b hover:bg-transparent">
                            <TableHead>
                              <button onClick={() => handleSort('name')} className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground" data-testid="sort-name">
                                Name <SortIcon field="name" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button onClick={() => handleSort('totalDebt')} className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground" data-testid="sort-totalDebt">
                                Total Debt <SortIcon field="totalDebt" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button onClick={() => handleSort('accountCount')} className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground" data-testid="sort-accountCount">
                                Accounts <SortIcon field="accountCount" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button onClick={() => handleSort('avgDebt')} className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground" data-testid="sort-avgDebt">
                                Avg Debt <SortIcon field="avgDebt" />
                              </button>
                            </TableHead>
                            <TableHead>
                              <button onClick={() => handleSort('avgRiskScore')} className="flex items-center gap-1 text-muted-foreground text-xs hover:text-foreground" data-testid="sort-avgRiskScore">
                                Risk Score <SortIcon field="avgRiskScore" />
                              </button>
                            </TableHead>
                            <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Risk Level</TableHead>
                            <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Risk Breakdown</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentItems.map((item, idx) => (
                            <TableRow key={item.name} className="border-[#E5E5E5] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-geo-${idx}`}>
                              <TableCell className="text-foreground text-sm font-medium">{item.name}</TableCell>
                              <TableCell className="text-foreground text-sm font-mono">{formatCurrency(item.totalDebt)}</TableCell>
                              <TableCell className="text-foreground text-sm">{item.accountCount}</TableCell>
                              <TableCell className="text-foreground text-sm font-mono">{formatCurrency(item.avgDebt)}</TableCell>
                              <TableCell><HeatBar score={item.avgRiskScore} /></TableCell>
                              <TableCell><RiskBadge category={item.dominantRisk} /></TableCell>
                              <TableCell>
                                <div className="flex gap-1">
                                  {Object.entries(item.riskCounts).map(([risk, count]) => {
                                    const c = RISK_COLORS[risk] || RISK_COLORS.UNKNOWN;
                                    return (
                                      <span key={risk} className={`text-[10px] px-1.5 py-0.5 rounded ${c.bg} ${c.text}`} data-testid={`risk-count-${risk}-${idx}`}>
                                        {risk}: {count}
                                      </span>
                                    );
                                  })}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>

              {currentItems.length > 0 && (
                <Card className="bg-white border-[#D6D6D6] shadow-sm rounded-xl">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-semibold text-foreground mb-3" data-testid="text-heat-title">Debt Concentration</h3>
                    <div className="space-y-2">
                      {currentItems.slice(0, 10).map((item, idx) => {
                        const pct = totalDebtAll > 0 ? (item.totalDebt / totalDebtAll) * 100 : 0;
                        const riskColor = item.dominantRisk === 'HIGH' ? 'bg-red-500' : item.dominantRisk === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500';
                        return (
                          <div key={item.name} data-testid={`heat-row-${idx}`}>
                            <div className="flex justify-between text-xs mb-0.5">
                              <span className="text-foreground">{item.name}</span>
                              <span className="text-muted-foreground">{formatCurrency(item.totalDebt)} ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="h-2 bg-[#E5E5E5] rounded-full overflow-hidden">
                              <div className={`h-full ${riskColor} rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </PosLayout>
  );
}
