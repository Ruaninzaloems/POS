import React, { useState, useEffect, useCallback } from 'react';
import { PosLayout } from '@/components/layout/pos-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw, Loader2, DollarSign, CreditCard, Receipt, Users, Banknote, ArrowUpDown, AlertTriangle, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
    platinumGetPosCount,
    platinumGetPosTabItemDetailsCount,
    platinumGetAlertCounts,
    platinumGetNotificationCounts,
    platinumGetBillingPaymentByTypeOfUse,
    platinumGetAccountCount,
    platinumGetDepositTableData,
    platinumGetDirectDepositsAllocationTableData,
    platinumGetThirdPartyPaymentPendingTableData,
    platinumGetPostDatedChequeTableData,
} from '@/lib/external-api';

function extractItems(data: any): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (data.items) return Array.isArray(data.items) ? data.items : [];
    if (data.value) return Array.isArray(data.value) ? data.value : [];
    if (data.results) return Array.isArray(data.results) ? data.results : [];
    if (data.data) return Array.isArray(data.data) ? data.data : [];
    if (data.rows) return Array.isArray(data.rows) ? data.rows : [];
    return [];
}

function extractTotal(data: any, fallbackLength: number): number {
    if (!data) return fallbackLength;
    return data.totalCount ?? data.totalRecords ?? data.count ?? data.total ?? fallbackLength;
}

interface CountCard {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    color: string;
}

function DashboardCountCard({ card }: { card: CountCard }) {
    return (
        <Card data-testid={`card-count-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>
            <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${card.color}`}>
                    {card.icon}
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">{card.label}</p>
                    <p className="text-2xl font-bold" data-testid={`text-count-${card.label.toLowerCase().replace(/\s+/g, '-')}`}>{card.value}</p>
                </div>
            </CardContent>
        </Card>
    );
}

function PaginatedTable({
    title,
    fetchFn,
    columns,
    renderRow,
    testIdPrefix,
}: {
    title: string;
    fetchFn: (pager: any) => Promise<any>;
    columns: string[];
    renderRow: (item: any, idx: number) => React.ReactNode;
    testIdPrefix: string;
}) {
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 20;
    const { toast } = useToast();

    const load = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const pager = { page: p, pageSize, orderby: null, shortDirection: null };
            const data = await fetchFn(pager);
            const rows = extractItems(data);
            setItems(rows);
            setTotalCount(extractTotal(data, rows.length));
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [fetchFn, toast]);

    useEffect(() => { load(page); }, [page, load]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

    return (
        <Card data-testid={`card-table-${testIdPrefix}`}>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base">{title}</CardTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{totalCount} record{totalCount !== 1 ? 's' : ''}</span>
                    <Button variant="ghost" size="icon" onClick={() => load(page)} disabled={loading} data-testid={`button-refresh-${testIdPrefix}`}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-auto max-h-[400px]">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {columns.map((col) => (
                                    <TableHead key={col} className="text-xs whitespace-nowrap">{col}</TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading && items.length === 0 ? (
                                <TableRow><TableCell colSpan={columns.length} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin mx-auto" /></TableCell></TableRow>
                            ) : items.length === 0 ? (
                                <TableRow><TableCell colSpan={columns.length} className="text-center py-8 text-muted-foreground">No records found</TableCell></TableRow>
                            ) : (
                                items.map((item, idx) => renderRow(item, idx))
                            )}
                        </TableBody>
                    </Table>
                </div>
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-2 border-t">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} data-testid={`button-prev-${testIdPrefix}`}>
                            <ChevronLeft className="h-4 w-4 mr-1" /> Prev
                        </Button>
                        <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} data-testid={`button-next-${testIdPrefix}`}>
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function BillingDashboard() {
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [posCount, setPosCount] = useState<any>(null);
    const [posDetails, setPosDetails] = useState<any>(null);
    const [alertCounts, setAlertCounts] = useState<any>(null);
    const [notificationCounts, setNotificationCounts] = useState<any>(null);
    const [paymentByType, setPaymentByType] = useState<any[]>([]);
    const [accountCount, setAccountCount] = useState<any>(null);

    const loadCounts = useCallback(async () => {
        setLoading(true);
        try {
            const [pc, pd, ac, nc, pbt, accC] = await Promise.allSettled([
                platinumGetPosCount(),
                platinumGetPosTabItemDetailsCount(),
                platinumGetAlertCounts(),
                platinumGetNotificationCounts(),
                platinumGetBillingPaymentByTypeOfUse(),
                platinumGetAccountCount(),
            ]);
            if (pc.status === 'fulfilled') setPosCount(pc.value);
            if (pd.status === 'fulfilled') setPosDetails(pd.value);
            if (ac.status === 'fulfilled') setAlertCounts(ac.value);
            if (nc.status === 'fulfilled') setNotificationCounts(nc.value);
            if (pbt.status === 'fulfilled') {
                const v = pbt.value;
                setPaymentByType(Array.isArray(v) ? v : extractItems(v));
            }
            if (accC.status === 'fulfilled') setAccountCount(accC.value);
        } catch (e: any) {
            toast({ title: 'Error', description: e.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { loadCounts(); }, [loadCounts]);

    const safeNum = (val: any): number | string => {
        if (val === null || val === undefined) return '—';
        if (typeof val === 'number') return val;
        if (Array.isArray(val)) {
            return val.reduce((sum: number, item: any) => sum + (Number(item.value) || 0), 0);
        }
        if (typeof val === 'object') {
            return val.count ?? val.value ?? val.total ?? '—';
        }
        return val;
    };

    const posDetailsObj = posDetails && typeof posDetails === 'object' && !Array.isArray(posDetails) ? posDetails : {};
    const posDetailKeys = Object.keys(posDetailsObj);

    const countCards: CountCard[] = [
        { label: 'POS Total', value: safeNum(posCount), icon: <Receipt className="h-5 w-5 text-white" />, color: 'bg-blue-600' },
        { label: 'Accounts', value: safeNum(accountCount), icon: <Users className="h-5 w-5 text-white" />, color: 'bg-green-600' },
        { label: 'Alerts', value: safeNum(alertCounts), icon: <AlertTriangle className="h-5 w-5 text-white" />, color: 'bg-orange-500' },
        { label: 'Notifications', value: safeNum(notificationCounts), icon: <Bell className="h-5 w-5 text-white" />, color: 'bg-purple-600' },
    ];

    return (
        <PosLayout>
            <div className="p-4 space-y-4" data-testid="page-billing-dashboard">
                <div className="flex items-center justify-between">
                    <h1 className="text-xl font-semibold">Billing Dashboard — POS Overview</h1>
                    <Button variant="outline" size="sm" onClick={loadCounts} disabled={loading} data-testid="button-refresh-dashboard">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Refresh
                    </Button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {countCards.map((c) => (
                        <DashboardCountCard key={c.label} card={c} />
                    ))}
                </div>

                {(Array.isArray(alertCounts) && alertCounts.length > 0) || (Array.isArray(notificationCounts) && notificationCounts.length > 0) ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Array.isArray(alertCounts) && alertCounts.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                        Alerts
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {alertCounts.filter((a: any) => Number(a.value) > 0).map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                                                <span className="text-sm capitalize" data-testid={`text-alert-${item.key}`}>{String(item.key || '').replace(/-/g, ' ')}</span>
                                                <Badge variant="destructive" data-testid={`badge-alert-${item.key}`}>{item.value}</Badge>
                                            </div>
                                        ))}
                                        {alertCounts.filter((a: any) => Number(a.value) > 0).length === 0 && (
                                            <p className="text-sm text-muted-foreground">No active alerts</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                        {Array.isArray(notificationCounts) && notificationCounts.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Bell className="h-4 w-4 text-purple-600" />
                                        Notifications
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {notificationCounts.filter((n: any) => Number(n.value) > 0).map((item: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                                                <span className="text-sm capitalize" data-testid={`text-notification-${item.key}`}>{String(item.key || '').replace(/-/g, ' ')}</span>
                                                <Badge variant="secondary" data-testid={`badge-notification-${item.key}`}>{Number(item.value).toLocaleString()}</Badge>
                                            </div>
                                        ))}
                                        {notificationCounts.filter((n: any) => Number(n.value) > 0).length === 0 && (
                                            <p className="text-sm text-muted-foreground">No notifications</p>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                ) : null}

                {posDetailKeys.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">POS Item Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {posDetailKeys.map((key) => (
                                    <div key={key} className="border rounded-lg p-3">
                                        <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, ' $1').replace(/count$/i, '').trim()}</p>
                                        <p className="text-lg font-semibold" data-testid={`text-pos-detail-${key}`}>{safeNum(posDetailsObj[key])}</p>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {paymentByType.length > 0 && (
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base">Payments by Type of Use</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="overflow-auto max-h-[300px]">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            {Object.keys(paymentByType[0] || {}).map((col) => (
                                                <TableHead key={col} className="text-xs whitespace-nowrap capitalize">{col.replace(/([A-Z])/g, ' $1').trim()}</TableHead>
                                            ))}
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {paymentByType.map((row, idx) => (
                                            <TableRow key={idx}>
                                                {Object.values(row).map((val: any, ci) => (
                                                    <TableCell key={ci} className="text-xs">
                                                        {typeof val === 'number' ? val.toLocaleString('en-ZA', val % 1 !== 0 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : {}) : String(val ?? '')}
                                                    </TableCell>
                                                ))}
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Tabs defaultValue="deposits" className="w-full">
                    <TabsList data-testid="tabs-dashboard-tables">
                        <TabsTrigger value="deposits" data-testid="tab-deposits">
                            <Banknote className="h-4 w-4 mr-1" /> Deposits
                        </TabsTrigger>
                        <TabsTrigger value="allocations" data-testid="tab-allocations">
                            <ArrowUpDown className="h-4 w-4 mr-1" /> Direct Deposit Allocations
                        </TabsTrigger>
                        <TabsTrigger value="thirdparty" data-testid="tab-thirdparty">
                            <CreditCard className="h-4 w-4 mr-1" /> Third-Party Pending
                        </TabsTrigger>
                        <TabsTrigger value="cheques" data-testid="tab-cheques">
                            <DollarSign className="h-4 w-4 mr-1" /> Post-Dated Cheques
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="deposits" className="mt-3">
                        <PaginatedTable
                            title="Deposit Records"
                            fetchFn={platinumGetDepositTableData}
                            testIdPrefix="deposits"
                            columns={['Account No', 'Name', 'Amount', 'Date', 'Reference', 'Status']}
                            renderRow={(item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="text-xs">{item.accountNumber ?? item.accountNo ?? item.account ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.name ?? item.accountName ?? item.accName ?? '—'}</TableCell>
                                    <TableCell className="text-xs font-medium">R {(item.amount ?? item.depositAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-xs">{item.date ?? item.depositDate ?? item.transactionDate ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.reference ?? item.ref ?? item.bankReference ?? '—'}</TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant={item.status === 'Allocated' ? 'default' : 'secondary'}>{item.status ?? item.allocationStatus ?? 'Pending'}</Badge>
                                    </TableCell>
                                </TableRow>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="allocations" className="mt-3">
                        <PaginatedTable
                            title="Direct Deposit Allocation Records"
                            fetchFn={platinumGetDirectDepositsAllocationTableData}
                            testIdPrefix="allocations"
                            columns={['Account No', 'Name', 'Amount', 'Bank', 'Date', 'Status']}
                            renderRow={(item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="text-xs">{item.accountNumber ?? item.accountNo ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.name ?? item.accountName ?? item.accName ?? '—'}</TableCell>
                                    <TableCell className="text-xs font-medium">R {(item.amount ?? item.allocationAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-xs">{item.bank ?? item.bankName ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.date ?? item.allocationDate ?? item.transactionDate ?? '—'}</TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant={item.status === 'Allocated' ? 'default' : 'secondary'}>{item.status ?? item.allocationStatus ?? 'Pending'}</Badge>
                                    </TableCell>
                                </TableRow>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="thirdparty" className="mt-3">
                        <PaginatedTable
                            title="Third-Party Payment Pending"
                            fetchFn={platinumGetThirdPartyPaymentPendingTableData}
                            testIdPrefix="thirdparty"
                            columns={['Account No', 'Name', 'Amount', 'Provider', 'Date', 'Status']}
                            renderRow={(item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="text-xs">{item.accountNumber ?? item.accountNo ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.name ?? item.accountName ?? item.accName ?? '—'}</TableCell>
                                    <TableCell className="text-xs font-medium">R {(item.amount ?? item.paymentAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-xs">{item.provider ?? item.thirdPartyName ?? item.paymentProvider ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.date ?? item.paymentDate ?? item.transactionDate ?? '—'}</TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant="outline">{item.status ?? 'Pending'}</Badge>
                                    </TableCell>
                                </TableRow>
                            )}
                        />
                    </TabsContent>

                    <TabsContent value="cheques" className="mt-3">
                        <PaginatedTable
                            title="Post-Dated Cheques"
                            fetchFn={platinumGetPostDatedChequeTableData}
                            testIdPrefix="cheques"
                            columns={['Account No', 'Name', 'Amount', 'Cheque No', 'Due Date', 'Status']}
                            renderRow={(item, idx) => (
                                <TableRow key={idx}>
                                    <TableCell className="text-xs">{item.accountNumber ?? item.accountNo ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.name ?? item.accountName ?? item.accName ?? '—'}</TableCell>
                                    <TableCell className="text-xs font-medium">R {(item.amount ?? item.chequeAmount ?? 0).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}</TableCell>
                                    <TableCell className="text-xs">{item.chequeNo ?? item.chequeNumber ?? '—'}</TableCell>
                                    <TableCell className="text-xs">{item.dueDate ?? item.chequeDate ?? item.date ?? '—'}</TableCell>
                                    <TableCell className="text-xs">
                                        <Badge variant={item.status === 'Cleared' ? 'default' : 'secondary'}>{item.status ?? 'Pending'}</Badge>
                                    </TableCell>
                                </TableRow>
                            )}
                        />
                    </TabsContent>
                </Tabs>
            </div>
        </PosLayout>
    );
}
