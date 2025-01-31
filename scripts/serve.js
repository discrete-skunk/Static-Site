const http = require('http');
const fs = require('fs-extra');
const path = require('path');

const PORT = 3000;

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif'
};

const server = http.createServer(async (req, res) => {
    try {
        // Convert URL to file path, defaulting to index.html for root
        let filePath = path.join('dist', req.url === '/' ? 'index.html' : req.url);
        
        // If path doesn't have extension, assume it's a route and serve index.html
        if (!path.extname(filePath)) {
            filePath += '.html';
        }

        // Check if file exists
        if (await fs.pathExists(filePath)) {
            const ext = path.extname(filePath);
            res.setHeader('Content-Type', MIME_TYPES[ext] || 'text/plain');
            const content = await fs.readFile(filePath);
            res.end(content);
        } else {
            res.writeHead(404);
            res.end('File not found');
        }
    } catch (err) {
        console.error(err);
        res.writeHead(500);
        res.end('Server error');
    }
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
}); 