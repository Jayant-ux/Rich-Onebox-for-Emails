import { ImapFlow } from 'imapflow';
import { EmailService } from './emailService.js';
import type { Server as SocketIOServer } from 'socket.io';

export interface ImapConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export class ImapService {
  private emailService: EmailService;
  private io: SocketIOServer;
  private clients: ImapFlow[] = [];

  constructor(emailService: EmailService, io: SocketIOServer) {
    this.emailService = emailService;
    this.io = io;
  }

  private getAccounts(): { id: string; config: ImapConfig }[] {
    const accounts: { id: string; config: ImapConfig }[] = [];
    
    // Primary email account
    const email1 = process.env.IMAP1_USER;
    const host1 = process.env.IMAP1_HOST;
    const pass1 = process.env.IMAP1_PASS;
    
    if (email1 && host1 && pass1) {
      accounts.push({
        id: email1,
        config: {
          host: host1,
          port: Number(process.env.IMAP1_PORT || 993),
          secure: String(process.env.IMAP1_SECURE || 'true') === 'true',
          auth: { user: email1, pass: pass1 }
        }
      });
    }

    // Secondary email account (optional)
    const email2 = process.env.IMAP2_USER;
    const host2 = process.env.IMAP2_HOST;
    const pass2 = process.env.IMAP2_PASS;
    
    if (email2 && host2 && pass2) {
      accounts.push({
        id: email2,
        config: {
          host: host2,
          port: Number(process.env.IMAP2_PORT || 993),
          secure: String(process.env.IMAP2_SECURE || 'true') === 'true',
          auth: { user: email2, pass: pass2 }
        }
      });
    }

    return accounts;
  }

  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on('error', reject);
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
  }

  private async processMessage(client: ImapFlow, accountId: string, folder: string, msg: any) {
    try {
      const uid = msg.uid?.toString() || `${msg.seq}`;
      const subject = msg.envelope?.subject || '';
      const from = msg.envelope?.from?.map((a: any) => a.address).join(', ') || '';
      const to = (msg.envelope?.to || []).map((a: any) => a.address);
      const dateIso = (msg.internalDate || new Date()).toISOString();
      
      let text = '';
      try {
        // Only download body for recent emails to avoid memory issues
        const parsed = await client.download(msg.uid);
        text = (await this.streamToString(parsed.content)).slice(0, 50000); // Reduced from 100k to 50k
      } catch (error) {
        console.warn(`⚠️  Failed to download body for ${uid}:`, error.message);
        // Continue without body text
      }

      const emailDoc = {
        id: `${accountId}:${folder}:${uid}`,
        accountId,
        folder,
        subject,
        from,
        to,
        date: dateIso,
        text,
        category: 'Uncategorized'
      };

      await this.emailService.indexEmail(emailDoc);
      console.log(`📧 Indexed: "${subject}" from ${from}`);
    } catch (error) {
      console.error(`❌ Error processing message ${msg.uid}:`, error.message);
    }
  }

  private async fetchRecentEmails(client: ImapFlow, accountId: string) {
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        // Fetch emails from the last 7 days only (not 30 days to avoid overload)
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        console.log(`📧 Fetching emails since ${since.toISOString()} for ${accountId}...`);
        
        let count = 0;
        const batchSize = 50; // Process in smaller batches
        const messages: any[] = [];
        
        // First, collect all message UIDs
        for await (const msg of client.fetch(
          { since },
          { uid: true, envelope: true, internalDate: true }
        )) {
          messages.push(msg);
          if (messages.length >= 200) break; // Limit to 200 most recent emails
        }
        
        console.log(`📊 Found ${messages.length} recent emails to process`);
        
        // Process in batches
        for (let i = 0; i < messages.length; i += batchSize) {
          const batch = messages.slice(i, i + batchSize);
          console.log(`🔄 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(messages.length/batchSize)} (${batch.length} emails)`);
          
          for (const msg of batch) {
            await this.processMessage(client, accountId, 'INBOX', msg);
            count++;
            
            // Add small delay to prevent overwhelming the system
            if (count % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
        }
        
        console.log(`✅ Successfully processed ${count} emails from ${accountId}`);
      } finally {
        lock.release();
      }
    } catch (error) {
      console.error(`❌ Error fetching recent emails for ${accountId}:`, error);
    }
  }

  async startSync() {
    const accounts = this.getAccounts();
    
    console.log(`Found ${accounts.length} IMAP account(s) configured`);
    console.log('IMAP config check:', {
      IMAP1_USER: process.env.IMAP1_USER ? 'SET' : 'NOT SET',
      IMAP1_HOST: process.env.IMAP1_HOST ? 'SET' : 'NOT SET',
      IMAP1_PASS: process.env.IMAP1_PASS ? 'SET' : 'NOT SET'
    });
    
    if (accounts.length === 0) {
      console.log('No IMAP accounts configured. Using mock data instead.');
      await this.emailService.seedMockData();
      return;
    }

    console.log(`Starting IMAP sync for ${accounts.length} account(s)...`);

    for (const { id, config } of accounts) {
      try {
        const client = new ImapFlow(config);
        this.clients.push(client);
        
        console.log(`Connecting to ${id}...`);
        console.log(`Using config:`, {
          host: config.host,
          port: config.port,
          secure: config.secure,
          user: config.auth.user,
          passLength: config.auth.pass.length
        });
        
        await client.connect();
        console.log(`✅ Connected to ${id} successfully!`);

        // Fetch recent emails
        await this.fetchRecentEmails(client, id);

        // Listen for new emails
        client.on('exists', async () => {
          try {
            const lock = await client.getMailboxLock('INBOX');
            try {
              const msg = await client.fetchOne('*', {
                envelope: true,
                source: true,
                uid: true,
                internalDate: true
              });
              if (msg) {
                await this.processMessage(client, id, 'INBOX', msg);
                this.io.emit('email:new', { accountId: id });
              }
            } finally {
              lock.release();
            }
          } catch (error) {
            console.error(`Error handling new email for ${id}:`, error);
          }
        });

        // Keep connection alive
        (async () => {
          while (!client.closed) {
            try {
              await client.idle();
            } catch (error) {
              console.error(`Idle error for ${id}:`, error);
              try {
                await client.connect();
              } catch (reconnectError) {
                console.error(`Reconnect failed for ${id}:`, reconnectError);
                break;
              }
            }
          }
        })();

      } catch (error) {
        console.error(`❌ Failed to connect to ${id}:`, error);
        console.error('Connection error details:', {
          message: error.message,
          code: error.code,
          response: error.response
        });
        // Don't fall back to mock data if only one account fails
        // Continue trying other accounts
      }
    }
    
    // Only use mock data if NO accounts could connect
    if (this.clients.length === 0) {
      console.log('❌ No IMAP accounts could connect. Using mock data instead.');
      await this.emailService.seedMockData();
    } else {
      console.log('🧹 Clearing any existing mock data...');
      await this.emailService.clearAllEmails();
      console.log('✅ Ready for real email data!');
    }
  }

  async stopSync() {
    console.log('Stopping IMAP sync...');
    for (const client of this.clients) {
      try {
        await client.close();
      } catch (error) {
        console.error('Error closing IMAP client:', error);
      }
    }
    this.clients = [];
  }
}
