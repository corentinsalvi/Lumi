// ── Récupérer les données de l'utilisateur à afficher ────────────────────
let currentUser = {};
let publicUserId = new URLSearchParams(window.location.search).get('id');

if (!publicUserId) {
  window.location.href = '/recherche';
}

// Charger les données depuis l'API
let publicUserData = {};

// ── Formater un nombre (999, 1k, 1m) ──────────────────────────────────────
function formatCount(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return Math.floor(n / 1000000) + 'm';
  if (n >= 1000) return Math.floor(n / 1000) + 'k';
  return n.toString();
}

// ── Fonction pour charger les données publiques ──────────────────────────
async function loadPublicUserData() {
  try {
    const response = await fetch(`/api/user-profile?id=${publicUserId}`);
    const data = await response.json();
    
    if (data.success) {
      publicUserData = data.data;
      return true;
    } else {
      console.error('Utilisateur non trouvé');
      return false;
    }
  } catch (err) {
    console.error('Erreur lors du chargement du profil:', err);
    return false;
  }
}

// ── Calculer l'âge du chien ────────────────────────────────────────────────
function calculateAge(dateNaissance) {
  if (!dateNaissance) return 'Âge inconnu';
  
  const birth = new Date(dateNaissance);
  const today = new Date();
  
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age > 0 ? `${age} ans` : 'Moins d\'1 an';
}

// ── Afficher les données du profil public ────────────────────────────────
function displayPublicProfile() {
  // Infos chien
  document.getElementById('publicDogName').textContent = publicUserData.chien_nom || 'Chien';
  document.getElementById('publicDogUsername').textContent = '@' + (publicUserData.username || 'user_xxxxx');
  document.getElementById('publicDogRace').textContent = publicUserData.race || 'Race inconnue';
  document.getElementById('publicDogAge').textContent = calculateAge(publicUserData.dateNaissance);

  // Photo de profil
  document.getElementById('publicProfileAvatar').src = publicUserData.profil_url || 'logo-fonce.png';
  
  // Propriétaire
  const ownerName = [publicUserData.prenom, publicUserData.nom].filter(Boolean).join(' ');
  document.getElementById('publicOwnerName').textContent = ownerName || 'Propriétaire inconnu';

  // Stats from server data
  const posts = publicUserData.post || [];
  document.getElementById('publicPostsCount').textContent = posts.length;
  const followersCount = Array.isArray(publicUserData.followers) ? publicUserData.followers.length : 0;
  const followingCount = Array.isArray(publicUserData.following) ? publicUserData.following.length : 0;
  document.getElementById('publicFollowersCount').textContent = formatCount(followersCount);
  document.getElementById('publicFollowingCount').textContent = formatCount(followingCount);

  // Vérifier si on suit déjà cet utilisateur (depuis les données serveur)
  const isFollowing = Array.isArray(publicUserData.followers) && publicUserData.followers.includes(currentUser.id);
  updateFollowButton(isFollowing);
}

// ── Afficher les posts ──────────────────────────────────────────────────
function displayPosts() {
  const posts = publicUserData.post || [];
  const postsContainer = document.getElementById('postsContainer');

  if (posts.length === 0) {
    postsContainer.innerHTML = `
      <div class="no-posts">
        <i class="fa-solid fa-camera"></i>
        <p>Aucune publication</p>
      </div>
    `;
    return;
  }

  // Trier par date décroissante
  const sorted = [...posts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  postsContainer.innerHTML = sorted.map(post => {
    const date = new Date(post.timestamp);
    const formattedDate = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });

    return `
      <div class="post-card">
        <div class="post-header">
          <img src="logo-fonce.png" alt="${publicUserData.chien_nom}" class="post-avatar" />
          <div class="post-author-info">
            <p class="post-author-name">${publicUserData.chien_nom || 'Chien'}</p>
            <p class="post-author-username">@${publicUserData.username || ''}</p>
          </div>
          <div class="post-date">${formattedDate}</div>
        </div>
        
        ${post.image_url ? `<img src="${post.image_url}" alt="Post" class="post-image" />` : ''}
        
        ${post.caption ? `<div class="post-content">${post.caption}</div>` : ''}
        
        <div class="post-actions">
          <div class="post-action">
            <i class="fa-solid fa-heart"></i>
            <span>${(post.liked_by || []).length}</span>
          </div>
          ${post.location ? `<div class="post-action"><i class="fa-solid fa-location-dot"></i><span>${post.location}</span></div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// ── Mettre à jour le bouton follow ──────────────────────────────────────
function updateFollowButton(isFollowing) {
  const btn = document.getElementById('followBtn');
  if (isFollowing) {
    btn.classList.add('following');
    btn.textContent = 'Suivi ✓';
  } else {
    btn.classList.remove('following');
    btn.textContent = 'Suivre';
  }
}

// ── Suivre/Unfollow ────────────────────────────────────────────────────
async function toggleFollow() {
  if (!currentUser.id) {
    window.location.href = '/login.html';
    return;
  }

  const btn = document.getElementById('followBtn');
  btn.disabled = true;

  const isCurrentlyFollowing = Array.isArray(publicUserData.followers) && publicUserData.followers.includes(currentUser.id);
  const method = isCurrentlyFollowing ? 'DELETE' : 'POST';

  try {
    const res = await fetch('/api/follow', {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target_id: parseInt(publicUserId)
      })
    });

    const data = await res.json();

    if (data.success) {
      // Recharger les données du profil public pour avoir les listes à jour
      await loadPublicUserData();
      displayPublicProfile();
    }
  } catch (err) {
    console.error('Erreur follow/unfollow:', err);
  }

  btn.disabled = false;
}

// ── Envoyer un message ─────────────────────────────────────────────────
function sendMessage() {
  alert('Messagerie (à venir)');
}

// ── Voir abonnés / abonnements du profil public ────────────────────────
async function showPublicFollowers() {
  const ids = Array.isArray(publicUserData.followers) ? publicUserData.followers : [];
  openFollowModal('Abonnés', ids);
}

async function showPublicFollowing() {
  const ids = Array.isArray(publicUserData.following) ? publicUserData.following : [];
  openFollowModal('Abonnements', ids);
}

async function openFollowModal(title, ids) {
  const overlay = document.getElementById('followOverlay');
  const list = document.getElementById('followList');
  document.getElementById('followModalTitle').textContent = title;
  list.innerHTML = '<div class="follow-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>';
  overlay.classList.add('open');

  if (!ids.length) {
    list.innerHTML = `<div class="follow-empty">Aucun ${title.toLowerCase()}</div>`;
    return;
  }

  try {
    const res = await fetch('/api/users/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    });
    const data = await res.json();

    if (!data.success || !data.users.length) {
      list.innerHTML = `<div class="follow-empty">Aucun ${title.toLowerCase()}</div>`;
      return;
    }

    list.innerHTML = data.users.map(u => `
      <div class="follow-item" onclick="window.location.href='/profil-public?id=${u.id}'">
        <img src="${u.profil_url || 'logo-fonce.png'}" alt="${u.chien_nom}" class="follow-avatar" />
        <span class="follow-name">${u.chien_nom}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error('Erreur chargement follow:', err);
    list.innerHTML = '<div class="follow-empty">Erreur de chargement</div>';
  }
}

function closeFollowModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('followOverlay').classList.remove('open');
}

// ── Initialisation ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Charger l'utilisateur connecté depuis la session
  try {
    const meRes = await fetch('/api/me');
    const meData = await meRes.json();
    if (meData.success) currentUser = meData.user;
  } catch (e) {}

  if (await loadPublicUserData()) {
    displayPublicProfile();
    displayPosts();
  } else {
    window.location.href = '/recherche';
  }
});
