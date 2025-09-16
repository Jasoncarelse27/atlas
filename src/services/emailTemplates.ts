export function generateWelcomeEmailHTML({ name }: { name: string }) {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Welcome to Atlas AI</title>
</head>
<body>
  <h1>Welcome to Atlas AI, ${name}!</h1>
  <p>We're excited to have you join our community of emotionally intelligent AI users.</p>
  <p>Get started by exploring your dashboard and taking your first EQ challenge.</p>
</body>
</html>`;
}

export function generateWelcomeEmailText({ name }: { name: string }) {
  return `Welcome to Atlas AI, ${name}!

We're excited to have you join our community of emotionally intelligent AI users.

Get started by exploring your dashboard and taking your first EQ challenge.

Best regards,
The Atlas AI Team`;
}

export function generateWeeklySummaryHTML({ name }: { name: string }, summaryData?: any) {
  const messageCount = summaryData?.messageCount || 0;
  const topTopic = summaryData?.topTopics?.[0] || 'General Chat';
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Your Atlas Weekly Insight</title>
</head>
<body>
  <h1>Your Atlas Weekly Insight, ${name}</h1>
  <p>Here's what happened this week:</p>
  <ul>
    <li>Messages sent: ${messageCount}</li>
    <li>Top topic: ${topTopic}</li>
  </ul>
  <p>Keep up the great work on your emotional intelligence journey!</p>
</body>
</html>`;
}

export function generateWeeklySummaryText({ name }: { name: string }, summaryData?: any) {
  const messageCount = summaryData?.messageCount || 0;
  const topTopic = summaryData?.topTopics?.[0] || 'General Chat';
  
  return `Your Atlas Weekly Insight, ${name}

Here's what happened this week:
- Messages sent: ${messageCount}
- Top topic: ${topTopic}

Keep up the great work on your emotional intelligence journey!

Best regards,
The Atlas AI Team`;
}
