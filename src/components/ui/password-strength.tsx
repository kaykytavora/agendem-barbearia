import { cn } from '@/lib/utils';
import { PasswordStrength } from '@/hooks/usePasswordStrength';
import { Check, X } from 'lucide-react';

interface PasswordStrengthBarProps {
  strength: PasswordStrength;
  showRequirements?: boolean;
  className?: string;
}

export const PasswordStrengthBar: React.FC<PasswordStrengthBarProps> = ({
  strength,
  showRequirements = true,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {/* Barra de força */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">
            Força da senha:
          </span>
          <span 
            className="text-sm font-semibold transition-colors duration-300"
            style={{ color: strength.color }}
          >
            {strength.label}
          </span>
        </div>
        
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${strength.percentage}%`,
              backgroundColor: strength.color,
              transform: 'translateX(0)',
            }}
          />
        </div>
      </div>

      {/* Requisitos da senha */}
      {showRequirements && (
        <div className="space-y-2">
          <span className="text-sm font-medium text-muted-foreground">
            Requisitos:
          </span>
          <div className="grid grid-cols-1 gap-1 text-xs">
            <RequirementItem
              met={strength.requirements.length}
              text="Pelo menos 8 caracteres"
            />
            <RequirementItem
              met={strength.requirements.lowercase}
              text="Uma letra minúscula"
            />
            <RequirementItem
              met={strength.requirements.uppercase}
              text="Uma letra maiúscula"
            />
            <RequirementItem
              met={strength.requirements.number}
              text="Um número"
            />
            <RequirementItem
              met={strength.requirements.special}
              text="Um caractere especial (!@#$%^&*)"
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface RequirementItemProps {
  met: boolean;
  text: string;
}

const RequirementItem: React.FC<RequirementItemProps> = ({ met, text }) => {
  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'w-4 h-4 rounded-full flex items-center justify-center transition-all duration-300',
          met
            ? 'bg-green-500 text-white scale-100'
            : 'bg-muted text-muted-foreground scale-90'
        )}
      >
        {met ? (
          <Check className="w-2.5 h-2.5" />
        ) : (
          <X className="w-2.5 h-2.5" />
        )}
      </div>
      <span
        className={cn(
          'transition-colors duration-300',
          met ? 'text-green-600' : 'text-muted-foreground'
        )}
      >
        {text}
      </span>
    </div>
  );
};

export default PasswordStrengthBar;