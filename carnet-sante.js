// ── Sélecteurs ──────────────────────────────────────────────────────────────
const form = document.getElementById('vaccineForm');
const vaccinesList = document.getElementById('vaccinesList');
const vaccineName = document.getElementById('vaccineName');
const vaccineDate = document.getElementById('vaccineDate');
const vaccineVet = document.getElementById('vaccineVet');
const vaccineNotes = document.getElementById('vaccineNotes');
const addVaccineModal = document.getElementById('addVaccineModal');

// ── Utilisateur connecté ────────────────────────────────────────────────────
let currentUser = {};

// ── Cache local des vaccins (chargés depuis le serveur) ─────────────────────
let vaccinesCache = [];

// ── Gestion du Modal ────────────────────────────────────────────────────
function openAddVaccineModal() {
  addVaccineModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeAddVaccineModal() {
  addVaccineModal.classList.add('hidden');
  document.body.style.overflow = '';
  form.reset();
}

// Fermer le modal en cliquant sur le bouton Annuler
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !addVaccineModal.classList.contains('hidden')) {
    closeAddVaccineModal();
  }
});

// ── Initialisation ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Charger l'utilisateur connecté depuis la session
  try {
    const res = await fetch('/api/me');
    const data = await res.json();
    if (!data.success) { window.location.href = '/login.html'; return; }
    currentUser = data.user;
  } catch (err) {
    window.location.href = '/login.html';
    return;
  }
  await fetchVaccines();
  displayVaccines();
});

// ── Charger les vaccins depuis le serveur ────────────────────────────────
async function fetchVaccines() {
  if (!currentUser.id) return;
  try {
    const res = await fetch(`/api/users/${currentUser.id}/rappels`);
    const data = await res.json();
    if (data.success) {
      vaccinesCache = data.rappels || [];
    }
  } catch (err) {
    console.error('Erreur chargement rappels:', err);
  }
}

// ── Sauvegarder les vaccins sur le serveur ──────────────────────────────
async function saveVaccines() {
  if (!currentUser.id) return;
  try {
    const res = await fetch(`/api/users/${currentUser.id}/rappels`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rappels: vaccinesCache })
    });
    const data = await res.json();
    if (data.success) {
      updateVaccineCountInProfile();
    }
  } catch (err) {
    console.error('Erreur sauvegarde rappels:', err);
  }
}

// ── Mettre à jour le compteur de vaccins dans le profil ─────────────────
function updateVaccineCountInProfile() {
  // Rien à faire côté client, les données sont sur le serveur
}

// ── Ajouter un vaccin ───────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const newVaccine = {
    id: Date.now(),
    name: vaccineName.value.trim(),
    date: vaccineDate.value,
    vet: vaccineVet.value.trim() || 'N/A',
    notes: vaccineNotes.value.trim() || '',
    rappelDone: false,
  };

  vaccinesCache.push(newVaccine);
  await saveVaccines();

  form.reset();
  closeAddVaccineModal();
  displayVaccines();
});

// ── Afficher les vaccins ────────────────────────────────────────────────
function displayVaccines() {
  const vaccines = [...vaccinesCache];

  if (vaccines.length === 0) {
    vaccinesList.innerHTML = '<p class="no-vaccines">Aucun vaccin enregistré</p>';
    return;
  }

  // Trier par date décroissante (plus récent d'abord)
  vaccines.sort((a, b) => new Date(b.date) - new Date(a.date));

  vaccinesList.innerHTML = vaccines.map(vaccine => {
    const date = new Date(vaccine.date);
    const formattedDate = date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Calculer le statut rappel (généralement 1 an après)
    const nextReminderDate = new Date(vaccine.date);
    nextReminderDate.setFullYear(nextReminderDate.getFullYear() + 1);
    const today = new Date();
    const needsReminder = nextReminderDate <= today;
    const reminderClass = needsReminder ? 'reminder-needed' : '';

    return `
      <div class="vaccine-card ${reminderClass}">
        <div class="vaccine-header">
          <div class="vaccine-info">
            <h3 class="vaccine-name">${vaccine.name}</h3>
            <p class="vaccine-date">
              <i class="fa-solid fa-calendar"></i> ${formattedDate}
            </p>
            <p class="vaccine-vet">
              <i class="fa-solid fa-stethoscope"></i> ${vaccine.vet}
            </p>
            ${vaccine.notes ? `<p class="vaccine-notes"><i class="fa-solid fa-note-sticky"></i> ${vaccine.notes}</p>` : ''}
          </div>
          <button class="btn-delete" onclick="deleteVaccine(${vaccine.id})" title="Supprimer">
            <i class="fa-solid fa-trash"></i>
          </button>
        </div>

        <div class="vaccine-reminder">
          <label class="reminder-checkbox">
            <input type="checkbox" ${vaccine.rappelDone ? 'checked' : ''} 
                   onchange="toggleReminder(${vaccine.id}, this.checked)" />
            <span>Rappel effectué</span>
          </label>
          ${needsReminder && !vaccine.rappelDone ? '<span class="reminder-alert">⚠️ Rappel à faire</span>' : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Supprimer un vaccin ─────────────────────────────────────────────────
async function deleteVaccine(id) {
  if (confirm('Supprimer ce vaccin ?')) {
    vaccinesCache = vaccinesCache.filter(v => v.id !== id);
    await saveVaccines();
    displayVaccines();
  }
}

// ── Basculer l'état du rappel ───────────────────────────────────────────
async function toggleReminder(id, isDone) {
  const vaccine = vaccinesCache.find(v => v.id === id);
  if (vaccine) {
    vaccine.rappelDone = isDone;
    await saveVaccines();
    displayVaccines();
  }
}
