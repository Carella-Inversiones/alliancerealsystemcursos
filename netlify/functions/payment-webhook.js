const { CURSOS } = require("./_courses");

exports.handler = async (event) => {
  try {
    // Mercado Pago manda la notificación como query params (IPN clásico)
    // o como body JSON (webhooks nuevos) — cubrimos los dos casos.
    const params = event.queryStringParameters || {};
    let paymentId = params.id || params["data.id"];
    let topic = params.topic || params.type;

    if (event.body) {
      try {
        const body = JSON.parse(event.body);
        if (body.data && body.data.id) paymentId = body.data.id;
        if (body.type) topic = body.type;
      } catch (e) { /* body no era JSON, seguimos con los query params */ }
    }

    if (topic !== "payment" || !paymentId) {
      return { statusCode: 200, body: "ok" };
    }

    // Consultamos el pago real contra la API de Mercado Pago —
    // nunca confiamos en datos que vengan solo de la notificación.
    const resp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await resp.json();

    if (payment.status !== "approved") {
      return { statusCode: 200, body: "ok" };
    }

    let email, slugs;
    try {
      const decoded = JSON.parse(Buffer.from(payment.external_reference, "base64").toString("utf-8"));
      email = decoded.email;
      slugs = decoded.slugs;
    } catch (e) {
      console.error("No se pudo decodificar external_reference", e);
      return { statusCode: 200, body: "ok" };
    }

    const cursosComprados = (slugs || []).filter(s => CURSOS[s]).map(s => ({ slug: s, ...CURSOS[s] }));
    if (cursosComprados.length === 0 || !email) {
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
          <h2 style="color:#0d2440;font-weight:300;margin:0 0 14px;">¡Gracias por tu compra!</h2>
          <p style="color:#1d2733;font-size:14px;line-height:1.6;">
            Acá tenés las claves de acceso de tus cursos. Ingresalas en la sección
            "Acceso para alumnos" de cada curso, en el sitio, para descargar todos los módulos.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-top:18px;">
            <thead>
              <tr>
                <th style="text-align:left;padding:10px 14px;background:#f6f7f9;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#6b7785;">Curso</th>
                <th style="text-align:left;padding:10px 14px;background:#f6f7f9;font-size:10.5px;letter-spacing:1px;text-transform:uppercase;color:#6b7785;">Clave de acceso</th>
              </tr>
            </thead>
            <tbody>${filas}</tbody>
          </table>
          <p style="color:#6b7785;font-size:12.5px;margin-top:22px;line-height:1.5;">
            Guardá este mail — vas a necesitar estas claves cada vez que quieras descargar un módulo.
            Ante cualquier duda, respondé este correo o escribinos por WhatsApp.
          </p>
        </div>
      </div>`;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM,
        to: email,
        subject: "Tus claves de acceso — Alliance Real System",
        html
      })
    });

    return { statusCode: 200, body: "ok" };
  } catch (err) {
    console.error(err);
    // Devolvemos 200 igual: si Mercado Pago recibe error, reintenta en loop.
    return { statusCode: 200, body: "ok" };
  }
};
