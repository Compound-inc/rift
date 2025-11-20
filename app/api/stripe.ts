import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_API_KEY as string);

export { stripe };
