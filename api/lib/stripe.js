'use strict';
const Stripe = require('stripe');

let _client;

function getStripe() {
  if (!_client) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY must be set.');
    _client = new Stripe(key);
  }
  return _client;
}

module.exports = { getStripe };
