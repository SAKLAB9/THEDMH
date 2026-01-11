// Vercel serverless function entry point
// 모든 요청을 Express 앱으로 라우팅
const app = require('../server.js');

// Vercel serverless function handler
module.exports = async (req, res) => {
  // Express 앱이 요청을 처리하도록 전달
  return app(req, res);
};

