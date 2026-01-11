// Vercel serverless function entry point
// 모든 요청을 Express 앱으로 라우팅
const path = require('path');

// server.js의 경로를 절대 경로로 설정
const serverPath = path.join(__dirname, '..', 'server.js');
const app = require(serverPath);

// Vercel serverless function handler
// Express 앱을 직접 export하면 Vercel이 자동으로 handler로 인식
module.exports = app;

