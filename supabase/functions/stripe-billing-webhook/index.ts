import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
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
        Insert: {
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: 'free' | 'pro' | 'enterprise' | 'legacy'
          status?: 'active' | 'grace' | 'past_due' | 'canceled' | 'trial'
          paid_until?: string | null
        }
        Update: {
          id?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          plan?: 'free' | 'pro' | 'enterprise' | 'legacy'
          status?: 'active' | 'grace' | 'past_due' | 'canceled' | 'trial'
          paid_until?: string | null
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
        Insert: {
          id?: string
          barbearia_id: string
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
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
        Update: {
          id?: string
          barbearia_id?: string
          stripe_subscription_id?: string | null
          stripe_customer_id?: string | null
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
      subscription_events: {
        Row: {
          id: string
          subscription_id: string | null
          barbearia_id: string
          event_id: string
          event_type: string
          stripe_event_id: string | null
          data: any
          processed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id?: string | null
          barbearia_id: string
          event_id: string
          event_type: string
          stripe_event_id?: string | null
          data?: any
          processed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string | null
          barbearia_id?: string
          event_id?: string
          event_type?: string
          stripe_event_id?: string | null
          data?: any
          processed_at?: string
          created_at?: string
        }
      }
    }
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    })

    // Initialize Supabase
    const supabaseClient = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify webhook signature
    const signature = req.headers.get('stripe-signature')
    const body = await req.text()
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

    if (!signature || !webhookSecret) {
      console.error('Missing signature or webhook secret')
      return new Response('Webhook signature verification failed', { 
        status: 400,
        headers: corsHeaders 
      })
    }

    let event: Stripe.Event
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response('Webhook signature verification failed', { 
        status: 400,
        headers: corsHeaders 
      })
    }

    console.log('Processing webhook event:', event.type, 'ID:', event.id)

    // Check for idempotency - if event already processed, return success
    const { data: existingEvent } = await supabaseClient
      .from('subscription_events')
      .select('id')
      .eq('event_id', event.id)
      .single()

    if (existingEvent) {
      console.log('Event already processed:', event.id)
      return new Response('Event already processed', { 
        status: 200,
        headers: corsHeaders 
      })
    }

    // Process different event types
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionEvent(supabaseClient, event)
        break

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(supabaseClient, event)
        break

      case 'invoice.payment_failed':
        await handlePaymentFailed(supabaseClient, event)
        break

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(supabaseClient, event)
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return new Response('Webhook processed successfully', { 
      status: 200,
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Webhook processing error:', error)
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    })
  }
})

async function handleSubscriptionEvent(
  supabaseClient: any,
  event: Stripe.Event
) {
  const subscription = event.data.object as Stripe.Subscription
  
  // Find barbearia by customer ID
  const { data: barbearia } = await supabaseClient
    .from('barbearias')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (!barbearia) {
    console.error('Barbearia not found for customer:', subscription.customer)
    return
  }

  // Map Stripe status to our status
  const statusMap: Record<string, string> = {
    'active': 'active',
    'past_due': 'past_due',
    'canceled': 'canceled',
    'incomplete': 'past_due',
    'incomplete_expired': 'canceled',
    'trialing': 'trial',
    'unpaid': 'past_due'
  }

  const status = statusMap[subscription.status] || 'past_due'
  
  // Determine plan from price ID or metadata
  let plan = 'free'
  if (subscription.items.data.length > 0) {
    const priceId = subscription.items.data[0].price.id
    // Map price IDs to plans (configure these in your Stripe dashboard)
    const planMap: Record<string, string> = {
      'price_pro_monthly': 'pro',
      'price_pro_yearly': 'pro',
      'price_enterprise_monthly': 'enterprise',
      'price_enterprise_yearly': 'enterprise'
    }
    plan = planMap[priceId] || 'pro'
  }

  // Upsert subscription record
  const subscriptionData = {
    barbearia_id: barbearia.id,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    plan: plan as any,
    status: status as any,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000).toISOString() : null,
    trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
    cancel_at_period_end: subscription.cancel_at_period_end,
    metadata: subscription.metadata
  }

  await supabaseClient
    .from('subscriptions')
    .upsert(subscriptionData, { 
      onConflict: 'barbearia_id',
      ignoreDuplicates: false 
    })

  // Log event
  await logSubscriptionEvent(
    supabaseClient,
    barbearia.id,
    event.id,
    event.type,
    event.id,
    event.data.object
  )

  console.log('Subscription updated for barbearia:', barbearia.id, 'Status:', status)
}

async function handlePaymentSucceeded(
  supabaseClient: any,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice
  
  if (!invoice.subscription) {
    console.log('Invoice not related to subscription, skipping')
    return
  }

  // Find barbearia by customer ID
  const { data: barbearia } = await supabaseClient
    .from('barbearias')
    .select('id')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (!barbearia) {
    console.error('Barbearia not found for customer:', invoice.customer)
    return
  }

  // Update subscription to active and reset failure count
  await supabaseClient
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_end: new Date(invoice.period_end * 1000).toISOString()
    })
    .eq('barbearia_id', barbearia.id)

  // Reset payment failure count in barbearias
  await supabaseClient
    .from('barbearias')
    .update({
      payment_failures_count: 0,
      last_payment_attempt: new Date().toISOString()
    })
    .eq('id', barbearia.id)

  // Log event
  await logSubscriptionEvent(
    supabaseClient,
    barbearia.id,
    event.id,
    'invoice_paid',
    event.id,
    invoice
  )

  console.log('Payment succeeded for barbearia:', barbearia.id)
}

async function handlePaymentFailed(
  supabaseClient: any,
  event: Stripe.Event
) {
  const invoice = event.data.object as Stripe.Invoice
  
  if (!invoice.subscription) {
    console.log('Invoice not related to subscription, skipping')
    return
  }

  // Find barbearia by customer ID
  const { data: barbearia } = await supabaseClient
    .from('barbearias')
    .select('id, payment_failures_count')
    .eq('stripe_customer_id', invoice.customer)
    .single()

  if (!barbearia) {
    console.error('Barbearia not found for customer:', invoice.customer)
    return
  }

  const failureCount = (barbearia.payment_failures_count || 0) + 1
  
  // Determine status based on failure count
  let newStatus = 'past_due'
  if (failureCount <= 3) {
    newStatus = 'grace' // Grace period for first 3 failures
  }

  // Update subscription status
  await supabaseClient
    .from('subscriptions')
    .update({ status: newStatus as any })
    .eq('barbearia_id', barbearia.id)

  // Update failure count and set grace period
  const graceEndDate = new Date()
  graceEndDate.setDate(graceEndDate.getDate() + 7) // 7 days grace period

  await supabaseClient
    .from('barbearias')
    .update({
      payment_failures_count: failureCount,
      last_payment_attempt: new Date().toISOString(),
      grace_period_ends_at: newStatus === 'grace' ? graceEndDate.toISOString() : null
    })
    .eq('id', barbearia.id)

  // Log event
  await logSubscriptionEvent(
    supabaseClient,
    barbearia.id,
    event.id,
    'invoice_payment_failed',
    event.id,
    invoice
  )

  console.log('Payment failed for barbearia:', barbearia.id, 'Failure count:', failureCount, 'Status:', newStatus)
}

async function handleTrialWillEnd(
  supabaseClient: any,
  event: Stripe.Event
) {
  const subscription = event.data.object as Stripe.Subscription
  
  // Find barbearia by customer ID
  const { data: barbearia } = await supabaseClient
    .from('barbearias')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single()

  if (!barbearia) {
    console.error('Barbearia not found for customer:', subscription.customer)
    return
  }

  // Log event for trial ending notification
  await logSubscriptionEvent(
    supabaseClient,
    barbearia.id,
    event.id,
    'trial_will_end',
    event.id,
    subscription
  )

  console.log('Trial will end for barbearia:', barbearia.id)
}

async function logSubscriptionEvent(
  supabaseClient: any,
  barbeariaId: string,
  eventId: string,
  eventType: string,
  stripeEventId: string,
  data: any
) {
  // Get subscription ID if exists
  const { data: subscription } = await supabaseClient
    .from('subscriptions')
    .select('id')
    .eq('barbearia_id', barbeariaId)
    .single()

  await supabaseClient
    .from('subscription_events')
    .insert({
      subscription_id: subscription?.id || null,
      barbearia_id: barbeariaId,
      event_id: eventId,
      event_type: eventType,
      stripe_event_id: stripeEventId,
      data: data
    })
}