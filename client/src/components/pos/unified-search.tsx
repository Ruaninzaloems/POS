import React, { useState, useRef } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { ConsumerSearchForm } from './consumer-search-form';
import { UnifiedSearch as SearchComponent, SearchResult, parseMobileFromContactDetails } from './search-component';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Account } from '@/lib/mock-data';
import { fetchAccounts, fetchBillingStagePrepaidRecharge, fetchBillingStagePrepaidRecovery, searchInstitutions, fetchAccountsByGroup } from '@/lib/external-api';

export function UnifiedSearch() {
  const { addItem, clearTransaction, referenceData } = usePos();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [advancedResults, setAdvancedResults] = useState<any[]>([]);
  
  // Access configuration settings
  const config = referenceData.billingConfig;
  const allowNormalReceipting = config?.allowNormalReceipting !== false; // Default to true if not set
  const allowPrepaidAndRecovery = config?.allowPrepaidAndRecovery !== false;

  const handleSelect = async (result: SearchResult) => {
    // clearTransaction(); // Optional: reset before adding new
    
    // Check configuration constraints

    let newItem: TransactionItem;

    if (result.type === 'ACCOUNT') {
      const acc = result.data as Account;
      
      // Check for related prepaid info if it's a prepaid account
      if (acc.accountType === 'Prepaid' || acc.prepaidMeterNo) {
           if (allowPrepaidAndRecovery) {
               console.log("Checking for prepaid recovery/recharge info...");
               try {
                   // specific logic: check for recovery debt on this meter/account
                   const recovery = await fetchBillingStagePrepaidRecovery(acc.prepaidMeterNo || acc.accountNo, 'reference');
                   if (recovery) {
                       console.log("Found prepaid recovery:", recovery);
                       // In a real app, we might force this to be paid or show a modal
                   }
               } catch (err) {
                   console.error("Error checking prepaid recovery", err);
               }
           } else {
               console.log("Prepaid recovery check skipped (disabled by config)");
           }
      }

      newItem = {
        id: crypto.randomUUID(),
        type: 'CONSUMER_SERVICES',
        description: `${acc.name} (${acc.accountNo})`,
        reference: acc.accountNo,
        amountDue: acc.outstandingAmount,
        amountToPay: acc.outstandingAmount,
        originalData: acc
      };
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
        const acc = result.data as Account;
        newItem = {
            id: crypto.randomUUID(),
            type: 'PREPAID',
            description: `${acc.prepaidType || 'Prepaid'} Recharge ${acc.prepaidMeterNo}`,
            reference: acc.prepaidMeterNo!,
            amountDue: 0,
            amountToPay: 0, // Default to 0, user must enter
            originalData: acc
        }
    } else if (result.type === 'GROUP') {
        const group = result.data as any;
        
        if (group.members && Array.isArray(group.members) && group.members.length > 0) {
            group.members.forEach((member: any) => {
                const memberItem: TransactionItem = {
                    id: crypto.randomUUID(),
                    type: 'CONSUMER_SERVICES',
                    description: `${group.institutionDesc} - Acc ${member.accountNumber || member.accountID}`,
                    reference: member.accountNumber || `${member.accountID}`,
                    amountDue: member.outStandingAmt || 0,
                    amountToPay: member.outStandingAmt || 0,
                    originalData: { ...member, institutionDesc: group.institutionDesc }
                };
                addItem(memberItem);
            });
        } else if (group.isLocal && group.institutionID) {
            try {
                const accounts = await fetchAccountsByGroup(group.institutionID);
                if (accounts.length > 0) {
                    accounts.forEach((acc: any) => {
                        const memberItem: TransactionItem = {
                            id: crypto.randomUUID(),
                            type: 'CONSUMER_SERVICES',
                            description: `${group.institutionDesc || 'Group'} - ${acc.name || 'Unknown'} (${acc.accountNumber || acc.accountID})`,
                            reference: acc.accountNumber || acc.oldAccountCode || `${acc.accountID}`,
                            amountDue: acc.outStandingAmount || 0,
                            amountToPay: acc.outStandingAmount || 0,
                            originalData: { ...acc, institutionDesc: group.institutionDesc, accountID: acc.accountID }
                        };
                        addItem(memberItem);
                    });
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
        newItem = {
            id: crypto.randomUUID(),
            type: 'CLEARANCE',
            description: `Clearance ${clr.scheduleNo}`,
            reference: clr.scheduleNo,
            amountDue: clr.totalDue,
            amountToPay: clr.totalDue,
            originalData: clr
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

  const handlePickAdvancedResult = (acc: any) => {
      const mapped = mapApiResultToAccount(acc);
      handleSelect({ type: 'ACCOUNT', data: mapped, label: `${mapped.accountNo} - ${mapped.name}` });
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
                      <div className="bg-gradient-to-b from-gray-700 to-gray-800 text-white px-4 py-2 text-sm font-medium">
                          Search Results ({advancedResults.length})
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                          <table className="w-full text-sm" data-testid="table-advanced-results">
                              <thead className="bg-gray-100 sticky top-0">
                                  <tr>
                                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Account</th>
                                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Name</th>
                                      <th className="text-left px-3 py-2 font-medium text-xs text-gray-600">Address</th>
                                      <th className="text-right px-3 py-2 font-medium text-xs text-gray-600">Outstanding</th>
                                      <th className="text-center px-3 py-2 font-medium text-xs text-gray-600">Status</th>
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
      <div className="flex gap-2 w-full max-w-2xl">
          <SearchComponent onSelect={handleSelect} className="flex-1" institutions={referenceData.institutions} />
          <Button 
            variant="outline" 
            size="icon" 
            className="h-12 w-12 shrink-0 border-primary/20 bg-background"
            onClick={() => setShowAdvanced(true)}
            title="Advanced Search"
          >
            <Filter className="h-5 w-5 text-muted-foreground" />
          </Button>
      </div>
  );
}
