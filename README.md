# DeepFocus - Website Blocker

DeepFocus is a browser extension that helps users stay focused by blocking distracting websites. It supports both **Guest Mode** (local browser storage) and **Account Mode** (cloud synchronization across devices and browsers).

The project also includes:

- FastAPI Backend
- PostgreSQL Database
- React Admin Panel
- Browser Extension (Chrome/Brave/Edge/Firefox compatible)

---

## Features

### Browser Extension

- Block distracting websites
- Add and remove blocked websites
- Enable/disable blocking instantly
- Guest Mode (local browser storage)
- Login/Register system
- Sync blocked sites across devices and browsers
- Device registration and tracking
- Real-time sync with backend

### User Sync

- Same account works across multiple browsers
- Same account works across multiple devices
- Centralized cloud storage
- Automatic synchronization

### Admin Panel

- Admin authentication
- Dashboard overview
- User management
- View blocked websites per user
- View registered devices
- Activate/Deactivate users
- Revoke devices
- Analytics dashboard

### Analytics

- Total block attempts
- Today's block attempts
- Most blocked websites
- Attempts by user
- Attempts by device

---

## Tech Stack

### Extension

- JavaScript
- Chrome Extension Manifest V3
- Chrome Storage API

### Backend

- FastAPI
- SQLAlchemy
- PostgreSQL
- JWT Authentication
- Passlib / Bcrypt

### Admin Panel

- React
- Vite
- React Router
- Axios

### Deployment

- Vercel (Backend)
- Vercel (Admin Panel)
- Supabase PostgreSQL

---

## Project Structure

```text
DeepFocus-Website-Blocker/
│
├── admin-panel/
│   ├── public/
│   ├── src/
│   └── package.json
│
├── backend/
│   ├── app/
│   │   ├── api/
│   │   ├── models/
│   │   ├── schemas/
│   │   ├── services/
│   │   ├── main.py
│   │   └── index.py
│   │
│   ├── requirements.txt
│   └── .env.example
│
├── extension/
│   ├── background/
│   ├── popup/
│   ├── icons/
│   ├── manifest.json
│   ├── blocked.html
│   └── blocked.js
│
└── README.md
```

---

## Architecture

```text
┌─────────────────┐
│ Browser Extension│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ FastAPI Backend │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ PostgreSQL DB   │
│ (Supabase)      │
└─────────────────┘

         ▲
         │
┌─────────────────┐
│ Admin Panel     │
│ (React + Vite)  │
└─────────────────┘
```

---

## Installation

### Clone Repository

```bash
git clone https://github.com/YOUR_USERNAME/deepfocus.git
cd deepfocus
```

---

# Backend Setup

## Create Virtual Environment

```bash
cd backend

python -m venv .venv
```

### Activate Environment

Windows:

```bash
.venv\Scripts\activate
```

Mac/Linux:

```bash
source .venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Environment Variables

Create `.env`

```env
DATABASE_URL=postgresql://username:password@localhost/deepfocus

JWT_SECRET_KEY=your_secret_key
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60
```

### Run Backend

```bash
uvicorn app.main:app --reload
```

Backend:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

---

# Admin Panel Setup

```bash
cd admin-panel
npm install
```

Create `.env`

```env
VITE_API_URL=http://localhost:8000
```

Run:

```bash
npm run dev
```

Admin Panel:

```text
http://localhost:5173
```

---

# Extension Setup

1. Open Chrome
2. Go to:

```text
chrome://extensions
```

3. Enable Developer Mode
4. Click:

```text
Load Unpacked
```

5. Select:

```text
extension/
```

---

## User Modes

### Guest Mode

- No account required
- Uses browser local storage
- Data remains on current browser only

### Logged-In Mode

- Account required
- Cloud synchronization enabled
- Data shared across devices and browsers
- Device tracking enabled

---

## Admin Features

### Dashboard

- Total Users
- Active Users
- Devices
- Blocked Sites
- Block Attempts

### User Management

- View all users
- View user details
- Activate/Deactivate users
- View blocked sites
- View registered devices

### Device Management

- View user devices
- Revoke device access

### Analytics

- Most blocked domains
- Attempts per user
- Attempts per device
- Daily activity tracking

---

## API Documentation

After running backend:

```text
http://localhost:8000/docs
```

Interactive Swagger documentation is available for all endpoints.

---

## Deployment

### Backend

Deploy on:

- Vercel

Environment Variables:

```env
DATABASE_URL=
JWT_SECRET_KEY=
JWT_ALGORITHM=
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=
```

### Database

Deploy on:

- Supabase PostgreSQL

### Admin Panel

Deploy on:

- Vercel

Environment Variables:

```env
VITE_API_URL=https://your-backend.vercel.app
```

---

## Future Improvements

- Password reset
- Email verification
- User activity history
- Export analytics
- Global blocklists
- Pomodoro timer
- Productivity reports
- Scheduled website blocking
- Categories of websites
- Browser usage analytics

---

## License

MIT License

---

## Author

Vivek Rajawat

Built as a productivity-focused browser extension project with full-stack architecture including browser extension, FastAPI backend, PostgreSQL database, and React admin dashboard.