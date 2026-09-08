import type { SchoolAppAPI } from './preload'

declare global {
  interface Window {
    schoolApp: SchoolAppAPI
  }
}
