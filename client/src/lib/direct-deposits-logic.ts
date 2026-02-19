import { BankTransaction } from './external-api';

/**
 * Filters unmatched transactions based on a search term
 */
export function filterUnmatchedTransactions(
  transactions: BankTransaction[],
  searchTerm: string
): BankTransaction[] {
  const term = searchTerm.toLowerCase();
  
  return transactions.filter(t => 
    t.status === 'UNMATCHED' && 
    (t.description.toLowerCase().includes(term) ||
     t.reference.toLowerCase().includes(term) ||
     t.amount.toString().includes(searchTerm))
  );
}
