import type { SupabaseClient } from '@supabase/supabase-js';

import type { SaleObservation } from '@/services/valuation/calibration';

type Row = {
  sale_price: number | null;
  valuations: {
    likely_value: number | null;
    asking_to_sold_ratio: number | null;
    sold_comparable_count: number | null;
    created_at: string;
  }[];
};

/**
 * Le vendite effettivamente concluse, accoppiate alla stima che le aveva
 * precedute. La RLS fa il resto: ognuno calibra sulle proprie vendite, che e'
 * anche l'unica cosa sensata — il mercato di chi vende a Porta Portese non e'
 * quello di chi spedisce in Germania.
 */
export async function readSaleObservations(
  supabase: SupabaseClient,
): Promise<SaleObservation[]> {
  const { data, error } = await supabase
    .from('items')
    .select('sale_price, valuations(likely_value, asking_to_sold_ratio, sold_comparable_count, created_at)')
    .eq('status', 'sold')
    .not('sale_price', 'is', null);

  if (error || !data) return [];

  return (data as Row[]).flatMap((item) => {
    if (item.sale_price === null) return [];

    // La valutazione piu' vecchia e' quella su cui si e' deciso di comprare:
    // le successive sono rianalisi, e confrontarle con la vendita misurerebbe
    // quanto siamo migliorati, non quanto si scende dal prezzo richiesto.
    const first = [...item.valuations].sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
    if (!first || first.likely_value === null || first.asking_to_sold_ratio === null) return [];

    return [
      {
        likelyValue: first.likely_value,
        ratioUsed: first.asking_to_sold_ratio,
        soldComparableCount: first.sold_comparable_count ?? 0,
        salePrice: item.sale_price,
      },
    ];
  });
}
