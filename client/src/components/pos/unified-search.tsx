import React, { useState, useRef, useCallback } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { ConsumerSearchForm } from './consumer-search-form';
import { UnifiedSearch as SearchComponent, SearchResult, parseMobileFromContactDetails } from './search-component';
import { Filter, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Account, fetchAccounts, fetchBillingStagePrepaidRecharge, fetchBillingStagePrepaidRecovery, searchInstitutions, fetchAccountsByGroup, platinumGetAccountsForClearance, platinumGetClearanceData, enrichAccountData, platinumGetConsAccountDetails } from '@/lib/external-api';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function UnifiedSearch({ onSearchActiveChange }: { onSearchActiveChange?: (active: boolean) => void } = {}) {
  const { addItem, clearTransaction, referenceData, platinumUser, updateItemAmount, updateItemDetails } = usePos();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [advancedResults, setAdvancedResults] = useState<any[]>([]);
  const [inactiveConfirm, setInactiveConfirm] = useState<{ account: Account; item: TransactionItem } | null>(null);
  
  // Access configuration settings
  const config = referenceData.billingConfig;
  const allowNormalReceipting = config?.allowNormalReceipting !== false; // Default to true if not set
  const allowPrepaidAndRecovery = config?.allowPrepaidAndRecovery !== false;

  const handleSelect = async (result: SearchResult) => {
    // clearTransaction(); // Optional: reset before adding new
    
    // Check configuration constraints

    let newItem: TransactionItem;

    if (result.type === 'ACCOUNT') {
      let acc = result.data as Account;
      
      try {
          const enriched = await enrichAccountData(acc);
          acc = { ...acc, ...enriched };
      } catch (e) {
          console.warn('[Enrich] Failed to enrich account data on select:', e);
      }

      if (acc.accountType === 'Prepaid' || acc.prepaidMeterNo) {
           if (allowPrepaidAndRecovery) {
               console.log("Checking for prepaid recovery/recharge info...");
               try {
                   const recovery = await fetchBillingStagePrepaidRecovery(acc.prepaidMeterNo || acc.accountNo, 'reference');
                   if (recovery) {
                       console.log("Found prepaid recovery:", recovery);
                   }
               } catch (err) {
                   console.error("Error checking prepaid recovery", err);
               }
           } else {
               console.log("Prepaid recovery check skipped (disabled by config)");
           }
      }

      const consumerItem: TransactionItem = {
        id: crypto.randomUUID(),
        type: 'CONSUMER_SERVICES',
        description: `${acc.name} (${acc.accountNo})`,
        reference: acc.accountNo,
        amountDue: acc.outstandingAmount,
        amountToPay: acc.outstandingAmount > 0 ? acc.outstandingAmount : 0,
        originalData: acc
      };

      const accStatus = (acc.status || (acc as any).accountStatus || '').toLowerCase();
      if (accStatus === 'inactive') {
        setInactiveConfirm({ account: acc, item: consumerItem });
        return;
      }

      newItem = consumerItem;
    } else if (result.type === 'DIRECT') {
      const item = result.data;
      if (item.isGroup) {
        return;
      }
      newItem = {
        id: crypto.randomUUID(),
        type: 'DIRECT_INCOME',
        description: item.description || item.name,
        reference: item.scoaItem || item.name || '',
        amountDue: 0,
        amountToPay: 0,
        originalData: {
          ...item,
          scoaItemId: item.scoaItemId || item.id,
          groupId: item.groupId,
          groupName: item.groupName,
          scoaItem: item.scoaItem || item.name,
          vatRate: item.vatRate || 15,
        }
      };
    } else if (result.type === 'PREPAID') {
        let acc = result.data as Account;
        try {
            const enriched = await enrichAccountData(acc);
            acc = { ...acc, ...enriched };
        } catch (e) {
            console.warn('[Enrich] Failed to enrich prepaid account:', e);
        }
        newItem = {
            id: crypto.randomUUID(),
            type: 'PREPAID',
            description: `${acc.prepaidType || 'Prepaid'} Recharge ${acc.prepaidMeterNo}`,
            reference: acc.prepaidMeterNo!,
            amountDue: 0,
            amountToPay: 0,
            originalData: acc
        }
    } else if (result.type === 'GROUP') {
        const group = result.data as any;
        
        if (group.members && Array.isArray(group.members) && group.members.length > 0) {
            const memberItems: TransactionItem[] = group.members.map((member: any) => ({
                id: crypto.randomUUID(),
                type: 'CONSUMER_SERVICES' as const,
                description: `${group.institutionDesc} - ${member.name || [member.initials, member.lastName].filter(Boolean).join(' ') || 'Acc'} (${member.accountNumber || member.accountID})`,
                reference: member.accountNumber || `${member.accountID}`,
                amountDue: member.outStandingAmt || 0,
                amountToPay: member.outStandingAmt || 0,
                originalData: { ...member, institutionDesc: group.institutionDesc }
            }));
            memberItems.forEach(item => addItem(item));

            const needsEnrichment = memberItems.filter(item => !item.amountDue || item.amountDue === 0);
            if (needsEnrichment.length > 0) {
                Promise.allSettled(
                    needsEnrichment.map(async (item) => {
                        const accId = item.originalData?.accountID || item.originalData?.accountId || item.originalData?.account_ID;
                        if (!accId) return;
                        try {
                            const details = await platinumGetConsAccountDetails(Number(accId));
                            if (details && !details._error) {
                                const outstanding = details.outStandingAmt ?? details.outstandingAmount ?? details.outStandingAmount ?? 0;
                                if (outstanding > 0) {
                                    updateItemDetails(item.id, {
                                        amountDue: outstanding,
                                        amountToPay: outstanding,
                                        originalData: { ...item.originalData, outStandingAmt: outstanding, outstandingAmount: outstanding }
                                    });
                                }
                            }
                        } catch (e) {
                            console.warn(`[Group Enrich] Failed for account ${accId}:`, e);
                        }
                    })
                );
            }
        } else if (group.isLocal && group.institutionID) {
            try {
                const accounts = await fetchAccountsByGroup(group.institutionID);
                if (accounts.length > 0) {
                    const memberItems: TransactionItem[] = accounts.map((acc: any) => ({
                        id: crypto.randomUUID(),
                        type: 'CONSUMER_SERVICES' as const,
                        description: `${group.institutionDesc || 'Group'} - ${acc.name || 'Unknown'} (${acc.accountNumber || acc.accountID})`,
                        reference: acc.accountNumber || acc.oldAccountCode || `${acc.accountID}`,
                        amountDue: acc.outStandingAmount || acc.outStandingAmt || 0,
                        amountToPay: acc.outStandingAmount || acc.outStandingAmt || 0,
                        originalData: { ...acc, institutionDesc: group.institutionDesc, accountID: acc.accountID }
                    }));
                    memberItems.forEach(item => addItem(item));

                    const needsEnrichment = memberItems.filter(item => !item.amountDue || item.amountDue === 0);
                    if (needsEnrichment.length > 0) {
                        Promise.allSettled(
                            needsEnrichment.map(async (item) => {
                                const accId = item.originalData?.accountID || item.originalData?.accountId || item.originalData?.account_ID;
                                if (!accId) return;
                                try {
                                    const details = await platinumGetConsAccountDetails(Number(accId));
                                    if (details && !details._error) {
                                        const outstanding = details.outStandingAmt ?? details.outstandingAmount ?? details.outStandingAmount ?? 0;
                                        if (outstanding > 0) {
                                            updateItemDetails(item.id, {
                                                amountDue: outstanding,
                                                amountToPay: outstanding,
                                                originalData: { ...item.originalData, outStandingAmt: outstanding, outstandingAmount: outstanding }
                                            });
                                        }
                                    }
                                } catch (e) {
                                    console.warn(`[Group Enrich] Failed for account ${accId}:`, e);
                                }
                            })
                        );
                    }
                } else {
                    alert(`No linked accounts found for group "${group.institutionDesc}".`);
                    return;
                }
            } catch (e) {
                console.error("Failed to fetch group accounts", e);
                alert("Failed to load group accounts. Please try again.");
                return;
            }
        }
        
        return;
    } else if (result.type === 'CLEARANCE') {
        const clr = result.data;
        const clearanceId = clr.clearanceId || clr.scheduleNo;

        try {
            const [accountsResult, clearanceDataResult] = await Promise.all([
                platinumGetAccountsForClearance({
                    clearanceId: String(clearanceId),
                    userId: -1,
                }),
                platinumGetClearanceData({
                    clearanceId: String(clearanceId),
                }).catch(() => null),
            ]);

            const accounts = (accountsResult as any)?.items || accountsResult || [];
            const clearanceInfo = Array.isArray((clearanceDataResult as any)?.items)
                ? (clearanceDataResult as any).items[0]
                : (Array.isArray(clearanceDataResult) ? (clearanceDataResult as any)[0] : clearanceDataResult);

            const totalDue = Array.isArray(accounts)
                ? accounts.reduce((sum: number, acc: any) => sum + (acc.amount || acc.paymentAmount || 0), 0)
                : (clr.totalDue || 0);

            const ownerName = clearanceInfo?.name || '';
            const propertyAddress = clearanceInfo?.locationAddress || '';
            const sgNumber = clearanceInfo?.sgNumber || '';
            const status = clearanceInfo?.status || '';
            const expiryDate = clearanceInfo?.clearanceExpiryDateStr || clearanceInfo?.clearanceExpiryDate || '';
            const accountID = clearanceInfo?.accountID || '';
            const total1181 = clearanceInfo?.total1181 ?? null;
            const total1183 = clearanceInfo?.total1183 ?? null;
            const totalPaid = clearanceInfo?.paid ?? null;
            const totalRemaining = clearanceInfo?.remaining ?? null;
            const clearanceTotal = clearanceInfo?.total ?? null;

            newItem = {
                id: crypto.randomUUID(),
                type: 'CLEARANCE',
                description: `Clearance ${clearanceId} - ${ownerName || accountID}`,
                reference: String(clearanceId),
                amountDue: totalDue,
                amountToPay: totalDue,
                originalData: {
                    ...clr,
                    clearanceId: clearanceId,
                    clearanceStagingId: clearanceInfo?.clearanceStaging_ID || clearanceId,
                    scheduleNo: String(clearanceId),
                    totalDue,
                    ownerName,
                    propertyAddress,
                    sgNumber,
                    status,
                    expiryDate,
                    accountID,
                    total1181,
                    total1183,
                    totalPaid,
                    totalRemaining,
                    clearanceTotal,
                    clearanceInfo,
                    paidItems: Array.isArray(accounts) ? accounts.map((acc: any) => ({
                        account_ID: acc.account_ID ?? acc.accountID ?? acc.accountId ?? null,
                        accountNumber: acc.accountNumber || acc.accountNo || '',
                        name: acc.name || '',
                        debT_TYPE: acc.debT_TYPE || acc.debtType || '',
                        amount: acc.amount || 0,
                        paymentAmount: acc.paymentAmount || acc.amount || 0,
                    })) : [],
                }
            };
        } catch (e) {
            console.error("Failed to load clearance accounts", e);
            newItem = {
                id: crypto.randomUUID(),
                type: 'CLEARANCE',
                description: `Clearance ${clearanceId}`,
                reference: String(clearanceId),
                amountDue: clr.totalDue || 0,
                amountToPay: clr.totalDue || 0,
                originalData: { ...clr, clearanceId, scheduleNo: String(clearanceId), paidItems: [] }
            };
        }
    } else {
        return;
    }

    addItem(newItem!);
  };

  const mapApiResultToAccount = (acc: any): Account => {
      const emailMatch = acc.contactDetails?.match(/Email\s*:<\/b>\s*([^<\s]+)/i);
      return {
          accountNo: acc.accountNumber || acc.oldAccountCode || `${acc.accountID}`,
          name: acc.name || 'Unknown',
          idNo: '-',
          outstandingAmount: acc.outStandingAmount || 0,
          address: acc.address || acc.locationAddress || '',
          sgNo: acc.sgNumber || '',
          email: emailMatch ? emailMatch[1] : '',
          mobile: parseMobileFromContactDetails(acc.contactDetails),
          accountType: acc.accountType || 'Consumer',
          status: acc.accountStatus || 'Active',
          oldCode: acc.oldAccountCode || '',
          prepaidMeterNo: '',
          unitId: acc.unitID?.toString(),
          apiId: acc.accountID,
          deliveryAddress: acc.address || '',
          locationAddress: acc.locationAddress || '',
          propertyId: acc.propertyID || '',
          addName: acc.addName || '',
          contactDetails: acc.contactDetails || '',
          unitPartitionId: acc.unitPartitionID,
      };
  };

  const handleAdvancedSearch = async (criteria: any) => {
      setIsSearching(true);
      setAdvancedResults([]);
      try {
        const apiResults = await fetchAccounts(criteria);
        
        if (apiResults && apiResults.length > 0) {
            if (apiResults.length === 1) {
                const mapped = mapApiResultToAccount(apiResults[0]);
                handleSelect({ type: 'ACCOUNT', data: mapped, label: `${mapped.accountNo} - ${mapped.name}` });
                setShowAdvanced(false);
                setAdvancedResults([]);
                return;
            }
            setAdvancedResults(apiResults);
            return;
        }

        alert("No accounts found matching your search criteria.");
      } catch (error) {
          console.error("Search failed", error);
          alert("Search failed. Please try again.");
      } finally {
          setIsSearching(false);
      }
  };

  const handlePickAdvancedResult = async (acc: any) => {
      const mapped = mapApiResultToAccount(acc);
      await handleSelect({ type: 'ACCOUNT', data: mapped, label: `${mapped.accountNo} - ${mapped.name}` });
      setShowAdvanced(false);
      setAdvancedResults([]);
  };

  if (showAdvanced) {
      return (
          <div className="w-full max-w-4xl mx-auto space-y-3">
              <ConsumerSearchForm 
                  onSearch={handleAdvancedSearch} 
                  onCancel={() => { setShowAdvanced(false); setAdvancedResults([]); }} 
                  isLoading={isSearching}
              />
              {advancedResults.length > 0 && (
                  <div className="bg-white rounded-lg border shadow-sm overflow-hidden">
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 text-sm font-medium">
                          Search Results ({advancedResults.length})
                      </div>
                      <div className="max-h-80 overflow-y-auto overflow-x-auto">
                          <table className="w-full text-sm min-w-[540px]" data-testid="table-advanced-results">
                              <thead className="bg-gradient-to-r from-blue-600 to-indigo-600 sticky top-0">
                                  <tr>
                                      <th className="text-left px-3 py-2 font-medium text-xs text-white">Account</th>
                                      <th className="text-left px-3 py-2 font-medium text-xs text-white">Name</th>
                                      <th className="text-left px-3 py-2 font-medium text-xs text-white">Address</th>
                                      <th className="text-right px-3 py-2 font-medium text-xs text-white">Outstanding</th>
                                      <th className="text-center px-3 py-2 font-medium text-xs text-white">Status</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {advancedResults.map((acc: any, idx: number) => (
                                      <tr 
                                          key={acc.accountID || idx} 
                                          className="border-t hover:bg-blue-50 cursor-pointer transition-colors"
                                          onClick={() => handlePickAdvancedResult(acc)}
                                          data-testid={`row-result-${acc.accountID || idx}`}
                                      >
                                          <td className="px-3 py-2 font-mono text-xs">{acc.accountNumber || acc.oldAccountCode || acc.accountID}</td>
                                          <td className="px-3 py-2">{acc.name || 'Unknown'}</td>
                                          <td className="px-3 py-2 text-xs text-gray-500 max-w-[200px] truncate">{acc.address || acc.locationAddress || '-'}</td>
                                          <td className="px-3 py-2 text-right font-mono">R {(acc.outStandingAmount || 0).toFixed(2)}</td>
                                          <td className="px-3 py-2 text-center">
                                              <span className={`text-xs px-2 py-0.5 rounded-full ${acc.accountStatus === 'Active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                  {acc.accountStatus || 'Active'}
                                              </span>
                                          </td>
                                      </tr>
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              )}
          </div>
      )
  }

  return (
      <>
      <div className="flex gap-2 w-full max-w-2xl lg:max-w-4xl">
          <SearchComponent onSelect={handleSelect} className="flex-1" institutions={referenceData.institutions} userId={platinumUser?.user_ID} finYear={platinumUser?.finYear} onSearchActiveChange={onSearchActiveChange} />
          <Button 
            variant="outline" 
            size="icon" 
            className="h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-xl border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-300 transition-all"
            onClick={() => setShowAdvanced(true)}
            title="Advanced Search"
          >
            <Filter className="h-5 w-5 text-blue-500" />
          </Button>
      </div>
      <AlertDialog open={!!inactiveConfirm} onOpenChange={(open) => { if (!open) setInactiveConfirm(null); }}>
        <AlertDialogContent className="max-w-[95vw] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Inactive Account
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left space-y-2">
                <span className="block">Account <strong>{inactiveConfirm?.account.accountNo}</strong> ({inactiveConfirm?.account.name}) is currently <strong>Inactive</strong>.</span>
                <span className="block">Do you want to continue with this transaction?</span>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setInactiveConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700"
              onClick={() => {
                if (inactiveConfirm) {
                  addItem(inactiveConfirm.item);
                  setInactiveConfirm(null);
                }
              }}
            >
              Yes, Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
  );
}
