import React from 'react';
import { StorefrontNavbar } from './StorefrontNavbar';
import { StorefrontFooter } from './StorefrontFooter';

interface StorefrontLayoutProps {
  children: React.ReactNode;
}

export const StorefrontLayout: React.FC<StorefrontLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#09090b] text-zinc-950 dark:text-zinc-50 flex flex-col font-sans selection:bg-zinc-950 selection:text-white dark:selection:bg-white dark:selection:text-zinc-950 antialiased transition-colors duration-300">
      <StorefrontNavbar />
      <main className="flex-1 w-full">{children}</main>
      <StorefrontFooter />
    </div>
  );
};
