import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { MindMapTreeResponse, MindMapNode } from '@/lib/types'

export function useMindMapTree(rootType: string, rootId: string, depth = 2) {
  return useQuery({
    queryKey: ['mindmap-tree', rootType, rootId, depth],
    queryFn: () => {
      const params = new URLSearchParams({ root_type: rootType, root_id: rootId, depth: String(depth) })
      return api.get<MindMapTreeResponse>(`/mindmap/tree?${params}`)
    },
    enabled: !!rootId,
  })
}

export function useExpandNode(rootType: string, rootId: string) {
  const queryClient = useQueryClient()
  const treeKey = ['mindmap-tree', rootType, rootId]

  return useMutation({
    mutationFn: (params: { nodeType: string; nodeId: string; excludeIds: string[] }) => {
      const qs = new URLSearchParams({
        node_type: params.nodeType,
        node_id: params.nodeId,
        depth: '1',
        exclude_ids: params.excludeIds.join(','),
      })
      return api.get<MindMapTreeResponse>(`/mindmap/expand?${qs}`)
    },
    onSuccess: (expanded, params) => {
      // Patch the expanded children into the cached tree
      queryClient.setQueriesData<MindMapTreeResponse>(
        { queryKey: treeKey },
        (old) => {
          if (!old) return old
          const updated = structuredClone(old)
          patchNode(updated.root, params.nodeId, expanded.root.children)
          return updated
        },
      )
    },
  })
}

function patchNode(node: MindMapNode, targetId: string, children: MindMapNode['children']): boolean {
  if (node.id === targetId) {
    node.children = children
    return true
  }
  if (node.children) {
    for (const branch of node.children) {
      for (const item of branch.items) {
        if (patchNode(item, targetId, children)) return true
      }
    }
  }
  return false
}
