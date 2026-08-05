const { CURSOS } = require("./_courses");

exports.handler = async (event) => {
  try {
    console.log("Webhook invocado. Query:", JSON.stringify(event.queryStringParameters));

    const params = event.queryStringParameters || {};
    let paymentId = params.id || params["data.id"];
    let topic = params.topic || params.type;

    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        console.log("Body recibido:", event.body);
        if (body.data && body.data.id) paymentId = body.data.id;
        if (body.type) topic = body.type;
      } catch (e) { /* body no era JSON, seguimos con los query params */ }
    }

    console.log(`topic=${topic} paymentId=${paymentId}`);

    if (topic !== "payment" || !paymentId) {
      console.log("Se ignora: no es notificación de tipo 'payment' o falta el id.");
      return { statusCode: 200, body: "ok" };
    }

    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await resp.json();
    console.log(`Pago consultado. status=${payment.status} external_reference=${payment.external_reference}`);

    if (payment.status !== "approved") {
      console.log("Se ignora: el pago todavía no está aprobado.");
      return { statusCode: 200, body: "ok" };
    }

    let email, slugs;
    try {
      const decoded = JSON.parse(Buffer.from(payment.external_reference, "base64").toString("utf-8"));
      email = decoded.email;
      slugs = decoded.slugs;
      console.log(`Decodificado OK. email=${email} slugs=${JSON.stringify(slugs)}`);
    } catch (e) {
      console.error("No se pudo decodificar external_reference:", e.message);
      return { statusCode: 200, body: "ok" };
    }

    const cursosComprados = (slugs || []).filter(s => CURSOS[s]).map(s => ({ slug: s, ...CURSOS[s] }));
    if (cursosComprados.length === 0 || !email) {
      console.log("Se ignora: no hay cursos válidos o falta el email.");
      return { statusCode: 200, body: "ok" };
    }

    const filas = cursosComprados.map(c => `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e6ea;font-size:13px;color:#1d2733;">${c.titulo}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2e6ea;font-family:monospace;font-weight:bold;color:#0d2440;font-size:13px;">${c.key}</td>
      </tr>`).join("");

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;">
        <div style="background:#0d2440;padding:24px;text-align:center;">
          <span style="color:#b5894e;font-size:12px;letter-spacing:3px;text-transform:uppercase;">Alliance Real System</span>
        </div>
        <div style="padding:28px 24px;">
          <h2 style="color:#0d2440;font-weight:300;margin:0 0 14px;">Nueva compra confirmada</h2>
          <p style="color:#1d2733;font-size:14px;line-height:1.6;">
            <strong>Comprador:</strong> ${email}<br>
            <strong>Monto pagado:</strong> $${(payment.transaction_amount || 0).toLocaleString('es-AR')} ARS<br>
            <strong>ID de pago (Mercado Pago):</strong> ${payment.id}
          </p>
          <p style="color:#1d2733;font-size:14px;line-height:1.6;margin-top:14px;">
            Verificá que el pago esté acreditado en tu cuenta de Mercado Pago, y después mandale
            al comprador las claves de los cursos que figuran abajo.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-top:16px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:10px 14px;background:#f6f7f9;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#6b7785;">Curso</th>
                <th style="text-align:left;padding:10px 14px;background:#f6f7f9;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#6b7785;">Clave de acceso</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
        </div>
      </div>`;

    console.log(`Mandando mail a ${process.env.ADMIN_EMAIL} sobre compra de ${email}...`);

    const resendResp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "Alliance Real System <onboarding@resend.dev>",
        to: process.env.ADMIN_EMAIL,
        subject: `Nueva compra — ${email}`,
        html
      })
    });
    const resendData = await resendResp.json();
    console.log(`Respuesta de Resend (status ${resendResp.status}):`, JSON.stringify(resendData));

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error(err);
    // Devolvemos 200 igual: si Mercado Pago recibe error, reintenta en loop.
    return { statusCode: 200, body: "ok" };
  }
};
