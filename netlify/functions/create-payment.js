const { CURSOS, calcularTotal } = require("./_courses");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
  }

  try {
    const { items, email } = JSON.parse(event.body || "{}");

    if (!Array.isArray(items) || items.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "El carrito está vacío" }) };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { statusCode: 400, body: JSON.stringify({ error: "Ingresá un email válido" }) };
    }

    const { slugsValidos, total, esPackCompleto } = calcularTotal(items);
    if (slugsValidos.length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: "Ningún curso válido en el carrito" }) };
    }

    const siteUrl = process.env.SITE_URL || `https://${event.headers.host}`;

    // Codificamos el email + los cursos comprados en el external_reference,
    // así el webhook sabe qué mandar sin necesitar una base de datos.
    const externalRef = Buffer.from(JSON.stringify({ email, slugs: slugsValidos })).toString("base64");

    const itemsMP = esPackCompleto
      ? [{
          title: "Pack completo — 12 cursos Alliance Real System",
          quantity: 1,
          currency_id: "ARS",
          unit_price: total
        }]
      : slugsValidos.map(slug => ({
          title: CURSOS[slug].titulo,
          quantity: 1,
          currency_id: "ARS",
          unit_price: 20000
        }));

    const preference = {
      items: itemsMP,
      payer: { email },
      external_reference: externalRef,
      back_urls: {
        success: `${siteUrl}/index.html?pago=exito`,
        failure: `${siteUrl}/index.html?pago=error`,
        pending: `${siteUrl}/index.html?pago=pendiente`
      },
      auto_return: "approved",
      notification_url: `${siteUrl}/.netlify/functions/payment-webhook`
    };

    const resp = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });

    const data = await resp.json();

    if (!resp.ok) {
      console.error("Error de Mercado Pago:", data);
      return { statusCode: 500, body: JSON.stringify({ error: "No se pudo crear el pago" }) };
    }

    // Preferimos init_point (el checkout real) — solo si no viene, usamos
    // sandbox_init_point como respaldo. Antes era al revés y por eso el
    // checkout quedaba en modo Sandbox incluso con token de producción.
    const initPoint = data.init_point || data.sandbox_init_point;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ init_point: initPoint })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Error interno" }) };
  }
};
