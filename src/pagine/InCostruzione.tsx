// Le pagine che arrivano con i prossimi ticket: per ora la testata e una riga che dice cosa ci sarà.
import type { ReactNode } from 'react'

export function InCostruzione({ titolo, contesto, children }: { titolo: string; contesto?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="testata">
        <h1>{titolo}</h1>
        {contesto && <span className="tenue">{contesto}</span>}
      </div>
      <div className="riquadro vuoto">{children}</div>
    </section>
  )
}
