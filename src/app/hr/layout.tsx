import React from 'react';

export default function HRIntelligenceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pt-24 px-4 sm:px-6 md:px-8 pb-16 max-w-7xl mx-auto w-full">
      {children}
    </div>
  );
}
