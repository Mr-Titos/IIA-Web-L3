const sql = require('mssql');
const bcrypt = require('bcrypt');

const {userNameSQL, passwordSQL, databaseSQL, serverSQL, encryptSQL, saltRounds} = require('./config');
const User = require('./modèles/user');
const Region = require('./modèles/region');
const Client = require('./modèles/client');
const Vendeur = require('./modèles/vendeur');
const Grade = require('./modèles/grade');
const Commande = require('./modèles/commande');

module.exports = {
    synchroUser : synchroUser,
    synchroGrade : synchroGrade,
    synchroCommandsGrouped : synchroCommandsGrouped,
    GET : get,
    updateUser : updateUser,
    createUser : createUser
  };

const sqlConfig = {
    user: userNameSQL,
    password: passwordSQL,
    database: databaseSQL,
    server: serverSQL,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: encryptSQL,
      trustServerCertificate: true // change to true for local dev / self-signed certs
    }
}

async function synchroUser() {
    return new Promise(async (resolve, reject) => {
        try {
            let users = [];
            await sql.connect(sqlConfig);
            const result = await sql.query`select * from dbo.[USER]`;
            result.recordset.forEach( async usr => {
                let newUser = new User();
                newUser.id = usr.IdUser
                newUser.userName = usr.NameUser;
                newUser.password = usr.PasswordUser;
                newUser.email = usr.EmailUser;
                newUser.grade = await getGradeNameByID(usr.GradeUser);
                newUser.token = usr.Token;
                newUser.tokenPwd = usr.TokenPwd;
                users.push(newUser);
            });
            resolve(users);
        } catch (err) {
            reject(err);
        }
    });
}

async function synchroCommandsGrouped() {
    return new Promise(async (resolve, reject) => {
        try {
            await sql.connect(sqlConfig);
            const result = await sql.query`
            SELECT CLIECom, REGICom, VENDCom , SUM(CA) AS TotalCA
            FROM COMMANDE c
            GROUP BY CLIECom, REGICom, VENDCom`;
            await createObjectToSend("commande", result).then(res => resolve(res));
        } catch (err) {
            reject(err);
        }
    });
}

function createGETQuery(query, filters, endpoint) {
// If at least 1 filter is given in the request 
    if (filters) {
        switch(endpoint.toUpperCase()) {
            case "COMMANDE":
                query += constructJoinCommande(filters);
                break;
            case "CLIENT":
                query += constructJoinClient(filters);
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
            if (filters.dateDebut && filters.dateDebut != '') {
                query += `AND DATECom >= CONVERT(date, '${filters.dateDebut}', 120) `;
            } 
            // Lesser than
            if (filters.dateFin && filters.dateFin != '') {
                query += `AND DATECom <= CONVERT(date, '${filters.dateFin}', 120) `
            }
        }
    }
    return query;
}

async function get(endpoint, filters) {
    return new Promise(async (resolve, reject) => {
        try {
            await sql.connect(sqlConfig)
            let initQuery = `SELECT obj.* from dbo.[${endpoint.toUpperCase()}] obj `;
            const query = createGETQuery(initQuery, filters, endpoint);            
            const queryResult = await sql.query(query);
            createObjectToSend(endpoint, queryResult).then(res => resolve(res)).catch(err => reject(err));
        } catch (err) {
            reject(err);
        }
    });
}

function createObjectToSend(endpoint, queryResult) {
    return new Promise((res,rej) => {
        switch(endpoint.toUpperCase()) {
            case "COMMANDE":
                constructCommande(queryResult.recordset).then(resp => res(resp)).catch(e => rej(e));
                break;
            case "CLIENT":
                constructClients(queryResult.recordset).then(resp => res(resp)).catch(e => rej(e));
                break;
            case "VENDEUR":
                constructVendeur(queryResult.recordset).then(resp => res(resp)).catch(e => rej(e));
                break;
            case "REGION":
                constructRegion(queryResult.recordset).then(resp => res(resp)).catch(e => rej(e));
                break;
            default:
                rej("EndPoint not recognized");
        }
    })
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
            let clients = [];
            for (let i = 0; i < clientsData.length; i++) {
                let newCli = new Client();
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
            let vendeurs = [];
            vendeurData.forEach(vend => {
                let newVend = new Vendeur();
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
            let commandes = [];

            // Get all differents ID of objects that need another request
            let cLIEComsID = new Set();
            let rEGIComsID = new Set();
            let vENDComsID = new Set();
            for(let i = 0; i < commandeData.length; i++) {
                cLIEComsID.add(commandeData[i].CLIECom);
                rEGIComsID.add(commandeData[i].REGICom);
                vENDComsID.add(commandeData[i].VENDCom);
            }

            let rEGIComs;
            let cLIEComs;
            let vENDComs;

            if (commandeData.length > 0) {
                rEGIComs = await getRegions(Array.from(rEGIComsID));
                cLIEComs = await getClients(Array.from(cLIEComsID));
                vENDComs = await getVendeurs(Array.from(vENDComsID));
            }

            for(let i = 0; i < commandeData.length; i++) {
                let newCom = new Commande();
                newCom.id = commandeData[i].IDCom != undefined ? commandeData[i].IDCom : "N/A";
                newCom.ca = commandeData[i].CA != undefined ? commandeData[i].CA : commandeData[i].TotalCA;
                newCom.date = commandeData[i].DATECom != undefined ? commandeData[i].DATECom : "N/A";
                newCom.client = cLIEComs.find(x => x.IDCli == commandeData[i].CLIECom);
                newCom.region = rEGIComs.find(x => x.IDReg == commandeData[i].REGICom);
                newCom.vendeur = vENDComs.find(x => x.IDVend == commandeData[i].VENDCom)
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
            let region = [];
            for(let i = 0; i < regionData.length; i++) {
                let newReg = new Region();
                newReg.id = regionData[i].IDReg;
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
            let grades = [];
            await sql.connect(sqlConfig)
            const result = await sql.query`select * from dbo.[GRADE]`;
            result.recordset.forEach(gra => {
                let newGra = new Grade();
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
    let stringIDs = "";
    for(let i = 0; i < listIds.length; i++) {
        stringIDs += listIds[i] + ','
    }
    stringIDs = '(' + stringIDs.substring(0, stringIDs.length - 1) + ')';
    
    let query1 = `SELECT *
    FROM [IIA_WEBPROJECT].[dbo].[REGION] r
    WHERE IDReg IN ${stringIDs}`;
    const result = await sql.query(query1);
    return result.recordset;
}

async function getClients(listIds) {
    let stringIDs = "";
    for(let i = 0; i < listIds.length; i++) {
        stringIDs += listIds[i] + ','
    }
    stringIDs = '(' + stringIDs.substring(0, stringIDs.length - 1) + ')';
    
    let query1 = `SELECT *
    FROM [IIA_WEBPROJECT].[dbo].[CLIENT]
    WHERE IDCli IN ${stringIDs}`;
    const result = await sql.query(query1);
    return result.recordset;
}

async function getVendeurs(listIds) {
    let stringIDs = "";
    for(let i = 0; i < listIds.length; i++) {
        stringIDs += listIds[i] + ','
    }
    stringIDs = '(' + stringIDs.substring(0, stringIDs.length - 1) + ')';
    
    let query1 = `SELECT *
    FROM [IIA_WEBPROJECT].[dbo].[VENDEUR]
    WHERE IDVend IN ${stringIDs}`;
    const result = await sql.query(query1);
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

function updateUser(user, updatePwd) {
    const hashedPwd = updatePwd ? hashPassword(user.password) : "";

    if (updatePwd)
        user.password = hashedPwd;
    
    const query = `UPDATE [IIA_WEBPROJECT].[dbo].[USER]
    SET [Token] = '${user.token}',
    [NameUser] = '${user.userName}',
    [EmailUser] = '${user.email}',
    [TokenPwd] = '${user.tokenPwd}'
    ${updatePwd ? `,[PasswordUser] = '${hashedPwd}'` : ``}
    WHERE [IdUser] = '${user.id}';`

    sql.query(query)
}

function createUser(userName, email, password) {
    const hashedPwd = hashPassword(password);
    
    const query = `INSERT INTO [USER] (NameUser, EmailUser, PasswordUser, GradeUser)
    VALUES ('${userName}', '${email}', '${hashedPwd}', 2);`
    sql.query(query)
}

function hashPassword(password) {
        return bcrypt.hashSync(password, bcrypt.genSaltSync(saltRounds))
}