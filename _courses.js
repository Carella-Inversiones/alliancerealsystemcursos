// ---------------------------------------------------------------------
// Fuente única de verdad de cursos, precios y claves de acceso.
// Este archivo SOLO lo leen las functions del servidor — nunca se manda
// al navegador, así que las claves ya no quedan expuestas en el HTML.
// Para cambiar un precio o una clave, editá acá y volvé a desplegar.
// ---------------------------------------------------------------------

const PRECIO_UNITARIO = 20000; // ARS por curso individual
const PRECIO_PACK_6 = 90000; // ARS si lleva 6 cursos (o más, hasta antes de los 12)
const UMBRAL_PACK_6 = 6; // cantidad mínima de cursos para activar el precio de pack de 6
const PRECIO_PACK_COMPLETO = 120000; // ARS si compra los 12 juntos

const CURSOS = {
  "de-cero-a-agente": { titulo: "De Cero a Agente Inmobiliario", modulos: 9, bonus: false, key: "CERO2026" },
  "top-performer": { titulo: "De Agente a Top Performer", modulos: 8, bonus: false, key: "TOPPERFORMER2026" },
  "seguimiento": { titulo: "Seguimiento que Cierra", modulos: 6, bonus: false, key: "SEGUIMIENTO2026" },
  "redes": { titulo: "Redes que Venden", modulos: 8, bonus: false, key: "REDES2026" },
  "ia": { titulo: "IA para Agentes Inmobiliarios", modulos: 8, bonus: false, key: "IA2026" },
  "lenguaje": { titulo: "El Lenguaje que Vende", modulos: 6, bonus: false, key: "LENGUAJE2026" },
  "pozo": { titulo: "Vender en Pozo", modulos: 8, bonus: true, key: "POZO2026" },
  "legal-fiscal": { titulo: "Legal y Fiscal", modulos: 8, bonus: false, key: "LEGALFISCAL2026" },
  "alta-gama": { titulo: "Alta Gama: Real Estate de Lujo", modulos: 8, bonus: false, key: "ALTAGAMA2026" },
  "lotes": { titulo: "Lotes en CABA", modulos: 9, bonus: true, key: "LOTES2026" },
  "equipo": { titulo: "Armar y Liderar tu Equipo", modulos: 7, bonus: false, key: "EQUIPO2026" },
  "finanzas": { titulo: "Finanzas Personales con Ingresos Variables", modulos: 7, bonus: false, key: "FINANZAS2026" }
};

// Calcula el total real del carrito en el servidor (nunca confiar en un
// precio que venga del navegador — se podría manipular).
// Escalones: 1-5 cursos → precio individual. 6 a 11 cursos → $90.000 base
// + $20.000 por cada curso adicional arriba de 6. Los 12 completos → $120.000
// fijo (siempre conviene más que seguir sumando de a uno).
function calcularTotal(slugsPedidos) {
  const todos = Object.keys(CURSOS);
  const slugsValidos = [...new Set(slugsPedidos)].filter(s => CURSOS[s]);
  const n = slugsValidos.length;
  const esPackCompleto = n === todos.length && todos.every(s => slugsValidos.includes(s));

  let total;
  if (esPackCompleto) {
    total = PRECIO_PACK_COMPLETO;
  } else if (n >= UMBRAL_PACK_6) {
    total = PRECIO_PACK_6 + (n - UMBRAL_PACK_6) * PRECIO_UNITARIO;
  } else {
    total = n * PRECIO_UNITARIO;
  }

  return { slugsValidos, total, esPackCompleto };
}

module.exports = { CURSOS, PRECIO_UNITARIO, PRECIO_PACK_6, UMBRAL_PACK_6, PRECIO_PACK_COMPLETO, calcularTotal };
