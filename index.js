const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ===== CONFIGURATIONS =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
// UTILISATION DE L'URL DE PRODUCTION (Indispensable pour le mode "Publié" de n8n)
const N8N_WEBHOOK_URL = "mavabot.app.n8n.cloud";

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
  return res.sendStatus(403);
});

// ===== ROUTE POST (Messages entrants) =====
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const wamid = message.id;
    if (processedMessages.has(wamid)) return res.sendStatus(200);
    processedMessages.add(wamid);

    // --- NORMALISATION DU NUMÉRO ---
    let phoneNumber = message.from.replace(/\D/g, ''); // Nettoyage
    
    // Correction Côte d'Ivoire (Si 11 chiffres, il manque le préfixe 01, 05 ou 07)
    if (phoneNumber.startsWith('225') && phoneNumber.length === 11) {
      const eightDigits = phoneNumber.substring(3);
      const firstDigit = eightDigits[0];

      let fullPrefix = "05"; // Par défaut MTN (ton cas)
      if (["0", "1", "2", "3"].includes(firstDigit)) fullPrefix = "01"; // Orange
      if (["4", "5", "6"].includes(firstDigit)) fullPrefix = "05";      // MTN
      if (["7", "8", "9"].includes(firstDigit)) fullPrefix = "07";      // Moov

      phoneNumber = "225" + fullPrefix + eightDigits;
      console.log(`🔧 Normalisation CI : ${message.from} -> ${phoneNumber}`);
    }

    // --- PRÉPARATION PAYLOAD ---
    const payload = {
      wamid: wamid,
      phone: phoneNumber,
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp
    };

    console.log("📨 Envoi vers n8n:", phoneNumber);

    // --- ENVOI N8N ---
    await axios.post(N8N_WEBHOOK_URL, payload, { timeout: 5000 });

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Erreur transfert:", error.message);
    return res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MAVA actif sur port ${PORT}`));

