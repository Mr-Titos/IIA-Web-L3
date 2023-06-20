class Vendeur {
    constructor(id, nom, pren) {
        this.id = id == null ? "" : id;
        this.nom = nom == null ? "" : nom;
        this.prenom = pren == null ? "" : pren;
    }
}
module.exports = Vendeur;