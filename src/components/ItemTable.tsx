'use client';

interface ItemData {
  id: string;
  name: string;
  url: string;
  envatoId: string;
  author?: string;
  category?: string;
  latestSales: number;
  latestPrice?: number;
  lastScanned?: string;
  weeklySales: number;
  dailySales: Array<{
    date: string;
    dailySales: number;
    totalSales: number;
  }>;
}

interface ItemTableProps {
  items: ItemData[];
}

export function ItemTable({ items }: ItemTableProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatPrice = (price?: number) => {
    return price ? `$${price.toFixed(0)}` : 'N/A';
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  const getRecentDailySales = (dailySales: ItemData['dailySales']) => {
    return dailySales.slice(0, 3);
  };

  // Calculate comparison data relative to the first item (reference)
  const referenceItem = items[0];
  const getComparison = (item: ItemData, field: 'latestSales' | 'weeklySales') => {
    if (!referenceItem || item.id === referenceItem.id) return null;
    
    const referenceValue = referenceItem[field];
    const itemValue = item[field];
    const difference = itemValue - referenceValue;
    const percentage = referenceValue > 0 ? ((difference / referenceValue) * 100) : 0;
    
    return {
      difference,
      percentage,
      isPositive: difference > 0
    };
  };

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-lg">No items found. Run a scan to get started!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 sticky left-0 bg-gray-50 z-10">
                Item
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 min-w-[120px]">
                Total Sales
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 min-w-[120px]">
                Weekly Sales
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 min-w-[100px]">
                Price
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 min-w-[200px]">
                Recent Daily Sales
              </th>
              <th className="px-6 py-4 text-center text-sm font-semibold text-gray-900 min-w-[140px]">
                Last Scanned
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {items.map((item, index) => {
              const isReference = index === 0;
              const totalSalesComparison = getComparison(item, 'latestSales');
              const weeklySalesComparison = getComparison(item, 'weeklySales');
              
              return (
                <tr 
                  key={item.envatoId}
                  className={`hover:bg-gray-50 ${isReference ? 'bg-blue-50 hover:bg-blue-100 sticky top-0 z-20 shadow-sm' : ''}`}
                >
                  {/* Item Info - Sticky Column */}
                  <td className={`px-6 py-4 sticky left-0 z-10 ${isReference ? 'bg-blue-50 hover:bg-blue-100' : 'bg-white hover:bg-gray-50'}`}>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        {isReference && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            Reference
                          </span>
                        )}
                      </div>
                      {item.author && (
                        <p className="text-sm text-gray-600">by {item.author}</p>
                      )}
                      <a 
                        href={item.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 mt-1"
                      >
                        View Item →
                      </a>
                    </div>
                  </td>

                  {/* Total Sales */}
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-gray-900">
                        {formatNumber(item.latestSales)}
                      </span>
                      {totalSalesComparison && (
                        <span className={`text-xs mt-1 ${
                          totalSalesComparison.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {totalSalesComparison.isPositive ? '+' : ''}{formatNumber(totalSalesComparison.difference)}
                          ({totalSalesComparison.percentage.toFixed(1)}%)
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Weekly Sales */}
                  <td className="px-6 py-4 text-center">
                    <div className="flex flex-col items-center">
                      <span className="text-lg font-bold text-green-600">
                        +{formatNumber(item.weeklySales)}
                      </span>
                      {weeklySalesComparison && (
                        <span className={`text-xs mt-1 ${
                          weeklySalesComparison.isPositive ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {weeklySalesComparison.isPositive ? '+' : ''}{formatNumber(weeklySalesComparison.difference)}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Price */}
                  <td className="px-6 py-4 text-center">
                    <span className="font-semibold text-gray-900">
                      {formatPrice(item.latestPrice)}
                    </span>
                  </td>

                  {/* Recent Daily Sales */}
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {getRecentDailySales(item.dailySales).map((day, dayIndex) => (
                        <div key={dayIndex} className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">
                            {formatDate(day.date)}
                          </span>
                          <span className="font-medium text-green-600">
                            +{day.dailySales}
                          </span>
                        </div>
                      ))}
                      {item.dailySales.length === 0 && (
                        <span className="text-xs text-gray-500">No recent data</span>
                      )}
                    </div>
                  </td>

                  {/* Last Scanned */}
                  <td className="px-6 py-4 text-center">
                    <span className="text-sm text-gray-600">
                      {item.lastScanned ? formatDate(item.lastScanned) : 'Never'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}