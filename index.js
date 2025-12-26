const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// 1. LA ROUTE GET (Pour la validation Meta)
app.get('/webhook', (req, res) => {
  // On utilise ton jeton choisi
  const VERIFY_TOKEN = "MAVA_SECRET_2025";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("WEBHOOK_VALIDE");
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

// 2. LA ROUTE POST (Pour envoyer les messages à n8n)
app.post('/webhook', async (req, res) => {
  try {
    // On envoie le message vers ton n8n Cloud
    await axios.post("mavabot.app.n8n.cloud", req.body);
    
    // On répond OK à Meta immédiatement
    res.sendStatus(200);
  } catch (error) {
    console.log("Erreur transfert n8n, mais on répond OK à Meta pour éviter les boucles");
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MAVA actif sur port ${PORT}`));






