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
import re
import hashlib
import secrets
import string
from datetime import datetime
from pathlib import Path
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

try:
    import bcrypt
    USE_BCRYPT = True
except ImportError:
    USE_BCRYPT = False
    print("⚠  bcrypt non installé — hash SHA-256 utilisé à la place.")
    print("   Pour un hash sécurisé : pip install bcrypt")

# ── Config ───────────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent
DATA_FILE = BASE_DIR / "inscrits.json"

app = Flask(__name__)
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
    """Tableau de bord → tableau-de-bord.html"""
    return send_from_directory(BASE_DIR, "tableau-de-bord.html")

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

    return jsonify({
        "success": True,
        "message": f"Bienvenue {prenom} ! 🐾",
        "id":      nouvel_inscrit["id"],
        "username": username,
        "email":   email,
        "prenom":  prenom,
        "nom":     nom,
        "telephone": telephone,
        "ville":   ville,
        "chien_nom": chien_nom,
        "race":    race,
        "poids":   poids,
        "dateNaissance": date_naissance,
        "sexe":    sexe,
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

    return jsonify({
        "success": True,
        "message": f"Bienvenue {user['prenom']} ! 🐾",
        "id":      user["id"],
        "username": user.get("username", ""),
        "email":   user["email"],
        "prenom":  user["prenom"],
        "nom":     user["nom"],
        "telephone": user.get("telephone", ""),
        "ville":   user.get("ville", ""),
        "chien_nom": user["chien_nom"],
        "race":    user.get("race", ""),
        "poids":   user.get("poids", 0),
        "dateNaissance": user.get("dateNaissance", ""),
        "sexe":    user.get("sexe", ""),
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
            })
    
    return jsonify({"success": True, "results": results}), 200


# ── Lancement ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 54)
    print("  🐾  Odoggy — Serveur complet")
    print("=" * 54)
    print(f"  📂  Dossier servi  : {BASE_DIR}")
    print(f"  📄  Fichier JSON   : {DATA_FILE}")
    print(f"  🔒  Hash bcrypt    : {'Oui' if USE_BCRYPT else 'Non (pip install bcrypt)'}")
    print()
    print("  ✅  Ouvrez votre navigateur sur :")
    print("      http://localhost:5000")
    print()
    print("  Routes API :")
    print("    POST   /api/inscription      → inscrire")
    print("    GET    /api/inscrits         → lister (sans mdp)")
    print("    DELETE /api/inscrits/<id>    → supprimer")
    print("=" * 54)
    app.run(host="0.0.0.0", debug=True, port=5000)
