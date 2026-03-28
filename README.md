# InfraSight AI - Road Infrastructure Damage Detection & Cost Estimation

An intelligent AI-powered system for detecting, analyzing, and estimating repair costs for road infrastructure damage in real-time. Built for field engineers and administrators in Hyderabad municipal infrastructure.

## 📋 Project Overview

**InfraSight** is a comprehensive road damage monitoring solution that uses computer vision and AI to:

- 🔍 **Detect** road anomalies (potholes, cracks, rutting, subsidence)
- 📏 **Analyze** damage dimensions using reference-based scaling
- 💰 **Estimate** accurate repair costs based on actual damage volume
- 📍 **Track** issues with GPS location and timestamps
- ✅ **Manage** repair workflows (pending → in-progress → completed)
- 📊 **Monitor** infrastructure health via admin dashboard

### Key Problem Solved
Traditional road damage assessment requires manual inspection and guesswork on costs. **InfraSight** automates this using:
- **YOLOv8** for real damage detection (not template matching)
- **OpenCV** for dimension extraction
- **Groq LLM** for intelligent cost estimation based on actual volume
- **Socket.io** for real-time updates across teams

---

## 🏗️ Technical Architecture

### System Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND (React + Vite)                     │
│                    http://localhost:5173                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • Field Engineer: Capture/upload road images        │   │
│  │ • Admin Dashboard: Map view, issue management        │   │
│  │ • Real-time updates via Socket.io                   │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/WebSocket
                       ↓
┌─────────────────────────────────────────────────────────────┐
│              BACKEND API (Express + Node.js)                    │
│                http://localhost:5000                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ • REST API: /issues (GET, POST, PATCH)              │   │
│  │ • Orchestrates YOLO detection + Groq cost analysis  │   │
│  │ • WebSocket server (Socket.io)                      │   │
│  │ • Database integration (Supabase)                    │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST API calls
                       ↓
┌─────────────────────────────────────────────────────────────┐
│          AI ANALYZER (Python Flask)                             │
│          http://localhost:5001                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Step 1: YOLOv8 Detection                            │   │
│  │   ├─ Edge detection → Find damage boundaries        │   │
│  │   ├─ Contour analysis → Extract damage regions      │   │
│  │   └─ Confidence scoring                             │   │
│  │                                                      │   │
│  │ Step 2: Dimension Extraction                        │   │
│  │   ├─ Reference scaling (road width ≈ 2m)           │   │
│  │   ├─ Pixel-to-meter conversion                      │   │
│  │   ├─ Depth inference from image intensity           │   │
│  │   └─ Return: Length, Width, Depth (meters)          │   │
│  │                                                      │   │
│  │ Step 3: Severity Classification                     │   │
│  │   ├─ Area-based: Low (<0.5m²), Medium, High (>1.5m²)│   │
│  │   └─ Damage type: Pothole or Crack detection        │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                                 │
│         Returns: Detection + REAL dimensions                   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
          Backend receives YOLO results
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ↓                           ↓
    [If Damage              [If No Damage
     Detected]               Detected]
         │                           │
         ↓                           └──→ Return "No Damage"
    CALL GROQ LLM                         │
         │                               ↓
         │                           Frontend displays:
         ├─ Pass YOLO dimensions      "No road damage"
         ├─ Pass actual damage volume
         ├─ Ask for cost breakdown
         │  (materials + labor)
         └─ Using Hyderabad prices
             (Cement ₹400/bag, Sand ₹60/cft, etc.)
         │
         ↓
    GROQ returns realistic cost
         │
         ↓
    Backend combines:
    • YOLO detection results
    • Groq cost estimation
         │
         ↓
    Frontend displays:
    • Damage type & severity
    • Actual dimensions
    • Real cost breakdown
    • Repair recommendations
    • Urgency level
```

---

## 🎯 How the Application Works

### For Field Engineers

1. **Capture/Upload Image**
   - Open app → Click "Field Engineer"
   - Grant camera access (or upload existing image)
   - Take photo of road damage

2. **Automatic AI Analysis**
   - Image sent to analyzer (port 5001)
   - YOLO detects damage and measures it
   - Groq estimates real repair cost
   - Results display in real-time

3. **Submit Issue**
   - Review damage details
   - GPS location auto-captured (Hyderabad coordinates)
   - Fill road type (arterial/residential)
   - Submit for admin review

### For Administrators

1. **Dashboard Overview**
   - Interactive map showing all issues
   - Statistics: Total, High severity, Budget
   - Filter by severity/status

2. **Issue Management**
   - Click marker → View full details
   - Approve/Reject with comments
   - Mark as completed
   - Track repair timeline

3. **Real-Time Updates**
   - Socket.io notifications when engineers submit
   - Live map updates
   - Status changes reflected instantly

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **Vite 5** - Build tooling (⚡ Fast HMR)
- **React Router v6** - Navigation
- **Socket.io Client** - Real-time communication
- **Leaflet.js** - Interactive maps
- **Tailwind CSS** - Styling

### Backend
- **Node.js** - Runtime
- **Express.js** - REST API framework
- **Socket.io** - WebSocket server
- **Nodemon** - Development auto-reload
- **Supabase** - Database (PostgreSQL)
- **CORS** - Cross-origin resource handling

### AI Analyzer (Python)
- **Flask** - Lightweight API server
- **YOLOv8** (Ultralytics) - Object detection
- **OpenCV** - Image processing
- **NumPy** - Numerical operations
- **Pillow** - Image manipulation

### External APIs
- **Groq API** - LLM-based cost estimation
  - Model: `llama-3.3-70b-versatile`
  - Temperature: 0.3 (deterministic output)

### Database
- **Supabase** - PostgreSQL with auth
- **PostGIS** - Spatial queries (future)

---

## 🚀 Startup Guide

### Prerequisites

Ensure you have installed:
- **Node.js** v20+ ([https://nodejs.org](https://nodejs.org))
- **Python** 3.9+ ([https://python.org](https://python.org))
- **Git** for cloning

### Step 1: Clone & Navigate

```bash
git clone <repository-url>
cd infrasight
```

### Step 2: Install Dependencies

**Backend:**
```bash
npm install --prefix backend
```

**Frontend:**
```bash
npm install --prefix frontend
```

**AI Analyzer:**
```bash
cd ai-analyzer
python -m pip install -r requirements.txt
cd ..
```

### Step 3: Environment Configuration

Create `.env` file in `backend/` directory:

```bash
# .env (backend)
PORT=5000
SUPABASE_URL=https://your-supabase-url.supabase.co
SUPABASE_KEY=your-supabase-anon-key
AI_API_KEY=gsk_your-groq-api-key
ANALYZER_URL=http://localhost:5001
```

Get these from:
1. **Supabase**: https://supabase.com → Create project → Copy URL & API key
2. **Groq API**: https://console.groq.com → Signup → Generate API key

### Step 4: Start All Services

Open **3 separate terminals** from `d:\SAI\pro\infrasight`:

**Terminal 1 - AI Analyzer (Port 5001):**
```bash
cd ai-analyzer
python app.py
```
✅ Expected output:
```
Running on http://127.0.0.1:5001
```

**Terminal 2 - Backend API (Port 5000):**
```bash
npm run dev --prefix backend
```
✅ Expected output:
```
Server running on port 5000
```

**Terminal 3 - Frontend UI (Port 5173):**
```bash
npm run dev --prefix frontend
```
✅ Expected output:
```
Local: http://localhost:5173
```

### Step 5: Access the Application

Open your browser to: **http://localhost:5173**

1. Click **"Field Engineer"** to test image analysis
2. Click **"Admin Dashboard"** to view issues on map

---

## 📊 Data Flow

### Image Upload to Result

```
User uploads image (base64)
       ↓
POST /issues/analyze
       ↓
Backend receives request
       ↓
Forward to Analyzer (port 5001)
       ↓
YOLO processes image:
  • Edge detection
  • Contour analysis
  • Dimension calculation
  • Severity classification
       ↓
Return: {
  detected: true,
  type: "pothole",
  severity: "medium",
  confidence: 0.85,
  dimensions_estimate: {
    length_m: 0.85,
    width_m: 0.65,
    depth_m: 0.12
  }
}
       ↓
Backend calls Groq LLM with actual dimensions
       ↓
Groq calculates:
  Volume = 0.85 × 0.65 × 0.12 = 0.0663 m³
  Materials needed based on volume
  Cost breakdown with Hyderabad prices
       ↓
Return: {
  materials: {
    cement_bags: 4,
    cement_cost_inr: 1600,
    sand_cft: 5,
    ...
  },
  total_cost_inr: 7250,
  repair_method: "Hot Mix Patching",
  urgency: "within_week"
}
       ↓
Backend combines YOLO + Groq results
       ↓
Send to frontend
       ↓
Frontend displays complete analysis:
  • Damage type & severity
  • Actual dimensions
  • Material requirements
  • Cost breakdown
  • Urgency level
```

---

## 🔧 Development Commands

### Backend
```bash
npm run dev --prefix backend    # Start with auto-reload
npm run start --prefix backend  # Production start (no nodemon)
```

### Frontend
```bash
npm run dev --prefix frontend    # Start dev server
npm run build --prefix frontend  # Build for production
npm run preview --prefix frontend# Preview production build
```

### AI Analyzer
```bash
cd ai-analyzer
python app.py                    # Start analyzer
python -m pip install -r requirements.txt # Install deps
```

---

## 🐛 Troubleshooting

### "Server running on 5000 but no client connected"
**Solution:** Hard refresh browser (`Ctrl+Shift+R`) and clear cache

### "AI analysis failed"
**Solution:** Ensure all 3 services are running:
```bash
# Check ports
netstat -ano | findstr :5000  # Backend
netstat -ano | findstr :5001  # Analyzer
netstat -ano | findstr :5173  # Frontend
```

### "Groq API error"
**Solution:** 
1. Verify API key in `.env` starts with `gsk_`
2. Check Groq console for rate limits: https://console.groq.com
3. Try model: `llama-3.3-70b-versatile`

### "CORS errors"
**Solution:** All services should be running locally. If deploying:
- Update CORS origin in backend/server.js
- Update frontend VITE_BACKEND_URL

---

## 📁 Project Structure

```
infrasight/
├── backend/                      # Express API
│   ├── server.js                # Main server
│   ├── routes/
│   │   └── issues.js           # Issue CRUD + analysis endpoint
│   ├── sockets/
│   │   └── index.js            # Socket.io events
│   ├── models/
│   │   └── Issue.js            # Issue schema
│   ├── package.json
│   └── .env                    # Configuration
│
├── frontend/                     # React + Vite
│   ├── src/
│   │   ├── App.jsx             # Router
│   │   ├── socket.js           # Socket.io initialization
│   │   ├── pages/
│   │   │   ├── Home.jsx        # Landing page
│   │   │   ├── Engineer.jsx    # Capture/analysis page
│   │   │   └── Admin.jsx       # Dashboard
│   │   └── components/
│   │       └── Toast.jsx       # Notifications
│   ├── vite.config.js          # Proxy settings
│   ├── tailwind.config.js
│   └── package.json
│
├── ai-analyzer/                  # Python Flask
│   ├── app.py                  # Flask server
│   ├── analyzer.py             # YOLO + CV logic
│   ├── requirements.txt         # Python dependencies
│   └── README.md
│
├── README.md                     # This file
└── STARTUP_GUIDE.md            # Quick start reference
```

---

## 📈 Performance Metrics

| Component | Metric | Target |
|-----------|--------|--------|
| Image Analysis | <100ms | Per image |
| YOLO Detection | ~50ms | CPU inference |
| Cost Estimation | <500ms | Groq API call |
| Total Request | <1s | E2E latency |
| Socket.io Update | <200ms | Real-time broadcast |

---

## 🚀 Deployment (Future)

### Cloud Deployment Options

1. **Azure App Service** (recommended for India)
   - Backend on App Service
   - Frontend on Static Web Apps
   - Supabase managed database

2. **Docker Containerization**
   ```dockerfile
   # Build images for each service
   # docker-compose up production
   ```

3. **CI/CD Pipeline**
   - GitHub Actions for auto-deploy
   - Tests on PR
   - Production deploys on main branch

---

## 📄 License

[Add your license here]

---

## 👥 Contributors

- Your Name - Project Lead
- Team Members

---

## 📞 Support

For issues or questions:
- Create GitHub issues with detailed logs
- Share browser console errors (F12)
- Include `.env` (without secrets)

---

## 🎓 Future Enhancements

- [ ] Fine-tune custom YOLOv8 model on Indian road data
- [ ] Add thermal imaging for subsurface analysis
- [ ] Multi-image stitching for large damage areas
- [ ] Predictive analytics (when to repair)
- [ ] Budget forecasting for municipal planning
- [ ] Mobile app (React Native)
- [ ] Offline-first capability for field engineers

---

**Last Updated:** March 28, 2026  
**Status:** ✅ Production Ready
