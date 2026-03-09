import React, { useState, useEffect } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  FileStack,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronRight as BreadcrumbSep,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Eye,
  Download,
  Plus,
} from 'lucide-react';
import {
  generateEvidenceBundle,
  fetchEvidenceBundles,
  fetchEvidenceBundle,
} from '@/lib/external-api';
import type { EvidenceBundle } from '@/models/legal.models';
import { EVIDENCE_BUNDLE_SECTIONS as BUNDLE_SECTIONS } from '@/services/debt-config';
import { formatDate } from '@/services/format.service';

function SectionIndicator({ data, sectionKey }: { data: any; sectionKey: string }) {
  const sectionData = data?.[sectionKey];
  const hasData = sectionData && (Array.isArray(sectionData) ? sectionData.length > 0 : Object.keys(sectionData).length > 0);

  return hasData ? (
    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
  ) : (
    <AlertTriangle className="w-4 h-4 text-amber-600" />
  );
}

function BundleDetail({ bundle }: { bundle: EvidenceBundle }) {
  const bundleData = bundle.bundleData || {};

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-[#F7F7F7] rounded-lg border border-[#D6D6D6]">
      {BUNDLE_SECTIONS.map(({ key, label }) => {
        const sectionData = bundleData[key];
        const hasData = sectionData && (Array.isArray(sectionData) ? sectionData.length > 0 : typeof sectionData === 'object' ? Object.keys(sectionData).length > 0 : !!sectionData);
        const count = Array.isArray(sectionData) ? sectionData.length : (hasData ? 1 : 0);

        return (
          <div
            key={key}
            className={`p-3 rounded-lg border ${hasData ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}
            data-testid={`section-${key}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <SectionIndicator data={bundleData} sectionKey={key} />
              <span className="text-xs font-medium text-foreground">{label}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {hasData ? (
                <span>{count} record{count !== 1 ? 's' : ''} available</span>
              ) : (
                <span>No data available</span>
              )}
            </div>
            {hasData && Array.isArray(sectionData) && sectionData.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto text-[11px] text-muted-foreground space-y-1">
                {sectionData.slice(0, 5).map((item: any, idx: number) => (
                  <div key={idx} className="bg-white rounded px-2 py-1 truncate border border-[#E5E5E5]">
                    {typeof item === 'string' ? item : JSON.stringify(item).slice(0, 80)}
                  </div>
                ))}
                {sectionData.length > 5 && (
                  <div className="text-muted-foreground text-center">+{sectionData.length - 5} more</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function EvidenceBundlePage() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const [accountNo, setAccountNo] = useState('');
  const [generating, setGenerating] = useState(false);
  const [bundles, setBundles] = useState<EvidenceBundle[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedBundle, setExpandedBundle] = useState<EvidenceBundle | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [gridPage, setGridPage] = useState(1);
  const gridPageSize = 10;

  const loadBundles = async () => {
    setLoading(true);
    try {
      const data = await fetchEvidenceBundles();
      setBundles(Array.isArray(data) ? data : []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to load evidence bundles.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBundles();
  }, []);

  const handleGenerate = async () => {
    if (!accountNo.trim()) {
      toast({ title: 'Validation Error', description: 'Please enter an account number.', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      await generateEvidenceBundle(accountNo.trim());
      toast({ title: 'Bundle Generated', description: `Evidence bundle generated for account ${accountNo}.` });
      setAccountNo('');
      await loadBundles();
    } catch (err: any) {
      toast({ title: 'Generation Failed', description: err.message || 'Failed to generate evidence bundle.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleExpand = async (bundle: EvidenceBundle) => {
    if (expandedId === bundle.id) {
      setExpandedId(null);
      setExpandedBundle(null);
      return;
    }
    setExpandedId(bundle.id);
    setLoadingDetail(true);
    try {
      const detail = await fetchEvidenceBundle(bundle.id);
      setExpandedBundle(detail);
    } catch {
      setExpandedBundle(bundle);
    } finally {
      setLoadingDetail(false);
    }
  };

  const paginatedBundles = bundles.slice((gridPage - 1) * gridPageSize, gridPage * gridPageSize);
  const totalGridPages = Math.ceil(bundles.length / gridPageSize);


  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] min-h-0">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 lg:p-6 space-y-4">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1" data-testid="text-breadcrumb">
            <span>Legal</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span>Compliance</span>
            <BreadcrumbSep className="w-3 h-3" />
            <span className="text-foreground">Evidence Bundles</span>
          </div>

          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
              <FileStack className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground tracking-tight" data-testid="text-page-title">
                Litigation Evidence Bundles
              </h1>
              <p className="text-xs text-muted-foreground">Generate and manage court-ready evidence bundles for account litigation</p>
            </div>
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-[var(--pos-accent)]" />
                Generate Evidence Bundle
                <HelpTip text="Enter an account number to generate a litigation evidence bundle containing all compliance records, notice history, and communication logs for that account." side="right" />
              </h2>
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-sm space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account Number</Label>
                  <Input
                    value={accountNo}
                    onChange={(e) => setAccountNo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                    placeholder="Enter account number"
                    className="bg-[#F7F7F7] border-[#D6D6D6] h-9"
                    data-testid="input-account-no"
                  />
                </div>
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !accountNo.trim()}
                  className="bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] text-white font-semibold rounded-lg shadow-sm h-9"
                  data-testid="button-generate"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileStack className="w-4 h-4 mr-1" />}
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground" data-testid="text-bundles-title">
                  Evidence Bundles ({bundles.length})
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={loadBundles}
                  disabled={loading}
                  className="text-muted-foreground hover:text-foreground h-7"
                  data-testid="button-refresh"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Refresh'}
                </Button>
              </div>

              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-8 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading evidence bundles...
                </div>
              ) : bundles.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8" data-testid="text-no-bundles">
                  No evidence bundles have been generated yet.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#F7F7F7] border-b hover:bg-transparent">
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider w-8"></TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Bundle Ref</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Account</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Generated By</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Date</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</TableHead>
                          <TableHead className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="divide-y divide-[#E5E5E5]">
                        {paginatedBundles.map((bundle, idx) => (
                          <React.Fragment key={bundle.id}>
                            <TableRow
                              className="hover:bg-[var(--pos-accent-hover-row)] transition-colors cursor-pointer"
                              onClick={() => handleExpand(bundle)}
                              data-testid={`row-bundle-${bundle.id}`}
                            >
                              <TableCell className="text-muted-foreground w-8">
                                {expandedId === bundle.id ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-foreground font-mono" data-testid={`text-bundle-ref-${bundle.id}`}>
                                {bundle.bundleReference}
                              </TableCell>
                              <TableCell className="text-xs text-foreground" data-testid={`text-bundle-account-${bundle.id}`}>
                                {bundle.accountNo}
                              </TableCell>
                              <TableCell className="text-xs text-foreground">
                                {bundle.generatedBy}
                              </TableCell>
                              <TableCell className="text-xs text-foreground whitespace-nowrap">
                                {formatDate(bundle.generatedAt)}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  bundle.status === 'GENERATED'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`} data-testid={`status-bundle-${bundle.id}`}>
                                  {bundle.status}
                                </span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-muted-foreground hover:text-foreground"
                                    onClick={() => handleExpand(bundle)}
                                    data-testid={`button-view-${bundle.id}`}
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                            {expandedId === bundle.id && (
                              <TableRow className="hover:bg-transparent">
                                <TableCell colSpan={7} className="p-0">
                                  {loadingDetail ? (
                                    <div className="flex items-center gap-2 text-muted-foreground text-sm py-6 justify-center">
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                      Loading bundle details...
                                    </div>
                                  ) : expandedBundle ? (
                                    <div className="p-3">
                                      <BundleDetail bundle={expandedBundle} />
                                    </div>
                                  ) : null}
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {totalGridPages > 1 && (
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#D6D6D6]">
                      <span className="text-xs text-muted-foreground">
                        Page {gridPage} of {totalGridPages}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGridPage(p => Math.max(1, p - 1))}
                          disabled={gridPage <= 1}
                          className="h-7 px-2 text-muted-foreground"
                          data-testid="button-prev-page"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setGridPage(p => Math.min(totalGridPages, p + 1))}
                          disabled={gridPage >= totalGridPages}
                          className="h-7 px-2 text-muted-foreground"
                          data-testid="button-next-page"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PosLayout>
  );
}
