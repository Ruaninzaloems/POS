import * as React from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { HelpCircle, Info } from "lucide-react"
import { cn } from "@/lib/utils"

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = React.useState(false)
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    setIsMobile(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mql.addEventListener("change", handler)
    return () => mql.removeEventListener("change", handler)
  }, [breakpoint])
  return isMobile
}

interface HelpTipProps {
  text: string
  side?: "top" | "bottom" | "left" | "right"
  icon?: "help" | "info"
  size?: "sm" | "md"
  className?: string
  children?: React.ReactNode
}

export function HelpTip({ text, side = "top", icon = "help", size = "sm", className, children }: HelpTipProps) {
  const Icon = icon === "info" ? Info : HelpCircle
  const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4"
  const isMobile = useIsMobile()

  if (isMobile) {
    return children ? <>{children}</> : null
  }

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>
        {children || (
          <span className={cn("inline-flex items-center cursor-help text-muted-foreground/60 hover:text-muted-foreground transition-colors", className)}>
            <Icon className={iconSize} />
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[280px] text-xs leading-relaxed font-normal">
        {text}
      </TooltipContent>
    </Tooltip>
  )
}

interface LabelWithTipProps {
  label: string
  tip: string
  htmlFor?: string
  className?: string
  required?: boolean
  side?: "top" | "bottom" | "left" | "right"
}

export function LabelWithTip({ label, tip, htmlFor, className, required, side = "top" }: LabelWithTipProps) {
  return (
    <label htmlFor={htmlFor} className={cn("text-xs text-slate-500 font-semibold flex items-center gap-1", className)}>
      {label}{required && ' *'}
      <HelpTip text={tip} side={side} />
    </label>
  )
}
