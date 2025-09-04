// Cloudflare Pages Function: email via Resend
export async function onRequestPost(context) {
  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const data = await context.request.json().catch(() => ({}));
  const { name = '', company = '', email = '', phone = '', message = '' } = data;

  const apiKey = context.env.RESEND_API_KEY;
  const to = context.env.TO_EMAIL || 'crossdockW@gmail.com'; // updated default recipient
  const from = context.env.FROM_EMAIL || 'Akron Crossdock <onboarding@resend.dev>'; // replace with verified sender later

  const bodyText = [
    `Name: ${name}`,
    `Company: ${company}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    '',
    'Message:',
    message
  ].join('\n');

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject: 'New Quote Request — Akron Crossdock Warehouse', text: bodyText })
  });

  return new Response(r.ok ? 'OK' : await r.text(), { status: r.ok ? 200 : 500 });
}
