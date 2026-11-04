import React from 'react';
import { CuttingListPage, computeCuttingMetrics, type CuttingMetrics } from './CuttingListPage';

export { computeCuttingMetrics, type CuttingMetrics };
export const CuttingTablePage: React.FC = () => {
  return <CuttingListPage />;
};

export default CuttingTablePage;

