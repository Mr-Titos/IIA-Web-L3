const server = "LVL3Q9D4BB3MTJ";
const database = "IIA_WEBPROJECT";
const userName = "IIA";
const password = "JoJoArt2023!!";
const encrypt = true;
const sql = require('mssql');
const User = require('./modèles/user');
const Region = require('./modèles/region');
const Client = require('./modèles/client');
const Vendeur = require('./modèles/vendeur');

module.exports = {
    synchroUser : synchroUser,
    synchroRegion : synchroRegion,
    synchroClient : synchroClient
  };

const sqlConfig = {
    user: userName,
    password: password,
    database: database,
    server: server,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: encrypt,
      trustServerCertificate: true // change to true for local dev / self-signed certs
    }
}

async function synchroUser() {
    return new Promise(async (resolve, reject) => {
        try {
            var users = [];
            await sql.connect(sqlConfig);
            const result = await sql.query`select * from dbo.[USER]`;
            result.recordset.forEach( async usr => {
                var newUser = new User();
                newUser.id = await usr.IdUser
                newUser.userName = await usr.NameUser;
                newUser.password = await usr.PasswordUser;
                newUser.email = await usr.EmailUser;

                users.push(newUser);
            });
            resolve(users);
        } catch (err) {
            reject(err);
        }
    });
}

async function synchroRegion() {
    return new Promise(async (resolve, reject) => {
        try {
            var regions = [];
            await sql.connect(sqlConfig)
            const result = await sql.query`select * from dbo.[REGION]`;
            result.recordset.forEach( regi => {
                var newRegi = new Region();
                newRegi.id= regi.ID
                newRegi.libe = regi.LIBE
                regions.push(newRegi);
            });
            resolve(regions);
        } catch (err) {
            reject(err);
        }
    });
}

async function getRegionsByClient(idCli) {
    const result = await sql.query`SELECT r.[LIBE]
    FROM [dbo].[REGION] r
    JOIN [dbo].CLIENT_REGION cr ON cr.ID_REGI = r.ID
    WHERE cr.ID_CLIE = ${idCli}`;
    return result.recordset;
}

async function getVendeurInfo(idVendeur) {
    const result = await sql.query`SELECT *
        FROM [dbo].[VENDEUR] r
        WHERE r.ID = ${idVendeur}`;
    var newV = result.recordset.at(0);
    return new Vendeur(newV.ID, newV.NOM, newV.PREN);
}

async function synchroClient() {
    return new Promise(async (resolve, reject) => {
        try {
            var clients = [];
            await sql.connect(sqlConfig)
            const result = await sql.query`select * from dbo.[CLIENT]`;
            result.recordset.forEach(async cli => {
                var newCli = new Client();
                newCli.id= cli.ID
                newCli.nom = cli.NOM
                newCli.regions = await getRegionsByClient(cli.ID);
                newCli.vendeur = await getVendeurInfo(cli.ID_VEND);

                clients.push(newCli);
            });
            resolve(clients);
        } catch (err) {
            reject(err);
        }
    });
}