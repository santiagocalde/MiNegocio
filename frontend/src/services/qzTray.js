/* eslint-disable no-unused-vars, no-undef */
/**
 * QZ Tray Service - MiNegocio POS
 * 
 * Maneja la conexión WebSocket con QZ Tray para:
 * - Abrir cajón de dinero (ESC/POS)
 * - Imprimir tickets en ticketera térmica
 * 
 * QZ Tray debe estar instalado en la PC del kiosco:
 *   https://qz.io/download/
 */

const QZ_HOST = 'localhost';
const QZ_PORT = 8181;
const QZ_SIGNATURE = null; // Se requiere certificado en producción

let qzConnected = false;
let qzAvailable = false;

/**
 * Intenta conectar con QZ Tray vía WebSocket
 * Falls back silenciosamente si no está disponible
 */
export async function connectQZTray(timeout = 3000) {
  if (qzConnected) return true;

  // Verificar que qz-tray está cargado
  if (typeof qz === 'undefined') {
    qzAvailable = false;
    return false;
  }

  try {
    const connectPromise = qz.websocket.connect({
      host: QZ_HOST,
      port: QZ_PORT,
      keepAlive: 30,
    });
    const result = await Promise.race([
      connectPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
    ]);
    qzConnected = true;
    qzAvailable = true;
    return true;
  } catch (err) {
    qzConnected = false;
    qzAvailable = false;
    return false;
  }
}

/**
 * Desconecta QZ Tray
 */
export async function disconnectQZTray() {
  if (!qzConnected) return;
  try {
    await qz.websocket.disconnect();
  } catch { /* ignorar */ }
  qzConnected = false;
}

/**
 * Abre el cajón de dinero
 * Envía comando ESC/POS 0x1B 0x70 0x00 0x19 0xFA
 */
export async function openCashDrawer(printerName = null) {
  if (!qzAvailable || !qzConnected) {
    throw new Error('QZ Tray no está conectado');
  }

  let printer;
  if (printerName) {
    printer = await qz.printers.find(printerName);
  } else {
    printer = await qz.printers.getDefault();
  }

  if (!printer) {
    throw new Error('No se encontró impresora térmica');
  }

  const config = qz.configs.create(printer);
  const escpos = '\x1B\x70\x00\x19\xFA'; // Abrir cajón
  await qz.printing.print(config, escpos);

  return { printer: printer.name || printer };
}

/**
 * Imprime un ticket en la ticketera térmica
 * @param {string} text - Texto plano del ticket (80mm)
 * @param {string|null} printerName - Nombre de impresora específica
 */
export async function printTicket(text, printerName = null) {
  if (!qzAvailable || !qzConnected) {
    throw new Error('QZ Tray no está conectado');
  }

  let printer;
  if (printerName) {
    printer = await qz.printers.find(printerName);
  } else {
    printer = await qz.printers.getDefault();
  }

  if (!printer) {
    throw new Error('No se encontró impresora térmica');
  }

  const config = qz.configs.create(printer, {
    copies: 1,
    orientation: null,
    paperSize: { width: 80, height: 297, unit: 'mm' },
  });

  // ESC/POS formato: texto + corte
  const escpos = '\x1B\x40' + text + '\n\n\n\x1B\x6D';
  await qz.printing.print(config, escpos);

  return { printer: printer.name || printer };
}

/**
 * Obtiene lista de impresoras disponibles vía QZ Tray
 */
export async function findPrinters() {
  if (!qzAvailable || !qzConnected) return [];
  try {
    const printers = await qz.printers.find();
    return printers.map(p => ({
      name: p.name || p,
      isDefault: false,
    }));
  } catch {
    return [];
  }
}

/**
 * Verifica si QZ Tray está conectado y disponible
 */
export function isQZAvailable() {
  return qzAvailable && qzConnected;
}

/**
 * Intenta abrir el cajón de dinero vía el agente Python local
 * Fallback cuando QZ Tray no está disponible
 */
export async function openDrawerViaAgent(agentUrl = 'http://127.0.0.1:8199', printer = '') {
  const res = await fetch(`${agentUrl}/open-drawer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Imprime ticket vía el agente Python local
 */
export async function printViaAgent(agentUrl = 'http://127.0.0.1:8199', text, printer = '') {
  const res = await fetch(`${agentUrl}/print`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, printer }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}
