'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * La foto dell'oggetto, e quello che succede quando la tocchi.
 *
 * Su una miniatura da sessantaquattro pixel una crepa non si vede, e una crepa
 * e' esattamente il motivo per cui si riapre un oggetto salvato. Finora le
 * foto erano decorazione: si guardavano e basta.
 *
 * Sta qui dentro e non nella pagina dell'inventario perche' le foto devono
 * stare **nello stesso posto** nelle due schermate. Prima l'analisi appena
 * fatta le mostrava in miniatura accanto al nome e la scheda salvata le
 * apriva grandi sopra tutto: stesso oggetto, due impaginazioni, e chi passava
 * dall'una all'altra doveva ritrovarsi. Ora e' la stessa riga in entrambe, e
 * l'ingrandimento e' a un tocco.
 *
 * Il `<dialog>` e' quello vero: Escape, fuoco intrappolato dentro e resto
 * della pagina inerte arrivano dal browser, e rifarli a mano vuol dire
 * rifarli peggio.
 */
export function PhotoLightbox({ urls, alt = '' }: { urls: string[]; alt?: string }) {
  const [aperta, setAperta] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (aperta !== null && !dialog.open) dialog.showModal();
    if (aperta === null && dialog.open) dialog.close();
  }, [aperta]);

  if (urls.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setAperta(0)}
        aria-label={urls.length > 1 ? `Ingrandisci le ${urls.length} foto` : 'Ingrandisci la foto'}
        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-block border-2 border-line"
      >
        <Image src={urls[0]!} alt={alt} width={200} height={200} unoptimized className="h-full w-full object-cover" />
        {/* Quante altre ce ne sono: senza, la miniatura non dice che dietro
            c'e' altro da guardare. */}
        {urls.length > 1 ? (
          <span className="absolute bottom-0 right-0 rounded-tl-[0.4rem] border-l-2 border-t-2 border-line bg-surface px-1 font-mono text-[0.6rem] font-semibold">
            +{urls.length - 1}
          </span>
        ) : null}
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setAperta(null)}
        /* Su `<dialog>` il clic sullo sfondo ha come bersaglio il dialog
           stesso: non serve un secondo elemento a coprire lo schermo. */
        onClick={(event) => {
          if (event.target === dialogRef.current) setAperta(null);
        }}
        className="max-h-[100dvh] max-w-[100vw] bg-transparent p-0 backdrop:bg-black/80"
      >
        {aperta !== null && urls[aperta] ? (
          <div className="flex h-[100dvh] w-screen flex-col items-center justify-center gap-4 p-4">
            <Image
              src={urls[aperta]}
              alt={alt}
              width={1400}
              height={1400}
              unoptimized
              className="max-h-[78dvh] w-auto max-w-full rounded-block border-2 border-line object-contain"
            />

            <div className="flex items-center gap-2">
              {/* Le frecce esistono solo se c'e' dove andare: due bottoni
                  spenti sotto una foto sola sono arredamento. */}
              {urls.length > 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setAperta((i) => ((i ?? 0) - 1 + urls.length) % urls.length)}
                    aria-label="Foto precedente"
                    className="flex h-11 w-11 items-center justify-center rounded-[0.6rem] border-2 border-line bg-surface text-lg"
                  >
                    ←
                  </button>
                  <span className="font-mono text-xs text-tile-cream">
                    {aperta + 1}/{urls.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAperta((i) => ((i ?? 0) + 1) % urls.length)}
                    aria-label="Foto successiva"
                    className="flex h-11 w-11 items-center justify-center rounded-[0.6rem] border-2 border-line bg-surface text-lg"
                  >
                    →
                  </button>
                </>
              ) : null}
              <button
                type="button"
                onClick={() => setAperta(null)}
                className="ml-2 flex h-11 items-center rounded-[0.6rem] border-2 border-line bg-surface px-4 text-sm font-semibold"
              >
                Chiudi
              </button>
            </div>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
