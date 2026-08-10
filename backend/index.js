const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const FICHIER_REPONSES = path.join(__dirname, 'reponse.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const multer = require('multer');

// Configuration : où et comment sauvegarder les photos
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const dossier = path.join(__dirname, '..', 'photos');
        // Crée le dossier s'il n'existe pas
        if (!fs.existsSync(dossier)) {
            fs.mkdirSync(dossier);
        }
        cb(null, dossier);
    },
    filename: function(req, file, cb) {
        // Nom du fichier : id-de-l-invité + extension originale
        // ex: "3f9a2b10.jpg"
        const ext = path.extname(file.originalname);
        cb(null, req.body.id + ext);
    }
});

// Limite à 5 Mo
const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function(req, file, cb) {
        // On accepte seulement les images
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Seules les images sont acceptées'));
        }
        cb(null, true);
    }
});

// Route unique pour enregistrer la réponse avec photo éventuelle
app.post('/api/reponse', upload.single('photo'), (req, res) => {
    const nouvelleReponse = {
        ...req.body,
        photo: req.file ? req.file.filename : null,
        date_envoi: new Date().toISOString()
    };

    let reponses = [];
    if (fs.existsSync(FICHIER_REPONSES)) {
        reponses = JSON.parse(fs.readFileSync(FICHIER_REPONSES, 'utf-8'));
    }

    const indexExistant = reponses.findIndex(
        r => r.id === nouvelleReponse.id
    );

    if (indexExistant !== -1) {
        reponses[indexExistant] = nouvelleReponse;
    } else {
        reponses.push(nouvelleReponse);
    }

    fs.writeFileSync(FICHIER_REPONSES, JSON.stringify(reponses, null, 2));

    res.json({ success: true });
});

// ----- Export CSV pprotégé par mot de passe -----
const MOT_DE_PASSE_ADMIN = process.env.ADMIN_PASSWORD || "anniversaire80";

app.get("/admin/export", (req, res) => {
    // Vérification du mot de passe passé en paramètre d'url
    if (req.query.pwd !== MOT_DE_PASSE_ADMIN) {
        return res.status(401).send("Accès non autorisé.");
    }

    // Lecture des réponses
    if (!fs.readFileSync(FICHIER_REPONSES)) {
        return res.status(404).send("Aucune réponse enregistrée pour l'instant.");
    }

    const reponses = JSON.parse(fs.readFileSync(FICHIER_REPONSES, 'utf-8'));

    if (reponses.length === 0) {
        return res.status(404).send("Aucune réponse enregistrée pour l'instant.");
    }

    // Construction du csv
    // On définit les colonnes dans l'ordre voulu
    const colonnes = ['nom', 'presence', 'adultes', 'enfants', 'total', 'vegetariens', 'msg_livredor'];
    const entetes = ['Nom', 'Presence', 'Adultes', 'Enfants', 'Total', 'Végétariens', 'Message'];
    
    function echapper(valeur) {
        if (valeur === undefined || valeur === null) return "";
        const str = String(valeur);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    const lignes = reponses.map(r => 
        colonnes.map(col => echapper(r[col])).join(',')
    );

    const csv = [entetes.join(','), ...lignes].join('\n');

    // Envoi du fichier CSV en téléchargement
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="reponses-invites.csv"');
    res.send('\uFEFF' + csv);
});

// ---- Dashboard admin ----
app.get('/admin/dashboard', (req, res) => {
    if (req.query.pwd !== MOT_DE_PASSE_ADMIN) {
        return res.status(401).send("Accès non autorisé.");
    }

    // Lecture des réponses
    if (!fs.readFileSync(FICHIER_REPONSES)) {
        return res.status(404).send("Aucune réponse enregistrée pour l'instant.");
    }

    const reponses = JSON.parse(fs.readFileSync(FICHIER_REPONSES, 'utf-8'));

    // Calcul des stats 
    const nbOui = reponses.filter(r => r.presence === "oui").length;
    const nbNon = reponses.filter(r => r.presence === "non").length;
    const nbIncertain = reponses.filter(r => r.presence === "uncertain").length;
    const totalAdultes = reponses.reduce((sum, r) => sum + parseInt(r.adultes || 0), 0);
    const totalEnfants = reponses.reduce((sum, r) => sum + parseInt(r.enfants || 0), 0);
    const totalPersonnes = totalAdultes + totalEnfants;
    const totalVegetariens = reponses.reduce((sum, r) => sum + parseInt(r.vegetariens || 0), 0);

    // Libellé listible pour la présence
        function labelPresence(val) {
        switch (val) {
            case "oui":       return { texte: "✓ Présent",    couleur: "#eef5e9", texteColor: "#3a6b2a" };
            case "non":       return { texte: "✗ Absent",     couleur: "#fdecea", texteColor: "#a02020" };
            case "uncertain": return { texte: "? Incertain",  couleur: "#fdf6e3", texteColor: "#7a5c00" };
            default:          return { texte: val,            couleur: "#f0f0f0", texteColor: "#333"    };
        }
    }
 
    // Formatage de la date
    function formatDate(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
 
    // Génération des lignes du tableau
    const lignes = reponses.map(r => {
        const p = labelPresence(r.presence);
        return `
        <tr>
            <td>${r.nom || ''}</td>
            <td><span class="badge" style="background:${p.couleur}; color:${p.texteColor}">${p.texte}</span></td>
            <td class="center">${r.adultes || 0}</td>
            <td class="center">${r.enfants || 0}</td>
            <td class="center"><strong>${r.total || 0}</strong></td>
            <td class="center"><strong>${r.vegetariens || 0}</strong></td>
            <td class="message">${r['msg_livredor'] || '<span class="vide">—</span>'}</td>
            <td class="date">${formatDate(r.date_envoi)}</td>
        </tr>`;
    }).join('');
 
    res.send(`<!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard — Anniversaire Jean-Michel</title>
        <style>
            :root {
                --cream: #fff3eb;
                --accent: #d65a5a;
                --accent-dark: #bf4b4b;
                --gold: #f7b8ab;
                --sage: #6b7a56;
                --ink: #3d2f2f;
                --border: #e4d3cf;
                --muted: #7a6a66;
            }
    
            * { box-sizing: border-box; margin: 0; padding: 0; }
    
            body {
                font-family: 'Inter', sans-serif;
                background: var(--cream);
                color: var(--ink);
                padding: 32px 24px;
                min-height: 100vh;
            }
    
            h1 {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 6px;
            }
    
            .subtitle {
                font-size: 14px;
                color: var(--muted);
                margin-bottom: 32px;
            }
    
            /* Stats */
            .stats {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
                gap: 16px;
                margin-bottom: 32px;
            }
    
            .stat {
                background: #fff;
                border: 1px solid var(--border);
                border-radius: 16px;
                padding: 18px 20px;
            }
    
            .stat .label {
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.06em;
                color: var(--muted);
                margin-bottom: 6px;
            }
    
            .stat .value {
                font-size: 28px;
                font-weight: 700;
                color: var(--ink);
            }
    
            .stat.accent  { border-top: 4px solid var(--accent); }
            .stat.sage    { border-top: 4px solid var(--sage); }
            .stat.gold    { border-top: 4px solid #c9922a; }
            .stat.muted   { border-top: 4px solid var(--muted); }
    
            /* Barre d'actions */
            .toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 16px;
                flex-wrap: wrap;
                gap: 12px;
            }
    
            .toolbar h2 {
                font-size: 17px;
                font-weight: 600;
            }
    
            .btn-export {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: var(--accent);
                color: #fff;
                font-size: 14px;
                font-weight: 600;
                padding: 10px 20px;
                border-radius: 100px;
                text-decoration: none;
                transition: background 0.15s;
            }
    
            .btn-export:hover { background: var(--accent-dark); }
    
            /* Tableau */
            .table-wrap {
                background: #fff;
                border: 1px solid var(--border);
                border-radius: 16px;
                overflow: auto;
            }
    
            table {
                width: 100%;
                border-collapse: collapse;
                font-size: 14px;
                table-layout: fixed;
            }

            thead tr {
                background: var(--ink);
                color: #fff;
            }

            th {
                padding: 12px 16px;
                text-align: left;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.05em;
                white-space: nowrap;
                vertical-align: middle;
            }

            td {
                padding: 12px 16px;
                border-top: 1px solid var(--border);
                vertical-align: middle;
            }

            tr:hover td { background: #fff8f5; }

            th:nth-child(1), td:nth-child(1) {
                width: 10%;
                font-size: 12px;
            }
            th:nth-child(2), td:nth-child(2) { width: 9%; }
            th:nth-child(3), td:nth-child(3),
            th:nth-child(4), td:nth-child(4),
            th:nth-child(5), td:nth-child(5),
            th:nth-child(6), td:nth-child(6) {
                width: 10%;
                text-align: center;
            }
            th:nth-child(7), td:nth-child(7) { width: 22%; }
            th:nth-child(8), td:nth-child(8) { width: 10%; }

            td.center {
                text-align: center;
            }

            td.message {
                max-width: 240px;
                font-size: 13px;
                color: var(--muted);
                line-height: 1.4;
            }
    
            td.date {
                white-space: nowrap;
                font-size: 12px;
                color: var(--muted);
            }
    
            .badge {
                display: inline-block;
                padding: 3px 10px;
                border-radius: 100px;
                font-size: 12px;
                font-weight: 600;
            }
    
            .vide { color: #ccc; }
    
            .empty {
                text-align: center;
                padding: 48px;
                color: var(--muted);
                font-size: 15px;
            }
    
            @media (max-width: 600px) {
                body { padding: 20px 14px; }
            }
        </style>
    </head>
    <body>
    
        <h1>🎂 Anniversaire Jean-Michel — 80 ans</h1>
        <p class="subtitle">Dashboard des réponses · ${reponses.length} réponse(s) reçue(s)</p>
    
        <div class="stats">
            <div class="stat accent">
                <div class="label">Présents</div>
                <div class="value">${nbOui}</div>
            </div>
            <div class="stat muted">
                <div class="label">Absents</div>
                <div class="value">${nbNon}</div>
            </div>
            <div class="stat gold">
                <div class="label">Incertains</div>
                <div class="value">${nbIncertain}</div>
            </div>
            <div class="stat sage">
                <div class="label">Adultes</div>
                <div class="value">${totalAdultes}</div>
            </div>
            <div class="stat sage">
                <div class="label">Enfants</div>
                <div class="value">${totalEnfants}</div>
            </div>
            <div class="stat accent">
                <div class="label">Total personnes</div>
                <div class="value">${totalPersonnes}</div>
            </div>
            <div class="stat accent">
                <div class="label">Total végétariens</div>
                <div class="value">${totalVegetariens}</div>
            </div>
        </div>
    
        <div class="toolbar">
            <h2>Liste des invités</h2>
            <a class="btn-export" href="/admin/export?pwd=${req.query.pwd}">⬇ Télécharger en CSV</a>
        </div>
    
        <div class="table-wrap">
            ${reponses.length === 0
                ? '<p class="empty">Aucune réponse reçue pour l\'instant.</p>'
                : `<table>
                    <thead>
                        <tr>
                            <th>Nom</th>
                            <th>Présence</th>
                            <th>Adultes</th>
                            <th>Enfants</th>
                            <th>Total</th>
                            <th>Végétariens</th>
                            <th>Message</th>
                            <th>Date d'envoi</th>
                        </tr>
                    </thead>
                    <tbody>${lignes}</tbody>
                </table>`
            }
        </div>
    
    </body>
    </html>`);

});

// Servir le dossier photos uniquement avec le bon mot de passe
app.get('/admin/photos', (req, res) => {
    if (req.query.pwd !== MOT_DE_PASSE_ADMIN) {
        return res.status(401).send("Accès non autorisé.");
    }

    const dossier = path.join(__dirname, '..', 'photos');
    if (!fs.existsSync(dossier)) {
        return res.send("Aucune photo reçue pour l'instant.");
    }

    const fichiers = fs.readdirSync(dossier);
    const reponses = JSON.parse(fs.readFileSync(FICHIER_REPONSES, 'utf-8'));

    const images = fichiers.map(f => {
        // On retrouve le nom de l'invité à partir du nom du fichier (= son id)
        const id = path.basename(f, path.extname(f));
        const invite = reponses.find(r => r.id === id);
        return `
            <div style="text-align:center; margin-bottom:24px;">
                <img src="/admin/photo/${f}?pwd=${req.query.pwd}" 
                     style="max-width:300px; border-radius:12px;">
                <p style="margin-top:8px; font-weight:600;">
                    ${invite ? invite.nom : 'Inconnu'}
                </p>
            </div>`;
    }).join('');

    res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Photos invités</title></head>
<body style="font-family:sans-serif; padding:32px; background:#fff3eb;">
    <h1>📸 Photos des invités</h1>
    <p>${fichiers.length} photo(s) reçue(s)</p>
    <div style="display:flex; flex-wrap:wrap; gap:24px; margin-top:32px;">
        ${images.length ? images : '<p>Aucune photo pour l\'instant.</p>'}
    </div>
</body></html>`);
});

// Route pour servir chaque photo individuellement
app.get('/admin/photo/:filename', (req, res) => {
    if (req.query.pwd !== MOT_DE_PASSE_ADMIN) {
        return res.status(401).send("Accès non autorisé.");
    }
    const filePath = path.join(__dirname, '..', 'photos', req.params.filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send("Photo introuvable.");
    }
    res.sendFile(filePath);
});

app.listen(PORT, () => {
    console.log(`Server listen at port ${PORT}`);
});