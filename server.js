// ==============================
// 🔴 Red Roof Company – Integrace Backend
// ==============================
import express from "express";
import cors from "cors";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pkg;

// ==============================
// ⚙️ Express + CORS konfigurace
// ==============================
const app = express();

const allowedOrigins = [
  "https://redroofcomp.up.railway.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS blokován pro origin: " + origin));
    }
  },
  credentials: true,
}));

app.use(express.json());

// ==============================
// 💾 PostgreSQL připojení
// ==============================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});



// Inicializace tabulek
async function initTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT DEFAULT 'Člen',
        admin BOOLEAN DEFAULT FALSE,
        added_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS weapons (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT,
        owner TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        make TEXT NOT NULL,
        model TEXT,
        plate TEXT,
        owner TEXT,
        notes TEXT,
        img TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS finance_transactions (
        id SERIAL PRIMARY KEY,
        what TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ DB tabulky připraveny (members, weapons, cars, finance)");
  } catch (err) {
    console.error("❌ Chyba při inicializaci tabulek:", err.message);
  }
}
initTables();



// ==============================
// 🧭 Test endpoint
// ==============================
app.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({ status: "✅ RRC Integrace API running", db: true, time: result.rows[0].now });
  } catch (err) {
    res.json({ status: "❌ DB not connected", db: false, error: err.message });
  }
});

// ==============================
// 👥 MEMBERS API
// ==============================
app.get("/api/members", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM members ORDER BY added_at DESC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/members", async (req, res) => {
  const { id, name, role, admin } = req.body;
  if (!id || !name) return res.status(400).json({ error: "Chybí ID nebo jméno" });
  try {
    await pool.query(
      `INSERT INTO members (id, name, role, admin)
       VALUES ($1,$2,$3,$4)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, role=EXCLUDED.role, admin=EXCLUDED.admin`,
      [id, name, role || "Člen", !!admin]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🔥 Odebrání člena
app.delete("/api/members/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query("DELETE FROM members WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ⚙️ Toggle admin status
app.patch("/api/members/:id/admin", async (req, res) => {
  try {
    const { id } = req.params;
    const { admin } = req.body;
    await pool.query("UPDATE members SET admin = $1 WHERE id = $2", [admin, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🔫 WEAPONS API
// ==============================
app.get("/api/weapons", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM weapons ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/weapons", async (req, res) => {
  const { name, type, owner, notes } = req.body;
  if (!name) return res.status(400).json({ error: "Chybí název zbraně" });
  try {
    const result = await pool.query(
      `INSERT INTO weapons (name, type, owner, notes)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [name, type, owner, notes]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/weapons/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM weapons WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🚗 CARS API
// ==============================
app.get("/api/cars", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cars ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/cars", async (req, res) => {
  const { make, model, plate, owner, notes, img } = req.body;
  if (!make) return res.status(400).json({ error: "Chybí značka auta" });
  try {
    const result = await pool.query(
      `INSERT INTO cars (make, model, plate, owner, notes, img)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [make, model, plate, owner, notes, img]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/cars/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM cars WHERE id=$1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 💰 FINANCE API
// ==============================
app.get("/api/finance/summary", async (req, res) => {
  try {
    const sum = await pool.query("SELECT COALESCE(SUM(amount),0) AS balance FROM finance_transactions");
    const last = await pool.query(
      "SELECT id, what, amount, created_at FROM finance_transactions ORDER BY created_at DESC LIMIT 1"
    );
    res.json({
      balance: Number(sum.rows[0].balance),
      last: last.rows[0] || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/finance/transactions", async (req, res) => {
  const { what, amount } = req.body;
  const n = Number(amount);
  if (!what || !Number.isFinite(n)) return res.status(400).json({ error: "Neplatné údaje" });
  try {
    await pool.query("INSERT INTO finance_transactions (what, amount) VALUES ($1,$2)", [what, n]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/finance/transactions", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, what, amount, created_at FROM finance_transactions ORDER BY created_at DESC"
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==============================
// 🚀 SERVER START
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ RRC Integrace backend běží na portu ${PORT}`);
});
