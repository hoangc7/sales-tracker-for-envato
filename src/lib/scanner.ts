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
    
    // Get all existing items at once
    const existingItems = await this.db.prisma.item.findMany({
      select: { url: true }
    });
    const existingUrls = new Set(existingItems.map(item => item.url));
    
    // Find items that need to be created
    const itemsToCreate = TRACKED_ITEMS.filter(
      itemConfig => !existingUrls.has(itemConfig.url)
    );
    
    // Batch create new items
    if (itemsToCreate.length > 0) {
      await this.db.prisma.item.createMany({
        data: itemsToCreate.map(itemConfig => ({
          name: itemConfig.name,
          url: itemConfig.url,
          envatoId: itemConfig.envatoId,
        })),
        skipDuplicates: true,
      });
      
      console.log(`Added ${itemsToCreate.length} new items:`, itemsToCreate.map(i => i.name));
    } else {
      console.log('All items already exist in database');
    }
  }

  async scanAllItems() {
    console.log('Starting scan of all items...');
    
    const items = await this.db.getAllItemsForScan();
    
    // Process items in parallel with controlled concurrency
    const BATCH_SIZE = 3; // Process 3 items at a time to respect rate limits
    const results = [];
    
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      
      console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(items.length/BATCH_SIZE)} (${batch.length} items)...`);
      
      const batchPromises = batch.map(async (item) => {
        try {
          console.log(`Scanning item ID: ${item.envatoId}...`);
          
          const scrapedData = await this.apiClient.scrapeItem(item.envatoId);
          
          await this.db.createSalesRecord({
            itemId: item.id,
            salesCount: scrapedData.salesCount,
            price: scrapedData.price,
          });
          
          console.log(`✓ ID ${item.envatoId}: ${scrapedData.salesCount} sales ($${scrapedData.price})`);
          return { success: true, item: item.envatoId };
          
        } catch (error) {
          console.error(`✗ Error scanning ID ${item.envatoId}:`, error);
          return { success: false, item: item.envatoId, error };
        }
      });
      
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Small delay between batches to be extra respectful to the API
      if (i + BATCH_SIZE < items.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`Scan completed! ✓ ${successful} successful, ✗ ${failed} failed`);
  }
}