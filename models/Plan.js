const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  day: { type: String, required: true, unique: true },
  order: { type: Number, default: 0 },
  workout: { type: String, default: '' },
  diet: { type: String, default: '' }
});

module.exports = mongoose.model('Plan', planSchema);
