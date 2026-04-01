import { supabase } from "@/integrations/supabase/client";

interface AuditLogData {
  operation: string;
  table_name: string;
  record_id?: string;
  old_values?: any;
  new_values?: any;
}

/**
 * Logs security-sensitive operations for audit purposes
 */
export const logSecurityAudit = async (data: AuditLogData) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Call the security audit edge function
    const { error } = await supabase.functions.invoke('security-audit', {
      body: data,
      headers: {
        Authorization: `Bearer ${session?.access_token || ''}`,
      },
    });

    if (error) {
      console.error('Security audit logging failed:', error);
    }
  } catch (error) {
    console.error('Security audit error:', error);
  }
};

/**
 * Validates that sensitive operations are performed securely
 */
export const validateSecureOperation = (operation: string, user_role?: string): boolean => {
  const sensitiveOperations = [
    'user_deletion',
    'role_change',
    'barbershop_deletion',
    'financial_data_access',
  ];

  if (sensitiveOperations.includes(operation)) {
    if (!user_role || user_role !== 'admin') {
      console.warn(`Unauthorized attempt to perform sensitive operation: ${operation}`);
      return false;
    }
  }

  return true;
};

/**
 * Rate limiting check for sensitive operations
 */
export const checkRateLimit = (operation: string): boolean => {
  const key = `rate_limit_${operation}`;
  const lastAttempt = localStorage.getItem(key);
  const now = Date.now();

  if (lastAttempt) {
    const timeDiff = now - parseInt(lastAttempt);
    const cooldownPeriod = 60000; // 1 minute cooldown for sensitive operations

    if (timeDiff < cooldownPeriod) {
      console.warn(`Rate limit exceeded for operation: ${operation}`);
      return false;
    }
  }

  localStorage.setItem(key, now.toString());
  return true;
};