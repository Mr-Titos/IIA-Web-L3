const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');

const {serverPort, app} = require('./config.js');
const BDD = require('./bdd.js');
const TOKEN = require('./token.js');
const LOGGER = require('./logger.js');
const MAILER = require('./mailer.js');

const corsOptions = {
    origin: '127.0.0.1' // Compliant
};

const endpointsNoLogin = [
    "login",
    "disconnect",
    "resetpassword",
    "emailpassword",
    "tokenpassword",
    "signup"
]
let USERS = [];
let COMMANDESGRP = [];

async function synchroBDD() {
    Promise.all([
        // Only some data is stored in cache as it will cost too much memory
        BDD.synchroUser(),
        BDD.synchroCommandsGrouped()
    ]).then(values => {
            USERS = values[0];
            COMMANDESGRP = values[1];
        })
        .catch(error => console.error(error))
        .finally(() => LOGGER(`Cache updated`));

    // Reset cache / 5 minutes
    setTimeout(synchroBDD, 60_000 * 5); 
}

synchroBDD();

function isAuth(token) {
    try {
        const tokenValid = TOKEN.verifyToken(token);
        return tokenValid && USERS.find(x => x.token == token) != undefined;
    } catch(err) {
         // Remove token from cache/db
         let usr = USERS.find(x => x.token == token);
         if (usr != undefined) {
             usr.token = "";
             BDD.updateUser(usr, false);
             LOGGER(`USER ${usr.userName}'s token has been purged`);
         }
    }
}

function generateTokenPwd(user) {
    user.tokenPwd = TOKEN.createToken(user.email);
    BDD.updateUser(user, false);
    return user.tokenPwd;
}

function checkPasswordUser(password, hashedPassword) {
    return bcrypt.compareSync(password, hashedPassword);
}

function filterCommandsGrouped(filters) {
    let resultGrouped = COMMANDESGRP;
    if (filters.vendeur != undefined && filters.vendeur != '')
        resultGrouped = resultGrouped.filter(x => x.vendeur.NOMVend.toLowerCase().includes(filters.vendeur.toLowerCase()));
    if (filters.region != undefined && filters.region != '')
        resultGrouped = resultGrouped.filter(x => x.region.LIBEReg.toLowerCase().includes(filters.region.toLowerCase()));
    if (filters.client != undefined && filters.client != '')
        resultGrouped = resultGrouped.filter(x => x.client.NOMCli.toLowerCase().includes(filters.client.toLowerCase()));
    return resultGrouped;
}

app.use(cors(corsOptions));
app.use(express.json());

// Intercepteur de requête
app.use((req, res, next) => {
    let token = req.headers.authorization == undefined ? "" 
    : req.headers.authorization.split(' ')[1];

    if (!endpointsNoLogin.includes(req.path.split('/').at(2))) {
        if (!isAuth(token)) {
            res.sendStatus(403);
            res.end();
            return;
        }
    }

    const usr = USERS.find(x => x.token == token && token);
    const msgName = usr != undefined ? `: ${usr.userName} (${usr.id})` : ""
    LOGGER(`Requête ${req.method} ${req.path.split('/').at(2)} ${msgName} : ${req.ip}`)
    next();
})

// Route LOGIN
app.post('/api/login', (req, res) => {
    const body = req.body;
    let msgError = "";
    let pwd = body.passwordLogin != undefined ? body.passwordLogin : null;
    let email = body.emailLogin != undefined ? body.emailLogin : null;

    let isValid = true;
    let usr = USERS.find(u => u.email == email);
    if (usr != null) {
       isValid = checkPasswordUser(pwd, usr.password);
        if (!isValid) {
            msgError = "Mot de passe incorrect.";
        }
    } else {
        isValid = false;
        msgError = "Utilisateur introuvable."
    }

    if (isValid) {
        BDD.updateUser(usr, false);
        usr.token = TOKEN.createToken(usr);
    }

    res.statusCode = isValid ? 200 : 401;
    res.json(
        {user: {
            userName : isValid ? usr.userName : "",
            email : isValid ? usr.email : "",
            grade : isValid ? usr.grade : "",
            token : isValid ? usr.token : ""
        },
        msgError: msgError});
});

app.post('/api/disconnect', (req, res) => {
    let token = req.headers.authorization;
    token = token != undefined ? token.split(' ')[1] : "";
    let usr = USERS.find(x => x.token == token);
    if (usr != undefined) {
        usr.token = "";
        BDD.updateUser(usr, false).then(() => LOGGER(`USER ${usr.userName}'s token has been purged`));
        res.sendStatus(200);
    } else {
        res.sendStatus(500);
    }
});

// -----------------------------USER----------------------------
// Route GET
app.get('/api/user/:id', (req, res) => {
    let usr = USERS.find(x => x.id == req.params.id);
    usr != null ? res.json(usr) : res.sendStatus(204);
});

app.post('/api/signup', (req, res) => {
    const body = req.body;
    if (!body.userName || !body.email || !body.password) {
        res.sendStatus(400);
    } else {
        try {
            BDD.createUser(body.userName, body.email, body.password);
            BDD.synchroUser().then(usr => USERS = usr);
            res.sendStatus(204);
        } catch(err) {
            res.sendStatus(400);
        }
    }
});

// Route PUT
app.put('/api/user/', (req, res) => {
    const tokenUser = TOKEN.getDecodedToken(req.headers.authorization.split(' ')[1])
    let user = USERS.find(x => x.id == tokenUser.id);
    const oldHashedPwd = user.password;
    if (checkPasswordUser(req.body.oldPwd, oldHashedPwd)) {
        const updatePwd = req.body.newPwd != undefined && req.body.newPwd != "" && req.body.newPwd != req.body.oldPwd;
        user.password = updatePwd ? req.body.newPwd : oldHashedPwd;

        user.userName = req.body.userName != undefined && req.body.userName != "" 
        ? req.body.userName : user.userName;
        
        user.token = updatePwd ? "" : user.token;

        BDD.updateUser(user, updatePwd);
        res.sendStatus(204);
    } else {
        res.sendStatus(403);
    }
});

// ---------------------------PASSWORD----------------------------
app.get('/api/emailpassword/', (req, res) => {
    const email = req.query.email
    let usr = USERS.find(x => x.email == email);
    if (usr != null) {
        MAILER.sendResetPasswordMail(usr.email, generateTokenPwd(usr));
        res.sendStatus(204)
    } else {
        res.sendStatus(403)
    }
});

app.get('/api/tokenpassword/', (req, res) => {
    const tokenPwd = req.query.tokenPwd
    let usr = USERS.find(x => x.tokenPwd == tokenPwd);
    usr != null ? res.sendStatus(204) : res.sendStatus(403);
});

app.put('/api/resetpassword/', (req, res) => {
    const tokenPwd = req.body.tokenPwd;
    const newPassword = req.body.newPwd;
    let usr = USERS.find(x => x.tokenPwd == tokenPwd);
    if (usr != null && (newPassword != null && newPassword != '')) {
        usr.password = newPassword;
        usr.tokenPwd = "";
        BDD.updateUser(usr).then(() => {
            res.sendStatus(204);
        });
    } else {
        res.sendStatus(403)
    }
});

// ---------------------------CLIENTS----------------------------
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
    const isGrouped = req.query.grouped;
    if (isGrouped == "true") {
        let commandsFiltered = filterCommandsGrouped(filters);
        commandsFiltered.length > 0 ? res.json(commandsFiltered) : res.sendStatus(204)
    } else {
        BDD.GET(req.path.split('/').at(2), filters).then(result => {
            result.length > 0 ? res.json(result) : res.sendStatus(204)
        }).catch(err => {
            res.status(500).json(err.message);
        })
    }
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


app.listen(serverPort, () => {
  LOGGER(`Serveur démarré sur le port ${serverPort}`);
});