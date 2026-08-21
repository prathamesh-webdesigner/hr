const fs = require('fs');
const http = require('http');
const path = require('path');

const filePath = path.join(__dirname, 'uploads', 'resume.txt');
fs.writeFileSync(filePath, 'HTML5 CSS3 JavaScript experience in frontend development');

const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
const body = [
  '--' + boundary,
  'Content-Disposition: form-data; name="file"; filename="resume.txt"',
  'Content-Type: text/plain',
  '',
  fs.readFileSync(filePath).toString(),
  '--' + boundary + '--',
  ''
].join('\r\n');

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/upload',
  method: 'POST',
  headers: {
    'Content-Type': 'multipart/form-data; boundary=' + boundary,
  },
}, (res) => {
  let out = '';
  res.on('data', (chunk) => out += chunk);
  res.on('end', () => {
    console.log('UPLOAD', res.statusCode, out);
    http.get('http://localhost:5000/search?keyword=HTML5', (res2) => {
      let out2 = '';
      res2.on('data', (chunk) => out2 += chunk);
      res2.on('end', () => {
        console.log('SEARCH', res2.statusCode, out2);
      });
    });
  });
});

req.write(body);
req.end();
