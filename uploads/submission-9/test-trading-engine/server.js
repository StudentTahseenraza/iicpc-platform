const express = require('express');

const app = express();

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'Trading engine healthy'
  });
});

app.get('/', (req, res) => {
  res.send('IICPC Trading Engine Running');
});

app.listen(8080, () => {
  console.log('Server running on port 8080');
});