import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  PenLine,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
  Search,
  RefreshCw,
  Eye,
  Mail,
  User,
  Calendar,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import {
  fetchSignatureRequests,
  fetchSignatureRequest,
  createSignatureRequest,
  fetchSignatureAuditLog,
} from '@/lib/external-api';
import { formatDate, formatCurrency } from '@/services/format.service';
import { DOC_TYPES, SIGNATURE_STATUS_LABELS } from '@/services/debt-config';
import type { SignatureRequest } from '@/models/debt.models';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />,
  SENT: <Mail className="h-3.5 w-3.5" />,
  VIEWED: <Eye className="h-3.5 w-3.5" />,
  SIGNED: <CheckCircle2 className="h-3.5 w-3.5" />,
  DECLINED: <XCircle className="h-3.5 w-3.5" />,
  EXPIRED: <AlertTriangle className="h-3.5 w-3.5" />,
  CANCELLED: <XCircle className="h-3.5 w-3.5" />,
};

function StatusBadge({ status }: { status: string }) {
  const cfg = SIGNATURE_STATUS_LABELS[status] || SIGNATURE_STATUS_LABELS.PENDING;
  const icon = STATUS_ICONS[status] || <Clock className="h-3.5 w-3.5" />;
  return (
    <span data-testid={`badge-status-${status}`} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.className}`}>
      {icon} {cfg.label}
    </span>
  );
}

export default function DigitalSignatures() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState<any[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [filterDocType, setFilterDocType] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailRequest, setDetailRequest] = useState<SignatureRequest | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [saving, setSaving] = useState(false);

  const [formAccountNo, setFormAccountNo] = useState('');
  const [formDocType, setFormDocType] = useState('AOD');
  const [formSignerName, setFormSignerName] = useState('');
  const [formSignerEmail, setFormSignerEmail] = useState('');
  const [formSignerMobile, setFormSignerMobile] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formExpiryDays, setFormExpiryDays] = useState('7');

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSignatureRequests();
      setRequests(Array.isArray(data) ? data : data?.requests || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAudit = useCallback(async () => {
    setLoadingAudit(true);
    try {
      const data = await fetchSignatureAuditLog();
      setAuditLog(Array.isArray(data) ? data : data?.entries || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingAudit(false);
    }
  }, [toast]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  useEffect(() => {
    if (tab === 'audit' && auditLog.length === 0) loadAudit();
  }, [tab, auditLog.length, loadAudit]);

  const openCreate = () => {
    setFormAccountNo(''); setFormDocType('AOD'); setFormSignerName(''); setFormSignerEmail('');
    setFormSignerMobile(''); setFormAmount(''); setFormNotes(''); setFormExpiryDays('7');
    setShowCreateDialog(true);
  };

  const openDetail = async (req: any) => {
    setDetailRequest(req);
    setShowDetailDialog(true);
    setLoadingDetail(true);
    try {
      const data = await fetchSignatureRequest(String(req.id));
      setDetailRequest(data);
    } catch {} finally {
      setLoadingDetail(false);
    }
  };

  const handleCreate = async () => {
    if (!formAccountNo.trim() || !formSignerName.trim() || !formSignerEmail.trim()) {
      toast({ title: 'Validation', description: 'Account number, signer name and email are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await createSignatureRequest({
        accountNo: formAccountNo,
        documentType: formDocType,
        signerName: formSignerName,
        signerEmail: formSignerEmail,
        signerMobile: formSignerMobile || undefined,
        amount: formAmount ? parseFloat(formAmount) : undefined,
        notes: formNotes || undefined,
        expiryDays: parseInt(formExpiryDays) || 7,
      });
      toast({ title: 'Signature Request Sent', description: `Request sent to ${formSignerName} at ${formSignerEmail}` });
      setShowCreateDialog(false);
      await loadRequests();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const filtered = requests.filter(r => {
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    if (filterDocType !== 'ALL' && r.documentType !== filterDocType) return false;
    if (searchText) {
      const s = searchText.toLowerCase();
      if (!r.accountNo?.toLowerCase().includes(s) && !r.signerName?.toLowerCase().includes(s) && !r.signerEmail?.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'PENDING' || r.status === 'SENT').length;
  const signedCount = requests.filter(r => r.status === 'SIGNED').length;
  const declinedCount = requests.filter(r => r.status === 'DECLINED').length;
  const expiredCount = requests.filter(r => r.status === 'EXPIRED').length;

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] p-4">
        <div className="shrink-0 mb-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/')} data-testid="link-home">Home</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/debt/section129')} data-testid="link-debt">Debt Management</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900 font-medium">Digital Signatures</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[#C4835E]">
              <PenLine className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
                Digital Signatures
                <HelpTip text="Send documents for electronic signature — AOD agreements, payment arrangements, settlement agreements, and consent orders. Track signing status and maintain a complete audit trail." />
              </h1>
              <p className="text-sm text-gray-500">Electronic signature management for debt recovery documents</p>
            </div>
            <Button size="sm" onClick={openCreate} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-new-request">
              <Send className="h-4 w-4 mr-1" /> New Signature Request
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Pending</p>
                    <p className="text-2xl font-bold text-amber-600" data-testid="text-pending-count">{pendingCount}</p>
                  </div>
                  <div className="p-2 bg-amber-50 rounded-lg"><Clock className="h-5 w-5 text-amber-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Signed</p>
                    <p className="text-2xl font-bold text-emerald-600" data-testid="text-signed-count">{signedCount}</p>
                  </div>
                  <div className="p-2 bg-emerald-50 rounded-lg"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Declined</p>
                    <p className="text-2xl font-bold text-red-600" data-testid="text-declined-count">{declinedCount}</p>
                  </div>
                  <div className="p-2 bg-red-50 rounded-lg"><XCircle className="h-5 w-5 text-red-600" /></div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-[#D6D6D6] shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Expired</p>
                    <p className="text-2xl font-bold text-gray-600" data-testid="text-expired-count">{expiredCount}</p>
                  </div>
                  <div className="p-2 bg-gray-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-gray-500" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-0">
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="w-full justify-start rounded-none border-b border-[#D6D6D6] bg-[#F7F7F7] px-2 pt-2 pb-0 h-auto">
                  <TabsTrigger value="requests" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-requests">
                    <PenLine className="h-3.5 w-3.5" /> Signature Requests
                  </TabsTrigger>
                  <TabsTrigger value="audit" className="data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-[var(--pos-accent)] rounded-b-none text-xs gap-1" data-testid="tab-audit">
                    <Shield className="h-3.5 w-3.5" /> Audit Log
                  </TabsTrigger>
                </TabsList>

                <div className="p-4">
                  <TabsContent value="requests" className="mt-0">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Search by account, signer name, or email..."
                          value={searchText}
                          onChange={(e) => setSearchText(e.target.value)}
                          className="pl-9 bg-[#F7F7F7] border-[#D6D6D6]"
                          data-testid="input-search"
                        />
                      </div>
                      <Select value={filterDocType} onValueChange={setFilterDocType}>
                        <SelectTrigger className="w-[200px] bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-filter-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Document Types</SelectItem>
                          {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-[150px] bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-filter-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL">All Statuses</SelectItem>
                          {Object.entries(SIGNATURE_STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Button size="sm" variant="outline" className="border-[#D6D6D6]" onClick={loadRequests} disabled={loading} data-testid="button-refresh">
                        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    {loading && requests.length === 0 ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No signature requests found</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#D6D6D6]">
                            <TableHead className="text-xs">Account</TableHead>
                            <TableHead className="text-xs">Document Type</TableHead>
                            <TableHead className="text-xs">Signer</TableHead>
                            <TableHead className="text-xs">Email</TableHead>
                            <TableHead className="text-xs text-right">Amount</TableHead>
                            <TableHead className="text-xs">Sent</TableHead>
                            <TableHead className="text-xs">Signed</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                            <TableHead className="text-xs text-center">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filtered.map((r: any, i: number) => (
                            <TableRow key={r.id || i} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-request-${i}`}>
                              <TableCell className="text-sm font-mono font-medium text-gray-900">{r.accountNo}</TableCell>
                              <TableCell>
                                <span className="text-xs font-semibold text-gray-700">
                                  {DOC_TYPES.find(d => d.value === r.documentType)?.label || r.documentType}
                                </span>
                              </TableCell>
                              <TableCell className="text-sm text-gray-700">{r.signerName}</TableCell>
                              <TableCell className="text-sm text-gray-700">{r.signerEmail}</TableCell>
                              <TableCell className="text-sm text-gray-700 text-right font-medium">{formatCurrency(r.amount)}</TableCell>
                              <TableCell className="text-sm text-gray-700">{formatDate(r.sentAt || r.createdAt)}</TableCell>
                              <TableCell className="text-sm text-gray-700">{formatDate(r.signedAt)}</TableCell>
                              <TableCell className="text-center"><StatusBadge status={r.status} /></TableCell>
                              <TableCell className="text-center">
                                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openDetail(r)} title="View Details" data-testid={`button-detail-${i}`}>
                                  <Eye className="h-3.5 w-3.5 text-gray-600" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>

                  <TabsContent value="audit" className="mt-0">
                    {loadingAudit ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
                      </div>
                    ) : auditLog.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No audit entries</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow className="border-[#D6D6D6]">
                            <TableHead className="text-xs">Timestamp</TableHead>
                            <TableHead className="text-xs">Action</TableHead>
                            <TableHead className="text-xs">Account</TableHead>
                            <TableHead className="text-xs">Document</TableHead>
                            <TableHead className="text-xs">Signer</TableHead>
                            <TableHead className="text-xs">IP Address</TableHead>
                            <TableHead className="text-xs">Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {auditLog.map((entry: any, i: number) => (
                            <TableRow key={entry.id || i} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-audit-${i}`}>
                              <TableCell className="text-sm text-gray-700">{formatDate(entry.timestamp)}</TableCell>
                              <TableCell><StatusBadge status={entry.action || entry.eventType} /></TableCell>
                              <TableCell className="text-sm font-mono text-gray-900">{entry.accountNo || '—'}</TableCell>
                              <TableCell className="text-sm text-gray-700">{entry.documentType || '—'}</TableCell>
                              <TableCell className="text-sm text-gray-700">{entry.signerName || entry.userName || '—'}</TableCell>
                              <TableCell className="text-sm text-gray-500 font-mono">{entry.ipAddress || '—'}</TableCell>
                              <TableCell className="text-sm text-gray-500 max-w-[200px] truncate">{entry.details || entry.notes || '—'}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </div>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-[var(--pos-accent)]" />
              New Signature Request
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Account Number</Label>
                <Input value={formAccountNo} onChange={(e) => setFormAccountNo(e.target.value)} placeholder="e.g. 1001234" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-account-no" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Document Type</Label>
                <Select value={formDocType} onValueChange={setFormDocType}>
                  <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-doc-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Signer Full Name</Label>
                <Input value={formSignerName} onChange={(e) => setFormSignerName(e.target.value)} placeholder="e.g. John Smith" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-signer-name" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Signer Email</Label>
                <Input value={formSignerEmail} onChange={(e) => setFormSignerEmail(e.target.value)} placeholder="e.g. john@example.com" type="email" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-signer-email" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Signer Mobile (optional)</Label>
                <Input value={formSignerMobile} onChange={(e) => setFormSignerMobile(e.target.value)} placeholder="e.g. 0821234567" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-signer-mobile" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Amount (if applicable)</Label>
                <Input value={formAmount} onChange={(e) => setFormAmount(e.target.value)} placeholder="e.g. 15000.00" type="number" step="0.01" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-amount" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Expiry (days)</Label>
              <Input value={formExpiryDays} onChange={(e) => setFormExpiryDays(e.target.value)} type="number" min="1" max="90" className="bg-[#F7F7F7] border-[#D6D6D6] w-24" data-testid="input-expiry-days" />
              <p className="text-xs text-gray-400 mt-0.5">The signer has this many days to sign the document</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Notes (optional)</Label>
              <Textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Additional instructions or context..." className="bg-[#F7F7F7] border-[#D6D6D6] min-h-[60px]" data-testid="input-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-send-request">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />} Send Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5 text-[var(--pos-accent)]" />
              Signature Request Details
            </DialogTitle>
          </DialogHeader>
          {loadingDetail ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--pos-accent)]" />
            </div>
          ) : detailRequest ? (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Account</p>
                  <p className="text-sm font-mono font-medium text-gray-900" data-testid="text-detail-account">{detailRequest.accountNo}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Status</p>
                  <StatusBadge status={detailRequest.status} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Document Type</p>
                  <p className="text-sm text-gray-900">{DOC_TYPES.find(d => d.value === detailRequest.documentType)?.label || detailRequest.documentType}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Amount</p>
                  <p className="text-sm font-medium text-gray-900">{formatCurrency(detailRequest.amount)}</p>
                </div>
              </div>
              <div className="border-t border-[#D6D6D6] pt-3">
                <p className="text-xs text-gray-500 mb-1 font-medium">Signer Information</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Name</p>
                    <p className="text-sm text-gray-900 flex items-center gap-1"><User className="h-3.5 w-3.5 text-gray-400" /> {detailRequest.signerName}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm text-gray-900 flex items-center gap-1"><Mail className="h-3.5 w-3.5 text-gray-400" /> {detailRequest.signerEmail}</p>
                  </div>
                </div>
              </div>
              <div className="border-t border-[#D6D6D6] pt-3">
                <p className="text-xs text-gray-500 mb-1 font-medium">Timeline</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs text-gray-500">Sent</p>
                    <p className="text-xs text-gray-700">{formatDate(detailRequest.sentAt || detailRequest.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Viewed</p>
                    <p className="text-xs text-gray-700">{formatDate(detailRequest.viewedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Signed</p>
                    <p className="text-xs text-gray-700">{formatDate(detailRequest.signedAt)}</p>
                  </div>
                </div>
              </div>
              {detailRequest.signatureHash && (
                <div className="border-t border-[#D6D6D6] pt-3">
                  <p className="text-xs text-gray-500 mb-1 font-medium flex items-center gap-1"><Shield className="h-3 w-3" /> Signature Verification</p>
                  <p className="text-xs font-mono text-gray-500 break-all bg-[#F7F7F7] p-2 rounded border border-[#D6D6D6]" data-testid="text-signature-hash">{detailRequest.signatureHash}</p>
                </div>
              )}
              {detailRequest.notes && (
                <div className="border-t border-[#D6D6D6] pt-3">
                  <p className="text-xs text-gray-500 mb-1">Notes</p>
                  <p className="text-sm text-gray-700">{detailRequest.notes}</p>
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
