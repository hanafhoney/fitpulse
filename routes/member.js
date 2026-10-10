const router = require('express').Router();
const User = require('../models/User');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const { protect, wrap } = require('../middleware/auth');

router.use(protect);

router.get('/dashboard', wrap(async (req, res) => {
  const user = await User.findById(req.user._id).select('-password').populate('trainer');
  const [plans, invoices] = await Promise.all([
    Plan.find().sort({ order: 1 }),
    Payment.find({ member: user._id }).sort({ paidAt: -1 })
  ]);
  res.json({ user, plans, invoices });
}));

router.put('/profile', wrap(async (req, res) => {
  const user = await User.findById(req.user._id);
  const { name, phone, password } = req.body;
  if (name) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (password) {
    if (String(password).length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    user.password = password;
  }
  await user.save();
  const safe = user.toObject();
  delete safe.password;
  res.json(safe);
}));

module.exports = router;
