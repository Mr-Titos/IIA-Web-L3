const express = require('express');
const cors = require('cors');
const BDD = require('./bdd.js');
const logger = require('./logger.js');
const app = express();
const port = 3001;

var USERS = [];
var CLIENTS = [];
var GRADES = [];

async function synchroBDD() {
    Promise.all([
        // Only User & Grade are stored in cache as it will not cost too much memory
        BDD.synchroUser(),
        BDD.synchroGrade()
    ]).then(values => {
            USERS = values[0];
            GRADES = values[1];
        })
        .catch(error => console.error(error))
        .finally(() => logger(`Cache updated`));
       
    // Reset cache / 5 minutes
    setTimeout(synchroBDD, 60_000 * 5);
}

synchroBDD();

app.use(cors());
app.use(express.json());

function getToken() {
    // TODO
    return "123456789";
}

// Intercepteur de requête
app.use((req, res, next) => {
    /*if (req.url.split('/').at(2) == "client") {
        res.statusCode = 401;
        res.end();
    }*/
    logger(`Requête ${req.method} ${req.path.split('/').at(2)} ${res.statusCode} - ${"TODO : UTILISATEUR NOM"}`)
    
    if (res.statusCode != 401) {
        next();
    }
})

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
    var token = isValid ? getToken() : "";

    res.statusCode = isValid ? 200 : 401;
    res.json({token: token, msgError: msgError});
});

// -----------------------------USER----------------------------
// Route GET
app.get('/api/user/:id', (req, res) => {
    var usr = USERS.find(x => x.id == req.params.id);
    usr != null ? res.json(usr) : res.sendStatus(204);
});
/*
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
});*/

// ---------------------------CLIENTS----------------------------
// Route GET
app.get('/api/client/', (req, res) => {
    const filters = req.query.filters;
    BDD.GET(req.path.split('/').at(2), filters).then(result => {
        result.length > 0 ? res.json(result) : res.sendStatus(204)
    }).catch(err => {
        res.status(500).json(err.message);
        console.error(err);
    })
});

// ---------------------------COMMANDE----------------------------
app.get('/api/commande/', (req, res) => {
    const filters = req.query.filters;
    BDD.GET(req.path.split('/').at(2), filters).then(result => {
        result.length > 0 ? res.json(result) : res.sendStatus(204)
    }).catch(err => {
        res.status(500).json(err.message);
        console.error(err);
    })
});

// ---------------------------VENDEUR----------------------------
app.get('/api/vendeur/', (req, res) => {
    const filters = req.query.filters;
    BDD.GET(req.path.split('/').at(2), filters).then(result => {
        result.length > 0 ? res.json(result) : res.sendStatus(204)
    }).catch(err => {
        res.status(500).json(err.message);
        console.error(err);
    })
});

// ---------------------------REGION----------------------------
app.get('/api/region/', (req, res) => {
    const filters = req.query.filters;
    BDD.GET(req.path.split('/').at(2), filters).then(result => {
        result.length > 0 ? res.json(result) : res.sendStatus(204)
    }).catch(err => {
        res.status(500).json(err.message);
        console.error(err);
    })
});


app.listen(port, () => {
  logger(`Serveur démarré sur le port ${port}`);
});