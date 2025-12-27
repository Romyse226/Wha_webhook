const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ===== TES CONFIGURATIONS =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
const N8N_WEBHOOK_URL = "https://mavabot.app.n8n.cloud/webhook/mava-core";

// Protection contre les doublons (en mémoire pour MVP)
const processedMessages = new Set();

// ===== ROUTE GET (Validation Meta) =====
app.get('/webhook', (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook validé par Meta");
    return res.status(200).send(challenge);
  }
  
  console.log("❌ Token invalide");
  return res.sendStatus(403);
});

// ===== ROUTE POST (Messages entrants) =====
app.post('/webhook', async (req, res) => {
  try {
    // 1. Extraire les données du payload Meta
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // 2. Si pas de message, on répond OK et on arrête
    if (!message) {
      console.log("⚠️ Webhook reçu mais pas de message");
      return res.sendStatus(200);
    }

    // 3. Extraire l'ID unique du message
    const wamid = message.id;

    // 4. Vérifier si on a déjà traité ce message
    if (processedMessages.has(wamid)) {
      console.log(`⏭️ Message déjà traité: ${wamid}`);
      return res.sendStatus(200);
    }

    // 5. Marquer ce message comme traité
    processedMessages.add(wamid);

    // 6. Préparer les données propres pour n8n
    const payload = {
      wamid: wamid,
      phone: message.from,
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp
    };

    console.log("📨 Message reçu:", payload);

    // 7. Envoyer vers n8n
    await axios.post(N8N_WEBHOOK_URL, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log("✅ Envoyé vers n8n avec succès");

    // 8. Répondre à Meta immédiatement
    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Erreur:", error.message);
    // Important : on répond toujours 200 à Meta même en cas d'erreur
    // pour éviter que Meta réessaie et crée des doublons
    return res.sendStatus(200);
  }
});

// ===== DÉMARRAGE DU SERVEUR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MAVA Infrastructure active sur le port ${PORT}`);
  console.log(`📍 Webhook prêt à recevoir de Meta`);
});






