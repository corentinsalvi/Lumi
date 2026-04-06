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

  // Photo de profil
  const avatar = document.getElementById('profileAvatar');
  avatar.src = userData.profil_url || 'logo-fonce.png';
  
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
  const postCount = Array.isArray(userData.post) ? userData.post.length : 0;
  document.getElementById('postsCount').textContent = postCount;
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
let editPhotoFile = null;

function editProfile() {
  const overlay = document.getElementById('editProfileOverlay');
  document.getElementById('editPhotoPreview').src = userData.profil_url || 'logo-fonce.png';
  document.getElementById('editUsername').value = userData.username || '';
  editPhotoFile = null;
  overlay.classList.add('open');
}

function closeEditProfile(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('editProfileOverlay').classList.remove('open');
}

// Prévisualiser la photo choisie
document.addEventListener('DOMContentLoaded', () => {
  const photoInput = document.getElementById('editPhotoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      editPhotoFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        document.getElementById('editPhotoPreview').src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }
});

async function saveProfile() {
  const btn = document.getElementById('btnSaveProfile');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enregistrement...';

  const formData = new FormData();
  const newUsername = document.getElementById('editUsername').value.trim();
  if (newUsername) formData.set('username', newUsername);
  if (editPhotoFile) formData.set('photo', editPhotoFile);

  try {
    const res = await fetch(`/api/users/${userData.id}/profile`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      // Mettre à jour localStorage
      if (data.user.username) userData.username = data.user.username;
      if (data.user.profil_url) userData.profil_url = data.user.profil_url;
      localStorage.setItem('currentUser', JSON.stringify(userData));

      displayProfileData();
      closeEditProfile();
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer';
      btn.disabled = false;
    } else {
      alert(data.message || 'Erreur');
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer';
      btn.disabled = false;
    }
  } catch (err) {
    console.error('Erreur sauvegarde profil:', err);
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer';
    btn.disabled = false;
  }
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
  loadMyPosts();
});

// ── Charger mes posts ─────────────────────────────────────────────────────
async function loadMyPosts() {
  const grid = document.getElementById('myPostsGrid');
  if (!grid) return;

  try {
    const res = await fetch(`/api/posts?user_id=${userData.id}`);
    const data = await res.json();

    if (!data.success || !data.posts.length) {
      grid.innerHTML = `
        <div class="my-posts-empty" style="grid-column: 1 / -1;">
          <i class="fa-solid fa-camera"></i>
          <p>Aucune publication</p>
          <a href="/nouveau-post">Publier une photo 🐾</a>
        </div>
      `;
      return;
    }

    grid.innerHTML = data.posts.map(post => {
      const thumb = post.image_url
        ? `<img src="${post.image_url}" alt="Post" loading="lazy" />`
        : `<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:24px;color:var(--muted);"><i class="fa-solid fa-align-left"></i></div>`;

      return `
        <div class="my-post-thumb" onclick='openPostDetail(${JSON.stringify(post).replace(/'/g, "&#39;")})'>
          ${thumb}
          <div class="my-post-overlay">
            <span><i class="fa-solid fa-heart"></i> ${post.likes || 0}</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error('Erreur chargement posts:', err);
  }
}

// ── Détail d'un post (modal) ─────────────────────────────────────────────
let currentPostId = null;

function openPostDetail(post) {
  currentPostId = post.post_id;

  const img = document.getElementById('postDetailImage');
  if (post.image_url) {
    img.src = post.image_url;
    img.style.display = 'block';
  } else {
    img.style.display = 'none';
  }

  document.getElementById('postDetailLikes').textContent = post.likes || 0;
  document.getElementById('postDetailCaption').value = post.caption || '';

  const locEl = document.getElementById('postDetailLocation');
  if (post.location) {
    locEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${post.location}`;
    locEl.style.display = 'block';
  } else {
    locEl.style.display = 'none';
  }

  const date = new Date(post.timestamp);
  document.getElementById('postDetailTime').textContent =
    date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  document.getElementById('postDetailOverlay').classList.add('open');
}

function closePostDetail(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('postDetailOverlay').classList.remove('open');
  currentPostId = null;
}

async function saveCaption() {
  if (!currentPostId) return;
  const caption = document.getElementById('postDetailCaption').value.trim();
  const btn = document.getElementById('btnSaveCaption');
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const res = await fetch(`/api/posts/${currentPostId}/caption`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption })
    });
    const data = await res.json();

    if (data.success) {
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistré !';
      setTimeout(() => {
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer';
        btn.disabled = false;
      }, 1500);
    } else {
      alert(data.message || 'Erreur');
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer';
      btn.disabled = false;
    }
  } catch (err) {
    console.error('Erreur sauvegarde:', err);
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer';
    btn.disabled = false;
  }
}

async function deleteMyPost() {
  if (!currentPostId) return;
  if (!confirm('Supprimer cette publication ?')) return;

  try {
    const res = await fetch(`/api/posts/${currentPostId}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      // Mettre à jour localStorage
      const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
      if (Array.isArray(cu.post)) {
        cu.post = cu.post.filter(p => p.post_id !== currentPostId);
        localStorage.setItem('currentUser', JSON.stringify(cu));
      }
      userData = JSON.parse(localStorage.getItem('currentUser') || '{}');

      closePostDetail();
      displayProfileData();
      loadMyPosts();
    }
  } catch (err) {
    console.error('Erreur suppression:', err);
  }
}
