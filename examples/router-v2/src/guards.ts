import authStore from './stores/auth-store'

export const AuthGuard = () => {
  if (authStore.user) return true
  return '/login'
}
