const express = require("express");
const fs = require("fs");
const path = require("path");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

// ✅ Use /data for Render persistent disk, fallback to local ./data
const DATA_DIR = fs.existsSync('/data') ? '/data' : path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, "data.json");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// ✅ Ensure the data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Ensure data file exists
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify({ groups: [], logs: [] }, null, 2)
  );
}

// Ensure users file exists with default admin/user accounts
if (!fs.existsSync(USERS_FILE)) {
  const defaultUsers = [
    { username: "admin", password: "admin123", role: "admin" },
    { username: "user", password: "user123", role: "user" }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2));
}

// Load data
function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw || '{"groups":[],"logs":[]}');
  } catch (err) {
    return { groups: [], logs: [] };
  }
}

// Save data
function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ✅ NEW: Load users
function loadUsers() {
  try {
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    return JSON.parse(raw || '[]');
  } catch (err) {
    return [
      { username: "admin", password: "admin123", role: "admin" },
      { username: "user", password: "user123", role: "user" }
    ];
  }
}

// ✅ NEW: Save users
function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// ====================== API ROUTES ====================== //

// GET all groups + logs
app.get("/api/data", (req, res) => {
  res.json(loadData());
});

// POST new groups + logs (overwrite whole file)
app.post("/api/save", (req, res) => {
  const newData = req.body;
  if (!newData || !Array.isArray(newData.groups) || !Array.isArray(newData.logs)) {
    return res.status(400).json({ error: "Groups and logs must be arrays" });
  }
  saveData(newData);
  res.json({ status: "ok" });
});

// GET only logs
app.get("/api/logs", (req, res) => {
  const data = loadData();
  res.json(data.logs || []);
});

// ✅ NEW: POST a single log entry
app.post("/api/logs", (req, res) => {
  const newLog = req.body;
  if (!newLog || !newLog.date || !newLog.type) {
    return res.status(400).json({ error: "Invalid log format" });
  }

  const data = loadData();
  data.logs.push(newLog);
  saveData(data);

  res.json({ status: "ok", log: newLog });
});

// DELETE a specific log by timestamp
app.delete("/api/logs/:ts", (req, res) => {
  const { ts } = req.params;
  const data = loadData();

  // Keep everything except the one log with matching ts
  const before = data.logs.length;
  data.logs = data.logs.filter((l) => String(l.ts) !== String(ts));
  const after = data.logs.length;

  saveData(data);
  res.json({
    status: "deleted",
    ts,
    removed: before - after,
  });
});

// ✅ NEW: Delete logs for a specific group
app.delete("/api/logs/:groupName", (req, res) => {
  const { groupName } = req.params;
  const data = loadData();

  const before = data.logs.length;
  data.logs = data.logs.filter(log => 
    log.group.toLowerCase() !== decodeURIComponent(groupName).toLowerCase()
  );
  const after = data.logs.length;

  saveData(data);
  res.json({
    status: "deleted",
    groupName: decodeURIComponent(groupName),
    removed: before - after,
  });
});

// DELETE logs for a specific group AND date
app.delete("/api/logs/:groupName/:date", (req, res) => {
  const { groupName, date } = req.params;
  const data = loadData();

  const decodedGroupName = decodeURIComponent(groupName);
  const decodedDate = decodeURIComponent(date);

  console.log(`Deleting logs for group: ${decodedGroupName}, date: ${decodedDate}`);

  const before = data.logs.length;
  data.logs = data.logs.filter(log => {
    // Keep logs that don't match the criteria
    if (log.date !== decodedDate) return true;

    // Always delete group-create and group-delete regardless of group
    if (log.type === "group-create" || log.type === "group-delete") {
      return false; // delete it
    }

    // Delete logs that belong to this specific group
    if (log.group && log.group.toLowerCase() === decodedGroupName.toLowerCase()) {
      return false; // delete it
    }

    // Delete logs with unknown/missing group
    if (!log.group || log.group.toLowerCase() === "unknowngroup") {
      return false; // delete it
    }

    return true; // keep it
  });

  const after = data.logs.length;
  const removed = before - after;

  saveData(data);
  
  console.log(`Removed ${removed} logs for ${decodedGroupName} on ${decodedDate}`);
  
  res.json({
    status: "deleted",
    groupName: decodedGroupName,
    date: decodedDate,
    removed: removed,
  });
});

// ====================== USER MANAGEMENT API ====================== //

// ✅ NEW: GET all users
app.get("/api/users", (req, res) => {
  try {
    const users = loadUsers();
    res.json(users);
  } catch (err) {
    console.error("Error loading users:", err);
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ✅ NEW: POST save all users (used by your existing saveUsers function)
app.post("/api/users", (req, res) => {
  try {
    const users = req.body;
    if (!Array.isArray(users)) {
      return res.status(400).json({ error: "Users must be an array" });
    }
    
    // Basic validation
    for (let user of users) {
      if (!user.username || !user.password || !user.role) {
        return res.status(400).json({ error: "Each user must have username, password, and role" });
      }
    }
    
    saveUsers(users);
    res.json({ status: "ok", count: users.length });
  } catch (err) {
    console.error("Error saving users:", err);
    res.status(500).json({ error: "Failed to save users" });
  }
});

// ✅ NEW: POST create a single user
app.post("/api/users/create", (req, res) => {
  try {
    const { username, password, role } = req.body;
    
    if (!username || !password || !role) {
      return res.status(400).json({ error: "Username, password, and role are required" });
    }
    
    const users = loadUsers();
    
    // Check if username already exists
    if (users.find(u => u.username === username)) {
      return res.status(409).json({ error: "Username already exists" });
    }
    
    users.push({ username, password, role });
    saveUsers(users);
    
    res.json({ status: "ok", user: { username, role } });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ✅ NEW: PUT update a user
app.put("/api/users/:username", (req, res) => {
  try {
    const { username } = req.params;
    const { password, role, newUsername } = req.body;
    
    const users = loadUsers();
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Update user properties
    if (newUsername) users[userIndex].username = newUsername;
    if (password) users[userIndex].password = password;
    if (role) users[userIndex].role = role;
    
    saveUsers(users);
    
    res.json({ status: "ok", user: users[userIndex] });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// ✅ NEW: DELETE a user
app.delete("/api/users/:username", (req, res) => {
  try {
    const { username } = req.params;
    const users = loadUsers();
    
    // Don't allow deleting the admin user
    if (username === "admin") {
      return res.status(403).json({ error: "Cannot delete admin user" });
    }
    
    const before = users.length;
    const filteredUsers = users.filter(u => u.username !== username);
    
    if (filteredUsers.length === before) {
      return res.status(404).json({ error: "User not found" });
    }
    
    saveUsers(filteredUsers);
    
    res.json({ status: "ok", deleted: username });
  } catch (err) {
    console.error("Error deleting user:", err);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// ✅ NEW: Recovery endpoint to view users and system info
app.get("/api/admin/recovery", (req, res) => {
  try {
    console.log("=== RECOVERY REQUEST ===");
    console.log("DATA_FILE:", DATA_FILE);
    console.log("USERS_FILE:", USERS_FILE);
    console.log("DATA_FILE exists:", fs.existsSync(DATA_FILE));
    console.log("USERS_FILE exists:", fs.existsSync(USERS_FILE));
    
    const users = loadUsers();
    const data = loadData();
    
    res.json({
      users: users,
      userCount: users.length,
      groupCount: data.groups ? data.groups.length : 0,
      logCount: data.logs ? data.logs.length : 0,
      filePaths: {
        dataFile: DATA_FILE,
        usersFile: USERS_FILE,
        dataExists: fs.existsSync(DATA_FILE),
        usersExists: fs.existsSync(USERS_FILE)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ====================== TV DISPLAY URLS API ====================== //

const TV_URLS_FILE = path.join(DATA_DIR, "tv_urls.json");

if (!fs.existsSync(TV_URLS_FILE)) {
  fs.writeFileSync(TV_URLS_FILE, JSON.stringify([], null, 2));
}

function loadTVUrls() {
  try {
    const raw = fs.readFileSync(TV_URLS_FILE, "utf8");
    return JSON.parse(raw || '[]');
  } catch (err) { return []; }
}

function saveTVUrls(urls) {
  fs.writeFileSync(TV_URLS_FILE, JSON.stringify(urls, null, 2));
}

app.get("/api/tv-urls", (req, res) => {
  res.json(loadTVUrls());
});

app.post("/api/tv-urls", (req, res) => {
  const urls = req.body;
  if (!Array.isArray(urls)) {
    return res.status(400).json({ error: "URLs must be an array" });
  }
  saveTVUrls(urls);
  res.json({ status: "ok", count: urls.length });
});

// ======================================================== //

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Data file: ${DATA_FILE}`);
  console.log(`✅ Users file: ${USERS_FILE}`);
  console.log(`✅ TV URLs file: ${TV_URLS_FILE}`);
});

