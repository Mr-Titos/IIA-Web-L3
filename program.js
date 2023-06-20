const express = require('express');
const cors = require('cors');
const BDD = require('./bdd.js');
const User = require('./modèles/user.js');
const { DateTime } = require('mssql');
const app = express();
const port = 3000;

var USERS = [];
var REGIONS = [];
var CLIENTS = [];

async function synchroBDD() {
    Promise.all([BDD.synchroUser(), BDD.synchroRegion(), BDD.synchroClient()])
        .then(values => {
            USERS = values[0];
            REGIONS = values[1];
            CLIENTS = values[2];
        })
        .catch(error => console.error(error))
        .finally(() => console.log("Cache updated"));
    
    // Reset cache toutes les 5 minutes
    setTimeout(synchroBDD, 60_000 * 5);
}

synchroBDD();

app.use(cors());
app.use(express.json());

function getToken() {
    // TODO
    return "123456789";
}

// Intercepteur a utiliser pour le token
/*app.use((req, res, next) => {
    express.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
})*/

// Route LOGIN
app.post('/api/login', (req, res) => {
    const body = req.body;
    var msgError = "";
    var pwd = body.passwordLogin != undefined ? body.passwordLogin : null;
    var email = body.emailLogin != undefined ? body.emailLogin : null;

    var isValid = true;
    var usr = USERS.find(u => u.email == email);
    if (usr != null) {
        isValid = pwd == usr.password;
        msgError = isValid ? "" : "Mot de passe incorrect.";
    } else {
        isValid = false;
        msgError = "Utilisateur introuvable."
    }
    var token = "";
    if (isValid) {
        console.log(`Utilisateur ${usr.userName} connecté : ${Date.now().toLocaleString()}`);
        token = getToken();
    }

    // Faire une liste des ip authorisées via un fichier de conf externe.
    /*res.setHeader('Access-Control-Allow-Origin', `*`);
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');*/

    res.statusCode = isValid ? 200 : 401;
    res.json({token: token, msgError: msgError});
});

// Route GET
app.get('/api/user/:id', (req, res) => {
    var usr = USERS.find(x => x.id == req.params.id);
    usr != null ? res.json(usr) : res.sendStatus(204);
});

// Route POST
app.post('/api/ressource', (req, res) => {
  const nouvelleRessource = req.body;
  // Enregistrement dans une base de données
  res.status(201).json(nouvelleRessource);
});

// Route PUT
app.put('/api/ressource/:id', (req, res) => {
  const resourceId = req.params.id;
  // Logique pour mettre à jour la ressource avec l'ID donné
  res.sendStatus(204); // Réponse avec succès, pas de contenu à renvoyer
});

// Route DELETE
app.delete('/api/ressource/:id', (req, res) => {
  const resourceId = req.params.id;
  // Supprimer de la base de données
  res.sendStatus(204); // Réponse avec succès, pas de contenu à renvoyer
});

// -----------------------------CLIENTS----------------------------
// Route GET
app.get('/api/client/:id', (req, res) => {
    var result = CLIENTS.find(x => x.id == req.params.id);
    result != null ? res.json(result) : res.sendStatus(204);
});

// Route GET
app.get('/api/client/', (req, res) => {
    var result = CLIENTS;
    result.length > 0 ? res.json(result) : res.sendStatus(204);
});

app.listen(port, () => {
  console.log(`Serveur démarré sur le port ${port}`);
});