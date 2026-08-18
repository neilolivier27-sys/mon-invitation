function ajouter_pers(field) {
    if (parseInt(field.textContent, 10) < 10) {
        field.textContent = parseInt(field.textContent, 10) + 1;
        const total = document.querySelector(".total");
        total.textContent = parseInt(total.textContent, 10) + 1;

        const names_pers = document.getElementById("names_pers");
        if (parseInt(total.textContent, 10) > 1) {
            if (names_pers.classList.contains("cache")) {
                names_pers.classList.add("visible");
                names_pers.classList.remove("cache");
            }
            ajouter_nom(names_pers);
        }
    }
}

function retirer_pers(field) {
    if (parseInt(field.textContent, 10) >= 1) {
        field.textContent = parseInt(field.textContent, 10) - 1;
        const total = document.querySelector(".total");
        total.textContent = parseInt(total.textContent, 10) - 1;

        const names_pers = document.getElementById("names_pers");
        if (parseInt(total.textContent, 10) <=  1) {
            if (names_pers.classList.contains("visible")) {
                names_pers.classList.add("cache");
                names_pers.classList.remove("visible");
            }
        }
        retirer_nom(names_pers);
    }
}

function ajouter_vege(field) {
    const total = parseInt(document.getElementById("total").textContent, 10);
    const vege = parseInt(field.textContent, 10);
    if (vege < total) {
        field.textContent = vege + 1;
    }
}

function retirer_vege(field) {
    const vege = parseInt(field.textContent, 10);
    if (vege >= 1) {
        field.textContent = vege - 1;
    }
}

function ajouter_nom(field) {
    const div = document.createElement("div");
    div.classList.add("name-entry");
    const label = document.createElement("label");
    const input = document.createElement("input");
    
    const total_pers = parseInt(document.querySelector(".total").textContent, 10);
    input.id = `nom_personne_${total_pers}`;
    input.name = `nom_personne_${total_pers}`;
    input.placeholder = "Prénom";
    input.type = "text";
    input.classList.add("guest-name-input");
    label.textContent = `Personne ${total_pers}`;
    label.setAttribute("for", `nom_personne_${total_pers}`);

    div.append(label);
    div.append(input);
    field.append(div);
}

function retirer_nom(field) {
    const entries = field.querySelectorAll(".name-entry");
    if (entries.length > 0) {
        entries[entries.length - 1].remove();
    }
}

function afficher_temps_restants() {
    const date_bday = new Date("2026-12-12T00:00:00");

    let date_now = new Date();
    let temps_restant_ms = date_bday - date_now;

    let temps_restant_s = Math.floor(temps_restant_ms / 1000);

    const jours = Math.floor(temps_restant_s / (24 * 3600));
    temps_restant_s %= (24 * 3600);

    const heures = Math.floor(temps_restant_s / 3600);
    temps_restant_s %= 3600;

    const minutes = Math.floor(temps_restant_s / 60);
    const secondes = temps_restant_s % 60;

    document.getElementById("cd-j").textContent = String(jours).padStart(2, "0");
    document.getElementById("cd-h").textContent = String(heures).padStart(2, "0");
    document.getElementById("cd-m").textContent = String(minutes).padStart(2, "0");
    document.getElementById("cd-s").textContent = String(secondes).padStart(2, "0");
}

function effacer_formulaire() {
    if (confirm("Etes-vous sûr de vouloir effacer ces informations ?")) {
        nettoyage();
    }
}

function nettoyage() {
    var nb_pers = document.querySelectorAll("span.nb_pers");
    nb_pers.forEach((item, index) => {
        item.textContent = "0";
    });
    const total = document.querySelector(".total");
    total.textContent = 0;
    var problemes = document.querySelectorAll("span.probleme");
    problemes.forEach((item, index) => {
        item.remove();
    });
    var name = document.getElementById("name");
    var presence = document.getElementById("presency");
    var elements = [name, presence];
    elements.forEach(e => {
        e.style.outline = 'initial';
    });

    const namesPers = document.getElementById("names_pers");
    if (namesPers) {
        namesPers.classList.add("cache");
        namesPers.classList.remove("visible");
        namesPers.querySelectorAll(".name-entry").forEach(entry => entry.remove());
    }

    const fileInput = document.getElementById("image");
    const filename = document.getElementById("upload-filename");
    const preview = document.getElementById("photo-preview");
    const previewImage = document.getElementById("preview-image");

    if (fileInput) fileInput.value = "";
    if (filename) filename.textContent = "Aucune photo sélectionnée";
    if (preview) preview.classList.add("hidden");
    if (previewImage) previewImage.src = "";

    document.forms["form_invit"].reset();
}

function est_valide(field) {
    if (!field) {
        return false;
    }

    const presence = document.getElementById("presency");

    switch (field.id) {
        case "name":
            return field.value.trim().length !== 0 && field.value.trim().includes(" ");
        case "nb_adultes":
            return parseInt(field.textContent, 10) > 0 || presence.value === "non";
        case "presency":
            return field.value !== "choix";
        default:
            return true;
    }
}

function verification(field, msg) {
    if (!field) {
        return false;
    }

    const parent = field.id === "nb_adultes" ? document.getElementById("nb_personnes") : field.parentNode;

    let problem = parent.querySelector("span.probleme");
    if (problem) {
        problem.classList.add("cache");
        problem.classList.remove("visible");
    }

    field.style.outline = "initial";

    if (!est_valide(field)) {
        if (field.id !== "nb_adultes") {
            field.style.outline = "2px solid red";
        }

        if (!problem) {
            problem = document.createElement("span");
            problem.className = "probleme cache";
            if (parent.id === "nb_personnes") {
                parent.firstElementChild.after(problem);
            } else {
                parent.appendChild(problem);
            }
        }
        problem.textContent = msg;
        problem.classList.remove("cache");
        problem.classList.add("visible");
        return false;
    }

    return true;
}

function verifier_noms_invites() {
    const container = document.getElementById("names_pers");
    if (!container || container.classList.contains("cache")) {
        return true;
    }

    const champs = [...container.querySelectorAll(".name-entry input")];
    let valide = true;

    let message = container.querySelector("span.name-error");
    if (!message) {
        message = document.createElement("span");
        message.className = "probleme name-error cache";
        container.appendChild(message);
    }

    message.classList.add("cache");
    message.classList.remove("visible");
    message.textContent = "";

    champs.forEach(input => {
        input.style.outline = "initial";
        const nom = input.value.trim();
        if (!nom) {
            input.style.outline = "2px solid red";
            valide = false;
        }
    });

    if (!valide) {
        message.textContent = "Merci de remplir le nom complet de chaque invité.";
        message.classList.remove("cache");
        message.classList.add("visible");
    }

    return valide;
}

function recap_presence(value) {
    const presence = document.getElementById("recap-presence");
    switch (value) {
        case "oui":
            presence.textContent = "✓ Je viens";
            presence.style.backgroundColor = "lightgreen";
            presence.style.color = "darkgreen";
            break;
        case "non":
            presence.textContent = "✗ Je ne viens pas";
            presence.style.backgroundColor = "rgb(248, 188, 188)";
            presence.style.color = "red";
            break;
        default:
            presence.textContent = "Pas sûr(e)";
            presence.style.backgroundColor = "whitesmoke";
            presence.style.color = "darkslategrey";
            break;
    }
}

function recap_dimanche() {
    const recapDimanche = document.getElementById("recap-dimanche");
    const radio = document.querySelector('input[name="presence_dimanche"]:checked');
    const nb = parseInt(document.getElementById("nb_pers_dimanche").textContent, 10) || 0;

    if (!radio || radio.value === "non") {
        recapDimanche.textContent = "Non";
        return;
    }

    const label = nb > 1 ? "personnes" : "personne";
    recapDimanche.textContent = `Oui · ${nb} ${label}`;
}

function getOuCreerIdentifiant() {
    let id = localStorage.getItem('invitation_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('invitation_id', id);
    }
    return id;
}

function lancerConfettis() {
    // Première salve depuis la gauche
    confetti({
        particleCount: 80,
        angle: 60,
        spread: 70,
        origin: { x: 0, y: 0.7 },
        colors: ['#d65a5a', '#f7b8ab', '#6b7a56', '#fff3eb', '#bf4b4b']
    });

    // Deuxième salve depuis la droite, légèrement décalée
    setTimeout(() => {
        confetti({
            particleCount: 80,
            angle: 120,
            spread: 70,
            origin: { x: 1, y: 0.7 },
            colors: ['#d65a5a', '#f7b8ab', '#6b7a56', '#fff3eb', '#bf4b4b']
        });
    }, 200);

    // Petite pluie centrale pour finir
    setTimeout(() => {
        confetti({
            particleCount: 40,
            spread: 100,
            origin: { x: 0.5, y: 0.4 },
            colors: ['#d65a5a', '#f7b8ab', '#6b7a56']
        });
    }, 500);
}

var plus = document.querySelectorAll(".plus");
plus.forEach((item, index) => {
    item.addEventListener("click", (event) => {
        ajouter_pers(event.target.previousElementSibling);
    });
});
var moins = document.querySelectorAll(".moins");
moins.forEach((item, index) => {
    item.addEventListener("click", (event) => {
        retirer_pers(event.target.nextElementSibling);
    });
});

var plusVege = document.querySelectorAll(".plus-vege");
plusVege.forEach((item, index) => {
    item.addEventListener("click", (event) => {
        ajouter_vege(event.target.previousElementSibling);
    });
});
var moinsVege = document.querySelectorAll(".moins-vege");
moinsVege.forEach((item, index) => {
    item.addEventListener("click", (event) => {
        retirer_vege(event.target.nextElementSibling);
    });
});

var b_effacer = document.getElementById("effacer");
b_effacer.addEventListener("click", () => {effacer_formulaire();});

const fileInput = document.getElementById("image");
const uploadFilename = document.getElementById("upload-filename");
const preview = document.getElementById("photo-preview");
const previewImage = document.getElementById("preview-image");
const clearPhotoButton = document.getElementById("clear-photo");

if (fileInput) {
    fileInput.addEventListener("change", function() {
        const file = fileInput.files && fileInput.files[0];
        if (!file) {
            if (uploadFilename) uploadFilename.textContent = "Aucune photo sélectionnée";
            if (preview) preview.classList.add("hidden");
            if (previewImage) previewImage.src = "";
            return;
        }

        if (uploadFilename) uploadFilename.textContent = file.name;

        const reader = new FileReader();
        reader.onload = function(event) {
            if (previewImage) previewImage.src = event.target.result;
            if (preview) preview.classList.remove("hidden");
        };
        reader.readAsDataURL(file);
    });
}

if (clearPhotoButton) {
    clearPhotoButton.addEventListener("click", function() {
        if (fileInput) fileInput.value = "";
        if (uploadFilename) uploadFilename.textContent = "Aucune photo sélectionnée";
        if (preview) preview.classList.add("hidden");
        if (previewImage) previewImage.src = "";
    });
}

const nom = document.getElementById("name");
nom.addEventListener("keyup", function(e) {
    verification(nom, "Nom et prénom sont obligatoires.");
});

// Affichage/masquage du compteur dimanche selon oui/non
document.querySelectorAll('input[name="presence_dimanche"]').forEach(radio => {
    radio.addEventListener('change', function() {
        const bloc = document.getElementById('nb_dimanche');
        if (this.value === 'oui') {
            bloc.classList.remove('cache');
            bloc.classList.add('visible');
        } else {
            bloc.classList.add('cache');
            bloc.classList.remove('visible');
            // Remet le compteur à 0 si on choisit non
            document.getElementById('nb_pers_dimanche').textContent = '0';
        }
    });
});

// Boutons +/- dimanche (limités au total du samedi)
document.querySelectorAll('.plus-dimanche').forEach(btn => {
    btn.addEventListener('click', () => {
        const total_samedi = parseInt(document.getElementById('total').textContent, 10);
        const champ = document.getElementById('nb_pers_dimanche');
        const val = parseInt(champ.textContent, 10);
        if (val < total_samedi) champ.textContent = val + 1;
    });
});

document.querySelectorAll('.moins-dimanche').forEach(btn => {
    btn.addEventListener('click', () => {
        const champ = document.getElementById('nb_pers_dimanche');
        const val = parseInt(champ.textContent, 10);
        if (val > 0) champ.textContent = val - 1;
    });
});

document.forms["form_invit"].addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const nom = document.getElementById("name");
    const presence = document.getElementById("presency");
    const adultes = document.getElementById("nb_adultes");
    const enfants = document.getElementById("nb_enfants");
    const total = document.getElementById("total");
    const vege = document.getElementById("nb_vege");

    const nomValide = verification(nom, "Nom et prénom sont obligatoires.");
    const presenceValide = verification(presence, "Vous devez choisir une option.");
    const adultesValides = verification(adultes, "Il faut au moins un adulte.");
    const nomsInvitesValides = verifier_noms_invites();

    if (!nomValide || !presenceValide || !adultesValides || !nomsInvitesValides) {
        return;
    }

    const nomsInvites = [...document.querySelectorAll(".name-entry input")]
    .map(input => input.value.trim())
    .filter(v => v.length > 0); // ignore les champs vides

    const dimancheRadio = document.querySelector('input[name="presence_dimanche"]:checked');
    const presenceDimanche = dimancheRadio ? dimancheRadio.value : "non";
    const nbPersDimanche = document.getElementById("nb_pers_dimanche").textContent;

    const formData = new FormData();
    formData.append('id', getOuCreerIdentifiant());
    formData.append('nom', document.getElementById("name").value);
    formData.append('presence', document.getElementById("presency").value);
    formData.append('adultes', document.getElementById("nb_adultes").textContent);
    formData.append('enfants', document.getElementById("nb_enfants").textContent);
    formData.append('total', document.getElementById("total").textContent);
    formData.append('vegetariens', document.getElementById("nb_vege").textContent);
    formData.append('presence_dimanche', presenceDimanche);
    formData.append('nb_pers_dimanche', nbPersDimanche);
    formData.append('msg_livredor', document.getElementById("msg-livredor").value);
    formData.append('noms_invites', JSON.stringify(nomsInvites));

    const photoFile = document.getElementById("image").files[0];
    if (photoFile) {
        formData.append('photo', photoFile);
    }

    const nomRecap = formData.get('nom');
    const presenceRecap = formData.get('presence');
    document.getElementById("recap-nom").textContent = nomRecap;
    document.getElementById("recap-adultes").textContent = formData.get('adultes');
    document.getElementById("recap-enfants").textContent = formData.get('enfants');
    document.getElementById("recap-total").textContent = formData.get('total');
    recap_presence(presenceRecap);
    recap_dimanche();

    try {
        const response = await fetch('/api/reponse', {
            method: 'POST',
            body: formData
        });

        if (response.ok) {
            const $s2 = $("#step2");
            const $s3 = $("#step3");

            $s2.stop(true, true).fadeOut(300, function() {
                $s2.removeClass("visible");
                $s2.addClass("cache");
                $s3.removeClass("cache");
                $s3.addClass("visible");
                $s3.hide().fadeIn(400);
                $('html, body').animate({ scrollTop: 0 }, 200);
                lancerConfettis();
            });
            
            console.log("Réponse envoyée avec succès");
        } else {
            console.error("Erreur lors de l'envoi");
        }
    } catch (err) {
        console.error("Erreur réseau :", err);
    }

});

$(document).ready(function() {
    setInterval(() => {
        afficher_temps_restants();
    }, 1000);
    $(".rsvp-button").on("click", function(e) {
        e.preventDefault();
        const $s1 = $("#step1");
        const $s2 = $("#step2");

        $s1.stop(true, true).fadeOut(300, function() {
            $s1.addClass("cache");
            $s1.removeClass("visible");
            $s2.removeClass("cache");
            $s2.addClass("visible");
            $s2.hide().fadeIn(400);
            $('html, body').animate({ scrollTop: $s2.offset().top }, 300);
        });
    });

    $("#recap-modify").on("click", function(e) {
        e.preventDefault();
        const $s2 = $("#step2");
        const $s3 = $("#step3");
        
        $s3.stop(true, true).fadeOut(300, function() {
            $s3.addClass("cache");
            $s3.removeClass("visible");
            $s2.removeClass("cache");
            $s2.addClass("visible");
            $s2.hide().fadeIn(400);
            $("html, body").animate({ scrollTop: 0 }, 200);
        });
    });

    $(".maps-link").on("click", function() {
        open("https://maps.google.com/?q=12+Rte+de+Beaumont,+27180+Parville");
    });
});