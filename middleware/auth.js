const jwt = require('jsonwebtoken');
const User = require('../models/User');

const SECRET = () => process.env.JWT_SECRET || 'fitpulse-dev-secret-change-me';

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, SECRET(), { expiresIn: '7d' });

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const decoded = jwt.verify(token, SECRET());
    const user = await User.findById(decoded.id).select('-password');
    if (!user) return res.status(401).json({ message: 'User no longer exists' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ message: 'Session expired, please login again' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  res.status(403).json({ message: 'Admin access only' });
};

// wraps async route handlers so errors become JSON responses
const wrap = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    if (e.code === 11000) return res.status(400).json({ message: 'That email is already registered' });
    if (e.name === 'ValidationError') return res.status(400).json({ message: e.message });
    res.status(500).json({ message: e.message || 'Server error' });
  });

module.exports = { signToken, protect, adminOnly, wrap };
