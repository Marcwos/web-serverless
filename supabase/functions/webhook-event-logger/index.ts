// =====================================================
// EDGE FUNCTION 1: WEBHOOK EVENT LOGGER (SIMPLIFIED)
// Responsabilidades:
// - Validar firma HMAC-SHA256
// - Loguear eventos recibidos
// - Guardar en DB si las tablas existen
// =====================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp',
};

// =====================================================
// VALIDACIÓN DE FIRMA HMAC-SHA256
// =====================================================
async function validateSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const receivedHash = signature.replace('sha256=', '');
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(body);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', key, messageData);
    const expectedHash = Array.from(new Uint8Array(signatureBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    // Comparación simple (en producción usar timing-safe)
    return receivedHash === expectedHash;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

// =====================================================
// HANDLER PRINCIPAL
// =====================================================
Deno.serve(async (req) => {
  // Manejar preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // =============== 1. EXTRAER HEADERS Y BODY ===============
    const signature = req.headers.get('x-webhook-signature');
    const timestamp = req.headers.get('x-webhook-timestamp');
    const bodyText = await req.text();

    console.log('📥 Webhook received:', {
      hasSignature: !!signature,
      hasTimestamp: !!timestamp,
      bodyLength: bodyText.length,
    });

    // =============== 2. VALIDACIONES INICIALES ===============
    if (!signature || !timestamp) {
      console.error('❌ Missing headers');
      return new Response(
        JSON.stringify({ error: 'Missing required headers' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // =============== 3. VALIDAR FIRMA HMAC ===============
    const secret = Deno.env.get('WEBHOOK_SECRET');
    if (!secret) {
      console.error('❌ WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isValidSignature = await validateSignature(bodyText, signature, secret);
    if (!isValidSignature) {
      console.error('❌ Invalid signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Signature validated');

    // =============== 4. PARSEAR PAYLOAD ===============
    const payload = JSON.parse(bodyText);
    const { event, id, idempotency_key, data, metadata } = payload;

    console.log('📋 Event details:', {
      event,
      id,
      idempotency_key,
      data,
    });

    // =============== 5. INTENTAR GUARDAR EN DB (OPCIONAL) ===============
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        // Intentar guardar el evento
        const { error: eventError } = await supabase.from('webhook_events').insert({
          event_id: id,
          event_type: event,
          idempotency_key,
          payload: payload,
          metadata,
          received_at: new Date().toISOString(),
          processed_at: new Date().toISOString(),
        });

        if (eventError) {
          console.warn('⚠️ Could not save to DB (table may not exist):', eventError.message);
        } else {
          console.log('✅ Event saved to database');
        }
      }
    } catch (dbError) {
      console.warn('⚠️ Database operation failed:', dbError.message);
      // No fallar la función por errores de DB
    }

    // =============== 6. RESPONDER SUCCESS ===============
    console.log('✅ Webhook processed successfully');
    return new Response(
      JSON.stringify({
        message: 'Webhook processed successfully',
        event_id: id,
        event_type: event,
        processed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
