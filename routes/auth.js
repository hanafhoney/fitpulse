const router = require('express').Router();
const User = require('../models/User');
const { signToken, protect, wrap } = require('../middleware/auth');

router.post('/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (!user || !(await user.matchPassword(password))) {
    return res.status(401).json({ message: 'Invalid email or password' });
  }
  const safe = user.toObject();
  delete safe.password;
  res.json({ token: signToken(user), user: safe });
}));

// public signup creates a member with Pending dues
router.post('/register', wrap(async (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
  const user = await User.create({ name, email, password, phone, role: 'member', status: 'Pending' });
  const safe = user.toObject();
  delete safe.password;
  res.status(201).json({ token: signToken(user), user: safe });
}));

router.get('/me', protect, (req, res) => res.json({ user: req.user }));

module.exports = router;
