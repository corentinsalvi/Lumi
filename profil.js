// ── Récupérer les données utilisateur ──────────────────────────────────────
let userData = JSON.parse(localStorage.getItem('currentUser') || '{}');

// Si pas de données en localStorage, rediriger vers la connexion
if (!userData.id) {
  window.location.href = '/login.html';
}

// ── Formater un nombre (999, 1k, 1m) ──────────────────────────────────────
function formatCount(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return Math.floor(n / 1000000) + 'm';
  if (n >= 1000) return Math.floor(n / 1000) + 'k';
  return n.toString();
}

// ── Synchroniser abonnés/abonnements vers le serveur ───────────────────────
function syncFollowToServer(abonnes, abonnements) {
  if (!userData.id) return;
  fetch(`/api/users/${userData.id}/follow`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ abonnes, abonnements })
  }).catch(err => console.error('Erreur sync follow:', err));
}
// ── Écouter la mise à jour des vaccins et follows ──────────────────────
window.addEventListener('vaccinesUpdated', (e) => {
  userData = JSON.parse(localStorage.getItem('currentUser') || '{}');
  displayProfileData();
});

window.addEventListener('followUpdated', (e) => {
  displayProfileData();
});
// ── Afficher les données du profil ─────────────────────────────────────────
function displayProfileData() {
  // Propriétaire
  const ownerName = [userData.prenom, userData.nom].filter(Boolean).join(' ');

  // Infos chien
  document.getElementById('dogName').textContent = userData.chien_nom || 'Chien';
  document.getElementById('dogUsername').textContent = '@' + (userData.username || 'user_xxxxx');
  document.getElementById('dogRace').textContent = userData.race || 'Race inconnue';
  document.getElementById('dogAge').textContent = calculateAge(userData.dateNaissance) || 'Âge inconnu';
  
  // Ajouter le sexe aux infos : race • âge • sexe
  let sexeDisplay = '';
  if (userData.sexe === 'male') sexeDisplay = '♂️ Mâle';
  else if (userData.sexe === 'femelle') sexeDisplay = '♀️ Femelle';
  
  const profileInfo = document.getElementById('profileDetails');
  const raceText = userData.race || 'Race inconnue';
  const ageText = calculateAge(userData.dateNaissance) || 'Âge inconnu';
  profileInfo.innerHTML = `${raceText} • ${ageText}${sexeDisplay ? ' • ' + sexeDisplay : ''}<br>
    ${ownerName || 'Propriétaire inconnu'}`;

  // Infos propriétaire
  document.getElementById('ownerEmail').textContent = `Email: ${userData.email || 'Non renseigné'}`;
  document.getElementById('ownerPhone').textContent = `Tél: ${userData.telephone || 'Non renseigné'}`;
  document.getElementById('ownerCity').textContent = `Ville: ${userData.ville || 'Non renseignée'}`;

  // Stats
  document.getElementById('postsCount').textContent = userData.posts || '0';
  document.getElementById('rappelsCount').textContent = userData.vaccins || '0';
  
  // Abonnements et abonnés
  const following = JSON.parse(localStorage.getItem('following') || '[]');
  const followersKey = `followers_${userData.id}`;
  const followers = JSON.parse(localStorage.getItem(followersKey) || '[]');
  document.getElementById('abonnementsCount').textContent = formatCount(following.length);
  document.getElementById('abonnesCount').textContent = formatCount(followers.length);

  // Synchroniser les compteurs vers inscrits.json
  syncFollowToServer(followers.length, following.length);
}

// ── Calculer l'âge du chien ────────────────────────────────────────────────
function calculateAge(dateNaissance) {
  if (!dateNaissance) return null;
  
  const birth = new Date(dateNaissance);
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age > 0 ? `${age} ans` : 'Moins d\'1 an';
}

// ── Actions de menu ────────────────────────────────────────────────────────
function goToNotifications() {
  // À implémenter : page notifications
  alert('Page notifications (à venir)');
}

function goToPremium() {
  // À implémenter : page premium
  alert('Page PupLife Premium (à venir)');
}

function editProfile() {
  // À implémenter : édition du profil
  alert('Édition du profil (à venir)');
}

function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = '/login.html';
}

// ── Initialisation ─────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Compter les vaccins existants et les ajouter aux données utilisateur
  const vaccinesKey = 'vaccines_' + userData.id;
  const vaccines = JSON.parse(localStorage.getItem(vaccinesKey) || '[]');
  userData.vaccins = vaccines.length;
  localStorage.setItem('currentUser', JSON.stringify(userData));
  
  displayProfileData();
});
