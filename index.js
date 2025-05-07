const express = require('express');
const multer = require('multer');
const cors = require('cors');
const mysql = require('mysql2');
const path = require('path');
const fs = require('fs');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MySQL connection
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'root',
  database: 'fileuploads',
});

db.connect((err) => {
  if (err) throw err;
  console.log('✅ Connected to MySQL');
});

// Multer Config
const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadPath = path.join(__dirname, 'uploads');
      if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath);
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '_' + file.originalname);
    },
  }),
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or WEBP files allowed'));
    }
    cb(null, true);
  },
});

/* ------------------------ BANNER ROUTES ------------------------ */

// Upload banner
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const fileUrl = `http://localhost:${port}/uploads/${req.file.filename}`;
  db.query('INSERT INTO banners (file_url) VALUES (?)', [fileUrl], (err, result) => {
    if (err) {
      fs.unlinkSync(req.file.path);
      return res.status(500).json({ error: 'Database error' });
    }
    res.status(201).json({ id: result.insertId, fileUrl });
  });
});

// Get all banners
app.get('/banners', (req, res) => {
  db.query('SELECT id, file_url FROM banners', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Delete banner
app.delete('/banners/:id', (req, res) => {
  const bannerId = req.params.id;
  db.query('SELECT file_url FROM banners WHERE id = ?', [bannerId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Banner not found' });

    const fileUrl = results[0].file_url;
    const filename = fileUrl.split('/').pop();
    const filePath = path.join(__dirname, 'uploads', filename);

    fs.unlink(filePath, (fsErr) => {
      if (fsErr) console.warn('⚠️ File deletion warning:', fsErr.message);

      db.query('DELETE FROM banners WHERE id = ?', [bannerId], (dbErr) => {
        if (dbErr) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Banner deleted successfully' });
      });
    });
  });
});

/* ------------------------ PROJECT ROUTES ------------------------ */

// Upload project
app.post('/projects/upload', upload.single('file'), (req, res) => {
  const { project, year } = req.body;

  if (!req.file || !project || !year) {
    return res.status(400).json({ error: 'Missing file, project name, or year' });
  }

  const fileUrl = `http://localhost:${port}/uploads/${req.file.filename}`;

  db.query(
    'INSERT INTO projects (project, year, file_url) VALUES (?, ?, ?)',
    [project, year, fileUrl],
    (err, result) => {
      if (err) {
        fs.unlinkSync(req.file.path);
        return res.status(500).json({ error: 'Database error' });
      }

      res.status(201).json({
        id: result.insertId,
        fileUrl,
        project,
        year,
      });
    }
  );
});

// Get all projects
app.get('/projects', (req, res) => {
  db.query('SELECT * FROM projects', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Delete project
app.delete('/projects/:id', (req, res) => {
  const projectId = req.params.id;

  db.query('SELECT file_url FROM projects WHERE id = ?', [projectId], (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (results.length === 0) return res.status(404).json({ error: 'Project not found' });

    const fileUrl = results[0].file_url;
    const filename = fileUrl.split('/').pop();
    const filePath = path.join(__dirname, 'uploads', filename);

    fs.unlink(filePath, (fsErr) => {
      if (fsErr) console.warn('⚠️ File deletion warning:', fsErr.message);

      db.query('DELETE FROM projects WHERE id = ?', [projectId], (dbErr) => {
        if (dbErr) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Project deleted successfully' });
      });
    });
  });
});

/* ------------------------ GLOBAL ERROR HANDLER ------------------------ */
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

/* ------------------------ START SERVER ------------------------ */
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
