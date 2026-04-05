// ── Sélecteurs ──────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const resultsList = document.getElementById('resultsList');
const searchEmpty = document.getElementById('searchEmpty');

// ── Récupérer les données de l'utilisateur actuel ─────────────────────────
let currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

// ── Événement de recherche ───────────────────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  const query = e.target.value.trim();
  
  if (query.length < 2) {
    resultsList.innerHTML = '';
    searchResults.classList.add('hidden');
    searchEmpty.classList.remove('hidden');
    return;
  }

  searchTimeout = setTimeout(() => {
    performSearch(query);
  }, 300);
});

// ── Fonction de recherche ────────────────────────────────────────────────
async function performSearch(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await response.json();

    if (data.success && data.results.length > 0) {
      displayResults(data.results);
      searchResults.classList.remove('hidden');
      searchEmpty.classList.add('hidden');
    } else {
      resultsList.innerHTML = '<p style="text-align: center; color: var(--muted); padding: 20px;">Aucun résultat trouvé</p>';
      searchResults.classList.remove('hidden');
      searchEmpty.classList.add('hidden');
    }
  } catch (err) {
    console.error('Erreur lors de la recherche:', err);
    resultsList.innerHTML = '<p style="text-align: center; color: var(--error); padding: 20px;">Erreur lors de la recherche</p>';
  }
}

// ── Afficher les résultats ───────────────────────────────────────────────
function displayResults(results) {
  const following = JSON.parse(localStorage.getItem('following') || '[]');
  
  resultsList.innerHTML = results.map(user => {
    let sexeSymbol = '';
    if (user.sexe === 'male') sexeSymbol = '♂️';
    else if (user.sexe === 'femelle') sexeSymbol = '♀️';
    
    const isFollowing = following.includes(parseInt(user.id));
    const btnClass = isFollowing ? 'user-follow-btn following' : 'user-follow-btn';
    const btnText = isFollowing ? 'Suivi ✓' : 'Suivre';
    
    return `
    <div class="user-card" onclick="viewProfile('${user.id}')">
      <img src="logo-fonce.png" alt="${user.chien_nom}" class="user-avatar" />
      <div class="user-info">
        <p class="user-name">${user.chien_nom}</p>
        <p class="user-username">@${user.username}</p>
        <p class="user-dog">${user.race} ${sexeSymbol} • ${user.prenom} ${user.nom}</p>
      </div>
      <button class="${btnClass}" onclick="followUser(event, '${user.id}')">
        ${btnText}
      </button>
    </div>
  `}).join('');
}

// ── Voir le profil d'un utilisateur ──────────────────────────────────────
function viewProfile(userId) {
  // Récupérer les données de l'utilisateur depuis les résultats affichés
  const userCard = event.currentTarget;
  
  // Extraire les données du user, on doit les stocker pour profil-public.js
  // Pour l'instant, naviguer avec l'ID en paramètre
  window.location.href = `/profil-public?id=${userId}`;
}

// ── Suivre un utilisateur ────────────────────────────────────────────────
function followUser(event, userId) {
  event.stopPropagation();
  const btn = event.target;
  const myId = currentUser.id;
  
  if (btn.classList.contains('following')) {
    // Unfollow
    btn.classList.remove('following');
    btn.textContent = 'Suivre';
    
    // Retirer userId de ma liste "following"
    let following = JSON.parse(localStorage.getItem('following') || '[]');
    following = following.filter(id => id !== parseInt(userId));
    localStorage.setItem('following', JSON.stringify(following));
    
    // Retirer mon ID de la liste "followers_userId"
    const followersKey = `followers_${userId}`;
    let followers = JSON.parse(localStorage.getItem(followersKey) || '[]');
    followers = followers.filter(id => id !== myId);
    localStorage.setItem(followersKey, JSON.stringify(followers));
  } else {
    // Follow
    btn.classList.add('following');
    btn.textContent = 'Suivi ✓';
    
    // Ajouter userId à ma liste "following"
    let following = JSON.parse(localStorage.getItem('following') || '[]');
    if (!following.includes(parseInt(userId))) {
      following.push(parseInt(userId));
      localStorage.setItem('following', JSON.stringify(following));
    }
    
    // Ajouter mon ID à la liste "followers_userId"
    const followersKey = `followers_${userId}`;
    let followers = JSON.parse(localStorage.getItem(followersKey) || '[]');
    if (!followers.includes(myId)) {
      followers.push(myId);
      localStorage.setItem(followersKey, JSON.stringify(followers));
    }
  }
  
  // Mettre à jour le profil si on est sur sa page
  window.dispatchEvent(new CustomEvent('followUpdated'));
}

// ── Initialisation ───────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier que l'utilisateur est connecté
  if (!currentUser.id) {
    window.location.href = '/login.html';
  }
});
