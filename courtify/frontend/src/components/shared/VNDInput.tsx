import { forwardRef, useRef, useEffect } from 'react';

interface VNDInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
}

/**
 * Monetary input that:
 * - Live formats the value using dots as thousand separators (vi-VN style)
 * - Uses comma as the decimal separator for display
 * - Calls onChange with the raw numeric string (e.g. "10000.5")
 * - Preserves cursor position correctly during formatting
 */
const VNDInput = forwardRef<HTMLInputElement, VNDInputProps>(
  ({ value = '', onChange, placeholder = '0', className = '', ...rest }, ref) => {
    const internalRef = useRef<HTMLInputElement>(null);

    // Sync external value changes with the input display
    useEffect(() => {
      if (internalRef.current) {
        const currentRaw = internalRef.current.value.replace(/\./g, '').replace(',', '.');
        if (currentRaw !== value) {
          internalRef.current.value = formatForDisplay(value);
        }
      }
    }, [value]);

    const formatForDisplay = (val: string | number) => {
      if (val === undefined || val === null || val === '') return '';
      const str = String(val);
      const [integer, decimal] = str.split('.');
      
      // Handle just a minus sign
      if (integer === '-' && !decimal) return '-';
      
      const num = parseInt(integer || '0', 10);
      let formattedInt = isNaN(num) ? '' : new Intl.NumberFormat('vi-VN').format(num);
      
      // If integer is just "-" and num is 0, we might need to preserve the minus
      if (integer === '-0') formattedInt = '-0';
      else if (integer === '-' && formattedInt === '0') formattedInt = '-';

      return decimal !== undefined ? `${formattedInt},${decimal}` : formattedInt;
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      const allowedKeys = [
        'Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab', 'Enter',
        'Home', 'End', 'Control', 'v', 'c', 'a', 'Meta',
      ];
      if (allowedKeys.includes(e.key)) return;
      if (e.key === '-' || e.key === ',' || e.key === '.') return;
      if (e.key >= '0' && e.key <= '9') return;
      e.preventDefault();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.target;
      const originalValue = input.value;
      const selectionStart = input.selectionStart || 0;

      // Count digits before cursor to restore position later
      const prefix = originalValue.slice(0, selectionStart);
      const digitsBeforeCursor = prefix.replace(/\D/g, '').length;
      const hasMinusBefore = prefix.includes('-');
      const hasCommaBefore = prefix.includes(',');

      // 1. Extract raw numeric string
      // Dots are live-formatted thousand separators in vi-VN, so we remove them.
      // Commas are used for decimals in vi-VN, so we keep them.
      let normalized = originalValue.replace(/\./g, '');
      
      // Handle multiple commas (keep only the first one)
      const commaIndex = normalized.indexOf(',');
      if (commaIndex !== -1) {
        normalized = normalized.slice(0, commaIndex + 1) + 
                     normalized.slice(commaIndex + 1).replace(/,/g, '');
      }
      
      // Handle minus signs (only allow at start)
      if (normalized.lastIndexOf('-') > 0) {
        normalized = normalized.replace(/(?!^)-/g, '');
      }

      // 2. Format for display
      const [integerPart, decimalPart] = normalized.split(',');
      const isNegative = integerPart.startsWith('-');
      const digits = integerPart.replace(/\D/g, '');
      
      let formattedInt = '';
      if (integerPart === '-' || integerPart === '-0') {
        formattedInt = integerPart;
      } else if (digits) {
        try {
          // Use BigInt to handle extremely large VND amounts without precision loss
          const bnum = BigInt(digits);
          formattedInt = (isNegative ? '-' : '') + new Intl.NumberFormat('vi-VN').format(bnum);
        } catch {
          // Fallback to parseInt if BigInt fails (shouldn't happen for digit strings)
          const num = parseInt(digits, 10);
          formattedInt = (isNegative ? '-' : '') + new Intl.NumberFormat('vi-VN').format(num);
        }
      } else if (isNegative) {
        formattedInt = '-';
      } else if (integerPart === '') {
        formattedInt = '';
      } else {
        formattedInt = '0';
      }

      const finalDisplay = decimalPart !== undefined 
        ? `${formattedInt},${decimalPart.slice(0, 4)}` 
        : formattedInt;

      // 3. Update element value
      input.value = finalDisplay;

      // 4. Notify parent with raw decimal string (JS uses dot for decimal)
      const rawForParent = normalized.replace(',', '.');
      onChange?.(rawForParent);

      // 5. Restore cursor position
      let newPos = 0;
      let digitsFound = 0;
      let commaFound = false;
      let minusFound = false;

      for (let i = 0; i < finalDisplay.length; i++) {
        const char = finalDisplay[i];
        if (/\d/.test(char)) digitsFound++;
        if (char === ',') commaFound = true;
        if (char === '-') minusFound = true;

        newPos = i + 1;
        
        if (digitsFound >= digitsBeforeCursor) {
          if (hasCommaBefore && !commaFound) continue;
          if (hasMinusBefore && !minusFound) continue;
          break;
        }
      }
      
      input.setSelectionRange(newPos, newPos);
    };

    return (
      <input
        ref={(el) => {
          (internalRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        type="text"
        inputMode="decimal"
        defaultValue={formatForDisplay(value)}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        placeholder={placeholder}
        className={`input ${className}`}
        {...rest}
      />
    );
  }
);

VNDInput.displayName = 'VNDInput';

export { VNDInput };
