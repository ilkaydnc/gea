interface AppNavBarProps {
  title: string
  onMenuTap?: () => void
  onBackTap?: () => void
}

export default function AppNavBar({ title, onMenuTap, onBackTap }: AppNavBarProps) {
  return (
    <nav-bar>
      {onBackTap && <back-button tap={onBackTap}>&#8249;</back-button>}
      <span class="nav-title">{title}</span>
      {onMenuTap && <menu-button tap={onMenuTap}>&#9776;</menu-button>}
    </nav-bar>
  )
}
