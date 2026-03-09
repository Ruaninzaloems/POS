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
import { Switch } from '@/components/ui/switch';
import { HelpTip } from '@/components/ui/help-tip';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import {
  FileText,
  Loader2,
  ChevronRight as BreadcrumbSep,
  Plus,
  Pencil,
  History,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  Search,
  RefreshCw,
  Tag,
  FileUp,
} from 'lucide-react';
import {
  fetchDocumentTemplates,
  fetchTemplateVersions,
  createDocumentTemplate,
  updateDocumentTemplate,
  uploadTemplateFile,
  downloadTemplateFile,
} from '@/lib/external-api';
import type { DocumentTemplate, TemplateVersion } from '@/models/debt.models';
import { formatDate, formatFileSize } from '@/services/format.service';
import { TEMPLATE_CATEGORIES } from '@/services/debt-config';

type Template = DocumentTemplate;

export default function DocumentTemplates() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [searchText, setSearchText] = useState('');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showVersionsDialog, setShowVersionsDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editTemplate, setEditTemplate] = useState<Template | null>(null);
  const [versionTemplate, setVersionTemplate] = useState<Template | null>(null);
  const [versions, setVersions] = useState<TemplateVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formCategory, setFormCategory] = useState('SECTION_129');
  const [formDescription, setFormDescription] = useState('');
  const [formActive, setFormActive] = useState(true);

  const [uploadVersion, setUploadVersion] = useState('');
  const [uploadNotes, setUploadNotes] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchDocumentTemplates();
      setTemplates(Array.isArray(data) ? data : data?.templates || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  const filtered = templates.filter(t => {
    if (filterCategory !== 'ALL' && t.category !== filterCategory) return false;
    if (searchText && !t.name.toLowerCase().includes(searchText.toLowerCase()) && !t.templateCode.toLowerCase().includes(searchText.toLowerCase())) return false;
    return true;
  });

  const openCreate = () => {
    setFormName(''); setFormCode(''); setFormCategory('SECTION_129'); setFormDescription(''); setFormActive(true);
    setShowCreateDialog(true);
  };

  const openEdit = (t: Template) => {
    setEditTemplate(t);
    setFormName(t.name); setFormCode(t.templateCode); setFormCategory(t.category); setFormDescription(t.description || ''); setFormActive(t.isActive);
    setShowEditDialog(true);
  };

  const openVersions = async (t: Template) => {
    setVersionTemplate(t);
    setShowVersionsDialog(true);
    setLoadingVersions(true);
    try {
      const data = await fetchTemplateVersions(String(t.id));
      setVersions(Array.isArray(data) ? data : data?.versions || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoadingVersions(false);
    }
  };

  const openUpload = (t: Template) => {
    setVersionTemplate(t);
    const parts = (t.currentVersion || '1.0').split('.');
    const minor = parseInt(parts[1] || '0') + 1;
    setUploadVersion(`${parts[0]}.${minor}`);
    setUploadNotes('');
    setUploadFile(null);
    setShowUploadDialog(true);
  };

  const handleCreate = async () => {
    if (!formName.trim() || !formCode.trim()) {
      toast({ title: 'Validation', description: 'Name and template code are required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await createDocumentTemplate({ name: formName, templateCode: formCode, category: formCategory, description: formDescription, isActive: formActive });
      toast({ title: 'Template Created', description: `${formName} has been created.` });
      setShowCreateDialog(false);
      await loadTemplates();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editTemplate || !formName.trim()) return;
    setSaving(true);
    try {
      await updateDocumentTemplate(String(editTemplate.id), { name: formName, templateCode: formCode, category: formCategory, description: formDescription, isActive: formActive });
      toast({ title: 'Template Updated', description: `${formName} has been updated.` });
      setShowEditDialog(false);
      await loadTemplates();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async () => {
    if (!versionTemplate || !uploadVersion.trim()) {
      toast({ title: 'Validation', description: 'Version number is required', variant: 'destructive' }); return;
    }
    setSaving(true);
    try {
      await uploadTemplateFile(String(versionTemplate.id), { version: uploadVersion, changeNotes: uploadNotes, fileName: uploadFile?.name });
      toast({ title: 'Version Uploaded', description: `Version ${uploadVersion} has been uploaded.` });
      setShowUploadDialog(false);
      await loadTemplates();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = async (templateId: string, versionId?: string) => {
    try {
      await downloadTemplateFile(templateId, versionId);
      toast({ title: 'Download', description: 'File download initiated.' });
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <PosLayout>
      <div className="flex-1 overflow-y-auto bg-[#F2F4F7] p-4">
        <div className="shrink-0 mb-4">
          <div className="flex items-center text-sm text-gray-500 mb-2">
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/')} data-testid="link-home">Home</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="cursor-pointer hover:text-gray-700" onClick={() => setLocation('/debt/section129')} data-testid="link-debt">Debt Management</span>
            <BreadcrumbSep className="h-3.5 w-3.5 mx-1" />
            <span className="text-gray-900 font-medium">Document Templates</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-[var(--pos-accent)] to-[#C4835E]">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2" data-testid="text-page-title">
                Document Templates
                <HelpTip text="Manage version-controlled document templates for Section 129 notices, handover documents, AOD agreements, and other legal correspondence" />
              </h1>
              <p className="text-sm text-gray-500">Version-controlled templates for all debt recovery documents</p>
            </div>
            <Button size="sm" onClick={openCreate} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-create-template">
              <Plus className="h-4 w-4 mr-1" /> New Template
            </Button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto space-y-4">
          <Card className="bg-white border-[#D6D6D6] shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search templates by name or code..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 bg-[#F7F7F7] border-[#D6D6D6]"
                    data-testid="input-search"
                  />
                </div>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[200px] bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-category-filter">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Categories</SelectItem>
                    {TEMPLATE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" className="border-[#D6D6D6]" onClick={loadTemplates} disabled={loading} data-testid="button-refresh">
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>

              {loading && templates.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-[var(--pos-accent)]" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">No templates found</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-[#D6D6D6]">
                      <TableHead className="text-xs">Template Code</TableHead>
                      <TableHead className="text-xs">Name</TableHead>
                      <TableHead className="text-xs">Category</TableHead>
                      <TableHead className="text-xs text-center">Version</TableHead>
                      <TableHead className="text-xs text-center">Status</TableHead>
                      <TableHead className="text-xs">Last Modified</TableHead>
                      <TableHead className="text-xs">Modified By</TableHead>
                      <TableHead className="text-xs text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t, idx) => (
                      <TableRow key={t.id} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-template-${idx}`}>
                        <TableCell className="text-sm font-mono font-medium text-gray-900">{t.templateCode}</TableCell>
                        <TableCell className="text-sm text-gray-900 font-medium">{t.name}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            <Tag className="h-3 w-3" />
                            {TEMPLATE_CATEGORIES.find(c => c.value === t.category)?.label || t.category}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            v{t.currentVersion || '1.0'}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {t.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">
                              <XCircle className="h-3 w-3" /> Inactive
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-gray-700">{formatDate(t.lastModifiedAt)}</TableCell>
                        <TableCell className="text-sm text-gray-700">{t.lastModifiedBy || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-1">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)} title="Edit" data-testid={`button-edit-${idx}`}>
                              <Pencil className="h-3.5 w-3.5 text-gray-600" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openVersions(t)} title="Version History" data-testid={`button-versions-${idx}`}>
                              <History className="h-3.5 w-3.5 text-gray-600" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openUpload(t)} title="Upload New Version" data-testid={`button-upload-${idx}`}>
                              <Upload className="h-3.5 w-3.5 text-[var(--pos-accent)]" />
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(String(t.id))} title="Download Current" data-testid={`button-download-${idx}`}>
                              <Download className="h-3.5 w-3.5 text-gray-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Create Document Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Template Code</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. SEC129_LOD" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-template-code" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Template Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Section 129 Letter of Demand" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-template-name" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Describe the purpose of this template..." className="bg-[#F7F7F7] border-[#D6D6D6] min-h-[80px]" data-testid="input-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} data-testid="switch-active" />
              <Label className="text-sm text-gray-700">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
            <Button onClick={handleCreate} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-save-template">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Template</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-medium text-gray-700">Template Code</Label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-edit-code" />
              </div>
              <div>
                <Label className="text-xs font-medium text-gray-700">Category</Label>
                <Select value={formCategory} onValueChange={setFormCategory}>
                  <SelectTrigger className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="select-edit-category"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Template Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-edit-name" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Description</Label>
              <Textarea value={formDescription} onChange={(e) => setFormDescription(e.target.value)} className="bg-[#F7F7F7] border-[#D6D6D6] min-h-[80px]" data-testid="input-edit-description" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formActive} onCheckedChange={setFormActive} data-testid="switch-edit-active" />
              <Label className="text-sm text-gray-700">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
            <Button onClick={handleUpdate} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-update-template">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Pencil className="h-4 w-4 mr-1" />} Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showVersionsDialog} onOpenChange={setShowVersionsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-[var(--pos-accent)]" />
              Version History — {versionTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {loadingVersions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--pos-accent)]" />
              </div>
            ) : versions.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">No version history available</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-[#D6D6D6]">
                    <TableHead className="text-xs">Version</TableHead>
                    <TableHead className="text-xs">Change Notes</TableHead>
                    <TableHead className="text-xs">Size</TableHead>
                    <TableHead className="text-xs">Uploaded By</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs text-center">Status</TableHead>
                    <TableHead className="text-xs text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v, i) => (
                    <TableRow key={v.id} className="border-[#D6D6D6] hover:bg-[var(--pos-accent-hover-row)]" data-testid={`row-version-${i}`}>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                          v{v.version}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-700 max-w-[200px] truncate">{v.changeNotes || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-700">{formatFileSize(v.fileSize)}</TableCell>
                      <TableCell className="text-sm text-gray-700">{v.uploadedBy || '—'}</TableCell>
                      <TableCell className="text-sm text-gray-700">{formatDate(v.uploadedAt)}</TableCell>
                      <TableCell className="text-center">
                        {v.isActive !== false ? (
                          <span className="text-xs text-emerald-600 font-semibold">Current</span>
                        ) : (
                          <span className="text-xs text-gray-400">Archived</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleDownload(String(versionTemplate?.id), String(v.id))} data-testid={`button-download-version-${i}`}>
                          <Download className="h-3.5 w-3.5 text-gray-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5 text-[var(--pos-accent)]" />
              Upload New Version — {versionTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium text-gray-700">Version Number</Label>
              <Input value={uploadVersion} onChange={(e) => setUploadVersion(e.target.value)} placeholder="e.g. 1.3" className="bg-[#F7F7F7] border-[#D6D6D6]" data-testid="input-upload-version" />
              <p className="text-xs text-gray-400 mt-1">Current: v{versionTemplate?.currentVersion || '1.0'}</p>
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Change Notes</Label>
              <Textarea value={uploadNotes} onChange={(e) => setUploadNotes(e.target.value)} placeholder="Describe what changed in this version..." className="bg-[#F7F7F7] border-[#D6D6D6] min-h-[80px]" data-testid="input-upload-notes" />
            </div>
            <div>
              <Label className="text-xs font-medium text-gray-700">Template File</Label>
              <div className="mt-1 border-2 border-dashed border-[#D6D6D6] rounded-lg p-4 text-center bg-[#F7F7F7]">
                <input
                  type="file"
                  accept=".docx,.doc,.pdf,.xlsx,.xls"
                  className="hidden"
                  id="template-file-input"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  data-testid="input-file"
                />
                <label htmlFor="template-file-input" className="cursor-pointer">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  {uploadFile ? (
                    <p className="text-sm text-gray-700 font-medium">{uploadFile.name}</p>
                  ) : (
                    <p className="text-sm text-gray-500">Click to select a file (.docx, .pdf, .xlsx)</p>
                  )}
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)} className="border-[#D6D6D6]">Cancel</Button>
            <Button onClick={handleUpload} disabled={saving} className="bg-[var(--pos-accent)] hover:bg-[#C4835E] text-white" data-testid="button-upload-version">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />} Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PosLayout>
  );
}
