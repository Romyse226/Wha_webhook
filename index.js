const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ===== CONFIGURATIONS =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
const N8N_WEBHOOK_URL = "https://mavabot.app.n8n.cloud/webhook-test/mava-core";

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

    // ===== NUMÉRO BRUT =====
    let phone = message.from.replace(/\D/g, '');

    // ===== NORMALISATION ARTCI (8 → 10 chiffres) =====
    if (phone.startsWith('225') && phone.length === 11) {
      const oldBlock = phone.substring(3);          // ex: 76670439
      const oldPrefix = oldBlock.substring(0, 2);   // ex: 76

      let pq = null;

      // ===== TABLES ARTCI CORRECTES =====
      const ORANGE = [
        "07","08","09",
        "47","48","49",
        "57","58","59",
        "67","68","69",
        "74","75","76",
        "77","78","79",
        "87","88","89"
      ];

      const MTN = [
        "04","05","06",
        "44","45","46",
        "54","55","56",
        "64","65","66",
        "84","85","86",
        "94","95","96"
      ];

      const MOOV = [
        "01","02","03",
        "40","41","42","43",
        "50","51","52","53",
        "60","61","62","63",
        "70","71","72","73",
        "80","81","82","83"
      ];

      if (MTN.includes(oldPrefix)) pq = "01";
      else if (ORANGE.includes(oldPrefix)) pq = "07";
      else if (MOOV.includes(oldPrefix)) pq = "05";
      else {
        console.error("❌ Préfixe ARTCI inconnu :", oldPrefix);
        return res.sendStatus(200); // rejet propre
      }

      phone = "225" + pq + oldBlock;
      console.log(`🔧 ARTCI normalisé : ${message.from} → ${phone}`);
    }

    // ===== PAYLOAD N8N =====
    const payload = {
      wamid: wamid,
      phone: phone,
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp
    };

    console.log("📨 Envoi vers n8n :", phone);

    await axios.post(N8N_WEBHOOK_URL, payload, { timeout: 5000 });

    return res.sendStatus(200);

  } catch (error) {
    console.error("❌ Erreur transfert :", error.message);
    return res.sendStatus(200);
  }
});

// ===== SERVER =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MAVA actif sur le port ${PORT}`));




