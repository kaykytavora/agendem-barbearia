import { useState, useCallback } from 'react';

export function useCepMask(initialValue: string = '') {
  const [value, setValue] = useState(initialValue);

  const formatCep = useCallback((cep: string): string => {
    if (!cep) return "";
    
    // Remove todos os caracteres que não são dígitos e limita a 8
    const digitsOnly = cep.replace(/\D/g, '').slice(0, 8);

    // Aplica a máscara XXXXX-XXX
    if (digitsOnly.length > 5) {
      return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`;
    }
    
    return digitsOnly;
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(formatCep(e.target.value));
  }, [formatCep]);

  const setCepValue = useCallback((val: string) => {
    setValue(formatCep(val));
  }, [formatCep]);

  return {
    value,
    setValue: setCepValue,
    handleChange,
  };
} 