# Atlas Analytics Dashboard Setup Guide

## 🎯 Overview
This guide helps you set up a comprehensive analytics dashboard in Supabase to track feature usage, upgrade funnels, and user behavior patterns.

## 📊 Dashboard Queries

### Step 1: Create Saved Queries in Supabase
1. Open your Supabase project dashboard
2. Go to **SQL Editor** → **New Query**
3. Copy and paste each query from `supabase/analytics/queries.sql`
4. Click **Save** and give each query a descriptive name:

| Query Name | Purpose |
|------------|---------|
| **Feature Attempts by Tier** | Shows which features are used most by each tier |
| **Free Users Upgrade Prompts** | Tracks how often Free users hit upgrade walls |
| **Upgrade Conversion Funnel** | Measures conversion rates after upgrade prompts |
| **Locked vs Unlocked Usage** | Compares blocked vs successful feature attempts |
| **Daily Feature Attempts Trend** | Shows usage patterns over time |
| **Feature Usage by User Segment** | Analyzes usage by new/recent/established users |
| **Hourly Feature Usage Pattern** | Shows peak usage hours |
| **Top Users by Feature Attempts** | Identifies power users |
| **Feature Attempt Success Rates** | Overall success rates by feature |
| **Upgrade Intent Tracking** | Tracks users who use features after seeing upgrade prompts |

### Step 2: Create Dashboard Views
1. In Supabase, go to **Table Editor** → **feature_attempts**
2. Click **Add to Dashboard** for key queries
3. Create a new dashboard called **"Atlas Feature Analytics"**

### Step 3: Dashboard Layout
Organize your dashboard with these sections:

#### 📈 **Top Row - Overview**
- Feature Attempts by Tier (Table)
- Feature Attempt Success Rates (Bar Chart)

#### 📊 **Middle Row - Conversion Funnel**
- Free Users Upgrade Prompts (Line Chart)
- Upgrade Conversion Funnel (Bar Chart)
- Locked vs Unlocked Usage (Stacked Bar)

#### 📅 **Bottom Row - Trends**
- Daily Feature Attempts Trend (Time Series)
- Hourly Feature Usage Pattern (Line Chart)
- Top Users by Feature Attempts (Table)

## 🎯 Key Metrics to Monitor

### **Conversion Metrics**
- **Upgrade Prompt Rate**: % of Free users who see upgrade prompts
- **Conversion Rate**: % of users who upgrade after seeing prompts
- **Feature Success Rate**: % of successful vs blocked attempts

### **Usage Patterns**
- **Peak Hours**: When users are most active
- **Feature Popularity**: Which features drive the most upgrade prompts
- **User Segments**: How new vs established users behave

### **Revenue Indicators**
- **High-Intent Users**: Users with many blocked attempts
- **Feature Gaps**: Features with low success rates
- **Upgrade Timing**: When users are most likely to convert

## 🔍 How to Use the Data

### **For Product Decisions**
- **Feature Prioritization**: Focus on features with high blocked attempt rates
- **Pricing Strategy**: Adjust based on conversion rates by feature
- **UX Improvements**: Identify friction points in the upgrade flow

### **For Marketing**
- **Target High-Intent Users**: Users with 5+ blocked attempts
- **Peak Time Campaigns**: Run upgrade campaigns during high-usage hours
- **Feature-Focused Messaging**: Highlight features with high blocked rates

### **For Engineering**
- **Performance Monitoring**: Track success rates for each feature
- **Bug Detection**: Identify features with unexpected failure rates
- **Usage Optimization**: Optimize features with high usage patterns

## 📱 Mobile Considerations

The analytics also track mobile vs desktop usage patterns. Look for:
- **Mobile Peak Hours**: Different from desktop patterns
- **Mobile Feature Preferences**: Which features work better on mobile
- **Mobile Conversion Rates**: Often different from desktop

## 🚀 Advanced Analytics

### **Custom Metrics**
Create additional queries for:
- **Retention Analysis**: Users who continue using after upgrade
- **Feature Adoption**: Time from signup to first feature use
- **Churn Prediction**: Users with declining feature usage

### **A/B Testing**
Use the data to:
- **Test Upgrade Prompts**: Different messaging for different features
- **Feature Rollout**: Gradual feature releases with analytics
- **Pricing Experiments**: Different upgrade flows for different segments

## 🔧 Maintenance

### **Weekly Reviews**
- Check conversion rates by feature
- Monitor new user behavior patterns
- Identify any technical issues (unexpected failure rates)

### **Monthly Analysis**
- Review upgrade funnel performance
- Analyze user segment behavior changes
- Update feature prioritization based on data

### **Quarterly Planning**
- Use data to inform product roadmap
- Adjust pricing strategy based on conversion data
- Plan feature development based on demand signals

## 📞 Support

If you need help setting up the dashboard or interpreting the data:
1. Check the query comments in `supabase/analytics/queries.sql`
2. Review the feature logging in `src/services/featureService.ts`
3. Test the analytics with the DevTierSwitcher component

---

**🎯 Goal**: Use this dashboard to make data-driven decisions about feature development, pricing, and user experience to maximize Atlas's growth and user satisfaction.
