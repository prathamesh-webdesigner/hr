import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import mammoth from 'mammoth';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const PDFParse = pdfParse.PDFParse || pdfParse;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const uploadDir = path.join(__dirname, 'uploads');
const documentsFile = path.join(__dirname, 'documents.json');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const dbConfig = {
  host: process.env.DB_HOST || '',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || '',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || '',
};
const useDb = Boolean(dbConfig.host && dbConfig.user && dbConfig.database);
let pool = null;

async function initDb() {
  if (!useDb) return;
  pool = mysql.createPool({
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS documents (
      id BIGINT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(255),
      path VARCHAR(1024) NOT NULL,
      text LONGTEXT,
      searchableText LONGTEXT,
      uploadedAt DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function loadDocuments() {
  try {
    if (fs.existsSync(documentsFile)) {
      const data = JSON.parse(fs.readFileSync(documentsFile, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.warn('Could not load saved documents:', error.message);
  }

  return [];
}

async function saveDocuments() {
  if (useDb) {
    return;
  }

  fs.writeFileSync(documentsFile, JSON.stringify(documents, null, 2));
}

async function saveDocumentToDb(document) {
  if (!useDb || !pool) return;

  await pool.execute(
    `INSERT INTO documents (id, name, type, path, text, searchableText, uploadedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [document.id, document.name, document.type, document.path, document.text, document.searchableText, document.uploadedAt]
  );
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '-')}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

const documents = [];

async function loadDocumentsFromFile() {
  try {
    if (fs.existsSync(documentsFile)) {
      const data = JSON.parse(fs.readFileSync(documentsFile, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.warn('Could not load saved documents:', error.message);
  }

  return [];
}

async function loadDocumentsFromDb() {
  try {
    if (!useDb || !pool) return [];
    const [rows] = await pool.query('SELECT * FROM documents ORDER BY uploadedAt DESC');
    return rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      type: row.type,
      path: row.path,
      text: row.text,
      searchableText: row.searchableText,
      uploadedAt: row.uploadedAt,
    }));
  } catch (error) {
    console.warn('Could not load documents from database:', error.message);
    return [];
  }
}

async function cleanupMissingDocuments() {
  const existing = [];

  for (const doc of documents) {
    if (fs.existsSync(doc.path)) {
      existing.push(doc);
      continue;
    }

    if (useDb && pool) {
      try {
        await pool.execute('DELETE FROM documents WHERE id = ?', [doc.id]);
      } catch (error) {
        console.warn('Failed to remove stale document from DB:', error.message);
      }
    }
  }

  documents.length = 0;
  documents.push(...existing);

  if (!useDb) {
    await saveDocuments();
  }
}

async function initDocuments() {
  if (useDb) {
    const dbDocs = await loadDocumentsFromDb();
    documents.push(...dbDocs);
  } else {
    const fileDocs = await loadDocumentsFromFile();
    documents.push(...fileDocs);
  }

  await cleanupMissingDocuments();
}

async function indexExistingUploads() {
  try {
    const files = fs.readdirSync(uploadDir);

    for (const filename of files) {
      const filePath = path.join(uploadDir, filename);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;
      } catch (err) {
        continue;
      }

      const alreadyIndexed = documents.find((d) => d.path === filePath || path.basename(d.path) === filename || d.name === filename);
      if (alreadyIndexed) continue;

      const text = await extractText(filePath, filename);
      const record = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        name: filename,
        type: '',
        path: filePath,
        text: text || '',
        searchableText: `${filename} ${text || ''}`.toLowerCase(),
        uploadedAt: new Date().toISOString(),
      };

      documents.push(record);
      if (useDb) {
        await saveDocumentToDb(record);
      }
    }

    if (!useDb) {
      await saveDocuments();
    }
  } catch (error) {
    console.warn('Failed to index existing uploads:', error.message);
  }
}
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf') {
    try {
      const pdf = new PDFParse({ data: fs.readFileSync(filePath) });
      const data = await pdf.getText();
      return typeof data?.text === 'string' ? data.text : '';
    } catch (error) {
      console.warn('PDF parsing failed, falling back to filename only:', error.message);
      return '';
    }
  }

  if (ext === '.docx') {
    try {
      const data = await mammoth.extractRawText({ path: filePath });
      return data.value;
    } catch (error) {
      console.warn('DOCX parsing failed:', error.message);
      return '';
    }
  }

  if (ext === '.xlsx' || ext === '.xls') {
    try {
      const workbook = xlsx.readFile(filePath);
      const rows = [];
      workbook.SheetNames.forEach((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        rows.push(...xlsx.utils.sheet_to_json(sheet, { defval: '' }));
      });
      return rows.map((row) => JSON.stringify(row)).join('\n');
    } catch (error) {
      console.warn('Excel parsing failed:', error.message);
      return '';
    }
  }

  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return '';
  }
}

app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    const text = await extractText(req.file.path, req.file.originalname);
    const record = {
      id: Date.now(),
      name: req.file.originalname,
      type: req.file.mimetype,
      path: req.file.path,
      text: text || '',
      searchableText: `${req.file.originalname} ${text || ''}`.toLowerCase(),
      uploadedAt: new Date().toISOString(),
    };

    documents.push(record);
    if (useDb) {
      await saveDocumentToDb(record);
    } else {
      await saveDocuments();
    }
    res.json({ message: 'File uploaded and indexed successfully.', document: record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Upload failed.', error: error.message });
  }
});

function getAvailableDocuments() {
  return documents.filter((doc) => fs.existsSync(doc.path));
}

app.get('/documents', (req, res) => {
  res.json(getAvailableDocuments());
});

app.get('/search', (req, res) => {
  const keyword = (req.query.keyword || '').toLowerCase().trim();
  const sourceDocs = getAvailableDocuments();

  if (!keyword) {
    return res.json(sourceDocs);
  }

  const tokens = keyword
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  const results = documents.filter((doc) => {
    const haystack = doc.searchableText || `${doc.name} ${doc.text}`.toLowerCase();

    return tokens.some((token) => haystack.includes(token));
  });

  res.json(results);
});

app.get('/download/:id', (req, res) => {
  const doc = documents.find((item) => item.id === Number(req.params.id));

  if (!doc?.path || !fs.existsSync(doc.path)) {
    return res.status(404).json({ message: 'Document not found.' });
  }

  res.download(doc.path, doc.name);
});

;(async () => {
  try {
    if (useDb) {
      await initDb();
    }
    await initDocuments();
    await indexExistingUploads();
  } catch (err) {
    console.warn('Error initializing server:', err?.message || err);
  }

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
})();
