import * as React from "react"

// Breakpoints customizados para o projeto
const BREAKPOINTS = {
  mobile: 640,
  tablet: 768,
  desktop: 1024,
  wide: 1280
} as const

type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'wide'

interface UseResponsiveReturn {
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isWide: boolean
  deviceType: DeviceType
  screenWidth: number
  isTouch: boolean
}

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.mobile)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < BREAKPOINTS.mobile)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

// Hook mais completo para responsividade
export function useResponsive(): UseResponsiveReturn {
  const [screenWidth, setScreenWidth] = React.useState<number>(0)
  const [isTouch, setIsTouch] = React.useState<boolean>(false)

  React.useEffect(() => {
    const updateScreenWidth = () => {
      setScreenWidth(window.innerWidth)
    }

    const detectTouch = () => {
      setIsTouch('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }

    updateScreenWidth()
    detectTouch()

    window.addEventListener('resize', updateScreenWidth)
    return () => window.removeEventListener('resize', updateScreenWidth)
  }, [])

  const isMobile = screenWidth < BREAKPOINTS.mobile
  const isTablet = screenWidth >= BREAKPOINTS.mobile && screenWidth < BREAKPOINTS.desktop
  const isDesktop = screenWidth >= BREAKPOINTS.desktop && screenWidth < BREAKPOINTS.wide
  const isWide = screenWidth >= BREAKPOINTS.wide

  const deviceType: DeviceType = React.useMemo(() => {
    if (isMobile) return 'mobile'
    if (isTablet) return 'tablet'
    if (isWide) return 'wide'
    return 'desktop'
  }, [isMobile, isTablet, isWide])

  return {
    isMobile,
    isTablet,
    isDesktop,
    isWide,
    deviceType,
    screenWidth,
    isTouch
  }
}

// Hook para classes CSS condicionais baseadas no dispositivo
export function useResponsiveClasses() {
  const { isMobile, isTablet, deviceType } = useResponsive()

  return React.useMemo(() => ({
    // Padding responsivo
    containerPadding: isMobile ? 'px-4' : isTablet ? 'px-6' : 'px-8',
    sectionPadding: isMobile ? 'py-8' : isTablet ? 'py-12' : 'py-16',
    
    // Grid responsivo
    gridCols: {
      auto: isMobile ? 'grid-cols-1' : isTablet ? 'grid-cols-2' : 'grid-cols-3',
      cards: isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3',
      stats: isMobile ? 'grid-cols-2' : 'grid-cols-4'
    },
    
    // Texto responsivo
    heading: {
      h1: isMobile ? 'text-3xl' : isTablet ? 'text-4xl' : 'text-5xl lg:text-6xl',
      h2: isMobile ? 'text-2xl' : isTablet ? 'text-3xl' : 'text-4xl',
      h3: isMobile ? 'text-xl' : 'text-2xl'
    },
    
    // Botões responsivos
    button: {
      size: isMobile ? 'h-12' : 'h-10',
      padding: isMobile ? 'px-6' : 'px-4',
      text: isMobile ? 'text-base' : 'text-sm'
    },
    
    // Cards responsivos
    card: {
      padding: isMobile ? 'p-4' : 'p-6',
      gap: isMobile ? 'gap-4' : 'gap-6'
    },
    
    deviceType
  }), [isMobile, isTablet, deviceType])
}
