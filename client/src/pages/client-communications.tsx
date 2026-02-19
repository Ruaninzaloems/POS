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
            Promise.all([
              fetch(`/api/platinum/billing-account-management/get-contact-details?accountId=${accId}`).then(r => r.ok ? r.json() : null).catch(() => null),
              fetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accId}`).then(r => r.ok ? r.json() : null).catch(() => null),
            ]).then(([contactRes, nameRes]) => {
              let hasEmail = false;
              let hasMobile = false;
              if (contactRes && !contactRes._error) {
                const c = Array.isArray(contactRes) ? contactRes[0] : contactRes;
                hasEmail = !!(c?.email || c?.eMail || c?.emailAddress || c?.Email);
                hasMobile = !!(c?.cellphone || c?.cellPhone || c?.mobile || c?.mobileNumber || c?.CellPhone);
              }
              if (nameRes && !nameRes._error) {
                const n = Array.isArray(nameRes) ? nameRes[0] : nameRes;
                if (!hasEmail) hasEmail = !!(n?.email || n?.eMail || n?.emailAddress);
                if (!hasMobile) hasMobile = !!(n?.cellphone || n?.cellPhone || n?.mobile);
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

    try {
      const [contactRes, nameRes, addEmailRes] = await Promise.all([
        fetch(`/api/platinum/billing-account-management/get-contact-details?accountId=${accountId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/platinum/billing-enquiry/name-info-by-account?accountId=${accountId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        fetch(`/api/platinum/billing-account-management/get-additional-emails?accountId=${accountId}`).then(r => r.ok ? r.json() : null).catch(() => null),
      ]);

      if (contactRes && !contactRes._error) {
        const c = Array.isArray(contactRes) ? contactRes[0] : contactRes;
        email = c?.email || c?.eMail || c?.emailAddress || c?.Email || '';
        mobile = c?.cellphone || c?.cellPhone || c?.mobile || c?.mobileNumber || c?.CellPhone || '';
      }

      if (nameRes && !nameRes._error) {
        const n = Array.isArray(nameRes) ? nameRes[0] : nameRes;
        if (!email) email = n?.email || n?.eMail || n?.emailAddress || '';
        if (!mobile) mobile = n?.cellphone || n?.cellPhone || n?.mobile || '';
      }

      if (addEmailRes && !addEmailRes._error) {
        const emails = Array.isArray(addEmailRes) ? addEmailRes : (addEmailRes?.value || addEmailRes?.emails || []);
        additionalEmails = emails
          .map((e: any) => e?.email || e?.emailAddress || e?.Email || (typeof e === 'string' ? e : ''))
          .filter((e: string) => e && e.includes('@'));
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
      r.accountId === accId ? {
        ...r,
        email: contactInfo.email,
        mobile: contactInfo.mobile,
        additionalEmails: contactInfo.additionalEmails,
        contactLoading: false,
        contactLoaded: true,
      } : r
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
      <div className="flex flex-col h-full bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden">
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          <div className="max-w-6xl mx-auto space-y-5">

            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-slate-800" data-testid="text-page-title">Client Communications</h1>
                <p className="text-sm text-slate-500 mt-0.5">Send custom emails and SMS to municipal account holders</p>
              </div>
              <div className="flex bg-white rounded-lg border shadow-sm p-1">
                <button
                  onClick={() => setMode('email')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'email' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                  data-testid="button-mode-email"
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
                <button
                  onClick={() => setMode('sms')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${mode === 'sms' ? 'bg-green-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
                  data-testid="button-mode-sms"
                >
                  <MessageSquare className="w-4 h-4" />
                  SMS
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-xl border shadow-sm">
                  <div className="p-4 border-b bg-slate-50/50 rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Users className="w-4 h-4 text-blue-600" />
                        Recipients
                        {recipients.length > 0 && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{selectedRecipients.length}/{recipients.length}</span>
                        )}
                      </h2>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={() => csvInputRef.current?.click()} disabled={importing} data-testid="button-import-csv">
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
                    <div className="mt-3 relative" ref={searchContainerRef}>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          value={searchQuery}
                          onChange={e => handleSearchInput(e.target.value)}
                          placeholder="Search by account number or name..."
                          className="pl-9 pr-8 h-9 text-sm"
                          data-testid="input-search-recipient"
                        />
                        {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                      </div>

                      {searchDropdownOpen && searchResults.length > 0 && (
                        <div className="absolute z-50 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-64 overflow-auto">
                          {searchResults.map((item, idx) => {
                            const accId = item.account_ID || item.accountID || item.id;
                            const accNo = item.accountNumber || item.accountNo || String(accId);
                            const name = [item.initials, item.lastName].filter(Boolean).join(' ') || item.name || 'Unknown';
                            const alreadyAdded = recipients.some(r => r.accountId === accId);
                            const ci = contactIndicators[accId];
                            return (
                              <button
                                key={idx}
                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors border-b last:border-b-0 ${alreadyAdded ? 'opacity-50' : ''}`}
                                onClick={() => !alreadyAdded && addRecipient(item)}
                                disabled={alreadyAdded}
                                data-testid={`button-add-recipient-${accId}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-xs text-blue-600">{accNo}</span>
                                    <span className="text-sm text-slate-800">{name}</span>
                                    {ci && !ci.loading && (
                                      <span className="flex items-center gap-1 ml-1">
                                        <span title={ci.email ? 'Email available' : 'No email'} className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium ${ci.email ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-400'}`}>
                                          <Mail className="w-3 h-3" />
                                        </span>
                                        <span title={ci.mobile ? 'Mobile available' : 'No mobile'} className={`inline-flex items-center gap-0.5 px-1 py-0.5 rounded text-[10px] font-medium ${ci.mobile ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-400'}`}>
                                          <Phone className="w-3 h-3" />
                                        </span>
                                      </span>
                                    )}
                                    {ci?.loading && <Loader2 className="w-3 h-3 animate-spin text-slate-300 ml-1" />}
                                  </div>
                                  {alreadyAdded ? (
                                    <span className="text-xs text-green-600">Added</span>
                                  ) : (
                                    <Plus className="w-4 h-4 text-blue-500" />
                                  )}
                                </div>
                                {item.deliveryAddress && (
                                  <p className="text-xs text-slate-400 mt-0.5 truncate">{item.deliveryAddress.replace(/\r?\n/g, ', ')}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="max-h-[420px] overflow-auto">
                    {recipients.length === 0 ? (
                      <div className="p-8 text-center text-slate-400">
                        <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
                        <p className="text-sm font-medium">No recipients added</p>
                        <p className="text-xs mt-1">Search for accounts or import a CSV file</p>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between px-3 py-1.5 border-b bg-slate-50/80 text-xs text-slate-500">
                          <span>{selectedRecipients.length} selected</span>
                          <div className="flex gap-2">
                            <button onClick={selectAll} className="text-blue-600 hover:underline">Select All</button>
                            <button onClick={deselectAll} className="text-slate-500 hover:underline">None</button>
                          </div>
                        </div>
                        {recipients.map(r => (
                          <div key={r.id} className={`flex items-start gap-2 px-3 py-2.5 border-b last:border-b-0 transition-colors ${r.selected ? 'bg-white' : 'bg-slate-50 opacity-60'}`}>
                            <input
                              type="checkbox"
                              checked={r.selected}
                              onChange={() => toggleRecipient(r.id)}
                              className="mt-1 rounded border-slate-300"
                              data-testid={`checkbox-recipient-${r.accountId}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-blue-600">{r.accountNo}</span>
                                <span className="text-sm font-medium text-slate-800 truncate">{r.name}</span>
                                {r.contactLoading && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                              </div>
                              {r.contactLoaded && (
                                <div className="mt-1 space-y-0.5">
                                  {mode === 'email' ? (
                                    <>
                                      <div className="flex items-center gap-1.5">
                                        <Mail className="w-3 h-3 text-slate-400" />
                                        {r.email ? (
                                          <input
                                            type="email"
                                            value={r.email}
                                            onChange={e => updateRecipientField(r.id, 'email', e.target.value)}
                                            className="text-xs text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0.5 w-full"
                                          />
                                        ) : (
                                          <span className="text-xs text-amber-500">No email on file</span>
                                        )}
                                      </div>
                                      {r.additionalEmails.length > 0 && (
                                        <div className="text-xs text-slate-400 pl-4">
                                          +{r.additionalEmails.length} additional: {r.additionalEmails.join(', ')}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <MessageSquare className="w-3 h-3 text-slate-400" />
                                      {r.mobile ? (
                                        <input
                                          type="tel"
                                          value={r.mobile}
                                          onChange={e => updateRecipientField(r.id, 'mobile', e.target.value)}
                                          className="text-xs text-slate-600 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none py-0.5 w-full"
                                        />
                                      ) : (
                                        <span className="text-xs text-amber-500">No mobile on file</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            <button onClick={() => removeRecipient(r.id)} className="text-slate-400 hover:text-red-500 mt-0.5" data-testid={`button-remove-recipient-${r.accountId}`}>
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {recipients.length > 0 && (
                    <div className="px-3 py-2 border-t bg-slate-50/80 rounded-b-xl">
                      <div className="flex items-center justify-between text-xs text-slate-500">
                        {mode === 'email' ? (
                          <>
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3" />
                              {validEmailRecipients.length} with email ({totalEmailAddresses} addresses)
                            </span>
                            <span className="text-amber-500">{selectedRecipients.length - validEmailRecipients.length} missing email</span>
                          </>
                        ) : (
                          <>
                            <span className="flex items-center gap-1">
                              <MessageSquare className="w-3 h-3" />
                              {validSmsRecipients.length} with mobile
                            </span>
                            <span className="text-amber-500">{selectedRecipients.length - validSmsRecipients.length} missing mobile</span>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-3 space-y-4">
                <div className="bg-white rounded-xl border shadow-sm">
                  <div className="p-4 border-b bg-slate-50/50 rounded-t-xl">
                    <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                      {mode === 'email' ? <Mail className="w-4 h-4 text-blue-600" /> : <MessageSquare className="w-4 h-4 text-green-600" />}
                      Compose {mode === 'email' ? 'Email' : 'SMS'}
                    </h2>
                  </div>
                  <div className="p-4 space-y-4">
                    {mode === 'email' && (
                      <div>
                        <Label className="text-sm text-slate-600 mb-1.5 block">Subject</Label>
                        <Input
                          value={subject}
                          onChange={e => setSubject(e.target.value)}
                          placeholder="Enter email subject..."
                          className="h-9"
                          data-testid="input-subject"
                        />
                      </div>
                    )}

                    <div>
                      <Label className="text-sm text-slate-600 mb-1.5 block">
                        Message {mode === 'sms' && <span className="text-xs text-slate-400 ml-1">({messageBody.length}/160 characters)</span>}
                      </Label>
                      <Textarea
                        value={messageBody}
                        onChange={e => setMessageBody(e.target.value)}
                        placeholder={mode === 'email' ? "Type your email message here..." : "Type your SMS message here (160 char limit)..."}
                        rows={mode === 'email' ? 10 : 4}
                        className="text-sm resize-none"
                        maxLength={mode === 'sms' ? 160 : undefined}
                        data-testid="input-message-body"
                      />
                      {mode === 'email' && (
                        <p className="text-xs text-slate-400 mt-1">Supports plain text. HTML formatting will be available when connected to Mimecast.</p>
                      )}
                    </div>

                    {mode === 'email' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm text-slate-600 flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5" />
                            Attachments
                            {attachments.length > 0 && (
                              <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{attachments.length}</span>
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
                              <div key={att.id} className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 border">
                                <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                                <span className="text-sm text-slate-700 truncate flex-1">{att.name}</span>
                                <span className="text-xs text-slate-400 shrink-0">{formatFileSize(att.size)}</span>
                                <button onClick={() => removeAttachment(att.id)} className="text-slate-400 hover:text-red-500" data-testid={`button-remove-attachment-${att.id}`}>
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                            <p className="text-xs text-slate-400">
                              Total: {formatFileSize(attachments.reduce((s, a) => s + a.size, 0))}
                            </p>
                          </div>
                        ) : (
                          <div className="border-2 border-dashed border-slate-200 rounded-lg p-4 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <Upload className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                            <p className="text-xs text-slate-400">Click to upload or drag and drop</p>
                            <p className="text-xs text-slate-300 mt-0.5">PDF, DOCX, XLSX, images, etc.</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border shadow-sm">
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="text-sm text-slate-500 space-y-0.5">
                      {mode === 'email' ? (
                        <>
                          <p className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-blue-500" />
                            <strong>{totalEmailAddresses}</strong> email address(es) across <strong>{validEmailRecipients.length}</strong> account(s)
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
                          <strong>{validSmsRecipients.length}</strong> SMS recipient(s) • {messageBody.length}/160 chars
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} data-testid="button-preview">
                        <Eye className="w-4 h-4 mr-1.5" />
                        Preview
                      </Button>
                      <Button
                        onClick={handleSend}
                        className={mode === 'email' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
                        disabled={selectedRecipients.length === 0 || !messageBody.trim()}
                        data-testid="button-send"
                      >
                        <Send className="w-4 h-4 mr-1.5" />
                        {mode === 'email' ? 'Send Email' : 'Send SMS'}
                      </Button>
                    </div>
                  </div>
                </div>

                {showPreview && (
                  <div className="bg-white rounded-xl border shadow-sm">
                    <div className="p-4 border-b bg-slate-50/50 rounded-t-xl flex items-center justify-between">
                      <h3 className="font-semibold text-slate-800 text-sm flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Message Preview
                      </h3>
                      <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="p-4">
                      {mode === 'email' && (
                        <div className="mb-3 space-y-1 text-sm">
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-16 shrink-0">To:</span>
                            <span className="text-slate-700">
                              {validEmailRecipients.length > 0
                                ? validEmailRecipients.slice(0, 3).map(r => `${r.name} <${r.email}>`).join('; ')
                                + (validEmailRecipients.length > 3 ? ` (+${validEmailRecipients.length - 3} more)` : '')
                                : '(no recipients)'}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-slate-500 w-16 shrink-0">Subject:</span>
                            <span className="text-slate-700 font-medium">{subject || '(no subject)'}</span>
                          </div>
                          {attachments.length > 0 && (
                            <div className="flex gap-2">
                              <span className="text-slate-500 w-16 shrink-0">Attach:</span>
                              <span className="text-slate-700">{attachments.map(a => a.name).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="bg-slate-50 rounded-lg p-4 border whitespace-pre-wrap text-sm text-slate-700 min-h-[80px]">
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
