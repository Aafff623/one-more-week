<script setup lang="ts">
import { defineAsyncComponent, onMounted, type Component } from 'vue'
import AppHeader from './components/AppHeader.vue'
import ConfirmDialog from './components/ConfirmDialog.vue'
import ScreenLoading from './components/ScreenLoading.vue'
import ToastHost from './components/ToastHost.vue'
import CoverScreen from './screens/CoverScreen.vue'
import IdentityScreen from './screens/IdentityScreen.vue'
import IntroScreen from './screens/IntroScreen.vue'
import { useGameStore } from './stores/game'
import { useSettingsStore } from './stores/settings'

const asyncScreen = (loader: () => Promise<{ default: Component }>) =>
  defineAsyncComponent({
    loader,
    loadingComponent: ScreenLoading,
    delay: 120,
    timeout: 15000,
  })

const GameScreen = asyncScreen(() => import('./screens/GameScreen.vue'))
const EndingScreen = asyncScreen(() => import('./screens/EndingScreen.vue'))
const ShareScreen = asyncScreen(() => import('./screens/ShareScreen.vue'))
const SettingsScreen = asyncScreen(() => import('./screens/SettingsScreen.vue'))
const SavesScreen = asyncScreen(() => import('./screens/SavesScreen.vue'))

const game = useGameStore()
const settings = useSettingsStore()

onMounted(() => {
  settings.load()
  game.bootstrap()
})
</script>

<template>
  <a class="skip-link" href="#main">跳到主要内容</a>
  <div class="app-shell">
    <AppHeader v-if="game.screen !== 'cover'" />
    <main id="main" class="site-main">
      <CoverScreen v-if="game.screen === 'cover'" />
      <IntroScreen v-else-if="game.screen === 'intro'" />
      <IdentityScreen v-else-if="game.screen === 'identity'" />
      <GameScreen v-else-if="game.screen === 'game'" />
      <EndingScreen v-else-if="game.screen === 'ending'" />
      <ShareScreen v-else-if="game.screen === 'share'" />
      <SettingsScreen v-else-if="game.screen === 'settings'" />
      <SavesScreen v-else-if="game.screen === 'saves'" />
    </main>
  </div>
  <ToastHost />
  <ConfirmDialog />
</template>
