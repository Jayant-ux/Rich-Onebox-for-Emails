import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import { Server as SocketIOServer } from 'socket.io';
import { createRouter } from './v1/routes.js';
import { EmailService } from './services/emailService.js';
import { ImapService } from './services/imapService.js';

dotenv.config();

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(cors({ origin: process.env.CLIENT_ORIGIN || '*' }));

const server = http.createServer(app);
export const io = new SocketIOServer(server, {
  cors: { origin: process.env.CLIENT_ORIGIN || '*' }
});

io.on('connection', () => {
  // no-op
});

app.use('/api', createRouter());

const port = Number(process.env.PORT || 4000);
server.listen(port, async () => {
  // eslint-disable-next-line no-console
  console.log(`Backend running on http://localhost:${port}`);
  
  // Initialize email service and IMAP sync
  const emailService = new EmailService();
  const imapService = new ImapService(emailService, io);
  
  // Start IMAP sync (will fallback to mock data if no credentials)
  await imapService.startSync();
});


