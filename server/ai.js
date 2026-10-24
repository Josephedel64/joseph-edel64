import OpenAI from 'openai';
import { appConfig } from './config.js';
import { generateMockEmailDraft } from './leadpilot.js';

const openai = appConfig.openaiApiKey ? new OpenAI({ apiKey: appConfig.openaiApiKey }) : null;

export async function generateFollowUpDraft({ lead, tone = 'professional', template }) {
  if (!lead) {
    throw new Error('A valid lead is required for draft generation.');
  }

  if (lead.optedOut) {
    throw new Error('This contact has opted out and cannot receive messages.');
  }

  if (!openai) {
    return generateMockEmailDraft(lead, tone);
  }

  const prompt = `Write a concise, polished follow-up email for a digital agency. Use the lead context below and keep the tone ${tone}. Do not mention AI. Keep the content practical and conversion-friendly.\n\nLead: ${lead.name}\nCompany: ${lead.company}\nEmail: ${lead.email}\nSource: ${lead.source || 'website'}\nStatus: ${lead.status || 'new lead'}\nCurrent notes: ${lead.notes || 'No notes provided'}\nOwner: ${lead.owner || 'Agency team'}\n\nWrite only the final email body without markdown formatting.`;

  try {
    const completion = await openai.responses.create({
      model: 'gpt-4o-mini',
      input: prompt,
    });

    const text = completion.output_text || completion.output?.[0]?.content?.[0]?.text || '';
    if (text) {
      return text.trim();
    }
  } catch (error) {
    console.warn('OpenAI generation failed, falling back to mocked draft:', error.message);
  }

  return generateMockEmailDraft(lead, tone);
}
