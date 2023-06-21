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
const Grade = require('./modèles/grade');
const Commande = require('./modèles/commande');

module.exports = {
    synchroUser : synchroUser,
    synchroGrade : synchroGrade,
    GET : get
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
                newUser.id = usr.IdUser
                newUser.userName = usr.NameUser;
                newUser.password = usr.PasswordUser;
                newUser.email = usr.EmailUser;
                newUser.grade = await getGradeNameByID(usr.GradeUser);
                users.push(newUser);
            });
            resolve(users);
        } catch (err) {
            reject(err);
        }
    });
}

async function get(endpoint, filters) {
    return new Promise(async (resolve, reject) => {
        try {
            await sql.connect(sqlConfig)
            let query = `SELECT obj.* from dbo.[${endpoint.toUpperCase()}] obj `;

            // If at least 1 filter is given in the request 
            if (filters) {
                switch(endpoint.toUpperCase()) {
                    case "COMMANDE":
                        query += constructJoinCommande(filters);
                        break;
                    case "CLIENT":
                        query += constructJoinClient(filters);
                        break;
                    case "VENDEUR":
                        // No need for any join
                        break;
                    case "REGION":
                        // No need for any join
                        break; 
                }
    
                if (filters.vendeur && filters.vendeur != '' || filters.region && filters.region != '' 
                || filters.client && filters.client != '' || filters.dateDebut && filters.dateDebut != '' 
                || filters.dateFin && filters.dateFin != '') {
                    query += ' WHERE 1=1 '
                }
                
                if (filters.vendeur && filters.vendeur != '') {
                    query += `AND NOMVend LIKE '%${filters.vendeur}%' `;
                }
                
                if (filters.region && filters.region != '') {
                    query += `AND LIBEReg LIKE '%${filters.region}%' `;
                }
    
                if (filters.client && filters.client != '') {
                    query += `AND NOMCli LIKE '%${filters.client}%' `;
                }
    
                if (endpoint.toUpperCase() == "COMMANDE") {
                    // Greater than
                    if ((filters.dateDebut &&filters.dateDebut != '' && filters.dateFin && filters.dateFin == '') 
                    || (filters.dateDebut && filters.dateDebut != '' && filters.dateFin && filters.dateFin != '')) {
                        query += `AND DATECom >= CONVERT(date, '${filters.dateDebut}', 120) `;
                    } 
                    // Lesser than
                    else if (filters.dateDebut && filters.dateDebut == '' && filters.dateFin && filters.dateFin != ''
                    || (filters.dateDebut && filters.dateDebut != '' && filters.dateFin && filters.dateFin != '')) {
                        query += `AND DATECom <= CONVERT(date, '${filters.dateFin}', 120) `
                    }
                }
            }
            
            //console.log(query)
            const queryResult = await sql.query(query);

            switch(endpoint.toUpperCase()) {
                case "COMMANDE":
                    await constructCommande(queryResult.recordset).then(res => resolve(res));
                    break;
                case "CLIENT":
                    await constructClients(queryResult.recordset).then(res => resolve(res));
                    break;
                case "VENDEUR":
                    await constructVendeur(queryResult.recordset).then(res => resolve(res));
                    break;
                case "REGION":
                    await constructRegion(queryResult.recordset).then(res => resolve(res));
                    break;
            }
        } catch (err) {
            reject(err);
        }
    });
}

function constructJoinCommande(filters) {
    let joints = "";
    if (filters.vendeur && filters.vendeur != '') {
        joints += `INNER JOIN dbo.VENDEUR v ON obj.VENDCom = v.IDVend `;
    }

    if (filters.region && filters.region != '') {
        joints += `INNER JOIN dbo.REGION r ON obj.REGICom = r.IDReg `;
    }
    
    if (filters.client && filters.client != '' && (filters.vendeur == '' || !filters.vendeur)) {
        joints += `INNER JOIN dbo.CLIENT cl ON obj.CLIECom = cl.IDCli `;
    }
    return joints;
}

function constructJoinClient(filters) {
    let joints = "";
    if (filters.vendeur && filters.vendeur != '') {
        joints += `INNER JOIN dbo.VENDEUR v ON obj.ID_VEND = v.ID `;
    }

    if (filters.region && filters.region != '') {
        joints += `INNER JOIN dbo.CLIENT_REGION cr ON obj.ID = cr.ID_CLIE `
        + `INNER JOIN dbo.REGION r ON cr.ID_REGI = r.ID `;
    }

    return joints;
}

async function constructClients(clientsData) {
    return new Promise(async (resolve, reject) => {
        try {
            var clients = [];
            for (let i = 0; i < clientsData.length; i++) {
                var newCli = new Client();
                newCli.id= clientsData[i].IDCli
                newCli.nom = clientsData[i].NOMCli
                newCli.regions = await getRegionsByClient(clientsData[i].IDCli);
                clients.push(newCli);
            }
            resolve(clients);
        } catch (err) {
            reject(err);
        }
    });
}

async function constructVendeur(vendeurData) {
    return new Promise((resolve, reject) => {
        try {
            var vendeurs = [];
            vendeurData.forEach(vend => {
                var newVend = new Vendeur();
                newVend.id= vend.IDVend
                newVend.nom = vend.NOMVend
                newVend.prenom = vend.PRENVend
                vendeurs.push(newVend);
            });
            resolve(vendeurs);
        } catch (err) {
            reject(err);
        }
    });
}

async function constructCommande(commandeData) {
    return new Promise(async (resolve, reject) => {
        try {
            var commandes = [];

            // Get all differents ID of objects that need another request
            var cLIEComsID = new Set();
            var rEGIComsID = new Set();
            var vENDComsID = new Set();
            for(var i = 0; i < commandeData.length; i++) {
                cLIEComsID.add(commandeData[i].CLIECom);
                rEGIComsID.add(commandeData[i].REGICom);
                vENDComsID.add(commandeData[i].VENDCom);
            }
            //console.log(rEGIComsID.)
            var rEGIComs = await getRegions(Array.from(rEGIComsID));
            for(let i = 0; i < commandeData.length; i++) {
                var newCom = new Commande();
                newCom.id = commandeData[i].IDCom;
                newCom.ca = commandeData[i].CA;
                newCom.date = commandeData[i].DATECom;
                await getClientByID(commandeData[i].CLIECom).then(cli => newCom.client = cli);
                newCom.region = await getRegionByID(commandeData[i].REGICom);
                await getVendeurByID(commandeData[i].VENDCom).then(ven => newCom.vendeur = ven);
                commandes.push(newCom);
            }

            resolve(commandes);
        } catch (err) {
            reject(err);
        }
    });
}

async function constructRegion(regionData) {
    return new Promise((resolve, reject) => {
        try {
            var region = [];
            for(let i = 0; i < regionData.length; i++) {
                var newReg = new Region();
                newReg.id= regionData[i].IDReg;
                newReg.libe = regionData[i].LIBEReg;
                region.push(newReg);
            }
            resolve(region);
        } catch (err) {
            reject(err);
        }
    });
}

async function synchroGrade() {
    return new Promise(async (resolve, reject) => {
        try {
            var grades = [];
            await sql.connect(sqlConfig)
            const result = await sql.query`select * from dbo.[GRADE]`;
            result.recordset.forEach(gra => {
                var newGra = new Grade();
                newGra.id= gra.IdGrade;
                newGra.nom = gra.LibGrade;
                grades.push(newGra);
            });
            resolve(grades);
        } catch (err) {
            reject(err);
        }
    });
}

async function getRegions(listIds) {
    console.log(listIds);
    // TODO Optimiser le chargement via une seule requête qui charge en mémoire toute
    // les régions / vendeurs / clients utile pour la commande.
    var stringIDs = "";
    for(var i = 0; i < listIds.size; i++) {
        stringIDs += listIds[i] + ','
    }
    console.log(stringIDs.substring(0, stringIDs.length - 1))
    const result = await sql.query`SELECT *
    FROM [IIA_WEBPROJECT].[dbo].[REGION] r
    WHERE IDReg IN (${stringIDs.substring(0, stringIDs.length - 1)})`;
    console.log(result.recordset);
    return result.recordset;
}

async function getRegionsByClient(idCli) {
    const result = await sql.query`SELECT DISTINCT LIBEReg, IDReg
    FROM [IIA_WEBPROJECT].[dbo].[COMMANDE] c
    INNER JOIN REGION r on r.IDReg = c.REGICom
    WHERE CLIECom = ${idCli}`;
    return result.recordset;
}

async function getGradeNameByID(idGrade) {
    const result = await sql.query`SELECT g.[LibGrade]
        FROM [dbo].[GRADE] g
        WHERE g.[IdGrade] = ${idGrade}`;
    return result.recordset.at(0).LibGrade;
}

async function getRegionByID(idRegion) {
    const result = await sql.query`SELECT *
        FROM [dbo].[REGION] r
        WHERE r.IDReg = ${idRegion}`;
    var newR = result.recordset.at(0);
    return new Region(newR.ID, newR.LIBE);
}

async function getClientByID(idClient) {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await sql.query`SELECT *
            FROM [dbo].[CLIENT] c
            WHERE c.IDCli = ${idClient}`;
            var newCli = result.recordset;
            constructClients(newCli).then(res => {
                resolve(res);
            }).catch(err => reject(err));
        } catch(err) {
            reject(err);
        }
    })
}

async function getVendeurByID(idVendeur) {
    return new Promise(async (resolve, reject) => {
        try {
            const result = await sql.query`SELECT *
            FROM [dbo].[VENDEUR] v
            WHERE v.IDVend = ${idVendeur}`;
            var newV = result.recordset;
            constructVendeur(newV).then(res => {
                resolve(res);
            }).catch(err => reject(err));
        } catch(err) {
            reject(err);
        }
    })
}