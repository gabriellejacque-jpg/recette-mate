import { useEffect, useState } from 'react'
import { api } from './api'
import { emptyDraft, type Recipe, type RecipeDraft } from './types'
import RecipeList from './components/RecipeList'
import RecipeDetail from './components/RecipeDetail'
import RecipeForm from './components/RecipeForm'
import InstagramImport from './components/InstagramImport'
import Planner from './components/Planner'

type View =
  | { name: 'list' }
  | { name: 'detail'; id: string }
  | { name: 'new'; draft: RecipeDraft }
  | { name: 'import' }
  | { name: 'edit'; id: string }

type Tab = 'recipes' | 'plan'

export default function App() {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [tab, setTab] = useState<Tab>('recipes')
  const [view, setView] = useState<View>({ name: 'list' })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  async function refresh() {
    setRecipes(await api.list())
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [])

  const current =
    view.name === 'detail' || view.name === 'edit'
      ? recipes.find((r) => r.id === view.id)
      : undefined

  async function handleCreate(draft: RecipeDraft) {
    try {
      const r = await api.create(draft)
      await refresh()
      setView({ name: 'detail', id: r.id })
    } catch (e) {
      alert("Impossible d'enregistrer la recette : " + (e as Error).message)
    }
  }

  async function handleUpdate(id: string, draft: RecipeDraft) {
    try {
      await api.update(id, draft)
      await refresh()
      setView({ name: 'detail', id })
    } catch (e) {
      alert("Impossible d'enregistrer la recette : " + (e as Error).message)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette recette ?')) return
    try {
      await api.remove(id)
      await refresh()
      setView({ name: 'list' })
    } catch (e) {
      alert('Impossible de supprimer : ' + (e as Error).message)
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="brand"
          onClick={() => {
            setTab('recipes')
            setView({ name: 'list' })
          }}
        >
          <span className="brand-emoji">🍲</span> Recette Mate
        </button>

        <nav className="tabs">
          <button
            className={tab === 'recipes' ? 'tab active' : 'tab'}
            onClick={() => {
              setTab('recipes')
              setView({ name: 'list' })
            }}
          >
            Recettes
          </button>
          <button className={tab === 'plan' ? 'tab active' : 'tab'} onClick={() => setTab('plan')}>
            Planning
          </button>
        </nav>

        {tab === 'recipes' && view.name === 'list' && (
          <div className="topbar-actions">
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une recette, un tag…"
            />
            <button className="btn-ghost" onClick={() => setView({ name: 'import' })}>
              📷 Importer d'Instagram
            </button>
            <button className="btn-primary" onClick={() => setView({ name: 'new', draft: emptyDraft() })}>
              + Nouvelle recette
            </button>
          </div>
        )}
      </header>

      <main className="content">
        {loading ? (
          <div className="empty"><p>Chargement…</p></div>
        ) : tab === 'plan' ? (
          <Planner recipes={recipes} />
        ) : view.name === 'list' ? (
          <RecipeList
            recipes={recipes}
            query={query}
            onOpen={(id) => setView({ name: 'detail', id })}
          />
        ) : view.name === 'detail' && current ? (
          <>
            <BackBar onBack={() => setView({ name: 'list' })} />
            <RecipeDetail
              recipe={current}
              onEdit={() => setView({ name: 'edit', id: current.id })}
              onDelete={() => handleDelete(current.id)}
            />
          </>
        ) : view.name === 'edit' && current ? (
          <>
            <BackBar onBack={() => setView({ name: 'detail', id: current.id })} />
            <h1 className="page-title">Modifier la recette</h1>
            <RecipeForm
              initial={current}
              submitLabel="Enregistrer"
              onSubmit={(d) => handleUpdate(current.id, d)}
              onCancel={() => setView({ name: 'detail', id: current.id })}
            />
          </>
        ) : view.name === 'new' ? (
          <>
            <BackBar onBack={() => setView({ name: 'list' })} />
            <h1 className="page-title">Nouvelle recette</h1>
            <RecipeForm
              initial={view.draft}
              submitLabel="Créer la recette"
              onSubmit={handleCreate}
              onCancel={() => setView({ name: 'list' })}
            />
          </>
        ) : view.name === 'import' ? (
          <>
            <BackBar onBack={() => setView({ name: 'list' })} />
            <h1 className="page-title">Importer depuis Instagram</h1>
            <InstagramImport
              onImported={(draft) => setView({ name: 'new', draft })}
              onCancel={() => setView({ name: 'list' })}
            />
          </>
        ) : (
          <div className="empty"><p>Recette introuvable.</p></div>
        )}
      </main>
    </div>
  )
}

function BackBar({ onBack }: { onBack: () => void }) {
  return (
    <button className="back" onClick={onBack}>
      ← Retour
    </button>
  )
}
