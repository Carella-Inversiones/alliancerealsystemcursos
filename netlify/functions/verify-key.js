const { CURSOS } = require("./_courses");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Método no permitido" }) };
  }

  try {
    const { slug, key } = JSON.parse(event.body || "{}");
    const curso = CURSOS[slug];

    if (!curso) {
      return { statusCode: 200, body: JSON.stringify({ valid: false }) };
    }

    const valid = (key || "").trim().toUpperCase() === curso.key;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        valid,
        modulos: valid ? curso.modulos : undefined,
        bonus: valid ? curso.bonus : undefined
      })
    };
  } catch (err) {
    return { statusCode: 200, body: JSON.stringify({ valid: false }) };
  }
};
