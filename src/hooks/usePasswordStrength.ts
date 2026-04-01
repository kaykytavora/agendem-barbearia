import { useState, useEffect } from 'react';

export interface PasswordStrength {
  score: number; // 0-4 (muito fraca, fraca, média, forte, muito forte)
  label: string;
  color: string;
  percentage: number;
  requirements: {
    length: boolean;
    lowercase: boolean;
    uppercase: boolean;
    number: boolean;
    special: boolean;
  };
}

export const usePasswordStrength = (password: string): PasswordStrength => {
  const [strength, setStrength] = useState<PasswordStrength>({
    score: 0,
    label: 'Muito fraca',
    color: '#ef4444',
    percentage: 0,
    requirements: {
      length: false,
      lowercase: false,
      uppercase: false,
      number: false,
      special: false,
    },
  });

  useEffect(() => {
    if (!password) {
      setStrength({
        score: 0,
        label: 'Muito fraca',
        color: '#ef4444',
        percentage: 0,
        requirements: {
          length: false,
          lowercase: false,
          uppercase: false,
          number: false,
          special: false,
        },
      });
      return;
    }

    const requirements = {
      length: password.length >= 8,
      lowercase: /[a-z]/.test(password),
      uppercase: /[A-Z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password),
    };

    const metRequirements = Object.values(requirements).filter(Boolean).length;
    let score = 0;
    let label = 'Muito fraca';
    let color = '#ef4444';

    // Calcular pontuação baseada nos requisitos atendidos
    if (metRequirements >= 5) {
      score = 4;
      label = 'Muito forte';
      color = '#22c55e';
    } else if (metRequirements >= 4) {
      score = 3;
      label = 'Forte';
      color = '#84cc16';
    } else if (metRequirements >= 3) {
      score = 2;
      label = 'Média';
      color = '#eab308';
    } else if (metRequirements >= 2) {
      score = 1;
      label = 'Fraca';
      color = '#f97316';
    }

    // Ajustar pontuação baseada no comprimento
    if (password.length < 6) {
      score = Math.min(score, 0);
      label = 'Muito fraca';
      color = '#ef4444';
    } else if (password.length < 8) {
      score = Math.min(score, 1);
    }

    const percentage = (score / 4) * 100;

    setStrength({
      score,
      label,
      color,
      percentage,
      requirements,
    });
  }, [password]);

  return strength;
};