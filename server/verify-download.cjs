const fs = require('fs');
const path = require('path');
const http = require('http');

const filePath = path.join(__dirname, 'uploads', 'download-test.txt');
fs.writeFileSync(filePath, 'hello download');
const docs = JSON.parse(fs.existsSync('documents.json') ? fs.readFileSync('documents.json', 'utf8') : '[]');
const payload = {
  id: 999999999,
  name: 'download-test.txt',
  type: 'text/plain',
  path: filePath,
  text: 'hello download',
  searchableText: 'download-test.txt hello download',
  uploadedAt: new Date().toISOString(),
};
docs.push(payload);
fs.writeFileSync('documents.json', JSON.stringify(docs, null, 2));

http.get('http://localhost:5000/download/999999999', (res) => {
  console.log('status', res.statusCode);
  res.resume();
}).on('error', (err) => {
  console.error(err.message);
  process.exit(1);
});
