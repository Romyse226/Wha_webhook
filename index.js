const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ===== TES CONFIGURATIONS =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
const N8N_WEBHOOK_URL = "https://mavabot.app.n8n.cloud/webhook-test/mava-core";

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
    // 🔍 LOG 1 : Voir TOUT ce que WhatsApp envoie
    console.log("📦 PAYLOAD BRUT reçu de WhatsApp:");
    console.log(JSON.stringify(req.body, null, 2));

    // 1. Extraire les données du payload Meta
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // 🔍 LOG 2 : Vérifier ce qu'on a extrait
    console.log("📋 Entry:", entry ? "✅" : "❌");
    console.log("📋 Changes:", changes ? "✅" : "❌");
    console.log("📋 Value:", value ? "✅" : "❌");
    console.log("📋 Message:", message ? "✅" : "❌");

    // 2. Si pas de message, on répond OK et on arrête
    if (!message) {
      console.log("⚠️ Webhook reçu mais pas de message");
      console.log("🔍 Contenu de req.body:", req.body);
      return res.sendStatus(200);
    }

    // 3. Extraire l'ID unique du message
    const wamid = message.id;

    // 🔍 LOG 3 : Afficher le wamid
    console.log("🆔 WAMID:", wamid);

    // 4. Vérifier si on a déjà traité ce message
    if (processedMessages.has(wamid)) {
      console.log(`⏭️ Message déjà traité: ${wamid}`);
      return res.sendStatus(200);
    }

    // 5. Marquer ce message comme traité
    processedMessages.add(wamid);

    // 6. Normaliser le numéro de téléphone (format ivoirien)
    let phoneNumber = message.from;
    
    // Si le numéro commence par 225 et a 11 chiffres, ajouter le 0
    if (phoneNumber.startsWith('225') && phoneNumber.length === 11) {
      phoneNumber = '225' + '0' + phoneNumber.substring(3);
    }
    
    // Si le numéro ne commence pas par 225, l'ajouter
    if (!phoneNumber.startsWith('225')) {
      phoneNumber = '225' + phoneNumber;
    }

    // 7. Préparer les données propres pour n8n
    const payload = {
      wamid: wamid,
      phone: phoneNumber,
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp
    };

    // 🔍 LOG 4 : Voir ce qu'on va envoyer à n8n
    console.log("📨 Payload préparé pour n8n:");
    console.log(JSON.stringify(payload, null, 2));

    // 7. Envoyer vers n8n
    const response = await axios.post(N8N_WEBHOOK_URL, payload, {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // 🔍 LOG 5 : Voir la réponse de n8n
    console.log("✅ Réponse de n8n:");
    console.log("Status:", response.status);
    console.log("Data:", JSON.stringify(response.data, null, 2));

    // 8. Répondre à Meta immédiatement
    return res.sendStatus(200);

  } catch (error) {
    // 🔍 LOG 6 : Voir l'erreur complète
    console.error("❌ ERREUR DÉTAILLÉE:");
    console.error("Message:", error.message);
    console.error("Status:", error.response?.status);
    console.error("Data:", error.response?.data);
    console.error("Stack:", error.stack);
    
    // Important : on répond toujours 200 à Meta même en cas d'erreur
    return res.sendStatus(200);
  }
});

// ===== DÉMARRAGE DU SERVEUR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MAVA Infrastructure active sur le port ${PORT}`);
  console.log(`📍 Webhook prêt à recevoir de Meta`);
  console.log(`🔗 URL n8n: ${N8N_WEBHOOK_URL}`);
});




