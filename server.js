const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const USERS_FILE = path.join(__dirname, 'users.json');
const UPDATES_FILE = path.join(__dirname, 'updates.json');

let connectedClients = [];

function readJSON(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return file.includes('users') ? { users: [] } : { updates: [] };
  }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const users = readJSON(USERS_FILE);
  
  if (users.users.find(u => u.username === username)) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const newUser = {
    id: Date.now(),
    username,
    password,
    rank: 'none',
    createdAt: new Date().toISOString()
  };

  users.users.push(newUser);
  writeJSON(USERS_FILE, users);

  return res.json({ 
    success: true, 
    user: { id: newUser.id, username, rank: 'none' } 
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username && u.password === password);

  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = Buffer.from(`${username}:${user.id}:${user.rank}:${Date.now()}`).toString('base64');

  return res.json({
    success: true,
    token,
    user: { id: user.id, username: user.username, rank: user.rank }
  });
});

app.get('/api/updates', (req, res) => {
  const data = readJSON(UPDATES_FILE);
  const confirmed = data.updates.filter(u => u.confirmed);
  return res.json(confirmed);
});

app.get('/api/all-updates', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const data = readJSON(UPDATES_FILE);
  return res.json(data.updates);
});

app.get('/api/all-users', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  return res.json(users.users.map(u => ({ username: u.username, rank: u.rank })));
});

app.get('/api/suggestions', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const data = readJSON(UPDATES_FILE);
  const pending = data.updates.filter(u => !u.confirmed);
  return res.json(pending);
});

app.post('/api/updates', (req, res) => {
  const { title, message, value, username } = req.body;

  if (!title || !message || !value || !username) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const data = readJSON(UPDATES_FILE);
  const newUpdate = {
    id: Date.now(),
    title,
    message,
    value,
    username,
    confirmed: false,
    timestamp: new Date().toISOString()
  };

  data.updates.push(newUpdate);
  writeJSON(UPDATES_FILE, data);

  return res.json({ success: true, update: newUpdate });
});

app.put('/api/updates/:id', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const { title, message, value, confirmed } = req.body;
  const data = readJSON(UPDATES_FILE);
  const update = data.updates.find(u => u.id == req.params.id);

  if (!update) {
    return res.status(404).json({ error: 'Not found' });
  }

  if (title) update.title = title;
  if (message) update.message = message;
  if (value) update.value = value;
  if (confirmed !== undefined) update.confirmed = confirmed;

  writeJSON(UPDATES_FILE, data);

  return res.json({ success: true });
});

app.put('/api/suggestions/:id/approve', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const data = readJSON(UPDATES_FILE);
  const update = data.updates.find(u => u.id == req.params.id);

  if (!update) {
    return res.status(404).json({ error: 'Not found' });
  }

  update.confirmed = true;
  writeJSON(UPDATES_FILE, data);

  return res.json({ success: true });
});

app.delete('/api/updates/:id', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const data = readJSON(UPDATES_FILE);
  data.updates = data.updates.filter(u => u.id != req.params.id);
  writeJSON(UPDATES_FILE, data);

  return res.json({ success: true });
});

app.delete('/api/suggestions/:id', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner' && user.rank !== "owner / Main developer" && user.rank !== "admin / developer" && user.rank !== "owner /developer") {
    return res.status(403).json({ error: 'Admin only' });
  }

  const data = readJSON(UPDATES_FILE);
  data.updates = data.updates.filter(u => u.id != req.params.id);
  writeJSON(UPDATES_FILE, data);

  return res.json({ success: true });
});

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = Date.now();
  const client = { id: clientId, res };
  connectedClients.push(client);

  res.write('data: connected\n\n');

  req.on('close', () => {
    connectedClients = connectedClients.filter(c => c.id !== clientId);
  });
});

app.post('/api/reload-all', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const username = decoded[0];

  const users = readJSON(USERS_FILE);
  const user = users.users.find(u => u.username === username);

  if (!user || user.rank !== 'admin' && user.rank !== 'owner') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const clientCount = connectedClients.length;
  connectedClients.forEach(client => {
    try {
      client.res.write('data: {"type":"reload"}\n\n');
    } catch (err) {
      connectedClients = connectedClients.filter(c => c.id !== client.id);
    }
  });

  return res.json({ success: true, reloadedClients: clientCount });
});

const BANS_FILE = path.join(__dirname, 'user_bans.json');
const WARNS_FILE = path.join(__dirname, 'user_warns.json');

app.post('/api/warn-user', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { username, reason } = req.body;

  if (!token || !username) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const adminName = decoded[0];

  const users = readJSON(USERS_FILE);
  const admin = users.users.find(u => u.username === adminName);

  if (!admin || admin.rank !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const targetUser = users.users.find(u => u.username === username);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  const warnsData = readJSON(WARNS_FILE);
  const newWarn = {
    id: Date.now(),
    username,
    reason: reason || 'No reason provided',
    warnedBy: adminName,
    timestamp: new Date().toISOString()
  };

  warnsData.warns.push(newWarn);
  writeJSON(WARNS_FILE, warnsData);

  return res.json({ success: true, warn: newWarn });
});

app.post('/api/ban-user', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  const { username, reason, banType } = req.body;

  if (!token || !username) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  const decoded = Buffer.from(token, 'base64').toString('utf8').split(':');
  const adminName = decoded[0];

  const users = readJSON(USERS_FILE);
  const admin = users.users.find(u => u.username === adminName);

  if (!admin || admin.rank !== 'admin') {
    return res.status(403).json({ error: 'Admin only' });
  }

  const targetUser = users.users.find(u => u.username === username);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }

  if (targetUser.rank === 'admin') {
    return res.status(403).json({ error: 'Cannot ban admins' });
  }

  const bansData = readJSON(BANS_FILE);
  const newBan = {
    id: Date.now(),
    username,
    reason: reason || 'No reason provided',
    bannedBy: adminName,
    banType: banType || 'account',
    timestamp: new Date().toISOString()
  };

  bansData.bans.push(newBan);
  writeJSON(BANS_FILE, bansData);

  targetUser.rank = 'none';
  writeJSON(USERS_FILE, users);

  return res.json({ success: true, ban: newBan });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Test: admin / admin123`);
});
