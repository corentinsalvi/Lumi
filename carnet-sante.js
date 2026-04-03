// ── Sélecteurs ──────────────────────────────────────────────────────────────
const form = document.getElementById('vaccineForm');
const vaccinesList = document.getElementById('vaccinesList');
const vaccineName = document.getElementById('vaccineName');
const vaccineDate = document.getElementById('vaccineDate');
const vaccineVet = document.getElementById('vaccineVet');
const vaccineNotes = document.getElementById('vaccineNotes');
const addVaccineModal = document.getElementById('addVaccineModal');

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
document.addEventListener('DOMContentLoaded', () => {
  loadVaccines();
  displayVaccines();
});

// ── Charger les vaccins depuis localStorage ─────────────────────────────
function loadVaccines() {
  const saved = localStorage.getItem('vaccines');
  return saved ? JSON.parse(saved) : [];
}

// ── Sauvegarder les vaccins ─────────────────────────────────────────────
function saveVaccines(vaccines) {
  localStorage.setItem('vaccines', JSON.stringify(vaccines));
}

// ── Ajouter un vaccin ───────────────────────────────────────────────────
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const vaccines = loadVaccines();
  const newVaccine = {
    id: Date.now(),
    name: vaccineName.value.trim(),
    date: vaccineDate.value,
    vet: vaccineVet.value.trim() || 'N/A',
    notes: vaccineNotes.value.trim() || '',
    rappelDone: false,
  };

  vaccines.push(newVaccine);
  saveVaccines(vaccines);

  // Réinitialiser le formulaire
  form.reset();
  displayVaccines();
});

// ── Afficher les vaccins ────────────────────────────────────────────────
function displayVaccines() {
  const vaccines = loadVaccines();

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
function deleteVaccine(id) {
  if (confirm('Supprimer ce vaccin ?')) {
    let vaccines = loadVaccines();
    vaccines = vaccines.filter(v => v.id !== id);
    saveVaccines(vaccines);
    displayVaccines();
  }
}

// ── Basculer l'état du rappel ───────────────────────────────────────────
function toggleReminder(id, isDone) {
  let vaccines = loadVaccines();
  const vaccine = vaccines.find(v => v.id === id);
  if (vaccine) {
    vaccine.rappelDone = isDone;
    saveVaccines(vaccines);
    displayVaccines();
  }
}
