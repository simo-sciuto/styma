import { describe, expect, it } from 'vitest';

import { readAnalysisEvents, type ValuateEvent } from './analysis-stream';

/** Costruisce un flusso spezzato esattamente dove indicato. */
function streamOf(pieces: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const piece of pieces) controller.enqueue(encoder.encode(piece));
      controller.close();
    },
  });
}

async function collect(pieces: string[]): Promise<ValuateEvent[]> {
  const events: ValuateEvent[] = [];
  for await (const event of readAnalysisEvents(streamOf(pieces))) events.push(event);
  return events;
}

const laneEvent = (id: string) =>
  `data: ${JSON.stringify({
    type: 'lane',
    lane: { id, label: id, status: 'done', comparables: 2 },
  })}\n\n`;

describe('readAnalysisEvents', () => {
  it('legge eventi consecutivi arrivati in un unico blocco', async () => {
    const events = await collect([laneEvent('a') + laneEvent('b')]);
    expect(events).toHaveLength(2);
  });

  it('ricompone un evento spezzato a meta’ fra due chunk', async () => {
    const whole = laneEvent('sold');
    const cut = Math.floor(whole.length / 2);
    const events = await collect([whole.slice(0, cut), whole.slice(cut)]);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'lane', lane: { id: 'sold' } });
  });

  it('ricompone un evento spezzato dentro un carattere multibyte', async () => {
    const encoder = new TextEncoder();
    const payload = encoder.encode(
      `data: ${JSON.stringify({ type: 'error', error: 'perché', code: 'x' })}\n\n`,
    );
    const cut = payload.indexOf(0xc3); // primo byte di "é"
    const events: ValuateEvent[] = [];
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(payload.slice(0, cut + 1));
        controller.enqueue(payload.slice(cut + 1));
        controller.close();
      },
    });
    for await (const event of readAnalysisEvents(stream)) events.push(event);

    expect(events[0]).toMatchObject({ type: 'error', error: 'perché' });
  });

  it('ignora i commenti di keep-alive', async () => {
    const events = await collect([': ping\n\n', laneEvent('a'), ': ping\n\n']);
    expect(events).toHaveLength(1);
  });

  it('salta un evento illeggibile senza perdere quelli dopo', async () => {
    const events = await collect(['data: {non json}\n\n', laneEvent('a')]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ type: 'lane' });
  });

  it('non emette nulla per un evento troncato dalla chiusura del flusso', async () => {
    const events = await collect(['data: {"type":"lane"']);
    expect(events).toEqual([]);
  });
});
