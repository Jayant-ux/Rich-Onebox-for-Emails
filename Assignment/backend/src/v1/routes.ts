import { Router } from 'express';
import { z } from 'zod';
import { EmailService } from '../services/emailService.js';

// Enhanced AI Reply Generation
async function generateSmartReply(emailContent: string, responseType: string): Promise<string> {
  const emailLower = emailContent.toLowerCase();
  
  // Analyze email content for context
  const isJobOffer = emailLower.includes('job') || emailLower.includes('hiring') || emailLower.includes('position') || emailLower.includes('internship');
  const isMeeting = emailLower.includes('meeting') || emailLower.includes('call') || emailLower.includes('schedule');
  const isSpam = emailLower.includes('urgent') || emailLower.includes('click here') || emailLower.includes('limited time');
  const isBanking = emailLower.includes('transaction') || emailLower.includes('upi') || emailLower.includes('bank');
  const isMarketing = emailLower.includes('offer') || emailLower.includes('discount') || emailLower.includes('sale');
  
  switch (responseType) {
    case 'professional':
      if (isJobOffer) {
        return `Thank you for reaching out regarding the opportunity. I'm interested in learning more about the position and would appreciate additional details about the role, requirements, and next steps in the process.\n\nI'm available for a call to discuss this further. Please let me know your availability.\n\nBest regards`;
      } else if (isMeeting) {
        return `Thank you for your email. I'd be happy to schedule a meeting to discuss this further.\n\nCould you please provide a few time slots that work for you? I'm generally available [insert your availability].\n\nLooking forward to our conversation.\n\nBest regards`;
      } else if (isSpam) {
        return `Thank you for your email. However, I'm not interested in this offer at this time.\n\nBest regards`;
      } else {
        return `Thank you for your email. I've received your message and will review it carefully.\n\nI'll get back to you with a detailed response within 24 hours.\n\nBest regards`;
      }
      
    case 'casual':
      if (isJobOffer) {
        return `Hey!\n\nThanks for reaching out about this opportunity. It sounds interesting! Could you tell me a bit more about what the role involves?\n\nI'd love to chat more about it if you're free for a quick call.\n\nThanks!`;
      } else if (isMeeting) {
        return `Hey there!\n\nSure, I'd be up for a meeting. When works best for you? I'm pretty flexible this week.\n\nLet me know what time slots you have available!\n\nThanks!`;
      } else {
        return `Hi!\n\nThanks for the email. I'll take a look at this and get back to you soon.\n\nTalk soon!`;
      }
      
    case 'follow-up':
      return `Hi,\n\nI hope this email finds you well. I wanted to follow up on our previous conversation regarding [topic].\n\nCould you please provide an update on the status? I'm looking forward to hearing from you.\n\nBest regards`;
      
    case 'decline':
      if (isJobOffer) {
        return `Thank you for considering me for this opportunity. After careful consideration, I've decided to decline at this time.\n\nI appreciate your time and hope we can stay in touch for future opportunities.\n\nBest regards`;
      } else {
        return `Thank you for your email. Unfortunately, I'm not able to proceed with this at the moment.\n\nI appreciate your understanding.\n\nBest regards`;
      }
      
    case 'auto-reply':
      return `Thank you for your email. I'm currently out of the office and will return on [date].\n\nFor urgent matters, please contact [alternative contact].\n\nI'll respond to your email as soon as I return.\n\nBest regards`;
      
    default:
      return `Thank you for your email. I've received your message and will respond appropriately.\n\nBest regards`;
  }
}

const emailService = new EmailService();

export function createRouter() {
  const r = Router();

  r.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const searchQuery = z.object({
    q: z.string().optional(),
    accountId: z.string().optional(),
    folder: z.string().optional(),
    category: z.string().optional()
  });

  r.get('/emails', async (req, res) => {
    try {
      const parsed = searchQuery.safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ error: 'Invalid query' });
      
      const { q, accountId, folder, category } = parsed.data;
      const results = await emailService.searchEmails({ q, accountId, folder, category });
      res.json({ results });
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  });

  const categoryBody = z.object({ category: z.string(), subject: z.string().optional(), from: z.string().optional() });
  r.post('/emails/:id/category', async (req, res) => {
    try {
      const valid = categoryBody.safeParse(req.body);
      if (!valid.success) return res.status(400).json({ error: 'Invalid body' });
      
      const { id } = req.params;
      const { category, subject, from } = valid.data;
      await emailService.updateCategory(id, category);
      res.json({ ok: true });
    } catch (error) {
      console.error('Update category error:', error);
      res.status(500).json({ error: 'Update failed' });
    }
  });

      const suggestBody = z.object({ 
        email: z.string(),
        responseType: z.enum(['professional', 'casual', 'follow-up', 'decline', 'auto-reply']).optional()
      });
      
      r.post('/emails/suggest-reply', async (req, res) => {
        const valid = suggestBody.safeParse(req.body);
        if (!valid.success) return res.status(400).json({ error: 'Invalid body' });
        
        const { email, responseType = 'professional' } = valid.data;
        
        try {
          const reply = await generateSmartReply(email, responseType);
          res.json({ reply, responseType });
        } catch (error) {
          console.error('AI reply generation error:', error);
          res.status(500).json({ error: 'Failed to generate reply' });
        }
      });

  return r;
}


