const mongoose = require('mongoose');

const trainerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    specialty: { type: String, required: true, trim: true },
    exp: { type: String, required: true, trim: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Trainer', trainerSchema);
