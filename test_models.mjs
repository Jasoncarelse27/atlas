import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
console.log('Testing available models...');
const models = ['claude-3-5-sonnet-20241022', 'claude-3-5-sonnet-20240620', 'claude-3-sonnet-20240229', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'];
console.log('Valid models:', models);
