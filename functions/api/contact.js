// functions/api/contact.js
export async function onRequestPost(context) {
  const data = await context.request.json();
  const { name, company, email, phone, message } = data;

  const apiKey = context.env.RESEND_API_KEY; // set in Cloudflare
  const to = 'operations@2010.aafl.com';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'Akron Crossdock <noreply@your-domain.com>',
      to,
      subject: 'New Quote Request',
      text:
`Name: ${name}
Company: ${company}
Email: ${email}
Phone: ${phone}

Message:
${message}`
    })
  });

  return new Response(res.ok ? 'OK' : 'Email send failed', { status: res.ok ? 200 : 500 });
}
