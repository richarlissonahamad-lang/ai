/**
 * ═══════════════════════════════════════════
 *   AraLowkey AI Engine — Moteur de réponses
 *   Intelligent • Contextuel • Personnalisable
 * ═══════════════════════════════════════════
 */

// ── Historique des conversations par contact ──
const conversationHistory = {};
// ── Config IA chargée depuis data.json ──
let aiConfig = null;

function setConfig(cfg) {
  aiConfig = cfg;
}

function getHistory(contactId) {
  if (!conversationHistory[contactId]) {
    conversationHistory[contactId] = [];
  }
  return conversationHistory[contactId];
}

function addToHistory(contactId, role, text) {
  const hist = getHistory(contactId);
  hist.push({ role, text, time: Date.now() });
  // Garder max 20 messages par contact
  if (hist.length > 20) hist.shift();
}

// ══════════════════════════════════════════
//  INTENT DETECTION — NLP maison
// ══════════════════════════════════════════
const INTENTS = [
  { name: 'salut',      regex: /^(salam|bonjour|salut|hi|hello|hey|labas|ola|walo|allo|ahlan)/i },
  { name: 'prix',       regex: /prix|combien|tarif|bchhal|thaman|coût|cost|cher|mzyan/i },
  { name: 'commande',   regex: /commander|acheter|bghit|je veux|order|passer commande|disponible|dispo/i },
  { name: 'livraison',  regex: /livr|délai|shipping|matay|quand.*rec|wasel|expéd/i },
  { name: 'produit',    regex: /produit|article|catalogue|collection|voir|show|qu.*est.ce|c.*quoi/i },
  { name: 'promo',      regex: /promo|réduct|discount|solde|offre|remise|pas cher|moins cher/i },
  { name: 'contact',    regex: /contact|téléphone|tel|numéro|appel|joindre|whatsapp|instagram/i },
  { name: 'horaires',   regex: /horaire|ouvert|fermé|heure|quand.*ouvr|disponible.*quand/i },
  { name: 'annuler',    regex: /annul|cancel|non|la|stop|arrêt|pas intéressé/i },
  { name: 'merci',      regex: /merci|shokran|thank|barak|choukran|nickel|parfait|3ziz/i },
  { name: 'paiement',   regex: /pay|paiement|virement|cash|carte|cih|attijariwafa|CCP|wafacash/i },
  { name: 'probleme',   regex: /problème|probleme|bug|pas reçu|manquant|cassé|défaut|retard|plainte/i },
];

function detectIntent(message) {
  const m = message.toLowerCase().trim();
  for (const intent of INTENTS) {
    if (intent.regex.test(m)) return intent.name;
  }
  return 'unknown';
}

function detectProductMentioned(message, products) {
  if (!products || !products.length) return null;
  const m = message.toLowerCase();
  return products.find(p =>
    p.name && p.name.toLowerCase().split(' ').some(w => w.length > 3 && m.includes(w.toLowerCase()))
  );
}

// ══════════════════════════════════════════
//  GÉNÉRATEUR DE RÉPONSE PRINCIPALE
// ══════════════════════════════════════════
function generateReply(message, contactId, contactName) {
  const cfg      = aiConfig || {};
  const persona  = cfg.persona  || {};
  const products = cfg.products || [];
  const business = cfg.business || {};

  const intent    = detectIntent(message);
  const product   = detectProductMentioned(message, products);
  const history   = getHistory(contactId);
  const isReturning = history.length > 0;
  const firstName = contactName ? contactName.split(' ')[0] : '';
  const greet     = firstName ? `${firstName} ` : '';

  // Enregistrer le message entrant
  addToHistory(contactId, 'user', message);

  let reply = '';

  // ── Gestion flux commande en cours ──
  const lastBotMsg = [...history].reverse().find(h => h.role === 'bot');
  const awaitName  = lastBotMsg && lastBotMsg.text.includes('prénom');
  const awaitCity  = lastBotMsg && lastBotMsg.text.includes('ville');

  if (awaitName && !['salut','annuler','merci'].includes(intent)) {
    // L'utilisateur donne son prénom
    const state = getConvState(contactId);
    state.customerName = message.trim();
    reply = `Parfait ${state.customerName} ! 🎯\nDans quelle *ville* tu es pour la livraison ?`;
    setConvState(contactId, state);
    addToHistory(contactId, 'bot', reply);
    return reply;
  }

  if (awaitCity && !['salut','annuler','merci'].includes(intent)) {
    const state = getConvState(contactId);
    state.city = message.trim();
    const prod = state.pendingProduct || 'Non précisé';
    reply = `✅ *Commande confirmée !*\n\n` +
            `📦 Produit: ${prod}\n` +
            `👤 Nom: ${state.customerName || greet.trim()}\n` +
            `📍 Ville: ${state.city}\n\n` +
            `Notre équipe va te contacter dans les *2h*.\n` +
            `Livraison 24-48h · Paiement à la livraison 🚀\n\n` +
            `${persona.closingPhrase || 'Shokran bzaf ! Tbark Allah 🌟'}`;
    clearConvState(contactId);
    addToHistory(contactId, 'bot', reply);
    return reply;
  }

  // ── Réponses par intent ──
  switch (intent) {
    case 'salut':
      if (isReturning) {
        reply = `Salam ${greet}! 😊 Mrahba bik marra okhra.\nKifach naa3wenk lyoum ?`;
      } else {
        reply = `${persona.greeting || `Salam wa alaykoum ! 👋 Mrahba bik`} ${greet}!\n\n` +
                `${persona.intro || `Ana l-assistant IA. Kifach naa3wenk ?`}\n\n` +
                `💰 Prix · 📦 Produits · 🚚 Livraison · 🛒 Commander`;
      }
      break;

    case 'prix':
      if (product) {
        reply = `*${product.name}*\n` +
                `Prix spécial : *${product.price} ${business.currency || 'MAD'}* ✨` +
                (product.oldPrice ? `\n~~${product.oldPrice} ${business.currency || 'MAD'}~~` : '') +
                `\n\n${product.description || ''}\n\n` +
                `Baghi tcommand maintenant ? Dis-moi ton prénom 👇`;
      } else if (products.length) {
        const list = products.slice(0, 5).map(p =>
          `• *${p.name}* — ${p.price} ${business.currency || 'MAD'}`
        ).join('\n');
        reply = `*Nos prix du moment* 🔥\n\n${list}\n\n_Livraison partout au Maroc 🇲🇦_\n\nLe9 chi produit et n3tek plus de détails !`;
      } else {
        reply = persona.priceReply || `Envoyez-moi le nom du produit qui vous intéresse et je vous donne le prix exact 👇`;
      }
      break;

    case 'produit':
      if (products.length) {
        const list = products.map((p, i) => `${i+1}. *${p.name}* — ${p.price} ${business.currency || 'MAD'}`).join('\n');
        reply = `📦 *Notre catalogue :*\n\n${list}\n\nTap le numéro du produit qui t'intéresse ! 😊`;
      } else {
        reply = persona.productReply || `Je n'ai pas encore de catalogue configuré. Contactez-nous directement !`;
      }
      break;

    case 'commande': {
      const state = getConvState(contactId);
      state.pendingProduct = product ? product.name : 'À préciser';
      setConvState(contactId, state);
      const productLine = product ? `*${product.name}* à *${product.price} ${business.currency || 'MAD'}* 🌟\n\n` : '';
      reply = `${productLine}Parfait, on lance la commande ! 🛒\n\nDis-moi ton *prénom* pour commencer :`;
      break;
    }

    case 'livraison':
      reply = business.deliveryInfo ||
        `🚚 *Livraison partout au Maroc !*\n\n` +
        `• Délai : 24-48h ouvrables\n` +
        `• Paiement à la livraison (COD)\n` +
        `• Frais : 30 MAD (gratuit dès 500 MAD)\n` +
        `• Suivi par SMS inclus\n\n` +
        `Baghi tcommand maintenant ? 😊`;
      break;

    case 'promo':
      reply = business.promoInfo ||
        `🎉 *Offres spéciales !*\n\n` +
        `• Livraison GRATUITE dès 500 MAD\n` +
        `• -10% pour les nouveaux clients\n` +
        `• Paiement à la livraison disponible\n\n` +
        `Quel produit t'intéresse ? 😍`;
      break;

    case 'contact':
      reply = `📞 *Nous contacter :*\n\n` +
              (business.phone ? `• Tel/WA: ${business.phone}\n` : '') +
              (business.instagram ? `• Instagram: ${business.instagram}\n` : '') +
              (business.email ? `• Email: ${business.email}\n` : '') +
              `\nOn est disponibles 7j/7 ! 😊`;
      break;

    case 'horaires':
      reply = business.hours ||
        `🕐 *Nos horaires :*\n\nLun-Sam : 9h - 21h\nDimanche : 10h - 18h\n\nL'IA répond 24/7 automatiquement ! 🤖`;
      break;

    case 'paiement':
      reply = business.paymentInfo ||
        `💳 *Modes de paiement :*\n\n` +
        `• Paiement à la livraison (COD) ✅\n` +
        `• Virement bancaire\n` +
        `• Wafacash / CashPlus\n\n` +
        `Le plus simple : payer à la livraison 😊`;
      break;

    case 'probleme':
      reply = `😔 Désolé pour ce désagrément ${greet}!\n\n` +
              `Pour régler ça rapidement :\n` +
              `1. Décris-moi le problème en détail\n` +
              `2. Envoie-moi une photo si possible\n` +
              `3. Je transmets immédiatement à notre équipe\n\n` +
              `On va résoudre ça rapidement ! 🙏`;
      break;

    case 'annuler':
      clearConvState(contactId);
      reply = `Maashi mochkil ! 😊 Ila bghiti chi haja, ana hna. Bslama ! 👋`;
      break;

    case 'merci':
      reply = persona.thankYou || `Barak Allah fik ! 🌟 Ana hna ila 3ndek aya so'al. Nshaallah tlga kolchi mzyan !`;
      break;

    default: {
      // Réponse intelligente par défaut
      const msg = message.toLowerCase();
      // Détection numéro de produit
      const num = parseInt(msg);
      if (num && num > 0 && products[num - 1]) {
        const p = products[num - 1];
        reply = `*${p.name}*\n${p.description || ''}\nPrix : *${p.price} ${business.currency || 'MAD'}*\n\nBaghi tcommand ? 🛒`;
      } else {
        reply = persona.defaultReply ||
          `Shokran ${greet}! 🤖 Je n'ai pas bien compris.\n\n` +
          `Tu peux me demander :\n💰 *Prix* · 📦 *Produits* · 🚚 *Livraison* · 🛒 *Commander*\n\n` +
          `Ou décris ce que tu veux et je t'aide ! 😊`;
      }
    }
  }

  addToHistory(contactId, 'bot', reply);
  return reply;
}

// ══════════════════════════════════════════
//  ÉTAT DE CONVERSATION (Commande en cours)
// ══════════════════════════════════════════
const convStates = {};

function getConvState(contactId) {
  return convStates[contactId] || {};
}
function setConvState(contactId, state) {
  convStates[contactId] = state;
}
function clearConvState(contactId) {
  convStates[contactId] = {};
}

// ══════════════════════════════════════════
//  FILTRE — Ne pas répondre à soi-même
// ══════════════════════════════════════════
function shouldIgnore(message) {
  // Ignorer les messages de groupes, status, médias sans texte
  if (!message.body || message.body.trim() === '') return true;
  if (message.from === 'status@broadcast') return true;
  return false;
}

module.exports = { generateReply, setConfig, shouldIgnore, addToHistory };
