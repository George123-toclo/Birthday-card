const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto-js');

const app = express();
const port = 5500;
const wishesFile = path.join(__dirname, 'wishes.json');
const secretKey = '12345'; // Replace with a secure key

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Middleware to log user access
app.use((req, res, next) => {
  const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const accessTime = new Date().toISOString();
  console.log(`User with IP ${userIP} accessed the site at ${accessTime}`);
  next();
});

// Initialize the wishes file if it doesn't exist or is empty
if (!fs.existsSync(wishesFile) || fs.readFileSync(wishesFile, 'utf8').trim() === '') {
  const initialData = crypto.AES.encrypt(JSON.stringify([]), secretKey).toString();
  fs.writeFileSync(wishesFile, initialData);
}

// Helper function to write to the wishes file
const writeToFile = (data) => {
  const encryptedData = crypto.AES.encrypt(JSON.stringify(data), secretKey).toString();
  fs.writeFileSync(wishesFile, encryptedData);
};

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get wishes
app.get('/wishes', (req, res) => {
  try {
    const encryptedData = fs.readFileSync(wishesFile, 'utf8');
    if (!encryptedData.trim()) {
      return res.json([]);
    }
    const decryptedBytes = crypto.AES.decrypt(encryptedData, secretKey);
    const decryptedData = decryptedBytes.toString(crypto.enc.Utf8);
    const wishes = JSON.parse(decryptedData);
    res.json(wishes);
  } catch (error) {
    console.error('Error reading wishes file:', error);
    res.status(500).json({ error: 'Failed to read wishes file' });
  }
});

// Add a new wish
app.post('/wishes', (req, res) => {
  const { username, wish, token } = req.body;
  let wishes = [];

  try {
    const encryptedData = fs.readFileSync(wishesFile, 'utf8');
    if (encryptedData.trim()) {
      const decryptedBytes = crypto.AES.decrypt(encryptedData, secretKey);
      const decryptedData = decryptedBytes.toString(crypto.enc.Utf8);
      wishes = JSON.parse(decryptedData);
    }

    wishes.push({ username, wish, token });
    writeToFile(wishes);

    res.json({ success: true });
  } catch (error) {
    console.error('Error writing to wishes file:', error);
    res.status(500).json({ error: 'Failed to add wish' });
  }
});

// Edit an existing wish
app.put('/wishes', (req, res) => {
  const { token, newWish } = req.body;
  let wishes = [];

  try {
    const encryptedData = fs.readFileSync(wishesFile, 'utf8');
    if (encryptedData.trim()) {
      const decryptedBytes = crypto.AES.decrypt(encryptedData, secretKey);
      const decryptedData = decryptedBytes.toString(crypto.enc.Utf8);
      wishes = JSON.parse(decryptedData);
    }

    const wishIndex = wishes.findIndex(wish => wish.token === token);
    if (wishIndex !== -1) {
      wishes[wishIndex].wish = newWish;
      writeToFile(wishes);
      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Wish not found' });
    }
  } catch (error) {
    console.error('Error updating wishes file:', error);
    res.status(500).json({ error: 'Failed to update wish' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
