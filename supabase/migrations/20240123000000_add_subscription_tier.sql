-- Add subscription tier and Stripe customer ID to profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free'
CHECK (subscription_tier IN ('free', 'pro'));

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Set admin accounts to pro tier
UPDATE profiles SET subscription_tier = 'pro'
WHERE id IN (
  SELECT id FROM auth.users
  WHERE email IN ('prakashsanker1@gmail.com', 'prakash@goharbor.xyz')
);
