import { supabase } from "@/integrations/supabase/client";
import { logSecurityAudit } from "@/utils/securityAudit";

/**
 * Security configuration and utilities
 */

// Security constants
export const SECURITY_CONFIG = {
  // Password requirements
  MIN_PASSWORD_LENGTH: 8,
  REQUIRE_UPPERCASE: true,
  REQUIRE_LOWERCASE: true,
  REQUIRE_NUMBERS: true,
  REQUIRE_SPECIAL_CHARS: true,
  
  // Session security
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  IDLE_TIMEOUT: 2 * 60 * 60 * 1000, // 2 hours
  
  // Rate limiting
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_COOLDOWN: 15 * 60 * 1000, // 15 minutes
  
  // Data access
  MAX_RECORDS_PER_QUERY: 100,
  SENSITIVE_TABLES: ['profiles', 'agendamentos', 'feedbacks', 'assinaturas']
} as const;

/**
 * Validates password strength according to security policy
 */
export const validatePasswordStrength = (password: string): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (password.length < SECURITY_CONFIG.MIN_PASSWORD_LENGTH) {
    errors.push(`Password must be at least ${SECURITY_CONFIG.MIN_PASSWORD_LENGTH} characters long`);
  }

  if (SECURITY_CONFIG.REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  if (SECURITY_CONFIG.REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  if (SECURITY_CONFIG.REQUIRE_NUMBERS && !/\d/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  if (SECURITY_CONFIG.REQUIRE_SPECIAL_CHARS && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

/**
 * Sanitizes user input to prevent XSS and injection attacks
 */
export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

/**
 * Checks if current session is valid and not expired
 */
export const validateSession = async (): Promise<boolean> => {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      return false;
    }

    // Check if session is expired
    const now = Date.now();
    const sessionCreated = new Date(session.user.created_at).getTime();
    
    if (now - sessionCreated > SECURITY_CONFIG.SESSION_TIMEOUT) {
      await supabase.auth.signOut();
      return false;
    }

    return true;
  } catch (error) {
    console.error('Session validation error:', error);
    return false;
  }
};

/**
 * Logs security events for monitoring
 */
export const logSecurityEvent = async (event: string, details?: any) => {
  try {
    await logSecurityAudit({
      operation: `security_event_${event}`,
      table_name: 'security_events',
      new_values: { event, details, timestamp: new Date().toISOString() }
    });
  } catch (error) {
    console.error('Security event logging failed:', error);
  }
};

/**
 * Validates that user has permission for a specific operation
 */
export const validatePermission = async (
  operation: string, 
  resource?: string,
  resourceId?: string
): Promise<boolean> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      await logSecurityEvent('unauthorized_access_attempt', { operation, resource });
      return false;
    }

    // Get user role from profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, barbearia_id')
      .eq('user_id', session.user.id)
      .single();

    if (!profile) {
      await logSecurityEvent('invalid_user_profile', { user_id: session.user.id });
      return false;
    }

    // Permission validation logic based on operation and role
    const hasPermission = validateRolePermission(operation, profile.role, resource);
    
    if (!hasPermission) {
      await logSecurityEvent('permission_denied', { 
        operation, 
        resource, 
        user_role: profile.role,
        user_id: session.user.id 
      });
    }

    return hasPermission;
  } catch (error) {
    console.error('Permission validation error:', error);
    await logSecurityEvent('permission_validation_error', { operation, error: (error as Error).message });
    return false;
  }
};

/**
 * Validates role-based permissions
 */
const validateRolePermission = (operation: string, role: string, resource?: string): boolean => {
  const permissions = {
    admin: ['*'], // Admin has all permissions
    funcionario: [
      'view_agendamentos',
      'update_agendamentos', 
      'view_clientes',
      'manage_servicos',
      'view_reports'
    ],
    cliente: [
      'view_own_agendamentos',
      'create_agendamentos',
      'view_barbearias',
      'view_servicos'
    ]
  };

  const userPermissions = permissions[role as keyof typeof permissions] || [];
  
  return userPermissions.includes('*') || userPermissions.includes(operation);
};