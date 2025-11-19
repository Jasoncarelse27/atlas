# FastSpring Product Setup Guide

## Step 1: Create One-Time Product

In the FastSpring modal, click **"Products"** (NOT Subscriptions).

### Product Details:

1. **Product Name**: `Atlas Usage Overage`
2. **Product ID**: `atlas-usage-overage` ⚠️ **MUST MATCH EXACTLY** (case-sensitive)
3. **Product Type**: One-time purchase
4. **Price**: 
   - Select "Variable Pricing" or "Custom Pricing"
   - OR set a placeholder price (e.g., $1.00) - actual price will be set per order
5. **Currency**: USD
6. **Fulfillment**: 
   - Type: Digital / None (no physical product)
   - No fulfillment needed (this is just for invoicing)

### Important Settings:

- ✅ Enable "Allow custom pricing" if available
- ✅ Enable "Variable pricing" 
- ❌ Do NOT enable recurring billing
- ❌ Do NOT set up subscription

### Save the Product

Once created, note the Product ID in FastSpring dashboard - it should be exactly: `atlas-usage-overage`

---

## Step 2: Verify Product ID

After creating, go to:
**Catalog → Products → Atlas Usage Overage**

Verify the Product ID/Path matches exactly: `atlas-usage-overage`

---

## Step 3: Test Product (Optional)

You can test that the product exists by checking FastSpring API:

```bash
# Replace with your FastSpring credentials
curl -u "YOUR_API_USERNAME:YOUR_API_PASSWORD" \
  https://api.fastspring.com/products/atlas-usage-overage
```

If product exists, you'll get product details. If not, you'll get 404.

---

## Why This Product?

The billing system creates one-time orders for overages using this product ID. When a user exceeds their included credits, the system:

1. Calculates overage amount
2. Creates FastSpring order with product `atlas-usage-overage`
3. Sets custom price = overage amount
4. Links order to user's FastSpring account
5. User receives invoice/receipt from FastSpring

---

## Troubleshooting

### "Product not found" error

- Verify Product ID is exactly `atlas-usage-overage` (no spaces, correct case)
- Check product is active/enabled in FastSpring
- Verify FastSpring API credentials are correct

### "Variable pricing not allowed"

- Some FastSpring accounts require approval for variable pricing
- Contact FastSpring support to enable custom pricing
- OR use a fixed price product and adjust via API (less ideal)

