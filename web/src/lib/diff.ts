export type DiffType = 'equal' | 'insert' | 'delete'

export interface DiffNode {
  type: DiffType
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: Record<string, any>
}

/**
 * Compute LCS-based diff on two arrays of TipTap top-level nodes.
 * Returns two arrays: left (equal + delete) and right (equal + insert).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function diffTipTapNodes(oldNodes: Record<string, any>[], newNodes: Record<string, any>[]): {
  left: DiffNode[]
  right: DiffNode[]
} {
  const oldHashes = oldNodes.map((n) => JSON.stringify(n))
  const newHashes = newNodes.map((n) => JSON.stringify(n))

  // LCS table
  const m = oldHashes.length
  const n = newHashes.length
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldHashes[i - 1] === newHashes[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to build diff
  let i = m
  let j = n

  const leftResult: DiffNode[] = []
  const rightResult: DiffNode[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldHashes[i - 1] === newHashes[j - 1]) {
      leftResult.unshift({ type: 'equal', node: oldNodes[i - 1] })
      rightResult.unshift({ type: 'equal', node: newNodes[j - 1] })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rightResult.unshift({ type: 'insert', node: newNodes[j - 1] })
      j--
    } else {
      leftResult.unshift({ type: 'delete', node: oldNodes[i - 1] })
      i--
    }
  }

  return { left: leftResult, right: rightResult }
}
