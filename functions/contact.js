// functions/contact.js
// Cloudflare Pages Function: email via Resend (with CORS, validation, multi-format parsing)

const CORS = {
  'Access-Control-Allow-Origin': '*', // lock to your domain if desired
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

// --- Utils ---
const clamp = (str = '', max = 500) =>
  String(str).toString().slice(0, max).trim();

const isEmail = (s = '') =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const cleanPhone = (s = '') =>
  s.replace(/[^\d+(). -]/g, '').trim();

async function parseBody(req) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    try { return await req.json(); } catch { return {}; }
  }
  if (ct.includes('application/x-www-form-urlencoded')) {
    const txt = await req.text();
    return Object.fromEntries(new URLSearchParams(txt));
  }
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    return Object.fromEntries([...fd.entries()]);
  }
  // fallback: try json then urlencoded
  try { return await req.json(); } catch {}
  const txt = await req.text();
  try { return Object.fromEntries(new URLSearchParams(txt)); } catch { return {}; }
}

function htmlEscape(s = '') {
  return s.replace(/[&<>"']/g, c => (
    { '&':'&nbsp;&', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  )).replace('&nbsp;&', '&amp;');
}

function buildBodies({ name, company, email, phone, message }) {
  const lines = [
    `Name: ${name}`,
    `Company: ${company}`,
    `Email: ${email}`,
    `Phone: ${phone}`,
    '',
    'Message:',
    message
  ];
  const text = lines.join('\n');

  const html = `
    <table style="font:14px/1.4 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#111">
      <tr><td style="padding:0 0 6px"><strong>Name:</strong> ${htmlEscape(name)}</td></tr>
      <tr><td style="padding:0 0 6px"><strong>Company:</strong> ${htmlEscape(company)}</td></tr>
      <tr><td style="padding:0 0 6px"><strong>Email:</strong> ${htmlEscape(email)}</td></tr>
      <tr><td style="padding:0 0 6px"><strong>Phone:</strong> ${htmlEscape(phone)}</td></tr>
      <tr><td style="padding:10px 0 0"><strong>Message:</strong><br>${htmlEscape(message).replace(/\n/g,'<br>')}</td></tr>
    </table>
  `.trim();

  return { text, html };
}

// --- Preflight (OPTIONS) ---
export function onRequestOptions() {
  return new Response('', { status: 204, headers: CORS });
}

// --- POST handler ---
export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    // Parse incoming body
    const data = await parseBody(request);

    // Extract + sanitize with safe caps
    let {
      name = '',
      company = '',
      email = '',
      phone = '',
      message = ''
    } = data;

    name = clamp(name, 120);
    company = clamp(company, 120);
    email = clamp(email, 160);
    phone = clamp(cleanPhone(phone), 40);
    message = clamp(message || 'No message provided.', 5000);

    // Basic validation (email optional but recommended)
    if (!name) {
      return new Response(JSON.stringify({ ok:false, error:'Missing name' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }
    if (email && !isEmail(email)) {
      return new Response(JSON.stringify({ ok:false, error:'Invalid email format' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Env vars
    const apiKey = env.RESEND_API_KEY;
    const to = env.TO_EMAIL || 'crossdockW@gmail.com';
    const from = env.FROM_EMAIL || 'Akron Crossdock <onboarding@resend.dev>'; // replace with your verified sender

    if (!apiKey) {
      return new Response(JSON.stringify({ ok:false, error:'Missing RESEND_API_KEY' }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } });
    }

    // Build email bodies
    const subject = 'New Quote Request — Akron Crossdock Warehouse';
    const { text, html } = buildBodies({ name, company, email, phone, message });

    // Send via Resend
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,                        // string or array is fine
        subject,
        text,
        html,
        reply_to: email || undefined // so you can reply directly to the sender
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      return new Response(JSON.stringify({ ok:false, error:'Resend error', detail: errText }), {
        status: 502,
        headers: { ...CORS, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ ok:true }), {
      status: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ ok:false, error:'Server error', detail: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    });
  }
}
