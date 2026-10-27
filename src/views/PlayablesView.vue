<script setup>
import { ref } from 'vue'

const loading = ref(true)
const iframeRef = ref(null)

function onIframeLoad() {
  loading.value = false
  
  if (iframeRef.value) {
    try {
      const iframeDoc = iframeRef.value.contentWindow.document
      
      // Inject custom CSS into the Gams page
      const style = iframeDoc.createElement('style')
      style.textContent = `
        /* Force dark theme background */
        body, html { 
          background-color: #0f0f0f !important; 
          color: #f1f1f1 !important; 
          font-family: 'Roboto', system-ui, sans-serif !important;
        }

        /* Hide the default Gams header/logo to keep it clean */
        header, .header, .navbar, .logo-container { 
          display: none !important; 
        }

        /* Target the game cards (standard layout) */
        a[href*=".html"], .game-card, .gameItem {
            background-color: #1f1f1f !important;
            border: 1px solid #333 !important;
            border-radius: 12px !important;
            overflow: hidden !important;
            transition: all 0.3s ease !important;
            display: flex !important;
            flex-direction: column !important;
            text-decoration: none !important;
        }

        /* Target the footer/title area of the card */
        a[href*=".html"] div, .game-card div, .gameItem div {
            background-color: #ff0033 !important; /* The OfflineTube Red */
            color: white !important;
            font-weight: bold !important;
            padding: 12px !important;
            text-align: center !important;
            font-size: 1rem !important;
        }

        /* The Hover Glow Effect */
        a[href*=".html"]:hover, .game-card:hover, .gameItem:hover {
            transform: translateY(-6px) !important;
            box-shadow: 0 10px 30px rgba(255, 0, 51, 0.6) !important; /* Matches the red theme */
            border-color: #ff0033 !important;
        }

        /* Make sure the image fills the top part nicely */
        a[href*=".html"] img, .game-card img {
            width: 100% !important;
            height: auto !important;
            display: block !important;
            object-fit: cover !important;
            aspect-ratio: 16/9 !important;
        }
      `
      iframeDoc.head.appendChild(style)
    } catch (e) {
      console.error('Could not inject CSS into the Gams iframe:', e)
    }
  }
}
</script>

<template>
  <div class="w-full h-[calc(100vh-3.5rem)] bg-bg relative">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-bg z-10 text-muted">
      <div class="flex flex-col items-center gap-4">
        <svg class="animate-spin h-10 w-10 text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <span class="font-medium text-lg">Loading Game Library...</span>
      </div>
    </div>
    
    <!-- 
      The iframe loads the actual Gams page, 
      but our injected CSS makes it look like a native part of OfflineTube. 
    -->
    <iframe 
      ref="iframeRef"
      src="/gams/Gams.html" 
      class="w-full h-full border-0"
      @load="onIframeLoad"
      allow="fullscreen; autoplay; gamepad"
    ></iframe>
  </div>
</template>
