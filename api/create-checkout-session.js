// /api/create-checkout-session.js
// This runs on Vercel's servers, never in the visitor's browser.
// It uses your STRIPE_SECRET_KEY (set in Vercel's Environment Variables)
// to securely create a Stripe Checkout Session, then hands back a URL
// for the browser to redirect to.

import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty.' });
    }

    // Figure out the site's own URL so Stripe knows where to send
    // the buyer back after payment succeeds or is cancelled.
    const origin =
      req.headers.origin ||
      `https://${req.headers.host}`;

    const line_items = items.map((item) => {
      const price = Number(item.price);
      if (!item.name || !price || price <= 0) {
        throw new Error('Invalid item in cart.');
      }
      return {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(price * 100), // Stripe uses cents
          product_data: {
            name: item.name,
            images: item.img ? [`${origin}/${item.img}`] : undefined,
          },
        },
      };
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items,
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
      shipping_address_collection: {
        allowed_countries: ['US'],
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: 'Unable to start checkout. Please try again.' });
  }
}
