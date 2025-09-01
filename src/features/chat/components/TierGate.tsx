import React from 'react';
import SubscriptionGate from './SubscriptionGate';

interface TierGateProps {
  subscription: unknown;
  messageCount: number;
  maxFreeMessages: number;
  onUpgrade?: () => void;
  children: React.ReactNode;
}

const TierGate: React.FC<TierGateProps> = ({ subscription, messageCount, maxFreeMessages, onUpgrade, children }) => (
  <SubscriptionGate
    subscription={subscription as any}
    messageCount={messageCount}
    maxFreeMessages={maxFreeMessages}
    onUpgrade={onUpgrade || (() => {})}
  >
    {children}
  </SubscriptionGate>
);

export default TierGate;


