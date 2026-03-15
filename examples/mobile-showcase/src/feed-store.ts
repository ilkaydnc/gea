import { Store } from 'gea'

interface FeedItem {
  id: string
  title: string
  body: string
  author: string
  time: string
  color: string
}


const colors = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#BE185D']

const titles = [
  'Building Reactive UIs Without a Virtual DOM',
  'Why Proxy-Based Reactivity Wins',
  'Mobile-First Design with Gea Mobile',
  'Gesture-Driven Interfaces Made Easy',
  'Event Delegation: A Deep Dive',
  'Surgical DOM Updates Explained',
  'The Power of JSX Compilation',
  'Stores vs Component State',
  'Navigation Patterns for Mobile Web',
  'Pull-to-Refresh: Implementation Secrets',
  'Infinite Scroll Done Right',
  'TabView Patterns in Mobile Apps',
]

const bodies = [
  'Gea compiles JSX at build time into surgical DOM patches, eliminating the overhead of virtual DOM diffing entirely.',
  'Using JavaScript Proxies for state management gives you fine-grained reactivity without explicit subscriptions.',
  'The gea-mobile package provides View, ViewManager, Sidebar, TabView, and more for building native-feeling mobile web apps.',
  'Tap, swipe, and long-press gestures are first-class citizens through the GestureHandler component.',
  'Rather than attaching handlers to individual elements, Gea delegates events to the document root for maximum efficiency.',
  'Each JSX expression is analyzed at compile time, generating precise patch functions that update only what changed.',
  'The Vite plugin transforms JSX into optimized DOM operations, connecting reactive state to the exact nodes that read it.',
  'Shared app state belongs in Stores; ephemeral UI state stays local to the component.',
  'ViewManager provides iOS-style push/pull navigation with history management and back gesture support.',
  'PullToRefresh watches scroll position, triggers at a threshold, and resets after your async operation completes.',
  'InfiniteScroll monitors proximity to the bottom and fires load events, with built-in spinner and end-of-list states.',
  'TabView combines a tab bar with a ViewManager to switch between content views with simple tap interactions.',
]

const authors = ['Armagan', 'Kai', 'Sofia', 'Leo', 'Mira', 'Ren']

let idCounter = 0

function generateItems(count: number): FeedItem[] {
  const items: FeedItem[] = []
  for (let i = 0; i < count; i++) {
    const idx = idCounter % titles.length
    items.push({
      id: String(++idCounter),
      title: titles[idx],
      body: bodies[idx],
      author: authors[idCounter % authors.length],
      time: `${Math.floor(Math.random() * 23) + 1}h ago`,
      color: colors[idCounter % colors.length],
    })
  }
  return items
}

class FeedStore extends Store {
  items: FeedItem[] = []
  page: number = 1
  hasMore: boolean = true

  constructor() {
    super()
    this.loadInitial()
  }

  loadInitial() {
    idCounter = 0
    this.items = generateItems(8)
    this.page = 1
    this.hasMore = true
  }

  refresh() {
    idCounter = 0
    const items = generateItems(8)
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[items[i], items[j]] = [items[j], items[i]]
    }
    this.items = items
    this.page = 1
    this.hasMore = true
  }

  loadMore() {
    if (!this.hasMore) return

    const newItems = generateItems(5)
    this.items.push(...newItems)
    this.page++

    if (this.page >= 5) {
      this.hasMore = false
    }
  }
}

export default new FeedStore()
