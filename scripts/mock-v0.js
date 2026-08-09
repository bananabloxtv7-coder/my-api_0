const http = require('http');

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    console.log(`\n--- REQUEST ---`);
    console.log(`${req.method} ${req.url}`);
    console.log(req.headers);
    console.log(body);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ id: "chat_123", status: "success" }));
  });
});

server.listen(4000, () => {
  console.log("Mock server running on port 4000");
  
  // Try to use fetch directly if v0-sdk fails
  fetch('http://localhost:4000/v1/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ initialMessage: "Hello" })
  }).then(res => {
    process.exit(0);
  });
});
