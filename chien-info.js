// ── Sélecteurs ──────────────────────────────────────────────────────────────
const form      = document.getElementById('chienInfoForm');
const flash     = document.getElementById('flash');
const submitBtn = document.getElementById('submitBtn');
const btnText   = submitBtn.querySelector('.btn-text');
const btnLoader = document.getElementById('btnLoader');
const btnBack   = document.getElementById('btnBack');

// ── Récupérer et afficher le nom du chien ──────────────────────────────────
const step1Data = JSON.parse(localStorage.getItem('step1Data') || '{}');
if (step1Data.chien_nom) {
  document.getElementById('dogName').textContent = step1Data.chien_nom;
}

// ── Règles de validation ─────────────────────────────────────────────────────
const rules = {
  race:           { required: true, minLen: 2,  label: 'La race' },
  poids:          { required: true, minLen: 1,  label: 'Le poids' },
  dateNaissance:  { required: true, label: 'La date de naissance' },
  sexe:           { required: true, label: 'Le sexe' },
};

Object.keys(rules).forEach(id => {
  if (id === 'sexe') {
    // Pour les radio buttons
    const radios = document.querySelectorAll('input[name="sexe"]');
    radios.forEach(radio => {
      radio.addEventListener('change', () => validateField(id));
    });
  } else {
    const input = document.getElementById(id);
    if (!input) return;
    input.addEventListener('blur',  () => validateField(id));
    input.addEventListener('input', () => {
      if (input.classList.contains('invalid')) validateField(id);
    });
  }
});

function validateField(id) {
  const errDiv = document.getElementById(`err-${id}`);
  if (!errDiv) return true;

  let error = '';
  const rule = rules[id];
  let val = '';
  let input = null;

  if (id === 'sexe') {
    const selected = document.querySelector('input[name="sexe"]:checked');
    val = selected ? selected.value : '';
  } else {
    input = document.getElementById(id);
    if (!input) return true;
    val = input.value.trim();
  }

  if (rule.required && !val) {
    error = `${rule.label} est obligatoire.`;
  } else if (val && rule.minLen && val.length < rule.minLen) {
    error = `${rule.label} doit contenir au moins ${rule.minLen} caractères.`;
  } else if (id === 'poids' && val) {
    const poids = parseFloat(val);
    if (isNaN(poids) || poids <= 0 || poids > 200) {
      error = 'Le poids doit être entre 0.5 et 200 kg.';
    }
  } else if (id === 'dateNaissance' && val) {
    const date = new Date(val);
    const today = new Date();
    if (date > today) {
      error = 'La date de naissance ne peut pas être dans le futur.';
    }
  }

  errDiv.textContent = error;
  
  if (id === 'sexe') {
    const fieldGroup = document.querySelector('input[name="sexe"]').closest('.field-group');
    fieldGroup.classList.toggle('has-error', !!error);
  } else {
    const fieldGroup = input.closest('.field-group');
    fieldGroup.classList.toggle('has-error', !!error);
    input.classList.toggle('invalid', !!error);
    input.classList.toggle('valid',   !error && !!val);
  }
  
  return !error;
}

function validateAll() {
  let ok = true;
  Object.keys(rules).forEach(id => {
    if (!validateField(id)) ok = false;
  });
  return ok;
}

function showFlash(type, msg) {
  flash.className = `flash ${type}`;
  flash.textContent = msg;
  flash.classList.remove('hidden');
  flash.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideFlash() {
  flash.classList.add('hidden');
}

// ── Bouton Retour ───────────────────────────────────────────────────────────
btnBack.addEventListener('click', () => {
  window.location.href = '/proprietaire.html';
});

// ── Soumission du formulaire ─────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFlash();

  if (!validateAll()) {
    showFlash('error', 'Veuillez compléter tous les champs nécessaires');
    return;
  }

  // Récupérer les données des étapes précédentes
  const step1Data = JSON.parse(localStorage.getItem('step1Data') || '{}');
  const step2Data = JSON.parse(localStorage.getItem('step2Data') || '{}');

  if (!step1Data.email || !step2Data.prenom) {
    showFlash('error', 'Erreur : données des étapes précédentes manquantes');
    return;
  }

  // Récupérer les données de l'étape 3
  const step3Data = {
    race:           document.getElementById('race').value.trim(),
    poids:          parseFloat(document.getElementById('poids').value),
    dateNaissance:  document.getElementById('dateNaissance').value,
    sexe:           document.querySelector('input[name="sexe"]:checked').value,
  };

  // Fusionner toutes les données
  const completeData = {
    chien_nom:      step1Data.chien_nom,
    email:          step1Data.email,
    mot_de_passe:   step1Data.mot_de_passe,
    prenom:         step2Data.prenom,
    nom:            step2Data.nom,
    telephone:      step2Data.telephone,
    ville:          step2Data.ville,
    race:           step3Data.race,
    poids:          step3Data.poids,
    dateNaissance:  step3Data.dateNaissance,
    sexe:           step3Data.sexe,
  };

  // UI : état loading
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/inscription', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(completeData),
    });

    const result = await response.json();

    if (result.success) {
      showFlash('success', result.message || 'Inscription réussie ! 🎉');
      // Stocker les infos utilisateur
      localStorage.setItem('currentUser', JSON.stringify({
        id: result.id,
        username: result.username,
        email: result.email,
        prenom: result.prenom,
        nom: result.nom,
        chien_nom: result.chien_nom,
        race: result.race,
        poids: result.poids,
        telephone: result.telephone,
        ville: result.ville,
        dateNaissance: result.dateNaissance,
        sexe: result.sexe,
      }));
      // Nettoyer le localStorage des étapes précédentes
      localStorage.removeItem('step1Data');
      localStorage.removeItem('step2Data');
      // Rediriger après 2 secondes
      setTimeout(() => {
        window.location.href = '/tableau-de-bord';
      }, 2000);
    } else {
      showFlash('error', result.message || 'Erreur lors de l\'inscription.');
      btnText.classList.remove('hidden');
      btnLoader.classList.add('hidden');
      submitBtn.disabled = false;
    }
  } catch (err) {
    console.error('Erreur fetch:', err);
    showFlash('error', 'Erreur réseau. Veuillez réessayer.');
    btnText.classList.remove('hidden');
    btnLoader.classList.add('hidden');
    submitBtn.disabled = false;
  }
});
