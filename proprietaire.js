// ── Sélecteurs ──────────────────────────────────────────────────────────────
const form      = document.getElementById('proprietaireForm');
const flash     = document.getElementById('flash');
const submitBtn = document.getElementById('submitBtn');
const btnText   = submitBtn.querySelector('.btn-text');
const btnLoader = document.getElementById('btnLoader');
const btnBack   = document.getElementById('btnBack');

// ── Règles de validation ─────────────────────────────────────────────────────
const rules = {
  prenom:     { required: true, minLen: 2,   label: 'Le prénom' },
  nom:        { required: true, minLen: 2,   label: 'Le nom' },
  telephone:  { required: true, phone: true, label: 'Le téléphone' },
  ville:      { required: true, minLen: 2,   label: 'La ville' },
};

Object.keys(rules).forEach(id => {
  const input = document.getElementById(id);
  if (!input) return;
  input.addEventListener('blur',  () => validateField(id));
  input.addEventListener('input', () => {
    if (input.classList.contains('invalid')) validateField(id);
  });
});

function validateField(id) {
  const input  = document.getElementById(id);
  const errDiv = document.getElementById(`err-${id}`);
  if (!input || !errDiv) return true;

  const val  = input.value.trim();
  const rule = rules[id];
  let error  = '';

  if (rule.required && !val) {
    error = `${rule.label} est obligatoire.`;
  } else if (val && rule.minLen && val.length < rule.minLen) {
    error = `${rule.label} doit contenir au moins ${rule.minLen} caractères.`;
  } else if (val && rule.phone && !/^(\+33|0)[0-9 .\-]{8,14}$/.test(val)) {
    error = 'Numéro de téléphone invalide. Ex : 06 12 34 56 78';
  }

  errDiv.textContent = error;
  const fieldGroup = input.closest('.field-group');
  fieldGroup.classList.toggle('has-error', !!error);
  input.classList.toggle('invalid', !!error);
  input.classList.toggle('valid',   !error && !!val);
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
  window.location.href = '/';
});

// ── Soumission du formulaire ─────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFlash();

  if (!validateAll()) {
    showFlash('error', 'Veuillez compléter tous les champs nécessaires');
    return;
  }

  // Récupérer les données de l'étape 1 du localStorage
  const step1Data = JSON.parse(localStorage.getItem('step1Data') || '{}');
  if (!step1Data.email) {
    showFlash('error', 'Erreur : données de l\'étape 1 manquantes');
    return;
  }

  // Récupérer les données de l'étape 2
  const step2Data = {
    prenom:    document.getElementById('prenom').value.trim(),
    nom:       document.getElementById('nom').value.trim(),
    telephone: document.getElementById('telephone').value.trim(),
    ville:     document.getElementById('ville').value.trim(),
  };

  // Stocker dans localStorage
  localStorage.setItem('step2Data', JSON.stringify(step2Data));

  // Naviguer vers l'étape 3
  window.location.href = '/chien-info.html';
});
