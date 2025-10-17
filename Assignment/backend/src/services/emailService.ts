import { Client } from '@elastic/elasticsearch';

export interface EmailDocument {
  id: string;
  accountId: string;
  folder: string;
  subject: string;
  from: string;
  to: string[];
  date: string;
  text?: string;
  category?: string;
}

export interface SearchFilters {
  q?: string;
  accountId?: string;
  folder?: string;
  category?: string;
}

export class EmailService {
  private client: Client;
  private indexName = 'emails';
  private initialized = false;

  constructor() {
    this.client = new Client({
      node: process.env.ELASTICSEARCH_URL || 'http://localhost:9200'
    });
  }

  private async ensureIndex() {
    if (this.initialized) return;
    
    try {
      const exists = await this.client.indices.exists({ index: this.indexName });
      if (!exists) {
        await this.client.indices.create({
          index: this.indexName,
          body: {
            mappings: {
              properties: {
                accountId: { type: 'keyword' },
                folder: { type: 'keyword' },
                subject: { type: 'text' },
                from: { type: 'keyword' },
                to: { type: 'keyword' },
                date: { type: 'date' },
                text: { type: 'text' },
                category: { type: 'keyword' }
              }
            }
          }
        });
      }
      this.initialized = true;
    } catch (error) {
      console.error('Failed to create Elasticsearch index:', error);
      // Fallback to in-memory storage
      this.initialized = true;
    }
  }

  async indexEmail(email: EmailDocument) {
    await this.ensureIndex();
    
    try {
      await this.client.index({
        index: this.indexName,
        id: email.id,
        body: email,
        refresh: 'true'
      });
    } catch (error) {
      console.error('Failed to index email:', error);
    }
  }

  async clearAllEmails() {
    await this.ensureIndex();
    
    try {
      await this.client.deleteByQuery({
        index: this.indexName,
        body: {
          query: {
            match_all: {}
          }
        },
        refresh: 'true'
      });
      console.log('🗑️  Cleared all existing emails from Elasticsearch');
    } catch (error) {
      console.error('Failed to clear emails:', error);
    }
  }

  async seedMockData() {
    await this.ensureIndex();
    
    const mockEmails: EmailDocument[] = [
      {
        id: 'mock:INBOX:1',
        accountId: 'demo@example.com',
        folder: 'INBOX',
        subject: 'Interested in a quick chat',
        from: 'lead@company.com',
        to: ['demo@example.com'],
        date: new Date(Date.now() - 3600000).toISOString(),
        text: 'Hi, I saw your profile and would love to discuss a potential collaboration. Are you available for a quick call this week?',
        category: 'Interested'
      },
      {
        id: 'mock:INBOX:2',
        accountId: 'demo@example.com',
        folder: 'INBOX',
        subject: 'Out of office until next week',
        from: 'auto@system.com',
        to: ['demo@example.com'],
        date: new Date(Date.now() - 7200000).toISOString(),
        text: 'I am currently out of office and will return next Monday. For urgent matters, please contact my assistant.',
        category: 'Out of Office'
      },
      {
        id: 'mock:INBOX:3',
        accountId: 'demo@example.com',
        folder: 'INBOX',
        subject: 'Meeting scheduled for tomorrow',
        from: 'scheduler@cal.com',
        to: ['demo@example.com'],
        date: new Date(Date.now() - 10800000).toISOString(),
        text: 'Your meeting with John Smith is scheduled for tomorrow at 2 PM. Meeting link: https://zoom.us/j/123456789',
        category: 'Meeting Booked'
      },
      {
        id: 'mock:INBOX:4',
        accountId: 'demo@example.com',
        folder: 'INBOX',
        subject: 'Not interested in this opportunity',
        from: 'reject@company.com',
        to: ['demo@example.com'],
        date: new Date(Date.now() - 14400000).toISOString(),
        text: 'Thank you for reaching out, but we are not interested in this opportunity at this time.',
        category: 'Not Interested'
      },
      {
        id: 'mock:INBOX:5',
        accountId: 'demo@example.com',
        folder: 'INBOX',
        subject: 'URGENT: Your account has been compromised',
        from: 'noreply@fake-bank.com',
        to: ['demo@example.com'],
        date: new Date(Date.now() - 18000000).toISOString(),
        text: 'Click here immediately to secure your account: http://fake-bank-security.com',
        category: 'Spam'
      }
    ];

    try {
      for (const email of mockEmails) {
        await this.client.index({
          index: this.indexName,
          id: email.id,
          body: email,
          refresh: 'true'
        });
      }
      console.log('Mock data seeded successfully');
    } catch (error) {
      console.error('Failed to seed mock data:', error);
    }
  }

  async searchEmails(filters: SearchFilters) {
    await this.ensureIndex();
    
    try {
      const must: any[] = [];
      
      if (filters.q) {
        must.push({
          multi_match: {
            query: filters.q,
            fields: ['subject^3', 'text', 'from', 'to']
          }
        });
      }
      
      if (filters.accountId) {
        must.push({ term: { accountId: filters.accountId } });
      }
      
      if (filters.folder) {
        must.push({ term: { folder: filters.folder } });
      }
      
      if (filters.category) {
        must.push({ term: { category: filters.category } });
      }

      const body = {
        query: { bool: { must } },
        size: 50,
        sort: [{ date: { order: 'desc' } }]
      };

      const response = await this.client.search({
        index: this.indexName,
        body
      });

      return response.hits.hits.map((hit: any) => ({
        id: hit._id,
        ...hit._source
      }));
    } catch (error) {
      console.error('Elasticsearch search error:', error);
      return [];
    }
  }

  async updateCategory(id: string, category: string) {
    await this.ensureIndex();
    
    try {
      await this.client.update({
        index: this.indexName,
        id,
        body: {
          doc: { category }
        },
        refresh: 'true'
      });
    } catch (error) {
      console.error('Failed to update category:', error);
    }
  }
}
