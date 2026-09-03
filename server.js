const express = require('express');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;
const DB_PATH = path.join(__dirname, 'municipality.db');

// REAL PHILIPPINE SMS GATEWAY CONFIGURATION (Semaphore PH)
// Paste your Semaphore API Key here or set process.env.SEMAPHORE_API_KEY
const SEMAPHORE_API_KEY = process.env.SEMAPHORE_API_KEY || '';

// Body parser
app.use(express.json({ limit: '15mb' }));

// Custom static middleware for proper APK MIME type handling
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.apk')) {
      res.setHeader('Content-Type', 'application/vnd.android.package-archive');
      res.setHeader('Content-Disposition', 'attachment; filename="daraga-respond.apk"');
    }
  }
}));

// Explicit APK Download Route
app.get('/download/daraga-respond.apk', (req, res) => {
  const apkPath = path.join(__dirname, 'public', 'daraga-respond.apk');
  if (fs.existsSync(apkPath)) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.download(apkPath, 'daraga-respond.apk');
  } else {
    res.status(404).send('APK file not found.');
  }
});

// Initialize SQLite Database
const db = new DatabaseSync(DB_PATH);

// Enable WAL mode & create tables
db.exec(`
  PRAGMA journal_mode = WAL;
  
  CREATE TABLE IF NOT EXISTS residents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mobile_number TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    barangay TEXT NOT NULL,
    otp_code TEXT,
    otp_expires_at DATETIME,
    is_verified INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id TEXT UNIQUE NOT NULL,
    resident_name TEXT DEFAULT 'Anonymous Resident',
    contact_number TEXT DEFAULT '',
    barangay TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    location_landmark TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    photo_base64 TEXT,
    status TEXT DEFAULT 'Pending',
    admin_notes TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    offline_created_at DATETIME,
    synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    full_name TEXT NOT NULL
  );
`);

// Seed default admin
const existingAdminStmt = db.prepare('SELECT COUNT(*) as count FROM admins');
if (existingAdminStmt.get().count === 0) {
  const insertAdminStmt = db.prepare('INSERT INTO admins (username, password, full_name) VALUES (?, ?, ?)');
  insertAdminStmt.run('admin', 'admin123', 'Municipal Disaster Risk Reduction Officer');
  console.log('Seeded default admin user: admin / admin123');
}

// Seed initial Daraga incidents if database is empty
const existingIncidentsStmt = db.prepare('SELECT COUNT(*) as count FROM incidents');
if (existingIncidentsStmt.get().count === 0) {
  const insertStmt = db.prepare(`
    INSERT INTO incidents 
    (tracking_id, resident_name, contact_number, barangay, category, description, location_landmark, latitude, longitude, status, admin_notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(
    'MUN-DAR-8A19',
    'Juan Dela Cruz',
    '09171234567',
    'Busay',
    'Fallen Tree / Road Obstruction',
    'Large acacia tree branch fell across the access road near Cagsawa Ruins entrance.',
    'Near Cagsawa Ruins entrance road, Barangay Busay, Daraga',
    13.1594,
    123.7631,
    'Pending',
    'Dispatched MDRRMO Daraga clearing team.',
    new Date(Date.now() - 3600000 * 2).toISOString()
  );

  insertStmt.run(
    'MUN-DAR-3B92',
    'Maria Santos',
    '09189876543',
    'Anislag',
    'Broken Streetlight',
    '4 unlit streetlights along the main road near the relocation site.',
    'Corner Purok 3 near Anislag Elementary School',
    13.1250,
    123.7250,
    'In Progress',
    'ALECO & Daraga Municipal Electrician assigned.',
    new Date(Date.now() - 3600000 * 14).toISOString()
  );

  insertStmt.run(
    'MUN-DAR-9C44',
    'Pedro Penduko',
    '09205554321',
    'Bañag',
    'Flood / Landslide',
    'Minor lahar runoff overflow on spillway road during heavy rainfall.',
    'Spillway crossing, Barangay Bañag, Daraga',
    13.1480,
    123.7120,
    'Resolved',
    'Road cleared by Daraga Engineering Dept.',
    new Date(Date.now() - 3600000 * 36).toISOString()
  );

  console.log('Seeded Daraga, Albay incident reports into SQLite');
}

// Helpers
function generateTrackingId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = 'MUN-DAR-';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// REAL SMS DISPATCHER VIA SEMAPHORE PH API
async function sendRealSMS(mobileNumber, message) {
  const apiKey = SEMAPHORE_API_KEY;

  if (!apiKey || apiKey === 'YOUR_SEMAPHORE_API_KEY') {
    console.log(`[SMS SIMULATION MODE] No SEMAPHORE_API_KEY set. Simulated SMS OTP to ${mobileNumber}: "${message}"`);
    return { sent: false, mode: 'simulation', reason: 'No SEMAPHORE_API_KEY configured.' };
  }

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      number: mobileNumber,
      message: message,
      sendername: 'LGUDARAGA'
    });

    const response = await fetch('https://api.semaphore.co/api/v4/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    });

    const data = await response.json();
    console.log(`[REAL SMS SENT VIA SEMAPHORE to ${mobileNumber}]:`, data);
    return { sent: true, response: data };
  } catch (err) {
    console.error(`[REAL SMS ERROR]:`, err);
    return { sent: false, error: err.message };
  }
}

// --- RESIDENT AUTHENTICATION API (OTP) ---

// 1. Request OTP
app.post('/api/resident/request-otp', async (req, res) => {
  try {
    const { mobile_number, full_name, barangay } = req.body;
    if (!mobile_number || mobile_number.length < 10) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 11-digit Philippine mobile number.' });
    }

    const cleanMobile = mobile_number.trim().replace(/[^0-9]/g, '');
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 mins

    // Upsert resident record
    const findStmt = db.prepare('SELECT id FROM residents WHERE mobile_number = ?');
    const existing = findStmt.get(cleanMobile);

    if (existing) {
      const updateStmt = db.prepare('UPDATE residents SET full_name = ?, barangay = ?, otp_code = ?, otp_expires_at = ? WHERE mobile_number = ?');
      updateStmt.run(full_name || 'Resident', barangay || 'General Daraga', otpCode, expiresAt, cleanMobile);
    } else {
      const insertStmt = db.prepare('INSERT INTO residents (mobile_number, full_name, barangay, otp_code, otp_expires_at) VALUES (?, ?, ?, ?, ?)');
      insertStmt.run(cleanMobile, full_name || 'Resident', barangay || 'General Daraga', otpCode, expiresAt);
    }

    const smsMessage = `Your Daraga ResponD verification OTP code is: ${otpCode}. Valid for 10 mins. LGU-Daraga.`;
    const smsResult = await sendRealSMS(cleanMobile, smsMessage);

    const payload = {
      success: true,
      message: smsResult.sent ? 'Real SMS sent directly to your mobile phone inbox!' : 'OTP Code generated!',
      mobile_number: cleanMobile,
      sms_status: smsResult
    };

    // Only include on-screen otp_code if Real SMS was NOT sent (simulation mode for testing)
    if (!smsResult.sent) {
      payload.otp_code = otpCode;
    }

    res.json(payload);
  } catch (err) {
    console.error('Error requesting OTP:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Verify OTP
app.post('/api/resident/verify-otp', (req, res) => {
  try {
    const { mobile_number, otp_code } = req.body;
    const cleanMobile = (mobile_number || '').trim().replace(/[^0-9]/g, '');
    const cleanOtp = (otp_code || '').trim();

    const stmt = db.prepare('SELECT * FROM residents WHERE mobile_number = ?');
    const resident = stmt.get(cleanMobile);

    if (!resident) {
      return res.status(404).json({ success: false, error: 'Resident mobile number not found.' });
    }

    if (resident.otp_code !== cleanOtp) {
      return res.status(400).json({ success: false, error: 'Invalid 6-digit OTP code. Please check and try again.' });
    }

    // OTP matches! Mark as verified
    const verifyStmt = db.prepare('UPDATE residents SET is_verified = 1, otp_code = NULL WHERE id = ?');
    verifyStmt.run(resident.id);

    res.json({
      success: true,
      message: 'Mobile number verified successfully!',
      resident: {
        id: resident.id,
        mobile_number: resident.mobile_number,
        full_name: resident.full_name,
        barangay: resident.barangay,
        is_verified: 1
      }
    });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- INCIDENTS API ---

app.post('/api/incidents', (req, res) => {
  try {
    const payload = req.body;
    const reports = Array.isArray(payload) ? payload : [payload];
    const results = [];

    const insertStmt = db.prepare(`
      INSERT INTO incidents (
        tracking_id, resident_name, contact_number, barangay, category,
        description, location_landmark, latitude, longitude, photo_base64,
        offline_created_at, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of reports) {
      const trackingId = item.tracking_id || generateTrackingId();
      const offlineCreatedAt = item.offline_created_at || new Date().toISOString();
      const syncedAt = new Date().toISOString();

      insertStmt.run(
        trackingId,
        item.resident_name || 'Anonymous Resident',
        item.contact_number || '',
        item.barangay || 'General Daraga Area',
        item.category || 'Other Emergency',
        item.description || 'No description provided.',
        item.location_landmark || 'Location not specified',
        item.latitude ? parseFloat(item.latitude) : null,
        item.longitude ? parseFloat(item.longitude) : null,
        item.photo_base64 || null,
        offlineCreatedAt,
        syncedAt
      );

      results.push({
        tracking_id: trackingId,
        status: 'Pending',
        synced_at: syncedAt
      });
    }

    res.json({ success: true, count: results.length, data: results });
  } catch (err) {
    console.error('Error saving incident:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/incidents', (req, res) => {
  try {
    const { status, category, barangay, search } = req.query;
    let query = 'SELECT id, tracking_id, resident_name, contact_number, barangay, category, description, location_landmark, latitude, longitude, photo_base64, status, admin_notes, created_at, offline_created_at, synced_at FROM incidents WHERE 1=1';
    const params = [];

    if (status && status !== 'All') {
      query += ' AND status = ?';
      params.push(status);
    }
    if (category && category !== 'All') {
      query += ' AND category = ?';
      params.push(category);
    }
    if (barangay && barangay !== 'All') {
      query += ' AND barangay = ?';
      params.push(barangay);
    }
    if (search) {
      query += ' AND (description LIKE ? OR location_landmark LIKE ? OR tracking_id LIKE ? OR resident_name LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY id DESC';

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/incidents/track/:trackingId', (req, res) => {
  try {
    const { trackingId } = req.params;
    const stmt = db.prepare('SELECT tracking_id, barangay, category, description, location_landmark, status, admin_notes, created_at FROM incidents WHERE tracking_id = ?');
    const row = stmt.get(trackingId.trim().toUpperCase());

    if (!row) {
      return res.status(404).json({ success: false, message: 'Incident tracking code not found.' });
    }
    res.json({ success: true, data: row });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.patch('/api/incidents/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!['Pending', 'Investigating', 'In Progress', 'Resolved'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status value.' });
    }

    const stmt = db.prepare('UPDATE incidents SET status = ?, admin_notes = COALESCE(?, admin_notes) WHERE id = ?');
    stmt.run(status, admin_notes || '', id);

    res.json({ success: true, message: `Status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  try {
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM incidents');
    const pendingStmt = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'Pending'");
    const progressStmt = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'In Progress' OR status = 'Investigating'");
    const resolvedStmt = db.prepare("SELECT COUNT(*) as count FROM incidents WHERE status = 'Resolved'");

    res.json({
      success: true,
      data: {
        total: totalStmt.get().count,
        pending: pendingStmt.get().count,
        in_progress: progressStmt.get().count,
        resolved: resolvedStmt.get().count
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    const stmt = db.prepare('SELECT id, username, full_name FROM admins WHERE username = ? AND password = ?');
    const user = stmt.get(username, password);

    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, error: 'Invalid admin username or password.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Daraga ResponD Server Running at http://localhost:${PORT}`);
  console.log(`Resident Mobile App: http://localhost:${PORT}/index.html`);
  console.log(`Admin Console Web Portal: http://localhost:${PORT}/admin.html`);
  console.log(`SQLite Database: ${DB_PATH}`);
  console.log(`====================================================`);
});
