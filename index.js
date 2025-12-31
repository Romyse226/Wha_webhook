const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ===== CONFIGURATION =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
const N8N_WEBHOOK_URL = "https://mavabot.app.n8n.cloud/webhook/mava-core";
const processedMessages = new Set();

// Nettoyage périodique des doublons (toutes les 24h)
setInterval(() => processedMessages.clear(), 86400000);

// ===== GET : Validation Meta =====
app.get('/webhook', (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});

// ===== POST : Messages entrants =====
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // 1. Filtrage des notifications techniques
    if (!message) return res.sendStatus(200);
    
    // 2. Anti-doublons (WAMID)
    const wamid = message.id;
    if (processedMessages.has(wamid)) return res.sendStatus(200);
    processedMessages.add(wamid);

    // 3. Identification du Vendeur (Dynamique)
    // On récupère le numéro qui a REÇU le message (le numéro du business)
    const vendor_phone = value.metadata?.display_phone_number || "INCONNU";
    const phone_id_vendeur = value.metadata?.phone_number_id; // Utile pour répondre via Meta

    // 4. Normalisation ARTCI (Côte d'Ivoire)
    let phone = message.from.replace(/\D/g, '');
    if (phone.startsWith('225') && phone.length === 11) {
      const ab = phone.substring(3, 5);
      const reste = phone.substring(3);
      let pq = "05"; // Default MTN

      const mtnAB = ["04","05","06","44","45","46","54","55","56","64","65","66","74","75","76","84","85","86","94","95","96"];
      const orangeAB = ["07","08","09","47","48","49","57","58","59","67","68","69","77","78","79","87","88","89","97","98","99"];
      const moovAB = ["01","02","03","40","41","42","43","50","51","52","53","60","61","62","63","70","71","72","73","80","81","82","83","90","91","92","93"];
      
      if (mtnAB.includes(ab)) pq = "05";
      else if (orangeAB.includes(ab)) pq = "07";
      else if (moovAB.includes(ab)) pq = "01";
      
      phone = "225" + pq + reste;
    }

    // 5. Payload enrichi pour n8n
    const payload = {
      wamid,
      phone, // Numéro du client (normalisé)
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp,
      vendor_phone: vendor_phone.replace(/\D/g, ''), // Numéro du vendeur (ex: 22505...)
      phone_id_vendeur: phone_id_vendeur // ID technique pour envoyer le message
    };

    // 6. Envoi à n8n
    await axios.post(N8N_WEBHOOK_URL, payload, { timeout: 5000 });
    
    return res.sendStatus(200);
    
  } catch (err) {
    console.error("❌ Erreur de pont Render->n8n:", err.message);
    return res.sendStatus(200); // On libère Meta
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MAVA Hub actif sur ${PORT}`));




