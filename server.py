"""
PupLife — Serveur complet
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
    """Page d'accueil → index.html"""
    return send_from_directory(BASE_DIR, "index.html")

@app.route("/inscription")
def inscription_page():
    """Page d'inscription → inscription.html"""
    return send_from_directory(BASE_DIR, "inscription.html")

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

    nouvel_inscrit = {
        "id":               len(inscrits) + 1,
        "prenom":           prenom,
        "nom":              nom,
        "email":            email,
        "telephone":        telephone,
        "ville":            ville,
        "chien_nom":        chien_nom,
        "race":             race,
        "poids":            poids,
        "mot_de_passe":     hash_password(mot_de_passe),
        "date_inscription": datetime.now().isoformat(timespec="seconds"),
        "actif":            True,
    }

    inscrits.append(nouvel_inscrit)
    save_inscrits(inscrits)

    print(f"[{datetime.now():%H:%M:%S}] ✅ Nouvel inscrit : {prenom} {nom} ({email}) — chien : {chien_nom} ({race}, {poids}kg)")

    return jsonify({
        "success": True,
        "message": f"Bienvenue {prenom} ! 🐾",
        "id":      nouvel_inscrit["id"],
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
        "email":   user["email"],
        "prenom":  user["prenom"],
        "nom":     user["nom"],
        "chien_nom": user["chien_nom"],
    }), 200


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


# ── Lancement ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 54)
    print("  🐾  PupLife — Serveur complet")
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
    app.run(debug=True, port=5000)
