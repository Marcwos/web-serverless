// =====================================================
// EDGE FUNCTION 2: WEBHOOK EXTERNAL NOTIFIER (SIMPLIFIED)
// Responsabilidades:
// - Validar firma HMAC-SHA256
// - Enviar notificación a Telegram
// =====================================================

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

    return receivedHash === expectedHash;
  } catch (error) {
    console.error('Error validating signature:', error);
    return false;
  }
}

// =====================================================
// ENVIAR NOTIFICACIÓN A TELEGRAM
// =====================================================
async function sendTelegramNotification(
  token: string,
  chatId: string,
  payload: any
): Promise<{ success: boolean; error?: string }> {
  try {
    const { event, id, timestamp, data } = payload;

    // Formatear mensaje bonito
    let message = `🔔 *Evento Webhook Recibido*\n\n`;
    message += `📋 *Tipo:* \`${event}\`\n`;
    message += `🆔 *ID:* \`${id}\`\n`;
    message += `🕒 *Timestamp:* ${new Date(timestamp).toLocaleString('es-EC')}\n\n`;
    message += `📦 *Datos:*\n`;

    // Mostrar datos del evento
    if (data && typeof data === 'object') {
      for (const [key, value] of Object.entries(data)) {
        message += `  • *${key}:* ${value}\n`;
      }
    }

    const telegramUrl = `https://api.telegram.org/bot${token}/sendMessage`;

    console.log('📤 Sending to Telegram...');
    
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Telegram API error:', errorData);
      return { success: false, error: errorData };
    }

    console.log('✅ Telegram notification sent successfully');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending Telegram notification:', error);
    return { success: false, error: error.message };
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

    console.log('📥 Webhook received for notification:', {
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
    console.log('📋 Payload:', JSON.stringify(payload, null, 2));

    // =============== 5. ENVIAR NOTIFICACIÓN A TELEGRAM ===============
    const telegramToken = Deno.env.get('TELEGRAM_TOKEN');
    const telegramChatId = Deno.env.get('TELEGRAM_CHAT_ID');

    if (!telegramToken || !telegramChatId) {
      console.warn('⚠️ Telegram credentials not configured');
      return new Response(
        JSON.stringify({
          message: 'Webhook processed but Telegram not configured',
          event_id: payload.id,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const notificationResult = await sendTelegramNotification(
      telegramToken,
      telegramChatId,
      payload
    );

    // =============== 6. RESPONDER ===============
    if (notificationResult.success) {
      return new Response(
        JSON.stringify({
          message: 'Webhook processed and notification sent',
          event_id: payload.id,
          event_type: payload.event,
          notification_sent: true,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({
          message: 'Webhook processed but notification failed',
          event_id: payload.id,
          error: notificationResult.error,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('❌ Error processing webhook:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
