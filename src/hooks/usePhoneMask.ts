import { useState, useCallback, useEffect } from 'react';
import { toStringSafe, onlyDigits } from '../lib/utils';

export function usePhoneMask(initialValue: string = '') {
  const [value, setValue] = useState(toStringSafe(initialValue));

  // Sincroniza o estado interno se o valor inicial mudar
  useEffect(() => {
    setValue(formatPhoneNumber(initialValue));
  }, [initialValue]);

  const formatPhoneNumber = useCallback((raw: unknown): string => {
    const safeRaw = toStringSafe(raw);
    if (!safeRaw) return "";
    
    const digits = onlyDigits(safeRaw).slice(0, 11);

    if (digits.length <= 2) {
      return `(${digits}`;
    }
    
    if (digits.length <= 6) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    
    if (digits.length <= 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = toStringSafe(e.target.value);
    setValue(formatPhoneNumber(value));
  }, [formatPhoneNumber]);

  const handleBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // Garante que a formatação final seja aplicada ao sair do campo
    const value = toStringSafe(e.target.value);
    setValue(formatPhoneNumber(value));
  }, [formatPhoneNumber]);


  return {
    value,
    setValue,
    handleChange,
    handleBlur,
  };
}