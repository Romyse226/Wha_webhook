const express = require('express');
const axios = require('axios'); // Ajouté pour parler à n8n
const app = express();
const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'MAVA_SECRET_2025';

// REMPLACE l'URL ci-dessous par ton URL de Webhook n8n (Production ou Test)
const N8N_WEBHOOK_URL = 'ton-lien-n8n.cloud';

app.use(express.json());

// Validation pour Meta
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

// Réception du message et transfert vers n8n
app.post('/webhook', async (req, res) => {
  console.log('📩 Message reçu de Meta, transfert vers n8n...');
  
  try {
    // On envoie le message reçu directement à n8n
    await axios.post(N8N_WEBHOOK_URL, req.body);
    console.log('🚀 Transmis à n8n avec succès');
  } catch (error) {
    console.error('❌ Erreur de transfert vers n8n :', error.message);
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`🚀 MAVA Backend actif sur le port ${PORT}`);
});
