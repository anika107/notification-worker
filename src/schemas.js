const { z } = require('zod');

const notifySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
});

const hashSchema = z.object({
  text: z.string().min(1).max(10000),
  iterations: z.number().int().min(1000).max(5_000_000).optional(),
});

const resizeSchema = z.object({
  file: z.string().min(1).max(200).regex(/^[\w.\-]+$/, 'Invalid file name'),
  width: z.number().int().min(16).max(2000).optional(),
});

module.exports = { notifySchema, hashSchema, resizeSchema };