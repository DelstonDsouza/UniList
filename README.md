# 🚗 RideMate

**RideMate** is a modern, real-time carpooling and ride-sharing platform designed primarily for students. It facilitates seamless connectivity between students who have transport (Riders) and those looking for a ride (Passengers), optimizing commute times and fostering a collaborative community.

![RideMate Demo](https://img.shields.io/badge/Demo-Active-brightgreen)
![Tech Stack](https://img.shields.io/badge/Stack-MERN-blue)

---

## 🌟 Key Features

### 👤 For Passengers
- **Interactive Discovery**: View real-time nearby riders on a high-fidelity map.
- **Instant Booking**: Request rides with a single tap and get immediate feedback.
- **Live ETA & Tracking**: Real-time distance calculations and polyline routing to your destination.
- **Smart Countdown**: Visual countdown timers for upcoming ride departures.

### 🏍️ For Riders
- **Ride Management**: Easily post your route, set departure times, and manage passenger requests.
- **Live GPS Integration**: High-accuracy location tracking with automatic address resolution.
- **Status Control**: Manage ride transitions from pickup to completion with a streamlined UI.

### 🛡️ Admin Portal
- **Global Overview**: Monitor active rides, users, and overall system health.
- **User Moderation**: View and manage user profiles and complaint reports.
- **Pricing & Policy**: Configure system-wide pricing and operational settings.

---

## 🚀 Tech Stack

### Frontend
- **Framework**: React 19 (Vite)
- **Styling**: Tailwind CSS 4, Framer Motion (for premium animations)
- **Maps**: Leaflet & React-Leaflet
- **Icons**: Lucide React
- **Auth**: Firebase Authentication

### Backend
- **Runtime**: Node.js (ES Modules)
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Real-time**: Socket.io (WebSockets)
- **Security**: JWT & BcryptJS

---

## 🛠️ Installation & Setup

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [MongoDB](https://www.mongodb.com/) account or local instance
- [Firebase project](https://console.firebase.google.com/)

### 1. Clone the Repository
```bash
git clone https://github.com/DelstonDsouza/ridemateee.git
cd ridemate
```

### 2. Backend Setup
```bash
cd server
npm install
```
Create a `.env` file in the `server` directory:
```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```
Run the server:
```bash
npm run dev
```

### 3. Frontend Setup
```bash
cd ..
npm install
```
Create a `.env` file in the root directory and add your Firebase configurations:
```env
VITE_FIREBASE_API_KEY=your_key
VITE_FIREBASE_AUTH_DOMAIN=your_domain
# ... other firebase vars
```
Run the frontend:
```bash
npm run dev
```

---

## 💡 Demo Mode & Presentation Tips

To ensure a smooth demonstration regardless of location or GPS hardware:
- **Demo Location**: The app is currently configured with a hardcoded demo location at `12.872341, 74.845992`.
- **Admin Credentials**: Use `admin@college.com` / `admin123` to access the Admin Dashboard.
- **Mock GPS**: If physical GPS is unavailable, the system automatically triggers a high-fidelity "Demo Mode" to inject realistic coordinates for both riders and passengers.

---

## 📂 Project Structure

```
RideMate/
├── server/             # Express.js backend
│   ├── models/        # Mongoose schemas
│   ├── routes/        # API endpoints
│   ├── services/      # Business logic & socket handlers
│   └── index.js       # Entry point
├── src/               # React frontend
│   ├── components/    # Reusable UI elements
│   ├── context/       # Global state (RideContext)
│   ├── pages/         # Feature-specific views
│   └── services/      # API & Socket clients
├── public/            # Static assets
└── package.json       # Project dependencies
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

*Built with ❤️ for the student community.*
