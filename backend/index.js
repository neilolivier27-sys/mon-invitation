const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const FICHIER_REPONSES = path.join(__dirname, 'reponse.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/reponse', (req, res) => {
    const nouvelleReponse = {
        ...req.body,
        date_envoi: new Date().toISOString()
    };

    let reponses = [];
    if (fs.existsSync(FICHIER_REPONSES)) {
        reponses = JSON.parse(fs.readFileSync(FICHIER_REPONSES, 'utf-8'));
    }

    // Normalisation du nom pour comparer sans tenir compte des espaces superflus ou de la casse
    const nomNormalise = (nouvelleReponse.nom || '').trim().toLowerCase();

    const indexExistant = reponses.findIndex(
        r => r.id === nouvelleReponse.id
    );

    if (indexExistant !== -1) {
        // Une réponse avec ce nom existe déjà : on la remplace
        reponses[indexExistant] = nouvelleReponse;
    } else {
        // Nouvelle personne : on ajoute
        reponses.push(nouvelleReponse);
    }

    fs.writeFileSync(FICHIER_REPONSES, JSON.stringify(reponses, null, 2));

    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server listen at port ${PORT}`);
});