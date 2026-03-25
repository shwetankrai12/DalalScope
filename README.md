# DalalScope 📈

A modern, full-stack Market Dashboard for Indian (NSE) and Global markets. DalalScope provides live indices tracking, smart stock search, interactive charts, and a personalized portfolio manager with Supabase authentication.

---

## 🚀 Key Features

- **Live Market Monitoring**: Real-time tracking of major Indian indices including **NIFTY 50**, **SENSEX**, **BANK NIFTY**, and **INDIA VIX**.
- **Smart Stock Search**: Auto-resolves company names (e.g., "Reliance", "Tata") to their official NSE symbols.
- **Interactive Visualization**:
  - **30-Day History**: Daily closing price trends for indices and stocks.
  - **Intraday Charts**: Real-time 5-minute interval candles for current session tracking.
  - **Sparklines**: Quick 7-day trend visualizations.
- **Secure Authentication**: Robust user login and encrypted signup powered by **Supabase Auth**.
- **Personalized Onboarding**: Multi-step profile setup (Name, Phone, DOB, Risk Appetite).
- **Portfolio Manager**: 
  - Add and track your holdings with average buy prices.
  - Real-time valuation of your current portfolio.
  - Automatic session validation (instant logout if a user is deleted from the database).
- **Rich Techy UI**: Dark-themed "Terminal" aesthetic with glassmorphism, animated falling-pattern backgrounds, and responsive design.

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python (FastAPI), yfinance, Supabase-py |
| **Frontend** | Vanilla JavaScript (ES Modules), CSS3 (Glassmorphism), HTML5 |
| **Charts** | Chart.js with Date-Fns adapter |
| **Database/Auth** | Supabase (PostgreSQL) |
| **Deployment** | Heroku / Render Ready (includes `Procfile` and `runtime.txt`) |

---

## 📂 Project Structure

```
DalalScope/
├── api.py              # FastAPI REST server with JWT validation
├── fetcher.py          # Data orchestration (yfinance API integration)
├── resolver.py         # Company Name → Ticker resolution logic
├── static/             # Frontend Application
│   ├── index.html      # Main Dashboard Entry
│   ├── auth.js         # Supabase Auth, Profile, and Onboarding module
│   ├── portfolio.js    # Portfolio CRUD and calculation logic
│   └── favicon.ico     # App icon
├── .env                # Environment variables (Supabase keys)
├── requirements.txt    # Python dependencies
├── Procfile            # Deployment instructions for production
└── runtime.txt         # Python runtime version
```

---

## ⚙️ Installation & Setup

### 1. Clone & Install
```bash
git clone https://github.com/shwetankrai12/DalalScope.git
cd DalalScope
python -m venv .venv
source .venv/bin/scripts/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### 2. Database Setup (Supabase)
1. Create a new project in [Supabase](https://supabase.com/).
2. Enable **Email Auth** in the Authentication settings.
3. Create the following tables:
   - `profiles`: To store user details (id, full_name, phone, city, etc.).
   - `holdings`: To store user stock positions (id, user_id, ticker, qty, avg_buy_price).

### 3. Environment Config
Create a `.env` file in the root directory:
```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

---

## 🖥️ Usage

### Development
Start the FastAPI server locally:
```bash
python api.py
```
Visit `http://localhost:8000` in your browser.

### Production
The project is configured for deployment on Heroku or Render using the included `Procfile`.

---

## 🛡️ Authentication Flow
1. **Login/Signup**: Standard email-based auth.
2. **Onboarding**: New users are automatically redirected to the Profile Setup modal.
3. **Session Guard**: A background task validates the session every 30 seconds; if the user's account is revoked/deleted from the DB, they are instantly logged out.

---

## 📈 Data Sources
Data is fetched in real-time from **Yahoo Finance** via the `yfinance` library, ensuring coverage for all major NSE and US tickers.

