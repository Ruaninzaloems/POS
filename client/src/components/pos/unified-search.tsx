import React, { useState, useRef } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { ConsumerSearchForm } from './consumer-search-form';
import { UnifiedSearch as SearchComponent, SearchResult } from './search-component';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCOUNTS, Account } from '@/lib/mock-data';
import { fetchAccounts, fetchBillingStagePrepaidRecharge, fetchBillingStagePrepaidRecovery } from '@/lib/external-api';

export function UnifiedSearch() {
  const { addItem, clearTransaction, referenceData } = usePos();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // Access configuration settings
  const config = referenceData.billingConfig;
  const allowNormalReceipting = config?.allowNormalReceipting !== false; // Default to true if not set
  const allowPrepaidAndRecovery = config?.allowPrepaidAndRecovery !== false;

  const handleSelect = async (result: SearchResult) => {
    // clearTransaction(); // Optional: reset before adding new
    
    // Check configuration constraints
    if (result.type === 'ACCOUNT' && !allowNormalReceipting) {
        alert("Normal receipting is currently disabled by system configuration.");
        return;
    }

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
      newItem = {
        id: crypto.randomUUID(),
        type: 'DIRECT_INCOME',
        description: item.description,
        reference: item.scoaItem,
        amountDue: item.price || 0,
        amountToPay: item.price || 0,
        originalData: item
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
        const group = result.data as any; // Cast to avoid TS issues with mock data imports not updating fast enough
        // Find all members
        const members = ACCOUNTS.filter(a => group.memberAccountNos.includes(a.accountNo));
        
        // Add all members as individual transaction items
        members.forEach(member => {
            const memberItem: TransactionItem = {
                id: crypto.randomUUID(),
                type: 'CONSUMER_SERVICES',
                description: `${member.name} (${member.accountNo})`,
                reference: member.accountNo,
                amountDue: member.outstandingAmount,
                amountToPay: member.outstandingAmount,
                originalData: member
            };
            addItem(memberItem);
        });
        
        return; // Exit early as we added multiple
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

  const handleAdvancedSearch = async (criteria: any) => {
      setIsSearching(true);
      try {
        const apiResults = await fetchAccounts(criteria);
        
        if (apiResults && apiResults.length > 0) {
            const acc = apiResults[0];
            const mappedAccount: Account = {
                accountNo: acc.accountNumber || acc.oldAccountCode || `ID-${acc.id}`,
                name: acc.name || 'Unknown',
                idNo: acc.idNumber || '-',
                outstandingAmount: acc.outStandingAmt || 0,
                address: acc.deliveryAddress || [acc.streetName, acc.town].filter(Boolean).join(', ') || '',
                sgNo: acc.sgNumber || '',
                email: '',
                mobile: '',
                accountType: acc.accountDesc || 'Consumer',
                status: acc.statusDesc || 'Active',
                oldCode: acc.oldAccountCode || '',
                prepaidMeterNo: acc.physicalMeterNumber || '',
            };
            
            handleSelect({ type: 'ACCOUNT', data: mappedAccount, label: `${mappedAccount.accountNo} - ${mappedAccount.name}` });
            setShowAdvanced(false);
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

  if (showAdvanced) {
      return (
          <div className="w-full max-w-4xl mx-auto">
              <ConsumerSearchForm 
                  onSearch={handleAdvancedSearch} 
                  onCancel={() => setShowAdvanced(false)} 
                  isLoading={isSearching}
              />
          </div>
      )
  }

  return (
      <div className="flex gap-2 w-full max-w-2xl">
          <SearchComponent onSelect={handleSelect} className="flex-1" />
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
