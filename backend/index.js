const express = require("express");
const path = require("path");
const multer = require("multer");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3000;

// ---- Configuration (variables d'environnement, à définir sur Render) ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const MOT_DE_PASSE_ADMIN = process.env.ADMIN_PASSWORD;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("SUPABASE_URL et SUPABASE_SERVICE_KEY doivent être définis.");
    process.exit(1);
}
if (!MOT_DE_PASSE_ADMIN) {
    console.warn("ADMIN_PASSWORD n'est pas défini : les pages /admin seront inaccessibles.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
});

const TABLE = "reponses";
const BUCKET = "photos";
const ID_VALIDE = /^[A-Za-z0-9-]{8,64}$/;
const PRESENCES = ["oui", "non", "uncertain"];
const EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/heic": ".heic",
    "image/heif": ".heif"
};

app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ---- Réception des photos (en mémoire, puis envoyées vers Supabase) ----
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: function (req, file, cb) {
        if (!file.mimetype.startsWith("image/")) {
            return cb(new Error("Seules les images sont acceptées"));
        }
        cb(null, true);
    }
});

function recevoirPhoto(req, res, next) {
    upload.single("photo")(req, res, (err) => {
        if (err) {
            const message = err.code === "LIMIT_FILE_SIZE" ? "La photo dépasse 5 Mo." : err.message;
            return res.status(400).json({ success: false, error: message });
        }
        next();
    });
}

// ---- Utilitaires ----
function toInt(valeur, max = 50) {
    const n = parseInt(valeur, 10);
    if (isNaN(n) || n < 0) return 0;
    return Math.min(n, max);
}

function esc(valeur) {
    return String(valeur === undefined || valeur === null ? "" : valeur)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function parseNomsInvites(valeur) {
    if (!valeur) return "";
    if (Array.isArray(valeur)) return valeur.filter(Boolean).join(", ");
    if (typeof valeur === "string") {
        const texte = valeur.trim();
        if (!texte) return "";
        try {
            const parsed = JSON.parse(texte);
            if (Array.isArray(parsed)) return parsed.filter(Boolean).join(", ");
        } catch (e) {}
        return texte.replace(/^\[|\]$/g, "").replace(/['"]/g, "").split(",").map(i => i.trim()).filter(Boolean).join(", ");
    }
    return String(valeur);
}

async function lireReponses() {
    const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("date_envoi", { ascending: true });
    if (error) throw error;
    return data || [];
}

function adminOnly(req, res, next) {
    const nonAutorise = (code, message) =>
        req.method === "DELETE"
            ? res.status(code).json({ error: message })
            : res.status(code).send(message);

    if (!MOT_DE_PASSE_ADMIN) {
        return nonAutorise(503, "ADMIN_PASSWORD n'est pas configuré sur le serveur.");
    }
    if (req.query.pwd !== MOT_DE_PASSE_ADMIN) {
        return nonAutorise(401, "Accès non autorisé.");
    }
    next();
}

// ---- Santé (permet aussi de garder Supabase actif si on le ping) ----
app.get("/health", async (req, res) => {
    const { error } = await supabase.from(TABLE).select("id", { count: "exact", head: true });
    if (error) return res.status(500).send("Base de données injoignable.");
    res.send("ok");
});

// ---- Enregistrement d'une réponse ----
app.post("/api/reponse", recevoirPhoto, async (req, res) => {
    try {
        const { id, nom, presence } = req.body;

        // Refuse toute réponse vide ou invalide : on n'écrase jamais une réponse avec du vide
        if (!ID_VALIDE.test(id || "") || !nom || !nom.trim() || !PRESENCES.includes(presence)) {
            return res.status(400).json({ success: false, error: "Réponse incomplète." });
        }

        // Réponse existante (pour conserver la photo si aucune nouvelle n'est envoyée)
        const { data: ancienne, error: erreurLecture } = await supabase
            .from(TABLE)
            .select("photo")
            .eq("id", id)
            .maybeSingle();
        if (erreurLecture) throw erreurLecture;

        let photo = ancienne ? ancienne.photo : null;

        if (req.file) {
            const nouveauNom = id + (EXTENSIONS[req.file.mimetype] || ".jpg");
            const { error: erreurUpload } = await supabase.storage
                .from(BUCKET)
                .upload(nouveauNom, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: true
                });
            if (erreurUpload) throw erreurUpload;

            // Si l'ancienne photo avait une autre extension, on la supprime
            if (photo && photo !== nouveauNom) {
                await supabase.storage.from(BUCKET).remove([photo]);
            }
            photo = nouveauNom;
        }

        const ligne = {
            id,
            nom: nom.trim().slice(0, 200),
            presence,
            adultes: toInt(req.body.adultes),
            enfants: toInt(req.body.enfants),
            total: toInt(req.body.total),
            vegetariens: toInt(req.body.vegetariens),
            presence_dimanche: req.body.presence_dimanche === "oui" ? "oui" : "non",
            nb_pers_dimanche: toInt(req.body.nb_pers_dimanche),
            noms_invites: String(req.body.noms_invites || "[]").slice(0, 2000),
            msg_livredor: String(req.body.msg_livredor || "").slice(0, 2000),
            photo,
            date_envoi: new Date().toISOString()
        };

        const { error } = await supabase.from(TABLE).upsert(ligne, { onConflict: "id" });
        if (error) throw error;

        res.json({ success: true });
    } catch (err) {
        console.error("Erreur /api/reponse :", err);
        res.status(500).json({ success: false, error: "Erreur serveur." });
    }
});

// ---- Suppression d'une réponse par id ----
app.delete("/admin/supprimer/:id", adminOnly, async (req, res) => {
    try {
        const { data: lignes, error } = await supabase
            .from(TABLE)
            .delete()
            .eq("id", req.params.id)
            .select("photo");
        if (error) throw error;

        if (!lignes || lignes.length === 0) {
            return res.status(404).json({ error: "Réponse introuvable." });
        }

        const photo = lignes[0].photo;
        if (photo) {
            await supabase.storage.from(BUCKET).remove([photo]);
        }

        res.json({ success: true });
    } catch (err) {
        console.error("Erreur suppression :", err);
        res.status(500).json({ error: "Erreur serveur." });
    }
});

// ---- Export CSV ----
app.get("/admin/export", adminOnly, async (req, res) => {
    try {
        const reponses = await lireReponses();
        if (reponses.length === 0) {
            return res.status(404).send("Aucune réponse enregistrée pour l'instant.");
        }

        const colonnes = ["nom", "presence", "adultes", "enfants", "total", "vegetariens", "presence_dimanche", "nb_pers_dimanche", "noms_invites", "msg_livredor"];
        const entetes = ["Nom", "Présence", "Adultes", "Enfants", "Total", "Végétariens", "Dimanche midi", "Nb dimanche midi", "Accompagnants", "Message"];

        function echapper(valeur) {
            if (valeur === undefined || valeur === null) return "";
            const str = String(valeur);
            if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return '"' + str.replace(/"/g, '""') + '"';
            }
            return str;
        }

        const lignes = reponses.map(r =>
            colonnes.map(col => echapper(col === "noms_invites" ? parseNomsInvites(r[col]) : r[col])).join(",")
        );

        const csv = [entetes.join(","), ...lignes].join("\n");
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", 'attachment; filename="reponses-invites.csv"');
        res.send("\uFEFF" + csv);
    } catch (err) {
        console.error("Erreur export :", err);
        res.status(500).send("Erreur serveur.");
    }
});

// ---- Dashboard admin ----
app.get("/admin/dashboard", adminOnly, async (req, res) => {
    let reponses;
    try {
        reponses = await lireReponses();
    } catch (err) {
        console.error("Erreur dashboard :", err);
        return res.status(500).send("Erreur de connexion à la base de données.");
    }

    const nbOui = reponses.filter(r => r.presence === "oui").length;
    const nbNon = reponses.filter(r => r.presence === "non").length;
    const nbIncertain = reponses.filter(r => r.presence === "uncertain").length;
    const totalAdultes = reponses.reduce((sum, r) => sum + parseInt(r.adultes || 0, 10), 0);
    const totalEnfants = reponses.reduce((sum, r) => sum + parseInt(r.enfants || 0, 10), 0);
    const totalPersonnes = totalAdultes + totalEnfants;
    const totalVegetariens = reponses.reduce((sum, r) => sum + parseInt(r.vegetariens || 0, 10), 0);
    const totalDimancheMidi = reponses.reduce((sum, r) => sum + (r.presence_dimanche === "oui" ? parseInt(r.nb_pers_dimanche || 0, 10) : 0), 0);

    function labelPresence(val) {
        switch (val) {
            case "oui": return { texte: "✓ Présent", couleur: "#eef5e9", texteColor: "#3a6b2a" };
            case "non": return { texte: "✗ Absent", couleur: "#fdecea", texteColor: "#a02020" };
            case "uncertain": return { texte: "? Incertain", couleur: "#fdf6e3", texteColor: "#7a5c00" };
            default: return { texte: esc(val), couleur: "#f0f0f0", texteColor: "#333" };
        }
    }

    function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
    }

    const pwd = req.query.pwd;

    const lignes = reponses.map(r => {
        const p = labelPresence(r.presence);
        const accompagnants = parseNomsInvites(r.noms_invites);
        const totalDimanche = r.presence_dimanche === "oui" ? parseInt(r.nb_pers_dimanche || 0, 10) : 0;

        return `
        <tr>
            <td>${esc(r.nom)}</td>
            <td><span class="badge" style="background:${p.couleur}; color:${p.texteColor}">${p.texte}</span></td>
            <td class="center">${esc(r.adultes || 0)}</td>
            <td class="center">${esc(r.enfants || 0)}</td>
            <td class="center"><strong>${esc(r.total || 0)}</strong></td>
            <td class="center"><strong>${esc(r.vegetariens || 0)}</strong></td>
            <td class="accompagnants">${accompagnants ? esc(accompagnants) : '<span class="vide">—</span>'}</td>
            <td class="center"><strong>${totalDimanche}</strong></td>
            <td class="message">${r.msg_livredor ? esc(r.msg_livredor) : '<span class="vide">—</span>'}</td>
            <td class="date">${formatDate(r.date_envoi)}</td>
            <td class="center">
                <button class="btn-supprimer" data-id="${esc(r.id)}">Supprimer</button>
            </td>
        </tr>`;
    }).join("");

    const tableau = reponses.length === 0
        ? `<p class="empty">Aucune réponse reçue pour l'instant.</p>`
        : `<table>
                <thead>
                    <tr>
                        <th>Nom</th>
                        <th>Présence</th>
                        <th>Adultes</th>
                        <th>Enfants</th>
                        <th>Total</th>
                        <th>Végé</th>
                        <th>Accompagnants</th>
                        <th>Dimanche</th>
                        <th>Message</th>
                        <th>Date d'envoi</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${lignes}</tbody>
            </table>`;

    const pwdJs = JSON.stringify(pwd).replace(/</g, "\\u003c");

    res.send(`<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard — Anniversaire Jean-Michel</title>
    <style>
        :root {
            --cream: #fff3eb; --accent: #d65a5a; --accent-dark: #bf4b4b;
            --gold: #f7b8ab; --sage: #6b7a56; --ink: #3d2f2f;
            --border: #e4d3cf; --muted: #7a6a66;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: sans-serif; background: var(--cream); color: var(--ink); padding: 32px 24px; min-height: 100vh; }
        h1 { font-size: 24px; font-weight: 700; margin-bottom: 6px; }
        .subtitle { font-size: 14px; color: var(--muted); margin-bottom: 32px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 16px; margin-bottom: 32px; }
        .stat { background: #fff; border: 1px solid var(--border); border-radius: 16px; padding: 18px 20px; }
        .stat .label { font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--muted); margin-bottom: 6px; }
        .stat .value { font-size: 28px; font-weight: 700; color: var(--ink); }
        .stat.accent { border-top: 4px solid var(--accent); }
        .stat.sage   { border-top: 4px solid var(--sage); }
        .stat.gold   { border-top: 4px solid #c9922a; }
        .stat.muted  { border-top: 4px solid var(--muted); }
        .toolbar { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
        .toolbar h2 { font-size: 17px; font-weight: 600; }
        .btn-export { display: inline-flex; align-items: center; gap: 8px; background: var(--accent); color: #fff; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 100px; text-decoration: none; transition: background 0.15s; }
        .btn-export:hover { background: var(--accent-dark); }
        .table-wrap { background: #fff; border: 1px solid var(--border); border-radius: 16px; overflow: auto; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; table-layout: fixed; }
        thead tr { background: var(--ink); color: #fff; }
        th { padding: 12px 16px; text-align: left; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap; vertical-align: middle; }
        td { padding: 12px 16px; border-top: 1px solid var(--border); vertical-align: middle; }
        tr:hover td { background: #fff8f5; }
        td.center { text-align: center; }
        td.accompagnants { font-size: 13px; color: var(--ink); line-height: 1.4; word-break: break-word; }
        td.message { font-size: 13px; color: var(--muted); line-height: 1.4; max-width: 180px; word-break: break-word; }
        td.date { white-space: nowrap; font-size: 12px; color: var(--muted); }
        .badge { display: inline-block; padding: 3px 10px; border-radius: 100px; font-size: 12px; font-weight: 600; }
        .vide { color: #ccc; }
        .empty { text-align: center; padding: 48px; color: var(--muted); font-size: 15px; }
        .btn-supprimer {
            background: none;
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 4px 10px;
            color: var(--accent-dark);
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            transition: background 0.15s, border-color 0.15s;
        }
        .btn-supprimer:hover { background: #fdecea; border-color: var(--accent); }
        @media (max-width: 600px) { body { padding: 20px 14px; } }
    </style>
</head>
<body>

    <h1>🎂 Anniversaire Jean-Michel — 80 ans</h1>
    <p class="subtitle">Dashboard des réponses · ${reponses.length} réponse(s) reçue(s)</p>

    <div class="stats">
        <div class="stat accent"><div class="label">Présents</div><div class="value">${nbOui}</div></div>
        <div class="stat muted"><div class="label">Absents</div><div class="value">${nbNon}</div></div>
        <div class="stat gold"><div class="label">Incertains</div><div class="value">${nbIncertain}</div></div>
        <div class="stat sage"><div class="label">Adultes</div><div class="value">${totalAdultes}</div></div>
        <div class="stat sage"><div class="label">Enfants</div><div class="value">${totalEnfants}</div></div>
        <div class="stat accent"><div class="label">Total personnes</div><div class="value">${totalPersonnes}</div></div>
        <div class="stat accent"><div class="label">Végétariens</div><div class="value">${totalVegetariens}</div></div>
        <div class="stat gold"><div class="label">Dimanche midi</div><div class="value">${totalDimancheMidi}</div></div>
    </div>

    <div class="toolbar">
        <h2>Liste des invités</h2>
        <a class="btn-export" href="/admin/export?pwd=${encodeURIComponent(pwd)}">⬇ Télécharger en CSV</a>
    </div>

    <div class="table-wrap">
        ${tableau}
    </div>

    <script>
        const PWD = ${pwdJs};
        function supprimer(id) {
            if (!confirm("Supprimer cette réponse ? Cette action est irréversible.")) return;
            fetch('/admin/supprimer/' + encodeURIComponent(id) + '?pwd=' + encodeURIComponent(PWD), { method: 'DELETE' })
                .then(r => r.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        alert("Erreur : " + data.error);
                    }
                })
                .catch(() => alert("Erreur réseau, veuillez réessayer."));
        }
        document.querySelectorAll('.btn-supprimer').forEach(function (btn) {
            btn.addEventListener('click', function () { supprimer(btn.dataset.id); });
        });
    </script>

</body>
</html>`);
});

// ---- Photos ----
app.get("/admin/photos", adminOnly, async (req, res) => {
    let reponses;
    try {
        reponses = await lireReponses();
    } catch (err) {
        console.error("Erreur photos :", err);
        return res.status(500).send("Erreur de connexion à la base de données.");
    }

    const avecPhoto = reponses.filter(r => r.photo);

    const entete = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Photos invités</title></head>
<body style="font-family:sans-serif; padding:32px; background:#fff3eb;">
    <h1>📸 Photos des invités</h1>`;

    if (avecPhoto.length === 0) {
        return res.send(`${entete}
    <p>Aucune photo reçue pour l'instant.</p>
</body></html>`);
    }

    // Liens temporaires (1 heure) : le bucket reste privé
    const { data: liens, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(avecPhoto.map(r => r.photo), 3600);
    if (error) {
        console.error("Erreur liens photos :", error);
        return res.status(500).send("Impossible de générer les liens des photos.");
    }

    const urlParFichier = {};
    (liens || []).forEach(l => { if (l.signedUrl) urlParFichier[l.path] = l.signedUrl; });

    const images = avecPhoto.map(r => {
        const url = urlParFichier[r.photo];
        if (!url) return "";
        return `
            <div style="text-align:center; margin-bottom:24px;">
                <img src="${esc(url)}" style="max-width:300px; border-radius:12px;">
                <p style="margin-top:8px; font-weight:600;">${esc(r.nom)}</p>
            </div>`;
    }).join("");

    res.send(`${entete}
    <p>${avecPhoto.length} photo(s) reçue(s)</p>
    <div style="display:flex; flex-wrap:wrap; gap:24px; margin-top:32px;">
        ${images}
    </div>
</body></html>`);
});

app.listen(PORT, () => {
    console.log(`Server listen at port ${PORT}`);
});