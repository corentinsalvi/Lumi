// ── Récupérer les données de l'utilisateur à afficher ────────────────────
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
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

// ── Synchroniser abonnés/abonnements vers le serveur ───────────────────────
function syncFollowToServer(userId, abonnes, abonnements) {
  if (!userId) return;
  const body = {};
  if (abonnes !== null) body.abonnes = abonnes;
  if (abonnements !== null) body.abonnements = abonnements;
  fetch(`/api/users/${userId}/follow`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(err => console.error('Erreur sync follow:', err));
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
  document.getElementById('publicFollowersCount').textContent = formatCount(publicUserData.abonnes || 0);
  document.getElementById('publicFollowingCount').textContent = formatCount(publicUserData.abonnements || 0);

  // Vérifier si on suit déjà cet utilisateur
  const myFollowing = JSON.parse(localStorage.getItem('following') || '[]');
  const isFollowing = myFollowing.includes(parseInt(publicUserId));
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
            <span>${post.likes || 0}</span>
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
function toggleFollow() {
  if (!currentUser.id) {
    window.location.href = '/login.html';
    return;
  }

  const myFollowing = JSON.parse(localStorage.getItem('following') || '[]');
  const btn = document.getElementById('followBtn');
  
  if (myFollowing.includes(parseInt(publicUserId))) {
    // Unfollow
    const updated = myFollowing.filter(id => id !== parseInt(publicUserId));
    localStorage.setItem('following', JSON.stringify(updated));
    
    // Retirer du profil suivi aussi
    const followersKey = `followers_${publicUserId}`;
    const followers = JSON.parse(localStorage.getItem(followersKey) || '[]');
    const updatedFollowers = followers.filter(id => id !== currentUser.id);
    localStorage.setItem(followersKey, JSON.stringify(updatedFollowers));
    
    // Synchroniser les abonnements de l'utilisateur courant
    syncFollowToServer(currentUser.id, null, updated.length);

    updateFollowButton(false);
    displayPublicProfile();
  } else {
    // Follow
    myFollowing.push(parseInt(publicUserId));
    localStorage.setItem('following', JSON.stringify(myFollowing));
    
    // Ajouter au profil suivi aussi
    const followersKey = `followers_${publicUserId}`;
    const followers = JSON.parse(localStorage.getItem(followersKey) || '[]');
    if (!followers.includes(currentUser.id)) {
      followers.push(currentUser.id);
      localStorage.setItem(followersKey, JSON.stringify(followers));
    }
    
    // Synchroniser les abonnements de l'utilisateur courant
    syncFollowToServer(currentUser.id, null, myFollowing.length);

    updateFollowButton(true);
    displayPublicProfile();
  }
}

// ── Envoyer un message ─────────────────────────────────────────────────
function sendMessage() {
  alert('Messagerie (à venir)');
}

// ── Initialisation ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if (await loadPublicUserData()) {
    displayPublicProfile();
    displayPosts();
  } else {
    window.location.href = '/recherche';
  }
});
