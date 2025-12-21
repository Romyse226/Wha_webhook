const express = require('express');
const axios = require('axios'); 
const app = express();

// Configuration fixe 2025
const PORT = process.env.PORT || 10000;
const VERIFY_TOKEN = 'MAVA_SECRET_2025';
const N8N_WEBHOOK_URL = 'https://romyse226.app.n8n.cloud/webhook-test/whatsapp-in';

app.use(express.json());

// 1. Validation automatique pour Meta
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('✅ Webhook Meta validé !');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// 2. Réception et transfert immédiat vers n8n
app.post('/webhook', async (req, res) => {
  // Réponse immédiate à Meta pour éviter les timeouts
  res.sendStatus(200);

  try {
    // Transfert vers ton n8n (mode test)
    await axios.post(N8N_WEBHOOK_URL, req.body, {
      headers: { 'Content-Type': 'application/json' }
    });
    console.log('🚀 Message transmis avec succès à n8n');
  } catch (error) {
    console.error('❌ Erreur de transfert vers n8n :', error.message);
  }
});

// 3. Réponse propre pour l'accueil (UptimeRobot)
app.get('/', (req, res) => {
  res.status(200).send('MAVA Backend is Live 🚀');
});

app.listen(PORT, () => {
  console.log(`🚀 MAVA Backend actif sur le port ${PORT}`);
});

});


