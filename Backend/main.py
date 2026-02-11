from fastapi import FastAPI, UploadFile, File, Form, Header, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import firebase_admin
from firebase_admin import credentials, auth
from pymongo import MongoClient
from datetime import datetime
import os, shutil, uuid
from pathlib import Path
from bson import ObjectId
from math import radians, sin, cos, asin, sqrt

# ─────────────────────────────────────────────
# 🔐 Firebase Admin Init (SAFE)
# ─────────────────────────────────────────────
BASE_DIR = Path(__file__).parent
cred_path = BASE_DIR / "serviceAccountKey.json"

if not firebase_admin._apps:
    cred = credentials.Certificate(str(cred_path))
    firebase_admin.initialize_app(cred)

# ─────────────────────────────────────────────
# 🍃 MongoDB
# ─────────────────────────────────────────────
client = MongoClient("mongodb://localhost:27017")
db = client["kozhigo"]

users = db["users"]
riders = db["riders"]
ride_requests = db["ride_requests"]
rides = db["rides"]
ride_offers = db["ride_offers"]
notifications = db["notifications"]
rider_approvals = db["rider_approvals"]

# ─────────────────────────────────────────────
# 📁 Uploads
# ─────────────────────────────────────────────
UPLOAD_DIR = "uploads/college_ids"
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ─────────────────────────────────────────────
# 🚀 FastAPI App
# ─────────────────────────────────────────────
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve uploaded files (college ID photos, etc.)
UPLOAD_DIR_ABS = str((BASE_DIR / "uploads").resolve())
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR_ABS), name="uploads")

# ─────────────────────────────────────────────
# 🔑 AUTH HELPERS
# ─────────────────────────────────────────────
def verify_token(authorization: str):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    try:
        token = authorization.split(" ")[1]
        return auth.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid Firebase token")

def verify_admin(authorization: str):
    # Dev-friendly bypass: if BACKEND_DEBUG=1 allow admin access locally
    debug_flag = os.environ.get("BACKEND_DEBUG", "1") in ("1", "true", "True")
    if debug_flag:
        try:
            return verify_token(authorization) if authorization else {"uid": "debug-admin", "email": os.environ.get("ADMIN_EMAILS", "debug@local")}
        except Exception:
            return {"uid": "debug-admin", "email": os.environ.get("ADMIN_EMAILS", "debug@local")}

    decoded = verify_token(authorization)
    email = decoded.get("email")
    is_admin_claim = bool(decoded.get("admin"))
    admin_emails = os.environ.get("ADMIN_EMAILS", "")
    allowed_emails = [e.strip() for e in admin_emails.split(",") if e.strip()]
    if not (is_admin_claim or (email and email in allowed_emails)):
        raise HTTPException(status_code=403, detail="Admin privilege required")
    return decoded

# ─────────────────────────────────────────────
# 🧮 DISTANCE
# ─────────────────────────────────────────────
def haversine_km(a_lat, a_lng, b_lat, b_lng):
    R = 6371.0
    dlat = radians(b_lat - a_lat)
    dlng = radians(b_lng - a_lng)
    lat1 = radians(a_lat)
    lat2 = radians(b_lat)
    h = sin(dlat/2)**2 + cos(lat1)*cos(lat2)*sin(dlng/2)**2
    return 2 * R * asin(sqrt(h))

# ─────────────────────────────────────────────
# 📝 REGISTER USER
# ─────────────────────────────────────────────
@app.post("/register")
async def register_user(
    authorization: str = Header(None),
    firstName: str = Form(...),
    lastName: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    gender: str = Form(...),
    universityId: str = Form(...),
    collegeIdPhoto: UploadFile = File(...)
):
    decoded = verify_token(authorization)
    uid = decoded["uid"]

    if users.find_one({"uid": uid}):
        raise HTTPException(status_code=400, detail="User already exists")

    ext = os.path.splitext(collegeIdPhoto.filename)[1]
    filename = f"{uid}_{uuid.uuid4()}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(collegeIdPhoto.file, buffer)

    users.insert_one({
        "uid": uid,
        "role": "student",
        "firstName": firstName,
        "lastName": lastName,
        "email": email,
        "phone": phone,
        "gender": gender,
        "universityId": universityId,
        "collegeIdPhotoPath": filepath,
        "verified": False,
        "createdAt": datetime.utcnow(),
    })

    return {"ok": True}

# ─────────────────────────────────────────────
# 🛵 RIDER APPROVAL
# ─────────────────────────────────────────────
@app.post("/rider-approval")
def rider_approval(authorization: str = Header(None), payload: dict = Body(...)):
    decoded = verify_token(authorization)
    uid = decoded["uid"]

    rider_approvals.update_one(
        {"uid": uid},
        {"$set": {
            "uid": uid,
            "fullName": payload.get("fullName"),
            "phone": payload.get("phone"),
            "scooterNumber": payload.get("scooterNumber"),
            "collegeName": payload.get("collegeName"),
            "address": payload.get("address"),
            "licenseNumber": payload.get("licenseNumber"),
            "licenseExpiry": payload.get("licenseExpiry"),
            "licensePhotoBase64": payload.get("licensePhotoBase64"),
            "status": "pending",
            "createdAt": datetime.utcnow(),
        }},
        upsert=True
    )
    return {"ok": True}

@app.get("/rider-approval/mine")
def my_rider_approval(authorization: str = Header(None)):
    decoded = verify_token(authorization)
    doc = rider_approvals.find_one({"uid": decoded["uid"]})
    if not doc:
        return {"approval": None}
    doc["_id"] = str(doc["_id"])
    return {"approval": doc}

# ─────────────────────────────────────────────
# 👤 CURRENT USER
# ─────────────────────────────────────────────
@app.get("/users/me")
def users_me(authorization: str = Header(None)):
    decoded = verify_token(authorization)
    uid = decoded["uid"]
    u = users.find_one({"uid": uid})
    if not u:
        return {"user": None}
    return {
        "user": {
            "uid": u["uid"],
            "firstName": u.get("firstName"),
            "lastName": u.get("lastName"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "universityId": u.get("universityId"),
            "verified": bool(u.get("verified")),
            "createdAt": u.get("createdAt").isoformat() if u.get("createdAt") else None,
        }
    }

# ─────────────────────────────────────────────
# 👮 ADMIN APIs
# ─────────────────────────────────────────────
@app.get("/admin/users")
def admin_list_users(authorization: str = Header(None)):
    verify_admin(authorization)
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    def make_user_obj(u):
        photo_path = u.get("collegeIdPhotoPath") or ""
        photo_name = os.path.basename(photo_path) if photo_path else ""
        photo_url = f"{backend_url}/uploads/college_ids/{photo_name}" if photo_name else None
        return {
            "uid": u["uid"],
            "firstName": u.get("firstName"),
            "lastName": u.get("lastName"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "universityId": u.get("universityId"),
            "verified": bool(u.get("verified")),
            "collegeIdPhotoUrl": photo_url,
            "createdAt": u.get("createdAt").isoformat() if u.get("createdAt") else None,
        }

    return {"users": [make_user_obj(u) for u in users.find().sort("createdAt", -1)]}

@app.get("/admin/users/verified")
def admin_list_verified_users(authorization: str = Header(None)):
    verify_admin(authorization)
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    def make_user_obj(u):
        photo_path = u.get("collegeIdPhotoPath") or ""
        photo_name = os.path.basename(photo_path) if photo_path else ""
        photo_url = f"{backend_url}/uploads/college_ids/{photo_name}" if photo_name else None
        return {
            "uid": u["uid"],
            "firstName": u.get("firstName"),
            "lastName": u.get("lastName"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "universityId": u.get("universityId"),
            "verified": bool(u.get("verified")),
            "collegeIdPhotoUrl": photo_url,
            "createdAt": u.get("createdAt").isoformat() if u.get("createdAt") else None,
        }
    return {"users": [make_user_obj(u) for u in users.find({"verified": True}).sort("createdAt", -1)]}

@app.get("/admin/users/unverified")
def admin_list_unverified_users(authorization: str = Header(None)):
    verify_admin(authorization)
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    def make_user_obj(u):
        photo_path = u.get("collegeIdPhotoPath") or ""
        photo_name = os.path.basename(photo_path) if photo_path else ""
        photo_url = f"{backend_url}/uploads/college_ids/{photo_name}" if photo_name else None
        return {
            "uid": u["uid"],
            "firstName": u.get("firstName"),
            "lastName": u.get("lastName"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "universityId": u.get("universityId"),
            "verified": bool(u.get("verified")),
            "collegeIdPhotoUrl": photo_url,
            "createdAt": u.get("createdAt").isoformat() if u.get("createdAt") else None,
        }
    return {"users": [make_user_obj(u) for u in users.find({"verified": False}).sort("createdAt", -1)]}

@app.get("/admin/users/stats")
def admin_users_stats(authorization: str = Header(None)):
    verify_admin(authorization)
    total = users.count_documents({})
    verified = users.count_documents({"verified": True})
    unverified = users.count_documents({"verified": False})
    return {"total": total, "verified": verified, "unverified": unverified}

# Temporary debug endpoint - enable by setting BACKEND_DEBUG=1 in environment
@app.get("/debug/users")
def debug_list_users():
    if os.environ.get("BACKEND_DEBUG", "1") not in ("1", "true", "True"):
        raise HTTPException(status_code=403, detail="Debug disabled")
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    def make_user_obj(u):
        photo_path = u.get("collegeIdPhotoPath") or ""
        photo_name = os.path.basename(photo_path) if photo_path else ""
        photo_url = f"{backend_url}/uploads/college_ids/{photo_name}" if photo_name else None
        return {
            "uid": u["uid"],
            "firstName": u.get("firstName"),
            "lastName": u.get("lastName"),
            "email": u.get("email"),
            "phone": u.get("phone"),
            "universityId": u.get("universityId"),
            "verified": bool(u.get("verified")),
            "collegeIdPhotoUrl": photo_url,
            "createdAt": u.get("createdAt").isoformat() if u.get("createdAt") else None,
        }
    return {"users": [make_user_obj(u) for u in users.find().sort("createdAt", -1)]}

@app.post("/admin/users/{uid}/verify")
def admin_verify_user(uid: str, authorization: str = Header(None)):
    verify_admin(authorization)
    users.update_one({"uid": uid}, {"$set": {"verified": True}})
    return {"ok": True}

@app.post("/admin/users/{uid}/unverify")
def admin_unverify_user(uid: str, authorization: str = Header(None)):
    verify_admin(authorization)
    users.update_one({"uid": uid}, {"$set": {"verified": False}})
    return {"ok": True}

@app.get("/admin/rider-approvals")
def admin_list_rider_approvals(authorization: str = Header(None)):
    verify_admin(authorization)
    backend_url = os.environ.get("BACKEND_URL", "http://localhost:8000")
    def make_approval_obj(d):
        # license photo may be stored as base64 string or path; include as-is if present
        license_photo_b64 = d.get("licensePhotoBase64")
        return {
            "id": str(d["_id"]),
            "uid": d.get("uid"),
            "fullName": d.get("fullName"),
            "phone": d.get("phone"),
            "scooterNumber": d.get("scooterNumber"),
            "collegeName": d.get("collegeName"),
            "address": d.get("address"),
            "licenseNumber": d.get("licenseNumber"),
            "licenseExpiry": d.get("licenseExpiry"),
            "licensePhotoBase64": license_photo_b64,
            "status": d.get("status", "pending"),
            "createdAt": d.get("createdAt").isoformat() if d.get("createdAt") else None,
        }

    return {"approvals": [make_approval_obj(d) for d in rider_approvals.find().sort("createdAt", -1)]}


# Temporary debug endpoint - enable by setting BACKEND_DEBUG=1 in environment
@app.get("/debug/rider-approvals")
def debug_rider_approvals():
    if os.environ.get("BACKEND_DEBUG", "1") not in ("1", "true", "True"):
        raise HTTPException(status_code=403, detail="Debug disabled")
    def make_approval_obj(d):
        license_photo_b64 = d.get("licensePhotoBase64")
        return {
            "id": str(d["_id"]),
            "uid": d.get("uid"),
            "fullName": d.get("fullName"),
            "phone": d.get("phone"),
            "scooterNumber": d.get("scooterNumber"),
            "collegeName": d.get("collegeName"),
            "address": d.get("address"),
            "licenseNumber": d.get("licenseNumber"),
            "licenseExpiry": d.get("licenseExpiry"),
            "licensePhotoBase64": license_photo_b64,
            "status": d.get("status", "pending"),
            "createdAt": d.get("createdAt").isoformat() if d.get("createdAt") else None,
        }
    return {"approvals": [make_approval_obj(d) for d in rider_approvals.find().sort("createdAt", -1)]}

@app.post("/admin/rider-approvals/{id}/approve")
def admin_approve_rider(id: str, authorization: str = Header(None)):
    verify_admin(authorization)
    rider_approvals.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": "approved", "approvedAt": datetime.utcnow()}}
    )
    return {"ok": True}

@app.post("/admin/rider-approvals/{id}/reject")
def admin_reject_rider(id: str, authorization: str = Header(None)):
    verify_admin(authorization)
    rider_approvals.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": "rejected", "rejectedAt": datetime.utcnow()}}
    )
    return {"ok": True}

# ─────────────────────────────────────────────
# 🚲 RIDE OFFERS (USED BY DASHBOARD)
# ─────────────────────────────────────────────
@app.post("/ride-offers")
def post_ride_offer(payload: dict = Body(...)):
    res = ride_offers.insert_one({
        "riderName": payload.get("riderName"),
        "scooterNumber": payload.get("scooterNumber"),
        "phone": payload.get("phone"),
        "collegeName": payload.get("collegeName"),
        "status": "pending",
        "active": True,
        "createdAt": datetime.utcnow(),
    })
    return {"id": str(res.inserted_id)}

@app.get("/ride-offers")
def list_ride_offers():
    return {"offers": [
        {
            "id": str(o["_id"]),
            "riderName": o.get("riderName"),
            "scooterNumber": o.get("scooterNumber"),
            "phone": o.get("phone"),
            "collegeName": o.get("collegeName"),
            "status": o.get("status"),
        } for o in ride_offers.find({"active": True}).sort("createdAt", -1)
    ]}

@app.post("/ride-offers/{id}/status")
def set_offer_status(id: str, payload: dict = Body(...), authorization: str = Header(None)):
    verify_admin(authorization)
    ride_offers.update_one(
        {"_id": ObjectId(id)},
        {"$set": {"status": payload.get("status")}}
    )
    return {"ok": True}
