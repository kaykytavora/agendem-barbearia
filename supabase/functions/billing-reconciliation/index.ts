import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      barbearias: {
        Row: {
          id: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          plan: 'free' | 'pro' | 'enterprise' | 'legacy'
          status: 'active' | 'grace' | 'past_due' | 'canceled' | 'trial'
          paid_until: string | null
        }
        Update: {
          plan?: 'free' | 'pro' | 'enterprise' | 'legacy'
          status?: 'active' | 'grace' | 'past_due' | 'canceled' | 'trial'
          paid_until?: string | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
        }
      }
      subscriptions: {
        Row: {
          id: string
          barbearia_id: string
          stripe_subscription_id: string | null
          stripe_customer_id: string | null
          plan: 'free' | 'pro' | 'enterprise' | 'legacy'
          status: 'active' | 'grace' | 'past_due' | 'canceled' | 'trial'
          current_period_start: string | null
          current_period_end: string | null
          trial_start: string | null
          trial_end: string | null
          canceled_at: string | null
          cancel_at_period_end: boolean
          metadata: any
        }
        Update: {
          plan?: 'free' | 'pro' | 'enterprise' | 'legacy'
          status?: 'active' | 'grace' | 'past_due' | 'canceled' | 'trial'
          current_period_start?: string | null
          current_period_end?: string | null
          trial_start?: string | null
          trial_end?: string | null
          canceled_at?: string | null
          cancel_at_period_end?: boolean
          metadata?: any
        }
      }
      reconciliation_logs: {
        Insert: {
          id?: string
          reconciliation_date: string
          total_checked: number
          inconsistencies_found: number
          inconsistencies_fixed: number
          errors: any
          execution_time_ms: number
          status: 'success' | 'partial' | 'failed'
          details: any
        }
      }
      reconciliation_issues: {
        Insert: {
          id?: string
          barbearia_id: string
          issue_type: string
          description: string
          stripe_data: any
          local_data: any
          resolved: boolean
          resolved_at?: string | null
          created_at?: string
        }
      }
    }
  }
}

interface ReconciliationIssue {
  barbeariaId: string
  issueType: string
  description: string
  stripeData: any
  localData: any
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const startTime = Date.now()
  const reconciliationDate = new Date().toISOString()
  
  try {
    // Verify authorization (should be called by cron job or admin)
    const authHeader = req.headers.get('authorization')
    const expectedToken = Deno.env.get('RECONCILIATION_SECRET_TOKEN')
    
    if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return new Response('Unauthorized', { 
        status: 401,
        headers: corsHeaders 
      })
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting billing reconciliation...')

    const issues: ReconciliationIssue[] = []
    let totalChecked = 0
    let inconsistenciesFound = 0
    let inconsistenciesFixed = 0
    const errors: any[] = []

    // Get all barbearias with Stripe data
    const { data: barbearias, error: barbeariaError } = await supabaseClient
      .from('barbearias')
      .select('id, stripe_customer_id, stripe_subscription_id, plan, status, paid_until')
      .not('stripe_customer_id', 'is', null)

    if (barbeariaError) {
      throw new Error(`Failed to fetch barbearias: ${barbeariaError.message}`)
    }

    console.log(`Found ${barbearias?.length || 0} barbearias with Stripe data`)

    // Process each barbearia
    for (const barbearia of barbearias || []) {
      try {
        totalChecked++
        
        // Skip if no Stripe customer ID
        if (!barbearia.stripe_customer_id) {
          continue
        }

        // Get customer from Stripe
        const customer = await stripe.customers.retrieve(barbearia.stripe_customer_id)
        
        if (customer.deleted) {
          issues.push({
            barbeariaId: barbearia.id,
            issueType: 'customer_deleted',
            description: 'Customer was deleted in Stripe but still referenced locally',
            stripeData: { deleted: true },
            localData: barbearia
          })
          inconsistenciesFound++
          continue
        }

        // Get subscription from Stripe if exists
        let stripeSubscription: Stripe.Subscription | null = null
        if (barbearia.stripe_subscription_id) {
          try {
            stripeSubscription = await stripe.subscriptions.retrieve(barbearia.stripe_subscription_id)
          } catch (err) {
            if (err.code === 'resource_missing') {
              issues.push({
                barbeariaId: barbearia.id,
                issueType: 'subscription_not_found',
                description: 'Subscription ID exists locally but not found in Stripe',
                stripeData: null,
                localData: barbearia
              })
              inconsistenciesFound++
              
              // Fix: Remove subscription reference and set to free plan
              await fixSubscriptionNotFound(supabaseClient, barbearia.id)
              inconsistenciesFixed++
              continue
            }
            throw err
          }
        }

        // Get local subscription data
        const { data: localSubscription } = await supabaseClient
          .from('subscriptions')
          .select('*')
          .eq('barbearia_id', barbearia.id)
          .single()

        // Compare and reconcile data
        if (stripeSubscription) {
          await reconcileSubscription(
            supabaseClient,
            barbearia,
            stripeSubscription,
            localSubscription,
            issues
          )
        } else if (localSubscription) {
          // Local subscription exists but no Stripe subscription
          issues.push({
            barbeariaId: barbearia.id,
            issueType: 'local_subscription_orphaned',
            description: 'Local subscription exists but no active Stripe subscription',
            stripeData: null,
            localData: localSubscription
          })
          inconsistenciesFound++
          
          // Fix: Set to free plan
          await fixOrphanedSubscription(supabaseClient, barbearia.id)
          inconsistenciesFixed++
        }

      } catch (error) {
        console.error(`Error processing barbearia ${barbearia.id}:`, error)
        errors.push({
          barbeariaId: barbearia.id,
          error: error.message,
          stack: error.stack
        })
      }
    }

    // Process grace period expiry
    try {
      const { data: expiredGraceResult } = await supabaseClient
        .rpc('process_grace_period_expiry')
      
      if (expiredGraceResult && expiredGraceResult > 0) {
        console.log(`Processed ${expiredGraceResult} expired grace periods`)
        inconsistenciesFixed += expiredGraceResult
      }
    } catch (error) {
      console.error('Error processing grace period expiry:', error)
      errors.push({
        operation: 'process_grace_period_expiry',
        error: error.message
      })
    }

    // Log issues found
    for (const issue of issues) {
      await supabaseClient
        .from('reconciliation_issues')
        .insert({
          barbearia_id: issue.barbeariaId,
          issue_type: issue.issueType,
          description: issue.description,
          stripe_data: issue.stripeData,
          local_data: issue.localData,
          resolved: false
        })
    }

    const executionTime = Date.now() - startTime
    const status = errors.length > 0 ? 'partial' : 'success'

    // Log reconciliation results
    await supabaseClient
      .from('reconciliation_logs')
      .insert({
        reconciliation_date: reconciliationDate,
        total_checked: totalChecked,
        inconsistencies_found: inconsistenciesFound,
        inconsistencies_fixed: inconsistenciesFixed,
        errors: errors,
        execution_time_ms: executionTime,
        status: status,
        details: {
          issues_by_type: groupIssuesByType(issues),
          processing_summary: {
            barbearias_processed: totalChecked,
            errors_count: errors.length
          }
        }
      })

    console.log('Reconciliation completed:', {
      totalChecked,
      inconsistenciesFound,
      inconsistenciesFixed,
      errorsCount: errors.length,
      executionTimeMs: executionTime
    })

    // Send alerts if there are unresolved issues
    if (inconsistenciesFound > inconsistenciesFixed) {
      await sendReconciliationAlert({
        totalChecked,
        inconsistenciesFound,
        inconsistenciesFixed,
        unresolvedIssues: inconsistenciesFound - inconsistenciesFixed,
        errors: errors.length
      })
    }

    return new Response(JSON.stringify({
      success: true,
      summary: {
        totalChecked,
        inconsistenciesFound,
        inconsistenciesFixed,
        errorsCount: errors.length,
        executionTimeMs: executionTime,
        status
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Reconciliation failed:', error)
    
    const executionTime = Date.now() - startTime
    
    // Log failure
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    await supabaseClient
      .from('reconciliation_logs')
      .insert({
        reconciliation_date: reconciliationDate,
        total_checked: 0,
        inconsistencies_found: 0,
        inconsistencies_fixed: 0,
        errors: [{ error: error.message, stack: error.stack }],
        execution_time_ms: executionTime,
        status: 'failed',
        details: { failure_reason: error.message }
      })

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function reconcileSubscription(
  supabaseClient: any,
  barbearia: any,
  stripeSubscription: Stripe.Subscription,
  localSubscription: any,
  issues: ReconciliationIssue[]
) {
  const statusMap: Record<string, string> = {
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'past_due',
    'incomplete_expired': 'canceled',
    'trialing': 'trial',
    'unpaid': 'past_due'
  }

  const stripeStatus = statusMap[stripeSubscription.status] || 'past_due'
  const stripePlan = determinePlanFromSubscription(stripeSubscription)
  
  // Check for status inconsistencies
  if (barbearia.status !== stripeStatus) {
    issues.push({
      barbeariaId: barbearia.id,
      issueType: 'status_mismatch',
      description: `Status mismatch: local=${barbearia.status}, stripe=${stripeStatus}`,
      stripeData: { status: stripeSubscription.status },
      localData: { status: barbearia.status }
    })
    
    // Fix status
    await supabaseClient
      .from('barbearias')
      .update({ status: stripeStatus })
      .eq('id', barbearia.id)
  }

  // Check for plan inconsistencies
  if (barbearia.plan !== stripePlan) {
    issues.push({
      barbeariaId: barbearia.id,
      issueType: 'plan_mismatch',
      description: `Plan mismatch: local=${barbearia.plan}, stripe=${stripePlan}`,
      stripeData: { plan: stripePlan },
      localData: { plan: barbearia.plan }
    })
    
    // Fix plan
    await supabaseClient
      .from('barbearias')
      .update({ plan: stripePlan })
      .eq('id', barbearia.id)
  }

  // Update/create local subscription
  const subscriptionData = {
    barbearia_id: barbearia.id,
    stripe_subscription_id: stripeSubscription.id,
    stripe_customer_id: stripeSubscription.customer as string,
    plan: stripePlan,
    status: stripeStatus,
    current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
    trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000).toISOString() : null,
    trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000).toISOString() : null,
    canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000).toISOString() : null,
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    metadata: stripeSubscription.metadata
  }

  await supabaseClient
    .from('subscriptions')
    .upsert(subscriptionData, { onConflict: 'barbearia_id' })
}

function determinePlanFromSubscription(subscription: Stripe.Subscription): string {
  if (subscription.items.data.length === 0) return 'free'
  
  const priceId = subscription.items.data[0].price.id
  const planMap: Record<string, string> = {
    'price_pro_monthly': 'pro',
    'price_pro_yearly': 'pro',
    'price_enterprise_monthly': 'enterprise',
    'price_enterprise_yearly': 'enterprise'
  }
  
  return planMap[priceId] || 'pro'
}

async function fixSubscriptionNotFound(supabaseClient: any, barbeariaId: string) {
  await supabaseClient
    .from('barbearias')
    .update({
      plan: 'free',
      status: 'active',
      stripe_subscription_id: null,
      paid_until: null
    })
    .eq('id', barbeariaId)

  // Remove local subscription
  await supabaseClient
    .from('subscriptions')
    .delete()
    .eq('barbearia_id', barbeariaId)
}

async function fixOrphanedSubscription(supabaseClient: any, barbeariaId: string) {
  await supabaseClient
    .from('barbearias')
    .update({
      plan: 'free',
      status: 'active',
      stripe_subscription_id: null,
      paid_until: null
    })
    .eq('id', barbeariaId)

  await supabaseClient
    .from('subscriptions')
    .delete()
    .eq('barbearia_id', barbeariaId)
}

function groupIssuesByType(issues: ReconciliationIssue[]) {
  return issues.reduce((acc, issue) => {
    acc[issue.issueType] = (acc[issue.issueType] || 0) + 1
    return acc
  }, {} as Record<string, number>)
}

async function sendReconciliationAlert(summary: any) {
  // This would integrate with your alerting system (Slack, email, etc.)
  console.log('RECONCILIATION ALERT:', {
    message: 'Billing reconciliation found unresolved issues',
    summary
  })
  
  // TODO: Implement actual alerting (Slack webhook, email service, etc.)
}