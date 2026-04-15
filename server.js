/**
 * ══════════════════════════════════════════════════════
 *   AraLowkey AI System — WhatsApp Automation Server
 *   whatsapp-web.js + Socket.io + Express
 *   100% Gratuit · Zéro API payante
 * ══════════════════════════════════════════════════════
 *
 *  LANCER :
 *    npm install
 *    node server.js
 *  Puis ouvrir → http://localhost:3000
 * ══════════════════════════════════════════════════════
 */

const express     = require('express');
const http        = require('http');
const { Server }  = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs          = require('fs');
const path        = require('path');
const cors        = require('cors');
const qrcode      = require('qrcode');
const aiEngine    = require('./ai-engine');

// ══════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;
const DB     = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// ══════════════════════════════════════════
//  BASE DE DONNÉES
// ══════════════════════════════════════════
function readDB() {
  try { return JSON.parse(fs.readFileSync(DB, 'utf-8')); }
  catch { return { messages: [], contacts: [], stats: { totalIn: 0, totalOut: 0 }, aiConfig: getDefaultConfig() }; }
}
function writeDB(data) {
  fs.writeFileSync(DB, JSON.stringify(data, null, 2));
}
function getDefaultConfig() {
  return {
    persona: {
      greeting:      "Salam wa alaykoum ! 👋 Mrahba bik",
      intro:         "Ana l-assistant IA dyalkom. Kifach naa3wenk ?",
      thankYou:      "Barak Allah fik ! 🌟 Nshaallah tlga kolchi mzyan !",
      closingPhrase: "Shokran bzaf ! Tbark Allah 🌟",
      defaultReply:  "Shokran ! Kifach naa3wenk ? Sou9 liha chi so'al 😊"
    },
    business: {
      name:         "Ma Boutique",
      phone:        "",
      instagram:    "",
      email:        "",
      currency:     "MAD",
      deliveryInfo: "",
      paymentInfo:  "",
      promoInfo:    "",
      hours:        ""
    },
    products: [],
    aiActive: true,
    replyDelay: 1500  // délai en ms avant réponse (simuler humain)
  };
}

// ══════════════════════════════════════════
//  STATE GLOBAL
// ══════════════════════════════════════════
let waClient      = null;
let waStatus      = 'disconnected'; // disconnected | awaiting_code | connecting | connected
let linkedPhone   = null;
let aiActive      = true;

// Charger la config IA au démarrage
const db0 = readDB();
if (db0.aiConfig) aiEngine.setConfig(db0.aiConfig);
if (typeof db0.aiConfig?.aiActive === 'boolean') aiActive = db0.aiConfig.aiActive;

// ══════════════════════════════════════════
//  WHATSAPP CLIENT
// ══════════════════════════════════════════
function createWAClient(phone) {
  if (waClient) {
    try { waClient.destroy(); } catch {}
    waClient = null;
  }

  waClient = new Client({
    authStrategy: new LocalAuth({ clientId: `ara_${phone}` }),
    puppeteer: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    },
    webVersionCache: {
      type: 'remote',
      remotePath: 'https://raw.githubusercontent.com/wppconnect-team/wa-version/main/html/2.2412.54.html'
    }
  });

  // ── QR Code ──
  waClient.on('qr', async (qr) => {
    console.log('📱 QR généré — demande du code de couplage...');
    waStatus = 'awaiting_code';

    // Générer le code de couplage (au lieu du QR)
    try {
      const pairingCode = await waClient.requestPairingCode(phone.replace(/\D/g, ''));
      console.log(`🔑 Code de couplage: ${pairingCode}`);
      io.emit('pairing_code', { code: pairingCode });
      io.emit('status', { status: 'awaiting_code', message: `Code: ${pairingCode}` });
    } catch (err) {
      // Si pairing code échoue, envoyer le QR en base64
      console.log('⚠️ Pairing code non disponible, utilisation du QR');
      const qrImage = await qrcode.toDataURL(qr);
      io.emit('qr_code', { qr: qrImage });
      io.emit('status', { status: 'awaiting_qr', message: 'Scanner le QR code' });
    }
  });

  // ── Chargement ──
  waClient.on('loading_screen', (percent) => {
    io.emit('status', { status: 'loading', message: `Chargement ${percent}%` });
  });

  // ── Authentifié ──
  waClient.on('authenticated', () => {
    console.log('✅ WhatsApp authentifié !');
    waStatus = 'connecting';
    io.emit('status', { status: 'connecting', message: 'Authentifié, connexion en cours...' });
  });

  // ── Prêt ──
  waClient.on('ready', async () => {
    console.log('🟢 WhatsApp connecté et prêt !');
    waStatus = 'connected';
    linkedPhone = phone;

    const info = waClient.info;
    const wInfo = {
      phone:    info?.wid?.user  || phone,
      name:     info?.pushname   || 'Inconnu',
      platform: info?.platform   || 'WhatsApp'
    };

    io.emit('status', { status: 'connected', message: 'Connecté !', info: wInfo });
    io.emit('connected', wInfo);

    // Sauvegarder info
    const db = readDB();
    db.linkedPhone = wInfo.phone;
    db.linkedName  = wInfo.name;
    writeDB(db);
  });

  // ── Déconnexion ──
  waClient.on('disconnected', (reason) => {
    console.log('🔴 WhatsApp déconnecté:', reason);
    waStatus = 'disconnected';
    linkedPhone = null;
    io.emit('status', { status: 'disconnected', message: `Déconnecté: ${reason}` });
    io.emit('disconnected', { reason });
    waClient = null;
  });

  // ══════════════════════════════════════════
  //   MESSAGE ENTRANT → RÉPONSE IA
  // ══════════════════════════════════════════
  waClient.on('message', async (msg) => {
    if (aiEngine.shouldIgnore(msg)) return;
    if (msg.fromMe) return; // Ne pas répondre à nos propres messages

    const db          = readDB();
    const contactId   = msg.from;
    const contactName = msg._data?.notifyName || msg.from.replace('@c.us', '');
    const body        = msg.body;

    console.log(`\n📨 MSG de ${contactName} [${contactId}]`);
    console.log(`   "${body}"`);

    // Enregistrer message entrant
    const msgRecord = {
      id:       Date.now(),
      from:     contactId,
      name:     contactName,
      body,
      type:     'in',
      time:     new Date().toISOString()
    };
    db.messages.unshift(msgRecord);
    db.stats.totalIn = (db.stats.totalIn || 0) + 1;

    // Notifier le dashboard en temps réel
    io.emit('new_message', msgRecord);

    // ── Vérifier si IA active ──
    const currentAiActive = db.aiConfig?.aiActive ?? true;
    if (!currentAiActive) {
      db.messages = db.messages.slice(0, 500);
      writeDB(db);
      return;
    }

    // ── Générer réponse IA ──
    aiEngine.setConfig(db.aiConfig || getDefaultConfig());
    const reply = aiEngine.generateReply(body, contactId, contactName);

    // Délai humain (configurable)
    const delay = db.aiConfig?.replyDelay ?? 1500;
    await sleep(delay);

    // ── Envoyer la réponse ──
    try {
      await msg.reply(reply);
      console.log(`   🤖 Réponse: "${reply.substring(0, 60)}..."`);

      const replyRecord = {
        id:   Date.now() + 1,
        to:   contactId,
        name: contactName,
        body: reply,
        type: 'out',
        time: new Date().toISOString()
      };
      db.messages.unshift(replyRecord);
      db.stats.totalOut = (db.stats.totalOut || 0) + 1;
      io.emit('new_message', replyRecord);

      // Mettre à jour/créer contact
      const existing = db.contacts.find(c => c.id === contactId);
      if (existing) {
        existing.lastMsg = body;
        existing.lastTime = new Date().toISOString();
        existing.msgCount = (existing.msgCount || 0) + 1;
      } else {
        db.contacts.push({
          id: contactId,
          name: contactName,
          lastMsg: body,
          lastTime: new Date().toISOString(),
          msgCount: 1
        });
      }
    } catch (err) {
      console.error('❌ Erreur envoi:', err.message);
    }

    db.messages = db.messages.slice(0, 500);
    writeDB(db);
  });

  // Lancer la connexion
  waClient.initialize().catch(err => {
    console.error('❌ Erreur init WA:', err.message);
    io.emit('status', { status: 'error', message: err.message });
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ══════════════════════════════════════════
//  SOCKET.IO — Connexion dashboard
// ══════════════════════════════════════════
io.on('connection', (socket) => {
  console.log(`🔌 Dashboard connecté [${socket.id}]`);

  // Envoyer état actuel
  const db = readDB();
  socket.emit('status', {
    status:  waStatus,
    message: waStatus === 'connected' ? 'Connecté' : 'Déconnecté',
    info:    db.linkedPhone ? { phone: db.linkedPhone, name: db.linkedName } : null
  });
  socket.emit('init_data', {
    messages: (db.messages || []).slice(0, 50),
    contacts: db.contacts || [],
    stats:    db.stats || {},
    aiConfig: db.aiConfig || getDefaultConfig(),
    aiActive: db.aiConfig?.aiActive ?? true
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Dashboard déconnecté [${socket.id}]`);
  });
});

// ══════════════════════════════════════════
//  API REST
// ══════════════════════════════════════════

/** POST /connect — Connecter un numéro WhatsApp */
app.post('/connect', (req, res) => {
  let { phone } = req.body;
  if (!phone) return res.status(400).json({ error: 'Numéro requis' });

  // Nettoyer le numéro (ex: +212 6XX → 2126XX)
  phone = phone.replace(/\s|\+|-|\(|\)/g, '');
  if (phone.startsWith('0') && phone.length === 10) {
    phone = '212' + phone.slice(1);
  }

  console.log(`\n📱 Connexion WhatsApp: ${phone}`);
  waStatus = 'connecting';
  io.emit('status', { status: 'connecting', message: 'Initialisation...' });

  createWAClient(phone);
  res.json({ success: true, message: 'Initialisation en cours...', phone });
});

/** POST /disconnect — Déconnecter */
app.post('/disconnect', async (req, res) => {
  if (waClient) {
    try {
      await waClient.logout();
      await waClient.destroy();
    } catch {}
    waClient = null;
  }
  waStatus = 'disconnected';
  linkedPhone = null;
  io.emit('status', { status: 'disconnected', message: 'Déconnecté manuellement' });
  res.json({ success: true });
});

/** POST /send — Envoyer un message manuel */
app.post('/send', async (req, res) => {
  const { to, message } = req.body;
  if (!waClient || waStatus !== 'connected') {
    return res.status(400).json({ error: 'WhatsApp non connecté' });
  }
  try {
    const chatId = to.includes('@c.us') ? to : `${to.replace(/\D/g, '')}@c.us`;
    await waClient.sendMessage(chatId, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET/POST /ai-config — Lire/Mettre à jour la config IA */
app.get('/ai-config', (req, res) => {
  const db = readDB();
  res.json(db.aiConfig || getDefaultConfig());
});

app.post('/ai-config', (req, res) => {
  const db = readDB();
  db.aiConfig = { ...(db.aiConfig || getDefaultConfig()), ...req.body };
  aiEngine.setConfig(db.aiConfig);
  writeDB(db);
  io.emit('config_updated', db.aiConfig);
  res.json({ success: true, config: db.aiConfig });
});

/** POST /toggle-ai — Activer/Désactiver l'IA */
app.post('/toggle-ai', (req, res) => {
  const db = readDB();
  if (!db.aiConfig) db.aiConfig = getDefaultConfig();
  db.aiConfig.aiActive = !db.aiConfig.aiActive;
  aiActive = db.aiConfig.aiActive;
  writeDB(db);
  io.emit('ai_toggled', { active: db.aiConfig.aiActive });
  res.json({ success: true, aiActive: db.aiConfig.aiActive });
});

/** GET /messages — Historique */
app.get('/messages', (req, res) => {
  const db = readDB();
  res.json({ messages: (db.messages || []).slice(0, 100) });
});

/** GET /contacts — Tous les contacts */
app.get('/contacts', (req, res) => {
  const db = readDB();
  res.json({ contacts: db.contacts || [] });
});

/** GET /stats — Statistiques */
app.get('/stats', (req, res) => {
  const db = readDB();
  res.json({
    status:     waStatus,
    aiActive:   db.aiConfig?.aiActive ?? true,
    totalIn:    db.stats?.totalIn    || 0,
    totalOut:   db.stats?.totalOut   || 0,
    contacts:   (db.contacts || []).length,
    messages:   (db.messages || []).length
  });
});

/** DELETE /messages — Vider l'historique */
app.delete('/messages', (req, res) => {
  const db = readDB();
  db.messages = [];
  writeDB(db);
  res.json({ success: true });
});

// ══════════════════════════════════════════
//  START
// ══════════════════════════════════════════
server.listen(PORT, () => {
  console.log('\n╔═══════════════════════════════════════════════╗');
  console.log('║   AraLowkey WhatsApp AI System — DÉMARRÉ ✅   ║');
  console.log('╚═══════════════════════════════════════════════╝');
  console.log(`\n🌐 Dashboard : http://localhost:${PORT}`);
  console.log(`📊 Stats     : http://localhost:${PORT}/stats`);
  console.log(`⚙️  Config    : http://localhost:${PORT}/ai-config`);
  console.log('\n💡 Ouvrez le dashboard pour connecter votre WhatsApp\n');
});
