export interface EnvatoItemData {
  id: string;
  name: string;
  description: string;
  site: string;
  classification: string;
  price_cents: number;
  number_of_sales: number;
  author_username: string;
  author_url: string;
  author_image: string;
  summary: string;
  rating: {
    rating: number;
    count: number;
  };
  created_at: string;
  updated_at: string;
  published_at: string;
  trending: boolean;
  previews: {
    icon_preview: {
      icon_url: string;
    };
    live_site: {
      url: string;
    };
  };
  attributes: Array<{
    name: string;
    value: string;
  }>;
  key_features: string[];
  tags: string[];
}

export interface ScrapedItemData {
  salesCount: number;
  price?: number;
  author?: string;
  category?: string;
}

export class EnvatoApiClient {
  private baseUrl = 'https://api.envato.com/v3/market/catalog/item';
  private headers: HeadersInit;

  constructor(apiToken?: string) {
    this.headers = {
      'User-Agent': 'ThemeForest Sales Tracker',
    };

    if (apiToken) {
      this.headers['Authorization'] = `Bearer ${apiToken}`;
    }
  }

  async getItem(itemId: string): Promise<EnvatoItemData> {
    const url = `${this.baseUrl}?id=${itemId}`;
    
    try {
      console.log(`Fetching item data for ID: ${itemId}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.headers,
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = response.headers.get('Retry-After');
          throw new Error(`Rate limit exceeded. ${retryAfter ? `Retry after ${retryAfter} seconds` : 'Please wait before retrying'}`);
        }
        
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✓ Successfully fetched data for item: ${data.name}`);
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      if (errorName === 'TimeoutError') {
        console.error(`✗ Timeout fetching item ${itemId}`);
        throw new Error(`Request timeout for item ${itemId}`);
      }
      
      console.error(`✗ Error fetching item ${itemId}:`, errorMessage);
      throw error instanceof Error ? error : new Error(errorMessage);
    }
  }

  async scrapeItem(itemId: string): Promise<ScrapedItemData> {
    const itemData = await this.getItem(itemId);
    
    return {
      salesCount: itemData.number_of_sales,
      price: itemData.price_cents / 100, // Convert cents to dollars
      author: itemData.author_username,
      category: itemData.classification || itemData.site,
    };
  }
}