// Vercel serverless function entry point
// 모든 요청을 Express 앱으로 라우팅
const express = require('express');
const cors = require('cors');
const path = require('path');

// server.js를 require하여 Express 앱 가져오기
// 상대 경로로 require (Vercel에서 작동)
let app;
try {
  app = require('../server.js');
} catch (error) {
  // 절대 경로로 시도
  const serverPath = path.resolve(__dirname, '..', 'server.js');
  app = require(serverPath);
}

// Vercel serverless function handler
// Express 앱을 직접 export
module.exports = app;

