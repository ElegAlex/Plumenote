import { createContext, useContext, useState, type ReactNode } from 'react'

interface SidebarContextType {
  isOpen: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextType>({ isOpen: true, toggle: () => {} })

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 900) return false
    return localStorage.getItem('plumenote-sidebar') !== 'closed'
  })

  const toggle = () => {
    setIsOpen(prev => {
      const next = !prev
      localStorage.setItem('plumenote-sidebar', next ? 'open' : 'closed')
      return next
    })
  }

  return (
    <SidebarContext.Provider value={{ isOpen, toggle }}>
      {children}
    </SidebarContext.Provider>
  )
}

export const useSidebar = () => useContext(SidebarContext)
