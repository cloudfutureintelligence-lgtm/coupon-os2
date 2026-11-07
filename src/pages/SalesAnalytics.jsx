import React from 'react';
import { useApp } from '../context/AppContext';
import { SalesAnalyticsPanel } from '../components/SalesAnalyticsPanel';

export const SalesAnalytics = () => {
  const { currentUser } = useApp();
  if (!currentUser) return null;

  return (
    <div>
      <div className="page-header-row">
        <div>
          <h1 className="page-title-main">Sales Analytics</h1>
          <p className="page-subtitle">Full financial breakdown across all sites, profiles and date ranges</p>
        </div>
      </div>

      {/* Print/Export CSV buttons are inside SalesAnalyticsPanel */}
      <SalesAnalyticsPanel showTransactions={false} />
    </div>
  );
};
