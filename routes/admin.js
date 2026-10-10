const router = require('express').Router();
const User = require('../models/User');
const Trainer = require('../models/Trainer');
const Plan = require('../models/Plan');
const Payment = require('../models/Payment');
const { protect, adminOnly, wrap } = require('../middleware/auth');

router.use(protect, adminOnly);

const addMonth = (d) => {
  const n = new Date(d);
  n.setMonth(n.getMonth() + 1);
  return n;
};

const nextInvoiceNo = async () => {
  const count = await Payment.countDocuments();
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

/* ---------------- STATS ---------------- */
router.get('/stats', wrap(async (req, res) => {
  const [totalMembers, paidMembers, pendingMembers, totalTrainers] = await Promise.all([
    User.countDocuments({ role: 'member' }),
    User.countDocuments({ role: 'member', status: 'Paid' }),
    User.countDocuments({ role: 'member', status: 'Pending' }),
    Trainer.countDocuments()
  ]);

  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - 5);

  const agg = await Payment.aggregate([
    { $match: { status: 'Paid', paidAt: { $gte: since } } },
    { $group: { _id: { y: { $year: '$paidAt' }, m: { $month: '$paidAt' } }, total: { $sum: '$amount' } } }
  ]);

  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push({ label: d.toLocaleString('en', { month: 'short' }), y: d.getFullYear(), m: d.getMonth() + 1, total: 0 });
  }
  agg.forEach((a) => {
    const mo = months.find((x) => x.y === a._id.y && x.m === a._id.m);
    if (mo) mo.total = a.total;
  });

  const [revAgg] = await Payment.aggregate([{ $match: { status: 'Paid' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
  const [pendAgg] = await User.aggregate([{ $match: { role: 'member', status: 'Pending' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);

  const recent = await Payment.find({ status: 'Paid' }).sort({ paidAt: -1 }).limit(5).populate('member', 'name');

  res.json({
    totalMembers, paidMembers, pendingMembers, totalTrainers,
    totalRevenue: revAgg ? revAgg.total : 0,
    pendingAmount: pendAgg ? pendAgg.total : 0,
    revenue: months,
    recent
  });
}));

/* ---------------- MEMBERS ---------------- */
router.get('/members', wrap(async (req, res) => {
  const members = await User.find({ role: 'member' }).select('-password').populate('trainer', 'name').sort({ createdAt: -1 });
  res.json(members);
}));

router.post('/members', wrap(async (req, res) => {
  const { name, email, password, phone, plan, trainer, amount, dueDate, status } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email and password are required' });
  const member = await User.create({
    name, email, password, phone, plan,
    trainer: trainer || null,
    amount: amount !== undefined && amount !== '' ? Number(amount) : undefined,
    dueDate: dueDate || undefined,
    status: status || 'Pending',
    role: 'member'
  });
  if (member.status === 'Paid') {
    await Payment.create({ member: member._id, amount: member.amount, status: 'Paid', invoiceNo: await nextInvoiceNo() });
  }
  res.status(201).json(member);
}));

router.put('/members/:id', wrap(async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, role: 'member' });
  if (!member) return res.status(404).json({ message: 'Member not found' });
  const { name, email, password, phone, plan, trainer, amount, dueDate, status } = req.body;
  if (name !== undefined) member.name = name;
  if (email !== undefined) member.email = email;
  if (phone !== undefined) member.phone = phone;
  if (plan !== undefined) member.plan = plan;
  if (trainer !== undefined) member.trainer = trainer || null;
  if (amount !== undefined && amount !== '') member.amount = Number(amount);
  if (dueDate) member.dueDate = dueDate;
  if (status) member.status = status;
  if (password) member.password = password;
  await member.save();
  res.json(member);
}));

router.delete('/members/:id', wrap(async (req, res) => {
  const member = await User.findOneAndDelete({ _id: req.params.id, role: 'member' });
  if (!member) return res.status(404).json({ message: 'Member not found' });
  await Payment.deleteMany({ member: member._id });
  res.json({ ok: true });
}));

/* ---------------- TRAINERS ---------------- */
router.get('/trainers', wrap(async (req, res) => {
  const trainers = await Trainer.find().sort({ createdAt: 1 }).lean();
  const counts = await User.aggregate([
    { $match: { role: 'member', trainer: { $ne: null } } },
    { $group: { _id: '$trainer', n: { $sum: 1 } } }
  ]);
  const map = new Map(counts.map((c) => [String(c._id), c.n]));
  res.json(trainers.map((t) => ({ ...t, members: map.get(String(t._id)) || 0 })));
}));

router.post('/trainers', wrap(async (req, res) => {
  const { name, specialty, exp } = req.body;
  res.status(201).json(await Trainer.create({ name, specialty, exp }));
}));

router.put('/trainers/:id', wrap(async (req, res) => {
  const { name, specialty, exp } = req.body;
  const t = await Trainer.findByIdAndUpdate(req.params.id, { name, specialty, exp }, { new: true, runValidators: true });
  if (!t) return res.status(404).json({ message: 'Trainer not found' });
  res.json(t);
}));

router.delete('/trainers/:id', wrap(async (req, res) => {
  await Trainer.findByIdAndDelete(req.params.id);
  await User.updateMany({ trainer: req.params.id }, { $set: { trainer: null } });
  res.json({ ok: true });
}));

/* ---------------- PAYMENTS ---------------- */
router.get('/payments', wrap(async (req, res) => {
  const filter = { role: 'member' };
  if (['Paid', 'Pending'].includes(req.query.status)) filter.status = req.query.status;
  const rows = await User.find(filter).select('name email amount dueDate status plan').sort({ dueDate: 1 });
  res.json(rows);
}));

router.get('/payments/history', wrap(async (req, res) => {
  const rows = await Payment.find().sort({ paidAt: -1 }).limit(25).populate('member', 'name');
  res.json(rows);
}));

router.post('/payments/:id/pay', wrap(async (req, res) => {
  const member = await User.findOne({ _id: req.params.id, role: 'member' });
  if (!member) return res.status(404).json({ message: 'Member not found' });
  if (member.status === 'Paid') return res.status(400).json({ message: 'Already paid' });
  member.status = 'Paid';
  member.dueDate = addMonth(member.dueDate > new Date() ? member.dueDate : new Date());
  await member.save();
  const payment = await Payment.create({ member: member._id, amount: member.amount, status: 'Paid', invoiceNo: await nextInvoiceNo() });
  res.json({ member, payment });
}));

router.post('/payments/:id/unpay', wrap(async (req, res) => {
  const member = await User.findOneAndUpdate({ _id: req.params.id, role: 'member' }, { status: 'Pending' }, { new: true });
  if (!member) return res.status(404).json({ message: 'Member not found' });
  res.json(member);
}));

/* ---------------- WEEKLY PLANS ---------------- */
router.get('/plans', wrap(async (req, res) => {
  res.json(await Plan.find().sort({ order: 1 }));
}));

router.put('/plans/:day', wrap(async (req, res) => {
  const { workout, diet } = req.body;
  const plan = await Plan.findOneAndUpdate({ day: req.params.day }, { workout, diet }, { new: true });
  if (!plan) return res.status(404).json({ message: 'Day not found' });
  res.json(plan);
}));

module.exports = router;
