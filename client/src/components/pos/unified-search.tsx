import React, { useState, useRef } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { ConsumerSearchForm } from './consumer-search-form';
import { UnifiedSearch as SearchComponent, SearchResult } from './search-component';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ACCOUNTS, Account } from '@/lib/mock-data';

export function UnifiedSearch() {
  const { addItem, clearTransaction } = usePos();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSelect = (result: SearchResult) => {
    // clearTransaction(); // Optional: reset before adding new
    
    let newItem: TransactionItem;

    if (result.type === 'ACCOUNT') {
      const acc = result.data as Account;
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

  const handleAdvancedSearch = (criteria: any) => {
      // Mock search logic for prototype
      // In a real app, this would call an API with the specific criteria
      console.log("Searching with criteria:", criteria);
      
      // For demo, just find first account matching any field
      const found = ACCOUNTS.find(a => 
          (criteria.accountNo && a.accountNo.includes(criteria.accountNo)) ||
          (criteria.name && a.name.toLowerCase().includes(criteria.name.toLowerCase())) ||
          (criteria.idNo && a.idNo.includes(criteria.idNo))
      );

      if (found) {
          handleSelect({ type: 'ACCOUNT', data: found, label: `${found.accountNo} - ${found.name}` });
          setShowAdvanced(false);
      } else {
          // Maybe show a toast or error? For now just log
          alert("No accounts found matching criteria (Mock Data Limited)");
      }
  };

  if (showAdvanced) {
      return (
          <div className="w-full max-w-4xl mx-auto">
              <ConsumerSearchForm 
                  onSearch={handleAdvancedSearch} 
                  onCancel={() => setShowAdvanced(false)} 
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
