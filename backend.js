const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

// Allow cross-origin requests (so frontend can call backend)
app.use(cors());
app.use(express.json());

const DATA_FILE = path.join(__dirname, "data.json");

// Load data
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

// Save data
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ================== GROUP DATA ==================
app.get("/api/data", (req, res) => {
  res.json(loadData());
});

app.post("/api/data", (req, res) => {
  const newData = req.body;
  if (!newData) {
    return res.status(400).json({ error: "Missing data" });
  }
  saveData(newData);
  res.json({ status: "ok" });
});

// ================== LOG STORAGE ==================
const LOG_FILE = path.join(__dirname, "logs.json");

// Load logs
function loadLogs() {
  try {
    const raw = fs.readFileSync(LOG_FILE, "utf8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    return [];
  }
}

// Save logs
function saveLogs(logs) {
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// GET all logs
app.get("/api/logs", (req, res) => {
  res.json(loadLogs());
});

// POST a new log entry
app.post("/api/logs", (req, res) => {
  const entry = req.body;
  if (!entry) {
    return res.status(400).json({ error: "Missing log entry" });
  }
  const logs = loadLogs();
  logs.push(entry);
  saveLogs(logs);
  res.json({ status: "ok" });
});

