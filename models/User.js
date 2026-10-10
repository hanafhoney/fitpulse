const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    phone: { type: String, default: '' },
    plan: { type: String, default: 'Monthly Pass' },
    trainer: { type: mongoose.Schema.Types.ObjectId, ref: 'Trainer', default: null },
    amount: { type: Number, default: 5000 },
    dueDate: { type: Date, default: () => new Date(Date.now() + 30 * 864e5) },
    status: { type: String, enum: ['Paid', 'Pending'], default: 'Pending' },
    joinedAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.matchPassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

module.exports = mongoose.model('User', userSchema);
