const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// ===== CONFIGURATION =====
const VERIFY_TOKEN = "MAVA_SECRET_2025";
// Assure-toi que cette URL est bien l'URL de PRODUCTION dans ton n8n (onglet Production URL)
const N8N_WEBHOOK_URL = "https://mavabot.app.n8n.cloud/webhook/mava-core";
const processedMessages = new Set();

// Nettoyage périodique des doublons (toutes les 24h) pour éviter la saturation mémoire
setInterval(() => processedMessages.clear(), 86400000);

// ===== GET : Validation du Webhook par Meta =====
app.get('/webhook', (req, res) => {
  if (req.query["hub.mode"] === "subscribe" && req.query["hub.verify_token"] === VERIFY_TOKEN) {
    console.log("✅ Webhook validé par Meta");
    return res.status(200).send(req.query["hub.challenge"]);
  }
  return res.sendStatus(403);
});

// ===== POST : Réception et Traitement des Messages =====
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // 1. Filtrage des notifications (lecture, remise, etc.)
    if (!message) return res.sendStatus(200);
    
    // 2. Gestion des doublons via l'identifiant unique Meta (WAMID)
    const wamid = message.id;
    if (processedMessages.has(wamid)) {
      console.log(`⏭️ Message déjà traité : ${wamid}`);
      return res.sendStatus(200);
    }
    processedMessages.add(wamid);

    // 3. Identification Dynamique du Vendeur (Indispensable pour le SaaS)
    const rawVendorPhone = value.metadata?.display_phone_number || "";
    // Nettoyage strict : on ne garde que les chiffres pour la recherche Google Sheets
    const vendor_phone = rawVendorPhone.replace(/\D/g, ''); 
    const phone_id_vendeur = value.metadata?.phone_number_id; 

    // 4. Normalisation ARTCI (Côte d'Ivoire - Passage 8 à 10 chiffres)
    let phone = message.from.replace(/\D/g, '');
    
    // Si format 11 chiffres reçu (ex: 225 76...), on répare selon la logique PQ-AB
    if (phone.startsWith('225') && phone.length === 11) {
      const ab = phone.substring(3, 5); // Ancien préfixe
      const reste = phone.substring(3); // Ancien bloc 8 chiffres
      let pq = "05"; // Par défaut MTN

      // Tables de vérité ARTCI 2025
      const mtnAB = ["04","05","06","44","45","46","54","55","56","64","65","66","74","75","76","84","85","86","94","95","96"];
      const orangeAB = ["07","08","09","47","48","49","57","58","59","67","68","69","77","78","79","87","88","89","97","98","99"];
      const moovAB = ["01","02","03","40","41","42","43","50","51","52","53","60","61","62","63","70","71","72","73","80","81","82","83","90","91","92","93"];
      
      if (mtnAB.includes(ab)) pq = "05";
      else if (orangeAB.includes(ab)) pq = "07";
      else if (moovAB.includes(ab)) pq = "01";
      
      phone = "225" + pq + reste;
      console.log(`🔧 Normalisation ARTCI effectuée : ${phone}`);
    }

    // 5. Construction du Payload enrichi pour n8n
    const payload = {
      wamid,
      phone, // Numéro client normalisé
      name: value.contacts?.[0]?.profile?.name || "Client",
      text: message.text?.body || "",
      timestamp: message.timestamp,
      vendor_phone, // Clé de recherche Google Sheets
      phone_id_vendeur // ID pour l'URL de réponse Meta
    };

    console.log(`📨 Envoi vers n8n pour le vendeur : ${vendor_phone}`);

    // 6. Transfert vers le workflow n8n
    await axios.post(N8N_WEBHOOK_URL, payload, { timeout: 5000 });
    
    return res.sendStatus(200);
    
  } catch (err) {
    console.error("❌ Erreur de transfert vers n8n :", err.message);
    // On répond 200 à Meta pour éviter les renvois en boucle en cas d'erreur n8n
    return res.sendStatus(200);
  }
});

// ===== DÉMARRAGE DU SERVEUR =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 MAVA Hub actif sur le port ${PORT}`);
  console.log(`📍 Route Webhook : https://[ton-url-render]/webhook`);
});



