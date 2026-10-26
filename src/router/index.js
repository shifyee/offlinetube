import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/',        name: 'home',      component: () => import('../views/HomeView.vue') },
  { path: '/downloader', name: 'downloader', component: () => import('../views/DownloaderView.vue') },
  { path: '/search',  name: 'search',    component: () => import('../views/SearchView.vue') },
  { path: '/watch/:id', name: 'watch',   component: () => import('../views/VideoView.vue') },
  { path: '/channel/:id', name: 'channel', component: () => import('../views/ChannelView.vue') },
  { path: '/playlist/:id', name: 'playlist', component: () => import('../views/PlaylistView.vue') },
  { path: '/downloads', name: 'downloads', component: () => import('../views/DownloadsView.vue') },
  { path: '/library',   name: 'library',   component: () => import('../views/LibraryView.vue') },
  { path: '/settings',  name: 'settings',  component: () => import('../views/SettingsView.vue') },
  { path: '/subscriptions', component: () => import('../views/PlaceholderView.vue'), props: { title: 'Subscriptions' } },
  { path: '/channels',      component: () => import('../views/PlaceholderView.vue'), props: { title: 'Channels' } },
  { path: '/playlists',     component: () => import('../views/PlaceholderView.vue'), props: { title: 'Playlists' } },
  { path: '/history',       component: () => import('../views/PlaceholderView.vue'), props: { title: 'History' } },
  { path: '/:pathMatch(.*)*', redirect: '/' }
]

export default createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})
