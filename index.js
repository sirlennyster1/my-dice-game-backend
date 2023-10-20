const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const cors = require('cors');
const jsonwebtoken = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

mongoose.connect(
  'mongodb+srv://ltandou:ltandou@cluster0.yxh2k1h.mongodb.net/dice?retryWrites=true&w=majority',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
);

const User = mongoose.model(
  'User',
  new mongoose.Schema({
    email: { type: String, unique: true, required: true },
    username: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    rollsLeft: { type: Number, default: 3 },
  })
);

app.post('/api/register', async (req, res) => {
  try {
    console.log(req.body);
    const user = new User(req.body);
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
    await user.save();
    const token = jsonwebtoken.sign(
      { _id: user._id, username: user.username, rollsLeft: 3 },
      'BABABABABA'
    );
    return res.status(201).send(token);
  } catch (error) {
    res.status(500).send(error);
  }
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.post('/api/login', async (req, res) => {
  try {
    const user = await User.findOne({
      email: req.body.email,
    });
    if (!user) {
      return res.status(400).send('The username does not exist');
    }
    const validPassword = await bcrypt.compare(
      req.body.password,
      user.password
    );
    if (!validPassword) {
      return res.status(400).send('Invalid password');
    }

    const token = jsonwebtoken.sign(
      {
        _id: user._id,
        email: user.email,
        rollsLeft: user.rollsLeft,
      },
      'BABABABABA'
    );
    return res.status(200).json({ token: token });
  } catch (error) {
    console.log(error);
  }
});

const verifyToken = async (req, res, next) => {
  const token = req.header('Authorization').split(' ')[1];
  if (!token) {
    return res.status(401).send('Access denied');
  }
  try {
    const verified = jsonwebtoken.verify(token, 'BABABABABA', {
      expiresIn: '1d',
    });

    const user = await User.findById(verified.user._id);
    if (!user) {
      return res.status(401).send('Access denied');
    }
    req.user = user;
    return next();
  } catch (error) {
    console.log(error);
  }
};

app.get('/api/user/rollsLeft', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    user
      ? res.status(200).send({ rollsLeft: user.rollsLeft })
      : res.status(404).send('User not found');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/api/user/rollsLeft', verifyToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findByIdAndUpdate(
      userId,
      { rollsLeft: req.body.rollsLeft },
      { new: true }
    );
    req.user = user;
    user ? res.status(200).send(user) : res.status(404).send('User not found');
  } catch (error) {
    res.status(500).send(error);
  }
});

app.post('/api/user/:userId/validateReceipt', verifyToken, async (req, res) => {
  try {
    const { receipt } = req.body;
    const validationResponse = await validateReceipt(receipt);

    if (validationResponse.valid) {
      const user = await User.findById(req.params.userId);
      user.rollsLeft += 3;
      await user.save();
      res.status(200).send(user);
    } else {
      res.status(400).send('Invalid receipt');
    }
  } catch (error) {
    res.status(500).send(error);
  }
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
