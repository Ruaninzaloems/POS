import React, { useState, useMemo } from 'react';
import { usePos, TransactionItem } from '@/lib/pos-state';
import { Account } from '@/lib/external-api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRight, CreditCard, Banknote, Trash2, History, Lock, AlertTriangle, ChevronUp, ShieldAlert, X, Delete, Coins, CheckCircle2, Minus, Plus, User, MapPin, FileCheck, Zap, Droplets, ChevronDown, Package, Hash, Building2, Receipt } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DayEndModal } from './day-end-modal';
import { TransactionHistoryModal } from './transaction-history-modal';
import { HelpTip } from '@/components/ui/help-tip';
import { getCategoryIcon } from '@/lib/category-icons';

export function PaymentDrawer() {
  const { 
    payment, 
    setPaymentAmount, 
    setCardReference,
    setCardExpiry,
    completeTransaction, 
    transactionItems, 
    removeItem,
    updateItemAmount,
    updateItemDetails,
    dayEndStatus,
    viewMode,
    isPaymentTypeAllowed
  } = usePos();

  const cashAllowed = isPaymentTypeAllowed(1);
  const cardAllowed = isPaymentTypeAllowed(3);
  const defaultInput = cashAllowed ? 'cash' : cardAllowed ? 'card' : 'cash';
  const [activeInput, setActiveInput] = useState<'cash' | 'card'>(defaultInput);
  const [inputBuffer, setInputBuffer] = useState<string>("");
  const [showDayEnd, setShowDayEnd] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isMobileExpanded, setIsMobileExpanded] = useState(false);
  const [mobileView, setMobileView] = useState<'payment' | 'items'>('payment');

  React.useEffect(() => {
      if (!cashAllowed && activeInput === 'cash' && cardAllowed) setActiveInput('card');
      if (!cardAllowed && activeInput === 'card' && cashAllowed) setActiveInput('cash');
  }, [cashAllowed, cardAllowed]);

  React.useEffect(() => {
      if (!cashAllowed && payment.cashAmount > 0) setPaymentAmount('cash', 0);
      if (!cardAllowed && payment.cardAmount > 0) setPaymentAmount('card', 0);
  }, [cashAllowed, cardAllowed]);

  React.useEffect(() => {
      const val = activeInput === 'cash' ? payment.cashAmount : payment.cardAmount;
      if (val === 0 && inputBuffer === "") return;
      if (parseFloat(inputBuffer) !== val) {
          setInputBuffer(val === 0 ? "" : val.toString());
      }
  }, [activeInput, payment.cashAmount, payment.cardAmount]);

  const totalDue = useMemo(() => transactionItems.reduce((acc, i) => acc + i.amountToPay, 0), [transactionItems]);

  const cardExpiryValid = (() => {
    if (!payment.cardExpiry) return false;
    const match = payment.cardExpiry.trim().match(/^(\d{2})\/(\d{2})$/);
    if (!match) return false;
    const month = parseInt(match[1], 10);
    if (month < 1 || month > 12) return false;
    const year = parseInt(match[2], 10) + 2000;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    if (year < currentYear || (year === currentYear && month < currentMonth)) return false;
    return true;
  })();

  const cardFieldsValid = payment.cardAmount > 0
    ? (!!payment.cardReference && payment.cardReference.trim().length >= 4) && cardExpiryValid
    : true;

  const isCompleteEnabled = 
    transactionItems.length > 0 && 
    payment.tenderTotal >= totalDue &&
    totalDue > 0 &&
    dayEndStatus === 'OPEN' &&
    cardFieldsValid &&
    transactionItems.every(item => {
        if (item.type === 'DIRECT_INCOME') {
            return (!!item.paidBy && item.paidBy.trim().length > 0) && 
                   (!!item.notes && item.notes.trim().length > 0);
        }
        return true;
    }) &&
    payment.changeDue <= 200;

  const handleNumpadInput = (val: string) => {
      let newStr = inputBuffer;
      if (val === '.') {
          if (newStr.includes('.')) return;
          newStr = newStr === "" ? "0." : newStr + ".";
      } else {
          newStr = newStr === "0" ? val : newStr + val;
      }
      setInputBuffer(newStr);
      setPaymentAmount(activeInput, parseFloat(newStr) || 0);
  };

  const handleBackspace = () => {
      const newStr = inputBuffer.slice(0, -1);
      setInputBuffer(newStr);
      setPaymentAmount(activeInput, newStr === '' ? 0 : parseFloat(newStr) || 0);
  };

  const handlePayExact = () => {
      if (activeInput === 'cash') {
          const remaining = Math.max(0, totalDue - payment.cardAmount);
          setPaymentAmount('cash', remaining);
          setInputBuffer(remaining > 0 ? remaining.toString() : "");
      } else {
          const remaining = Math.max(0, totalDue - payment.cashAmount);
          setPaymentAmount('card', remaining);
          setInputBuffer(remaining > 0 ? remaining.toString() : "");
      }
  };

  const handleClearAmount = () => {
      setPaymentAmount(activeInput, 0);
      setInputBuffer("");
  };

  const handleDesktopInput = (type: 'cash' | 'card', val: string) => {
      setInputBuffer(val);
      setPaymentAmount(type, parseFloat(val) || 0);
  };

  const numKeys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'DEL'];

  const hasMissingDirectIncomeFields = transactionItems.some(item => 
      item.type === 'DIRECT_INCOME' && (!item.paidBy || item.paidBy.trim().length === 0 || !item.notes || item.notes.trim().length === 0)
  );

  const shortfall = Math.max(0, totalDue - payment.tenderTotal);

  return (
    <>
    {/* Mobile Bottom Bar (collapsed state) */}
    <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''} fixed bottom-0 left-0 right-0 z-40 bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 text-white shadow-[0_-4px_20px_rgba(0,0,0,0.15)] transition-transform duration-300 ${isMobileExpanded ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="px-3 py-2.5 flex items-center justify-between gap-2" onClick={() => setIsMobileExpanded(true)}>
             <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 shrink-0">
                  <Banknote className="w-4.5 h-4.5 text-white/80" />
                </div>
                <div className="min-w-0">
                  <div className="text-[9px] text-white/50 uppercase font-bold tracking-wider">Total Due</div>
                  <div className="text-lg font-mono font-bold text-white leading-tight">R {totalDue.toFixed(2)}</div>
                </div>
             </div>
             <div className="flex items-center gap-2">
                {transactionItems.length > 0 && (
                  <span className="bg-white/15 text-white/90 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {transactionItems.length}
                  </span>
                )}
                <Button size="default" className="bg-white text-blue-900 hover:bg-white/90 shadow-lg font-bold rounded-xl h-9 px-4 text-sm active:scale-95 transition-transform touch-manipulation" onClick={(e) => { e.stopPropagation(); setIsMobileExpanded(true); }}>
                    Pay <ChevronUp className="ml-1 w-3.5 h-3.5" />
                </Button>
             </div>
        </div>
    </div>

    {/* Main Drawer */}
    <aside className={`
        fixed inset-x-0 bottom-0 z-50 bg-white border-l border-slate-200/80 shadow-2xl transition-all duration-300 ease-out flex flex-col
        ${viewMode === 'desktop' ? 'lg:static lg:w-[420px] xl:w-[450px] lg:h-full lg:border-l lg:border-t-0 lg:shadow-none' : ''}
        ${isMobileExpanded ? 'h-[92vh] rounded-t-2xl' : `h-0 ${viewMode === 'desktop' ? 'lg:h-full' : ''} overflow-hidden`}
    `}>
      {/* Mobile Header */}
      <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''} shrink-0`}>
        <div className="w-full flex justify-center pt-2 pb-1 cursor-pointer" onClick={() => setIsMobileExpanded(false)}>
            <div className="w-10 h-1 bg-slate-300 rounded-full" />
        </div>
        <div className="px-3 pb-2 flex justify-between items-center">
          <div className="flex items-center gap-1.5">
            <div className="flex bg-slate-100 rounded-lg p-0.5">
              <button
                onClick={() => setMobileView('payment')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mobileView === 'payment' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                data-testid="tab-mobile-payment"
              >
                Payment
              </button>
              <button
                onClick={() => setMobileView('items')}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all relative ${mobileView === 'items' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500'}`}
                data-testid="tab-mobile-items"
              >
                Items
                {transactionItems.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center">{transactionItems.length}</span>
                )}
              </button>
            </div>
            {dayEndStatus === 'RECONCILED' && (
              <span className="text-[9px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-bold">
                <Lock className="w-2.5 h-2.5" /> Closed
              </span>
            )}
          </div>
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setShowHistory(true)}>
              <History className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400" onClick={() => setShowDayEnd(true)}>
              <Lock className="w-3.5 h-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500" onClick={() => setIsMobileExpanded(false)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop Header */}
      <div className={`${viewMode === 'desktop' ? 'hidden lg:flex' : 'hidden'} p-4 lg:p-5 bg-gradient-to-br from-blue-50 to-indigo-50/50 border-b border-blue-100/50 justify-between items-center shrink-0`}>
        <div>
           <h2 className="text-lg lg:text-xl font-bold tracking-tight text-slate-800 flex items-center gap-1.5">Payment Drawer <HelpTip text="Enter cash and/or card amounts to pay for items in your basket. The system calculates change automatically." /></h2>
           <p className="text-sm text-muted-foreground">Touch-enabled checkout</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setShowHistory(true)} title="Transaction History">
                <History className="w-5 h-5 text-muted-foreground" />
            </Button>
            <Button 
                variant={dayEndStatus === 'RECONCILED' ? 'destructive' : 'outline'} 
                size="icon" 
                onClick={() => setShowDayEnd(true)} 
                title="Day End Reconciliation"
                className={dayEndStatus === 'RECONCILED' ? 'opacity-50' : ''}
            >
                <Lock className="w-5 h-5 text-muted-foreground" />
            </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        
        {/* === DESKTOP: Tabbed Layout === */}
        <div className={`${viewMode === 'desktop' ? 'hidden lg:block' : 'hidden'} h-full`}>
          <DesktopPaymentContent
            transactionItems={transactionItems}
            removeItem={removeItem}
            updateItemAmount={updateItemAmount}
            updateItemDetails={updateItemDetails}
            totalDue={totalDue}
            dayEndStatus={dayEndStatus}
            cashAllowed={cashAllowed}
            cardAllowed={cardAllowed}
            activeInput={activeInput}
            setActiveInput={setActiveInput}
            inputBuffer={inputBuffer}
            payment={payment}
            setPaymentAmount={setPaymentAmount}
            setCardReference={setCardReference}
            setCardExpiry={setCardExpiry}
            handleNumpadInput={handleNumpadInput}
            handleBackspace={handleBackspace}
            handlePayExact={handlePayExact}
            handleClearAmount={handleClearAmount}
            cardExpiryValid={cardExpiryValid}
            handleDesktopInput={handleDesktopInput}
          />
        </div>

        {/* === MOBILE: Direct layout (no nested tabs) === */}
        <div className={`${viewMode === 'desktop' ? 'lg:hidden' : ''}`}>
          {mobileView === 'items' ? (
            <MobileItemsList items={transactionItems} removeItem={removeItem} updateItemAmount={updateItemAmount} updateItemDetails={updateItemDetails} totalDue={totalDue} />
          ) : (
            <MobilePaymentView
              totalDue={totalDue}
              dayEndStatus={dayEndStatus}
              cashAllowed={cashAllowed}
              cardAllowed={cardAllowed}
              activeInput={activeInput}
              setActiveInput={setActiveInput}
              inputBuffer={inputBuffer}
              payment={payment}
              setPaymentAmount={setPaymentAmount}
              setCardReference={setCardReference}
              setCardExpiry={setCardExpiry}
              handleNumpadInput={handleNumpadInput}
              handleBackspace={handleBackspace}
              handlePayExact={handlePayExact}
              handleClearAmount={handleClearAmount}
              numKeys={numKeys}
              cardExpiryValid={cardExpiryValid}
            />
          )}
        </div>
      </div>

      {/* Footer - Always visible complete button */}
      <div className="px-3 py-2.5 lg:p-5 bg-white border-t border-slate-200/80 space-y-1.5 lg:space-y-3 shadow-[0_-4px_10px_rgba(0,0,0,0.03)] z-30 relative shrink-0">
        {/* Change + Tender summary */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[9px] lg:text-[10px] text-slate-400 uppercase font-semibold tracking-wider">Tendered</div>
              <div className="text-sm lg:text-base font-mono font-bold text-slate-700">R {payment.tenderTotal.toFixed(2)}</div>
            </div>
            {shortfall > 0 && (
              <div className="text-center">
                <div className="text-[9px] lg:text-[10px] text-amber-500 uppercase font-semibold tracking-wider">Short</div>
                <div className="text-sm lg:text-base font-mono font-bold text-amber-600">R {shortfall.toFixed(2)}</div>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-[9px] lg:text-[10px] text-slate-400 uppercase font-semibold tracking-wider flex items-center gap-1 justify-end">
              Change
              <HelpTip text="Change is calculated only on the cash portion. Maximum change allowed is R200.00." />
            </div>
            <div className="flex items-center gap-1.5 justify-end">
              {payment.changeDue > 200 && (
                <span className="text-[9px] text-destructive font-medium flex items-center gap-0.5">
                  <AlertTriangle className="w-3 h-3" />
                  Max R200
                </span>
              )}
              <span className={`font-mono text-lg lg:text-2xl font-bold ${payment.changeDue > 200 ? 'text-destructive' : payment.changeDue > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                R {payment.changeDue.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {hasMissingDirectIncomeFields && transactionItems.length > 0 && (
            <div className="flex items-center gap-2 text-[10px] lg:text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Fill in <strong>Notes</strong> and <strong>Paid By</strong> for Direct Income items</span>
            </div>
        )}

        <Button 
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-500/25 h-12 lg:h-14 text-base lg:text-lg font-bold rounded-xl disabled:from-slate-300 disabled:to-slate-400 disabled:shadow-none active:scale-[0.98] transition-all touch-manipulation" 
          size="lg"
          tabIndex={9}
          disabled={!isCompleteEnabled}
          onClick={completeTransaction}
          data-testid="button-complete-transaction"
        >
          {shortfall > 0 ? (
            <>R {shortfall.toFixed(2)} still needed</>
          ) : payment.cardAmount > 0 && (!payment.cardReference || payment.cardReference.trim().length < 4) ? (
            <>Enter card number</>
          ) : payment.cardAmount > 0 && !cardExpiryValid ? (
            <>{!payment.cardExpiry ? 'Enter card expiry' : 'Invalid expiry (MM/YY)'}</>
          ) : (
            <>
              COMPLETE (R {payment.tenderTotal.toFixed(2)})
              <ArrowRight className="ml-2 w-5 h-5" />
            </>
          )}
        </Button>
      </div>
    </aside>

    {/* Backdrop for mobile */}
    {isMobileExpanded && (
        <div 
            className={`fixed inset-0 bg-black/50 z-40 ${viewMode === 'desktop' ? 'lg:hidden' : ''} backdrop-blur-sm`}
            onClick={() => setIsMobileExpanded(false)}
        />
    )}

    <DayEndModal isOpen={showDayEnd} onClose={() => setShowDayEnd(false)} />
    <TransactionHistoryModal isOpen={showHistory} onClose={() => setShowHistory(false)} />
    </>
  );
}

function getItemSummaryLine(item: TransactionItem, od: any): { label: string; value: string; highlight?: string }[] {
  const info: { label: string; value: string; highlight?: string }[] = [];
  
  if (item.type === 'CONSUMER_SERVICES' || item.type === 'ACCOUNT_GROUP') {
    const accNo = od.accountNumber || od.accountNo || od.accountID;
    if (accNo) info.push({ label: 'Acc', value: String(accNo), highlight: 'text-blue-600 font-mono' });
    if (od.name) info.push({ label: 'Owner', value: od.name.length > 25 ? od.name.substring(0, 25) + '...' : od.name });
    const outstanding = od.outStandingAmount ?? od.outstandingAmt ?? od.outStandingAmt;
    if (outstanding != null && Number(outstanding) > 0) {
      info.push({ label: 'Owing', value: `R ${Number(outstanding).toFixed(2)}`, highlight: 'text-red-600 font-mono' });
    }
    if (od.address) info.push({ label: 'Addr', value: od.address.length > 30 ? od.address.substring(0, 30) + '...' : od.address });
  } else if (item.type === 'PREPAID') {
    const isWater = od.prepaidType === 'Water';
    if (od.prepaidMeterNo) info.push({ label: 'Meter', value: od.prepaidMeterNo, highlight: isWater ? 'text-blue-600 font-mono' : 'text-amber-600 font-mono' });
    info.push({ label: 'Type', value: isWater ? 'Water' : 'Electricity', highlight: isWater ? 'text-blue-600' : 'text-amber-600' });
    if (od.name) info.push({ label: 'Owner', value: od.name.length > 20 ? od.name.substring(0, 20) + '...' : od.name });
    if (od.accountNo || od.accountNumber) info.push({ label: 'Acc', value: od.accountNo || od.accountNumber });
  } else if (item.type === 'CLEARANCE') {
    if (od.scheduleNo) info.push({ label: 'Schedule', value: od.scheduleNo, highlight: 'text-amber-700 font-mono' });
    if (od.ownerName) info.push({ label: 'Owner', value: od.ownerName.length > 20 ? od.ownerName.substring(0, 20) + '...' : od.ownerName });
    if (od.sgNumber) info.push({ label: 'SG', value: od.sgNumber });
    if (od.propertyAddress) info.push({ label: 'Property', value: od.propertyAddress.length > 25 ? od.propertyAddress.substring(0, 25) + '...' : od.propertyAddress });
  } else if (item.type === 'DIRECT_INCOME') {
    if (od.groupName) info.push({ label: 'Category', value: od.groupName, highlight: 'text-green-700' });
    if (od.scoaItem) info.push({ label: 'SCOA', value: od.scoaItem.length > 25 ? od.scoaItem.substring(0, 25) + '...' : od.scoaItem });
    if (item.paidBy) info.push({ label: 'Paid By', value: item.paidBy });
  }
  
  return info;
}

function getTypeBadge(type: string, originalData?: any) {
  switch (type) {
    case 'CONSUMER_SERVICES':
      return { label: 'Account', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: User };
    case 'PREPAID': {
      const isWater = originalData?.prepaidType === 'Water';
      return { label: isWater ? 'Prepaid Water' : 'Prepaid Elec', color: isWater ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200', icon: isWater ? Droplets : Zap };
    }
    case 'CLEARANCE':
      return { label: 'Clearance', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: FileCheck };
    case 'DIRECT_INCOME':
      return { label: 'Direct Income', color: 'bg-green-50 text-green-700 border-green-200', icon: Receipt };
    case 'ACCOUNT_GROUP':
      return { label: 'Group', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: Building2 };
    default:
      return { label: type, color: 'bg-slate-50 text-slate-700 border-slate-200', icon: Package };
  }
}

function MobileItemCard({ item, removeItem, updateItemAmount, updateItemDetails }: {
  item: TransactionItem;
  removeItem: (id: string) => void;
  updateItemAmount: (id: string, amount: number) => void;
  updateItemDetails: (id: string, details: Partial<TransactionItem>) => void;
}) {
  const hasRequiredFieldsMissing = item.type === 'DIRECT_INCOME' && (!item.paidBy?.trim() || !item.notes?.trim());
  const [expanded, setExpanded] = useState(hasRequiredFieldsMissing);
  const badge = getTypeBadge(item.type, item.originalData);
  const BadgeIcon = badge.icon;
  const od = item.originalData || {};

  const hasRequiredFields = item.type === 'DIRECT_INCOME';
  const missingRequired = hasRequiredFields && (!item.paidBy?.trim() || !item.notes?.trim());

  let categoryIcon = null;
  if (item.type === 'DIRECT_INCOME') {
    const ci = getCategoryIcon(item.description);
    const CatIcon = ci.icon;
    categoryIcon = <CatIcon className="w-5 h-5" style={{ color: ci.color }} />;
  }

  const summaryLine = getItemSummaryLine(item, od);

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all ${missingRequired ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200'}`} data-testid={`item-${item.id}`}>
      <div className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${badge.color}`}>
            {categoryIcon || <BadgeIcon className="w-4.5 h-4.5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-wider border ${badge.color}`}>
                {badge.label}
              </Badge>
              {missingRequired && (
                <span className="text-[8px] text-amber-600 font-bold uppercase">Required fields</span>
              )}
            </div>
            <div className="font-semibold text-sm leading-tight text-slate-800 line-clamp-2">{item.description}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.reference}</div>
          </div>

          <button 
            onClick={() => removeItem(item.id)}
            className="w-7 h-7 flex items-center justify-center bg-red-50 hover:bg-red-100 text-red-500 rounded-lg transition-colors shrink-0 active:scale-90 touch-manipulation"
            data-testid={`remove-item-${item.id}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {summaryLine.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
            {summaryLine.map((info, i) => (
              <span key={i} className="flex items-center gap-1">
                <span className="text-slate-400">{info.label}:</span>
                <span className={`font-medium ${info.highlight ? info.highlight : 'text-slate-600'}`}>{info.value}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {item.amountDue > 0 && item.type !== 'DIRECT_INCOME' && (
              <div>
                <div className="text-[9px] text-slate-400 uppercase font-semibold tracking-wider">Due</div>
                <div className="text-xs font-mono text-slate-500">R {item.amountDue.toFixed(2)}</div>
              </div>
            )}
            <div>
              <div className="text-[9px] text-blue-500 uppercase font-semibold tracking-wider">Pay</div>
              <div className="text-sm font-mono font-bold text-blue-700">R {item.amountToPay.toFixed(2)}</div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-[10px] text-blue-600 font-semibold px-2 py-1 rounded-lg bg-blue-50 active:bg-blue-100 touch-manipulation"
          >
            {expanded ? 'Less' : 'Details'}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3 space-y-3">
          {item.type === 'CONSUMER_SERVICES' || item.type === 'ACCOUNT_GROUP' ? (
            <ConsumerDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} />
          ) : item.type === 'PREPAID' ? (
            <PrepaidDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} />
          ) : item.type === 'CLEARANCE' ? (
            <ClearanceDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} updateItemDetails={updateItemDetails} />
          ) : item.type === 'DIRECT_INCOME' ? (
            <DirectIncomeDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} updateItemDetails={updateItemDetails} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function ConsumerDetailsSection({ item, od, updateItemAmount }: { item: TransactionItem; od: any; updateItemAmount: (id: string, amount: number) => void }) {
  return (
    <div className="space-y-2">
      {od.name && (
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-700">{od.name}</span>
        </div>
      )}
      {od.address && (
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span className="text-xs text-slate-600">{od.address}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {(od.accountNumber || od.accountNo) && (
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Account No</div>
            <div className="text-xs font-mono">{od.accountNumber || od.accountNo}</div>
          </div>
        )}
        {od.outStandingAmount != null && (
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Outstanding</div>
            <div className="text-xs font-mono font-bold text-red-600">R {Number(od.outStandingAmount).toFixed(2)}</div>
          </div>
        )}
        {od.status && (
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Status</div>
            <div className="text-xs">{od.status}</div>
          </div>
        )}
        {od.institutionDesc && (
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Institution</div>
            <div className="text-xs">{od.institutionDesc}</div>
          </div>
        )}
      </div>
      <div>
        <Label className="text-[9px] text-blue-600 uppercase font-semibold tracking-wider">Pay Amount (R)</Label>
        <div className="relative mt-0.5">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">R</span>
          <Input
            type="text"
            inputMode="decimal"
            className="h-9 pl-7 text-right font-mono text-sm rounded-lg"
            defaultValue={item.amountToPay > 0 ? item.amountToPay.toString() : ''}
            placeholder="0.00"
            onBlur={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateItemAmount(item.id, val);
            }}
            data-testid={`input-mobile-pay-${item.id}`}
          />
        </div>
      </div>
    </div>
  );
}

function PrepaidDetailsSection({ item, od, updateItemAmount }: { item: TransactionItem; od: any; updateItemAmount: (id: string, amount: number) => void }) {
  const account = od as Account;
  const isWater = account?.prepaidType === 'Water';
  return (
    <div className="space-y-2">
      {account.name && (
        <div className="flex items-center gap-2">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs font-medium text-slate-700">{account.name}</span>
        </div>
      )}
      {account.address && (
        <div className="flex items-start gap-2">
          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          <span className="text-xs text-slate-600">{account.address}</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-semibold">Meter No</div>
          <div className="text-xs font-mono font-bold">{account.prepaidMeterNo}</div>
        </div>
        <div>
          <div className="text-[9px] text-slate-400 uppercase font-semibold">Type</div>
          <div className="text-xs flex items-center gap-1">
            {isWater ? <Droplets className="w-3 h-3 text-blue-500" /> : <Zap className="w-3 h-3 text-yellow-500" />}
            {isWater ? 'Water' : 'Electricity'}
          </div>
        </div>
        {account.accountNo && (
          <div>
            <div className="text-[9px] text-slate-400 uppercase font-semibold">Account</div>
            <div className="text-xs font-mono">{account.accountNo}</div>
          </div>
        )}
      </div>
      <div>
        <Label className={`text-[9px] uppercase font-semibold tracking-wider ${isWater ? 'text-blue-600' : 'text-yellow-600'}`}>Recharge Amount (R)</Label>
        <div className="relative mt-0.5">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">R</span>
          <Input
            type="text"
            inputMode="decimal"
            className="h-9 pl-7 text-right font-mono text-sm rounded-lg"
            defaultValue={item.amountToPay > 0 ? item.amountToPay.toString() : ''}
            placeholder="0.00"
            onBlur={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateItemAmount(item.id, val);
            }}
            data-testid={`input-mobile-pay-${item.id}`}
          />
        </div>
        <div className="flex gap-1.5 mt-1.5">
          {[50, 100, 200, 500].map(amt => (
            <button
              key={amt}
              onClick={() => updateItemAmount(item.id, amt)}
              className={`flex-1 text-xs font-bold py-1.5 rounded-lg border transition-colors active:scale-95 touch-manipulation ${isWater ? 'bg-blue-50 border-blue-200 text-blue-700 active:bg-blue-100' : 'bg-yellow-50 border-yellow-200 text-yellow-700 active:bg-yellow-100'}`}
            >
              R{amt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function ClearanceDetailsSection({ item, od, updateItemAmount, updateItemDetails }: { item: TransactionItem; od: any; updateItemAmount: (id: string, amount: number) => void; updateItemDetails: (id: string, details: Partial<TransactionItem>) => void }) {
  const clr = od;
  const paidItems = clr.paidItems || [];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {clr.ownerName && (
          <div>
            <div className="text-[9px] text-amber-600 uppercase font-semibold">Owner</div>
            <div className="text-xs font-medium">{clr.ownerName}</div>
          </div>
        )}
        {clr.scheduleNo && (
          <div>
            <div className="text-[9px] text-amber-600 uppercase font-semibold">Schedule</div>
            <div className="text-xs font-mono">{clr.scheduleNo}</div>
          </div>
        )}
        {clr.sgNumber && (
          <div>
            <div className="text-[9px] text-amber-600 uppercase font-semibold">SG Number</div>
            <div className="text-xs font-mono">{clr.sgNumber}</div>
          </div>
        )}
        {clr.propertyAddress && (
          <div className="col-span-2">
            <div className="text-[9px] text-amber-600 uppercase font-semibold">Property</div>
            <div className="text-xs">{clr.propertyAddress}</div>
          </div>
        )}
        {clr.status && (
          <div>
            <div className="text-[9px] text-amber-600 uppercase font-semibold">Status</div>
            <Badge variant="outline" className="text-[9px] h-4 px-1.5">{clr.status}</Badge>
          </div>
        )}
        {clr.expiryDate && (
          <div>
            <div className="text-[9px] text-amber-600 uppercase font-semibold">Valid Until</div>
            <div className="text-xs">{clr.expiryDate}</div>
          </div>
        )}
      </div>
      {paidItems.length > 0 && (
        <div className="bg-amber-50 rounded-lg border border-amber-200 overflow-hidden">
          <div className="text-[9px] text-amber-700 font-bold uppercase tracking-wider px-2.5 py-1.5 bg-amber-100/60">{paidItems.length} line item{paidItems.length !== 1 ? 's' : ''}</div>
          <div className="divide-y divide-amber-200">
            {paidItems.map((pi: any, i: number) => (
              <div key={i} className="flex items-center justify-between px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-mono text-amber-800">{pi.accountNumber || pi.account_ID || 'N/A'}</div>
                  <div className="text-[9px] text-amber-600">{pi.debT_TYPE || pi.debtType || '-'}</div>
                </div>
                <div className="text-xs font-mono font-bold text-amber-800">R {(pi.paymentAmount ?? pi.amount ?? 0).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between bg-amber-50 rounded-lg px-3 py-2 border border-amber-200">
        <span className="text-[10px] text-amber-700 font-bold uppercase">Total Pay</span>
        <span className="text-sm font-mono font-bold text-amber-900">R {item.amountToPay.toFixed(2)}</span>
      </div>
    </div>
  );
}

function DirectIncomeDetailsSection({ item, od, updateItemAmount, updateItemDetails }: { item: TransactionItem; od: any; updateItemAmount: (id: string, amount: number) => void; updateItemDetails: (id: string, details: Partial<TransactionItem>) => void }) {
  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2">
        {od.groupName && (
          <div>
            <div className="text-[9px] text-green-600 uppercase font-semibold">Group</div>
            <div className="text-xs font-medium">{od.groupName}</div>
          </div>
        )}
        {od.scoaItem && (
          <div>
            <div className="text-[9px] text-green-600 uppercase font-semibold">SCOA Item</div>
            <div className="text-xs">{od.scoaItem}</div>
          </div>
        )}
        {od.vatRate != null && (
          <div>
            <div className="text-[9px] text-green-600 uppercase font-semibold">VAT Rate</div>
            <div className="text-xs font-mono">{od.vatRate}%</div>
          </div>
        )}
      </div>
      <div>
        <Label className="text-[9px] text-green-600 uppercase font-semibold tracking-wider">Pay Amount (R)</Label>
        <div className="relative mt-0.5">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">R</span>
          <Input
            type="text"
            inputMode="decimal"
            className="h-9 pl-7 text-right font-mono text-sm rounded-lg border-green-200"
            defaultValue={item.amountToPay > 0 ? item.amountToPay.toString() : ''}
            placeholder="0.00"
            onBlur={(e) => {
              const val = parseFloat(e.target.value) || 0;
              updateItemAmount(item.id, val);
            }}
            data-testid={`input-mobile-pay-${item.id}`}
          />
        </div>
      </div>
      <div>
        <Label className={`text-[9px] uppercase font-semibold tracking-wider flex items-center gap-1 ${!item.paidBy?.trim() ? 'text-red-500' : 'text-green-600'}`}>
          Paid By (Last Name) *
        </Label>
        <Input
          placeholder="Surname / Company"
          className={`h-9 text-sm rounded-lg mt-0.5 ${!item.paidBy?.trim() ? 'border-red-300 ring-1 ring-red-200' : 'border-green-200'}`}
          value={item.paidBy || ''}
          onChange={(e) => updateItemDetails(item.id, { paidBy: e.target.value })}
          data-testid={`input-mobile-paidby-${item.id}`}
        />
      </div>
      <div>
        <Label className={`text-[9px] uppercase font-semibold tracking-wider flex items-center gap-1 ${!item.notes?.trim() ? 'text-red-500' : 'text-green-600'}`}>
          Description/Notes *
        </Label>
        <Input
          placeholder="Payment description..."
          className={`h-9 text-sm rounded-lg mt-0.5 ${!item.notes?.trim() ? 'border-red-300 ring-1 ring-red-200' : 'border-green-200'}`}
          value={item.notes || ''}
          onChange={(e) => updateItemDetails(item.id, { notes: e.target.value })}
          data-testid={`input-mobile-notes-${item.id}`}
        />
      </div>
    </div>
  );
}

function MobileItemsList({ items, removeItem, updateItemAmount, updateItemDetails, totalDue }: { items: TransactionItem[]; removeItem: (id: string) => void; updateItemAmount: (id: string, amount: number) => void; updateItemDetails: (id: string, details: Partial<TransactionItem>) => void; totalDue: number }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-slate-400">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-3">
          <Banknote className="w-7 h-7 text-blue-300" />
        </div>
        <p className="text-sm font-semibold text-slate-600">No items in basket</p>
        <p className="text-xs text-slate-400 mt-0.5">Search for an account to add items</p>
      </div>
    );
  }

  const hasDirectIncomeIssues = items.some(i => i.type === 'DIRECT_INCOME' && (!i.paidBy?.trim() || !i.notes?.trim()));

  return (
    <div className="p-3 space-y-2">
      {hasDirectIncomeIssues && (
        <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
          <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
          <span>Expand Direct Income items to fill in required <strong>Paid By</strong> and <strong>Notes</strong> fields</span>
        </div>
      )}
      {items.map((item) => (
        <MobileItemCard
          key={item.id}
          item={item}
          removeItem={removeItem}
          updateItemAmount={updateItemAmount}
          updateItemDetails={updateItemDetails}
        />
      ))}
      <div className="flex justify-between items-center pt-2 px-1 border-t border-dashed border-slate-200 mt-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        <span className="font-mono font-bold text-base text-slate-800">R {totalDue.toFixed(2)}</span>
      </div>
    </div>
  );
}

function MobilePaymentView({ totalDue, dayEndStatus, cashAllowed, cardAllowed, activeInput, setActiveInput, inputBuffer, payment, setPaymentAmount, setCardReference, setCardExpiry, handleNumpadInput, handleBackspace, handlePayExact, handleClearAmount, numKeys, cardExpiryValid }: any) {
  if (dayEndStatus === 'RECONCILED') {
    return (
      <div className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 space-y-2">
          <Lock className="w-8 h-8 mx-auto opacity-50" />
          <h3 className="font-bold">Shift Closed</h3>
          <p className="text-sm">Payments cannot be processed after day end reconciliation.</p>
        </div>
      </div>
    );
  }

  const currentValue = activeInput === 'cash' ? payment.cashAmount : payment.cardAmount;
  const otherValue = activeInput === 'cash' ? payment.cardAmount : payment.cashAmount;
  const remaining = Math.max(0, totalDue - otherValue);

  return (
    <div className="flex flex-col px-3 pt-2 pb-1 gap-2">
      {/* Total Due - compact */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-3 text-center text-white">
        <div className="text-[9px] uppercase tracking-widest font-bold text-white/60 mb-0.5">Total Due</div>
        <div className="text-3xl font-mono font-bold leading-none">R {totalDue.toFixed(2)}</div>
      </div>

      {!cashAllowed && !cardAllowed && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-amber-800 text-xs">
          <AlertTriangle className="w-4 h-4 mx-auto mb-1 opacity-70" />
          No payment types enabled. Contact your supervisor.
        </div>
      )}

      {/* Payment Method Toggle */}
      {cashAllowed && cardAllowed && (
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setActiveInput('cash')}
            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all active:scale-[0.97] touch-manipulation ${
              activeInput === 'cash'
                ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                : 'border-slate-200 bg-white'
            }`}
            data-testid="toggle-cash"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeInput === 'cash' ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <Banknote className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className={`text-[10px] uppercase font-bold tracking-wider ${activeInput === 'cash' ? 'text-emerald-600' : 'text-slate-400'}`}>Cash</div>
              <div className={`text-sm font-mono font-bold ${activeInput === 'cash' ? 'text-emerald-700' : 'text-slate-600'}`}>
                {payment.cashAmount > 0 ? `R ${payment.cashAmount.toFixed(2)}` : 'R 0.00'}
              </div>
            </div>
          </button>
          <button
            onClick={() => setActiveInput('card')}
            className={`flex items-center gap-2 p-2.5 rounded-xl border-2 transition-all active:scale-[0.97] touch-manipulation ${
              activeInput === 'card'
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-slate-200 bg-white'
            }`}
            data-testid="toggle-card"
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeInput === 'card' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
              <CreditCard className="w-4 h-4" />
            </div>
            <div className="text-left">
              <div className={`text-[10px] uppercase font-bold tracking-wider ${activeInput === 'card' ? 'text-blue-600' : 'text-slate-400'}`}>Card</div>
              <div className={`text-sm font-mono font-bold ${activeInput === 'card' ? 'text-blue-700' : 'text-slate-600'}`}>
                {payment.cardAmount > 0 ? `R ${payment.cardAmount.toFixed(2)}` : 'R 0.00'}
              </div>
            </div>
          </button>
        </div>
      )}

      {/* Single method display when only one allowed */}
      {cashAllowed && !cardAllowed && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-emerald-500 bg-emerald-50">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-emerald-500 text-white">
            <Banknote className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Cash Only</div>
            <div className="text-sm font-mono font-bold text-emerald-700">
              {payment.cashAmount > 0 ? `R ${payment.cashAmount.toFixed(2)}` : 'R 0.00'}
            </div>
          </div>
        </div>
      )}

      {!cashAllowed && cardAllowed && (
        <div className="flex items-center gap-2 p-2.5 rounded-xl border-2 border-blue-500 bg-blue-50">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-blue-500 text-white">
            <CreditCard className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[10px] uppercase font-bold tracking-wider text-blue-600">Card Only</div>
            <div className="text-sm font-mono font-bold text-blue-700">
              {payment.cardAmount > 0 ? `R ${payment.cardAmount.toFixed(2)}` : 'R 0.00'}
            </div>
          </div>
        </div>
      )}

      {/* Active Input Display + Pay Exact */}
      <div className="flex items-center gap-1.5">
        <div className={`flex-1 rounded-xl border-2 p-2 flex items-center gap-2 ${
          activeInput === 'cash' ? 'border-emerald-300 bg-emerald-50/30' : 'border-blue-300 bg-blue-50/30'
        }`}>
          <span className={`text-xs font-bold uppercase ${activeInput === 'cash' ? 'text-emerald-500' : 'text-blue-500'}`}>R</span>
          <input
            type="text"
            inputMode="decimal"
            className="w-full bg-transparent text-xl font-mono font-bold focus:outline-none placeholder:text-slate-300 text-slate-800"
            value={activeInput === 'cash'
              ? inputBuffer
              : inputBuffer
            }
            placeholder="0.00"
            readOnly
            data-testid="input-amount"
          />
        </div>
        <button
          onClick={handlePayExact}
          className={`h-11 px-3 rounded-xl font-bold text-xs transition-all active:scale-95 touch-manipulation flex items-center gap-1 shrink-0 ${
            activeInput === 'cash'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          data-testid="button-pay-exact"
        >
          <Coins className="w-3.5 h-3.5" />
          Exact
        </button>
        {currentValue > 0 && (
          <button
            onClick={handleClearAmount}
            className="h-11 w-11 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center active:scale-95 transition-all touch-manipulation shrink-0"
            data-testid="button-clear"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Card Reference & Expiry */}
      {payment.cardAmount > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-1">Card Number <span className="text-red-500">*</span> <HelpTip text="Enter the full card number from the card machine slip." /></Label>
            <Input
              type="text"
              placeholder="Card number"
              value={payment.cardReference}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9]/g, '');
                setCardReference(val);
              }}
              className={`h-9 font-mono text-sm ${payment.cardReference && payment.cardReference.trim().length < 4 ? 'border-red-400 ring-1 ring-red-200' : ''}`}
              data-testid="input-card-reference"
              inputMode="numeric"
              tabIndex={7}
            />
          </div>
          <div>
            <Label className="text-[10px] text-slate-400 mb-0.5 flex items-center gap-1">Expiry <span className="text-red-500">*</span> <HelpTip text="Card expiry date in MM/YY format from the card slip." /></Label>
            <Input
              type="text"
              placeholder="MM/YY"
              value={payment.cardExpiry}
              onChange={(e) => {
                let val = e.target.value.replace(/[^0-9/]/g, '');
                if (val.length === 2 && !val.includes('/') && payment.cardExpiry.length < 3) val += '/';
                if (val.length > 5) val = val.slice(0, 5);
                setCardExpiry(val);
              }}
              className={`h-9 font-mono text-sm ${payment.cardExpiry && !cardExpiryValid ? 'border-red-400 ring-1 ring-red-200' : ''}`}
              data-testid="input-card-expiry"
              maxLength={5}
              inputMode="numeric"
              tabIndex={8}
            />
          </div>
        </div>
      )}

      {/* Quick Cash Buttons */}
      {activeInput === 'cash' && cashAllowed && (
        <div className="grid grid-cols-6 gap-1">
          {[10, 20, 50, 100, 200, 500].map(amt => (
            <button
              key={amt}
              onClick={() => setPaymentAmount('cash', payment.cashAmount + amt)}
              className="h-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-mono font-bold hover:bg-emerald-100 active:scale-95 transition-all touch-manipulation"
              data-testid={`quick-amount-${amt}`}
            >
              +{amt}
            </button>
          ))}
        </div>
      )}

      {/* Numpad - Compact */}
      <div className="grid grid-cols-3 gap-1">
        {numKeys.map((key: string) => (
          <button
            key={key}
            onClick={() => key === 'DEL' ? handleBackspace() : handleNumpadInput(key)}
            className={`h-11 rounded-lg text-lg font-mono font-semibold active:scale-95 transition-all touch-manipulation ${
              key === 'DEL'
                ? 'bg-red-50 text-red-500 border border-red-200 hover:bg-red-100'
                : 'bg-white text-slate-800 border border-slate-200 hover:bg-slate-50 shadow-sm'
            }`}
            data-testid={`numpad-${key}`}
          >
            {key === 'DEL' ? <Delete className="w-5 h-5 mx-auto" /> : key}
          </button>
        ))}
      </div>
    </div>
  );
}

function DesktopItemCard({ item, removeItem, updateItemAmount, updateItemDetails }: {
  item: TransactionItem;
  removeItem: (id: string) => void;
  updateItemAmount: (id: string, amount: number) => void;
  updateItemDetails: (id: string, details: Partial<TransactionItem>) => void;
}) {
  const hasRequiredFieldsMissing = item.type === 'DIRECT_INCOME' && (!item.paidBy?.trim() || !item.notes?.trim());
  const [expanded, setExpanded] = useState(hasRequiredFieldsMissing);
  const badge = getTypeBadge(item.type, item.originalData);
  const BadgeIcon = badge.icon;
  const od = item.originalData || {};

  let categoryIcon = null;
  if (item.type === 'DIRECT_INCOME') {
    const ci = getCategoryIcon(item.description);
    const CatIcon = ci.icon;
    categoryIcon = <CatIcon className="w-5 h-5" style={{ color: ci.color }} />;
  }

  const summaryLine = getItemSummaryLine(item, od);

  return (
    <div className={`bg-white rounded-xl border shadow-sm overflow-hidden transition-all group ${hasRequiredFieldsMissing ? 'border-amber-300 ring-1 ring-amber-200' : 'border-slate-200/80 hover:border-blue-200/50 hover:shadow-md'}`}>
      <div className="p-3.5 flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${badge.color}`}>
          {categoryIcon || <BadgeIcon className="w-5 h-5" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 h-4 font-bold uppercase tracking-wider border ${badge.color}`}>
              {badge.label}
            </Badge>
            {hasRequiredFieldsMissing && <span className="text-[8px] text-amber-600 font-bold">Fill required</span>}
          </div>
          <div className="font-semibold text-sm leading-tight text-slate-800 truncate">{item.description}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{item.reference}</div>
          {summaryLine.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500">
              {summaryLine.map((info, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-slate-400">{info.label}:</span>
                  <span className={`font-medium ${info.highlight ? info.highlight : 'text-slate-600'}`}>{info.value}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono font-bold text-base text-slate-800">R {item.amountToPay.toFixed(2)}</div>
          {item.amountDue > 0 && item.type !== 'DIRECT_INCOME' && item.amountDue !== item.amountToPay && (
            <div className="text-[10px] text-slate-400 font-mono">Due: R {item.amountDue.toFixed(2)}</div>
          )}
        </div>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-7 h-7 flex items-center justify-center text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
          <button
            onClick={() => removeItem(item.id)}
            className="w-7 h-7 flex items-center justify-center text-red-400 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-3.5 space-y-3">
          {item.type === 'CONSUMER_SERVICES' || item.type === 'ACCOUNT_GROUP' ? (
            <ConsumerDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} />
          ) : item.type === 'PREPAID' ? (
            <PrepaidDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} />
          ) : item.type === 'CLEARANCE' ? (
            <ClearanceDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} updateItemDetails={updateItemDetails} />
          ) : item.type === 'DIRECT_INCOME' ? (
            <DirectIncomeDetailsSection item={item} od={od} updateItemAmount={updateItemAmount} updateItemDetails={updateItemDetails} />
          ) : null}
        </div>
      )}
    </div>
  );
}

function DesktopPaymentContent({ transactionItems, removeItem, updateItemAmount, updateItemDetails, totalDue, dayEndStatus, cashAllowed, cardAllowed, activeInput, setActiveInput, inputBuffer, payment, setPaymentAmount, setCardReference, setCardExpiry, handleNumpadInput, handleBackspace, handlePayExact, handleClearAmount, handleDesktopInput, cardExpiryValid }: any) {
  const [desktopTab, setDesktopTab] = useState<'payment' | 'items'>('payment');

  const hasDirectIncomeIssues = transactionItems.some((i: TransactionItem) => i.type === 'DIRECT_INCOME' && (!i.paidBy?.trim() || !i.notes?.trim()));

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 pt-4 shrink-0">
        <div className="flex bg-slate-100/80 rounded-xl p-1 h-11">
          <button
            onClick={() => setDesktopTab('items')}
            className={`flex-1 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1.5 relative ${desktopTab === 'items' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Items ({transactionItems.length})
            {hasDirectIncomeIssues && <span className="w-2 h-2 bg-amber-400 rounded-full absolute -top-0.5 -right-0.5" />}
            <HelpTip text="View and manage items in your current transaction basket." size="sm" />
          </button>
          <button
            onClick={() => setDesktopTab('payment')}
            className={`flex-1 rounded-lg text-sm font-medium transition-all ${desktopTab === 'payment' ? 'bg-white shadow-sm text-blue-700' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Payment
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        {desktopTab === 'items' ? (
          <>
            {transactionItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground border-2 border-dashed border-blue-200/50 rounded-2xl bg-blue-50/20">
                <Banknote className="w-8 h-8 text-blue-300 mb-2" />
                <p className="text-sm font-medium">No items added</p>
                <p className="text-xs mt-0.5 text-slate-400">Search to add items to basket</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {hasDirectIncomeIssues && (
                  <div className="flex items-center gap-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                    <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Fill in <strong>Paid By</strong> and <strong>Notes</strong> for Direct Income items</span>
                  </div>
                )}
                {transactionItems.map((item: TransactionItem) => (
                  <DesktopItemCard key={item.id} item={item} removeItem={removeItem} updateItemAmount={updateItemAmount} updateItemDetails={updateItemDetails} />
                ))}
                <div className="flex justify-between items-center pt-3 px-1 border-t border-dashed border-slate-200">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{transactionItems.length} item{transactionItems.length !== 1 ? 's' : ''}</span>
                  <span className="font-mono font-bold text-lg text-slate-800">R {totalDue.toFixed(2)}</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {/* Total Display */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100/50 text-center">
              <div className="text-blue-600/80 uppercase tracking-widest font-bold text-xs mb-1 flex items-center justify-center gap-1">TOTAL DUE <HelpTip text="The sum of all items in your basket, rounded to the nearest 10 cents." /></div>
              <div className="text-5xl font-mono font-bold text-blue-700">R {totalDue.toFixed(2)}</div>
            </div>

            {dayEndStatus === 'RECONCILED' ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center text-red-800 space-y-2">
                <Lock className="w-8 h-8 mx-auto opacity-50" />
                <h3 className="font-bold text-base">Shift Closed</h3>
                <p className="text-sm">Payments cannot be processed after day end reconciliation.</p>
              </div>
            ) : (
              <>
                {!cashAllowed && !cardAllowed && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center text-amber-800 text-xs">
                    <AlertTriangle className="w-4 h-4 mx-auto mb-1 opacity-70" />
                    No payment types enabled. Contact your supervisor.
                  </div>
                )}

                {/* Cash / Card Input */}
                <div className={`grid gap-3 ${cashAllowed && cardAllowed ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {cashAllowed && (
                    <div 
                      onClick={() => setActiveInput('cash')}
                      className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${activeInput === 'cash' ? 'border-green-500 bg-green-50/40 ring-2 ring-green-200/50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'}`}
                    >
                      <div className={`flex items-center gap-1.5 mb-1 ${activeInput === 'cash' ? 'text-green-600' : 'text-muted-foreground'}`}>
                        <Banknote className="w-4 h-4" />
                        <span className="font-semibold text-xs uppercase tracking-wide">Cash</span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        tabIndex={5}
                        className="w-full bg-transparent text-2xl font-mono font-bold focus:outline-none placeholder:text-slate-300"
                        value={activeInput === 'cash' ? inputBuffer : (payment.cashAmount > 0 ? payment.cashAmount.toFixed(2).replace(/\.00$/, '') : "")}
                        placeholder="0.00"
                        onChange={(e) => {
                          if (activeInput !== 'cash') setActiveInput('cash');
                          const val = e.target.value;
                          if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                            handleDesktopInput('cash', val);
                          }
                        }}
                        onFocus={() => setActiveInput('cash')}
                      />
                    </div>
                  )}

                  {cardAllowed && (
                    <div 
                      onClick={() => setActiveInput('card')}
                      className={`p-4 rounded-xl border-2 text-left transition-all cursor-pointer ${activeInput === 'card' ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-200/50 shadow-sm' : 'border-slate-200 bg-slate-50 hover:bg-slate-100/80'}`}
                    >
                      <div className={`flex items-center gap-1.5 mb-1 ${activeInput === 'card' ? 'text-blue-600' : 'text-muted-foreground'}`}>
                        <CreditCard className="w-4 h-4" />
                        <span className="font-semibold text-xs uppercase tracking-wide">Card</span>
                      </div>
                      <input
                        type="text"
                        inputMode="decimal"
                        tabIndex={6}
                        className="w-full bg-transparent text-2xl font-mono font-bold focus:outline-none placeholder:text-slate-300"
                        value={activeInput === 'card' ? inputBuffer : (payment.cardAmount > 0 ? payment.cardAmount.toFixed(2).replace(/\.00$/, '') : "")}
                        placeholder="0.00"
                        onChange={(e) => {
                          if (activeInput !== 'card') setActiveInput('card');
                          const val = e.target.value;
                          if (/^[0-9]*\.?[0-9]*$/.test(val)) {
                            handleDesktopInput('card', val);
                          }
                        }}
                        onFocus={() => setActiveInput('card')}
                      />
                    </div>
                  )}
                </div>

                {/* Pay Exact button for desktop */}
                <Button
                  variant="outline"
                  onClick={handlePayExact}
                  className="w-full h-10 gap-2 text-sm font-semibold"
                  data-testid="button-pay-exact-desktop"
                >
                  <Coins className="w-4 h-4" />
                  Pay Exact Amount (R {Math.max(0, totalDue - (activeInput === 'cash' ? payment.cardAmount : payment.cashAmount)).toFixed(2)})
                </Button>

                {payment.cardAmount > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">Card Number <span className="text-red-500">*</span> <HelpTip text="Enter the full card number from the card machine slip." /></Label>
                      <Input
                        type="text"
                        placeholder="Card number"
                        value={payment.cardReference}
                        onChange={(e) => {
                          const val = e.target.value.replace(/[^0-9]/g, '');
                          setCardReference(val);
                        }}
                        className={`h-10 font-mono text-sm ${payment.cardReference && payment.cardReference.trim().length < 4 ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                        data-testid="input-card-reference"
                        inputMode="numeric"
                        tabIndex={7}
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">Card Expiry <span className="text-red-500">*</span> <HelpTip text="Card expiry date in MM/YY format from the card slip." /></Label>
                      <Input
                        type="text"
                        placeholder="MM/YY"
                        value={payment.cardExpiry}
                        onChange={(e) => {
                          let val = e.target.value.replace(/[^0-9/]/g, '');
                          if (val.length === 2 && !val.includes('/') && payment.cardExpiry.length < 3) val += '/';
                          if (val.length > 5) val = val.slice(0, 5);
                          setCardExpiry(val);
                        }}
                        className={`h-10 font-mono text-sm ${payment.cardExpiry && !cardExpiryValid ? 'border-red-400 ring-1 ring-red-200' : ''}`}
                        data-testid="input-card-expiry-desktop"
                        maxLength={5}
                        inputMode="numeric"
                        tabIndex={8}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
