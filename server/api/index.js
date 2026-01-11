// Vercel serverless function entry point
// Express 앱을 serverless function으로 래핑
const app = require('../server.js');

// Vercel serverless function handler
module.exports = (req, res) => {
  // Express 앱이 요청을 처리하도록 전달
  return app(req, res);
};

