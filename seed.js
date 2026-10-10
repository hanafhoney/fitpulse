const User = require('./models/User');
const Trainer = require('./models/Trainer');
const Plan = require('./models/Plan');
const Payment = require('./models/Payment');

const DEFAULT_PLANS = [
  { day: 'Monday', workout: 'Chest & Triceps Heavy', diet: 'High Protein - 4 Eggs, Chicken Breast, Oats' },
  { day: 'Tuesday', workout: 'Back & Biceps Hypertrophy', diet: 'Fish, Rice, Protein Shake, Almonds' },
  { day: 'Wednesday', workout: 'Legs & Core Explosive', diet: 'Brown Rice, Beef Steak, Salad' },
  { day: 'Thursday', workout: 'Shoulders & Abs', diet: 'Chicken Salad, Eggs, Sweet Potato' },
  { day: 'Friday', workout: 'Full Body Functional HIIT', diet: 'Low Carb - Green Vegetables, Fish' },
  { day: 'Saturday', workout: 'Active Recovery & Cardio', diet: 'Fruits, Oats, Protein Shake' },
  { day: 'Sunday', workout: 'Rest Day', diet: 'Balanced Maintenance Diet' }
];

const monthsAgo = (n, day = 5) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  d.setDate(day);
  return d;
};

module.exports = async function seed() {
  // 1) Admin account (always guaranteed to exist)
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@fitpulse.com').toLowerCase();
  if (!(await User.findOne({ role: 'admin' }))) {
    await User.create({
      name: 'FitPulse Admin',
      email: adminEmail,
      password: process.env.ADMIN_PASSWORD || 'admin123',
      role: 'admin',
      status: 'Paid'
    });
    console.log(`Admin created: ${adminEmail}`);
  }

  // 2) Weekly plans
  if ((await Plan.countDocuments()) === 0) {
    await Plan.insertMany(DEFAULT_PLANS.map((p, i) => ({ ...p, order: i })));
    console.log('Default weekly plans created');
  }

  // 3) Demo data (only on a completely fresh database). Set SEED_DEMO=false to skip.
  if (process.env.SEED_DEMO === 'false') return;
  if ((await Trainer.countDocuments()) > 0 || (await User.countDocuments({ role: 'member' })) > 0) return;

  const [vikram, sarah] = await Trainer.insertMany([
    { name: 'Captain Vikram', specialty: 'Bodybuilding & Strength', exp: '8 Years' },
    { name: 'Sarah Jenkins', specialty: 'CrossFit & Cardio', exp: '5 Years' }
  ]);

  const hamza = await User.create({
    name: 'Hamza Ahmed', email: 'hamza@fitpulse.com', password: 'member123', phone: '0300-1111111',
    plan: 'VIP Monthly Pass', trainer: vikram._id, amount: 5000, status: 'Paid',
    dueDate: new Date(Date.now() + 20 * 864e5), joinedAt: monthsAgo(5)
  });
  const bilal = await User.create({
    name: 'Bilal Saeed', email: 'bilal@fitpulse.com', password: 'member123', phone: '0300-2222222',
    plan: 'Quarterly Pass', trainer: sarah._id, amount: 13000, status: 'Pending',
    dueDate: new Date(Date.now() - 10 * 864e5), joinedAt: monthsAgo(5)
  });
  const usman = await User.create({
    name: 'Usman Tariq', email: 'usman@fitpulse.com', password: 'member123', phone: '0300-3333333',
    plan: 'Monthly Pass', trainer: vikram._id, amount: 5000, status: 'Pending',
    dueDate: new Date(Date.now() - 13 * 864e5), joinedAt: monthsAgo(4)
  });

  // 4) Payment history so the revenue chart has data
  const history = [];
  const add = (member, n) => history.push({ member, amount: member.amount, paidAt: monthsAgo(n) });
  for (let n = 0; n <= 5; n++) add(hamza, n);
  for (let n = 2; n <= 5; n++) if (n % 3 === 2) add(bilal, n);
  for (let n = 3; n <= 4; n++) add(usman, n);
  history.sort((a, b) => a.paidAt - b.paidAt);

  let i = 1;
  const year = new Date().getFullYear();
  await Payment.insertMany(
    history.map((h) => ({
      member: h.member._id, amount: h.amount, status: 'Paid', paidAt: h.paidAt,
      invoiceNo: `INV-${h.paidAt.getFullYear() || year}-${String(i++).padStart(4, '0')}`
    }))
  );
  console.log('Demo trainers, members and payments created');
};
