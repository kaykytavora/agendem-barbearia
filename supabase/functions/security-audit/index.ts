import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { z } from 'https://deno.land/x/zod@v3.23.8/mod.ts'

// Security: Schema validation and size limits
const MAX_PAYLOAD_SIZE = 100000; // 100KB max

const AuditLogSchema = z.object({
  operation: z.string().max(50, 'Operation name too long'),
  table_name: z.string().max(100, 'Table name too long'),
  record_id: z.string().uuid('Invalid record ID').optional(),
  old_values: z.any().optional(),
  new_values: z.any().optional()
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AuditLogEntry {
  operation: string
  table_name: string
  record_id?: string
  old_values?: any
  new_values?: any
  ip_address?: string
  user_agent?: string
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Security: Check payload size to prevent DoS
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Payload muito grande' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 413 
        }
      );
    }

    const body = JSON.parse(rawBody);
    
    // Security: Validate input schema
    const validation = AuditLogSchema.safeParse(body);
    if (!validation.success) {
      console.error('Validation error:', validation.error);
      return new Response(
        JSON.stringify({ error: 'Dados inválidos', details: validation.error.flatten() }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const { operation, table_name, record_id, old_values, new_values } = validation.data;

    // Get user info from authorization header
    const authHeader = req.headers.get('authorization')
    let user_id = null
    
    if (authHeader) {
      const { data: { user } } = await supabaseClient.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      user_id = user?.id
    }

    // Extract IP and User Agent
    const ip_address = req.headers.get('x-forwarded-for') || 
                      req.headers.get('x-real-ip') || 
                      'unknown'
    const user_agent = req.headers.get('user-agent') || 'unknown'

    // Log the audit entry
    const auditEntry: AuditLogEntry = {
      operation,
      table_name,
      record_id,
      old_values,
      new_values,
      ip_address,
      user_agent
    }

    const { error } = await supabaseClient
      .from('audit_log')
      .insert({
        user_id,
        ...auditEntry
      })

    if (error) {
      console.error('Audit log error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to log audit entry' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      )
    }

    // Check for suspicious patterns (rate limiting logic)
    const now = new Date()
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000)

    const { data: recentLogs, error: queryError } = await supabaseClient
      .from('audit_log')
      .select('id')
      .eq('ip_address', ip_address)
      .gte('created_at', fiveMinutesAgo.toISOString())

    if (queryError) {
      console.error('Query error:', queryError)
    } else if (recentLogs && recentLogs.length > 50) {
      // Alert for potential rate limit violation
      console.warn(`High activity detected from IP ${ip_address}: ${recentLogs.length} requests in 5 minutes`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Audit logged successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    console.error('Security audit error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})