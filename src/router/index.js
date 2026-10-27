import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/',        name: 'downloader', component: () => import('../views/DownloaderView.vue') },
  { path: '/watch/:id', name: 'watch',   component: () => import('../views/VideoView.vue') },
  { path: '/library',   name: 'library',   component: () => import('../views/LibraryView.vue') },
  { path: '/playables', name: 'playables', component: () => import('../views/PlayablesView.vue') },
  { path: '/credits',   name: 'credits',   component: () => import('../views/CreditsView.vue') },
  { path: '/settings',  name: 'settings',  component: () => import('../views/SettingsView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
