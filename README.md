# 🤖 AraLowkey WhatsApp AI System v2.0

> Connectez votre WhatsApp — l'IA répond automatiquement à tous vos messages.

---

## 📁 Structure

```
AraLowkey-WhatsApp-AI/
├── index.html      ← Dashboard (connexion + messages live + config)
├── server.js       ← Backend Express + Socket.io + WhatsApp
├── ai-engine.js    ← Moteur IA (intents + funnel de vente)
├── data.json       ← Base de données
├── package.json    ← Dépendances
└── README.md
```

---

## 🚀 Installation & Lancement

### Pré-requis
- **Node.js 16+** → https://nodejs.org
- **Google Chrome** (whatsapp-web.js en a besoin)

### 1. Installer les dépendances
```bash
npm install
```
> ⚠️ Cette étape installe aussi Chromium (~170MB) via Puppeteer. Attendre patiemment.

### 2. Lancer le serveur
```bash
node server.js
```

### 3. Ouvrir le dashboard
```
http://localhost:3000
```

---

## 📱 Connecter WhatsApp

### Méthode 1 — Code de couplage (recommandée)
1. Entrez votre numéro WhatsApp (ex: `212 612 345 678`)
2. Un **code à 8 chiffres** apparaît sur l'écran
3. Sur votre téléphone :
   - WhatsApp → `⋮` → **Appareils connectés**
   - **Lier un appareil**
   - **Lier avec un numéro de téléphone**
   - Entrer le code affiché
4. ✅ Connecté ! L'IA répond maintenant à tous vos messages.

### Méthode 2 — QR Code (fallback automatique)
Si le code de couplage ne fonctionne pas, un QR Code apparaît automatiquement.
Scanner avec WhatsApp → Appareils connectés → Lier un appareil.

---

## 🤖 Comment fonctionne l'IA

### Détection d'intention automatique
| Intent | Mots déclencheurs |
|--------|-------------------|
| Salutation | salam, bonjour, hi, labas |
| Prix | prix, combien, thaman, bchhal |
| Commande | commander, bghit, je veux |
| Livraison | livraison, délai, matay |
| Produit | produit, catalogue, voir |
| Promo | promo, réduction, offre |
| Paiement | paiement, cash, carte |
| Problème | problème, cassé, retard |

### Funnel de vente automatique
```
Message entrant
      ↓
Détection d'intention
      ↓
Réponse personnalisée
      ↓
Si commande → collecte Nom → Ville
      ↓
Confirmation + sauvegarde
```

### Sessions par contact
Chaque contact a sa propre session avec historique (20 derniers messages).
L'IA se souvient du contexte de la conversation.

---

## ⚙️ Configuration via Dashboard

### 1. Config IA
- Nom de la boutique, devise, contact
- Personnaliser les messages d'accueil, merci, clôture
- Délai de réponse (simuler un humain)
- Infos livraison, paiement, promos, horaires

### 2. Produits
- Ajouter des produits avec nom, prix, description
- L'IA peut les présenter et répondre sur leurs prix
- Funnel de commande automatique par produit

### 3. Toggle IA
- Activer/Désactiver l'IA à tout moment depuis la topbar
- Utile pour répondre manuellement sans déconnecter

---

## 📊 API REST disponible

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/connect` | Connecter un numéro WA |
| POST | `/disconnect` | Déconnecter |
| POST | `/send` | Envoyer message manuel |
| GET | `/messages` | Historique messages |
| GET | `/contacts` | Liste contacts |
| GET | `/stats` | Statistiques |
| GET/POST | `/ai-config` | Lire/Modifier config IA |
| POST | `/toggle-ai` | Activer/Désactiver IA |
| DELETE | `/messages` | Vider historique |

---

## 🌍 Déploiement

### Sur un serveur Linux (VPS)
```bash
# Installer Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Installer les dépendances Chrome pour Puppeteer
sudo apt install -y chromium-browser

# Lancer en arrière-plan
npm install pm2 -g
pm2 start server.js --name aralowkey
pm2 save
pm2 startup
```

### Variables d'environnement
```bash
PORT=3000 node server.js
```

---

## ⚠️ Notes importantes

- Votre **téléphone doit rester connecté** à internet (comme WhatsApp Web)
- Les sessions sont sauvegardées dans `.wwebjs_auth/` → reconnexion auto
- Max ~500 messages gardés en mémoire (configurable dans server.js)
- **WhatsApp peut déconnecter** si détecte activité anormale → reconnectez

---

## 🛠️ Dépendances

| Package | Rôle |
|---------|------|
| `whatsapp-web.js` | Connexion WhatsApp Web |
| `express` | Serveur HTTP |
| `socket.io` | Temps réel dashboard |
| `qrcode` | Génération QR Code |
| `cors` | Cross-Origin |

---

*AraLowkey AI System v2.0 — 100% gratuit, zéro API payante*
