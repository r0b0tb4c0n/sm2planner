require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const port = process.env.PORT || 3000;

// Discord webhook URL - set via environment variable
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// MIME types
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

// Simple rate limiting
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 3; // 3 requests per minute per IP

function isRateLimited(ip) {
    const now = Date.now();
    const userRequests = rateLimiter.get(ip) || [];
    
    // Clean old requests
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
    
    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return true;
    }
    
    // Add current request
    recentRequests.push(now);
    rateLimiter.set(ip, recentRequests);
    return false;
}

async function handleIssueReport(req, res) {
    const clientIP = req.connection.remoteAddress || req.socket.remoteAddress;
    
    // Rate limiting
    if (isRateLimited(clientIP)) {
        res.writeHead(429, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }));
        return;
    }
    
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
        // Limit body size to prevent abuse
        if (body.length > 10000) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Request too large' }));
            return;
        }
    });
    
    req.on('end', async () => {
        try {
            const data = JSON.parse(body);
            
            // Validate required fields
            if (!data.description || data.description.trim().length === 0) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Description is required' }));
                return;
            }
            
            // Sanitize and limit description length
            const description = data.description.trim().substring(0, 1000);
            const contactName = (data.contactName || '').trim().substring(0, 100);
            const contactPlatform = (data.contactPlatform || '').trim().substring(0, 100);
            const buildContext = (data.buildContext || '').trim().substring(0, 500);
            
            // Create Discord embed
            const embed = {
                title: '🐛 Issue Report',
                color: 0x8b7355,
                fields: [
                    {
                        name: 'Issue Description',
                        value: description,
                        inline: false
                    }
                ],
                timestamp: new Date().toISOString(),
                footer: {
                    text: 'SM2 Talent Calculator'
                }
            };
            
            // Add contact info if provided
            if (contactName || contactPlatform) {
                let contactInfo = '';
                if (contactName) contactInfo += `Name: ${contactName}`;
                if (contactPlatform) {
                    if (contactInfo) contactInfo += '\n';
                    contactInfo += `Platform: ${contactPlatform}`;
                }
                embed.fields.push({
                    name: 'Contact Information',
                    value: contactInfo,
                    inline: false
                });
            }
            
            // Add build context if provided
            if (buildContext) {
                embed.fields.push({
                    name: 'Build Context',
                    value: buildContext,
                    inline: false
                });
            }
            
            // Send to Discord (if webhook URL is configured)
            if (!DISCORD_WEBHOOK_URL) {
                throw new Error('Issue reporting is not configured on this server');
            }
            
            const response = await fetch(DISCORD_WEBHOOK_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ embeds: [embed] })
            });
            
            if (!response.ok) {
                throw new Error(`Discord API error: ${response.status}`);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
            
        } catch (error) {
            console.error('Issue report error:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Failed to submit report' }));
        }
    });
}

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Handle API endpoints
  if (req.method === 'POST' && req.url === '/api/report-issue') {
    handleIssueReport(req, res);
    return;
  }
  
  // Parse URL and remove query string for file path
  let filePath = req.url.split('?')[0];
  
  // Default to index.html for root and directory requests
  if (filePath === '/' || filePath.endsWith('/')) {
    filePath = '/index.html';
  }
  
  // Security: prevent directory traversal
  filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
  filePath = path.join(__dirname, filePath);
  
  // Get file extension
  const extname = String(path.extname(filePath)).toLowerCase();
  const mimeType = mimeTypes[extname] || 'application/octet-stream';
  
  // Check if file exists
  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      // File not found - serve index.html for SPA routing
      if (req.url !== '/index.html') {
        const indexPath = path.join(__dirname, 'index.html');
        fs.readFile(indexPath, (error, content) => {
          if (error) {
            res.writeHead(500);
            res.end('Server Error');
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(content, 'utf-8');
          }
        });
      } else {
        res.writeHead(404);
        res.end('File Not Found');
      }
      return;
    }
    
    // Serve the file
    fs.readFile(filePath, (error, content) => {
      if (error) {
        if (error.code === 'ENOENT') {
          res.writeHead(404);
          res.end('File Not Found');
        } else {
          res.writeHead(500);
          res.end('Server Error: ' + error.code);
        }
      } else {
        res.writeHead(200, { 
          'Content-Type': mimeType,
          'Cache-Control': 'no-cache'
        });
        res.end(content, 'utf-8');
      }
    });
  });
});

server.listen(port, () => {
  console.log(`Space Marine 2 Talent Calculator server running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
}); 