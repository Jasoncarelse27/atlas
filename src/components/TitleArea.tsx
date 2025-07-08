import React, { forwardRef } from 'react';

const TitleArea = forwardRef<HTMLDivElement>((props, ref) => {
  return (
    <div ref={ref} className="text-center mb-4 sm:mb-6 px-4">
      <h1 className="text-4xl font-bold text-blue-600 mb-2">Atlas</h1>
      <p className="text-text/70 mt-2 mb-4 text-sm sm:text-base lg:text-lg">Your Intelligent Assistant</p>
    </div>
  );
});

TitleArea.displayName = 'TitleArea';

export default TitleArea;