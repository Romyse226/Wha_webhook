const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// ===== CONFIG =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
const N8N_WEBHOOK_URL = "https://mavabot.app.n8n.cloud/webhook-test/mava-core";

const processedMessages = new Set();

// ===== GET : Validation Meta =====
app.get('/webhook', (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// ===== POST : Messages entrants =====
app.post('/webhook', async (req, res) => {
  try {
    const value = req.body.entry?.[0]?.changes?.[0]?.value;
    const message = value?.messages?.[0];

    if (!message) return res.sendStatus(200);

    const wamid = message.id;
    if (processedMessages.has(wamid)) return res.sendStatus(200);
    processedMessages.add(wamid);

    // ===== Numéro brut =====
    let phone = message.from.replace(/\D/g, '');

    // ===== Normalisation ARTCI (8 → 10 chiffres) =====
    if (phone.startsWith("225") && phone.length === 11) {
      const oldBlock = phone.slice(3);        // AB + 6 chiffres
      const oldPrefix = oldBlock.slice(0, 2); // AB

      let pq = null;

      // ===== TABLES AB (anciens préfixes) =====
      const MTN_AB = [
        "04","05","06","44","45","46","54","55","56",
        "64","65","66","74","75","76","84","85",
        "94","95","96"
      ];

      const ORANGE_AB = [
        "07","08","09","47","48","49","57","58","59",
        "67","68","69","77","78","79","87","88","89",
        "97","98","99"
      ];

      const MOOV_AB = [
        "01","02","03","40","41","42","43","50","51","52","53",
        "60","61","62","63","70","71","72","73",
        "80","81","82","83","90","91","92","93"
      ];

      // ===== DÉDUCTION DU PQ (clé absolue) =====
      if (MTN_AB.includes(oldPrefix)) pq = "01";
      else if (MOOV_AB.includes(oldPrefix)) pq = "05";
      else if (ORANGE_AB.includes(oldPrefix)) pq = "07";
      else {
        console.error("❌ Préfixe AB inconnu :", oldPrefix);
        return res.sendStatus(200);
      }

      phone = "225" + pq + oldBlock;
      console.log(`🔧 ARTCI normalisé : ${message.from} → ${phone}`);
    }

    // ===== Payload n8n =====
    const payload = {
      wamid,
      phone,
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp
    };

    await axios.post(N8N_WEBHOOK_URL, payload, { timeout: 5000 });

    return res.sendStatus(200);

  } catch (err) {
    console.error("❌ Erreur :", err.message);
    return res.sendStatus(200);
  }
});

// ===== Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MAVA actif sur ${PORT}`));

