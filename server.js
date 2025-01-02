const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const port = 5200;

// MongoDB credentials
const MONGODB_USERNAME = 'morristoclo';
const MONGODB_PASSWORD = '7034Toclomorris208';
const MONGODB_CLUSTER = 'bn.pfbmk.mongodb.net';
const MONGODB_DATABASE = 'Wishes';

const constructMongoURI = () => {
  return `mongodb+srv://${encodeURIComponent(MONGODB_USERNAME)}:${encodeURIComponent(MONGODB_PASSWORD)}@${MONGODB_CLUSTER}/${MONGODB_DATABASE}?retryWrites=true&w=majority&appName=BN`;
};

const connectDB = async () => {
  try {
    const mongoURI = constructMongoURI();

    const conn = await mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
};

connectDB();

const wishSchema = new mongoose.Schema({
  username: String,
  wish: String,
  token: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Wish = mongoose.model('Wish', wishSchema);

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Middleware to log user access
app.use((req, res, next) => {
  const userIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const accessTime = new Date().toISOString();
  console.log(`User with IP ${userIP} accessed the site at ${accessTime}`);
  next();
});

// Serve the index.html file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Get wishes
app.get('/wishes', async (req, res) => {
  try {
    const wishes = await Wish.find();
    console.log('Wishes retrieved:', wishes);
    res.json(wishes);
  } catch (error) {
    console.error('Error reading wishes from MongoDB:', error);
    res.status(500).json({ error: 'Failed to read wishes' });
  }
});

// Add a new wish
app.post('/wishes', async (req, res) => {
  const { username, wish, token } = req.body;
  const newWish = new Wish({ username, wish, token });

  try {
    await newWish.save();
    io.emit('newWish', newWish);
    res.status(200).send('Wish added successfully.');
  } catch (error) {
    res.status(500).send('Failed to add wish.');
  }
});

// Edit an existing wish
app.put('/wishes', async (req, res) => {
  const { token, newWish } = req.body;

  try {
    const wish = await Wish.findOneAndUpdate({ token }, { wish: newWish }, { new: true });
    console.log('Wish updated:', wish);

    if (wish) {
      // Broadcast the updated wish to all connected clients
      io.emit('updateWish', { username: wish.username, wish: newWish, token });

      res.json({ success: true });
    } else {
      res.json({ success: false, message: 'Wish not found' });
    }
  } catch (error) {
    console.error('Error updating wish in MongoDB:', error);
    res.status(500).json({ error: 'Failed to update wish' });
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

io.on('connection', (socket) => {
  console.log('A user connected');
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});
