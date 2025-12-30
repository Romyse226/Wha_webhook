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

    // ===== NORMALISATION ARTCI (Côte d'Ivoire) =====
    let phone = message.from.replace(/\D/g, '');
    
    console.log(`📞 Numéro reçu de Meta: ${phone} (${phone.length} chiffres)`);
    
    // Si Meta envoie le format tronqué (225 + 8 chiffres = 11 chiffres)
    if (phone.startsWith('225') && phone.length === 11) {
      const ab = phone.substring(3, 5); // L'ancien bloc AB (ex: 76)
      const reste = phone.substring(3); // Le bloc complet ABXXXXXX
      let pq = "";
      
      // TABLES DE VÉRITÉ OFFICIELLES (PQ = Opérateur)
      const mtnAB = ["04","05","06","44","45","46","54","55","56","64","65","66","74","75","76","84","85","86","94","95","96"];
      const orangeAB = ["07","08","09","47","48","49","57","58","59","67","68","69","77","78","79","87","88","89","97","98","99"];
      const moovAB = ["01","02","03","40","41","42","43","50","51","52","53","60","61","62","63","70","71","72","73","80","81","82","83","90","91","92","93"];
      
      // Règle 2025 : On remet le PQ devant l'ancien bloc AB
      if (mtnAB.includes(ab)) {
        pq = "05"; // MTN = 05
      } else if (orangeAB.includes(ab)) {
        pq = "07"; // ORANGE = 07
      } else if (moovAB.includes(ab)) {
        pq = "01"; // MOOV = 01
      } else {
        pq = "05"; // Sécurité par défaut (MTN)
      }
      
      phone = "225" + pq + reste;
      console.log(`🔧 RÉPARATION ARTCI : ${message.from} -> ${phone} (${phone.length} chiffres)`);
    } else {
      console.log(`📞 Numéro conservé tel quel: ${phone}`);
    }

    // ===== Payload n8n =====
    const payload = {
      wamid,
      phone,
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp
    };
    
    console.log(`📨 Envoi à n8n: ${JSON.stringify(payload, null, 2)}`);

    await axios.post(N8N_WEBHOOK_URL, payload, { 
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Envoyé à n8n avec succès');
    return res.sendStatus(200);
    
  } catch (err) {
    console.error("❌ Erreur :", err.message);
    return res.sendStatus(200);
  }
});

// ===== Server =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 MAVA actif sur ${PORT}`));



