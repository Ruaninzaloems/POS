import React, { useState, useCallback, useRef, useEffect } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
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

function formatCurrency(amt: number): string {
  return `R ${amt.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function downloadCsvTemplate() {
  const header = 'AccountNumber';
  const sample = [
    '000000001234',
    '000000005678',
    '000000009012',
  ];
  const csv = [header, ...sample].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'import_template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

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
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

      const res = await fetch('/api/platinum/billing-payment/search-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchBody),
      });

      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data?.value || []);
        const results = items.slice(0, 15);
        setSearchResults(results);
        setSearchDropdownOpen(results.length > 0);

        results.forEach((item: any) => {
          const accId = item.account_ID || item.accountID || item.id;
          if (accId && !contactIndicators[accId]) {
            setContactIndicators(prev => ({ ...prev, [accId]: { email: false, mobile: false, loading: true } }));
            const validStr = (v: any) => typeof v === 'string' && v.trim().length > 1;
            const validEmail = (v: any) => validStr(v) && v.includes('@');
            Promise.all([
              fetch(`/api/platinum/billing-account-management/get-contact-details?accountId=${accId}`).then(r => r.ok ? r.json() : null).catch(() => null),
              fetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accId}`).then(r => r.ok ? r.json() : null).catch(() => null),
            ]).then(([contactRes, nameRes]) => {
              let hasEmail = false;
              let hasMobile = false;
              if (contactRes && !contactRes._error) {
                const c = Array.isArray(contactRes) ? contactRes[0] : contactRes;
                hasEmail = validEmail(c?.email) || validEmail(c?.eMail) || validEmail(c?.emailAddress) || validEmail(c?.Email);
                hasMobile = validStr(c?.cellphone) || validStr(c?.cellPhone) || validStr(c?.mobile) || validStr(c?.mobileNumber) || validStr(c?.CellPhone);
              }
              if (nameRes && !nameRes._error) {
                const n = Array.isArray(nameRes) ? nameRes[0] : nameRes;
                if (!hasEmail) hasEmail = validEmail(n?.email) || validEmail(n?.eMail) || validEmail(n?.emailAddress);
                if (!hasMobile) hasMobile = validStr(n?.cellphone) || validStr(n?.cellPhone) || validStr(n?.mobile);
              }
              setContactIndicators(prev => ({ ...prev, [accId]: { email: hasEmail, mobile: hasMobile, loading: false } }));
            });
          }
        });
      } else {
        setSearchResults([]);
      }
    } catch {
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
    let email = '';
    let mobile = '';
    let additionalEmails: string[] = [];

    const clean = (v: any) => (typeof v === 'string' ? v.trim() : '');
    const pickEmail = (...vals: any[]) => vals.map(clean).find(v => v.length > 1 && v.includes('@')) || '';
    const pickPhone = (...vals: any[]) => vals.map(clean).find(v => v.length > 1) || '';

    try {
      const [contactRes, nameRes, addEmailRes] = await Promise.all([
        fetch(`/api/platinum/billing-account-management/get-contact-details?accountId=${accountId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/platinum/billing-account-management/get-additional-emails?accountId=${accountId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (contactRes && !contactRes._error) {
        const c = Array.isArray(contactRes) ? contactRes[0] : contactRes;
        email = pickEmail(c?.email, c?.eMail, c?.emailAddress, c?.Email);
        mobile = pickPhone(c?.cellphone, c?.cellPhone, c?.mobile, c?.mobileNumber, c?.CellPhone);
      }

      if (nameRes && !nameRes._error) {
        const n = Array.isArray(nameRes) ? nameRes[0] : nameRes;
        if (!email) email = pickEmail(n?.email, n?.eMail, n?.emailAddress);
        if (!mobile) mobile = pickPhone(n?.cellphone, n?.cellPhone, n?.mobile);
      }

      if (addEmailRes && !addEmailRes._error) {
        const emails = Array.isArray(addEmailRes) ? addEmailRes : (addEmailRes?.value || addEmailRes?.emails || []);
        additionalEmails = emails
          .map((e: any) => e?.email || e?.emailAddress || e?.Email || (typeof e === 'string' ? e : ''))
          .filter((e: string) => e && e.trim().length > 1 && e.includes('@'));
      }
    } catch {}

    return { email, mobile, additionalEmails };
  };

  const addRecipient = async (item: any) => {
    const accId = item.account_ID || item.accountID || item.id;
    if (recipients.some(r => r.accountId === accId)) {
      toast({ title: 'Already added', description: `Account ${accId} is already in the recipient list.` });
      return;
    }

    const accNo = item.accountNumber || item.accountNo || String(accId);
    const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
    const address = item.deliveryAddress?.replace(/\r?\n/g, ', ') || '';
    const outstanding = item.outStandingAmt || item.outstandingAmount || 0;

    const newRecipient: Recipient = {
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

  const removeRecipient = (id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
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
      newAttachments.push({
        id: `att-${Date.now()}-${i}`,
        file: f,
        name: f.name,
        size: f.size,
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      const accountNos: string[] = [];

      for (const line of lines) {
        const parts = line.split(/[,;\t]/).map(p => p.trim().replace(/"/g, ''));
        for (const part of parts) {
          const cleaned = part.replace(/\D/g, '');
          if (cleaned.length >= 2 && cleaned.length <= 12) {
            accountNos.push(cleaned);
          }
        }
      }

      const unique = Array.from(new Set(accountNos));
      if (unique.length === 0) {
        toast({ title: 'No accounts found', description: 'Could not find any valid account numbers in the file.', variant: 'destructive' });
        setImporting(false);
        return;
      }

      let added = 0;
      for (const accNo of unique.slice(0, 100)) {
        try {
          const res = await fetch('/api/platinum/billing-payment/search-accounts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountNo: accNo }),
          });
          if (res.ok) {
            const data = await res.json();
            const items = Array.isArray(data) ? data : (data?.value || []);
            const exact = items.find((i: any) => {
              const id = String(i.account_ID || i.accountID || i.id || '');
              return id === accNo;
            });
            if (exact && !recipients.some(r => r.accountId === (exact.account_ID || exact.accountID || exact.id))) {
              await addRecipient(exact);
              added++;
            }
          }
        } catch {}
      }

      toast({
        title: 'Import Complete',
        description: `Added ${added} account(s) from ${unique.length} found in file.`,
      });
    } catch {
      toast({ title: 'Import Failed', description: 'Could not read the file.', variant: 'destructive' });
    } finally {
      setImporting(false);
      if (csvInputRef.current) csvInputRef.current.value = '';
    }
  };

  const selectedRecipients = recipients.filter(r => r.selected);
  const validEmailRecipients = selectedRecipients.filter(r => r.email || r.additionalEmails.length > 0);
  const validSmsRecipients = selectedRecipients.filter(r => r.mobile);
  const totalEmailAddresses = validEmailRecipients.reduce((sum, r) => sum + (r.email ? 1 : 0) + r.additionalEmails.length, 0);

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

  return (
    <PosLayout>
      <div className="flex flex-col h-full bg-slate-50/70 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-4">

            <div className="flex items-center justify-between bg-white rounded-xl border shadow-sm px-5 py-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5" data-testid="text-page-title">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
                    <Mail className="w-4 h-4 text-white" />
                  </div>
                  Client Communications
                </h1>
                <p className="text-xs text-slate-500 mt-1 ml-[42px]">Send custom emails and SMS to municipal account holders</p>
              </div>
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setMode('email')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'email' ? 'bg-white text-blue-700 shadow-sm border border-blue-200' : 'text-slate-500 hover:text-slate-700'}`}
                  data-testid="button-mode-email"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
                <button
                  onClick={() => setMode('sms')}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'sms' ? 'bg-white text-green-700 shadow-sm border border-green-200' : 'text-slate-500 hover:text-slate-700'}`}
                  data-testid="button-mode-sms"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  SMS
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        Recipients
                        {recipients.length > 0 && (
                          <span className="text-[10px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">{selectedRecipients.length}/{recipients.length}</span>
                        )}
                      </h2>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 px-2 text-slate-500 hover:text-blue-600"
                          onClick={downloadCsvTemplate}
                          data-testid="button-download-template"
                          title="Download CSV template"
                        >
                          <Download className="w-3 h-3 mr-1" />
                          Template
                        </Button>
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2 text-slate-500 hover:text-blue-600" onClick={() => csvInputRef.current?.click()} disabled={importing} data-testid="button-import-csv">
                          {importing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Upload className="w-3 h-3 mr-1" />}
                          Import
                        </Button>
                        <input
                          ref={csvInputRef}
                          type="file"
                          accept=".csv,.txt,.xlsx"
                          className="hidden"
                          onChange={handleCsvImport}
                        />
                      </div>
                    </div>
                    <div className="mt-2.5 relative" ref={searchContainerRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                        <Input
                          value={searchQuery}
                          onChange={e => handleSearchInput(e.target.value)}
                          placeholder="Search by account number or name..."
                          className="pl-8 pr-8 h-8 text-xs bg-white border-slate-200 focus:border-blue-400"
                          data-testid="input-search-recipient"
                        />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
                      </div>

                      {searchDropdownOpen && searchResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-xl max-h-72 overflow-auto">
                          {searchResults.map((item, idx) => {
                            const accId = item.account_ID || item.accountID || item.id;
                            const accNo = item.accountNumber || item.accountNo || String(accId);
                            const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
                            const alreadyAdded = recipients.some(r => r.accountId === accId);
                            const ci = contactIndicators[accId];
                            return (
                              <button
                                key={idx}
                                className={`w-full text-left px-3 py-2.5 hover:bg-blue-50/70 transition-colors border-b border-slate-100 last:border-b-0 ${alreadyAdded ? 'opacity-40 bg-slate-50' : ''}`}
                                onClick={() => !alreadyAdded && addRecipient(item)}
                                disabled={alreadyAdded}
                                data-testid={`button-add-recipient-${accId}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-mono text-[11px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{accNo}</span>
                                      <span className="text-xs font-medium text-slate-800 truncate">{name}</span>
                                    </div>
                                    {item.deliveryAddress && (
                                      <p className="text-[10px] text-slate-400 mt-0.5 truncate pl-0.5">{item.deliveryAddress.replace(/\r?\n/g, ', ')}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5 ml-2 shrink-0">
                                    {ci && !ci.loading && (
                                      <>
                                        <span title={ci.email ? 'Email on file' : 'No email'} className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${ci.email ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-300'}`}>
                                          <Mail className="w-2.5 h-2.5" />
                                        </span>
                                        <span title={ci.mobile ? 'Mobile on file' : 'No mobile'} className={`inline-flex items-center justify-center w-5 h-5 rounded-full ${ci.mobile ? 'bg-emerald-100 text-emerald-600' : 'bg-red-50 text-red-300'}`}>
                                          <Phone className="w-2.5 h-2.5" />
                                        </span>
                                      </>
                                    )}
                                    {ci?.loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-300" />}
                                    {alreadyAdded ? (
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    ) : (
                                      <Plus className="w-4 h-4 text-blue-500" />
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

                  <div className="max-h-[400px] overflow-auto">
                    {recipients.length === 0 ? (
                      <div className="p-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
                          <Users className="w-5 h-5 text-slate-400" />
                        </div>
                        <p className="text-sm font-medium text-slate-500">No recipients added</p>
                        <p className="text-xs text-slate-400 mt-1">Search for accounts above or import from CSV</p>
                        <button
                          onClick={downloadCsvTemplate}
                          className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 hover:underline"
                          data-testid="button-download-template-empty"
                        >
                          <Download className="w-3 h-3" />
                          Download import template
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-slate-50/80 text-[11px] text-slate-500">
                          <span className="font-medium">{selectedRecipients.length} of {recipients.length} selected</span>
                          <div className="flex gap-2">
                            <button onClick={selectAll} className="text-blue-600 hover:underline font-medium">Select All</button>
                            <button onClick={deselectAll} className="text-slate-400 hover:underline">None</button>
                          </div>
                        </div>
                        {recipients.map(r => (
                          <div key={r.id} className={`flex items-start gap-2.5 px-3 py-2.5 border-b border-slate-100 last:border-b-0 transition-colors ${r.selected ? 'bg-white' : 'bg-slate-50/60 opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={r.selected}
                              onChange={() => toggleRecipient(r.id)}
                              className="mt-1 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              data-testid={`checkbox-recipient-${r.accountId}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-blue-600 bg-blue-50 px-1 py-0.5 rounded">{r.accountNo}</span>
                                <span className="text-xs font-semibold text-slate-800 truncate">{r.name}</span>
                                {r.contactLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                              </div>
                              {r.contactLoaded && (
                                <div className="mt-1.5 flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5">
                                    <Mail className={`w-3 h-3 shrink-0 ${r.email ? 'text-emerald-500' : 'text-red-300'}`} />
                                    {r.email ? (
                                      <input
                                        type="email"
                                        value={r.email}
                                        onChange={e => updateRecipientField(r.id, 'email', e.target.value)}
                                        className="text-[11px] text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0 w-full"
                                      />
                                    ) : (
                                      <span className="text-[11px] text-red-400 italic">No email on file</span>
                                    )}
                                  </div>
                                  {r.additionalEmails.length > 0 && (
                                    <div className="text-[10px] text-slate-400 pl-[18px]">
                                      +{r.additionalEmails.length} more: {r.additionalEmails.join(', ')}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5">
                                    <Phone className={`w-3 h-3 shrink-0 ${r.mobile ? 'text-emerald-500' : 'text-red-300'}`} />
                                    {r.mobile ? (
                                      <input
                                        type="tel"
                                        value={r.mobile}
                                        onChange={e => updateRecipientField(r.id, 'mobile', e.target.value)}
                                        className="text-[11px] text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0 w-full"
                                      />
                                    ) : (
                                      <span className="text-[11px] text-red-400 italic">No mobile on file</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                            <button onClick={() => removeRecipient(r.id)} className="text-slate-300 hover:text-red-500 mt-0.5 transition-colors" data-testid={`button-remove-recipient-${r.accountId}`}>
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {recipients.length > 0 && (
                    <div className="px-3 py-2 border-t bg-gradient-to-r from-slate-50 to-white rounded-b-xl">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="flex items-center gap-1 text-slate-500">
                          <Mail className="w-3 h-3" />
                          <span className="font-medium">{validEmailRecipients.length}</span> with email
                          <span className="text-slate-300 mx-0.5">|</span>
                          <Phone className="w-3 h-3" />
                          <span className="font-medium">{validSmsRecipients.length}</span> with mobile
                        </span>
                        {mode === 'email' && selectedRecipients.length - validEmailRecipients.length > 0 && (
                          <span className="text-amber-500 font-medium">{selectedRecipients.length - validEmailRecipients.length} missing email</span>
                        )}
                        {mode === 'sms' && selectedRecipients.length - validSmsRecipients.length > 0 && (
                          <span className="text-amber-500 font-medium">{selectedRecipients.length - validSmsRecipients.length} missing mobile</span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white">
                    <h2 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                      {mode === 'email' ? <Mail className="w-4 h-4 text-blue-600" /> : <MessageSquare className="w-4 h-4 text-green-600" />}
                      Compose {mode === 'email' ? 'Email' : 'SMS'}
                    </h2>
                  </div>
                  <div className="p-4 space-y-4">
                    {mode === 'email' && (
                      <div>
                        <Label className="text-xs font-medium text-slate-600 mb-1.5 block">Subject</Label>
                        <Input
                          value={subject}
                          onChange={e => setSubject(e.target.value)}
                          placeholder="Enter email subject..."
                          className="h-9 text-sm"
                          data-testid="input-subject"
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-xs font-medium text-slate-600 mb-1.5 block">
                        Message {mode === 'sms' && <span className="text-slate-400 font-normal ml-1">({messageBody.length}/160 characters)</span>}
                      </Label>
                      <Textarea
                        value={messageBody}
                        onChange={e => setMessageBody(e.target.value)}
                        placeholder={mode === 'email' ? "Type your email message here..." : "Type your SMS message here (160 char limit)..."}
                        rows={mode === 'email' ? 8 : 4}
                        className="text-sm resize-none"
                        maxLength={mode === 'sms' ? 160 : undefined}
                        data-testid="input-message-body"
                      />
                      {mode === 'email' && (
                        <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                          <Info className="w-3 h-3" />
                          Plain text only. HTML formatting will be available when connected to Mimecast.
                        </p>
                      )}
                    </div>

                    {mode === 'email' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" />
                            Attachments
                            {attachments.length > 0 && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">{attachments.length}</span>
                            )}
                          </Label>
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => fileInputRef.current?.click()} data-testid="button-add-attachment">
                            <Plus className="w-3 h-3 mr-1" />
                            Add Files
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={handleFileUpload}
                          />
                        </div>
                        {attachments.length > 0 ? (
                          <div className="space-y-1.5">
                            {attachments.map(att => (
                              <div key={att.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-xs text-slate-700 truncate flex-1">{att.name}</span>
                                <span className="text-[10px] text-slate-400 shrink-0">{formatFileSize(att.size)}</span>
                                <button onClick={() => removeAttachment(att.id)} className="text-slate-300 hover:text-red-500 transition-colors" data-testid={`button-remove-attachment-${att.id}`}>
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ))}
                            <p className="text-[10px] text-slate-400 pl-1">
                              Total: {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))}
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-slate-200 rounded-lg p-5 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/20 transition-all"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-5 h-5 mx-auto text-slate-300 mb-1.5" />
                            <p className="text-xs text-slate-400">Click to upload or drag and drop</p>
                            <p className="text-[10px] text-slate-300 mt-0.5">PDF, DOCX, XLSX, images, etc.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                  <div className="px-4 py-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-slate-500 space-y-0.5">
                      {mode === 'email' ? (
                        <>
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            <strong className="text-slate-700">{totalEmailAddresses}</strong> email address(es) across <strong className="text-slate-700">{validEmailRecipients.length}</strong> account(s)
                          </p>
                          {attachments.length > 0 && (
                            <p className="flex items-center gap-1.5">
                              <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                              {attachments.length} attachment(s) — {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-green-500" />
                          <strong className="text-slate-700">{validSmsRecipients.length}</strong> SMS recipient(s) &bull; {messageBody.length}/160 chars
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="text-xs" data-testid="button-preview">
                        <Eye className="w-3.5 h-3.5 mr-1.5" />
                        Preview
                      </Button>
                      <Button
                        onClick={handleSend}
                        size="sm"
                        className={`text-xs ${mode === 'email' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                        disabled={selectedRecipients.length === 0 || !messageBody.trim()}
                        data-testid="button-send"
                      >
                        <Send className="w-3.5 h-3.5 mr-1.5" />
                        {mode === 'email' ? 'Send Email' : 'Send SMS'}
                      </Button>
                    </div>
                  </div>
                </div>

                {showPreview && (
                  <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                      <h3 className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                        <Eye className="w-4 h-4 text-slate-600" />
                        Message Preview
                      </h3>
                      <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      {mode === 'email' && (
                        <div className="mb-3 space-y-1.5 text-xs border-b pb-3">
                          <div className="flex gap-2">
                            <span className="text-slate-400 w-14 shrink-0 font-medium">To:</span>
                            <span className="text-slate-700">
                              {validEmailRecipients.length > 0
                                ? validEmailRecipients.slice(0, 3).map(r => `${r.name} <${r.email}>`).join('; ')
                                + (validEmailRecipients.length > 3 ? ` (+${validEmailRecipients.length - 3} more)` : '')
                                : '(no recipients)'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-400 w-14 shrink-0 font-medium">Subject:</span>
                            <span className="text-slate-700 font-medium">{subject || '(no subject)'}</span>
                          </div>
                          {attachments.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-slate-400 w-14 shrink-0 font-medium">Files:</span>
                              <span className="text-slate-700">{attachments.map(a => a.name).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 whitespace-pre-wrap text-sm text-slate-700 min-h-[80px]">
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
