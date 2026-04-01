import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from "https://esm.sh/stripe@10.17.0?target=deno"

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") as string, {
  apiVersion: "2022-11-15",
  httpClient: Stripe.createFetchHttpClient(),
})

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
)

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature")
  const body = await req.text()

  let receivedEvent
  try {
    receivedEvent = await stripe.webhooks.constructEventAsync(
      body,
      signature!,
      Deno.env.get("STRIPE_WEBHOOK_SIGNING_SECRET")!
    )
  } catch (err) {
    return new Response(err.message, { status: 400 })
  }

  const { data: { object: eventData } } = receivedEvent
  const { id: provider_event_id, object: event_type } = receivedEvent

  // Extrair o ID da barbearia dos metadados
  const barbearia_id = eventData.metadata?.barbearia_id;
  if (!barbearia_id) {
    return new Response("barbearia_id is missing in metadata", { status: 400 });
  }

  // Inserir o evento na tabela subscription_events para idempotência e log
  const { error: eventError } = await supabase
    .from('subscription_events')
    .insert({
      barbearia_id,
      provider_event_id,
      event_type,
      payload: eventData,
    });

  if (eventError && eventError.code === '23505') { // Chave duplicada (idempotência)
    console.log("Webhook event already processed:", provider_event_id);
    return new Response("Webhook event already processed", { status: 200 });
  } else if (eventError) {
    console.error("Error saving webhook event:", eventError);
    return new Response("Error saving webhook event", { status: 500 });
  }

  // Lógica para tratar diferentes tipos de eventos
  switch (event_type) {
    case 'invoice.paid':
      await updateSubscriptionStatus(barbearia_id, 'active', eventData.lines.data[0].plan.id, eventData.lines.data[0].period.end);
      break;
    case 'invoice.payment_failed':
      await updateSubscriptionStatus(barbearia_id, 'past_due');
      break;
    case 'customer.subscription.deleted':
      await updateSubscriptionStatus(barbearia_id, 'canceled');
      break;
    // Adicionar outros casos de evento aqui (ex: trial_started, etc.)
    default:
      console.log(`Unhandled event type ${event_type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  })
})

async function updateSubscriptionStatus(barbearia_id: string, status: string, plan?: string, paid_until?: number) {
  const updateData: { status: string; plan?: string; paid_until?: string } = { status };

  if (plan) {
    updateData.plan = plan;
  }
  if (paid_until) {
    updateData.paid_until = new Date(paid_until * 1000).toISOString();
  }

  const { error } = await supabase
    .from('barbearias')
    .update(updateData)
    .eq('id', barbearia_id);

  if (error) {
    console.error(`Error updating barbearia ${barbearia_id} to ${status}:`, error);
  } else {
    console.log(`Barbearia ${barbearia_id} updated to ${status}`);
  }
}