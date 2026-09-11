/**
 * Un mirino con una riga che scorre.
 *
 * Prima c'era un cartellino che dondolava: carino e fuori posto, perche' non
 * somigliava a niente di quello che sta succedendo. Qui sotto l'app sta
 * guardando delle fotografie riga per riga, e un'attesa che assomiglia al
 * lavoro che si sta facendo si capisce senza didascalia.
 *
 * Quattro angoli e una linea. Niente SVG, niente libreria: sono cinque
 * rettangoli, e il movimento e' una sola coordinata che va su e giu'.
 */
export function Scanning() {
  return (
    <div className="mt-5 flex justify-center" aria-hidden>
      <div className="scansione relative h-16 w-16">
        {/* Gli angoli del mirino: fermi, danno il riferimento alla riga che
            si muove. Senza, la linea sembrerebbe galleggiare nel vuoto. */}
        <span className="absolute left-0 top-0 h-4 w-4 rounded-tl-[0.35rem] border-l-[3px] border-t-[3px] border-line" />
        <span className="absolute right-0 top-0 h-4 w-4 rounded-tr-[0.35rem] border-r-[3px] border-t-[3px] border-line" />
        <span className="absolute bottom-0 left-0 h-4 w-4 rounded-bl-[0.35rem] border-b-[3px] border-l-[3px] border-line" />
        <span className="absolute bottom-0 right-0 h-4 w-4 rounded-br-[0.35rem] border-b-[3px] border-r-[3px] border-line" />
        <span className="scansione-riga absolute inset-x-1.5 h-[3px] rounded-full bg-tile-teal" />
      </div>
    </div>
  );
}
