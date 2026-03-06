import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { HelpTip } from '@/components/ui/help-tip';
import { useVirtualizer } from '@tanstack/react-virtual';
import { platinumSearchAccountsPayment, platinumGetContactDetails, platinumGetNameInfoByAccount, fetchAdditionalEmailsByAccountId } from '@/lib/external-api';
import {
  Mail,
  MessageSquare,
  Search,
  Upload,
  X,
  Plus,
  Trash2,
  FileText,
  Paperclip,
  Send,
  Users,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Phone,
  Download,
  Info,
} from 'lucide-react';

interface Recipient {
  id: string;
  accountId: number;
  accountNo: string;
  name: string;
  email: string;
  additionalEmails: string[];
  mobile: string;
  address: string;
  outstanding: number;
  selected: boolean;
  contactLoading: boolean;
  contactLoaded: boolean;
}

interface Attachment {
  id: string;
  file: File;
  name: string;
  size: number;
}

type CommMode = 'email' | 'sms';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function isValidMobile(val: any): boolean {
  if (typeof val !== 'string') return false;
  const cleaned = val.replace(/[\s\-()]/g, '');
  if (/^0[6-8]\d{8}$/.test(cleaned)) return true;
  if (/^\+27[6-8]\d{8}$/.test(cleaned)) return true;
  if (/^27[6-8]\d{8}$/.test(cleaned)) return true;
  if (/^0\d{9}$/.test(cleaned)) return true;
  return false;
}

function normalizeMobile(val: string): string {
  const cleaned = val.replace(/[\s\-()]/g, '');
  if (/^\+27\d{9}$/.test(cleaned)) return '0' + cleaned.slice(3);
  if (/^27\d{9}$/.test(cleaned)) return '0' + cleaned.slice(2);
  return cleaned;
}

function isValidEmail(val: any): boolean {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.length > 3 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function downloadCsvTemplate() {
  const header = 'AccountNumber';
  const sample = ['000000001234', '000000005678', '000000009012'];
  const csv = [header, ...sample].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import_template.csv';
  a.style.display = 'none';
  (document.body || document.documentElement).appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const BATCH_SIZE = 20;
const CONTACT_BATCH_SIZE = 10;

export default function ClientCommunications() {
  const { toast } = useToast();
  const [mode, setMode] = useState<CommMode>('email');
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [contactIndicators, setContactIndicators] = useState<Record<number, { email: boolean; mobile: boolean; loading: boolean }>>({});
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const [subject, setSubject] = useState('');
  const [messageBody, setMessageBody] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0, added: 0 });
  const [contactEnriching, setContactEnriching] = useState(false);
  const [contactEnrichProgress, setContactEnrichProgress] = useState({ current: 0, total: 0 });
  const [showPreview, setShowPreview] = useState(false);

  const recipientListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const extractContactInfo = (contactRes: any, nameRes: any) => {
    let email = '';
    let mobile = '';

    const pickEmail = (...vals: any[]) => vals.find(v => isValidEmail(v))?.trim() || '';
    const pickMobile = (...vals: any[]) => {
      const found = vals.find(v => isValidMobile(v));
      return found ? normalizeMobile(found.trim()) : '';
    };

    if (contactRes && !contactRes._error) {
      const c = Array.isArray(contactRes) ? contactRes[0] : contactRes;
      email = pickEmail(c?.email, c?.eMail, c?.emailAddress, c?.Email);
      mobile = pickMobile(c?.cellphone, c?.cellPhone, c?.mobile, c?.mobileNumber, c?.CellPhone);
    }
    if (nameRes && !nameRes._error) {
      const n = Array.isArray(nameRes) ? nameRes[0] : nameRes;
      if (!email) email = pickEmail(n?.email, n?.eMail, n?.emailAddress);
      if (!mobile) mobile = pickMobile(n?.cellphone, n?.cellPhone, n?.mobile);
    }

    return { email, mobile };
  };

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const isNumeric = /^\d+$/.test(query);
      const searchBody: Record<string, any> = {};
      if (isNumeric) {
        searchBody.accountNo = query;
      } else {
        searchBody.name = query;
      }

      const rawData: any = await platinumSearchAccountsPayment(searchBody).catch((err) => { console.error('[ClientCommunications] Failed to search accounts for payment:', err); return null; });
      const data = rawData || [];
      const items: any[] = Array.isArray(data) ? data : (data?.value || []);
      const results = items.slice(0, 20);
      setSearchResults(results);
      setSearchDropdownOpen(results.length > 0);

      results.forEach((item: any) => {
        const accId = item.account_ID || item.accountID || item.id;
        if (accId && !contactIndicators[accId]) {
          setContactIndicators(prev => ({ ...prev, [accId]: { email: false, mobile: false, loading: true } }));
          Promise.all([
            platinumGetContactDetails({ accountId: String(accId) }).catch((err) => { console.error('[ClientCommunications] Failed to fetch contact details for search result:', err); return null; }),
            platinumGetNameInfoByAccount(accId).catch((err) => { console.error('[ClientCommunications] Failed to fetch name info for search result:', err); return null; }),
          ]).then(([contactRes, nameRes]) => {
            const { email, mobile } = extractContactInfo(contactRes, nameRes);
            setContactIndicators(prev => ({ ...prev, [accId]: { email: !!email, mobile: !!mobile, loading: false } }));
          });
        }
      });
    } catch (err) {
      console.error('[ClientCommunications] Failed to perform account search:', err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, [contactIndicators]);

  const handleSearchInput = (value: string) => {
    setSearchQuery(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (value.length >= 2) {
      searchTimerRef.current = setTimeout(() => performSearch(value), 300);
    } else {
      setSearchResults([]);
      setSearchDropdownOpen(false);
    }
  };

  const fetchContactDetails = async (accountId: number): Promise<{ email: string; mobile: string; additionalEmails: string[] }> => {
    let additionalEmails: string[] = [];

    try {
      const [contactRes, nameRes, addEmailRes] = await Promise.all([
        platinumGetContactDetails({ accountId: String(accountId) }).catch((err) => { console.error('[ClientCommunications] Failed to fetch contact details:', err); return null; }),
        platinumGetNameInfoByAccount(accountId).catch((err) => { console.error('[ClientCommunications] Failed to fetch name info by account:', err); return null; }),
        fetchAdditionalEmailsByAccountId(accountId),
      ]);

      const { email, mobile } = extractContactInfo(contactRes, nameRes);

      if (addEmailRes && !addEmailRes._error) {
        const emails = Array.isArray(addEmailRes) ? addEmailRes : (addEmailRes?.value || addEmailRes?.emails || []);
        additionalEmails = emails
          .map((e: any) => e?.email || e?.emailAddress || e?.Email || (typeof e === 'string' ? e : ''))
          .filter((e: string) => isValidEmail(e));
      }

      return { email, mobile, additionalEmails };
    } catch (err) {
      console.error('[ClientCommunications] Failed to fetch contact details:', err);
      return { email: '', mobile: '', additionalEmails: [] };
    }
  };

  const recipientSetRef = useRef(new Set<number>());

  const addRecipientDirect = (item: any): Recipient => {
    const accId = item.account_ID || item.accountID || item.id;
    const accNo = item.accountNumber || item.accountNo || String(accId);
    const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
    const address = item.deliveryAddress?.replace(/\r?\n/g, ', ') || '';
    const outstanding = item.outStandingAmt || item.outstandingAmount || 0;

    recipientSetRef.current.add(accId);

    return {
      id: `r-${Date.now()}-${accId}`,
      accountId: accId,
      accountNo: accNo,
      name,
      email: '',
      additionalEmails: [],
      mobile: '',
      address,
      outstanding,
      selected: true,
      contactLoading: true,
      contactLoaded: false,
    };
  };

  const addRecipient = async (item: any) => {
    const accId = item.account_ID || item.accountID || item.id;
    if (recipientSetRef.current.has(accId)) {
      toast({ title: 'Already added', description: `Account ${accId} is already in the recipient list.` });
      return;
    }

    const newRecipient = addRecipientDirect(item);
    setRecipients(prev => [...prev, newRecipient]);
    setSearchQuery('');
    setSearchResults([]);
    setSearchDropdownOpen(false);

    const contactInfo = await fetchContactDetails(accId);
    setRecipients(prev => prev.map(r =>
      r.accountId === accId
        ? { ...r, ...contactInfo, contactLoading: false, contactLoaded: true }
        : r
    ));
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportProgress({ current: 0, total: 0, added: 0 });

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const accountNos: string[] = [];

      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/"/g, ''));
        for (const part of parts) {
          const cleaned = part.replace(/\D/g, '');
          if (cleaned.length >= 2 && cleaned.length <= 15) {
            accountNos.push(cleaned);
          }
        }
      }

      const unique = Array.from(new Set(accountNos));
      if (unique.length === 0) {
        toast({ title: 'No new accounts found', description: 'Could not find any new valid account numbers in the file.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      setImportProgress({ current: 0, total: unique.length, added: 0 });
      let totalAdded = 0;
      const pendingContactIds: number[] = [];

      for (let batchStart = 0; batchStart < unique.length; batchStart += BATCH_SIZE) {
        const batch = unique.slice(batchStart, batchStart + BATCH_SIZE);

        const searchPromises = batch.map(async (accNo) => {
          try {
            const rawData: any = await platinumSearchAccountsPayment({ accountNo: accNo }).catch((err) => { console.error('[ClientCommunications] Failed to search account during CSV import:', err); return null; });
            const data = rawData || [];
            const items: any[] = Array.isArray(data) ? data : (data?.value || []);
            return items.find((i: any) => {
              const itemAccNo = String(i.accountNumber || i.accountNo || i.account_ID || i.accountID || i.id || '');
              return itemAccNo === accNo || itemAccNo.replace(/^0+/, '') === accNo.replace(/^0+/, '');
            }) || (items.length > 0 ? items[0] : null);
          } catch (err) {
            console.error('[ClientCommunications] Failed to search account during CSV import:', err);
            return null;
          }
        });

        const foundItems = await Promise.all(searchPromises);
        const validItems = foundItems.filter((item: any): item is any => {
          if (!item) return false;
          const accId = item.account_ID || item.accountID || item.id;
          return accId && !recipientSetRef.current.has(accId);
        });

        if (validItems.length > 0) {
          const newRecipients = validItems.map((item: any) => addRecipientDirect(item));
          setRecipients(prev => [...prev, ...newRecipients]);
          totalAdded += validItems.length;
          pendingContactIds.push(...validItems.map((item: any) => item.account_ID || item.accountID || item.id));
        }

        setImportProgress({ current: Math.min(batchStart + BATCH_SIZE, unique.length), total: unique.length, added: totalAdded });
      }

      toast({
        title: 'Import Complete',
        description: `Added ${totalAdded} account(s). ${pendingContactIds.length > 0 ? 'Loading contact details in the background...' : ''}`,
      });

      setImporting(false);
      setImportProgress({ current: 0, total: 0, added: 0 });

      if (pendingContactIds.length > 0) {
        setContactEnriching(true);
        setContactEnrichProgress({ current: 0, total: pendingContactIds.length });

        for (let ci = 0; ci < pendingContactIds.length; ci += CONTACT_BATCH_SIZE) {
          const contactBatch = pendingContactIds.slice(ci, ci + CONTACT_BATCH_SIZE);
          const contactResults = await Promise.all(
            contactBatch.map(async (accId: number) => {
              const info = await fetchContactDetails(accId);
              return { accId, info };
            })
          );

          setRecipients(prev => {
            const updates = new Map(contactResults.map(cr => [cr.accId, cr.info]));
            return prev.map(r => {
              const info = updates.get(r.accountId);
              return info ? { ...r, ...info, contactLoading: false, contactLoaded: true } : r;
            });
          });

          setContactEnrichProgress({ current: Math.min(ci + CONTACT_BATCH_SIZE, pendingContactIds.length), total: pendingContactIds.length });
        }

        setContactEnriching(false);
        toast({ title: 'Contact Details Loaded', description: `Loaded contact info for ${pendingContactIds.length} account(s).` });
      }
    } catch (err) {
      console.error('[ClientCommunications] Failed to import CSV file:', err);
      toast({ title: 'Import Failed', description: 'Could not read the file.', variant: 'destructive' });
    } finally {
      setImporting(false);
      setImportProgress({ current: 0, total: 0, added: 0 });
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const removeRecipient = (id: string) => {
    setRecipients(prev => {
      const removed = prev.find(r => r.id === id);
      if (removed) recipientSetRef.current.delete(removed.accountId);
      return prev.filter(r => r.id !== id);
    });
  };

  const toggleRecipient = (id: string) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, selected: !r.selected } : r));
  };

  const updateRecipientField = (id: string, field: 'email' | 'mobile', value: string) => {
    setRecipients(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      newAttachments.push({ id: `att-${Date.now()}-${i}`, file: f, name: f.name, size: f.size });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const selectedRecipients = useMemo(() => recipients.filter(r => r.selected), [recipients]);
  const validEmailRecipients = useMemo(() => selectedRecipients.filter(r => r.email || r.additionalEmails.length > 0), [selectedRecipients]);
  const validSmsRecipients = useMemo(() => selectedRecipients.filter(r => r.mobile), [selectedRecipients]);
  const totalEmailAddresses = useMemo(() => validEmailRecipients.reduce((sum, r) => sum + (r.email ? 1 : 0) + r.additionalEmails.length, 0), [validEmailRecipients]);

  const handleSend = () => {
    if (mode === 'email') {
      if (validEmailRecipients.length === 0) {
        toast({ title: 'No email recipients', description: 'None of the selected accounts have email addresses.', variant: 'destructive' });
        return;
      }
      if (!subject.trim()) {
        toast({ title: 'Subject required', description: 'Please enter an email subject.', variant: 'destructive' });
        return;
      }
    } else {
      if (validSmsRecipients.length === 0) {
        toast({ title: 'No SMS recipients', description: 'None of the selected accounts have mobile numbers.', variant: 'destructive' });
        return;
      }
    }
    if (!messageBody.trim()) {
      toast({ title: 'Message required', description: 'Please enter a message body.', variant: 'destructive' });
      return;
    }

    const payload = {
      mode,
      subject: mode === 'email' ? subject : undefined,
      body: messageBody,
      recipients: (mode === 'email' ? validEmailRecipients : validSmsRecipients).map(r => ({
        accountId: r.accountId,
        accountNo: r.accountNo,
        name: r.name,
        email: r.email,
        additionalEmails: r.additionalEmails,
        mobile: r.mobile,
      })),
      attachmentCount: attachments.length,
      attachmentNames: attachments.map(a => a.name),
    };

    console.log('[ClientCommunications] SEND payload (not dispatched):', JSON.stringify(payload, null, 2));

    toast({
      title: 'Ready to Send',
      description: `${mode === 'email' ? `Email to ${totalEmailAddresses} address(es)` : `SMS to ${validSmsRecipients.length} number(s)`} — sending is disabled in this prototype. Payload logged to console.`,
    });
  };

  const selectAll = () => setRecipients(prev => prev.map(r => ({ ...r, selected: true })));
  const deselectAll = () => setRecipients(prev => prev.map(r => ({ ...r, selected: false })));
  const clearAll = () => {
    recipientSetRef.current.clear();
    setRecipients([]);
  };

  const rowVirtualizer = useVirtualizer({
    count: recipients.length,
    getScrollElement: () => recipientListRef.current,
    estimateSize: () => 80,
    overscan: 15,
  });

  return (
    <PosLayout>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="shrink-0 bg-white border-b border-[#D6D6D6] px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--pos-accent)] to-[var(--pos-accent-dark)] flex items-center justify-center shadow-[0_1px_3px_rgba(0,0,0,0.15)]">
                <Mail className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-base sm:text-xl font-bold text-[#2E2E2E] flex items-center gap-2" data-testid="text-page-title">
                  Client Communications
                  <HelpTip text="Send custom emails and SMS messages to account holders. Messages are queued for delivery." side="right" />
                </h1>
                <p className="text-xs sm:text-sm text-[#6B6B6B] mt-0.5">Send custom emails and SMS to account holders</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-[#F2F4F7] rounded-lg p-0.5 self-start sm:self-auto shrink-0">
              <HelpTip text="Choose whether to send via email (Mimecast) or SMS gateway." side="bottom" />
              <button
                onClick={() => setMode('email')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${mode === 'email' ? 'bg-white text-[var(--pos-accent)] shadow-sm border border-[#D6D6D6]' : 'text-slate-500 hover:text-slate-700 active:bg-[#F2F4F7]'}`}
                data-testid="button-mode-email"
              >
                <Mail className="w-3.5 h-3.5" />
                Email
              </button>
              <button
                onClick={() => setMode('sms')}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-all ${mode === 'sms' ? 'bg-white text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:text-slate-700 active:bg-[#F2F4F7]'}`}
                data-testid="button-mode-sms"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                SMS
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-[#F2F4F7] p-4 sm:p-6">
          <div className="space-y-3 sm:space-y-4">

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4">
              <div className="lg:col-span-2 space-y-3 sm:space-y-4">
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: 'min(calc(100vh - 260px), 600px)' }}>
                  <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-[#F7F7F7] shrink-0">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-xs sm:text-sm text-slate-800 flex items-center gap-1.5 sm:gap-2">
                        <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--pos-accent)]" />
                        Recipients
                        {recipients.length > 0 && (
                          <span className="text-[9px] sm:text-[10px] bg-[var(--pos-accent)] text-white px-1.5 py-0.5 rounded-full font-bold">
                            {recipients.length > 999 ? `${(recipients.length / 1000).toFixed(1)}k` : `${selectedRecipients.length}/${recipients.length}`}
                          </span>
                        )}
                      </h2>
                      <div className="flex items-center gap-0.5 sm:gap-1">
                        <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs h-7 sm:h-7 px-1.5 sm:px-2 text-slate-500 hover:text-[var(--pos-accent)]" onClick={downloadCsvTemplate} data-testid="button-download-template" title="Download CSV template">
                          <Download className="w-3 h-3 mr-0.5 sm:mr-1" />
                          <span className="hidden sm:inline">Template</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="text-[10px] sm:text-xs h-7 sm:h-7 px-1.5 sm:px-2 text-slate-500 hover:text-[var(--pos-accent)]" onClick={() => csvInputRef.current?.click()} disabled={importing} data-testid="button-import-csv">
                          {importing ? <Loader2 className="w-3 h-3 animate-spin mr-0.5 sm:mr-1" /> : <Upload className="w-3 h-3 mr-0.5 sm:mr-1" />}
                          Import
                        </Button>
                        <HelpTip text="Upload a CSV file with multiple account numbers or contact details for bulk messaging." side="bottom" />
                        <input ref={csvInputRef} type="file" accept=".csv,.txt,.xlsx" className="hidden" onChange={handleCsvImport} />
                      </div>
                    </div>

                    {importing && importProgress.total > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>Importing {importProgress.current} of {importProgress.total}...</span>
                          <span className="font-medium text-[var(--pos-accent)]">{importProgress.added} added</span>
                        </div>
                        <div className="w-full bg-[#D6D6D6] rounded-full h-1.5">
                          <div className="bg-[var(--pos-accent)] h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.round((importProgress.current / importProgress.total) * 100)}%` }} />
                        </div>
                      </div>
                    )}

                    {contactEnriching && contactEnrichProgress.total > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                          <span>Loading contacts {contactEnrichProgress.current} of {contactEnrichProgress.total}...</span>
                          <span className="font-medium text-emerald-600">{Math.round((contactEnrichProgress.current / contactEnrichProgress.total) * 100)}%</span>
                        </div>
                        <div className="w-full bg-[#D6D6D6] rounded-full h-1.5">
                          <div className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${Math.round((contactEnrichProgress.current / contactEnrichProgress.total) * 100)}%` }} />
                        </div>
                      </div>
                    )}

                    <div className="mt-2 sm:mt-2.5 relative" ref={searchContainerRef}>
                      <div className="flex items-center gap-1 mb-1">
                        <span className="text-[11px] sm:text-xs font-medium text-slate-600">Search Account</span>
                        <HelpTip text="Search for the consumer account to send a message to." />
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          value={searchQuery}
                          onChange={e => handleSearchInput(e.target.value)}
                          placeholder="Search account number or name..."
                          className="pl-9 pr-8 h-10 sm:h-8 text-sm sm:text-xs bg-white border-[#D6D6D6] focus:border-[var(--pos-accent)] rounded-lg sm:rounded-md"
                          data-testid="input-search-recipient"
                        />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
                      </div>

                      {searchDropdownOpen && searchResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-[#D6D6D6] rounded-xl sm:rounded-lg shadow-xl max-h-[50vh] sm:max-h-72 overflow-auto overscroll-contain">
                          {searchResults.map((item, idx) => {
                            const accId = item.account_ID || item.accountID || item.id;
                            const accNo = item.accountNumber || item.accountNo || String(accId);
                            const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
                            const alreadyAdded = recipientSetRef.current.has(accId);
                            const ci = contactIndicators[accId];
                            return (
                              <button
                                key={idx}
                                className={`w-full text-left px-3 py-3 sm:py-2.5 hover:bg-[var(--pos-accent-tint)] active:bg-[var(--pos-accent-tint-strong)] transition-colors border-b border-[#E5E5E5] last:border-b-0 ${alreadyAdded ? 'opacity-40 bg-[#F7F7F7]' : ''}`}
                                onClick={() => !alreadyAdded && addRecipient(item)}
                                disabled={alreadyAdded}
                                data-testid={`button-add-recipient-${accId}`}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[11px] text-[var(--pos-accent)] bg-[var(--pos-accent-tint)] px-1.5 py-0.5 rounded">{accNo}</span>
                                      <span className="text-xs font-medium text-slate-800 truncate">{name}</span>
                                    </div>
                                    {item.deliveryAddress && (
                                      <p className="text-[10px] text-slate-400 mt-0.5 truncate pl-0.5">{item.deliveryAddress.replace(/\r?\n/g, ', ')}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    {ci && !ci.loading && (
                                      <>
                                        <span title={ci.email ? 'Email on file' : 'No email'} className={`inline-flex items-center justify-center w-5 h-5 sm:w-5 sm:h-5 rounded-full ${ci.email ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-300'}`}>
                                          <Mail className="w-2.5 h-2.5" />
                                        </span>
                                        <span title={ci.mobile ? 'Mobile on file' : 'No mobile'} className={`inline-flex items-center justify-center w-5 h-5 sm:w-5 sm:h-5 rounded-full ${ci.mobile ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-300'}`}>
                                          <Phone className="w-2.5 h-2.5" />
                                        </span>
                                      </>
                                    )}
                                    {ci?.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
                                    {alreadyAdded ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Plus className="w-4 h-4 text-[var(--pos-accent)]" />
                                    )}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {recipients.length > 0 && (
                    <div className="flex items-center justify-between px-3 py-1.5 border-b bg-[#F7F7F7] text-[11px] text-slate-500 shrink-0">
                      <span className="font-medium">{selectedRecipients.length} of {recipients.length} selected</span>
                      <div className="flex gap-2">
                        <button onClick={selectAll} className="text-[var(--pos-accent)] hover:underline font-medium active:text-[var(--pos-accent-dark)]">All</button>
                        <button onClick={deselectAll} className="text-slate-400 hover:underline active:text-slate-600">None</button>
                        {recipients.length > 0 && (
                          <button onClick={clearAll} className="text-red-400 hover:text-red-600 hover:underline active:text-red-700">Clear</button>
                        )}
                      </div>
                    </div>
                  )}

                  <div ref={recipientListRef} className="flex-1 overflow-auto" style={{ minHeight: 0 }}>
                    {recipients.length === 0 ? (
                      <div className="p-6 sm:p-8 text-center">
                        <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#F2F4F7] flex items-center justify-center mx-auto mb-2.5 sm:mb-3">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-xs sm:text-sm font-medium text-slate-500">No recipients added</p>
                        <p className="text-[10px] sm:text-xs text-slate-400 mt-1">Search above or import from CSV</p>
                        <button onClick={downloadCsvTemplate} className="mt-2.5 sm:mt-3 inline-flex items-center gap-1 text-[11px] sm:text-xs text-[var(--pos-accent)] hover:text-[var(--pos-accent-dark)] hover:underline active:text-[var(--pos-accent-dark)]" data-testid="button-download-template-empty">
                          <Download className="w-3 h-3" />
                          Download import template
                        </button>
                      </div>
                    ) : (
                      <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                        {rowVirtualizer.getVirtualItems().map(virtualRow => {
                          const r = recipients[virtualRow.index];
                          return (
                            <div
                              key={r.id}
                              data-index={virtualRow.index}
                              ref={rowVirtualizer.measureElement}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                transform: `translateY(${virtualRow.start}px)`,
                              }}
                            >
                              <div className={`flex items-start gap-2 sm:gap-2.5 px-2.5 sm:px-3 py-2.5 border-b border-[#E5E5E5] transition-colors ${r.selected ? 'bg-white' : 'bg-[#F7F7F7]/50 opacity-60'}`}>
                                <input
                                  type="checkbox"
                                  checked={r.selected}
                                  onChange={() => toggleRecipient(r.id)}
                                  className="mt-1 w-4 h-4 rounded border-[#D6D6D6] text-[var(--pos-accent)] focus:ring-[var(--pos-accent)]"
                                  data-testid={`checkbox-recipient-${r.accountId}`}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-[10px] text-[var(--pos-accent)] bg-[var(--pos-accent-tint)] px-1 py-0.5 rounded">{r.accountNo}</span>
                                    <span className="text-xs font-semibold text-slate-800 truncate">{r.name}</span>
                                    {r.contactLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                                  </div>
                                  {r.contactLoaded && (
                                    <div className="mt-1 sm:mt-1.5 flex flex-col gap-0.5 sm:gap-1">
                                      <div className="flex items-center gap-1.5">
                                        <Mail className={`w-3 h-3 shrink-0 ${r.email ? 'text-emerald-500' : 'text-red-300'}`} />
                                        {r.email ? (
                                          <span className="text-[10px] sm:text-[11px] text-slate-600 truncate">{r.email}</span>
                                        ) : (
                                          <span className="text-[10px] sm:text-[11px] text-red-400 italic">No email</span>
                                        )}
                                      </div>
                                      {r.additionalEmails.length > 0 && (
                                        <div className="text-[9px] sm:text-[10px] text-slate-400 pl-[18px]">+{r.additionalEmails.length} more</div>
                                      )}
                                      <div className="flex items-center gap-1.5">
                                        <Phone className={`w-3 h-3 shrink-0 ${r.mobile ? 'text-emerald-500' : 'text-red-300'}`} />
                                        {r.mobile ? (
                                          <span className="text-[10px] sm:text-[11px] text-slate-600">{r.mobile}</span>
                                        ) : (
                                          <span className="text-[10px] sm:text-[11px] text-red-400 italic">No mobile</span>
                                        )}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                <button onClick={() => removeRecipient(r.id)} className="text-slate-300 hover:text-red-500 active:text-red-600 mt-0.5 transition-colors p-1" data-testid={`button-remove-recipient-${r.accountId}`}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {recipients.length > 0 && (
                    <div className="px-2.5 sm:px-3 py-2 border-t bg-[#F7F7F7] shrink-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] sm:text-[11px]">
                        <HelpTip text="Contact information pulled from the account. Additional emails can be added." />
                        <span className="flex items-center gap-1 text-slate-500">
                          <Mail className="w-3 h-3" />
                          <span className="font-medium">{validEmailRecipients.length}</span> email
                        </span>
                        <span className="text-slate-300">|</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Phone className="w-3 h-3" />
                          <span className="font-medium">{validSmsRecipients.length}</span> mobile
                        </span>
                        {mode === 'email' && selectedRecipients.length - validEmailRecipients.length > 0 && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="text-amber-500 font-medium">{selectedRecipients.length - validEmailRecipients.length} missing email</span>
                          </>
                        )}
                        {mode === 'sms' && selectedRecipients.length - validSmsRecipients.length > 0 && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="text-amber-500 font-medium">{selectedRecipients.length - validSmsRecipients.length} missing mobile</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 space-y-3 sm:space-y-4">
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-[#F7F7F7]">
                    <h2 className="font-semibold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                      {mode === 'email' ? <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--pos-accent)]" /> : <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />}
                      Compose {mode === 'email' ? 'Email' : 'SMS'}
                    </h2>
                  </div>
                  <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
                    {mode === 'email' && (
                      <div>
                        <Label className="text-[11px] sm:text-xs font-medium text-slate-600 mb-1 sm:mb-1.5 flex items-center gap-1">Subject <HelpTip text="The email subject line. Not used for SMS messages." /></Label>
                        <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Enter email subject..." className="h-10 sm:h-9 text-sm rounded-lg sm:rounded-md" data-testid="input-subject" />
                      </div>
                    )}

                    <div>
                      <Label className="text-[11px] sm:text-xs font-medium text-slate-600 mb-1 sm:mb-1.5 flex items-center gap-1">
                        Message {mode === 'sms' && <span className="text-slate-400 font-normal ml-1">({messageBody.length}/160)</span>}
                        <HelpTip text="Type your message content. For SMS, keep under 160 characters for a single message." />
                      </Label>
                      <Textarea
                        value={messageBody}
                        onChange={e => setMessageBody(e.target.value)}
                        placeholder={mode === 'email' ? "Type your email message here..." : "Type your SMS message here (160 char limit)..."}
                        rows={6}
                        className="text-sm resize-none rounded-lg sm:rounded-md"
                        maxLength={mode === 'sms' ? 160 : undefined}
                        data-testid="input-message-body"
                      />
                      {mode === 'email' && (
                        <p className="text-[10px] sm:text-[11px] text-slate-400 mt-1 sm:mt-1.5 flex items-center gap-1">
                          <Info className="w-3 h-3 shrink-0" />
                          Plain text only. HTML formatting available when connected to Mimecast.
                        </p>
                      )}
                    </div>

                    {mode === 'email' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-[11px] sm:text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <Paperclip className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            Attachments
                            {attachments.length > 0 && (
                              <span className="text-[9px] sm:text-[10px] bg-[var(--pos-accent-tint-strong)] text-[var(--pos-accent)] px-1.5 py-0.5 rounded-full font-bold">{attachments.length}</span>
                            )}
                            <HelpTip text="Attach files to email messages. Not available for SMS." />
                          </Label>
                          <Button variant="outline" size="sm" className="h-8 sm:h-7 text-xs rounded-lg sm:rounded-md" onClick={() => fileInputRef.current?.click()} data-testid="button-add-attachment">
                            <Plus className="w-3 h-3 mr-1" />
                            Add Files
                          </Button>
                          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} />
                        </div>
                        {attachments.length > 0 ? (
                          <div className="space-y-1.5">
                            {attachments.map(att => (
                              <div key={att.id} className="flex items-center gap-2 bg-[#F7F7F7] rounded-lg px-3 py-2 border border-[#D6D6D6]">
                                <FileText className="w-4 h-4 text-[var(--pos-accent)] shrink-0" />
                                <span className="text-[11px] sm:text-xs text-slate-700 truncate flex-1">{att.name}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">{formatFileSize(att.size)}</span>
                                <button onClick={() => removeAttachment(att.id)} className="text-slate-300 hover:text-red-500 active:text-red-600 transition-colors p-1" data-testid={`button-remove-attachment-${att.id}`}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <p className="text-[10px] text-slate-400 pl-1">Total: {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))}</p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-[#D6D6D6] rounded-lg p-4 sm:p-5 text-center cursor-pointer hover:border-[var(--pos-accent)] hover:bg-[var(--pos-accent-tint)] active:bg-[var(--pos-accent-tint)] transition-all" onClick={() => fileInputRef.current?.click()}>
                            <Upload className="w-5 h-5 mx-auto text-slate-300 mb-1.5" />
                            <p className="text-[11px] sm:text-xs text-slate-400">Tap to upload files</p>
                            <p className="text-[10px] text-slate-300 mt-0.5">PDF, DOCX, XLSX, images</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-3 sm:px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[10px] sm:text-xs text-slate-500 space-y-0.5">
                      {mode === 'email' ? (
                        <>
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[var(--pos-accent)] shrink-0" />
                            <strong className="text-slate-700">{totalEmailAddresses}</strong> email(s) across <strong className="text-slate-700">{validEmailRecipients.length}</strong> account(s)
                          </p>
                          {attachments.length > 0 && (
                            <p className="flex items-center gap-1.5">
                              <Paperclip className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-400 shrink-0" />
                              {attachments.length} attachment(s) — {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="flex items-center gap-1.5">
                          <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 shrink-0" />
                          <strong className="text-slate-700">{validSmsRecipients.length}</strong> SMS recipient(s) &bull; {messageBody.length}/160 chars
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 self-end sm:self-auto">
                      <HelpTip text="Review your message before sending to verify content and recipient details." side="bottom">
                        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="text-xs h-9 sm:h-8 rounded-lg sm:rounded-md" data-testid="button-preview">
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          Preview
                        </Button>
                      </HelpTip>
                      <HelpTip text="Queue the message for delivery. Email via Mimecast, SMS via gateway." side="bottom">
                        <Button
                          onClick={handleSend}
                          size="sm"
                          className={`text-xs h-9 sm:h-8 rounded-lg sm:rounded-md ${mode === 'email' ? 'bg-[var(--pos-accent)] hover:bg-[var(--pos-accent-dark)] active:bg-[var(--pos-accent-dark)]' : 'bg-green-600 hover:bg-green-700 active:bg-green-800'}`}
                          disabled={selectedRecipients.length === 0 || !messageBody.trim()}
                          data-testid="button-send"
                        >
                          <Send className="w-3.5 h-3.5 mr-1.5" />
                          {mode === 'email' ? 'Send Email' : 'Send SMS'}
                        </Button>
                      </HelpTip>
                    </div>
                  </div>
                </div>

                {showPreview && (
                  <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b bg-[#F7F7F7] flex items-center justify-between">
                      <h3 className="font-semibold text-xs sm:text-sm text-slate-800 flex items-center gap-2">
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-600" />
                        Message Preview
                      </h3>
                      <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600 active:text-slate-800 transition-colors p-1">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-3 sm:p-4">
                      {mode === 'email' && (
                        <div className="mb-3 space-y-1.5 text-[11px] sm:text-xs border-b pb-3">
                          <div className="flex gap-2">
                            <span className="text-slate-400 w-12 sm:w-14 shrink-0 font-medium">To:</span>
                            <span className="text-slate-700 break-all">
                              {validEmailRecipients.length > 0
                                ? validEmailRecipients.slice(0, 3).map(r => `${r.name} <${r.email}>`).join('; ')
                                + (validEmailRecipients.length > 3 ? ` (+${validEmailRecipients.length - 3} more)` : '')
                                : '(no recipients)'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-400 w-12 sm:w-14 shrink-0 font-medium">Subject:</span>
                            <span className="text-slate-700 font-medium">{subject || '(no subject)'}</span>
                          </div>
                          {attachments.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-slate-400 w-12 sm:w-14 shrink-0 font-medium">Files:</span>
                              <span className="text-slate-700 break-all">{attachments.map(a => a.name).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="bg-[#F7F7F7] rounded-lg p-3 sm:p-4 border border-[#D6D6D6] whitespace-pre-wrap text-xs sm:text-sm text-slate-700 min-h-[60px] sm:min-h-[80px]">
                        {messageBody || '(empty message)'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </PosLayout>
  );
}
