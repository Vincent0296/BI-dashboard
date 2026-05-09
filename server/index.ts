import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const DB_PATH = path.join(__dirname, '../data');
const USERS_FILE = path.join(DB_PATH, 'users.json');
const FEEDBACK_FILE = path.join(DB_PATH, 'feedback.json');
const PRESETS_FILE = path.join(DB_PATH, 'presets.json');
const COMMENTS_FILE = path.join(DB_PATH, 'comments.json');

// Ensure data directory exists
if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH);
}

// Initialize files if they don't exist
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(FEEDBACK_FILE)) fs.writeFileSync(FEEDBACK_FILE, JSON.stringify([]));
if (!fs.existsSync(PRESETS_FILE)) fs.writeFileSync(PRESETS_FILE, JSON.stringify([]));
if (!fs.existsSync(COMMENTS_FILE)) fs.writeFileSync(COMMENTS_FILE, JSON.stringify([]));

// Helpers
const getUsers = () => {
  try {
    const content = fs.readFileSync(USERS_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    return [];
  }
};
const saveUsers = (users: any) => {
  console.log('Saving users to:', USERS_FILE, 'Count:', users.length);
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
};
const getFeedback = () => {
  try {
    const content = fs.readFileSync(FEEDBACK_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    return [];
  }
};
const saveFeedback = (feedback: any) => {
  console.log('Saving feedback to:', FEEDBACK_FILE, 'Count:', feedback.length);
  fs.writeFileSync(FEEDBACK_FILE, JSON.stringify(feedback, null, 2));
};
const getPresets = () => {
  try {
    const content = fs.readFileSync(PRESETS_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    return [];
  }
};
const savePresets = (presets: any) => fs.writeFileSync(PRESETS_FILE, JSON.stringify(presets, null, 2));

const getComments = () => {
  try {
    const content = fs.readFileSync(COMMENTS_FILE, 'utf8');
    return content ? JSON.parse(content) : [];
  } catch (e) {
    return [];
  }
};
const saveComments = (comments: any) => fs.writeFileSync(COMMENTS_FILE, JSON.stringify(comments, null, 2));

// API Routes

// [重要] 管理员专用数据接口 - 移动到最上方确保优先匹配
app.get('/api/admin/stats', (req, res) => {
  console.log('Admin stats requested at:', new Date().toISOString());
  try {
    const users = getUsers();
    const feedback = getFeedback();
    console.log(`Sending data: ${users.length} users, ${feedback.length} feedbacks`);
    
    res.json({
      users: users.map((u: any) => {
        const { password: _, ...safeUser } = u;
        return safeUser;
      }),
      feedback: feedback
    });
  } catch (err) {
    console.error('Error in /api/admin/data:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// 获取用户的方案列表
app.get('/api/presets/:userId', (req, res) => {
  const { userId } = req.params;
  const presets = getPresets();
  const userPresets = presets.filter((p: any) => p.userId === userId);
  res.json(userPresets);
});

// 保存新的方案
app.post('/api/presets', (req, res) => {
  const { userId, name, filters, selectedIndicators } = req.body;
  const presets = getPresets();
  
  const newPreset = {
    id: Date.now().toString(),
    userId,
    name,
    filters,
    selectedIndicators: selectedIndicators || [],
    timestamp: new Date().toISOString()
  };
  
  presets.push(newPreset);
  savePresets(presets);
  res.json(newPreset);
});

// 更新方案 (覆盖保存或重命名)
app.put('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  const { name, filters, selectedIndicators } = req.body;
  const presets = getPresets();
  const index = presets.findIndex((p: any) => p.id === id);
  
  if (index !== -1) {
    if (name) presets[index].name = name;
    if (filters) presets[index].filters = filters;
    if (selectedIndicators) presets[index].selectedIndicators = selectedIndicators;
    presets[index].timestamp = new Date().toISOString();
    savePresets(presets);
    res.json(presets[index]);
  } else {
    res.status(404).json({ message: 'Preset not found' });
  }
});

// 删除方案
app.delete('/api/presets/:id', (req, res) => {
  const { id } = req.params;
  const presets = getPresets();
  const newPresets = presets.filter((p: any) => p.id !== id);
  savePresets(newPresets);
  res.json({ success: true });
});

// --- COMMENTS API ---

app.get('/api/comments', (req, res) => {
  res.json(getComments());
});

app.post('/api/comments', (req, res) => {
  const comment = req.body;
  const comments = getComments();
  comment.id = Date.now().toString();
  comments.push(comment);
  saveComments(comments);
  res.json(comment);
});

app.post('/api/comments/bulk', (req, res) => {
  const newComments = req.body;
  if (!Array.isArray(newComments)) return res.status(400).json({ error: 'Expected array' });
  
  const comments = getComments();
  newComments.forEach((c: any, index: number) => {
    c.id = Date.now().toString() + '_' + index;
    comments.push(c);
  });
  saveComments(comments);
  res.json({ success: true, count: newComments.length });
});

app.put('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  const { project, dimension, text, period, propertyType, management } = req.body;
  const comments = getComments();
  const index = comments.findIndex((c: any) => c.id === id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  
  comments[index] = { 
    ...comments[index], 
    ...(project && { project }),
    ...(dimension && { dimension }),
    ...(text && { text }),
    ...(period && { period }),
    ...(propertyType && { propertyType }),
    ...(management && { management })
  };
  saveComments(comments);
  res.json(comments[index]);
});

app.delete('/api/comments/:id', (req, res) => {
  const { id } = req.params;
  let comments = getComments();
  comments = comments.filter((c: any) => c.id !== id);
  saveComments(comments);
  res.json({ success: true });
});

app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();

  if (users.find((u: any) => u.username === username)) {
    return res.status(400).json({ message: '用户名已存在' });
  }

  const newUser = {
    id: Date.now().toString(),
    username,
    password,
    nickname: username,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    lastLoginIp: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
    lastLoginTime: new Date().toISOString()
  };

  users.push(newUser);
  saveUsers(users);

  const { password: _, ...userWithoutPassword } = newUser;
  res.json(userWithoutPassword);
});

app.post('/api/reset-password', (req, res) => {
  const { username, newPassword } = req.body;
  const users = getUsers();
  const userIndex = users.findIndex((u: any) => u.username === username);

  if (userIndex === -1) {
    return res.status(404).json({ message: '找不到该用户' });
  }

  users[userIndex].password = newPassword;
  saveUsers(users);
  res.json({ success: true });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const userIndex = users.findIndex((u: any) => 
    (u.username === username || u.nickname === username) && u.password === password
  );

  if (userIndex === -1) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }

  // 记录 IP 地址
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  users[userIndex].lastLoginIp = ip;
  users[userIndex].lastLoginTime = new Date().toISOString();
  saveUsers(users);

  const { password: _, ...userWithoutPassword } = users[userIndex];
  res.json(userWithoutPassword);
});

app.post('/api/feedback', (req, res) => {
  const { userId, content } = req.body;
  const feedback = getFeedback();
  
  feedback.push({
    id: Date.now().toString(),
    userId,
    content,
    timestamp: new Date().toISOString()
  });
  
  saveFeedback(feedback);
  res.json({ success: true });
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log('=================================');
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('Registered Routes:');
  console.log('- GET  /api/admin/stats');
  console.log('- POST /api/register');
  console.log('- POST /api/login');
  console.log('- POST /api/feedback');
  console.log('- POST /api/reset-password');
  console.log('=================================');
});
