import { useEffect } from 'react';

interface PageTitleOptions {
  title: string;
  subtitle?: string;
}

export const usePageTitle = ({ title, subtitle }: PageTitleOptions) => {
  useEffect(() => {
    const baseTitle = 'Expense Manager';
    let fullTitle = baseTitle;
    
    if (title) {
      fullTitle = subtitle 
        ? `${title} - ${subtitle} | ${baseTitle}`
        : `${title} | ${baseTitle}`;
    }
    
    document.title = fullTitle;
    
    // Cleanup function to reset title when component unmounts
    return () => {
      document.title = baseTitle;
    };
  }, [title, subtitle]);
};

// Helper function for common page titles
export const getPageTitle = (page: string, subtitle?: string): PageTitleOptions => {
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    transactions: 'Transactions',
    accounts: 'Accounts',
    categories: 'Categories',
    payees: 'Payees',
    reports: 'Reports',
    import: 'Import Data',
    login: 'Login',
    register: 'Sign Up',
  };
  
  return {
    title: titles[page] || page,
    subtitle,
  };
};