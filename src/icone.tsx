// Icone a tratto (DESIGN.md: 18px, 14px dentro testo e bottoni, spessore 1,8, capi arrotondati).
const TRATTI = {
  casa: (
    <>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </>
  ),
  lista: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="3.5" cy="6" r="1" />
      <circle cx="3.5" cy="12" r="1" />
      <circle cx="3.5" cy="18" r="1" />
    </>
  ),
  frecce: <path d="M7 7h11l-3-3M17 17H6l3 3" />,
  cartella: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  aggiorna: (
    <>
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </>
  ),
  linea: <path d="M3 17l5-5 4 3 8-8" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  ok: <path d="M5 12l5 5 9-10" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  indietro: <path d="M15 6l-6 6 6 6" />,
  piu: <path d="M12 5v14M5 12h14" />,
  matita: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </>
  ),
} as const

export type NomeIcona = keyof typeof TRATTI

export function Icona({ nome, piccola = false }: { nome: NomeIcona; piccola?: boolean }) {
  return (
    <svg className={piccola ? 'ic p' : 'ic'} viewBox="0 0 24 24" aria-hidden="true">
      {TRATTI[nome]}
    </svg>
  )
}
