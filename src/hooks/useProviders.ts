import { useState, useEffect } from 'react'
import { listProviders } from '@/api/opencode'
import type { ProviderInfo } from '@/types'

export function useProviders() {
  const [providers, setProviders] = useState<ProviderInfo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listProviders()
      .then((p) => setProviders(p))
      .catch(() => setProviders([]))
      .finally(() => setLoading(false))
  }, [])

  return { providers, loading }
}
