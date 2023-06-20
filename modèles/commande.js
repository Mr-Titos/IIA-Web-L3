const { DateTime } = require("mssql");
class Commande {
    constructor() {
        this.id = "";
        this.ca = null;
        this.date = new DateTime();
        this.idClient = "";
        this.idRegion = "";
    }
}
module.exports = Commande;