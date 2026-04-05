// ── Sélecteurs ──────────────────────────────────────────────────────────────
const form       = document.getElementById('loginForm');
const flash      = document.getElementById('flash');
const submitBtn  = document.getElementById('submitBtn');
const btnText    = submitBtn.querySelector('.btn-text');
const btnLoader  = document.getElementById('btnLoader');
const togglePwd  = document.getElementById('togglePwd');
const pwdInput   = document.getElementById('mot_de_passe');

// ── Toggle visibilité mot de passe ──────────────────────────────────────────
togglePwd.addEventListener('click', () => {
  const isText = pwdInput.type === 'text';
  pwdInput.type = isText ? 'password' : 'text';
  const icon = togglePwd.querySelector('i');
  icon.classList.toggle('fa-eye');
  icon.classList.toggle('fa-eye-slash');
});

// ── Validation en temps réel (blur) ─────────────────────────────────────────
const rules = {
  email:        { required: true, email: true, label: "L'adresse e-mail" },
  mot_de_passe: { required: true, minLen: 8,  label: 'Le mot de passe' },
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

  // Préparer les données
  const data = {
    email:        document.getElementById('email').value.trim().toLowerCase(),
    mot_de_passe: document.getElementById('mot_de_passe').value,
  };

  // UI : état loading
  btnText.classList.add('hidden');
  btnLoader.classList.remove('hidden');
  submitBtn.disabled = true;

  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (result.success) {
      showFlash('success', `Bienvenue ${result.prenom} ! 🐾`);
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
      // Rediriger après 2 secondes
      setTimeout(() => {
        window.location.href = '/tableau-de-bord';
      }, 2000);
    } else {
      showFlash('error', result.message || 'Erreur lors de la connexion.');
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
