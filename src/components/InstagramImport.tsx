import { useState } from 'react'
import { api } from '../api'
import type { RecipeDraft } from '../types'

interface Props {
  onImported: (draft: RecipeDraft) => void
  onCancel: () => void
}

export default function InstagramImport({ onImported, onCancel }: Props) {
  const [url, setUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [showCaption, setShowCaption] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run(useCaption: boolean) {
    setError('')
    if (!useCaption && !url.trim()) {
      setError('Collez le lien du post ou du reel Instagram.')
      return
    }
    if (useCaption && !caption.trim()) {
      setError('Collez la légende du post.')
      return
    }
    setLoading(true)
    try {
      const { recipe } = await api.importInstagram(
        useCaption ? { url, caption } : { url }
      )
      onImported(recipe)
    } catch (e) {
      const err = e as Error & { needsCaption?: boolean }
      setError(err.message)
      if (err.needsCaption) setShowCaption(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ig-import">
      <p className="hint">
        Collez le lien d'un post ou d'un reel Instagram. Recette Mate récupère la légende et la
        structure automatiquement en ingrédients et étapes — que vous pourrez relire avant
        d'enregistrer.
      </p>

      <label className="field">
        <span>Lien Instagram</span>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/XXXXXXXXX/"
        />
      </label>

      <div className="form-actions left">
        <button className="btn-primary" disabled={loading} onClick={() => run(false)}>
          {loading ? 'Import en cours…' : 'Importer depuis le lien'}
        </button>
        <button className="btn-ghost" onClick={onCancel}>
          Annuler
        </button>
      </div>

      {error && <div className="error-box">{error}</div>}

      <details className="caption-fallback" open={showCaption}>
        <summary>Instagram bloque l'accès ? Collez la légende à la main</summary>
        <p className="hint">
          Ouvrez le post sur Instagram, copiez tout le texte de la légende (ingrédients + étapes)
          et collez-le ici. Le parsing fonctionne exactement de la même façon.
        </p>
        <textarea
          rows={8}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder={'Curry de lentilles corail 🍛\n\nIngrédients :\n- 200g de lentilles corail\n- 1 oignon\n...\n\nPréparation :\n1. Émincer l\'oignon\n2. ...'}
        />
        <div className="form-actions left">
          <button className="btn-primary" disabled={loading} onClick={() => run(true)}>
            Structurer cette légende
          </button>
        </div>
      </details>
    </div>
  )
}
