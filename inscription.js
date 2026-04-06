// ── Sélecteurs ──────────────────────────────────────────────────────────────
const form       = document.getElementById('inscriptionForm');
const flash      = document.getElementById('flash');
const submitBtn  = document.getElementById('submitBtn');
const btnText    = submitBtn.querySelector('.btn-text');
const btnLoader  = document.getElementById('btnLoader');
const togglePwd  = document.getElementById('togglePwd');
const pwdInput   = document.getElementById('mot_de_passe');
const pwdStrength = document.getElementById('pwdStrength');

// ── Toggle visibilité mot de passe ──────────────────────────────────────────
togglePwd.addEventListener('click', () => {
  const isText = pwdInput.type === 'text';
  pwdInput.type = isText ? 'password' : 'text';
  const icon = togglePwd.querySelector('i');
  icon.classList.toggle('fa-eye');
  icon.classList.toggle('fa-eye-slash');
});

// ── Indicateur de force du mot de passe ─────────────────────────────────────
pwdInput.addEventListener('input', () => {
  pwdStrength.classList.add('visible');
  
  const val = pwdInput.value;
  let score = 0;
  if (val.length >= 8)           score++;
  if (/[A-Z]/.test(val))         score++;
  if (/[0-9]/.test(val))         score++;
  if (/[^A-Za-z0-9]/.test(val))  score++;

  const levels = [
    { width: '0%',   color: '#E8E0D5' },
    { width: '25%',  color: '#E74C3C' },
    { width: '50%',  color: '#E67E22' },
    { width: '75%',  color: '#F1C40F' },
    { width: '100%', color: '#27AE60' },
  ];

  const { width, color } = levels[score];
  pwdStrength.style.setProperty('--strength-width', width);
  pwdStrength.style.setProperty('--strength-color', color);
});

// ── Validation en temps réel (blur) ─────────────────────────────────────────
const rules = {
  chien_nom:     { required: true, minLen: 1,  label: 'Le nom du chien' },
  email:         { required: true, email: true, label: "L'adresse e-mail" },
  mot_de_passe:  { required: true, minLen: 8,  label: 'Le mot de passe' },
  confirm_passe: { required: true, match: 'mot_de_passe', label: 'La confirmation' },
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
  } else if (val && rule.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
    error = "Format d'e-mail invalide. Ex : vous@exemple.fr";
  } else if (val && rule.phone && !/^(\+33|0)[0-9 .\-]{8,14}$/.test(val)) {
    error = 'Numéro de téléphone invalide. Ex : 06 12 34 56 78';
  } else if (rule.match) {
    const other = document.getElementById(rule.match)?.value;
    if (input.value !== other) error = 'Les mots de passe ne correspondent pas.';
  }

  errDiv.textContent = error;
  const fieldGroup = input.closest('.field-group');
  fieldGroup.classList.toggle('has-error', !!error);
  input.classList.toggle('invalid', !!error);
  input.classList.toggle('valid',   !error && !!val);
  return !error;
}

// ── Validation globale ───────────────────────────────────────────────────────
function validateAll() {
  let ok = true;

  // Champs texte / email / password
  Object.keys(rules).forEach(id => {
    if (!validateField(id)) ok = false;
  });

  // CGU
  const cguEl  = document.getElementById('cgu');
  const cguErr = document.getElementById('err-cgu');
  if (!cguEl.checked) {
    cguErr.textContent = 'Vous devez accepter les conditions d\'utilisation.';
    ok = false;
  } else {
    cguErr.textContent = '';
  }

  return ok;
}

// ── Afficher un message flash ────────────────────────────────────────────────
function showFlash(type, msg) {
  flash.className = `flash ${type}`;
  flash.textContent = msg;
  flash.classList.remove('hidden');
  flash.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function hideFlash() {
  flash.classList.add('hidden');
}

// ── Soumission du formulaire ─────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideFlash();

  if (!validateAll()) {
    showFlash('error', 'Veuillez compléter tous les champs nécessaires');
    return;
  }

  // Préparer les données de l'étape 1
  const step1Data = {
    chien_nom:    document.getElementById('chien_nom').value.trim(),
    email:        document.getElementById('email').value.trim().toLowerCase(),
    mot_de_passe: document.getElementById('mot_de_passe').value,
  };

  // Vérifier si l'email existe déjà
  try {
    const checkResponse = await fetch('/api/inscrits');
    const inscrits = await checkResponse.json();
    
    const emailExists = inscrits.inscrits?.some(u => u.email === step1Data.email);
    if (emailExists) {
      showFlash('error', `L'adresse ${step1Data.email} est déjà utilisée.`);
      return;
    }
  } catch (err) {
    console.warn('Impossible de vérifier l\'email', err);
  }

  // Stocker en session serveur
  try {
    await fetch('/api/session/step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(step1Data),
    });
  } catch (err) {
    showFlash('error', 'Erreur réseau.');
    return;
  }

  // Naviguer vers l'étape 2
  window.location.href = '/proprietaire.html';
});
