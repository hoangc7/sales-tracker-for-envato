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

interface ItemCardProps {
  item: ItemData;
}

export function ItemCard({ item }: ItemCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatPrice = (price?: number) => {
    return price ? `$${price.toFixed(2)}` : 'N/A';
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-900 mb-1">{item.name}</h3>
          {item.author && (
            <p className="text-sm text-gray-600">by {item.author}</p>
          )}
          {item.category && (
            <p className="text-xs text-gray-500 mt-1">{item.category}</p>
          )}
        </div>
        <a 
          href={item.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 text-sm"
        >
          View Item →
        </a>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-green-50 rounded-lg p-3">
          <p className="text-sm font-medium text-green-600">Total Sales</p>
          <p className="text-2xl font-bold text-green-900">{item.latestSales.toLocaleString()}</p>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-sm font-medium text-blue-600">Weekly Sales</p>
          <p className="text-2xl font-bold text-blue-900">{item.weeklySales.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Price</p>
          <p className="font-semibold">{formatPrice(item.latestPrice)}</p>
        </div>
        
        <div>
          <p className="text-sm text-gray-600">Last Scanned</p>
          <p className="font-semibold text-sm">
            {item.lastScanned ? formatDate(item.lastScanned) : 'Never'}
          </p>
        </div>
      </div>

      {item.dailySales.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Recent Daily Sales</p>
          <div className="space-y-1">
            {item.dailySales.slice(0, 3).map((day, index) => (
              <div key={index} className="flex justify-between text-sm">
                <span className="text-gray-600">{formatDate(day.date)}</span>
                <span className="font-medium text-green-600">+{day.dailySales}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}