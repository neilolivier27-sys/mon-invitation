function ajouter_pers(field) {
    if (parseInt(field.textContent, 10) < 20) {
        field.textContent = parseInt(field.textContent, 10) + 1;
        const total = document.querySelector(".total");
        total.textContent = parseInt(total.textContent, 10) + 1;
    }
}

function retirer_pers(field) {
    if (parseInt(field.textContent, 10) >= 1) {
        field.textContent = parseInt(field.textContent, 10) - 1;
        const total = document.querySelector(".total");
        total.textContent = parseInt(total.textContent, 10) - 1;
    }
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

function getOuCreerIdentifiant() {
    let id = localStorage.getItem('invitation_id');
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem('invitation_id', id);
    }
    return id;
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

var b_effacer = document.getElementById("effacer");
b_effacer.addEventListener("click", () => {effacer_formulaire();});

const nom = document.getElementById("name");
nom.addEventListener("keyup", function(e) {
    verification(nom, "Nom et prénom sont obligatoires.");
});

document.forms["form_invit"].addEventListener("submit", async function(e) {
    e.preventDefault();
    
    const nom = document.getElementById("name");
    const presence = document.getElementById("presency");
    const adultes = document.getElementById("nb_adultes");
    const enfants = document.getElementById("nb_enfants");
    const total = document.getElementById("total");

    const nomValide = verification(nom, "Nom et prénom sont obligatoires.");
    const presenceValide = verification(presence, "Vous devez choisir une option.");
    const adultesValides = verification(adultes, "Il faut au moins un adulte.");

    if (!nomValide || !presenceValide || !adultesValides) {
        return;
    }

    const data = {
        id: getOuCreerIdentifiant(),
        nom: document.getElementById("name").value,
        presence: document.getElementById("presency").value,
        adultes: document.getElementById("nb_adultes").textContent,
        enfants: document.getElementById("nb_enfants").textContent,
        total: document.getElementById("total").textContent
    };

    document.getElementById("recap-nom").textContent = data["nom"];
    document.getElementById("recap-adultes").textContent = data["adultes"];
    document.getElementById("recap-enfants").textContent = data["enfants"];
    document.getElementById("recap-total").textContent = data["total"];
    recap_presence(data["presence"]);

    try {
        const response = await fetch('/api/reponse', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            document.getElementById("step2").classList.remove("visible");
            document.getElementById("step2").classList.add("cache");
            document.getElementById("step3").classList.remove("cache");
            document.getElementById("step3").classList.add("visible");
            
            console.log("Réponse envoyée avec succès");
        } else {
            console.error("Erreur lors de l'envoi");
        }
    } catch (err) {
        console.error("Erreur réseau :", err);
    }

});


$(document).ready(function() {
    $(".rsvp-button").on("click", function(e) {
        e.preventDefault();
        const $s1 = $("#step1");
        const $s2 = $("#step2");

        $s1.stop(true, true).fadeOut(300, function() {
            $s1.addClass("cache");
            $s1.removeClass("visible");
            $s2.removeClass("cache");
            $s2.addClass("visible");
            $('html, body').animate({ scrollTop: $s2.offset().top }, 300);
        });
    });

    $("#recap-modify").on("click", function(e) {
        e.preventDefault();
        const $s2 = $("#step2");
        const $s3 = $("#step3");
        $s3.addClass("cache");
        $s3.removeClass("visible");
        $s2.removeClass("cache");
        $s2.addClass("visible");
        $("html, body").animate({ scrollTop: $s2.offset().top }, 300);
    })
});