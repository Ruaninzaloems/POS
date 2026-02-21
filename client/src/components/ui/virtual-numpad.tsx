import React from 'react';
import { Button } from '@/components/ui/button';
import { Delete, Check } from 'lucide-react';

interface VirtualNumpadProps {
  onInput: (value: string) => void;
  onClear: () => void;
  onEnter?: () => void;
  className?: string;
}

export function VirtualNumpad({ onInput, onClear, onEnter, className }: VirtualNumpadProps) {
  const keys = [
    '1', '2', '3',
    '4', '5', '6',
    '7', '8', '9',
    '.', '0', 'DEL'
  ];

  const handlePress = (key: string) => {
    if (key === 'DEL') {
       onClear(); // actually backspace logic might be better but clear is safer for quick POS
    } else {
       onInput(key);
    }
  };

  return (
    <div className={`grid grid-cols-3 gap-1.5 ${className}`}>
      {keys.map((key) => (
        <Button
          key={key}
          variant={key === 'DEL' ? 'destructive' : 'outline'}
          className={`h-11 sm:h-14 text-lg sm:text-xl font-mono font-medium shadow-sm active:scale-95 transition-transform touch-manipulation ${
            key === 'DEL' ? 'bg-red-50 hover:bg-red-100 border-red-200 text-red-600' : 'bg-white hover:bg-accent'
          }`}
          onClick={() => handlePress(key)}
        >
          {key === 'DEL' ? <Delete className="w-5 h-5 sm:w-6 sm:h-6" /> : key}
        </Button>
      ))}
    </div>
  );
}
