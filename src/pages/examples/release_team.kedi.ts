import type { APIRoute } from 'astro';
import examples from '../../data/examples.json';

export const GET: APIRoute = () =>
  new Response(examples.agent.code + '\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
