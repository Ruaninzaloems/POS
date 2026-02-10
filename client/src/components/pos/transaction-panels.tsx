import { AccountEnquiryView } from '@/components/pos/account-enquiry-view';

// ... (keep previous imports)

export function TransactionPanels() {
  const { activeTransactionType, transactionItems, removeItem, updateItemAmount, addItem } = usePos();
  // ... (keep logic)

  // Single Item Views
  return (
    <div className="flex-1 p-6 overflow-y-auto bg-gray-100/50"> {/* Updated background to match legacy look lightly */}
      <div className="max-w-[1200px] mx-auto space-y-6"> {/* Increased width for dense table */}
        
        {/* Header Badge */}
        {/* ... keep header ... */}

        {transactionItems.map((item) => (
           <TransactionItemCard key={item.id} item={item} />
        ))}
        
      </div>
    </div>
  );
}

function TransactionItemCard({ item }: { item: TransactionItem }) {
    // ... keep existing hooks
    
    // CONSUMER ACCOUNT CARD -> USE NEW VIEW
    if (item.type === 'CONSUMER_SERVICES') {
        return <AccountEnquiryView item={item} />;
    }
    
    // ... keep other card types (Prepaid, Clearance, etc) as they are distinct modules
    // ...

