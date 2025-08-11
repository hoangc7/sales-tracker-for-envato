import { EnvatoApiClient } from './envato-api';
import { DatabaseService } from './database';
import { TRACKED_ITEMS } from '../config/items';

export class ScannerService {
  private apiClient: EnvatoApiClient;
  private db: DatabaseService;

  constructor() {
    this.apiClient = new EnvatoApiClient(process.env.ENVATO_API_TOKEN);
    this.db = new DatabaseService();
  }

  async initializeDatabase() {
    console.log('Initializing database with tracked items...');
    
    for (const itemConfig of TRACKED_ITEMS) {
      const existingItem = await this.db.getItem(itemConfig.url);
      
      if (!existingItem) {
        await this.db.createItem({
          name: itemConfig.name,
          url: itemConfig.url,
          envatoId: itemConfig.envatoId,
        });
        console.log(`Added item: ${itemConfig.name}`);
      }
    }
  }

  async scanAllItems() {
    console.log('Starting scan of all items...');
    
    const items = await this.db.getAllItems();
    
    for (const item of items) {
      try {
        console.log(`Scanning ${item.name} (ID: ${item.envatoId})...`);
        
        const scrapedData = await this.apiClient.scrapeItem(item.envatoId);
        
        await this.db.createSalesRecord({
          itemId: item.id,
          salesCount: scrapedData.salesCount,
          price: scrapedData.price,
        });
        
        console.log(`✓ ${item.name}: ${scrapedData.salesCount} sales ($${scrapedData.price})`);
        
        // Short delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`✗ Error scanning ${item.name}:`, error);
      }
    }
    
    console.log('Scan completed!');
  }
}