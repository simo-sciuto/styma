import { AnalyzeFlow, type SavedAnalysis } from '@/features/analyze/AnalyzeFlow';
import { calibrate } from '@/services/inventory/calibration';
import { getItemDetail, listInventory } from '@/services/inventory/repository';

export const metadata = { title: 'Analizza un oggetto · STYMA' };

/**
 * Un'analisi gia' fatta, riaperta dal suo indirizzo.
 *
 * L'indirizzo e' `/analizza?oggetto=<id>` e non `/inventario/<id>`, e la
 * differenza non e' cosmetica.
 *
 * Prima, appena l'oggetto veniva salvato, la pagina si riscriveva l'indirizzo
 * in `/inventario/<id>` con `history.replaceState`, contando sul fatto che
 * non fosse una navigazione. Ma in App Router `pushState` e `replaceState`
 * sono agganciati al router — la documentazione lo dice a chiare lettere in
 * `linking-and-navigating.md` — e da quel momento il router crede di stare su
 * `/inventario/<id>`. Alla prima azione server successiva, cioe' al primo
 * carattere digitato nel prezzo, rigenerava *quella* rotta: scheletro, poi la
 * scheda oggetto riletta dal database. Il risultato che stavi leggendo
 * spariva, e il prezzo appena scritto se ne andava con lui perche' la
 * rilettura correva contro il salvataggio ritardato.
 *
 * Lo stesso documento mostra il solo modo sicuro di riscrivere l'indirizzo:
 * cambiando i parametri di ricerca, restando sulla stessa rotta. Cosi'
 * l'analisi conserva il suo indirizzo, chi ricarica rivede la stessa pagina,
 * e il router non va da nessuna parte.
 */
async function leggiSalvata(id: string): Promise<SavedAnalysis | null> {
  const result = await getItemDetail(id);
  if (result.status !== 'ok') return null;

  const { item, snapshot, imageUrls } = result.detail;
  if (!snapshot) return null;

  return {
    itemId: id,
    snapshot,
    photoUrls: imageUrls,
    askingPrice: item.asking_price,
    listing: item.listing_url
      ? { url: item.listing_url, source: item.listing_source ?? 'vinted' }
      : null,
  };
}

export default async function AnalyzePage({ searchParams }: PageProps<'/analizza'>) {
  const { oggetto } = await searchParams;
  const id = typeof oggetto === 'string' && oggetto !== '' ? oggetto : null;

  /*
   * La calibrazione si legge qui, una volta sola: non cambia mentre analizzi
   * un oggetto, e farla calcolare al client vorrebbe dire scaricargli tutto
   * il magazzino per ottenere un numero.
   */
  const [saved, inventario] = await Promise.all([
    id ? leggiSalvata(id) : Promise.resolve(null),
    listInventory(true),
  ]);
  const calibration = inventario.status === 'ok' ? calibrate(inventario.entries) : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-4 pb-20 pt-6 sm:px-5">
      <AnalyzeFlow saved={saved} calibration={calibration} />
    </main>
  );
}
