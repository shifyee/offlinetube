import { defineStore } from 'pinia'

export const useSettingsStore = defineStore('settings', {
  state: () => {
    // Load from localStorage or use defaults
    const saved = JSON.parse(localStorage.getItem('offline-tube-settings') || '{}')
    return {
      accentColor: saved.accentColor || 'red', // 'red', 'blue', 'purple', 'green'
      animations: saved.animations !== undefined ? saved.animations : true, // true or false
      defaultQuality: saved.defaultQuality || 'highest', // 'highest', '1080', '720', '480'
    }
  },
  actions: {
    save() {
      localStorage.setItem('offline-tube-settings', JSON.stringify({
        accentColor: this.accentColor,
        animations: this.animations,
        defaultQuality: this.defaultQuality
      }))
      this.applyTheme()
    },
    setAccent(color) {
      this.accentColor = color
      this.save()
    },
    toggleAnimations() {
      this.animations = !this.animations
      this.save()
    },
    setQuality(quality) {
      this.defaultQuality = quality
      this.save()
    },
    applyTheme() {
      // 1. Apply Accent Color
      const colors = {
        red: '#ff0033',
        blue: '#3b82f6',
        purple: '#a855f7',
        green: '#22c55e'
      }
      document.documentElement.style.setProperty('--accent', colors[this.accentColor])
      
      // 2. Apply Animation Toggle
      if (this.animations) {
        document.body.classList.remove('no-animations')
      } else {
        document.body.classList.add('no-animations')
      }
    }
  }
})
