// Vercel serverless function — runs on the server, never in the browser.
// Deploy this file as-is: Vercel automatically turns anything in /api into
// a serverless endpoint at /api/create-checkout-session.
//
// Setup (one-time):
//   1. Create a free Stripe account at https://dashboard.stripe.com/register
//   2. Copy your Secret key (Developers -> API keys -> Secret key).
//      It starts with "sk_live_..." (or "sk_test_..." while testing).
//   3. In your Vercel project: Settings -> Environment Variables -> add
//        STRIPE_SECRET_KEY = sk_live_xxxxxxxx
//      Redeploy after adding it.
//
// That's the whole setup. The secret key never touches the browser — the
// frontend only ever receives the Checkout URL this function returns.

import Stripe from "stripe";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.STRIPE_SECRET_KEY) {
    return res.status(500).json({
      error:
        "STRIPE_SECRET_KEY is not set. Add it in your Vercel project's Environment Variables and redeploy.",
    });
  }

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2024-06-20",
    });

    const { amount, currency = "usd", donorName = "", donorEmail = "" } = req.body || {};
    const amountNumber = Number(amount);

    if (!amountNumber || amountNumber <= 0) {
      return res.status(400).json({ error: "Invalid donation amount." });
    }

    const allowedCurrencies = ["usd", "kes", "gbp", "eur"];
    const safeCurrency = allowedCurrencies.includes(String(currency).toLowerCase())
      ? String(currency).toLowerCase()
      : "usd";

    const origin =
      req.headers.origin || `https://${req.headers.host}` || "http://localhost:5173";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: safeCurrency,
            product_data: {
              name: "Donation to the Bwatesia Mochenwa Foundation",
            },
            unit_amount: Math.round(amountNumber * 100), // Stripe uses the smallest currency unit
          },
          quantity: 1,
        },
      ],
      customer_email: donorEmail || undefined,
      metadata: { donorName },
      success_url: `${origin}/?payment=success`,
      cancel_url: `${origin}/?payment=cancelled`,
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error("Stripe checkout session error:", err);
    return res.status(500).json({ error: "Unable to start checkout session." });
  }
}
