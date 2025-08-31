import { useEffect } from 'react'

import { MODELS } from '@/lib/ai/ai-providers'
import { useStore } from '../zustand/store'

export function useModelsCache() {
    const model = useStore((state: any) => state.model)
    const setModel = useStore((state: any) => state.setModel)
    const setModels = useStore((state: any) => state.setModels)

    useEffect(() => {
        // Use the models defined in ai-providers.ts
        setModels(MODELS.map(m => m.id))
        
        // Set default model if none is selected
        if (!model && MODELS.length > 0) {
            setModel(MODELS[0].id)
        }
    }, [model, setModels, setModel])

    return {
        models: MODELS,
        currentModel: model,
        setModel
    }
}
