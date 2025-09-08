import React from 'react';
type Props = { children: React.ReactNode };
export const ConversationProvider: React.FC<Props> = ({ children }) => <>{children}</>;
export default ConversationProvider;
