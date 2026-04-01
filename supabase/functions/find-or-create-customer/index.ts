import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Normaliza um número de telefone para formato E.164
 * @param phone - Número de telefone bruto
 * @returns Número normalizado no formato E.164 ou null se inválido
 */
function normalizePhoneToE164(phone: string): string | null {
  if (!phone) return null;
  
  // Remove todos os caracteres não numéricos
  const digitsOnly = phone.replace(/\D/g, '');
  
  // Validação básica de comprimento (10-15 dígitos)
  if (digitsOnly.length < 10 || digitsOnly.length > 15) {
    return null;
  }
  
  // Se já tem código do país (+55), use como está
  if (digitsOnly.length === 13 && digitsOnly.startsWith('55')) {
    return `+${digitsOnly}`;
  }
  
  // Se tem 11 dígitos (formato brasileiro), adicione +55
  if (digitsOnly.length === 11) {
    return `+55${digitsOnly}`;
  }
  
  // Se tem 10 dígitos (formato brasileiro sem 9), adicione +55 e o 9
  if (digitsOnly.length === 10) {
    const ddd = digitsOnly.substring(0, 2);
    const numero = digitsOnly.substring(2);
    return `+55${ddd}9${numero}`;
  }
  
  // Para outros formatos, assume que já tem código do país
  return `+${digitsOnly}`;
}

interface RequestBody {
  phone_raw: string;
  name: string;
  otp_verified?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { phone_raw, name, otp_verified = false }: RequestBody = await req.json();

    if (!phone_raw || !name) {
      return new Response(
        JSON.stringify({ error: 'phone_raw and name are required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Normalizar telefone para E.164
    const phone_normalized = normalizePhoneToE164(phone_raw);
    
    if (!phone_normalized) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log(`[find-or-create-customer] Processing phone: ${phone_raw} -> ${phone_normalized}`);

    // Verificar se customer já existe
    const { data: existingCustomer, error: selectError } = await supabaseClient
      .from('customers')
      .select('id, phone_e164, name, verified_at')
      .eq('phone_e164', phone_normalized)
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('[find-or-create-customer] Error checking existing customer:', selectError);
      return new Response(
        JSON.stringify({ error: 'Database error while checking customer' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    if (existingCustomer) {
      console.log(`[find-or-create-customer] Found existing customer: ${existingCustomer.id}`);
      
      // Atualizar dados se necessário
      const updates: any = {};
      if (existingCustomer.name !== name) {
        updates.name = name;
      }
      if (otp_verified && !existingCustomer.otp_verified) {
        updates.otp_verified = true;
      }

      if (Object.keys(updates).length > 0) {
        const { error: updateError } = await supabaseClient
          .from('customers')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', existingCustomer.id);

        if (updateError) {
          console.error('[find-or-create-customer] Error updating customer:', updateError);
        } else {
          console.log(`[find-or-create-customer] Updated customer: ${existingCustomer.id}`);
        }
      }

      return new Response(
        JSON.stringify({ 
          customer_id: existingCustomer.id,
          phone_normalized,
          found_existing: true
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    // Criar novo customer
    const { data: newCustomer, error: insertError } = await supabaseClient
      .from('customers')
      .insert({
        phone_normalized,
        name,
        otp_verified
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[find-or-create-customer] Error creating customer:', insertError);
      return new Response(
        JSON.stringify({ error: 'Failed to create customer' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500 
        }
      );
    }

    console.log(`[find-or-create-customer] Created new customer: ${newCustomer.id}`);

    return new Response(
      JSON.stringify({ 
        customer_id: newCustomer.id,
        phone_normalized,
        found_existing: false
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201 
      }
    );

  } catch (error) {
    console.error('[find-or-create-customer] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});