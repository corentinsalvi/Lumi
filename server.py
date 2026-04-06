"""
Odoggy — Serveur complet
==========================
- Sert les fichiers statiques (HTML, CSS, JS)
- Gère l'API d'inscription
- Stocke les inscrits dans inscrits.json

Installation :
    pip install flask flask-cors bcrypt

Lancement :
    python server.py

Puis ouvrir : http://localhost:5000
"""

import json
import os
import re
import uuid
import hashlib
import secrets
import string
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory, session
from flask_cors import CORS

try:
    import bcrypt
    USE_BCRYPT = True
except ImportError:
    USE_BCRYPT = False
    print("⚠  bcrypt non installé — hash SHA-256 utilisé à la place.")
    print("   Pour un hash sécurisé : pip install bcrypt")

# ── Config ───────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
DATA_FILE   = BASE_DIR / "inscrits.json"
UPLOAD_DIR  = BASE_DIR / "static" / "uploads"
ALLOWED_EXT = {".jpg", ".jpeg", ".png"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 Mo

app = Flask(__name__, static_folder=str(BASE_DIR / "static"))
app.secret_key = secrets.token_hex(32)
CORS(app)


# ── Servir les fichiers statiques ────────────────────────────────────────────

@app.route("/")
def index():
    """Page d'accueil → inscription.html"""
    return send_from_directory(BASE_DIR, "inscription.html")

@app.route("/inscription")
def inscription_page():
    """Page d'inscription → inscription.html"""
    return send_from_directory(BASE_DIR, "inscription.html")

@app.route("/tableau-de-bord")
def tableau_de_bord():
    """Tableau de bord → redirige vers feed.html"""
    return send_from_directory(BASE_DIR, "feed.html")

@app.route("/profil")
def profil_page():
    """Page de profil → profil.html"""
    return send_from_directory(BASE_DIR, "profil.html")

@app.route("/recherche")
def recherche_page():
    """Page de recherche → recherche.html"""
    return send_from_directory(BASE_DIR, "recherche.html")

@app.route("/carnet-sante")
def carnet_sante():
    """Carnet de santé → carnet-sante.html"""
    return send_from_directory(BASE_DIR, "carnet-sante.html")

@app.route("/profil-public")
def profil_public():
    """Page de profil public → profil-public.html"""
    return send_from_directory(BASE_DIR, "profil-public.html")

@app.route("/feed")
def feed_page():
    """Page feed → feed.html"""
    return send_from_directory(BASE_DIR, "feed.html")

@app.route("/nouveau-post")
def nouveau_post_page():
    """Page création de post → nouveau-post.html"""
    return send_from_directory(BASE_DIR, "nouveau-post.html")

@app.route("/<path:filename>")
def static_files(filename):
    """Sert style.css, inscription.js, login.html, et tout autre fichier du dossier"""
    return send_from_directory(BASE_DIR, filename)


# ── Helpers ──────────────────────────────────────────────────────────────────

def load_inscrits() -> list:
    if not DATA_FILE.exists():
        return []
    with DATA_FILE.open("r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            return []

def save_inscrits(inscrits: list) -> None:
    with DATA_FILE.open("w", encoding="utf-8") as f:
        json.dump(inscrits, f, ensure_ascii=False, indent=2)


def allowed_file(filename: str) -> bool:
    """Vérifie que l'extension du fichier est autorisée."""
    ext = os.path.splitext(filename)[1].lower()
    return ext in ALLOWED_EXT


def hash_password(password: str) -> str:
    if USE_BCRYPT:
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        return hashed.decode("utf-8")
    salt = secrets.token_hex(16)
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"sha256${salt}${h}"

def verify_password(password: str, hashed: str) -> bool:
    """Vérifier si le mot de passe correspond au hash"""
    if USE_BCRYPT:
        try:
            return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False
    # Mode SHA-256
    if "$" in hashed:
        parts = hashed.split("$")
        if len(parts) != 3 or parts[0] != "sha256":
            return False
        salt = parts[1]
        stored_hash = parts[2]
        computed_hash = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
        return computed_hash == stored_hash
    return False

def email_valide(email: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", email))

def telephone_valide(tel: str) -> bool:
    if not tel:
        return True
    return bool(re.match(r"^(\+33|0)[0-9 .\-]{8,14}$", tel.strip()))

def generate_unique_username(inscrits: list) -> str:
    """Générer un username unique au format user_XXXXXXX"""
    existing_usernames = {u.get("username") for u in inscrits if "username" in u}
    while True:
        random_part = ''.join(secrets.choice(string.digits + string.ascii_lowercase) for _ in range(7))
        username = f"user_{random_part}"
        if username not in existing_usernames:
            return username


# ── API Session / Auth ────────────────────────────────────────────────────────

@app.route("/api/me", methods=["GET"])
def get_me():
    """Retourne les données de l'utilisateur connecté via la session."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"success": False, "message": "Non connecté."}), 401

    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    if not user:
        session.clear()
        return jsonify({"success": False, "message": "Utilisateur introuvable."}), 401

    user_data = {k: v for k, v in user.items() if k != "mot_de_passe"}
    return jsonify({"success": True, "user": user_data}), 200


@app.route("/api/logout", methods=["POST"])
def logout():
    """Déconnexion — supprime la session."""
    session.clear()
    return jsonify({"success": True, "message": "Déconnecté."}), 200


@app.route("/api/session/step1", methods=["POST"])
def session_step1():
    """Stocker les données de l'étape 1 d'inscription en session."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False}), 400
    session["step1"] = data
    return jsonify({"success": True}), 200


@app.route("/api/session/step2", methods=["POST"])
def session_step2():
    """Stocker les données de l'étape 2 d'inscription en session."""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False}), 400
    session["step2"] = data
    return jsonify({"success": True}), 200


@app.route("/api/session/steps", methods=["GET"])
def session_steps():
    """Récupérer les données des étapes d'inscription stockées en session."""
    return jsonify({
        "success": True,
        "step1": session.get("step1", {}),
        "step2": session.get("step2", {}),
    }), 200


# ── API inscription ───────────────────────────────────────────────────────────

@app.route("/api/inscription", methods=["POST"])
def inscription():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "Données JSON manquantes."}), 400

    erreurs = []

    # Prénom
    prenom = (data.get("prenom") or "").strip()
    if not prenom or len(prenom) < 2:
        erreurs.append("Le prénom est obligatoire (min. 2 caractères).")

    # Nom
    nom = (data.get("nom") or "").strip()
    if not nom or len(nom) < 2:
        erreurs.append("Le nom est obligatoire (min. 2 caractères).")

    email = (data.get("email") or "").strip().lower()
    if not email:
        erreurs.append("L'adresse e-mail est obligatoire.")
    elif not email_valide(email):
        erreurs.append("Format d'e-mail invalide.")

    telephone = (data.get("telephone") or "").strip()
    if not telephone_valide(telephone):
        erreurs.append("Numéro de téléphone invalide.")

    ville = (data.get("ville") or "").strip()
    if not ville or len(ville) < 2:
        erreurs.append("La ville est obligatoire.")

    chien_nom = (data.get("chien_nom") or "").strip()
    if not chien_nom:
        erreurs.append("Le nom du chien est obligatoire.")

    race = (data.get("race") or "").strip()
    if not race or len(race) < 2:
        erreurs.append("La race est obligatoire (min. 2 caractères).")

    # Poids
    try:
        poids = float(data.get("poids") or 0)
        if poids <= 0 or poids > 200:
            erreurs.append("Le poids doit être entre 0.5 et 200 kg.")
    except (ValueError, TypeError):
        erreurs.append("Le poids doit être un nombre valide.")

    # Date de naissance
    date_naissance = (data.get("dateNaissance") or "").strip()
    if not date_naissance:
        erreurs.append("La date de naissance est obligatoire.")
    else:
        try:
            date_obj = datetime.fromisoformat(date_naissance)
            if date_obj > datetime.now():
                erreurs.append("La date de naissance ne peut pas être dans le futur.")
        except ValueError:
            erreurs.append("Format de date invalide.")

    # Sexe
    sexe = (data.get("sexe") or "").strip().lower()
    if not sexe:
        erreurs.append("Le sexe du chien est obligatoire.")
    elif sexe not in ["male", "femelle"]:
        erreurs.append("Le sexe doit être 'male' ou 'femelle'.")

    mot_de_passe = data.get("mot_de_passe") or ""
    if not mot_de_passe or len(mot_de_passe) < 8:
        erreurs.append("Le mot de passe doit contenir au moins 8 caractères.")

    if erreurs:
        return jsonify({"success": False, "message": " | ".join(erreurs)}), 422

    inscrits = load_inscrits()
    if any(u["email"] == email for u in inscrits):
        return jsonify({
            "success": False,
            "message": f"L'adresse {email} est déjà utilisée."
        }), 409

    # Générer un username unique
    username = generate_unique_username(inscrits)

    nouvel_inscrit = {
        "id":               len(inscrits) + 1,
        "username":         username,
        "prenom":           prenom,
        "nom":              nom,
        "email":            email,
        "telephone":        telephone,
        "ville":            ville,
        "chien_nom":        chien_nom,
        "race":             race,
        "poids":            poids,
        "dateNaissance":    date_naissance,
        "sexe":             sexe,
        "mot_de_passe":     hash_password(mot_de_passe),
        "date_inscription": datetime.now().isoformat(timespec="seconds"),
        "actif":            True,
    }

    inscrits.append(nouvel_inscrit)
    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] ✅ Nouvel inscrit : {prenom} {nom} ({email}) — username: {username} — chien : {chien_nom} ({race}, {poids}kg, {sexe}, né le {date_naissance})")

    session["user_id"] = nouvel_inscrit["id"]
    session.pop("step1", None)
    session.pop("step2", None)

    return jsonify({
        "success": True,
        "message": f"Bienvenue {prenom} ! 🐾",
    }), 201


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "Données JSON manquantes."}), 400

    email = (data.get("email") or "").strip().lower()
    mot_de_passe = data.get("mot_de_passe") or ""

    if not email or not mot_de_passe:
        return jsonify({
            "success": False,
            "message": "L'adresse e-mail et le mot de passe sont obligatoires."
        }), 422

    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["email"] == email), None)

    if not user:
        return jsonify({
            "success": False,
            "message": "Adresse e-mail ou mot de passe incorrect."
        }), 401

    if not verify_password(mot_de_passe, user["mot_de_passe"]):
        return jsonify({
            "success": False,
            "message": "Adresse e-mail ou mot de passe incorrect."
        }), 401

    print(f"[{datetime.now():%H:%M:%S}] ✅ Connexion : {user['prenom']} {user['nom']} ({email})")

    session["user_id"] = user["id"]

    return jsonify({
        "success": True,
        "message": f"Bienvenue {user['prenom']} ! 🐾",
    }), 200


@app.route("/api/user-profile", methods=["GET"])
def user_profile():
    """Récupère le profil de l'utilisateur actuellement connecté"""
    user_id = request.args.get("id", type=int)
    
    if not user_id:
        return jsonify({"success": False, "message": "ID utilisateur manquant."}), 400
    
    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    
    if not user:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404
    
    # Retourner les données sans le mot de passe
    user_data = {k: v for k, v in user.items() if k != "mot_de_passe"}
    return jsonify({"success": True, "data": user_data}), 200


@app.route("/api/inscrits", methods=["GET"])
def liste_inscrits():
    inscrits = load_inscrits()
    publics = [{k: v for k, v in u.items() if k != "mot_de_passe"} for u in inscrits]
    return jsonify({"total": len(publics), "inscrits": publics})


@app.route("/api/inscrits/<int:user_id>", methods=["DELETE"])
def supprimer_inscrit(user_id: int):
    inscrits = load_inscrits()
    avant = len(inscrits)
    inscrits = [u for u in inscrits if u["id"] != user_id]
    if len(inscrits) == avant:
        return jsonify({"success": False, "message": "Inscrit introuvable."}), 404
    save_inscrits(inscrits)
    return jsonify({"success": True, "message": f"Inscrit #{user_id} supprimé."})


@app.route("/api/users/<int:user_id>/rappels", methods=["GET"])
def get_rappels(user_id: int):
    """Récupère les rappels d'un utilisateur depuis inscrits.json"""
    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    if not user:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404
    return jsonify({"success": True, "rappels": user.get("rappel", [])}), 200


@app.route("/api/users/<int:user_id>/rappels", methods=["PUT"])
def update_rappels(user_id: int):
    """Met à jour le champ rappel d'un utilisateur dans inscrits.json"""
    data = request.get_json(silent=True)
    if data is None or "rappels" not in data:
        return jsonify({"success": False, "message": "Données JSON manquantes (champ 'rappels')."}), 400

    rappels = data["rappels"]
    if not isinstance(rappels, list):
        return jsonify({"success": False, "message": "Le champ 'rappels' doit être une liste."}), 422

    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)

    if not user:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404

    user["rappel"] = rappels
    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] 🔔 Rappels mis à jour pour l'utilisateur #{user_id} ({len(rappels)} rappel(s))")

    return jsonify({"success": True, "message": "Rappels mis à jour.", "count": len(rappels)}), 200


@app.route("/api/follow", methods=["POST"])
def follow_user():
    """Suivre un utilisateur — le serveur gère les deux listes (following + followers)"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "Données JSON manquantes."}), 400

    user_id = data.get("user_id")
    target_id = data.get("target_id")

    if not user_id or not target_id:
        return jsonify({"success": False, "message": "user_id et target_id requis."}), 422
    if user_id == target_id:
        return jsonify({"success": False, "message": "Impossible de se suivre soi-même."}), 422

    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    target = next((u for u in inscrits if u["id"] == target_id), None)

    if not user or not target:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404

    # Initialiser les listes si absentes
    if not isinstance(user.get("following"), list):
        user["following"] = []
    if not isinstance(target.get("followers"), list):
        target["followers"] = []

    # Ajouter si pas déjà suivi
    if target_id not in user["following"]:
        user["following"].append(target_id)
    if user_id not in target["followers"]:
        target["followers"].append(user_id)

    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] ➕ #{user_id} suit #{target_id}")

    return jsonify({
        "success": True,
        "is_following": True,
        "my_following_count": len(user["following"]),
        "target_followers_count": len(target["followers"])
    }), 200


@app.route("/api/follow", methods=["DELETE"])
def unfollow_user():
    """Ne plus suivre un utilisateur — le serveur gère les deux listes"""
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"success": False, "message": "Données JSON manquantes."}), 400

    user_id = data.get("user_id")
    target_id = data.get("target_id")

    if not user_id or not target_id:
        return jsonify({"success": False, "message": "user_id et target_id requis."}), 422

    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    target = next((u for u in inscrits if u["id"] == target_id), None)

    if not user or not target:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404

    # Retirer des listes
    if isinstance(user.get("following"), list) and target_id in user["following"]:
        user["following"].remove(target_id)
    if isinstance(target.get("followers"), list) and user_id in target["followers"]:
        target["followers"].remove(user_id)

    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] ➖ #{user_id} ne suit plus #{target_id}")

    return jsonify({
        "success": True,
        "is_following": False,
        "my_following_count": len(user.get("following", [])),
        "target_followers_count": len(target.get("followers", []))
    }), 200


@app.route("/api/users/<int:user_id>/follow-status/<int:target_id>", methods=["GET"])
def get_follow_status(user_id, target_id):
    """Vérifie si user_id suit target_id"""
    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    if not user:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404

    following = user.get("following", [])
    return jsonify({
        "success": True,
        "is_following": target_id in following
    }), 200


@app.route("/api/search", methods=["GET"])
def search_users():
    """Rechercher des utilisateurs par username, nom du chien ou nom du propriétaire"""
    query = (request.args.get("q") or "").strip().lower()
    
    if not query or len(query) < 2:
        return jsonify({"success": False, "message": "Requête de recherche trop courte."}), 400
    
    inscrits = load_inscrits()
    results = []
    
    for user in inscrits:
        # Vérifier si la requête correspond à l'username, chien_nom, prenom ou nom
        if (
            query in user.get("username", "").lower() or
            query in user.get("chien_nom", "").lower() or
            query in user.get("prenom", "").lower() or
            query in user.get("nom", "").lower()
        ):
            results.append({
                "id": user["id"],
                "username": user.get("username", ""),
                "chien_nom": user.get("chien_nom", "Chien"),
                "race": user.get("race", "Race inconnue"),
                "prenom": user.get("prenom", ""),
                "nom": user.get("nom", ""),
                "sexe": user.get("sexe", ""),
                "profil_url": user.get("profil_url", ""),
            })
    
    return jsonify({"success": True, "results": results}), 200


# ── API Upload d'image / Posts ───────────────────────────────────────────────

@app.route("/api/posts", methods=["POST"])
def create_post():
    """Créer un post avec upload d'image sécurisé.

    Attend un formulaire multipart avec :
      - user_id  (int)   : identifiant de l'utilisateur
      - caption  (str)   : légende du post (optionnel)
      - location (str)   : lieu (optionnel)
      - image    (file)  : fichier image (.jpg, .jpeg, .png)
    """
    # ── Récupérer l'user_id ─────────────────────────────────────────────
    user_id = request.form.get("user_id", type=int)
    if not user_id:
        return jsonify({"success": False, "message": "user_id manquant."}), 400

    # Vérifier que l'utilisateur existe
    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    if not user:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404

    caption  = (request.form.get("caption") or "").strip()
    location = (request.form.get("location") or "").strip()

    # ── Récupérer et valider l'image ───────────────────────────────────
    image = request.files.get("image")
    image_url = None

    if image and image.filename:
        # Vérifier l'extension
        if not allowed_file(image.filename):
            return jsonify({
                "success": False,
                "message": "Extension non autorisée. Seuls .jpg, .jpeg et .png sont acceptés."
            }), 422

        # Vérifier la taille (lire le contenu en mémoire)
        image_data = image.read()
        if len(image_data) > MAX_FILE_SIZE:
            return jsonify({
                "success": False,
                "message": "Fichier trop volumineux (max 5 Mo)."
            }), 413

        # Générer un nom unique avec uuid
        ext = os.path.splitext(image.filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex[:16]}{ext}"

        # Créer le dossier utilisateur si nécessaire
        user_upload_dir = UPLOAD_DIR / f"user_{user_id}"
        os.makedirs(user_upload_dir, exist_ok=True)

        # Sauvegarder le fichier
        file_path = user_upload_dir / unique_name
        with open(file_path, "wb") as f:
            f.write(image_data)

        # Chemin relatif pour l'URL
        image_url = f"/static/uploads/user_{user_id}/{unique_name}"

    # Un post doit avoir au moins une légende ou une image
    if not caption and not image_url:
        return jsonify({"success": False, "message": "Le post doit contenir du texte ou une image."}), 422

    # ── Sauvegarder dans inscrits.json (champ post[]) ─────────────────
    new_post = {
        "post_id":   uuid.uuid4().hex,
        "image_url": image_url,
        "caption":   caption,
        "location":  location,
        "timestamp": datetime.now().isoformat(timespec="seconds"),
        "liked_by": [],
    }
    if "post" not in user:
        user["post"] = []
    user["post"].append(new_post)
    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] 📸 Nouveau post {new_post['post_id'][:8]} par @{user.get('username', '?')}" +
          (f" avec image" if image_url else ""))

    # Enrichir la réponse pour le client
    response_post = dict(new_post)
    response_post["user_id"]   = user_id
    response_post["username"]  = user.get("username", "")
    response_post["chien_nom"] = user.get("chien_nom", "")
    response_post["profil_url"] = user.get("profil_url", "")
    response_post["likes"]     = 0

    return jsonify({"success": True, "message": "Post créé !", "post": response_post}), 201


@app.route("/api/posts", methods=["GET"])
def get_posts():
    """Récupérer les posts depuis inscrits.json, optionnellement filtrés par user_id."""
    user_id = request.args.get("user_id", type=int)
    inscrits = load_inscrits()

    posts = []
    for u in inscrits:
        for p in u.get("post", []):
            # Enrichir le post avec les infos du propriétaire (non stockées dans le post)
            enriched = dict(p)
            enriched["user_id"]   = u["id"]
            enriched["username"]  = u.get("username", "")
            enriched["chien_nom"] = u.get("chien_nom", "")
            enriched["profil_url"] = u.get("profil_url", "")
            enriched["likes"]     = len(p.get("liked_by", []))
            posts.append(enriched)

    if user_id:
        posts = [p for p in posts if p["user_id"] == user_id]

    # Trier par date décroissante (plus récent en premier)
    posts.sort(key=lambda p: p.get("timestamp", ""), reverse=True)

    return jsonify({"success": True, "posts": posts}), 200


@app.route("/api/posts/<post_id>", methods=["DELETE"])
def delete_post(post_id: str):
    """Supprimer un post et son image associée."""
    inscrits = load_inscrits()
    found_post = None
    found_user = None

    for u in inscrits:
        for p in u.get("post", []):
            if p.get("post_id") == post_id:
                found_post = p
                found_user = u
                break
        if found_post:
            break

    if not found_post:
        return jsonify({"success": False, "message": "Post introuvable."}), 404

    # Supprimer l'image du disque si elle existe
    if found_post.get("image_url"):
        image_path = BASE_DIR / found_post["image_url"].lstrip("/")
        if image_path.exists():
            image_path.unlink()

    found_user["post"] = [p for p in found_user["post"] if p.get("post_id") != post_id]
    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] 🗑️ Post {post_id[:8]} supprimé")
    return jsonify({"success": True, "message": "Post supprimé."}), 200


@app.route("/api/posts/<post_id>/like", methods=["PUT"])
def like_post(post_id: str):
    """Toggle like sur un post. Ajoute/retire le user_id dans liked_by."""
    data = request.get_json(silent=True)
    if not data or "user_id" not in data:
        return jsonify({"success": False, "message": "user_id manquant."}), 400

    user_id = data["user_id"]
    if not isinstance(user_id, int):
        return jsonify({"success": False, "message": "user_id invalide."}), 400

    inscrits = load_inscrits()
    found_post = None

    for u in inscrits:
        for p in u.get("post", []):
            if p.get("post_id") == post_id:
                found_post = p
                break
        if found_post:
            break

    if not found_post:
        return jsonify({"success": False, "message": "Post introuvable."}), 404

    # Initialiser liked_by si absent
    if "liked_by" not in found_post:
        found_post["liked_by"] = []

    liked = False
    if user_id in found_post["liked_by"]:
        found_post["liked_by"].remove(user_id)
    else:
        found_post["liked_by"].append(user_id)
        liked = True

    save_inscrits(inscrits)

    return jsonify({
        "success": True,
        "liked": liked,
        "likes": len(found_post["liked_by"]),
        "liked_by": found_post["liked_by"]
    }), 200


@app.route("/api/posts/<post_id>/likers", methods=["GET"])
def get_likers(post_id: str):
    """Récupérer la liste des utilisateurs qui ont liké un post."""
    inscrits = load_inscrits()
    found_post = None

    for u in inscrits:
        for p in u.get("post", []):
            if p.get("post_id") == post_id:
                found_post = p
                break
        if found_post:
            break

    if not found_post:
        return jsonify({"success": False, "message": "Post introuvable."}), 404

    liked_by = found_post.get("liked_by", [])
    users_map = {u["id"]: u for u in inscrits}

    likers = []
    for uid in liked_by:
        u = users_map.get(uid)
        if u:
            likers.append({
                "id": u["id"],
                "username": u.get("username", ""),
                "chien_nom": u.get("chien_nom", "Chien"),
                "profil_url": u.get("profil_url", ""),
            })

    return jsonify({"success": True, "likers": likers}), 200


@app.route("/api/users/batch", methods=["POST"])
def get_users_batch():
    """Renvoie les infos basiques pour une liste d'IDs utilisateur."""
    data = request.get_json(silent=True)
    if not data or "ids" not in data:
        return jsonify({"success": False, "message": "Champ 'ids' manquant."}), 400

    ids = data["ids"]
    if not isinstance(ids, list):
        return jsonify({"success": False, "message": "'ids' doit être une liste."}), 400

    inscrits = load_inscrits()
    users_map = {u["id"]: u for u in inscrits}

    result = []
    for uid in ids:
        u = users_map.get(uid)
        if u:
            result.append({
                "id": u["id"],
                "username": u.get("username", ""),
                "chien_nom": u.get("chien_nom", "Chien"),
                "profil_url": u.get("profil_url", ""),
            })

    return jsonify({"success": True, "users": result}), 200


@app.route("/api/posts/<post_id>/caption", methods=["PUT"])
def update_caption(post_id: str):
    """Modifier la légende d'un post."""
    data = request.get_json(silent=True)
    if data is None or "caption" not in data:
        return jsonify({"success": False, "message": "Champ 'caption' manquant."}), 400

    caption = (data.get("caption") or "").strip()

    inscrits = load_inscrits()
    found_post = None

    for u in inscrits:
        for p in u.get("post", []):
            if p.get("post_id") == post_id:
                found_post = p
                break
        if found_post:
            break

    if not found_post:
        return jsonify({"success": False, "message": "Post introuvable."}), 404

    found_post["caption"] = caption
    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] ✏️ Légende modifiée pour post {post_id[:8]}")
    return jsonify({"success": True, "message": "Légende mise à jour.", "caption": caption}), 200


@app.route("/api/users/<int:user_id>/profile", methods=["POST"])
def update_profile(user_id: int):
    """Modifier la photo de profil et/ou le username."""
    inscrits = load_inscrits()
    user = next((u for u in inscrits if u["id"] == user_id), None)
    if not user:
        return jsonify({"success": False, "message": "Utilisateur non trouvé."}), 404

    # Username
    new_username = (request.form.get("username") or "").strip()
    if new_username and new_username != user.get("username", ""):
        # Vérifier unicité
        if any(u.get("username") == new_username and u["id"] != user_id for u in inscrits):
            return jsonify({"success": False, "message": "Ce nom d'utilisateur est déjà pris."}), 409
        user["username"] = new_username

    # Photo de profil
    image = request.files.get("photo")
    if image and image.filename:
        if not allowed_file(image.filename):
            return jsonify({"success": False, "message": "Extension non autorisée (.jpg, .jpeg, .png)."}), 422

        image_data = image.read()
        if len(image_data) > MAX_FILE_SIZE:
            return jsonify({"success": False, "message": "Fichier trop volumineux (max 5 Mo)."}), 413

        ext = os.path.splitext(image.filename)[1].lower()
        unique_name = f"{uuid.uuid4().hex[:16]}{ext}"

        photo_dir = UPLOAD_DIR / f"user_{user_id}" / "photo-profil"
        os.makedirs(photo_dir, exist_ok=True)

        # Supprimer l'ancienne photo si elle existe
        old_url = user.get("profil_url", "")
        if old_url:
            old_path = BASE_DIR / old_url.lstrip("/")
            if old_path.exists():
                old_path.unlink()

        file_path = photo_dir / unique_name
        with open(file_path, "wb") as f:
            f.write(image_data)

        user["profil_url"] = f"/static/uploads/user_{user_id}/photo-profil/{unique_name}"

    save_inscrits(inscrits)

    # Retourner les données mises à jour (sans mot de passe)
    user_data = {k: v for k, v in user.items() if k != "mot_de_passe"}
    print(f"[{datetime.now():%H:%M:%S}] 📝 Profil mis à jour pour #{user_id}")
    return jsonify({"success": True, "message": "Profil mis à jour.", "user": user_data}), 200


# ── Lancement ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 54)
    print("  🐾  Odoggy — Serveur complet")
    print("=" * 54)
    print(f"  📂  Dossier servi  : {BASE_DIR}")
    print(f"  📄  Fichier JSON   : {DATA_FILE}")
    print(f"  📷  Uploads dir    : {UPLOAD_DIR}")
    print(f"  🔒  Hash bcrypt    : {'Oui' if USE_BCRYPT else 'Non (pip install bcrypt)'}")
    print()
    print("  ✅  Ouvrez votre navigateur sur :")
    print("      http://localhost:5000")
    print()
    print("  Routes API :")
    print("    POST   /api/inscription      → inscrire")
    print("    GET    /api/inscrits         → lister (sans mdp)")
    print("    DELETE /api/inscrits/<id>    → supprimer")
    print("    PUT    /api/users/<id>/rappels → maj rappels")
    print("    POST   /api/follow             → suivre un utilisateur")
    print("    DELETE /api/follow             → ne plus suivre")
    print("    GET    /api/users/<id>/follow-status/<target> → statut follow")
    print("    POST   /api/posts              → créer un post (upload image)")
    print("    GET    /api/posts               → lister les posts")
    print("    DELETE /api/posts/<id>          → supprimer un post")
    print("=" * 54)
    app.run(host="0.0.0.0", debug=True, port=5000)
